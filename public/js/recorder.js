// Voice input: MediaRecorder -> /api/transcribe (Workers AI Whisper). Works on iOS too, unlike Web Speech recognition.
// Every caller must keep a typed fallback; micButton() returns null when the browser can't record at all.
import { h } from './dom.js';
import { t } from './i18n.js';

export const canRecord = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
const MAX_MS = 60000;

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported?.(m));
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined), chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((resolve) => { rec.onstop = () => { stream.getTracks().forEach((x) => x.stop()); resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); }; });
  rec.start();
  const timer = setTimeout(() => rec.state === 'recording' && rec.stop(), MAX_MS);
  return { stop: () => { clearTimeout(timer); if (rec.state === 'recording') rec.stop(); return done; } };
}

export async function transcribe(blob, code) {
  const res = await fetch(`/api/transcribe?profile=${encodeURIComponent(code)}`, { method: 'POST', headers: { 'content-type': blob.type }, body: blob });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data.text || '';
}

// A record / stop button. onText(text) gets the transcript; onError(message) is called on any failure.
export function micButton(p, { onText, onError, onState }) {
  if (!canRecord()) return null;
  let session = null, busy = false;
  const btn = h('button', { type: 'button', class: 'btn btn--secondary mic' }, '🎤 ' + t('mic_record'));
  const set = (state, label) => { btn.textContent = label; btn.classList.toggle('mic--on', state === 'recording'); btn.disabled = state === 'busy'; onState?.(state); };
  btn.onclick = async () => {
    if (busy) return;
    if (!session) {
      try { session = await startRecording(); set('recording', '⏹ ' + t('mic_stop')); }
      catch { onError?.(t('mic_denied')); session = null; }
      return;
    }
    busy = true; const s = session; session = null; set('busy', t('mic_transcribing'));
    try { onText?.(await transcribe(await s.stop(), p.code)); }
    catch (e) { onError?.(`${t('mic_failed')} (${e.message})`); }
    busy = false; set('idle', '🎤 ' + t('mic_record'));
  };
  return btn;
}
