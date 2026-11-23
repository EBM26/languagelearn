import { h } from '../dom.js';
import { t } from '../i18n.js';
import { pageHead, alertEl } from '../ui.js';
// Placeholder until Phase 6 (streaks, minutes per day, retention, weak areas).
export async function render(root) {
  root.append(pageHead(t('stats_title')), h('div', { class: 'measure' }, alertEl(t('stats_soon'), null, 'info')));
}
