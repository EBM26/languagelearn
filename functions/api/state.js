import { json } from '../_lib/util.js';
export async function onRequestGet({ env }) {
  const profiles = (await env.DB.prepare('SELECT * FROM profiles_state').all()).results;
  const rows = (await env.DB.prepare('SELECT key, value FROM settings').all()).results;
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return json({ profiles, settings });
}
