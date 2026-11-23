import { json, bad, readBody, localDay } from '../_lib/util.js';
import { schedule } from '../_lib/fsrs.js';
export async function onRequestPost({ request, env }) {
  const { card_id, direction, grade, ms } = await readBody(request);
  if (!Number.isInteger(card_id) || !['produce', 'recognize'].includes(direction) ||
      ![1, 2, 3, 4].includes(grade)) return bad('bad review');
  const card = await env.DB.prepare('SELECT id, profile FROM cards WHERE id = ?').bind(card_id).first();
  if (!card) return bad('no such card', 404);
  const prev = await env.DB.prepare('SELECT * FROM review_state WHERE card_id = ?1 AND direction = ?2')
    .bind(card_id, direction).first();
  const now = new Date();
  const n = schedule(prev, grade, now);
  const day = localDay(request, now);
  const duration = Math.min(Math.max(0, Math.round(ms || 0)), 600000);
  const isNew = prev ? 0 : 1;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO review_state (card_id, direction, due, stability, difficulty, reps, lapses, state, last_review)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(card_id, direction) DO UPDATE SET due = ?3, stability = ?4, difficulty = ?5,
          reps = ?6, lapses = ?7, state = ?8, last_review = ?9`)
      .bind(card_id, direction, n.due, n.stability, n.difficulty, n.reps, n.lapses, n.state, n.last_review),
    env.DB.prepare(`INSERT INTO review_log (profile, card_id, direction, grade, state_before, elapsed_days, duration_ms, reviewed_at, day)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
      .bind(card.profile, card_id, direction, grade, prev ? prev.state : 0, n.elapsed_days, duration, n.last_review, day),
    env.DB.prepare(`INSERT INTO daily_log (profile, day, minutes, reviews, new_items) VALUES (?1, ?2, ?3, 1, ?4)
        ON CONFLICT(profile, day) DO UPDATE SET minutes = minutes + ?3, reviews = reviews + 1, new_items = new_items + ?4`)
      .bind(card.profile, day, duration / 60000, isNew),
  ]);
  return json({ due: n.due, state: n.state });
}
