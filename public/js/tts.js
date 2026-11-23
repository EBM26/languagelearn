// All text-to-speech goes through speak(). Swap the body for a better provider later.
let voices = [];
const load = () => { voices = speechSynthesis.getVoices(); };
if ('speechSynthesis' in window) { load(); speechSynthesis.addEventListener?.('voiceschanged', load); }

export function speak(text, profile) {
  if (!('speechSynthesis' in window)) return;
  const prefs = profile?.speech?.tts_voice_pref || [];
  const u = new SpeechSynthesisUtterance(text);
  const voice = prefs.map((p) => voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(p.toLowerCase()))).find(Boolean);
  if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = prefs[prefs.length - 1] || profile?.speech?.whisper_lang || 'en';
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
