import { json, bad, readBody, localDay } from '../_lib/util.js';
import { markStep } from '../_lib/session.js';
const STEPS = ['reviews', 'new', 'grammar', 'story', 'speaking'];
// Record a completed daily-session step in daily_log.steps_done.
export async function onRequestPost({ request, env }) {
  const { profile, step } = await readBody(request);
  if (!profile || !STEPS.includes(step)) return bad('bad step');
  return json({ steps_done: await markStep(env, profile, localDay(request), step) });
}
