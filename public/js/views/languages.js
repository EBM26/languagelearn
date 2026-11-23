import { h, clear } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, setProfileActive } from '../settings.js';
import { api } from '../api.js';
import { runSeed } from '../seed.js';
import { refresh } from '../app.js';

export async function render(root) {
  root.append(h('h1', {}, t('manage')));
  for (const c of S.codes) {
    const p = S.profiles[c], st = S.states[c], on = !!st?.active;
    const num = h('input', { type: 'number', min: 0, max: 50, value: st?.new_per_day ?? p.new_per_day_default ?? 7 });
    const seedBox = h('div', {});
    root.append(h('div', { class: 'card-box' },
      h('div', { class: 'row' }, h('h2', { style: 'margin:0;flex:1' }, p.names[getLang()]),
        h('span', { class: 'badge' + (on ? ' on' : '') }, on ? t('active') : t('inactive'))),
      h('div', { class: 'row', style: 'margin-top:.6rem' },
        h('label', {}, t('new_per_day') + ' ', num),
        h('button', { class: 'btn small' + (on ? ' secondary' : ''), onclick: async () => {
          await setProfileActive(c, !on, parseInt(num.value, 10));
          if (!on && p.seed?.enabled) sessionStorage.setItem('autoseed', c);   // activation triggers seeding
          refresh(); } }, on ? t('deactivate') : t('activate'))),
      on && seedBox));
    if (on) seedUi(seedBox, c, p);
  }
}

async function seedUi(box, code, p) {
  if (!p.seed?.enabled) { box.append(h('p', { class: 'muted' }, t('seed_off'))); return; }
  const s = await api.get(`/api/seed/status?profile=${code}`);
  const bar = h('div', { style: 'height:6px;background:var(--line);border-radius:3px;overflow:hidden;margin:.5rem 0' }, h('div', { style: 'height:100%;background:var(--accent);width:0' }));
  const label = h('p', { class: 'muted' }), err = h('p', { class: 'err' });
  const set = (n, total) => { label.textContent = t('seed_status', { n, total }); bar.firstChild.style.width = `${Math.min(100, (n / total) * 100)}%`; };
  set(s.generated, s.target);
  const btn = h('button', { class: 'btn small' }, s.generated ? t('continue_seed') : t('generate_seed'));
  const go = async () => {
    btn.disabled = true; err.textContent = '';
    try {
      await runSeed(code, (r) => { label.textContent = t('seed_running', { n: r.generated, total: r.target });
        bar.firstChild.style.width = `${Math.min(100, (r.generated / r.target) * 100)}%`; });
      label.textContent = t('seed_done');
    } catch (e) { err.textContent = e.message === 'stalled' ? t('seed_stalled') : `${t('error')}: ${e.message}`; btn.disabled = false; }
  };
  btn.onclick = go;
  box.append(label, bar, s.generated >= s.target ? '' : btn, err,
    h('a', { href: '#/deck', class: 'btn secondary small', style: 'margin-inline-start:.5rem' }, t('deck')));
  if (sessionStorage.getItem('autoseed') === code && s.generated < s.target) { sessionStorage.removeItem('autoseed'); go(); }
}
