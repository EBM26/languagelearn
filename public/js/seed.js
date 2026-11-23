import { api } from './api.js';
// Drives the resumable seed-generation loop. onProgress({generated,target}) after each batch.
export async function runSeed(code, onProgress, shouldStop = () => false) {
  let stalls = 0;
  for (;;) {
    const r = await api.post('/api/seed/step', { profile: code });
    onProgress(r);
    if (r.done) return r;
    stalls = r.inserted ? 0 : stalls + 1;
    if (stalls >= 3) throw new Error('stalled');
    if (shouldStop()) return r;
  }
}
