import { h } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, activeCodes } from '../settings.js';
import { api } from '../api.js';
import { pageHead, badge } from '../ui.js';
import { humanNudge } from '../nudge.js';

const stat = (n, label) => h('div', { class: 'stat' }, h('div', { class: 'stat__n' }, n), h('div', { class: 'stat__l' }, label));
// Daily session steps, in order; grammar only exists for profiles with grammar topics.
const stepsFor = (p) => ['reviews', 'new', p.grammar_topics?.length ? 'grammar' : null, 'story', 'speaking'].filter(Boolean);
const STEP_LINK = { reviews: '#/study', new: '#/study', grammar: '#/study', story: '#/story', speaking: '#/talk' };

export async function render(root) {
  root.append(pageHead(t('nav_today')));
  const codes = activeCodes();
  if (!codes.length) { root.append(h('div', { class: 'card stack' }, h('p', {}, t('nothing_to_study')), h('a', { class: 'btn', href: '#/languages' }, t('manage')))); return; }
  const data = await Promise.all(codes.map(async (c) => {
    const p = S.profiles[c];
    const mod = p.script_module?.enabled ? 'script' : p.pronunciation_module?.enabled ? 'pronunciation' : null;
    const [q, st, m] = await Promise.all([api.get(`/api/queue?profile=${c}`), api.get(`/api/stats?profile=${c}`),
      mod ? api.get(`/api/module?profile=${c}&module=${mod}`) : null]);
    return { c, q, st, m, mod };
  }));
  const grid = h('div', { class: 'grid-cards' });
  for (const { c, q, st, m, mod } of data) {
    const p = S.profiles[c], pick = () => { S.settings.active_profile = c; S.active = c; };
    const done = new Set(st.today.steps_done), steps = stepsFor(p);
    const left = steps.filter((s) => !done.has(s)).length;
    grid.append(h('section', { class: 'card stack' },
      h('div', { class: 'cluster' }, h('h2', { class: 'grow' }, p.names[getLang()]),
        st.streak.current > 0 && badge(`🔥 ${st.streak.current}`, 'warning'),
        m && badge(m.completed_at ? t('module_done') : t('module_todo'), m.completed_at ? 'success' : 'info')),
      h('div', { class: 'stats' }, stat(q.due.length, t('due')), stat(q.new.length, t('new')), stat(`${q.new_today}/${q.new_per_day}`, t('done_today'))),
      h('div', { class: 'stack' }, h('div', { class: 'muted text-sm' }, left ? t('session_left', { n: left }) : t('session_all_done')),
        h('div', { class: 'cluster cluster--tight' }, steps.map((s) => h('a', { href: STEP_LINK[s], class: 'chip' + (done.has(s) ? ' chip--done' : ''), onclick: pick },
          (done.has(s) ? '✓ ' : '') + t('step_' + s))))),
      h('div', { class: 'cluster' },
        h('a', { class: 'btn', href: '#/study', onclick: pick }, t('start')),
        h('a', { class: 'btn btn--secondary', href: '#/talk', onclick: pick }, t('talk_title')),
        h('a', { class: 'btn btn--secondary', href: '#/story', onclick: pick }, t('story_today')),
        h('a', { class: 'btn btn--ghost', href: '#/stories', onclick: pick }, t('past_stories')),
        mod === 'script' && h('a', { class: 'btn btn--secondary', href: '#/alphabet', onclick: pick }, t('alphabet')),
        mod === 'pronunciation' && h('a', { class: 'btn btn--secondary', href: '#/pronunciation', onclick: pick }, t('pron_title'))),
      humanNudge(c, st.human)));
  }
  root.append(grid);
}
