import { llmJson } from './llm.js';
import { systemFor, grammarPrompt, referencePrompt } from './llm-prompts.js';
import { normalizeDrill, normalizeTable } from './cards-validate.js';
import { insertCards } from './cards.js';

export const UNLOCK_RATE = 0.7, UNLOCK_MIN_REVIEWS = 15, WEAK_MIN_REVIEWS = 5, WEAK_RATE = 0.25;
export const labelOf = (p, slug, lang = 'en') => p.grammar_topic_labels?.[slug]?.[lang] ?? slug.replace(/-/g, ' ');

// Per-topic: card count, recent review count, share of Good/Easy among the last 60 reviews.
export async function topicStats(env, p) {
  const topics = p.grammar_topics || [];
  const counts = (await env.DB.prepare(
    `SELECT json_extract(tags,'$.topic') AS topic, COUNT(*) AS n FROM cards WHERE profile = ? AND source = 'grammar' GROUP BY topic`)
    .bind(p.code).all()).results;
  const logs = (await env.DB.prepare(
    `SELECT c.tags, l.grade FROM review_log l JOIN cards c ON c.id = l.card_id
      WHERE l.profile = ? AND c.source = 'grammar' ORDER BY l.reviewed_at DESC, l.id DESC LIMIT 1500`).bind(p.code).all()).results;
  const per = {};
  for (const r of logs) {
    const tp = JSON.parse(r.tags).topic; (per[tp] ||= []);
    if (per[tp].length < 60) per[tp].push(r.grade);
  }
  return topics.map((topic, index) => {
    const g = per[topic] || [], count = counts.find((c) => c.topic === topic)?.n ?? 0;
    return { topic, index, count, reviews: g.length, good_rate: g.length ? g.filter((x) => x >= 3).length / g.length : null,
      started: count > 0, unlocked: g.length >= UNLOCK_MIN_REVIEWS && g.filter((x) => x >= 3).length / g.length >= UNLOCK_RATE };
  });
}

// Recency-weighted miss rate per axis value (Again = 1, Hard = 0.5). Half-life 30 days.
export async function weakSpots(env, code) {
  const logs = (await env.DB.prepare(
    `SELECT c.tags, l.grade, l.reviewed_at FROM review_log l JOIN cards c ON c.id = l.card_id
      WHERE l.profile = ? AND c.source = 'grammar' ORDER BY l.reviewed_at DESC LIMIT 1500`).bind(code).all()).results;
  const acc = {}, now = Date.now();
  for (const r of logs) {
    const w = Math.pow(0.5, (now - new Date(r.reviewed_at)) / 86400000 / 30);
    const miss = r.grade === 1 ? 1 : r.grade === 2 ? 0.5 : 0;
    for (const [axis, value] of Object.entries(JSON.parse(r.tags))) {
      if (axis === 'focus') continue;
      const a = (acc[`${axis}:${value}`] ||= { axis, value, n: 0, w: 0, m: 0 });
      a.n++; a.w += w; a.m += w * miss;
    }
  }
  return Object.values(acc).filter((a) => a.n >= WEAK_MIN_REVIEWS)
    .map((a) => ({ axis: a.axis, value: a.value, n: a.n, rate: a.m / a.w })).sort((x, y) => y.rate - x.rate);
}

const knownVocab = async (env, code) => (await env.DB.prepare(
  `SELECT c.target_text FROM cards c JOIN review_state r ON r.card_id = c.id AND r.direction = c.direction
    WHERE c.profile = ? AND c.type = 'word' ORDER BY r.last_review DESC LIMIT 60`).bind(code).all()).results.map((r) => r.target_text);

export async function genDrills(env, p, topic, { focus = null, n = 20 } = {}) {
  const idx = Math.max(0, (p.grammar_topics || []).indexOf(topic));
  const existing = (await env.DB.prepare(
    `SELECT english FROM cards WHERE profile = ? AND source = 'grammar' AND json_extract(tags,'$.topic') = ? ORDER BY id DESC LIMIT 40`)
    .bind(p.code, topic).all()).results.map((r) => r.english);
  const base = existing.length;
  const items = await llmJson(env, { system: systemFor(p),
    user: grammarPrompt(p, labelOf(p, topic), focus, n, await knownVocab(env, p.code), existing),
    validate: (o) => { if (!Array.isArray(o.items)) throw new Error('bad shape'); return o.items; } });
  const drills = items.map((x) => normalizeDrill(p, x, topic, focus ? { focus: `${focus.axis}:${focus.value}` } : {})).filter(Boolean);
  return insertCards(env, p.code, drills, { source: 'grammar', seqOf: (i) => 8000 + idx * 100 + base + i });
}

export async function genTables(env, p, topic) {
  const tables = await llmJson(env, { system: systemFor(p), user: referencePrompt(p, labelOf(p, topic)),
    validate: (o) => { const t = (o.tables || []).map((x) => normalizeTable(p, x)).filter(Boolean); if (!t.length) throw new Error('no valid tables'); return t; } });
  await env.DB.prepare('DELETE FROM reference_tables WHERE profile = ? AND topic = ?').bind(p.code, topic).run();
  await env.DB.batch(tables.map((t) => env.DB.prepare('INSERT INTO reference_tables (profile, topic, title, data) VALUES (?1,?2,?3,?4)')
    .bind(p.code, topic, JSON.stringify(t.title), JSON.stringify(t.data))));
  return tables.length;
}

// Start a topic: drills (essential) + reference tables (best effort; can be generated later).
export async function startTopic(env, p, topic) {
  const have = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM cards WHERE profile = ? AND source = 'grammar' AND json_extract(tags,'$.topic') = ?`)
    .bind(p.code, topic).first()).n;
  if (have) return { existing: true };
  const drills = await genDrills(env, p, topic, { n: 20 });
  if (!drills) throw new Error('no usable drills were generated');
  let tables = 0, tableError = null;
  try { tables = await genTables(env, p, topic); } catch (e) { tableError = e.message; }
  return { drills, tables, tableError };
}
