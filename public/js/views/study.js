import { h, clear } from '../dom.js';
import { t } from '../i18n.js';
import { S, profile } from '../settings.js';
import { api } from '../api.js';
import { shown, translitOf, meaning, exampleMeaning, targetEl, speakBtn } from '../card.js';

export async function render(root) {
  const p = profile();
  if (!p) { root.append(h('p', {}, t('nothing_to_study'))); return; }
  const code = S.active;
  const q = await api.get(`/api/queue?profile=${code}`);
  const items = [...q.due, ...q.new];
  const total = items.length;
  let done = 0, reviewed = 0;
  const bar = h('div', {});
  const stage = h('div', {});
  root.append(h('div', { class: 'progress' }, bar), stage);

  const finish = () => {
    bar.style.width = '100%';
    clear(stage).append(h('div', { class: 'card-box study-card' },
      h('h2', {}, t('session_done')),
      h('p', { class: 'muted' }, `${reviewed} ${t('reviewed')}. ${t('session_done_sub')}`),
      h('a', { class: 'btn', href: '#/home' }, t('home'))));
  };
  if (!total) {
    clear(stage).append(h('div', { class: 'card-box' }, h('p', {}, t('nothing_to_study')),
      S.profiles[code].script_module?.enabled && h('button', { class: 'btn', onclick: async (e) => {
        e.target.disabled = true;
        await api.post('/api/module', { profile: code, action: 'init' });
        root.replaceChildren(); await render(root);
      } }, t('init_deck'))));
    bar.style.width = '0';
    return;
  }

  function show() {
    if (!items.length) return finish();
    bar.style.width = `${Math.round((done / (done + items.length)) * 100)}%`;
    const c = items.shift();
    const dir = c.dir;
    const t0 = Date.now();
    const answer = h('div', { style: 'display:none' });
    const input = dir === 'produce' ? h('textarea', { rows: 2, dir: p.direction, placeholder: t('type_answer'), 'aria-label': t('typing_hint') }) : null;
    const grades = h('div', { class: 'grades', style: 'display:none' },
      [['1', 'again'], ['2', 'hard'], ['3', 'good'], ['4', 'easy']].map(([g, k]) => h('button', { class: 'g' + g, onclick: async () => {
        grades.querySelectorAll('button').forEach((b) => (b.disabled = true));
        await api.post('/api/review', { card_id: c.id, direction: dir, grade: +g, ms: Date.now() - t0 });
        reviewed++;
        if (+g === 1) items.push(c); else done++;      // Again: see it again this session
        show();
      } }, t(k))));
    const tr = translitOf(c), mean = meaning(c), ex = exampleMeaning(c);
    const targetBlock = h('div', {}, targetEl(shown(c, p), p, dir === 'recognize'), ' ', speakBtn(c.target_text, p, t('speak')));
    const front = dir === 'recognize'
      ? h('div', {}, h('p', { class: 'muted' }, t('prompt_recognize')), targetBlock)
      : h('div', {}, h('p', { class: 'muted' }, t('prompt_produce')), h('div', { style: 'font-size:1.5rem' }, mean), input);
    answer.append(
      dir === 'recognize' ? h('div', {}, tr && h('div', { style: 'font-size:1.3rem' }, tr), h('div', {}, mean))
        : h('div', {}, targetBlock, tr && h('div', { class: 'muted' }, tr)),
      c.cognate_hint && h('p', { class: 'muted' }, `${t('cognate')}: ${c.cognate_hint}`),
      c.example_target && h('div', { class: 'muted' }, targetEl(c.example_target, p), ex && h('div', {}, ex)));
    const reveal = h('button', { class: 'btn', onclick: () => {
      reveal.style.display = 'none'; answer.style.display = ''; grades.style.display = ''; } }, t('reveal'));
    const report = h('button', { class: 'btn secondary small', onclick: async (e) => {
      await api.post('/api/cards/report', { id: c.id, note: '' }); e.target.textContent = t('reported'); e.target.disabled = true;
      setTimeout(show, 600); } }, t('report'));
    clear(stage).append(h('div', { class: 'card-box study-card' }, front, reveal, answer), grades,
      h('div', { class: 'row', style: 'margin-top:.5rem' }, report));
  }
  show();
}
