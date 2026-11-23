import { llmJson } from './llm.js';
import { systemFor, storyPrompt, glossPrompt } from './llm-prompts.js';
import { normalizeStory, applyGloss, norm } from './cards-validate.js';
import { weakSpots, topicStats, labelOf, WEAK_RATE } from './grammar.js';

const WORD_JOIN = `JOIN review_state r ON r.card_id = c.id AND r.direction = c.direction`;

// Words (and the words inside known phrases) the learner has started, normalised for matching.
export async function knownSet(env, code) {
  const rows = (await env.DB.prepare(`SELECT c.target_text FROM cards c ${WORD_JOIN} WHERE c.profile = ? AND c.type IN ('word','phrase')`).bind(code).all()).results;
  const set = new Set();
  for (const r of rows) { set.add(norm(r.target_text)); for (const w of r.target_text.split(/\s+/)) set.add(norm(w)); }
  return set;
}
// Everything in the deck, started or not (so freshly added words show as "in your deck").
async function deckSet(env, code) {
  const rows = (await env.DB.prepare(`SELECT target_text FROM cards WHERE profile = ? AND type IN ('word','phrase')`).bind(code).all()).results;
  return new Set(rows.flatMap((r) => [norm(r.target_text), ...r.target_text.split(/\s+/).map(norm)]));
}
export const recentWords = async (env, code) => (await env.DB.prepare(
  `SELECT c.target_text FROM cards c ${WORD_JOIN} WHERE c.profile = ? AND c.type = 'word' ORDER BY r.last_review DESC LIMIT 120`).bind(code).all()).results.map((r) => r.target_text);
// Preview: the next unintroduced words in queue order.
const previewWords = async (env, code) => (await env.DB.prepare(
  `SELECT c.target_text, c.english FROM cards c LEFT JOIN review_state r ON r.card_id = c.id AND r.direction = c.direction
    WHERE c.profile = ? AND c.type = 'word' AND c.source != 'grammar' AND c.flagged = 0 AND r.card_id IS NULL ORDER BY c.seq, c.id LIMIT 4`).bind(code).all()).results;

async function grammarFocus(env, p) {
  if (!p.grammar_topics?.length) return null;
  const started = (await topicStats(env, p)).filter((s) => s.started);
  if (!started.length) return null;
  const w = (await weakSpots(env, p.code)).find((x) => x.axis !== 'topic' && x.rate >= WEAK_RATE);
  return { topic: labelOf(p, started[started.length - 1].topic), focus: w ? `${w.axis} = ${w.value}` : null };
}

// Two LLM calls: (1) the story, (2) word-level glosses. Returns the fields to persist.
export async function generateStory(env, p, { note = '' } = {}) {
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM stories WHERE profile = ?').bind(p.code).first()).n;
  const words = Math.min(200, 80 + n * 8), format = n % 2 === 0 ? 'story' : 'dialogue';
  const [known, preview, grammar] = await Promise.all([recentWords(env, p.code), previewWords(env, p.code), grammarFocus(env, p)]);
  const system = systemFor(p);
  const story = await llmJson(env, { system, user: storyPrompt(p, { format, words, known, newWords: preview.map((w) => w.target_text), grammar, note }),
    validate: (o) => { const s = normalizeStory(p, o); if (!s) throw new Error('invalid story'); return s; } });
  const sentences = await llmJson(env, { system, user: glossPrompt(p, story.sentences), validate: (o) => applyGloss(p, o, story.sentences) });
  const body = { title: story.title, format, sentences };
  const tokens = sentences.flatMap((s) => s.tokens || []);
  const ks = await knownSet(env, p.code);
  const wc = tokens.length || sentences.reduce((a, s) => a + s.target.split(/\s+/).length, 0);
  const knownPct = tokens.length ? tokens.filter((t) => ks.has(norm(t.b)) || ks.has(norm(t.t))).length / tokens.length : null;
  return { title: story.title.target, body: JSON.stringify(body), format, word_count: wc, known_pct: knownPct,
    new_words: JSON.stringify(preview.map((w) => w.target_text)), grammar_focus: JSON.stringify(grammar) };
}

// Row -> client shape, with live known/new flags on every token.
export async function loadStory(env, row) {
  const body = JSON.parse(row.body), ks = await knownSet(env, row.profile), deck = await deckSet(env, row.profile);
  const fresh = new Set(JSON.parse(row.new_words || '[]').map(norm));
  let total = 0, known = 0;
  for (const s of body.sentences) for (const t of s.tokens || []) {
    t.known = ks.has(norm(t.b)) || ks.has(norm(t.t)); t.is_new = fresh.has(norm(t.b)) || fresh.has(norm(t.t));
    t.in_deck = t.known || deck.has(norm(t.b)) || deck.has(norm(t.t));
    total++; if (t.known) known++;
  }
  return { id: row.id, profile: row.profile, day: row.day, format: row.format, word_count: row.word_count, read_at: row.read_at,
    known_pct: total ? known / total : row.known_pct, title: body.title, sentences: body.sentences, grammar_focus: JSON.parse(row.grammar_focus || 'null') };
}
