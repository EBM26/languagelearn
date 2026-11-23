// Record a completed daily-session step in daily_log.steps_done (and any minutes spent on a step
// that isn't a card review, since reviews log their own time).
export async function markStep(env, profile, day, step, minutes = 0) {
  const row = await env.DB.prepare('SELECT steps_done FROM daily_log WHERE profile = ? AND day = ?').bind(profile, day).first();
  const done = new Set(row ? JSON.parse(row.steps_done) : []); done.add(step);
  await env.DB.prepare(`INSERT INTO daily_log (profile, day, steps_done, minutes) VALUES (?1, ?2, ?3, ?4)
      ON CONFLICT(profile, day) DO UPDATE SET steps_done = ?3, minutes = minutes + ?4`).bind(profile, day, JSON.stringify([...done]), minutes).run();
  return [...done];
}
