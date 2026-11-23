const SCRIPT_RE = { arabic: /[؀-ۿ]/, latin: /[A-Za-zÀ-ÿ]/ };
const HE_RE = /[א-ת]/;
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// Returns a clean item or null if the LLM output is unusable for this profile.
export function normalizeItem(p, raw) {
  if (!raw || typeof raw !== 'object') return null;
  const target = str(raw.target_text), en = str(raw.english), he = str(raw.hebrew);
  if (!target || !en || !he || !HE_RE.test(he)) return null;
  if (SCRIPT_RE[p.script] && !SCRIPT_RE[p.script].test(target)) return null;
  let lat = null, heb = null;
  if (p.transliteration?.enabled) {
    lat = str(raw.translit_latin); heb = str(raw.translit_hebrew);
    if (!lat || !heb || !HE_RE.test(heb)) return null;
  }
  const tags = raw.tags && typeof raw.tags === 'object' && !Array.isArray(raw.tags) ? raw.tags : {};
  const ex = raw.example && typeof raw.example === 'object' ? raw.example : {};
  return { target_text: target, type: raw.type === 'phrase' ? 'phrase' : 'word', translit_latin: lat, translit_hebrew: heb,
    english: en, hebrew: he, cognate_hint: str(raw.cognate_hint), tags,
    example_target: str(ex.target), example_en: str(ex.en), example_he: str(ex.he) };
}
export const normalizeItems = (p, list) => (Array.isArray(list) ? list : []).map((x) => normalizeItem(p, x)).filter(Boolean);

// ---- Phase 3 ----
// A grammar drill: english/hebrew hold the PROMPT (axes explicit), target_text holds the answer.
export function normalizeDrill(p, raw, topic, extraTags = {}) {
  const it = normalizeItem(p, raw);
  if (!it) return null;
  const axes = p.grammar_axes || {};
  const tags = {};
  for (const [k, v] of Object.entries(it.tags)) if (axes[k] && axes[k].includes(String(v))) tags[k] = String(v);
  if (!Object.keys(tags).length) return null;           // untagged drills can't feed weak-spot tracking
  return { ...it, type: 'grammar', cognate_hint: null, tags: { topic, ...tags, ...extraTags } };
}

const bi = (o) => o && str(o.en) && str(o.he) ? { en: str(o.en), he: str(o.he) } : null;
export function normalizeTable(p, raw) {
  const title = bi(raw?.title);
  if (!title || !Array.isArray(raw.columns) || !Array.isArray(raw.rows) || raw.rows.length < 2) return null;
  const columns = raw.columns.map(bi);
  if (columns.some((c) => !c)) return null;
  const tr = p.transliteration?.enabled;
  const rows = [];
  for (const r of raw.rows) {
    if (!Array.isArray(r) || r.length !== columns.length) return null;
    const cells = r.map((c) => {
      if (c && str(c.t)) {
        if (SCRIPT_RE[p.script] && !SCRIPT_RE[p.script].test(c.t)) return null;
        return tr ? { t: str(c.t), latin: str(c.latin), hebrew: str(c.hebrew) } : { t: str(c.t) };
      }
      return bi(c);
    });
    if (cells.some((c) => !c)) return null;
    rows.push(cells);
  }
  return { title, data: { columns, rows, notes: bi(raw.notes) } };
}

// ---- Phase 4: stories ----
const norm = (s) => String(s || '').normalize('NFC').replace(/[ً-ٰٟ]/g, '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
export { norm };

export function normalizeStory(p, raw) {
  const title = raw?.title && str(raw.title.target) && str(raw.title.en) && str(raw.title.he) && HE_RE.test(raw.title.he)
    ? { target: str(raw.title.target), en: str(raw.title.en), he: str(raw.title.he) } : null;
  if (!title || !Array.isArray(raw.sentences)) return null;
  const tr = p.transliteration?.enabled;
  const sentences = raw.sentences.map((s) => {
    const target = str(s?.target), en = str(s?.en), he = str(s?.he);
    if (!target || !en || !he || !HE_RE.test(he)) return null;
    if (SCRIPT_RE[p.script] && !SCRIPT_RE[p.script].test(target)) return null;
    return { speaker: str(s.speaker), target, latin: tr ? str(s.translit_latin) : null, hebrew: tr ? str(s.translit_hebrew) : null, en, he, tokens: null };
  }).filter(Boolean);
  return sentences.length >= 3 ? { title, sentences } : null;
}

// Attach validated word tokens to sentences. Throws if too few sentences got usable tokens (so the call retries).
export function applyGloss(p, raw, sentences) {
  const tr = p.transliteration?.enabled;
  let ok = 0;
  for (const e of Array.isArray(raw?.sentences) ? raw.sentences : []) {
    const s = sentences[e?.i];
    if (!s || !Array.isArray(e.tokens)) continue;
    const tokens = e.tokens.map((k) => {
      const t = str(k?.t), en = str(k?.en), he = str(k?.he);
      if (!t || !en || !he || !HE_RE.test(he)) return null;
      return { t, b: str(k.b) || t, latin: tr ? str(k.latin) : null, hebrew: tr ? str(k.hebrew) : null, en, he };
    });
    if (tokens.some((x) => !x)) continue;
    if (norm(tokens.map((x) => x.t).join('')) !== norm(s.target)) continue;     // tokens must reproduce the sentence
    s.tokens = tokens; ok++;
  }
  if (ok < Math.ceil(sentences.length * 0.7)) throw new Error('word glosses incomplete');
  return sentences;
}
