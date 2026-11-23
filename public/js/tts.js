// Text-to-speech. Everything goes through speak(text, profile); the engine behind it is a "provider".
//   browser  speechSynthesis with the best matching system voice (default, free, offline)
//   azure    STUB - see the marked block below
import { S } from './settings.js';

const PROVIDER = 'browser';          // 'browser' | 'azure' (azure is not built yet)
const SLOW_RATE = 0.75;
export const ttsRate = () => (S.settings.tts_slow === 'on' ? SLOW_RATE : 1);

// ---------- playback state (so speaker buttons can flip between play and stop) ----------
let token = 0;                       // bumped on every start/stop so stale playback knows to give up
let playing = null;                  // text currently being spoken, or null
const listeners = new Set();
const setPlaying = (text) => { playing = text; listeners.forEach((f) => f(text)); };
export const onPlayingChange = (f) => { listeners.add(f); return () => listeners.delete(f); };

// ---------- browser provider ----------
const hasSynth = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
let voices = [];
const loadVoices = () => { voices = speechSynthesis.getVoices(); };
// Voices load asynchronously (Chrome fires 'voiceschanged' later; Safari/Firefox may have them at once).
const voicesReady = hasSynth() ? new Promise((resolve) => {
  loadVoices();
  if (voices.length) return resolve();
  const done = () => { loadVoices(); resolve(); };
  speechSynthesis.addEventListener('voiceschanged', done, { once: true });
  setTimeout(done, 2000);            // some browsers never fire it: give up waiting, then check once
}) : Promise.resolve();
if (hasSynth()) speechSynthesis.addEventListener('voiceschanged', loadVoices);

const norm = (l) => String(l || '').toLowerCase().replace('_', '-');
// Profile tts_voice_pref is an ordered list: full locales ("ar-JO") are matched exactly, a bare
// language ("ar") matches any voice of that language.
function pickVoice(profile) {
  const prefs = profile?.speech?.tts_voice_pref || [];
  for (const pref of prefs) {
    const p = norm(pref);
    const hit = voices.find((v) => (p.includes('-') ? norm(v.lang) === p : norm(v.lang) === p || norm(v.lang).startsWith(p + '-')));
    if (hit) return hit;
  }
  return null;
}

const browser = {
  async hasVoice(profile) { await voicesReady; return hasSynth() && !!pickVoice(profile); },
  play(text, profile, rate) {
    return new Promise((resolve) => {
      if (!hasSynth()) return resolve();
      const u = new SpeechSynthesisUtterance(text), v = pickVoice(profile);
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = rate;
      u.onend = u.onerror = () => resolve();
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    });
  },
  stop() { if (hasSynth()) speechSynthesis.cancel(); },
};

// ---------- azure provider: NOT IMPLEMENTED (future) ----------
// Plan: Levantine-accented neural voices (e.g. ar-JO / ar-SY / ar-LB) from Azure Speech, called through a
// Cloudflare Pages Function so the key never reaches the browser:
//   - functions/api/tts.js  POST {text, voice, rate} -> audio/mpeg, key in the AZURE_SPEECH_KEY secret
//     (plus AZURE_SPEECH_REGION in wrangler.toml [vars]); cache responses by hash(text+voice+rate)
//   - here: fetch('/api/tts'), play the blob with an <audio> element, resolve on 'ended', stop() pauses it
//   - hasVoice(): resolves true (the server always has a voice)
const azure = {
  async hasVoice() { return false; },
  async play() { throw new Error('azure TTS provider is not implemented yet'); },
  stop() {},
};

const providers = { browser, azure };
const provider = () => providers[PROVIDER] || browser;

// ---------- public API ----------
// Does this device have a voice for the profile's language? (resolves once voices have loaded)
export const canSpeak = (profile) => provider().hasVoice(profile);

// Tap = play; calling it again for the same text while it plays = stop.
export async function speak(text, profile) {
  if (playing === text) return stopSpeaking();
  const mine = ++token;
  setPlaying(text);
  try { await provider().play(text, profile, ttsRate()); } catch (e) { console.warn('tts:', e.message); }
  if (mine === token) setPlaying(null);
}
export function stopSpeaking() { token++; provider().stop(); if (playing !== null) setPlaying(null); }

// Speak texts in order; onItem(i) fires before each. Stops early if stopSpeaking()/speak() is called.
export async function speakSequence(texts, profile, onItem) {
  const mine = ++token;
  for (let i = 0; i < texts.length; i++) {
    if (mine !== token) return false;
    onItem?.(i); setPlaying(texts[i]);
    try { await provider().play(texts[i], profile, ttsRate()); } catch (e) { console.warn('tts:', e.message); break; }
  }
  if (mine === token) setPlaying(null);
  return mine === token;
}
