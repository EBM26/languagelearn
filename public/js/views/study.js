import { h, clear } from '../dom.js';
import { t } from '../i18n.js';
import { S, profile } from '../settings.js';
import { api } from '../api.js';
import { shown, translitOf, meaning, exampleMeaning, targetEl, speakBtn } from '../card.js';
import { pageHead, field, badge, alertEl } from '../ui.js';
import { storyReader, storyMeta } from '../storyReader.js';

const PAUSE_NEW_ABOVE = 100;   // too many reviews due -> hold back new items

export async function render(root) {
  const p = profile();
  if (!p) { root.append(alertEl(t('nothing_to_study'), null, 'info')); return; }
  const code = S.active;
  let q = await api.get(`/api/queue?profile=${code}`);
  const stage = h('div', { class: 'measure' });
  root.append(stage);
  await startScreen();

  async function startScreen() {
    const paused = q.due.length > PAUSE_NEW_ABOVE;
    const newList = paused ? [] : q.new;
    const total = q.due.length + newList.length;
    const num = h('input', { class: 'input input--num', type: 'number', min: 0, max: 50, value: q.new_per_day, 'aria-label': t('new_per_day') });
    const initable = !total && S.profiles[code].script_module?.enabled;
    clear(stage).append(pageHead(t('study')), h('div', { class: 'card stack' },
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('div', { class: 'stat__n' }, q.due.length), h('div', { class: 'stat__l' }, t('due_label'))),
        h('div', { class: 'stat' }, h('div', { class: 'stat__n' }, newList.length), h('div', { class: 'stat__l' }, t('new_label')))),
      paused && alertEl(t('reviews_paused_new'), null, 'info'),
      h('div', { class: 'cluster' }, field(t('new_per_day'), num),
        h('button', { class: 'btn btn--secondary btn--sm', style: 'align-self:flex-end', onclick: async () => {
          await api.post(`/api/profile/${code}`, { active: true, new_per_day: parseInt(num.value, 10) });
          q = await api.get(`/api/queue?profile=${code}`); startScreen(); } }, t('save_count'))),
      total ? h('div', {}, h('button', { class: 'btn', onclick: () => session(q.due, newList) }, t('session_start')))
        : h('p', { class: 'muted' }, t('nothing_to_study')),
      initable && h('div', {}, h('button', { class: 'btn', onclick: async (e) => {
        e.target.disabled = true; await api.post('/api/module', { profile: code, action: 'init' });
        q = await api.get(`/api/queue?profile=${code}`); startScreen(); } }, t('init_deck')))));
  }

  async function session(due, fresh) {
    let total = due.length + fresh.length * 2 + 1, done = 0, reviewed = 0;
    // Start writing today's story now so it's ready when we get to that step (errors surface at the step).
    const storyReq = api.post('/api/story/today', { profile: code }).then((v) => ({ v }), (e) => ({ e }));
    const bar = h('div', {}), title = h('h2', {}), body = h('div', {});
    const skip = h('button', { class: 'btn btn--ghost btn--sm' }, t('skip_step'));
    const stepHead = h('div', { class: 'step-title' }, title, h('span', { class: 'grow' }), skip);
    clear(stage).append(h('div', { class: 'progress', style: 'margin-block-end:var(--space-5)' }, bar), stepHead, body);
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
        clear(body).append(h('div', { class: 'card study-card' },
          h('div', { class: 'cluster' }, targetEl(shown(c, p), p, 'xl'), speakBtn(c.target_text, p, t('speak'))),
          tr && h('div', { class: 'text-lg' }, tr), h('div', { class: 'prompt-main' }, meaning(c)),
          c.cognate_hint && h('p', { class: 'muted' }, `${t('cognate')}: ${c.cognate_hint}`),
          c.example_target && h('div', { class: 'muted' }, targetEl(c.example_target, p), ex && h('div', { class: 'text-sm' }, ex)),
          h('button', { class: 'btn', onclick: () => { done++; next(); } }, t('intro_next'))));
      }

      function card(c) {
        const dir = c.dir, t0 = Date.now();
        const tr = translitOf(c), mean = meaning(c), ex = exampleMeaning(c);
        const input = dir === 'produce' ? h('textarea', { class: 'textarea', rows: 2, dir: p.direction, placeholder: t('type_answer'), 'aria-label': t('typing_hint') }) : null;
        const targetBlock = h('div', { class: 'cluster', style: 'justify-content:center' }, targetEl(shown(c, p), p, dir === 'recognize' ? 'xl' : 'lg'), speakBtn(c.target_text, p, t('speak')));
        const front = dir === 'recognize'
          ? h('div', { class: 'stack' }, h('p', { class: 'prompt-label' }, t('prompt_recognize')), targetBlock)
          : h('div', { class: 'stack' }, h('p', { class: 'prompt-label' }, t('prompt_produce')), h('div', { class: 'prompt-main' }, mean), input);
        const answer = h('div', { class: 'stack hidden' },
          dir === 'recognize' ? h('div', { class: 'stack' }, tr && h('div', { class: 'text-lg' }, tr), h('div', { class: 'prompt-main' }, mean))
            : h('div', { class: 'stack' }, targetBlock, tr && h('div', { class: 'muted' }, tr)),
          c.cognate_hint && h('p', { class: 'muted text-sm' }, `${t('cognate')}: ${c.cognate_hint}`),
          c.example_target && h('div', { class: 'muted' }, targetEl(c.example_target, p), ex && h('div', { class: 'text-sm' }, ex)));
        const grades = h('div', { class: 'grades hidden' },
          [['1', 'again'], ['2', 'hard'], ['3', 'good'], ['4', 'easy']].map(([g, k]) => h('button', { class: 'g' + g, onclick: async () => {
            grades.querySelectorAll('button').forEach((b) => (b.disabled = true));
            await api.post('/api/review', { card_id: c.id, direction: dir, grade: +g, ms: Date.now() - t0 });
            reviewed++;
            if (+g === 1) items.push(c); else done++;      // Again: see it again within this step
            next();
          } }, t(k))));
        const reveal = h('button', { class: 'btn', onclick: () => { reveal.classList.add('hidden'); answer.classList.remove('hidden'); grades.classList.remove('hidden'); } }, t('reveal'));
        const report = h('button', { class: 'btn btn--ghost btn--sm', onclick: async (e) => {
          await api.post('/api/cards/report', { id: c.id, note: '' }); e.target.textContent = t('reported'); e.target.disabled = true;
          done++; setTimeout(next, 600); } }, t('report'));
        clear(body).append(h('div', { class: 'card study-card' }, front, reveal, answer), grades, h('div', { class: 'mt-2' }, report));
      }
      next();
    });

    const mark = (name) => api.post('/api/session-step', { profile: code, step: name }).catch(() => {});
    await step(t('review_title'), due, 'card'); if (due.length) mark('reviews');
    await step(t('intro_title'), fresh, 'intro');
    await step(t('quiz_title'), fresh, 'card'); if (fresh.length) mark('new');
    if (p.grammar_topics?.length) {                         // grammar drill on the weakest tag
      title.textContent = t('grammar_step'); clear(body).append(h('p', { class: 'muted' }, t('generating')));
      try {
        const g = await api.post('/api/grammar/drills', { profile: code });
        total += g.cards.length;
        const label = g.focus ? ` — ${t('grammar_focus', { label: `${t('axis_' + g.focus.axis)} = ${g.focus.value}` })}` : '';
        await step(t('grammar_step') + label, g.cards, 'card'); if (g.cards.length) mark('grammar');
      } catch (e) {
        await new Promise((resolve) => { skip.classList.add('hidden');
          clear(body).append(alertEl(`${t('grammar_unavailable')}: ${e.message}`, h('button', { class: 'btn btn--secondary btn--sm', onclick: resolve }, t('continue')))); });
        skip.classList.remove('hidden');
      }
    }
    // Story step: read it inline (skippable)
    title.textContent = t('story_step'); clear(body).append(h('p', { class: 'muted' }, t('story_generating')));
    const res = await storyReq;
    await new Promise((resolve) => {
      skip.onclick = () => { reader?.dispose(); resolve(); };
      let reader = null;
      if (res.e) { skip.classList.add('hidden');
        return clear(body).append(alertEl(`${t('story_unavailable')}: ${res.e.message}`, h('button', { class: 'btn btn--secondary btn--sm', onclick: () => { skip.classList.remove('hidden'); resolve(); } }, t('continue')))); }
      reader = storyReader(res.v, p);
      clear(body).append(h('div', { class: 'stack' }, h('div', { class: 'cluster' }, targetEl(res.v.title.target, p, 'lg')), storyMeta(res.v), reader,
        h('div', {}, h('button', { class: 'btn', onclick: async () => { await api.post(`/api/stories/${res.v.id}/read`).catch(() => {}); reader.dispose(); resolve(); } }, t('finished')))));
    });
    skip.classList.remove('hidden'); done++; progress();
    bar.style.width = '100%';
    clear(stage).append(h('div', { class: 'card study-card' }, h('h2', {}, t('session_done')),
      h('p', { class: 'muted' }, `${reviewed} ${t('reviewed')}. ${t('session_done_sub')}`),
      h('a', { class: 'btn', href: '#/home' }, t('nav_today'))));
  }
}
