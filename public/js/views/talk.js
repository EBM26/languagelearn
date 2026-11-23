import { h, clear } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { S, profile, translitMode } from '../settings.js';
import { api } from '../api.js';
import { targetEl, speakBtn, plain, applyProfileStyle } from '../card.js';
import { speak } from '../tts.js';
import { micButton } from '../recorder.js';
import { pageHead, alertEl } from '../ui.js';

const L = (o) => (o ? o[getLang()] ?? o.en : '');

// One spoken-practice conversation. Used by the #/talk page and by the daily session's last step.
// onFinished() fires when the learner clicks Continue after seeing their corrections.
export function talkUI(p, { onFinished } = {}) {
  applyProfileStyle(p);
  const box = h('div', { class: 'stack-lg' });
  let conv = null, t0 = 0, busy = false;

  const bubbleAi = (m) => {
    const tr = translitMode(p) === 'latin' ? m.latin : translitMode(p) === 'hebrew' ? m.hebrew : null;
    const trans = h('div', { class: 'sentence__trans hidden' }, getLang() === 'he' ? m.he : m.en);
    const show = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => trans.classList.toggle('hidden') }, t('show_translation'));
    return h('div', { class: 'bubble bubble--ai' },
      h('div', { class: 'cluster' }, targetEl(plain(m.target, p), p, 'lg'), speakBtn(m.target, p, t('speak'))),
      tr && h('div', { class: 'muted text-sm' }, tr), trans, show);
  };
  const bubbleMe = (text) => h('div', { class: 'bubble bubble--me' }, h('span', { dir: p.direction, class: 'target' }, text));

  function startScreen() {
    const topic = h('input', { class: 'input', placeholder: t('talk_topic_ph'), 'aria-label': t('talk_topic') });
    const err = h('div', {});
    const go = h('button', { class: 'btn', onclick: async () => {
      go.disabled = true; err.replaceChildren(h('p', { class: 'muted text-sm' }, t('talk_starting')));
      try { const r = await api.post('/api/talk', { profile: p.code, topic: topic.value }); conv = r; t0 = Date.now(); chat(r.message); }
      catch (e) { go.disabled = false; err.replaceChildren(alertEl(e.message)); }
    } }, t('talk_start'));
    clear(box).append(h('div', { class: 'card stack' }, h('p', {}, t('talk_intro')), topic, h('div', {}, go), err));
  }

  function chat(first) {
    const log = h('div', { class: 'chat', 'aria-live': 'polite' }, bubbleAi(first));
    const err = h('div', {});
    const input = h('textarea', { class: 'textarea', rows: 2, dir: p.direction, placeholder: t('talk_type_ph'), 'aria-label': t('talk_type_ph') });
    const mic = micButton(p, { onText: (txt) => { input.value = (input.value + ' ' + txt).trim(); input.focus(); }, onError: (m) => err.replaceChildren(alertEl(m, null, 'info')) });
    const send = h('button', { class: 'btn', type: 'button' }, t('talk_send'));
    const finish = h('button', { class: 'btn btn--secondary', type: 'button', disabled: true }, t('talk_finish'));
    const controls = h('div', { class: 'stack' }, input, h('div', { class: 'cluster' }, mic, send, finish));
    speak(first.target, p);

    async function wrapUp() {
      controls.classList.add('hidden'); err.replaceChildren(h('p', { class: 'muted text-sm' }, t('talk_reviewing')));
      try { const r = await api.post('/api/talk/finish', { id: conv.id, ms: Date.now() - t0 }); err.replaceChildren(); log.append(results(r)); log.lastChild.scrollIntoView({ block: 'nearest' }); }
      catch (e) { controls.classList.remove('hidden'); err.replaceChildren(alertEl(e.message)); }
    }
    const sync = () => { send.disabled = busy; finish.disabled = busy || !log.querySelector('.bubble--me'); };
    send.onclick = async () => {
      const text = input.value.trim(); if (!text || busy) return;
      busy = true; sync(); input.value = ''; err.replaceChildren();
      const mine = bubbleMe(text), wait = h('div', { class: 'muted text-sm' }, t('talk_thinking'));
      log.append(mine, wait);
      try {
        const r = await api.post('/api/talk/turn', { id: conv.id, text });
        wait.remove(); log.append(bubbleAi(r.message)); speak(r.message.target, p);
        if (r.done) { busy = false; return wrapUp(); }
      } catch (e) { wait.remove(); mine.remove(); input.value = text; err.replaceChildren(alertEl(e.message)); }
      busy = false; sync();
    };
    finish.onclick = () => { if (!busy) wrapUp(); };
    sync();
    clear(box).append(log, err, controls);
  }

  function results(r) {
    const list = r.corrections || [];
    return h('div', { class: 'card stack' },
      h('h2', {}, t('talk_summary')), r.summary && h('p', {}, L(r.summary)),
      list.length ? h('div', { class: 'stack' }, list.map((c) => h('div', { class: 'correction' },
        h('div', { class: 'muted text-sm' }, t('talk_said')), h('div', { dir: p.direction, class: 'target correction__said' }, c.said),
        h('div', { class: 'muted text-sm' }, t('talk_better')), h('div', { class: 'cluster' }, targetEl(plain(c.better, p), p, 'lg'), speakBtn(c.better, p, t('speak'))),
        c.explanation && h('p', { class: 'text-sm' }, L(c.explanation)))))
        : h('p', { class: 'muted' }, t('talk_no_corrections')),
      list.length > 0 && h('p', { class: 'muted text-sm' }, t('talk_cards_added', { n: list.filter((c) => c.card_id).length })),
      onFinished && h('div', {}, h('button', { class: 'btn', onclick: onFinished }, t('continue'))));
  }

  startScreen();
  return box;
}

export async function render(root) {
  const p = profile();
  if (!p) { root.append(alertEl(t('nothing_to_study'), null, 'info')); return; }
  const past = h('div', { class: 'stack' });
  root.append(pageHead(t('talk_title'), t('talk_sub')), h('div', { class: 'measure stack-lg' }, talkUI(p), past));
  const { conversations } = await api.get(`/api/talk?profile=${S.active}`);
  const done = conversations.filter((c) => c.finished_at);
  if (!done.length) return;
  past.append(h('h2', {}, t('talk_past')), done.map((c) => h('section', { class: 'card stack' },
    h('div', { class: 'cluster' }, h('strong', { class: 'grow' }, c.topic || ''), h('span', { class: 'muted text-sm' }, c.day)),
    c.summary && h('p', { class: 'text-sm' }, L(c.summary)),
    c.corrections.length > 0 && h('ul', { class: 'bullets' }, c.corrections.map((x) => h('li', {}, h('span', { dir: p.direction, class: 'target' }, x.said), ' → ', targetEl(plain(x.better, p), p), x.explanation && h('div', { class: 'muted text-sm' }, L(x.explanation))))))));
}
