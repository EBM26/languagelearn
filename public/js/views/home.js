import { h } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, activeCodes } from '../settings.js';
import { api } from '../api.js';

export async function render(root) {
  root.append(h('h1', {}, t('home')));
  const codes = activeCodes();
  const data = await Promise.all(codes.map(async (c) => ({ c, q: await api.get(`/api/queue?profile=${c}`),
    m: S.profiles[c].script_module?.enabled ? await api.get(`/api/module?profile=${c}`) : null })));
  for (const { c, q, m } of data) {
    const p = S.profiles[c];
    const hasCards = m ? m.counts.length > 0 : true;
    root.append(h('div', { class: 'card-box' },
      h('h2', {}, p.names[getLang()]),
      h('p', { class: 'muted' }, `${t('due')}: ${q.due.length} · ${t('new')}: ${q.new.length} (${q.new_today}/${q.new_per_day} ${t('done_today')})`),
      h('div', { class: 'row' },
        h('a', { class: 'btn', href: '#/study', onclick: () => { S.settings.active_profile = c; S.active = c; } }, t('start')),
        m && h('a', { class: 'btn secondary', href: '#/alphabet' }, t('alphabet')),
        m && h('span', { class: 'badge' + (m.completed_at ? ' on' : '') }, m.completed_at ? t('module_done') : t('module_todo')))));
  }
  if (!codes.length) root.append(h('p', {}, t('nothing_to_study')));
  root.append(h('p', {}, h('a', { href: '#/languages' }, t('manage'))));
}
