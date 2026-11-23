import { h } from './dom.js';
import { t } from './i18n.js';
import { api } from './api.js';
import { toggle } from './ui.js';
// Weekly "talk to a real person" nudge with a log checkbox. `human` = {week, done} from /api/stats.
export function humanNudge(code, human) {
  const box = h('div', { class: 'nudge' + (human.done ? ' nudge--done' : '') });
  const paint = (done) => { box.classList.toggle('nudge--done', done);
    box.replaceChildren(h('span', { class: 'nudge__text' }, done ? t('human_done') : t('human_nudge')),
      toggle({ checked: done, label: t('human_log'), onChange: async (on) => { try { await api.post('/api/human-practice', { profile: code, done: on }); paint(on); } catch { paint(!on); } } })); };
  paint(human.done);
  return box;
}
