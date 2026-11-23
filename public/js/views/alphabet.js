import { h, clear } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, profile, translitMode, setSetting } from '../settings.js';
import { api } from '../api.js';
import { targetEl, speakBtn, applyProfileStyle } from '../card.js';
import { pageHead, badge, select, toggle, alertEl } from '../ui.js';

const L = (en, he) => (getLang() === 'he' ? he || en : en || he);

export async function render(root) {
  const p = profile(), cfg = p?.script_module;
  if (!cfg?.enabled) { root.append(alertEl(t('nothing_to_study'), null, 'info')); return; }
  applyProfileStyle(p);
  const [data, prog] = await Promise.all([fetch(cfg.data).then((r) => r.json()), api.get(`/api/module?profile=${S.active}`)]);
  const tabs = { letters: lettersTab, marks: marksTab, write: writeTab, check: checkTab };
  let cur = 'letters';
  const body = h('div', {}), bar = h('div', { class: 'tabs', role: 'tablist' });
  const draw = () => {
    clear(bar).append(...Object.keys(tabs).map((k) => h('button', { role: 'tab', 'aria-selected': String(k === cur), class: k === cur ? 'on' : '', onclick: () => { cur = k; draw(); } }, t('tab_' + k))));
    clear(body); tabs[cur](body, data, p, prog, draw);
  };
  const started = prog.counts.reduce((a, c) => a + (c.started || 0), 0), total = prog.counts.reduce((a, c) => a + c.total, 0);
  root.append(pageHead(t('alphabet_title')), h('div', { class: 'stack-lg' },
    h('div', { class: 'cluster' },
      badge(prog.completed_at ? t('module_done') : t('module_todo'), prog.completed_at ? 'success' : 'info'),
      h('span', { class: 'muted text-sm' }, `${t('module_progress')}: ${started}/${total}`),
      h('span', { class: 'grow' }), h('a', { class: 'btn btn--secondary btn--sm', href: '#/study' }, t('study_alphabet'))),
    h('div', {}, bar, body)));
  draw();
}

function lettersTab(el, d, p) {
  const detail = h('div', { class: 'card stack' });
  const show = (l, tile) => {
    el.querySelectorAll('.tile').forEach((x) => x.classList.remove('on')); tile?.classList.add('on');
    const m = translitMode(p);
    clear(detail).append(
      h('div', { class: 'cluster' }, h('h2', { class: 'grow' }, `${l.name_en} · ${l.name_he}`), speakBtn(l.char, p, t('speak'))),
      h('p', {}, `${t('sound')}: ${m === 'hebrew' ? l.sound_he : l.sound_latin}`, m === 'off' ? ` (${l.sound_latin})` : ''),
      h('div', { class: 'forms' }, ['isolated', 'initial', 'medial', 'final'].map((f) => h('div', {}, targetEl(l.forms[f], p, 'lg'), h('small', {}, t(f))))),
      h('p', { class: 'muted text-sm' }, l.joins_left ? t('connects') : t('no_connect')),
      (l.note_en || l.note_he) && h('p', { class: 'text-sm' }, L(l.note_en, l.note_he)));
  };
  el.append(h('div', { class: 'stack-lg' }, h('div', { class: 'grid' }, d.letters.map((l) => {
    const tile = h('button', { class: 'tile', onclick: () => show(l, tile) }, targetEl(l.char, p, 'lg'), h('small', {}, l.name_en)); return tile; })), detail));
  show(d.letters[0], el.querySelector('.tile'));
}

function marksTab(el, d, p) {
  const head = h('thead', {}, h('tr', {}, [t('mark'), t('name'), t('sound'), t('example_word')].map((x) => h('th', {}, x))));
  const rows = d.marks.map((m) => h('tr', {},
    h('td', {}, targetEl(m.char, p, 'lg')),
    h('td', {}, L(m.name_en, m.name_he)),
    h('td', {}, L(m.sound_latin, m.sound_he)),
    h('td', {}, targetEl(m.example, p), ' ', translitMode(p) === 'hebrew' ? m.example_he : m.example_latin)));
  el.append(h('div', { class: 'card table-wrap' }, h('table', { class: 'table' }, head, h('tbody', {}, rows))));
}

