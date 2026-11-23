import { h, clear } from './dom.js';
import { loadStrings, t, getLang } from './i18n.js';
import { S, boot, activeCodes, profile, setSetting, pickActive } from './settings.js';
import { applyProfileStyle } from './card.js';
import { stopSpeaking } from './tts.js';
import { icon, select, segmented, toggle, field, alertEl } from './ui.js';
import * as home from './views/home.js';
import * as study from './views/study.js';
import * as alphabet from './views/alphabet.js';
import * as languages from './views/languages.js';
import * as say from './views/say.js';
import * as deck from './views/deck.js';
import * as reference from './views/reference.js';
import * as stats from './views/stats.js';
import * as story from './views/story.js';
import * as stories from './views/stories.js';
import * as talk from './views/talk.js';
import * as pronunciation from './views/pronunciation.js';

const routes = { home, study, alphabet, languages, say, deck, reference, stats, story, stories, talk, pronunciation };
// [route, label key, routes that highlight it, visible?]
const NAV = [
  ['home', 'nav_today', ['home', 'study', 'alphabet', 'pronunciation', 'story', 'stories']],
  ['talk', 'talk_title', ['talk']],
  ['say', 'say', ['say']],
  ['deck', 'deck', ['deck']],
  ['reference', 'reference', ['reference'], () => profile()?.grammar_topics?.length],
  ['stats', 'stats', ['stats']],
];
let navOpen = false, settingsOpen = false;
const segments = () => (location.hash.replace(/^#\//, '') || 'home').split('?')[0].split('/');
const current = () => segments()[0];

function settingsPanel(p) {
  const set = (key) => async (v) => { await setSetting(key, v); refresh(); };
  return h('div', { class: 'popover', role: 'dialog', 'aria-label': t('settings') },
    field(t('interface_lang'), segmented({ label: t('interface_lang'), value: S.settings.ui_lang, onChange: set('ui_lang'),
      options: [{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }] })),
    p?.transliteration?.enabled && field(t('translit'), segmented({ label: t('translit'), value: S.settings.translit, onChange: set('translit'),
      options: ['auto', 'latin', 'hebrew', 'off'].map((v) => ({ value: v, label: t('translit_' + v) })) })),
    p?.diacritics && toggle({ checked: S.settings.diacritics !== 'off', label: t('diacritics'), onChange: (on) => set('diacritics')(on ? 'on' : 'off') }),
    toggle({ checked: S.settings.tts_slow === 'on', label: t('tts_slow'), onChange: (on) => set('tts_slow')(on ? 'on' : 'off') }),
    h('a', { class: 'popover__link', href: '#/languages' }, t('languages_menu')));
}

function renderHeader() {
  const el = clear(document.getElementById('header'));
  const p = profile(), cur = current(), act = activeCodes();
  const nav = h('nav', { class: 'nav' + (navOpen ? ' open' : ''), id: 'main-nav', 'aria-label': 'Main' },
    NAV.filter((n) => !n[3] || n[3]()).map(([route, key, owns]) =>
      h('a', { href: `#/${route}`, 'aria-current': owns.includes(cur) ? 'page' : null }, t(key))));
  const langPill = act.length && select({ variant: 'pill', label: t('active_lang'), value: S.active,
    options: act.map((c) => ({ value: c, label: S.profiles[c].names[getLang()] })),
    footer: [{ label: t('languages_menu'), onClick: () => { location.hash = '#/languages'; } }],
    onChange: async (c) => { await setSetting('active_profile', c); pickActive(); refresh(); } });
  const gear = h('div', { class: 'settings' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('settings'), 'aria-expanded': String(settingsOpen),
      onclick: () => { settingsOpen = !settingsOpen; navOpen = false; renderHeader(); } }, icon('sliders')),
    settingsOpen && settingsPanel(p));
  const burger = h('button', { type: 'button', class: 'icon-btn nav-toggle', 'aria-label': t('menu'), 'aria-expanded': String(navOpen), 'aria-controls': 'main-nav',
    onclick: () => { navOpen = !navOpen; settingsOpen = false; renderHeader(); } }, icon(navOpen ? 'close' : 'menu'));
  el.append(h('div', { class: 'container header__inner' },
    h('a', { class: 'brand', href: '#/home' }, t('app')), nav,
    h('div', { class: 'header__actions' }, langPill, gear, burger)));
}

async function route() {
  stopSpeaking();                      // never keep talking after navigating away
  const view = routes[current()] || home, args = segments().slice(1);
  const root = clear(document.getElementById('view'));
  if (profile()) applyProfileStyle(profile());
  root.append(h('p', { class: 'muted' }, t('loading')));
  try { clear(root); await view.render(root, args); }
  catch (e) { clear(root).append(alertEl(`${t('error')}: ${e.message}`, h('button', { class: 'btn btn--secondary btn--sm', onclick: route }, t('retry')))); }
}
export function refresh() { renderHeader(); route(); }

// Close popovers on outside click / Escape.
document.addEventListener('click', (e) => {
  let changed = false;
  if (settingsOpen && !e.target.closest('.settings')) { settingsOpen = false; changed = true; }
  if (navOpen && !e.target.closest('.nav, .nav-toggle')) { navOpen = false; changed = true; }
  if (changed) renderHeader();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (settingsOpen || navOpen)) { settingsOpen = navOpen = false; renderHeader(); } });
window.addEventListener('hashchange', () => { navOpen = settingsOpen = false; renderHeader(); route(); });

(async () => {
  await loadStrings();
  try { await boot(); }
  catch (e) { document.getElementById('view').append(alertEl(`${t('error')}: ${e.message}`)); return; }
  document.title = t('app');
  refresh();
})();
