import { h, clear } from '../dom.js';
import { t } from '../i18n.js';
import { S, profile } from '../settings.js';
import { api } from '../api.js';
import { shown, translitOf, meaning, exampleMeaning, targetEl, speakBtn } from '../card.js';

const PAUSE_NEW_ABOVE = 100;   // too many reviews due -> hold back new items

export async function render(root) {
  const p = profile();
  if (!p) { root.append(h('p', {}, t('nothing_to_study'))); return; }
  const code = S.active;
  let q = await api.get(`/api/queue?profile=${code}`);
  const stage = h('div', {});
  root.append(stage);
  await startScreen();

  async function startScreen() {
    const paused = q.due.length > PAUSE_NEW_ABOVE;
    const newList = paused ? [] : q.new;
    const total = q.due.length + newList.length;
    const num = h('input', { type: 'number', min: 0, max: 50, value: q.new_per_day });
    clear(stage).append(h('h1', {}, t('study')),
      h('div', { class: 'card-box' },
        h('p', {}, `${t('due_label')}: ${q.due.length} · ${t('new_label')}: ${newList.length}`),
        paused && h('p', { class: 'muted' }, t('reviews_paused_new')),
        h('div', { class: 'row' }, h('label', {}, t('new_per_day') + ' ', num),
          h('button', { class: 'btn secondary small', onclick: async () => {
            await api.post(`/api/profile/${code}`, { active: true, new_per_day: parseInt(num.value, 10) });
            q = await api.get(`/api/queue?profile=${code}`); startScreen(); } }, t('save_count'))),
        total ? h('button', { class: 'btn', style: 'margin-top:1rem', onclick: () => session(q.due, newList) }, t('session_start'))
          : h('p', {}, t('nothing_to_study')),
        !total && S.profiles[code].script_module?.enabled && h('button', { class: 'btn', onclick: async (e) => {
          e.target.disabled = true; await api.post('/api/module', { profile: code, action: 'init' });
          q = await api.get(`/api/queue?profile=${code}`); startScreen(); } }, t('init_deck'))));
  }

  async function session(due, fresh) {
    const total = due.length + fresh.length * 2;
    let done = 0, reviewed = 0;
    const bar = h('div', {}), title = h('h2', {}), body = h('div', {}), skip = h('button', { class: 'btn secondary small' }, t('skip_step'));
    clear(stage).append(h('div', { class: 'progress' }, bar), title, body, h('div', { class: 'row', style: 'margin-top:.5rem' }, skip));
    const progress = () => { bar.style.width = `${total ? Math.round((done / total) * 100) : 100}%`; };

    // Each step returns a promise that resolves when the step ends (finished or skipped).
    const step = (label, list, mode) => new Promise((resolve) => {
      if (!list.length) return resolve();
      title.textContent = label;
      const items = [...list];
      skip.onclick = () => { done += items.length; progress(); resolve(); };
      const next = () => { progress(); if (!items.length) return resolve(); (mode === 'intro' ? intro : card)(items.shift()); };

      function intro(c) {
        const tr = translitOf(c), ex = exampleMeaning(c);
        clear(body).append(h('div', { class: 'card-box study-card' },
          h('div', {}, targetEl(shown(c, p), p, true), ' ', speakBtn(c.target_text, p, t('speak'))),
          tr && h('div', { style: 'font-size:1.2rem' }, tr), h('div', { style: 'font-size:1.3rem' }, meaning(c)),
          c.cognate_hint && h('p', { class: 'muted' }, `${t('cognate')}: ${c.cognate_hint}`),
          c.example_target && h('div', { class: 'muted' }, targetEl(c.example_target, p), ex && h('div', {}, ex)),
          h('button', { class: 'btn', onclick: () => { done++; next(); } }, t('intro_next'))));
      }

      function card(c) {
        const dir = c.dir, t0 = Date.now();
        const tr = translitOf(c), mean = meaning(c), ex = exampleMeaning(c);
        const input = dir === 'produce' ? h('textarea', { rows: 2, dir: p.direction, placeholder: t('type_answer'), 'aria-label': t('typing_hint') }) : null;
        const targetBlock = h('div', {}, targetEl(shown(c, p), p, dir === 'recognize'), ' ', speakBtn(c.target_text, p, t('speak')));
        const front = dir === 'recognize'
          ? h('div', {}, h('p', { class: 'muted' }, t('prompt_recognize')), targetBlock)
          : h('div', {}, h('p', { class: 'muted' }, t('prompt_produce')), h('div', { style: 'font-size:1.5rem' }, mean), input);
        const answer = h('div', { style: 'display:none' },
          dir === 'recognize' ? h('div', {}, tr && h('div', { style: 'font-size:1.3rem' }, tr), h('div', {}, mean))
            : h('div', {}, targetBlock, tr && h('div', { class: 'muted' }, tr)),
          c.cognate_hint && h('p', { class: 'muted' }, `${t('cognate')}: ${c.cognate_hint}`),
          c.example_target && h('div', { class: 'muted' }, targetEl(c.example_target, p), ex && h('div', {}, ex)));
        const grades = h('div', { class: 'grades', style: 'display:none' },
          [['1', 'again'], ['2', 'hard'], ['3', 'good'], ['4', 'easy']].map(([g, k]) => h('button', { class: 'g' + g, onclick: async () => {
            grades.querySelectorAll('button').forEach((b) => (b.disabled = true));
            await api.post('/api/review', { card_id: c.id, direction: dir, grade: +g, ms: Date.now() - t0 });
            reviewed++;
            if (+g === 1) items.push(c); else done++;      // Again: see it again within this step
            next();
          } }, t(k))));
        const reveal = h('button', { class: 'btn', onclick: () => { reveal.style.display = 'none'; answer.style.display = ''; grades.style.display = ''; } }, t('reveal'));
        const report = h('button', { class: 'btn secondary small', onclick: async (e) => {
          await api.post('/api/cards/report', { id: c.id, note: '' }); e.target.textContent = t('reported'); e.target.disabled = true;
          done++; setTimeout(next, 600); } }, t('report'));
        clear(body).append(h('div', { class: 'card-box study-card' }, front, reveal, answer), grades, h('div', { class: 'row', style: 'margin-top:.5rem' }, report));
      }
      next();
    });

    await step(t('review_title'), due, 'card');
    await step(t('intro_title'), fresh, 'intro');
    await step(t('quiz_title'), fresh, 'card');
    bar.style.width = '100%';
    clear(stage).append(h('div', { class: 'card-box study-card' }, h('h2', {}, t('session_done')),
      h('p', { class: 'muted' }, `${reviewed} ${t('reviewed')}. ${t('session_done_sub')}`),
      h('a', { class: 'btn', href: '#/home' }, t('home'))));
  }
}
