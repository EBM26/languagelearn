import { json, bad } from '../../_lib/util.js';
import { loadProfile } from '../../_lib/profiles.js';
export async function seedCount(env, code) {
  return (await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE profile = ? AND json_extract(tags, '$.seed') = 1`)
    .bind(code).first()).n;
}
export async function onRequestGet({ request, env }) {
  const p = await loadProfile(env, request, new URL(request.url).searchParams.get('profile'));
  if (!p) return bad('unknown profile', 404);
  return json({ enabled: !!p.seed?.enabled, target: p.seed?.size ?? 0, generated: await seedCount(env, p.code) });
}
