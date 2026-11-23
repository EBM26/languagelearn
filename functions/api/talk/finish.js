import { json, bad, readBody, localDay } from '../../_lib/util.js';
import { loadProfile } from '../../_lib/profiles.js';
import { llmJson } from '../../_lib/llm.js';
import { systemFor, correctPrompt } from '../../_lib/llm-prompts.js';
import { normalizeCorrections } from '../../_lib/cards-validate.js';
import { insertCards } from '../../_lib/cards.js';
import { markStep } from '../../_lib/session.js';
import { loadConv } from '../../_lib/talk.js';

const MISTAKE_SEQ = 90;   // mistakes jump ahead of the frequency list in the new-card queue

// POST {id, ms?} -> correction summary; each correction becomes a review card (source = mistake).
// Safe to call again: a finished conversation just returns what was stored.
export async function onRequestPost({ request, env }) {
  const { id, ms } = await readBody(request);
  const conv = await loadConv(env, id);
  if (!conv) return bad('no such conversation', 404);
  const stored = async () => ({ summary: conv.summary ? JSON.parse(conv.summary) : null,
    corrections: (await env.DB.prepare('SELECT said, better, explanation, card_id FROM corrections WHERE conversation_id = ? ORDER BY id').bind(id).all())
      .results.map((c) => ({ ...c, explanation: JSON.parse(c.explanation || 'null') })) });
  if (conv.finished_at) return json(await stored());
  const p = await loadProfile(env, request, conv.profile);
  const history = conv.transcript.map((m) => (m.role === 'ai' ? { role: 'ai', text: m.target } : { role: 'user', text: m.text }));
  const hasUser = history.some((m) => m.role === 'user');
  try {
    const res = hasUser ? await llmJson(env, { system: systemFor(p), user: correctPrompt(p, history), validate: (o) => normalizeCorrections(p, o) })
      : { summary: null, corrections: [] };
    const items = res.corrections.map((c) => c.item);
    await insertCards(env, p.code, items, { source: 'mistake', seqOf: () => MISTAKE_SEQ, extraTags: { origin: 'speaking' } });
    for (const c of res.corrections) {
      const card = await env.DB.prepare('SELECT id FROM cards WHERE profile = ? AND type = ? AND target_text = ?').bind(p.code, c.item.type, c.item.target_text).first();
      await env.DB.prepare('INSERT INTO corrections (profile, conversation_id, said, better, explanation, card_id) VALUES (?1,?2,?3,?4,?5,?6)')
        .bind(p.code, id, c.said, c.item.target_text, JSON.stringify(c.explanation), card?.id ?? null).run();
    }
    await env.DB.prepare(`UPDATE conversations SET summary = ?2, finished_at = datetime('now') WHERE id = ?1`).bind(id, res.summary ? JSON.stringify(res.summary) : null).run();
    if (hasUser) {
      const day = localDay(request), mins = Math.min(Math.max(0, +ms || 0), 30 * 60000) / 60000;
      await markStep(env, p.code, day, 'speaking', mins);
    }
    conv.summary = res.summary ? JSON.stringify(res.summary) : null;
    return json(await stored());
  } catch (e) { return bad(`could not review the conversation: ${e.message}`, 502); }
}
