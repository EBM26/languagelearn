import { json, bad, readBody } from '../../_lib/util.js';
import { loadProfile } from '../../_lib/profiles.js';
import { startTopic, topicStats } from '../../_lib/grammar.js';
// Manually start a grammar topic (default: the next one not started yet).
export async function onRequestPost({ request, env }) {
  const b = await readBody(request);
  const p = await loadProfile(env, request, b.profile);
  if (!p?.grammar_topics?.length) return bad('no grammar topics for this profile', 404);
  const st = await env.DB.prepare('SELECT active FROM profiles_state WHERE profile = ?').bind(p.code).first();
  if (!st?.active) return bad('profile is not active');
  const topic = b.topic ?? (await topicStats(env, p)).find((t) => !t.started)?.topic;
  if (!topic || !p.grammar_topics.includes(topic)) return bad('no topic to start');
  try { return json({ topic, ...(await startTopic(env, p, topic)) }); }
  catch (e) { return bad(`could not start topic: ${e.message}`, 502); }
}
