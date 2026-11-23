import { json, bad, readBody } from '../_lib/util.js';
import { loadProfile } from '../_lib/profiles.js';
import { topicStats, weakSpots, genTables } from '../_lib/grammar.js';

// GET: topic progress, reference tables for STARTED topics, and weak spots.
export async function onRequestGet({ request, env }) {
  const p = await loadProfile(env, request, new URL(request.url).searchParams.get('profile'));
  if (!p) return bad('unknown profile', 404);
  const topics = await topicStats(env, p);
  const tables = (await env.DB.prepare('SELECT * FROM reference_tables WHERE profile = ? ORDER BY id').bind(p.code).all()).results
    .map((r) => ({ id: r.id, topic: r.topic, title: JSON.parse(r.title), ...JSON.parse(r.data) }));
  return json({ topics, tables, weak: await weakSpots(env, p.code) });
}
// POST {profile, topic}: (re)generate all tables for a started topic.
export async function onRequestPost({ request, env }) {
  const b = await readBody(request);
  const p = await loadProfile(env, request, b.profile);
  if (!p?.grammar_topics?.includes(b.topic)) return bad('unknown topic', 404);
  const t = (await topicStats(env, p)).find((x) => x.topic === b.topic);
  if (!t?.started) return bad('start the topic first');
  try { return json({ tables: await genTables(env, p, b.topic) }); } catch (e) { return bad(`table generation failed: ${e.message}`, 502); }
}
