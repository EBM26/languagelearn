import { json, bad, readBody } from '../../../_lib/util.js';
import { loadProfile } from '../../../_lib/profiles.js';
import { llmJson } from '../../../_lib/llm.js';
import { systemFor, referencePrompt } from '../../../_lib/llm-prompts.js';
import { normalizeTable } from '../../../_lib/cards-validate.js';
import { labelOf } from '../../../_lib/grammar.js';

// Replace one reference table, optionally guided by the learner's note ("report problem").
export async function onRequestPost({ request, env, params }) {
  const row = await env.DB.prepare('SELECT * FROM reference_tables WHERE id = ?').bind(parseInt(params.id, 10)).first();
  if (!row) return bad('no such table', 404);
  const p = await loadProfile(env, request, row.profile);
  const { note } = await readBody(request);
  try {
    const t = await llmJson(env, { system: systemFor(p),
      user: referencePrompt(p, labelOf(p, row.topic), { title: JSON.parse(row.title), note: String(note || '').slice(0, 300) }),
      validate: (o) => { const x = normalizeTable(p, o.tables?.[0]); if (!x) throw new Error('invalid table'); return x; } });
    await env.DB.prepare('UPDATE reference_tables SET title = ?2, data = ?3 WHERE id = ?1')
      .bind(row.id, JSON.stringify(t.title), JSON.stringify(t.data)).run();
    return json({ ok: true });
  } catch (e) { return bad(`regeneration failed: ${e.message}`, 502); }
}
