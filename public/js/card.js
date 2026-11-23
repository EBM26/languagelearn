import { h } from './dom.js';
import { S, profile, translitMode, diacriticsOn } from './settings.js';
import { speak } from './tts.js';

const MARKS = /[ً-ٰٟ]/g;
const KEEP_MARKS = new Set(['letter', 'syllable']);   // marks ARE the lesson on these

export function shown(card, p = profile()) {
  if (p.diacritics && !diacriticsOn() && !KEEP_MARKS.has(card.type)) return card.target_text.replace(MARKS, '');
  return card.target_text;
}
export function translitOf(card) {
  const m = translitMode();
  return m === 'latin' ? card.translit_latin : m === 'hebrew' ? card.translit_hebrew : null;
}
// Strip harakat for display when the user has diacritics turned off.
export const plain = (text, p = profile()) => (p.diacritics && !diacriticsOn() ? text.replace(MARKS, '') : text);
export const meaning = (c) => (S.settings.ui_lang === 'he' ? c.hebrew || c.english : c.english || c.hebrew);
export const exampleMeaning = (c) => (S.settings.ui_lang === 'he' ? c.example_he || c.example_en : c.example_en || c.example_he);

// A span that always uses the profile's own direction and font, regardless of interface language.
// size: 'md' (lists, tables) | 'lg' (answers) | 'xl' (hero). `true` is kept as an alias for 'xl'.
export function targetEl(text, p = profile(), size = 'md') {
  const s = size === true ? 'xl' : size || 'md';
  return h('span', { class: 'target' + (s === 'md' ? '' : ' target--' + s), dir: p.direction, lang: p.speech?.whisper_lang || '', text });
}
export function applyProfileStyle(p) {
  const r = document.documentElement.style;
  r.setProperty('--target-font', p.font.family);
  r.setProperty('--target-lg', p.font.size);                              // profile size = the 'lg' step
  r.setProperty('--target-md', `calc(${p.font.size} * 0.7)`); r.setProperty('--target-xl', `calc(${p.font.size} * 1.5)`);
  if (p.font.url && !document.querySelector(`link[href="${p.font.url}"]`))
    document.head.append(h('link', { rel: 'stylesheet', href: p.font.url }));
}
export const speakBtn = (text, p, label) => h('button', { class: 'btn btn--secondary btn--sm', type: 'button', 'aria-label': label,
  onclick: () => speak(text, p) }, '🔊');
