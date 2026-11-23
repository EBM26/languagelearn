import { h } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, setProfileActive } from '../settings.js';
import { api } from '../api.js';
import { runSeed } from '../seed.js';
import { refresh } from '../app.js';
import { pageHead, field, badge, alertEl } from '../ui.js';

export async function render(root) {
  root.append(pageHead(t('manage')));
  const grid = h('div', { class: 'grid-cards' });
  root.append(grid);
  for (const c of S.codes) {
    const p = S.profiles[c], st = S.states[c], on = !!st?.active;
    const num = h('input', { class: 'input input--num', type: 'number', min: 0, max: 50, 'aria-label': t('new_per_day'), value: st?.new_per_day ?? p.new_per_day_default ?? 7 });
    const seedBox = h('div', { class: 'stack' });
    grid.append(h('section', { class: 'card stack' },
      h('div', { class: 'cluster' }, h('h2', { class: 'grow' }, p.names[getLang()]), badge(on ? t('active') : t('inactive'), on ? 'success' : 'neutral')),
      h('div', { class: 'cluster' }, field(t('new_per_day'), num),
        h('button', { class: 'btn btn--sm' + (on ? ' btn--secondary' : ''), style: 'align-self:flex-end', onclick: async () => {
          await setProfileActive(c, !on, parseInt(num.value, 10));
          if (!on && p.seed?.enabled) sessionStorage.setItem('autoseed', c);   // activation triggers seeding
          refresh(); } }, on ? t('deactivate') : t('activate'))),
      on && seedBox));
    if (on) seedUi(seedBox, c, p);
  }
}

async function seedUi(box, code, p) {
  if (!p.seed?.enabled) { box.append(h('p', { class: 'muted text-sm' }, t('seed_off'))); return; }
  const s = await api.get(`/api/seed/status?profile=${code}`);
  const fill = h('div', {}), label = h('p', { class: 'muted text-sm' }), errBox = h('div', {});
  const set = (n, total, text) => { label.textContent = text(n, total); fill.style.width = `${Math.min(100, (n / total) * 100)}%`; };
  const idle = (n, total) => (n >= total ? t('seed_done') : t('seed_status', { n, total }));
  set(s.generated, s.target, idle);
  const btn = h('button', { class: 'btn btn--sm' }, s.generated ? t('continue_seed') : t('generate_seed'));
  const go = async () => {
    btn.disabled = true; clear(errBox);
    try {
      await runSeed(code, (r) => set(r.generated, r.target, (n, total) => t('seed_running', { n, total })));
      label.textContent = t('seed_done');
    } catch (e) { errBox.replaceChildren(alertEl(e.message === 'stalled' ? t('seed_stalled') : `${t('error')}: ${e.message}`)); btn.disabled = false; }
  };
  const clear = (el) => el.replaceChildren();
  btn.onclick = go;
  box.append(label, h('div', { class: 'meter' }, fill), errBox,
    h('div', { class: 'cluster' }, s.generated >= s.target ? null : btn, h('a', { href: '#/deck', class: 'btn btn--secondary btn--sm' }, t('deck'))));
  if (sessionStorage.getItem('autoseed') === code && s.generated < s.target) { sessionStorage.removeItem('autoseed'); go(); }
}
