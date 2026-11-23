import { h, clear } from '../dom.js';
import { t } from '../i18n.js';
import { S, profile } from '../settings.js';
import { api } from '../api.js';
import { targetEl } from '../card.js';
import { meaning } from '../card.js';

export async function render(root) {
  const p = profile();
  if (!p) { root.append(h('p', {}, t('nothing_to_study'))); return; }
  const code = S.active;
  const input = h('textarea', { rows: 3, maxlength: 500, placeholder: t('say_placeholder') });
  const msg = h('p', { class: 'muted' }), list = h('div', {});
  const submit = h('button', { class: 'btn' }, t('say_submit'));
  const send = async (body) => {
    submit.disabled = true; msg.className = 'muted'; msg.textContent = t('say_working');
    try {
      const r = await api.post('/api/phrases', { profile: code, ...body });
      msg.textContent = t('cards_added', { n: r.added }); input.value = '';
    } catch (e) { msg.className = 'err'; msg.textContent = e.message; }
    submit.disabled = false; load();
  };
  submit.onclick = () => input.value.trim() && send({ text: input.value });
  async function load() {
    const { requests } = await api.get(`/api/phrases?profile=${code}`);
    clear(list);
    if (!requests.length) list.append(h('p', { class: 'muted' }, t('say_empty')));
    for (const r of requests) list.append(h('div', { class: 'card-box' },
      h('div', { class: 'row' }, h('strong', { style: 'flex:1' }, r.request_text),
        h('span', { class: 'badge' + (r.status === 'done' ? ' on' : '') }, t('status_' + r.status))),
      r.status === 'failed' && h('div', {}, h('p', { class: 'err' }, r.error || ''),
        h('button', { class: 'btn small', onclick: () => send({ retry_id: r.id }) }, t('retry'))),
      h('ul', { style: 'padding-inline-start:1.2rem' }, r.cards.map((c) => h('li', {}, targetEl(c.target_text, p), ' — ', meaning(c))))));
  }
  root.append(h('h1', {}, t('say_title')), h('p', { class: 'muted' }, t('say_hint')), input,
    h('div', { class: 'row', style: 'margin:.5rem 0' }, submit), msg, list);
  await load();
}
