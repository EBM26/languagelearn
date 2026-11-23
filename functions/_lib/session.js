// Record a completed daily-session step in daily_log.steps_done.
export async function markStep(env, profile, day, step) {
  const row = await env.DB.prepare('SELECT steps_done FROM daily_log WHERE profile = ? AND day = ?').bind(profile, day).first();
  const done = new Set(row ? JSON.parse(row.steps_done) : []); done.add(step);
  await env.DB.prepare(`INSERT INTO daily_log (profile, day, steps_done) VALUES (?1, ?2, ?3)
      ON CONFLICT(profile, day) DO UPDATE SET steps_done = ?3`).bind(profile, day, JSON.stringify([...done])).run();
  return [...done];
}
