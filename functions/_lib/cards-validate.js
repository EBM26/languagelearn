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
