import { json, bad, readBody } from '../../../_lib/util.js';
import { insertCards } from '../../../_lib/cards.js';
// Add a tapped word to the deck. Content comes from the stored story, never from the client.
export async function onRequestPost({ request, env, params }) {
  const id = parseInt(params.id, 10), { sentence, token } = await readBody(request);
  const row = await env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(id).first();
  if (!row) return bad('no such story', 404);
  const s = JSON.parse(row.body).sentences[sentence], tk = s?.tokens?.[token];
  if (!tk) return bad('no such word');
  const item = { target_text: tk.b, type: 'word', translit_latin: tk.latin, translit_hebrew: tk.hebrew, english: tk.en, hebrew: tk.he,
    cognate_hint: null, tags: { story: id }, example_target: s.target, example_en: s.en, example_he: s.he };
  const seq = 7000 + (id % 2900);
  const added = await insertCards(env, row.profile, [item], { source: 'personal', seqOf: () => seq });
  if (!added) await env.DB.prepare('UPDATE cards SET seq = ?1 WHERE profile = ?2 AND target_text = ?3 AND seq > ?1').bind(seq, row.profile, tk.b).run();
  return json({ added, existing: !added });
}
