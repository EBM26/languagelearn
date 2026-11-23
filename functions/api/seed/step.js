import { json, bad, readBody } from '../../_lib/util.js';
import { loadProfile } from '../../_lib/profiles.js';
import { llmJson } from '../../_lib/llm.js';
import { systemFor, seedPrompt, verifyPrompt } from '../../_lib/llm-prompts.js';
import { normalizeItems } from '../../_lib/cards-validate.js';
import { insertCards } from '../../_lib/cards.js';
import { seedCount } from './status.js';

// One resumable batch of seed generation. The client calls this until `done`.
export async function onRequestPost({ request, env }) {
  const { profile: code } = await readBody(request);
  const p = await loadProfile(env, request, code);
  if (!p) return bad('unknown profile', 404);
  if (!p.seed?.enabled) return bad('seed generation is not enabled for this profile');
  const st = await env.DB.prepare('SELECT active FROM profiles_state WHERE profile = ?').bind(code).first();
  if (!st?.active) return bad('profile is not active');   // inactive profiles never call the LLM

  const target = p.seed.size ?? 1500;
  const have = await seedCount(env, code);
  if (have >= target) return json({ generated: have, target, inserted: 0, done: true });

  const from = have + 1, to = Math.min(target, have + (p.seed.batch ?? 20));
  const recent = (await env.DB.prepare(
    `SELECT target_text FROM cards WHERE profile = ? AND json_extract(tags, '$.seed') = 1 ORDER BY id DESC LIMIT 60`)
    .bind(code).all()).results.map((r) => r.target_text);
  const system = systemFor(p);
  const wrap = (o) => { if (!Array.isArray(o.items)) throw new Error('bad shape'); return o.items; };
  try {
    let raw = await llmJson(env, { system, user: seedPrompt(p, from, to, recent), validate: wrap });
    if (p.seed.verify) {
      try {
        const fixed = await llmJson(env, { system, user: verifyPrompt(p, raw), validate: wrap });
        if (fixed.length === raw.length) raw = fixed;     // otherwise keep the unverified batch
      } catch { /* verification is best-effort */ }
    }
    const items = normalizeItems(p, raw);
    const inserted = await insertCards(env, code, items, { source: 'frequency', seqOf: (i) => 10000 + from + i, extraTags: { seed: 1 } });
    const generated = have + inserted;
    return json({ generated, target, inserted, done: generated >= target });
  } catch (e) {
    return bad(`seed generation failed: ${e.message}`, 502);
  }
}
