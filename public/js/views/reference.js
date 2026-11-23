import { h, clear } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, profile, translitMode } from '../settings.js';
import { api } from '../api.js';
import { targetEl } from '../card.js';

export const topicLabel = (p, slug) => p.grammar_topic_labels?.[slug]?.[getLang()] ?? slug.replace(/-/g, ' ');
const L = (o) => (o ? o[getLang()] ?? o.en : '');

export async function render(root) {
  const p = profile();
  if (!p?.grammar_topics?.length) { root.append(h('p', {}, t('no_grammar'))); return; }
  const code = S.active;
  const data = await api.get(`/api/reference?profile=${code}`);
  root.append(h('h1', {}, t('ref_title')));

  // Weak spots
  const weak = data.weak.filter((w) => w.rate > 0).slice(0, 6);
  root.append(h('div', { class: 'card-box' }, h('h2', {}, t('weak_title')),
    weak.length ? h('ul', { style: 'padding-inline-start:1.2rem;margin:0' }, weak.map((w) => h('li', {},
      t('weak_line', { label: `${t('axis_' + w.axis)} = ${w.value}`, pct: Math.round(w.rate * 100), n: w.n }))))
      : h('p', { class: 'muted' }, t('weak_none'))));

  // Topics
  const firstNew = data.topics.find((x) => !x.started);
  const msg = h('p', { class: 'muted' });
  const start = async (topic, btn) => {
    btn.disabled = true; msg.className = 'muted'; msg.textContent = t('generating');
    try { await api.post('/api/grammar/start', { profile: code, topic });
      if (true) { clear(root); await render(root); } }
    catch (e) { msg.className = 'err'; msg.textContent = e.message; btn.disabled = false; }
  };
  root.append(h('div', { class: 'card-box' }, h('h2', {}, t('topics_title')), h('p', { class: 'muted' }, t('unlock_hint')),
    h('ul', { style: 'list-style:none;padding:0;margin:0' }, data.topics.map((x) => {
      const next = firstNew && x.topic === firstNew.topic;
      const btn = next && h('button', { class: 'btn small secondary' }, t(x.index === 0 ? 'start_topic' : 'start_anyway'));
      if (btn) btn.onclick = () => start(x.topic, btn);
      return h('li', { class: 'row', style: 'padding:.4rem 0;border-bottom:1px solid var(--line)' },
        h('span', { style: 'flex:1' }, `${x.index + 1}. ${topicLabel(p, x.topic)}`),
        x.started ? h('span', { class: 'badge on' }, t('topic_started')) : h('span', { class: 'badge' }, t(next ? 'topic_next' : 'topic_locked')),
        x.started && h('small', { class: 'muted' }, t('topic_stats', { n: x.count, r: x.reviews, pct: x.good_rate == null ? '–' : Math.round(x.good_rate * 100) })),
        btn);
    })), msg));

  // Tables for started topics
  for (const tp of data.topics.filter((x) => x.started)) {
    const tables = data.tables.filter((x) => x.topic === tp.topic);
    root.append(h('h2', {}, topicLabel(p, tp.topic)));
    if (!tables.length) {
      const b = h('button', { class: 'btn small', onclick: async () => {
        b.disabled = true; try { await api.post('/api/reference', { profile: code, topic: tp.topic }); clear(root); await render(root); }
        catch (e) { b.disabled = false; alert(`${t('tables_failed')}: ${e.message}`); } } }, t('gen_tables'));
      root.append(h('p', { class: 'muted' }, t('no_tables')), b);
    }
    for (const tb of tables) root.append(tableEl(p, tb, async () => { clear(root); await render(root); }));
  }
}

function tableEl(p, tb, reload) {
  const cell = (c) => {
    if (c.t) { const tr = translitMode(p), x = tr === 'latin' ? c.latin : tr === 'hebrew' ? c.hebrew : null;
      return h('td', {}, targetEl(c.t, p), x && h('div', { class: 'muted', style: 'font-size:.8rem' }, x)); }
    return h('td', {}, L(c));
  };
  const btn = h('button', { class: 'btn secondary small', onclick: async () => {
    const note = prompt(t('regenerate_note_prompt')); if (note === null) return;
    btn.disabled = true; btn.textContent = t('generating');
    try { await api.post(`/api/reference/${tb.id}/regenerate`, { note }); await reload(); } catch (e) { alert(e.message); btn.disabled = false; } } }, t('regenerate_table'));
  return h('div', { class: 'card-box', style: 'overflow-x:auto' }, h('h3', { style: 'margin-top:0' }, L(tb.title)),
    h('table', {}, h('thead', {}, h('tr', {}, tb.columns.map((c) => h('th', {}, L(c))))),
      h('tbody', {}, tb.rows.map((r) => h('tr', {}, r.map(cell))))),
    tb.notes && h('p', { class: 'muted' }, L(tb.notes)), btn);
}
