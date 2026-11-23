import { json, bad, localDay } from '../_lib/util.js';
import { loadProfile } from '../_lib/profiles.js';
import { profileStats } from '../_lib/stats.js';
// GET ?profile= -> streaks, minutes per day, items learned, retention, weak grammar areas, today's steps, weekly nudge
export async function onRequestGet({ request, env }) {
  const p = await loadProfile(env, request, new URL(request.url).searchParams.get('profile'));
  if (!p) return bad('unknown profile', 404);
  return json(await profileStats(env, p, localDay(request)));
}
