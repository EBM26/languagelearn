import { json, bad } from '../_lib/util.js';
export async function onRequestGet({ request, env }) {
  const profile = new URL(request.url).searchParams.get('profile');
  if (!profile) return bad('profile required');
  const rows = (await env.DB.prepare('SELECT id, day, title, body, format, word_count, known_pct, read_at FROM stories WHERE profile = ? ORDER BY day DESC, id DESC LIMIT 100')
    .bind(profile).all()).results;
  return json({ stories: rows.map((r) => ({ id: r.id, day: r.day, format: r.format, word_count: r.word_count, known_pct: r.known_pct, read_at: r.read_at, title: JSON.parse(r.body).title })) });
}
