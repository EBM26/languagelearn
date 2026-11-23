// All text-to-speech goes through speak(). Swap the body for a better provider later (and cache its audio then).
let voices = [];
const load = () => { voices = speechSynthesis.getVoices(); };
if ('speechSynthesis' in window) { load(); speechSynthesis.addEventListener?.('voiceschanged', load); }

let token = 0;   // bumped by stopSpeaking() so a running sequence knows to stop

function utter(text, profile) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    const prefs = profile?.speech?.tts_voice_pref || [];
    const u = new SpeechSynthesisUtterance(text);
    const voice = prefs.map((p) => voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(p.toLowerCase()))).find(Boolean);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = prefs[prefs.length - 1] || profile?.speech?.whisper_lang || 'en';
    u.onend = u.onerror = () => resolve();
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  });
}
// Public entry point: also interrupts any running sequence.
export function speak(text, profile) { token++; return utter(text, profile); }
export function stopSpeaking() { token++; if ('speechSynthesis' in window) speechSynthesis.cancel(); }

// Speak texts in order; onItem(i) fires before each. Stops early if stopSpeaking() is called.
export async function speakSequence(texts, profile, onItem) {
  const mine = ++token;
  for (let i = 0; i < texts.length; i++) {
    if (mine !== token) return false;
    onItem?.(i); await utter(texts[i], profile);
  }
  return mine === token;
}
