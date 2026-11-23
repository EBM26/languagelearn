import { json, bad, readBody, localDay } from '../../_lib/util.js';
import { loadProfile } from '../../_lib/profiles.js';
import { generateStory, loadStory } from '../../_lib/story.js';

// Today's story for a profile; generated on first request (idempotent per profile per day).
export async function onRequestPost({ request, env }) {
  const { profile: code } = await readBody(request);
  const p = await loadProfile(env, request, code);
  if (!p) return bad('unknown profile', 404);
  const st = await env.DB.prepare('SELECT active FROM profiles_state WHERE profile = ?').bind(code).first();
  if (!st?.active) return bad('profile is not active');
  const day = localDay(request);
  let row = await env.DB.prepare('SELECT * FROM stories WHERE profile = ? AND day = ?').bind(code, day).first();
  if (!row) {
    try {
      const g = await generateStory(env, p);
      await env.DB.prepare(`INSERT OR IGNORE INTO stories (profile, day, title, body, new_words, grammar_focus, format, word_count, known_pct)
          VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`).bind(code, day, g.title, g.body, g.new_words, g.grammar_focus, g.format, g.word_count, g.known_pct).run();
    } catch (e) { return bad(`could not write today's story: ${e.message}`, 502); }
    row = await env.DB.prepare('SELECT * FROM stories WHERE profile = ? AND day = ?').bind(code, day).first();
  }
  return json(await loadStory(env, row));
}
