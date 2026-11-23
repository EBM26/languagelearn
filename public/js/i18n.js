let strings = {}, lang = 'he';
export async function loadStrings() {
  const [en, he] = await Promise.all(['en', 'he'].map((l) => fetch(`/strings/${l}.json`).then((r) => r.json())));
  strings = { en, he };
}
export function setLang(l) {
  lang = l;
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'he' ? 'rtl' : 'ltr';   // Hebrew mode is RTL for the whole page
}
export const getLang = () => lang;
export function t(key, vars = {}) {
  const s = strings[lang]?.[key] ?? strings.en?.[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
