import { llmJson } from './llm.js';
import { systemFor, talkPrompt } from './llm-prompts.js';
import { normalizeReply } from './cards-validate.js';
import { recentWords } from './story.js';

export const MAX_TURNS = 8;     // learner turns before the partner wraps up (the spec asks for 5-10)

// Today's topic: the newest "I want to say..." request, else the latest story's title, else small talk.
export async function pickTopic(env, code) {
  const r = await env.DB.prepare(`SELECT request_text FROM phrase_requests WHERE profile = ? AND status = 'done' ORDER BY id DESC LIMIT 1`).bind(code).first();
  if (r) return r.request_text;
  const s = await env.DB.prepare('SELECT title FROM stories WHERE profile = ? ORDER BY id DESC LIMIT 1').bind(code).first();
  return s?.title ? `the story "${s.title}"` : 'everyday small talk: greetings, family, food, the day';
}

export const loadConv = async (env, id) => {
  const row = await env.DB.prepare('SELECT * FROM conversations WHERE id = ?').bind(id).first();
  return row && { ...row, transcript: JSON.parse(row.transcript || '[]') };
};
export const saveTranscript = (env, id, transcript) =>
  env.DB.prepare('UPDATE conversations SET transcript = ? WHERE id = ?').bind(JSON.stringify(transcript), id).run();

// The partner's next line. `transcript` is the stored conversation (ai lines + learner lines).
export async function nextReply(env, p, conv, mode) {
  const history = conv.transcript.slice(-12).map((m) => (m.role === 'ai' ? { role: 'ai', text: m.target } : { role: 'user', text: m.text }));
  const known = await recentWords(env, p.code);
  return llmJson(env, { system: systemFor(p), user: talkPrompt(p, { topic: conv.topic, known, history, mode }),
    validate: (o) => { const r = normalizeReply(p, o); if (!r) throw new Error('invalid reply'); return r; } });
}
