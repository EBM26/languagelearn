import { json, bad, readBody, localDay } from '../../_lib/util.js';
import { loadProfile } from '../../_lib/profiles.js';
// Activate/deactivate a profile and set its daily new-item count.
// (Seed-deck generation on activation is added in Phase 2.)
export async function onRequestPost({ request, env, params }) {
  const profile = await loadProfile(env, request, params.code);
  if (!profile) return bad('unknown profile', 404);
  const body = await readBody(request);
  const active = body.active ? 1 : 0;
  const npd = Number.isInteger(body.new_per_day) && body.new_per_day >= 0 && body.new_per_day <= 50
    ? body.new_per_day : profile.new_per_day_default ?? 7;
  await env.DB.prepare(`INSERT INTO profiles_state (profile, active, start_date, new_per_day)
      VALUES (?1, ?2, ?3, ?4)
      ON CONFLICT(profile) DO UPDATE SET active = ?2,
        start_date = COALESCE(profiles_state.start_date, ?3),
        new_per_day = CASE WHEN ?5 THEN ?4 ELSE profiles_state.new_per_day END`)
    .bind(params.code, active, localDay(request), npd, body.new_per_day !== undefined ? 1 : 0).run();
  return json({ ok: true });
}
