import { h } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, activeCodes } from '../settings.js';
import { api } from '../api.js';
import { pageHead, alertEl, badge } from '../ui.js';
import { humanNudge } from '../nudge.js';

const stat = (n, label) => h('div', { class: 'stat' }, h('div', { class: 'stat__n' }, n), h('div', { class: 'stat__l' }, label));
const pct = (r) => (r == null ? '–' : Math.round(r * 100) + '%');

function minutesChart(days) {
  const max = Math.max(5, ...days.map((d) => d.minutes));
  return h('div', { class: 'bars', role: 'img', 'aria-label': t('stats_minutes') },
    days.map((d) => h('div', { class: 'bars__col', title: `${d.day}: ${d.minutes} ${t('min')}` },
      h('div', { class: 'bars__val' }, d.minutes ? Math.round(d.minutes) : ''),
      h('div', { class: 'bars__bar' + (d.minutes ? '' : ' bars__bar--empty'), style: `height:${Math.max(3, (d.minutes / max) * 100)}%` }),
      h('div', { class: 'bars__lbl' }, d.day.slice(8)))));
}
const weakLabel = (w) => `${t('axis_' + w.axis)} = ${w.value}`;

export async function render(root) {
  root.append(pageHead(t('stats_title')));
  const codes = activeCodes();
  if (!codes.length) { root.append(alertEl(t('nothing_to_study'), null, 'info')); return; }
  const data = await Promise.all(codes.map((c) => api.get(`/api/stats?profile=${c}`)));
  const grid = h('div', { class: 'stack-lg' });
  codes.forEach((c, i) => {
    const s = data[i], p = S.profiles[c];
    grid.append(h('section', { class: 'card stack' },
      h('div', { class: 'cluster' }, h('h2', { class: 'grow' }, p.names[getLang()]), s.streak.current > 0 && badge(`🔥 ${s.streak.current} ${t('days')}`, 'warning')),
      h('div', { class: 'stats' }, stat(s.streak.current, t('stat_streak')), stat(s.streak.best, t('stat_best')), stat(s.today.minutes, t('stat_today_min')),
        stat(s.items.started, t('stat_started')), stat(s.items.mature, t('stat_mature')), stat(pct(s.retention.rate), t('stat_retention'))),
      s.retention.rate == null && h('p', { class: 'muted text-sm' }, t('stats_retention_hint')),
      h('h3', {}, `${t('stats_minutes')} · ${s.minutes_14d} ${t('min')}`), minutesChart(s.last14),
      p.grammar_topics?.length > 0 && h('div', { class: 'stack' }, h('h3', {}, t('stats_weak')),
        s.weak.length ? h('div', { class: 'stack' }, s.weak.map((w) => h('div', { class: 'weak' },
          h('span', { class: 'weak__lbl' }, weakLabel(w)), h('div', { class: 'meter' }, h('div', { style: `width:${Math.round(w.rate * 100)}%` })),
          h('span', { class: 'muted text-sm' }, `${Math.round(w.rate * 100)}% · ${w.n}`))))
          : h('p', { class: 'muted text-sm' }, t('stats_weak_none'))),
      humanNudge(c, s.human)));
  });
  root.append(grid);
}
