import { json, bad, readBody } from '../_lib/util.js';
import { loadProfile } from '../_lib/profiles.js';
import { llmJson } from '../_lib/llm.js';
import { systemFor, phrasesPrompt } from '../_lib/llm-prompts.js';
import { normalizeItems } from '../_lib/cards-validate.js';
import { insertCards } from '../_lib/cards.js';

export async function onRequestGet({ request, env }) {
  const profile = new URL(request.url).searchParams.get('profile');
  const reqs = (await env.DB.prepare('SELECT * FROM phrase_requests WHERE profile = ? ORDER BY id DESC LIMIT 30').bind(profile).all()).results;
  if (!reqs.length) return json({ requests: [] });
  const ids = reqs.map((r) => r.id);
  const cards = (await env.DB.prepare(
    `SELECT id, request_id, target_text, english, hebrew, translit_latin, translit_hebrew, flagged FROM cards
      WHERE request_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`).bind(...ids).all()).results;
  return json({ requests: reqs.map((r) => ({ ...r, cards: cards.filter((c) => c.request_id === r.id) })) });
}

// POST {profile, text}  -> new request;  POST {profile, retry_id} -> re-run a failed one
export async function onRequestPost({ request, env }) {
  const b = await readBody(request);
  const p = await loadProfile(env, request, b.profile);
  if (!p) return bad('unknown profile', 404);
  const st = await env.DB.prepare('SELECT active FROM profiles_state WHERE profile = ?').bind(p.code).first();
  if (!st?.active) return bad('profile is not active');
  let id, text;
  if (b.retry_id) {
    const r = await env.DB.prepare(`SELECT * FROM phrase_requests WHERE id = ? AND profile = ? AND status != 'done'`)
      .bind(b.retry_id, p.code).first();
    if (!r) return bad('nothing to retry', 404);
    id = r.id; text = r.request_text;
  } else {
    text = String(b.text || '').trim().slice(0, 500);
    if (!text) return bad('text required');
    const lang = /[֐-׿]/.test(text) ? 'he' : 'en';
    id = (await env.DB.prepare(`INSERT INTO phrase_requests (profile, request_text, input_lang, status) VALUES (?1,?2,?3,'pending')`)
      .bind(p.code, text, lang).run()).meta.last_row_id;
  }
  const inputLang = /[֐-׿]/.test(text) ? 'he' : 'en';
  try {
    const wrap = (o) => { if (!Array.isArray(o.items)) throw new Error('bad shape'); return normalizeItems(p, o.items).slice(0, 8); };
    const items = await llmJson(env, { system: systemFor(p), user: phrasesPrompt(p, text, inputLang), validate: wrap });
    if (items.length < 1) throw new Error('no usable items');
    const inserted = await insertCards(env, p.code, items, { source: 'personal', seqOf: () => 7000 + (id % 2900), requestId: id });
    // Items that already exist as cards (e.g. in the frequency list) move up in priority instead.
    for (const it of items) await env.DB.prepare('UPDATE cards SET seq = ?1 WHERE profile = ?2 AND target_text = ?3 AND seq > ?1')
      .bind(7000 + (id % 2900), p.code, it.target_text).run();
    await env.DB.prepare(`UPDATE phrase_requests SET status='done', result_count=?2, error=NULL WHERE id=?1`).bind(id, items.length).run();
    return json({ ok: true, id, added: inserted, total: items.length });
  } catch (e) {
    await env.DB.prepare(`UPDATE phrase_requests SET status='failed', error=?2 WHERE id=?1`).bind(id, String(e.message).slice(0, 300)).run();
    return json({ error: `could not build phrases: ${e.message}`, id }, 502);
  }
}
