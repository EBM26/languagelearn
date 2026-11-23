import { h, clear } from './dom.js';
import { t, getLang } from './i18n.js';
import { S, translitMode } from './settings.js';
import { api } from './api.js';
import { plain, targetEl, speakBtn } from './card.js';
import { speakSequence, stopSpeaking } from './tts.js';
import { icon, toggle, badge, alertEl } from './ui.js';

const lang = (o) => (getLang() === 'he' ? o.he : o.en);

// Interactive reader: tap a word for its meaning (+ add to deck), listen per sentence or to the whole text.
export function storyReader(story, p) {
  let showTrans = false, openWord = null, playingFrom = null;
  const root = h('div', { class: 'reader' });
  const sheetSlot = h('div', {});
  const mode = translitMode(p);

  const sentenceEls = story.sentences.map((s, si) => {
    const tokens = s.tokens
      ? s.tokens.map((tk, ti) => {
        const cls = 'word' + (tk.is_new ? ' word--new' : !tk.in_deck ? ' word--unknown' : '');
        const btn = h('button', { type: 'button', class: cls, onclick: () => showWord(si, ti, btn) }, plain(tk.t, p));
        return [btn, ' '];
      })
      : [plain(s.target, p)];
    const translit = mode === 'latin' ? s.latin : mode === 'hebrew' ? s.hebrew : null;
    const trans = h('div', { class: 'sentence__trans hidden' }, lang(s));
    const el = h('div', { class: 'sentence' },
      s.speaker && h('div', { class: 'sentence__speaker' }, s.speaker),
      h('div', { class: 'sentence__main' },
        speakBtn(s.target, p, t('speak'), { before: stop }),
        h('div', { class: 'sentence__text', dir: p.direction, lang: p.speech?.whisper_lang || '' }, tokens)),
      translit && h('div', { class: 'sentence__translit' }, translit), trans);
    el._trans = trans;
    return el;
  });

  function stop() { stopSpeaking(); playingFrom = null; sentenceEls.forEach((e) => e.classList.remove('playing')); playBtn.textContent = t('play_all'); }
  const playBtn = h('button', { type: 'button', class: 'btn btn--sm', onclick: async () => {
    if (playingFrom !== null) return stop();
    playingFrom = 0; playBtn.textContent = t('stop');
    const finished = await speakSequence(story.sentences.map((s) => s.target), p, (i) => {
      sentenceEls.forEach((e, k) => e.classList.toggle('playing', k === i)); sentenceEls[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
    if (finished) stop();
  } }, t('play_all'));

  function showWord(si, ti, btn) {
    root.querySelectorAll('.word.on').forEach((x) => x.classList.remove('on')); btn.classList.add('on');
    const tk = story.sentences[si].tokens[ti];
    const tr = mode === 'latin' ? tk.latin : mode === 'hebrew' ? tk.hebrew : null;
    const status = h('span', {});
    const add = h('button', { class: 'btn btn--sm', onclick: async () => {
      add.disabled = true;
      try { await api.post(`/api/stories/${story.id}/add-word`, { sentence: si, token: ti });
        tk.in_deck = true; markDeck(tk); add.replaceWith(badge(t('word_added'), 'success')); }
      catch (e) { add.disabled = false; status.replaceChildren(alertEl(e.message)); } } }, t('word_add'));
    clear(sheetSlot).append(h('div', { class: 'sheet', role: 'dialog' },
      h('div', { class: 'sheet__head' }, targetEl(plain(tk.b, p), p, 'lg'), h('span', { class: 'grow' }),
        speakBtn(tk.b, p, t('speak')),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('close'), onclick: closeSheet }, icon('close'))),
      tr && h('div', { class: 'muted' }, tr), h('div', { class: 'prompt-main' }, lang(tk)),
      plain(tk.b, p) !== plain(tk.t, p) && h('div', { class: 'muted text-sm' }, `${t('base_form')}: ${plain(tk.b, p)}`),
      tk.in_deck ? badge(t('word_in_deck'), 'success') : add, status));
    openWord = btn;
  }
  const closeSheet = () => { clear(sheetSlot); root.querySelectorAll('.word.on').forEach((x) => x.classList.remove('on')); openWord = null; };
  // After adding a word, every occurrence stops looking unknown.
  function markDeck(tk) {
    story.sentences.forEach((s, si) => (s.tokens || []).forEach((k, ti) => {
      if (k.b === tk.b) { k.in_deck = true; sentenceEls[si].querySelectorAll('.word')[ti]?.classList.remove('word--unknown'); } }));
  }

  root.append(
    h('div', { class: 'reader__bar' }, playBtn,
      toggle({ checked: false, label: t('show_translation'), onChange: (on) => { showTrans = on; sentenceEls.forEach((e) => e._trans.classList.toggle('hidden', !on)); } }),
      h('span', { class: 'muted text-sm' }, t('tap_hint'))),
    h('div', { class: 'card' }, h('div', { class: 'stack' }, ...sentenceEls)), sheetSlot);
  root.dispose = () => { stopSpeaking(); };
  return root;
}

export function storyMeta(story) {
  return h('div', { class: 'cluster cluster--tight' },
    badge(t(story.format === 'dialogue' ? 'format_dialogue' : 'format_story'), 'info'),
    badge(t('words_count', { n: story.word_count })),
    story.known_pct != null && badge(t('known_pct', { pct: Math.round(story.known_pct * 100) }), 'success'),
    story.read_at && badge(t('read_badge'), 'success'));
}
