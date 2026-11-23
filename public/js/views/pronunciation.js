import { h, clear } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, profile } from '../settings.js';
import { api } from '../api.js';
import { targetEl, speakBtn, applyProfileStyle } from '../card.js';
import { micButton } from '../recorder.js';
import { pageHead, badge, alertEl } from '../ui.js';

const L = (o) => (o ? o[getLang()] ?? o.en : '');
const clean = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
function similarity(a, b) {       // 1 - normalised edit distance
  a = clean(a); b = clean(b);
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length, 1);
}
const OK = 0.75;                  // how close the transcript must be to count as correct

// Pronunciation module (Italian / German): listen-and-repeat per topic, then a reading-aloud check.
// Recordings go through the same Whisper pipeline as speaking practice; the transcript is compared with the text.
export async function render(root) {
  const p = profile(), cfg = p?.pronunciation_module;
  if (!cfg?.enabled || !cfg.data) { root.append(alertEl(t('nothing_to_study'), null, 'info')); return; }
  applyProfileStyle(p);
  const [data, prog] = await Promise.all([fetch(cfg.data).then((r) => r.json()), api.get(`/api/module?profile=${S.active}&module=pronunciation`)]);
  const tabs = { learn, check }; let cur = 'learn';
  const body = h('div', {}), bar = h('div', { class: 'tabs', role: 'tablist' });
  const draw = () => {
    clear(bar).append(...Object.keys(tabs).map((k) => h('button', { role: 'tab', 'aria-selected': String(k === cur), class: k === cur ? 'on' : '', onclick: () => { cur = k; draw(); } }, t('pron_tab_' + k))));
    clear(body); tabs[cur](body);
  };

  // Say-it-back row: record, transcribe, compare.
  function sayRow(item) {
    const res = h('div', { class: 'text-sm muted' });
    const mic = micButton(p, { onError: (m) => res.replaceChildren(m),
      onText: (txt) => { const ok = similarity(txt, item.text) >= OK;
        res.replaceChildren(h('span', {}, `${t('pron_heard')}: `), h('strong', { dir: 'auto' }, txt || '…'), ' ', badge(ok ? t('pron_good') : t('pron_again'), ok ? 'success' : 'warning')); } });
    return h('div', { class: 'deck-row' }, h('div', { class: 'grow stack' },
      h('div', { class: 'cluster' }, targetEl(item.text, p, 'lg'), speakBtn(item.text, p, t('speak')), h('span', { class: 'muted' }, L(item))), res), mic);
  }
  function learn(el) {
    el.append(h('div', { class: 'stack-lg' }, data.topics.map((tp) => h('section', { class: 'card stack' },
      h('h2', {}, L(tp.title)), h('p', {}, L(tp.rule)), h('div', { class: 'stack' }, tp.items.map(sayRow))))));
  }
  function check(el) {
    const want = cfg.check_items ?? 10, pct = Math.round((cfg.pass_threshold ?? 0.8) * 100);
    el.append(h('div', { class: 'card stack measure' }, h('p', {}, t('pron_check_intro', { pct, n: want })), h('div', {}, h('button', { class: 'btn', onclick: start }, t('start_check')))));
    function start() {
      const pool = data.topics.flatMap((x) => x.items).sort(() => Math.random() - 0.5), items = Array.from({ length: want }, (_, i) => pool[i % pool.length]);
      let i = 0, score = 0;
      const next = () => {
        if (i >= items.length) return result();
        const it = items[i++], act = h('div', { class: 'stack' }), mark = (ok) => { if (ok) score++; next(); };
        const selfGrade = () => act.replaceChildren(h('div', { class: 'cluster', style: 'justify-content:center' },
          h('button', { class: 'btn btn--sm', onclick: () => mark(true) }, t('read_ok')), h('button', { class: 'btn btn--secondary btn--sm', onclick: () => mark(false) }, t('read_miss'))));
        const mic = micButton(p, { onError: () => selfGrade(),
          onText: (txt) => { const ok = similarity(txt, it.text) >= OK;
            act.replaceChildren(h('div', {}, `${t('pron_heard')}: `, h('strong', { dir: 'auto' }, txt || '…')), badge(ok ? t('pron_good') : t('pron_again'), ok ? 'success' : 'warning'),
              h('div', { class: 'cluster', style: 'justify-content:center' }, h('button', { class: 'btn btn--sm', onclick: () => mark(ok) }, t('continue')),
                !ok && h('button', { class: 'btn btn--ghost btn--sm', onclick: () => mark(true) }, t('pron_count_anyway')))); } });
        if (mic) act.append(h('p', { class: 'muted text-sm' }, t('pron_say_it')), mic); else selfGrade();
        clear(el).append(h('div', { class: 'measure stack' }, h('div', { class: 'progress' }, h('div', { style: `width:${(i / items.length) * 100}%` })),
          h('div', { class: 'card study-card' }, h('div', { class: 'cluster' }, targetEl(it.text, p, 'xl'), speakBtn(it.text, p, t('speak'))), h('div', { class: 'muted' }, L(it)), act)));
      };
      async function result() {
        const { passed } = await api.post('/api/module', { profile: S.active, module: 'pronunciation', action: 'check', score, total: items.length });
        clear(el).append(h('div', { class: 'card stack measure' }, h('h2', {}, t('check_result', { score, total: items.length })),
          alertEl(passed ? t('pron_passed') : t('pron_failed'), null, passed ? 'info' : 'danger'),
          h('div', {}, h('a', { class: 'btn', href: '#/home' }, t('nav_today')))));
      }
      next();
    }
  }
  root.append(pageHead(t('pron_title')), h('div', { class: 'stack-lg' },
    h('div', { class: 'cluster' }, badge(prog.completed_at ? t('module_done') : t('module_todo'), prog.completed_at ? 'success' : 'info')), h('div', {}, bar, body)));
  draw();
}
