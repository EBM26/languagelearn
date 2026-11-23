import { h } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, profile } from '../settings.js';
import { api } from '../api.js';
import { targetEl, plain } from '../card.js';
import { pageHead, alertEl } from '../ui.js';
import { storyMeta } from '../storyReader.js';

export async function render(root) {
  const p = profile();
  if (!p) { root.append(alertEl(t('nothing_to_study'), null, 'info')); return; }
  const { stories } = await api.get(`/api/stories?profile=${S.active}`);
  root.append(pageHead(t('stories_title')), h('div', { class: 'measure stack' },
    h('a', { class: 'btn', href: '#/story' }, t('story_today')),
    !stories.length ? h('p', { class: 'muted' }, t('no_stories')) : null,
    stories.map((s) => h('a', { class: 'card stack', href: `#/story/${s.id}`, style: 'text-decoration:none;color:inherit' },
      h('div', { class: 'cluster' }, targetEl(plain(s.title.target, p), p, 'lg'), h('span', { class: 'muted grow' }, s.title[getLang()] ?? s.title.en), h('span', { class: 'muted text-sm' }, s.day)),
      storyMeta(s)))));
}
