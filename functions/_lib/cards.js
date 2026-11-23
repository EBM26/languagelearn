// Shared card insertion. Returns how many rows were actually inserted (duplicates are ignored).
export async function insertCards(env, code, items, { source, seqOf, requestId = null, extraTags = {} }) {
  if (!items.length) return 0;
  const stmts = items.map((c, i) => env.DB.prepare(
    `INSERT OR IGNORE INTO cards (profile, target_text, translit_latin, translit_hebrew, english, hebrew, cognate_hint,
       type, direction, tags, source, example_target, example_en, example_he, seq, request_id)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'produce',?9,?10,?11,?12,?13,?14,?15)`)
    .bind(code, c.target_text, c.translit_latin, c.translit_hebrew, c.english, c.hebrew, c.cognate_hint, c.type,
      JSON.stringify({ ...c.tags, ...extraTags }), source, c.example_target, c.example_en, c.example_he, seqOf(i), requestId));
  let n = 0;
  for (let i = 0; i < stmts.length; i += 50)
    for (const r of await env.DB.batch(stmts.slice(i, i + 50))) n += r.meta.changes || 0;
  return n;
}
