import { h, clear } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, profile, translitMode } from '../settings.js';
import { api } from '../api.js';
import { targetEl, speakBtn } from '../card.js';
import { pageHead, badge, alertEl } from '../ui.js';

export const topicLabel = (p, slug) => p.grammar_topic_labels?.[slug]?.[getLang()] ?? slug.replace(/-/g, ' ');
const L = (o) => (o ? o[getLang()] ?? o.en : '');

export async function render(root) {
  const p = profile();
  if (!p?.grammar_topics?.length) { root.append(alertEl(t('no_grammar'), null, 'info')); return; }
  const code = S.active;
  const data = await api.get(`/api/reference?profile=${code}`);
  const redraw = async () => { clear(root); await render(root); };
  root.append(pageHead(t('ref_title')));
  const body = h('div', { class: 'stack-lg' });
  root.append(body);

  const weak = data.weak.filter((w) => w.rate > 0).slice(0, 6);
  const msg = h('div', {});
  const firstNew = data.topics.find((x) => !x.started);
  const start = async (topic, btn) => {
    btn.disabled = true; msg.replaceChildren(h('p', { class: 'muted text-sm' }, t('generating')));
    try { await api.post('/api/grammar/start', { profile: code, topic }); await redraw(); }
    catch (e) { msg.replaceChildren(alertEl(e.message)); btn.disabled = false; }
  };
  body.append(h('div', { class: 'grid-cards' },
    h('section', { class: 'card stack' }, h('h2', {}, t('weak_title')),
      weak.length ? h('ul', { class: 'bullets' }, weak.map((w) => h('li', {},
        t('weak_line', { label: `${t('axis_' + w.axis)} = ${w.value}`, pct: Math.round(w.rate * 100), n: w.n }))))
        : h('p', { class: 'muted text-sm' }, t('weak_none'))),
    h('section', { class: 'card' }, h('h2', {}, t('topics_title')), h('p', { class: 'muted text-sm mt-2' }, t('unlock_hint')),
      h('ul', { class: 'plain-list mt-4' }, data.topics.map((x) => {
        const next = firstNew && x.topic === firstNew.topic;
        const btn = next && h('button', { class: 'btn btn--secondary btn--sm' }, t(x.index === 0 ? 'start_topic' : 'start_anyway'));
        if (btn) btn.onclick = () => start(x.topic, btn);
        return h('li', { class: 'topic-row' }, h('span', { class: 'grow' }, `${x.index + 1}. ${topicLabel(p, x.topic)}`),
          x.started ? badge(t('topic_started'), 'success') : badge(t(next ? 'topic_next' : 'topic_locked')),
          x.started && h('span', { class: 'muted text-sm' }, t('topic_stats', { n: x.count, r: x.reviews, pct: x.good_rate == null ? '–' : Math.round(x.good_rate * 100) })), btn);
      })), h('div', { class: 'mt-4' }, msg))));

  for (const tp of data.topics.filter((x) => x.started)) {
    const tables = data.tables.filter((x) => x.topic === tp.topic);
    const sec = h('section', { class: 'stack' }, h('h2', {}, topicLabel(p, tp.topic)));
    if (!tables.length) {
      const err = h('div', {});
      const b = h('button', { class: 'btn btn--sm', onclick: async () => {
        b.disabled = true; err.replaceChildren();
        try { await api.post('/api/reference', { profile: code, topic: tp.topic }); await redraw(); }
        catch (e) { err.replaceChildren(alertEl(`${t('tables_failed')}: ${e.message}`)); b.disabled = false; } } }, t('gen_tables'));
      sec.append(h('p', { class: 'muted' }, t('no_tables')), err, h('div', {}, b));
    }
    const grid = h('div', { class: 'grid-cards' });
    for (const tb of tables) grid.append(tableEl(p, tb, redraw));
    sec.append(grid); body.append(sec);
  }
}

function tableEl(p, tb, reload) {
  const cell = (c) => {
    if (c.t) { const m = translitMode(p), x = m === 'latin' ? c.latin : m === 'hebrew' ? c.hebrew : null;
      return h('td', {}, h('span', { class: 'cluster' }, targetEl(c.t, p), speakBtn(c.t, p, t('speak'))), x && h('div', { class: 'muted text-sm' }, x)); }
    return h('td', {}, L(c));
  };
  const err = h('div', {});
  const btn = h('button', { class: 'btn btn--secondary btn--sm', onclick: async () => {
    const note = prompt(t('regenerate_note_prompt')); if (note === null) return;
    btn.disabled = true; btn.textContent = t('generating'); err.replaceChildren();
    try { await api.post(`/api/reference/${tb.id}/regenerate`, { note }); await reload(); }
    catch (e) { err.replaceChildren(alertEl(e.message)); btn.disabled = false; btn.textContent = t('regenerate_table'); } } }, t('regenerate_table'));
  return h('div', { class: 'card stack' }, h('h3', {}, L(tb.title)),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, tb.columns.map((c) => h('th', {}, L(c))))),
      h('tbody', {}, tb.rows.map((r) => h('tr', {}, r.map(cell)))))),
    tb.notes && h('p', { class: 'muted text-sm' }, L(tb.notes)), err, h('div', {}, btn));
}
