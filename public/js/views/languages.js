import { h } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, setProfileActive } from '../settings.js';
import { refresh } from '../app.js';

export async function render(root) {
  root.append(h('h1', {}, t('manage')));
  for (const c of S.codes) {
    const p = S.profiles[c], st = S.states[c], on = !!st?.active;
    const num = h('input', { type: 'number', min: 0, max: 50, value: st?.new_per_day ?? p.new_per_day_default ?? 7 });
    root.append(h('div', { class: 'card-box' },
      h('div', { class: 'row' }, h('h2', { style: 'margin:0;flex:1' }, p.names[getLang()]),
        h('span', { class: 'badge' + (on ? ' on' : '') }, on ? t('active') : t('inactive'))),
      h('div', { class: 'row', style: 'margin-top:.6rem' },
        h('label', {}, t('new_per_day') + ' ', num),
        h('button', { class: 'btn small' + (on ? ' secondary' : ''), onclick: async () => {
          await setProfileActive(c, !on, parseInt(num.value, 10)); refresh(); } }, on ? t('deactivate') : t('activate'))),
      !on && !p.script_module?.enabled && h('p', { class: 'muted' }, t('phase2_note'))));
  }
}
