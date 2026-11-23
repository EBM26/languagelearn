import { json, bad, readBody } from '../../_lib/util.js';
const FIELDS = ['target_text', 'translit_latin', 'translit_hebrew', 'english', 'hebrew', 'cognate_hint',
  'example_target', 'example_en', 'example_he'];
export async function onRequestPut({ request, env, params }) {
  const id = parseInt(params.id, 10), b = await readBody(request);
  const sets = [], args = [id];
  for (const f of FIELDS) if (f in b) { args.push(b[f] === '' ? null : String(b[f]).slice(0, 500)); sets.push(`${f} = ?${args.length}`); }
  if ('flagged' in b) { sets.push(`flagged = ${b.flagged ? 1 : 0}`); if (!b.flagged) sets.push('flag_note = NULL'); }
  if (!sets.length) return bad('nothing to update');
  if ('target_text' in b && !String(b.target_text).trim()) return bad('target_text required');
  try { await env.DB.prepare(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?1`).bind(...args).run(); }
  catch (e) { return bad('could not save (duplicate card?)', 409); }
  return json({ ok: true });
}
export async function onRequestDelete({ env, params }) {
  const id = parseInt(params.id, 10);
  await env.DB.batch([env.DB.prepare('DELETE FROM review_state WHERE card_id = ?').bind(id),
    env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(id)]);
  return json({ ok: true });
}
