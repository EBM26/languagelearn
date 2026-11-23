import { json, bad, readBody } from '../../../_lib/util.js';
import { loadProfile } from '../../../_lib/profiles.js';
import { generateStory, loadStory } from '../../../_lib/story.js';
// "Report problem": replace the story (same id/day), guided by the learner's note.
export async function onRequestPost({ request, env, params }) {
  const row = await env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(parseInt(params.id, 10)).first();
  if (!row) return bad('no such story', 404);
  const p = await loadProfile(env, request, row.profile);
  const { note } = await readBody(request);
  try {
    const g = await generateStory(env, p, { note: String(note || '').slice(0, 300) });
    await env.DB.prepare(`UPDATE stories SET title=?2, body=?3, new_words=?4, grammar_focus=?5, format=?6, word_count=?7, known_pct=?8, read_at=NULL WHERE id=?1`)
      .bind(row.id, g.title, g.body, g.new_words, g.grammar_focus, g.format, g.word_count, g.known_pct).run();
  } catch (e) { return bad(`could not rewrite the story: ${e.message}`, 502); }
  return json(await loadStory(env, await env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(row.id).first()));
}
