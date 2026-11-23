import { h, clear } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, profile } from '../settings.js';
import { api } from '../api.js';
import { targetEl, meaning, speakBtn } from '../card.js';
import { pageHead, field, badge, select, toggle, alertEl } from '../ui.js';

const FIELDS = ['target_text', 'translit_latin', 'translit_hebrew', 'english', 'hebrew', 'cognate_hint', 'example_target', 'example_en', 'example_he'];
const SOURCES = ['script', 'frequency', 'personal', 'mistake', 'grammar'];

export async function render(root) {
  const p = profile();
  if (!p) { root.append(alertEl(t('nothing_to_study'), null, 'info')); return; }
  const f = { source: '', topic: '', flagged: false, q: '', page: 0 };
  const list = h('div', { class: 'stack' }), pager = h('div', { class: 'cluster mt-4' }), count = h('p', { class: 'muted text-sm' });
  const reload = () => { f.page = 0; load(); };
  const filters = h('div', { class: 'filters' },
    h('input', { class: 'input', type: 'search', placeholder: t('search'), 'aria-label': t('search'), onchange: (e) => { f.q = e.target.value; reload(); } }),
    select({ label: t('source'), value: '', options: [{ value: '', label: `${t('source')}: ${t('all')}` }, ...SOURCES.map((s) => ({ value: s, label: s }))], onChange: (v) => { f.source = v; reload(); } }),
    p.grammar_topics?.length && select({ label: t('topic_filter'), value: '', options: [{ value: '', label: `${t('topic_filter')}: ${t('all')}` },
      ...p.grammar_topics.map((x) => ({ value: x, label: p.grammar_topic_labels?.[x]?.[getLang()] ?? x }))], onChange: (v) => { f.topic = v; reload(); } }),
    toggle({ checked: false, label: t('flagged_only'), onChange: (on) => { f.flagged = on; reload(); } }));
  root.append(pageHead(t('deck_title')), filters, count, list, pager);

  async function load() {
    const qs = new URLSearchParams({ profile: S.active, page: f.page });
    if (f.source) qs.set('source', f.source); if (f.topic) qs.set('topic', f.topic); if (f.flagged) qs.set('flagged', '1'); if (f.q) qs.set('q', f.q);
    const r = await api.get('/api/cards?' + qs);
    count.textContent = t('cards_count', { n: r.total });
    clear(list); r.cards.forEach((c) => list.append(row(c)));
    clear(pager).append(
      h('button', { class: 'btn btn--secondary btn--sm', disabled: f.page === 0, onclick: () => { f.page--; load(); } }, t('prev')),
      h('button', { class: 'btn btn--secondary btn--sm', disabled: (f.page + 1) * r.page_size >= r.total, onclick: () => { f.page++; load(); } }, t('next')));
  }

  function row(c) {
    const box = h('div', { class: 'card stack' });
    const view = () => {
      clear(box).append(h('div', { class: 'deck-row' },
        h('div', { class: 'grow' }, h('span', { class: 'cluster' }, targetEl(c.target_text, p), speakBtn(c.target_text, p, t('speak'))), h('div', { class: 'muted text-sm' }, meaning(c))),
        badge(c.source, 'info'), c.flagged ? badge('⚑ ' + t('flagged'), 'warning') : null,
        h('button', { class: 'btn btn--secondary btn--sm', onclick: edit }, t('edit'))));
      if (c.flagged && c.flag_note) box.append(h('p', { class: 'muted text-sm' }, c.flag_note));
    };
    const edit = () => {
      const inputs = {}, status = h('div', {});
      const form = FIELDS.map((k) => { inputs[k] = h('input', { class: 'input', value: c[k] ?? '', dir: k === 'target_text' || k === 'example_target' ? p.direction : null });
        return field(t('f_' + k), inputs[k]); });
      const act = (fn) => async () => { try { clear(status); await fn(); } catch (e) { status.replaceChildren(alertEl(e.message)); } };
      clear(box).append(h('div', { class: 'form-grid' }, ...form), status, h('div', { class: 'cluster' },
        h('button', { class: 'btn btn--sm', onclick: act(async () => {
          const body = Object.fromEntries(FIELDS.map((k) => [k, inputs[k].value]));
          await api.put(`/api/cards/${c.id}`, body); Object.assign(c, body); view(); }) }, t('save')),
        h('button', { class: 'btn btn--secondary btn--sm', onclick: view }, t('cancel')),
        c.flagged && h('button', { class: 'btn btn--secondary btn--sm', onclick: act(async () => { await api.put(`/api/cards/${c.id}`, { flagged: 0 }); load(); }) }, t('unflag')),
        !['letter', 'syllable'].includes(c.type) && h('button', { class: 'btn btn--secondary btn--sm', onclick: act(async () => {
          status.replaceChildren(h('p', { class: 'muted text-sm' }, t('loading'))); await api.post(`/api/cards/${c.id}/regenerate`); load(); }) }, t('regenerate')),
        h('button', { class: 'btn btn--danger btn--sm', onclick: act(async () => { if (!confirm(t('confirm_delete'))) return; await api.del(`/api/cards/${c.id}`); load(); }) }, t('delete'))));
    };
    view(); return box;
  }
  await load();
}
