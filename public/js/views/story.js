import { h, clear } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, profile } from '../settings.js';
import { api } from '../api.js';
import { targetEl, plain } from '../card.js';
import { pageHead, alertEl } from '../ui.js';
import { storyReader, storyMeta } from '../storyReader.js';

// #/story        -> today's story (generated on first open)
// #/story/<id>   -> a past story
export async function render(root, args = []) {
  const p = profile();
  if (!p) { root.append(alertEl(t('nothing_to_study'), null, 'info')); return; }
  if (!args[0]) root.append(h('p', { class: 'muted' }, t('story_generating')));
  const story = args[0] ? await api.get(`/api/stories/${args[0]}`) : await api.post('/api/story/today', { profile: S.active });
  clear(root);
  const body = h('div', { class: 'stack-lg' }), err = h('div', {});
  const draw = (st) => {
    clear(body);
    const reader = storyReader(st, p);
    const regen = h('button', { class: 'btn btn--secondary btn--sm', onclick: async () => {
      const note = prompt(t('regenerate_story_prompt')); if (note === null) return;
      regen.disabled = true; err.replaceChildren(h('p', { class: 'muted text-sm' }, t('story_generating')));
      try { reader.dispose(); draw(await api.post(`/api/stories/${st.id}/regenerate`, { note })); err.replaceChildren(); }
      catch (e) { err.replaceChildren(alertEl(e.message)); regen.disabled = false; } } }, t('regenerate_story'));
    const done = h('button', { class: 'btn', disabled: !!st.read_at, onclick: async () => { await api.post(`/api/stories/${st.id}/read`); done.disabled = true; } }, t('finished'));
    body.append(
      h('div', { class: 'stack' }, h('div', { class: 'cluster' }, targetEl(plain(st.title.target, p), p, 'lg'), h('span', { class: 'muted' }, st.title[getLang()] ?? st.title.en)),
        storyMeta(st), st.grammar_focus && h('p', { class: 'muted text-sm' }, `${t('grammar_focus_label')}: ${st.grammar_focus.topic}${st.grammar_focus.focus ? ` — ${st.grammar_focus.focus}` : ''}`)),
      err, reader, h('div', { class: 'cluster' }, done, regen));
  };
  root.append(pageHead(t('stories_title')), h('div', { class: 'measure' }, body));
  draw(story);
}
