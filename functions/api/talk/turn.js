import { json, bad, readBody } from '../../_lib/util.js';
import { loadProfile } from '../../_lib/profiles.js';
import { loadConv, nextReply, saveTranscript, MAX_TURNS } from '../../_lib/talk.js';

// POST {id, text} -> the learner's turn; returns the partner's reply and whether the conversation is over.
export async function onRequestPost({ request, env }) {
  const { id, text: raw } = await readBody(request);
  const text = String(raw || '').trim().slice(0, 500);
  if (!text) return bad('text required');
  const conv = await loadConv(env, id);
  if (!conv) return bad('no such conversation', 404);
  if (conv.finished_at) return bad('conversation is finished');
  const p = await loadProfile(env, request, conv.profile);
  conv.transcript.push({ role: 'user', text });
  const turns = conv.transcript.filter((m) => m.role === 'user').length;
  const final = turns >= MAX_TURNS;
  try {
    const reply = await nextReply(env, p, conv, final ? 'final' : 'next');
    conv.transcript.push(reply);
    await saveTranscript(env, id, conv.transcript);
    return json({ message: reply, turns, done: final });
  } catch (e) {
    // Nothing was saved, so the client can resend the same line.
    return bad(`the partner could not reply: ${e.message}`, 502);
  }
}
