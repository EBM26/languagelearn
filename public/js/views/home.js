import { h } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, activeCodes } from '../settings.js';
import { api } from '../api.js';
import { pageHead, badge } from '../ui.js';

const stat = (n, label) => h('div', { class: 'stat' }, h('div', { class: 'stat__n' }, n), h('div', { class: 'stat__l' }, label));

export async function render(root) {
  root.append(pageHead(t('nav_today')));
  const codes = activeCodes();
  if (!codes.length) { root.append(h('div', { class: 'card stack' }, h('p', {}, t('nothing_to_study')), h('a', { class: 'btn', href: '#/languages' }, t('manage')))); return; }
  const data = await Promise.all(codes.map(async (c) => ({ c, q: await api.get(`/api/queue?profile=${c}`),
    m: S.profiles[c].script_module?.enabled ? await api.get(`/api/module?profile=${c}`) : null })));
  const grid = h('div', { class: 'grid-cards' });
  for (const { c, q, m } of data) {
    const p = S.profiles[c];
    grid.append(h('section', { class: 'card stack' },
      h('div', { class: 'cluster' }, h('h2', { class: 'grow' }, p.names[getLang()]),
        m && badge(m.completed_at ? t('module_done') : t('module_todo'), m.completed_at ? 'success' : 'info')),
      h('div', { class: 'stats' }, stat(q.due.length, t('due')), stat(q.new.length, t('new')), stat(`${q.new_today}/${q.new_per_day}`, t('done_today'))),
      h('div', { class: 'cluster' },
        h('a', { class: 'btn', href: '#/study', onclick: () => { S.settings.active_profile = c; S.active = c; } }, t('start')),
        h('a', { class: 'btn btn--secondary', href: '#/story', onclick: () => { S.settings.active_profile = c; S.active = c; } }, t('story_today')),
        h('a', { class: 'btn btn--ghost', href: '#/stories', onclick: () => { S.settings.active_profile = c; S.active = c; } }, t('past_stories')),
        m && h('a', { class: 'btn btn--secondary', href: '#/alphabet', onclick: () => { S.settings.active_profile = c; S.active = c; } }, t('alphabet')))));
  }
  root.append(grid);
}
