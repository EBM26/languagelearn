import { h, clear } from '../dom.js';
import { t } from '../i18n.js';
import { S, profile } from '../settings.js';
import { api } from '../api.js';
import { targetEl, meaning } from '../card.js';

const FIELDS = ['target_text', 'translit_latin', 'translit_hebrew', 'english', 'hebrew', 'cognate_hint', 'example_target', 'example_en', 'example_he'];
const SOURCES = ['script', 'frequency', 'personal', 'mistake', 'grammar'];

export async function render(root) {
  const p = profile();
  if (!p) { root.append(h('p', {}, t('nothing_to_study'))); return; }
  const f = { source: '', flagged: false, q: '', page: 0 };
  const list = h('div', {}), pager = h('div', { class: 'row' }), count = h('p', { class: 'muted' });
  const q = h('input', { type: 'search', placeholder: t('search'), onchange: (e) => { f.q = e.target.value; f.page = 0; load(); } });
  const src = h('select', { onchange: (e) => { f.source = e.target.value; f.page = 0; load(); } },
    h('option', { value: '' }, `${t('source')}: ${t('all')}`), SOURCES.map((s) => h('option', { value: s }, s)));
  const flg = h('label', {}, h('input', { type: 'checkbox', onchange: (e) => { f.flagged = e.target.checked; f.page = 0; load(); } }), t('flagged_only'));
  root.append(h('h1', {}, t('deck_title')), h('div', { class: 'row' }, q, src, flg), count, list, pager);

  async function load() {
    const qs = new URLSearchParams({ profile: S.active, page: f.page });
    if (f.source) qs.set('source', f.source); if (f.flagged) qs.set('flagged', '1'); if (f.q) qs.set('q', f.q);
    const r = await api.get('/api/cards?' + qs);
    count.textContent = t('cards_count', { n: r.total });
    clear(list); r.cards.forEach((c) => list.append(row(c)));
    clear(pager).append(
      h('button', { class: 'btn secondary small', disabled: f.page === 0, onclick: () => { f.page--; load(); } }, t('prev')),
      h('button', { class: 'btn secondary small', disabled: (f.page + 1) * r.page_size >= r.total, onclick: () => { f.page++; load(); } }, t('next')));
  }

  function row(c) {
    const box = h('div', { class: 'card-box' });
    const view = () => {
      clear(box).append(h('div', { class: 'row' },
        h('div', { style: 'flex:1' }, targetEl(c.target_text, p), h('div', { class: 'muted' }, meaning(c))),
        h('span', { class: 'badge' }, c.source), c.flagged ? h('span', { class: 'badge' }, '⚑ ' + t('flagged')) : null,
        h('button', { class: 'btn secondary small', onclick: edit }, t('edit'))),
        c.flagged && c.flag_note ? h('p', { class: 'muted' }, c.flag_note) : null);
    };
    const edit = () => {
      const inputs = {};
      const form = FIELDS.map((k) => { inputs[k] = h('input', { value: c[k] ?? '', style: 'width:100%;padding:.4rem',
        dir: k === 'target_text' || k === 'example_target' ? p.direction : null }); return h('label', { style: 'display:block;margin:.3rem 0' }, t('f_' + k), inputs[k]); });
      const status = h('span', { class: 'muted' });
      const act = (fn) => async () => { try { await fn(); } catch (e) { status.className = 'err'; status.textContent = e.message; } };
      clear(box).append(...form, h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: act(async () => {
          const body = Object.fromEntries(FIELDS.map((k) => [k, inputs[k].value]));
          await api.put(`/api/cards/${c.id}`, body); Object.assign(c, body); status.textContent = t('saved'); view(); }) }, t('save')),
        h('button', { class: 'btn secondary small', onclick: view }, t('prev')),
        c.flagged && h('button', { class: 'btn secondary small', onclick: act(async () => { await api.put(`/api/cards/${c.id}`, { flagged: 0 }); load(); }) }, t('unflag')),
        !['letter', 'syllable'].includes(c.type) && h('button', { class: 'btn secondary small', onclick: act(async (e) => {
          status.textContent = t('loading'); await api.post(`/api/cards/${c.id}/regenerate`); load(); }) }, t('regenerate')),
        h('button', { class: 'btn secondary small g1', onclick: act(async () => {
          if (!confirm(t('confirm_delete'))) return; await api.del(`/api/cards/${c.id}`); load(); }) }, t('delete')), status));
    };
    view(); return box;
  }
  await load();
}
