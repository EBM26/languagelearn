import { json, bad } from '../_lib/util.js';
const PAGE = 50;
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), profile = u.searchParams.get('profile');
  if (!profile) return bad('profile required');
  const where = ['profile = ?1'], args = [profile];
  const add = (sql, v) => { args.push(v); where.push(sql.replace('?', `?${args.length}`)); };
  const source = u.searchParams.get('source'), type = u.searchParams.get('type'), q = u.searchParams.get('q');
  if (source) add('source = ?', source);
  if (type) add('type = ?', type);
  if (u.searchParams.get('flagged') === '1') where.push('flagged = 1');
  if (q) { args.push(`%${q}%`); const n = args.length; where.push(`(target_text LIKE ?${n} OR english LIKE ?${n} OR hebrew LIKE ?${n})`); }
  const page = Math.max(0, parseInt(u.searchParams.get('page') || '0', 10) || 0);
  const w = where.join(' AND ');
  const total = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE ${w}`).bind(...args).first()).n;
  const cards = (await env.DB.prepare(`SELECT * FROM cards WHERE ${w} ORDER BY seq, id LIMIT ${PAGE} OFFSET ${page * PAGE}`)
    .bind(...args).all()).results;
  return json({ cards, total, page, page_size: PAGE });
}
