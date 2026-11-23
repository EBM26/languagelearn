import { json, bad, readBody, localDay } from '../_lib/util.js';
import { loadProfile } from '../_lib/profiles.js';
import { weekStart } from '../_lib/stats.js';
// POST {profile, done} -> tick or untick "I talked to a real person this week"
export async function onRequestPost({ request, env }) {
  const b = await readBody(request);
  const p = await loadProfile(env, request, b.profile);
  if (!p) return bad('unknown profile', 404);
  const week = weekStart(localDay(request));
  if (b.done) await env.DB.prepare(`INSERT OR IGNORE INTO human_practice (profile, week, done_at) VALUES (?1, ?2, datetime('now'))`).bind(p.code, week).run();
  else await env.DB.prepare('DELETE FROM human_practice WHERE profile = ? AND week = ?').bind(p.code, week).run();
  return json({ ok: true, week, done: !!b.done });
}
