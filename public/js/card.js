import { h } from './dom.js';
import { t, getLang } from './i18n.js';
import { alertEl } from './ui.js';
import { S, profile, translitMode, diacriticsOn } from './settings.js';
import { speak, canSpeak, onPlayingChange } from './tts.js';

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
// Speaker button: tap = play, tap again = stop. Hidden if the device has no voice for the language
// (and then a one-time hint explains how to install one). `before` runs before playback starts.
function voiceHint(p) {
  const key = 'ttsHint:' + p.code;
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch { return; }
  const box = alertEl(t('tts_no_voice', { lang: p.names[getLang()] }), h('button', { type: 'button', class: 'btn btn--secondary btn--sm', onclick: () => box.remove() }, t('close')), 'info');
  document.getElementById('view')?.prepend(box);
}
export function speakBtn(text, p, label, { cls = '', before } = {}) {
  const btn = h('button', { class: `btn btn--secondary btn--sm btn--icon hidden ${cls}`.trim(), type: 'button', 'aria-label': label || t('speak'),
    onclick: () => { before?.(); speak(text, p); } }, '🔊');
  const paint = (now) => { const on = now === text; btn.textContent = on ? '⏹' : '🔊';
    btn.setAttribute('aria-label', on ? t('stop') : label || t('speak')); btn.setAttribute('aria-pressed', String(on)); };
  let seen = false;
  const off = onPlayingChange((now) => { if (btn.isConnected) seen = true; else if (seen) return off(); paint(now); });
  canSpeak(p).then((ok) => { if (ok) btn.classList.remove('hidden'); else voiceHint(p); });
  return btn;
}
