import { json, bad, localDay } from '../../../_lib/util.js';
import { markStep } from '../../../_lib/session.js';
export async function onRequestPost({ request, env, params }) {
  const id = parseInt(params.id, 10);
  const row = await env.DB.prepare('SELECT profile FROM stories WHERE id = ?').bind(id).first();
  if (!row) return bad('no such story', 404);
  await env.DB.prepare('UPDATE stories SET read_at = COALESCE(read_at, ?2) WHERE id = ?1').bind(id, new Date().toISOString()).run();
  return json({ steps_done: await markStep(env, row.profile, localDay(request), 'story') });
}
