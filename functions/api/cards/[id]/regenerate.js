import { json, bad } from '../../../_lib/util.js';
import { loadProfile } from '../../../_lib/profiles.js';
import { llmJson } from '../../../_lib/llm.js';
import { systemFor, regeneratePrompt } from '../../../_lib/llm-prompts.js';
import { normalizeItem } from '../../../_lib/cards-validate.js';

// Replace a (usually flagged) card's content with a corrected version from the LLM.
export async function onRequestPost({ request, env, params }) {
  const card = await env.DB.prepare('SELECT * FROM cards WHERE id = ?').bind(parseInt(params.id, 10)).first();
  if (!card) return bad('no such card', 404);
  if (['letter', 'syllable'].includes(card.type)) return bad('script cards are not regenerated');
  const p = await loadProfile(env, request, card.profile);
  if (!p) return bad('unknown profile', 404);
  try {
    const items = await llmJson(env, { system: systemFor(p), user: regeneratePrompt(p, card, card.flag_note),
      validate: (o) => { const it = normalizeItem(p, o.items?.[0]); if (!it) throw new Error('invalid item'); return it; } });
    const old = JSON.parse(card.tags || '{}');
    await env.DB.prepare(`UPDATE cards SET target_text=?2, translit_latin=?3, translit_hebrew=?4, english=?5, hebrew=?6,
        cognate_hint=?7, tags=?8, example_target=?9, example_en=?10, example_he=?11, flagged=0, flag_note=NULL WHERE id=?1`)
      .bind(card.id, items.target_text, items.translit_latin, items.translit_hebrew, items.english, items.hebrew,
        items.cognate_hint, JSON.stringify({ ...items.tags, ...(old.seed ? { seed: 1 } : {}) }),
        items.example_target, items.example_en, items.example_he).run();
    return json({ ok: true });
  } catch (e) { return bad(`regeneration failed: ${e.message}`, 502); }
}
