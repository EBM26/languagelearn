import { h, clear } from '../dom.js';
import { t } from '../i18n.js';
import { S, profile } from '../settings.js';
import { api } from '../api.js';
import { targetEl, meaning, speakBtn } from '../card.js';
import { pageHead, statusBadge, alertEl } from '../ui.js';

export async function render(root) {
  const p = profile();
  if (!p) { root.append(alertEl(t('nothing_to_study'), null, 'info')); return; }
  const code = S.active;
  const input = h('textarea', { class: 'textarea', rows: 3, maxlength: 500, placeholder: t('say_placeholder'), 'aria-label': t('say_title') });
  const feedback = h('div', {}), list = h('div', { class: 'stack' });
  const submit = h('button', { class: 'btn' }, t('say_submit'));

  // A failed request is recorded server-side and shows its error on its own card, so we only
  // show a message here when no request was created (validation errors) or on success.
  const send = async (body) => {
    submit.disabled = true; clear(feedback).append(h('p', { class: 'muted text-sm' }, t('say_working')));
    let showError = null;
    try {
      const r = await api.post('/api/phrases', { profile: code, ...body });
      clear(feedback).append(alertEl(t('cards_added', { n: r.added }), null, 'info')); input.value = '';
    } catch (e) { clear(feedback); if (!e.data?.id) showError = e.message; }
    if (showError) feedback.append(alertEl(showError));
    submit.disabled = false; await load();
  };
  submit.onclick = () => input.value.trim() && send({ text: input.value });

  async function load() {
    const { requests } = await api.get(`/api/phrases?profile=${code}`);
    clear(list);
    if (!requests.length) list.append(h('p', { class: 'muted' }, t('say_empty')));
    for (const r of requests) list.append(h('section', { class: 'card stack' },
      h('div', { class: 'cluster' }, h('strong', { class: 'grow' }, r.request_text), statusBadge(r.status, t('status_' + r.status))),
      r.status === 'failed' && alertEl(r.error || t('error'), h('button', { class: 'btn btn--secondary btn--sm', onclick: () => send({ retry_id: r.id }) }, t('retry'))),
      r.cards.length > 0 && h('ul', { class: 'bullets' }, r.cards.map((c) => h('li', {}, h('span', { class: 'cluster' }, targetEl(c.target_text, p), speakBtn(c.target_text, p, t('speak'))), ' — ', meaning(c))))));
  }
  root.append(pageHead(t('say_title'), t('say_hint')), h('div', { class: 'measure stack-lg' },
    h('div', { class: 'stack' }, input, h('div', { class: 'cluster' }, submit), feedback), list));
  await load();
}
