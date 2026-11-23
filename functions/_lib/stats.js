import { weakSpots } from './grammar.js';

const DAY = 86400000;
const toMs = (d) => Date.parse(d + 'T00:00:00Z');
const dayStr = (ms) => new Date(ms).toISOString().slice(0, 10);
// Monday of the week containing `day` (YYYY-MM-DD).
export const weekStart = (day) => { const ms = toMs(day), dow = new Date(ms).getUTCDay(); return dayStr(ms - ((dow + 6) % 7) * DAY); };

// An "active" day is one with any review or any completed session step.
const isActive = (r) => r.reviews > 0 || JSON.parse(r.steps_done || '[]').length > 0;

export function streaks(rows, today) {
  const active = new Set(rows.filter(isActive).map((r) => r.day));
  let cur = 0, c = toMs(today);
  if (!active.has(today)) c -= DAY;                  // today not done yet doesn't break the streak
  while (active.has(dayStr(c))) { cur++; c -= DAY; }
  let best = 0, run = 0, prev = null;
  for (const d of [...active].sort()) { run = prev !== null && toMs(d) - prev === DAY ? run + 1 : 1; best = Math.max(best, run); prev = toMs(d); }
  return { current: cur, best };
}

export async function profileStats(env, p, today) {
  const code = p.code;
  const rows = (await env.DB.prepare('SELECT day, minutes, reviews, new_items, steps_done FROM daily_log WHERE profile = ? ORDER BY day DESC LIMIT 400').bind(code).all()).results;
  const byDay = Object.fromEntries(rows.map((r) => [r.day, r]));
  const last14 = Array.from({ length: 14 }, (_, i) => { const d = dayStr(toMs(today) - (13 - i) * DAY);
    return { day: d, minutes: Math.round((byDay[d]?.minutes || 0) * 10) / 10, reviews: byDay[d]?.reviews || 0 }; });
  const learned = await env.DB.prepare(
    `SELECT COUNT(DISTINCT r.card_id) AS started, COUNT(DISTINCT CASE WHEN r.stability >= 21 THEN r.card_id END) AS mature
       FROM review_state r JOIN cards c ON c.id = r.card_id WHERE c.profile = ? AND r.reps > 0`).bind(code).first();
  const since = dayStr(toMs(today) - 29 * DAY);
  const ret = await env.DB.prepare(
    `SELECT COUNT(*) AS n, SUM(grade >= 2) AS ok FROM review_log WHERE profile = ? AND state_before = 2 AND day >= ?`).bind(code, since).first();
  const week = weekStart(today);
  const human = await env.DB.prepare('SELECT done_at FROM human_practice WHERE profile = ? AND week = ?').bind(code, week).first();
  const weak = p.grammar_topics?.length ? (await weakSpots(env, code)).filter((w) => w.axis !== 'topic').slice(0, 5) : [];
  const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM cards WHERE profile = ?').bind(code).first()).n;
  return {
    streak: streaks(rows, today), today: { minutes: Math.round((byDay[today]?.minutes || 0) * 10) / 10, steps_done: JSON.parse(byDay[today]?.steps_done || '[]') },
    last14, minutes_14d: Math.round(last14.reduce((a, d) => a + d.minutes, 0)),
    items: { started: learned.started, mature: learned.mature, total },
    retention: ret.n >= 10 ? { rate: ret.ok / ret.n, n: ret.n } : { rate: null, n: ret.n },
    weak, human: { week, done: !!human },
  };
}
