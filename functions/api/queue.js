import { json, bad, localDay } from '../_lib/util.js';
// Due reviews + today's allowance of new cards for one profile.
export async function onRequestGet({ request, env }) {
  const profile = new URL(request.url).searchParams.get('profile');
  if (!profile) return bad('profile required');
  const day = localDay(request);
  const state = await env.DB.prepare('SELECT * FROM profiles_state WHERE profile = ?').bind(profile).first();
  const npd = state?.new_per_day ?? 7;
  const due = (await env.DB.prepare(
    `SELECT c.*, r.direction AS dir, r.due, r.reps, r.lapses, r.state AS fsrs_state
       FROM review_state r JOIN cards c ON c.id = r.card_id
      WHERE c.profile = ?1 AND c.flagged = 0 AND r.due <= ?2
      ORDER BY r.due LIMIT 150`).bind(profile, new Date().toISOString()).all()).results;
  const newToday = (await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM review_log WHERE profile = ?1 AND day = ?2 AND state_before = 0')
    .bind(profile, day).first()).n;
  const left = Math.max(0, npd - newToday);
  const fresh = left === 0 ? [] : (await env.DB.prepare(
    `SELECT c.*, c.direction AS dir FROM cards c
      LEFT JOIN review_state r ON r.card_id = c.id AND r.direction = c.direction
      WHERE c.profile = ?1 AND c.flagged = 0 AND r.card_id IS NULL
      ORDER BY c.seq, c.id LIMIT ?2`).bind(profile, left).all()).results;
  return json({ due, new: fresh, new_per_day: npd, new_today: newToday });
}
