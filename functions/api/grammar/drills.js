import { json, bad, readBody } from '../../_lib/util.js';
import { loadProfile } from '../../_lib/profiles.js';
import { topicStats, weakSpots, genDrills, startTopic, WEAK_RATE } from '../../_lib/grammar.js';

const N = 8;
const unreviewed = async (env, code) => (await env.DB.prepare(
  `SELECT c.*, c.direction AS dir FROM cards c LEFT JOIN review_state r ON r.card_id = c.id AND r.direction = c.direction
    WHERE c.profile = ? AND c.source = 'grammar' AND c.flagged = 0 AND r.card_id IS NULL ORDER BY c.seq, c.id`).bind(code).all()).results;
const hasTag = (c, f) => JSON.parse(c.tags)[f.axis] === f.value;

// The daily grammar step: aim at the weakest tag, else continue the current topic, else unlock the next.
export async function onRequestPost({ request, env }) {
  const { profile: code } = await readBody(request);
  const p = await loadProfile(env, request, code);
  if (!p?.grammar_topics?.length) return bad('no grammar topics for this profile', 404);
  const st = await env.DB.prepare('SELECT active FROM profiles_state WHERE profile = ?').bind(code).first();
  if (!st?.active) return bad('profile is not active');
  try {
    let stats = await topicStats(env, p);
    if (!stats.some((t) => t.started)) { await startTopic(env, p, stats[0].topic); stats = await topicStats(env, p); }
    const started = stats.filter((t) => t.started);
    const focus = (await weakSpots(env, code)).find((w) => w.axis !== 'topic' && w.rate >= WEAK_RATE) || null;

    let pool = await unreviewed(env, code);
    if (focus && pool.filter((c) => hasTag(c, focus)).length < 5)
      { await genDrills(env, p, started[started.length - 1].topic, { focus, n: 6 }); pool = await unreviewed(env, code); }
    if (pool.length < N) {                         // current topic exhausted: unlock the next one if earned
      const last = started[started.length - 1], next = stats.find((t) => !t.started);
      if (next && last.unlocked) { await startTopic(env, p, next.topic); pool = await unreviewed(env, code); }
    }
    const ordered = focus ? [...pool.filter((c) => hasTag(c, focus)), ...pool.filter((c) => !hasTag(c, focus))] : pool;
    return json({ cards: ordered.slice(0, N), focus: focus ? { axis: focus.axis, value: focus.value, rate: focus.rate } : null });
  } catch (e) { return bad(e.message, 502); }
}
