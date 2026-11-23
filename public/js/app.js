import { h, clear } from './dom.js';
import { loadStrings, t, getLang } from './i18n.js';
import { S, boot, activeCodes, profile, setSetting, pickActive } from './settings.js';
import { applyProfileStyle } from './card.js';
import * as home from './views/home.js';
import * as study from './views/study.js';
import * as alphabet from './views/alphabet.js';
import * as languages from './views/languages.js';

const routes = { home, study, alphabet, languages };

function renderHeader() {
  const el = clear(document.getElementById('header'));
  const p = profile();
  el.append(h('a', { class: 'brand', href: '#/home' }, t('app')));
  const act = activeCodes();
  if (act.length) el.append(h('label', {}, t('active_lang'),
    h('select', { onchange: async (e) => { await setSetting('active_profile', e.target.value); pickActive(); refresh(); } },
      act.map((c) => h('option', { value: c, selected: c === S.active }, S.profiles[c].names[getLang()])))));
  el.append(h('label', {}, t('interface_lang'),
    h('select', { onchange: async (e) => { await setSetting('ui_lang', e.target.value); refresh(); } },
      [['he', 'עברית'], ['en', 'English']].map(([v, n]) => h('option', { value: v, selected: v === S.settings.ui_lang }, n)))));
  if (p?.transliteration?.enabled) el.append(h('label', {}, t('translit'),
    h('select', { onchange: async (e) => { await setSetting('translit', e.target.value); refresh(); } },
      ['auto', 'latin', 'hebrew', 'off'].map((v) => h('option', { value: v, selected: v === S.settings.translit }, t('translit_' + v))))));
  if (p?.diacritics) el.append(h('label', {}, h('input', { type: 'checkbox', checked: S.settings.diacritics !== 'off',
    onchange: async (e) => { await setSetting('diacritics', e.target.checked ? 'on' : 'off'); refresh(); } }), t('diacritics')));
}

async function route() {
  const name = (location.hash.replace(/^#\//, '') || 'home').split('?')[0];
  const view = routes[name] || home;
  const root = clear(document.getElementById('view'));
  if (profile()) applyProfileStyle(profile());
  root.append(h('p', { class: 'muted' }, t('loading')));
  try { clear(root); await view.render(root); }
  catch (e) { clear(root).append(h('p', { class: 'err' }, `${t('error')}: ${e.message}`),
    h('button', { class: 'btn secondary', onclick: route }, t('retry'))); }
}
export function refresh() { renderHeader(); route(); }

window.addEventListener('hashchange', route);
(async () => {
  await loadStrings();
  try { await boot(); } catch (e) { document.getElementById('view').textContent = `${t('error')}: ${e.message}`; return; }
  document.title = t('app');
  refresh();
})();
