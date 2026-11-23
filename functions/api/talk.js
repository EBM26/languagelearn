import { json, bad, readBody, localDay } from '../_lib/util.js';
import { loadProfile } from '../_lib/profiles.js';
import { pickTopic, nextReply } from '../_lib/talk.js';

// GET ?profile= -> recent conversations with their corrections (for rereading)
export async function onRequestGet({ request, env }) {
  const profile = new URL(request.url).searchParams.get('profile');
  const rows = (await env.DB.prepare('SELECT id, day, topic, summary, finished_at FROM conversations WHERE profile = ? ORDER BY id DESC LIMIT 15').bind(profile).all()).results;
  const cors = rows.length ? (await env.DB.prepare(
    `SELECT conversation_id, said, better, explanation, card_id FROM corrections WHERE conversation_id IN (${rows.map(() => '?').join(',')}) ORDER BY id`)
    .bind(...rows.map((r) => r.id)).all()).results : [];
  return json({ conversations: rows.map((r) => ({ ...r, summary: r.summary ? JSON.parse(r.summary) : null,
    corrections: cors.filter((c) => c.conversation_id === r.id).map((c) => ({ ...c, explanation: JSON.parse(c.explanation || 'null') })) })) });
}

// POST {profile, topic?} -> start a conversation; the partner speaks first.
export async function onRequestPost({ request, env }) {
  const b = await readBody(request);
  const p = await loadProfile(env, request, b.profile);
  if (!p) return bad('unknown profile', 404);
  const st = await env.DB.prepare('SELECT active FROM profiles_state WHERE profile = ?').bind(p.code).first();
  if (!st?.active) return bad('profile is not active');
  const topic = String(b.topic || '').trim().slice(0, 200) || await pickTopic(env, p.code);
  try {
    const conv = { topic, transcript: [] };
    const first = await nextReply(env, p, conv, 'first');
    const id = (await env.DB.prepare('INSERT INTO conversations (profile, day, topic, transcript) VALUES (?1,?2,?3,?4)')
      .bind(p.code, localDay(request), topic, JSON.stringify([first])).run()).meta.last_row_id;
    return json({ id, topic, message: first });
  } catch (e) { return bad(`could not start the conversation: ${e.message}`, 502); }
}