function writeTab(el, d, p) {
  let letter = d.letters[0], form = 'isolated', model = true;
  const wrap = h('div', { class: 'canvas-wrap' }), bg = h('canvas'), fg = h('canvas');
  wrap.append(bg, fg);
  const bgc = bg.getContext('2d'), fgc = fg.getContext('2d');
  const size = () => {
    const r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    [bg, fg].forEach((c) => { c.width = r.width * dpr; c.height = r.height * dpr; });
    bgc.setTransform(dpr, 0, 0, dpr, 0, 0); fgc.setTransform(dpr, 0, 0, dpr, 0, 0);
    fgc.lineWidth = 6; fgc.lineCap = 'round'; fgc.lineJoin = 'round'; fgc.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text');
    paint();
  };
  const paint = () => {
    const r = wrap.getBoundingClientRect(); bgc.clearRect(0, 0, r.width, r.height);
    if (!model) return;
    bgc.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-strong'); bgc.textAlign = 'center'; bgc.textBaseline = 'middle';
    bgc.font = `${r.width * 0.6}px ${getComputedStyle(document.documentElement).getPropertyValue('--target-font')}`;
    bgc.fillText(letter.forms[form], r.width / 2, r.height / 2);
  };
  let drawing = false;
  const pos = (e) => { const r = fg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  fg.addEventListener('pointerdown', (e) => { drawing = true; fg.setPointerCapture(e.pointerId); fgc.beginPath(); fgc.moveTo(...pos(e)); });
  fg.addEventListener('pointermove', (e) => { if (!drawing) return; fgc.lineTo(...pos(e)); fgc.stroke(); });
  ['pointerup', 'pointercancel'].forEach((ev) => fg.addEventListener(ev, () => { drawing = false; }));
  const wipe = () => { const r = wrap.getBoundingClientRect(); fgc.clearRect(0, 0, r.width, r.height); };
  const label = h('h2', { class: 'center', dir: 'ltr' });
  const upd = () => { label.textContent = `${letter.name_en} (${form})`; paint(); };
  el.append(h('div', { class: 'card stack measure' }, label, wrap,
    h('div', { class: 'cluster', style: 'justify-content:center' },
      select({ label: t('form'), value: 'isolated', options: ['isolated', 'initial', 'medial', 'final'].map((f) => ({ value: f, label: t(f) })), onChange: (v) => { form = v; wipe(); upd(); } }),
      toggle({ checked: true, label: t('show_model'), onChange: (on) => { model = on; paint(); } }),
      h('button', { class: 'btn btn--secondary btn--sm', onclick: wipe }, t('clear')),
      h('button', { class: 'btn btn--sm', onclick: () => { letter = d.letters[Math.floor(Math.random() * d.letters.length)]; wipe(); upd(); } }, t('next_letter')))));
  requestAnimationFrame(() => { size(); upd(); });
}

function checkTab(el, d, p) {
  const cfg = p.script_module, want = cfg.check_words ?? 20;
  const pct = Math.round((cfg.pass_threshold ?? 0.9) * 100);
  el.append(h('div', { class: 'card stack measure' }, h('p', {}, t('check_intro', { pct, n: want })), h('div', {}, h('button', { class: 'btn', onclick: start }, t('start_check')))));
  function start() {
    // 20 random words, drawn with repeats if the pool is smaller than the check length
    const pool = [...d.words].sort(() => Math.random() - 0.5);
    const words = Array.from({ length: want }, (_, i) => pool[i % pool.length]);
    let i = 0, score = 0;
    const next = () => {
      if (i >= words.length) return result();
      const w = words[i++], m = translitMode(p);
      const ans = h('div', { class: 'stack hidden' }, h('div', { class: 'text-lg' }, m === 'hebrew' ? w.hebrew : w.latin), h('div', {}, L(w.en, w.he)),
        h('div', { class: 'cluster', style: 'justify-content:center' },
          h('button', { class: 'btn btn--sm', onclick: () => { score++; next(); } }, t('read_ok')),
          h('button', { class: 'btn btn--secondary btn--sm', onclick: next }, t('read_miss'))));
      const rev = h('button', { class: 'btn', onclick: () => { rev.classList.add('hidden'); ans.classList.remove('hidden'); } }, t('reveal'));
      clear(el).append(h('div', { class: 'measure stack' }, h('div', { class: 'progress' }, h('div', { style: `width:${(i / words.length) * 100}%` })),
        h('div', { class: 'card study-card' }, h('div', { class: 'cluster' }, targetEl(w.text, p, 'xl'), speakBtn(w.text, p, t('speak'))), rev, ans)));
    };
    async function result() {
      const { passed } = await api.post('/api/module', { profile: S.active, action: 'check', score, total: words.length });
      if (passed) await setSetting('translit', 'off');
      clear(el).append(h('div', { class: 'card stack measure' }, h('h2', {}, t('check_result', { score, total: words.length })),
        alertEl(passed ? t('check_passed') : t('check_failed'), null, passed ? 'info' : 'danger'),
        h('div', {}, h('a', { class: 'btn', href: '#/alphabet', onclick: () => setTimeout(() => location.reload(), 0) }, t('alphabet')))));
    }
    next();
  }
}
