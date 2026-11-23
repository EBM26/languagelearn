import { json, bad, readBody } from '../../_lib/util.js';
// "Report problem": flags a card so it leaves the queues until reviewed/regenerated.
export async function onRequestPost({ request, env }) {
  const { id, note } = await readBody(request);
  if (!Number.isInteger(id)) return bad('bad id');
  await env.DB.prepare('UPDATE cards SET flagged = 1, flag_note = ?2 WHERE id = ?1')
    .bind(id, String(note || '').slice(0, 500)).run();
  return json({ ok: true });
}
