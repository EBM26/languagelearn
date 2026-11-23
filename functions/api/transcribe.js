import { json, bad } from '../_lib/util.js';
import { loadProfile } from '../_lib/profiles.js';

const MAX_BYTES = 4 * 1024 * 1024;
const MODEL = '@cf/openai/whisper-large-v3-turbo';

// POST ?profile=  body = raw audio (MediaRecorder blob: webm/opus on Chrome, mp4 on iOS) -> {text}
// Uses Workers AI Whisper with the profile's language code. The client falls back to typing on any error.
export async function onRequestPost({ request, env }) {
  if (!env.AI) return bad('speech-to-text is not configured (missing Workers AI binding)', 501);
  const p = await loadProfile(env, request, new URL(request.url).searchParams.get('profile'));
  if (!p) return bad('unknown profile', 404);
  const buf = await request.arrayBuffer();
  if (!buf.byteLength) return bad('empty recording');
  if (buf.byteLength > MAX_BYTES) return bad('recording too long', 413);
  const bytes = new Uint8Array(buf);
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  try {
    const out = await env.AI.run(MODEL, { audio: btoa(bin), language: p.speech?.whisper_lang || undefined });
    return json({ text: String(out?.text || '').trim() });
  } catch (e) { return bad(`transcription failed: ${e.message}`, 502); }
}
