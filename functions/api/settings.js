import { json, bad, readBody } from '../_lib/util.js';
const ALLOWED = { ui_lang: ['he', 'en'], translit: ['auto', 'latin', 'hebrew', 'off'],
  diacritics: ['on', 'off'], tts_slow: ['on', 'off'], active_profile: null };
export async function onRequestPut({ request, env }) {
  const { key, value } = await readBody(request);
  if (!(key in ALLOWED)) return bad('unknown setting');
  if (ALLOWED[key] && !ALLOWED[key].includes(value)) return bad('bad value');
  if (typeof value !== 'string') return bad('bad value');
  await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2')
    .bind(key, value).run();
  return json({ ok: true });
}
