import { json, bad, readBody } from '../_lib/util.js';
import { loadProfile, loadAsset } from '../_lib/profiles.js';

const dflt = (v, d) => (v ?? d);

// GET  ?profile=  -> script-module progress
// POST {profile, action:'init'}  -> idempotently create the module's cards (profile-driven)
// POST {profile, action:'check', score, total} -> record a reading check; complete on pass
export async function onRequestGet({ request, env }) {
  const profile = new URL(request.url).searchParams.get('profile');
  const row = await env.DB.prepare('SELECT * FROM module_progress WHERE profile = ? AND module = ?')
    .bind(profile, 'script').first();
  const counts = (await env.DB.prepare(
    `SELECT c.type, COUNT(*) AS total, SUM(r.card_id IS NOT NULL) AS started
       FROM cards c LEFT JOIN review_state r ON r.card_id = c.id AND r.direction = c.direction
      WHERE c.profile = ? AND c.source IN ('script', 'frequency') AND json_extract(c.tags, '$.module') = 'script'
      GROUP BY c.type`).bind(profile).all()).results;
  return json({ completed_at: row?.completed_at ?? null, data: row ? JSON.parse(row.data) : {}, counts });
}

export async function onRequestPost({ request, env }) {
  const body = await readBody(request);
  const profile = await loadProfile(env, request, body.profile);
  if (!profile) return bad('unknown profile', 404);
  const cfg = profile.script_module;
  if (!cfg?.enabled) return bad('profile has no script module');

  if (body.action === 'init') {
    const data = await loadAsset(env, request, cfg.data);
    if (!data) return bad('missing module data', 500);
    const stmts = buildCards(profile.code, data).map((c) => env.DB.prepare(
      `INSERT OR IGNORE INTO cards (profile, target_text, translit_latin, translit_hebrew, english, hebrew,
         cognate_hint, type, direction, tags, source, example_target, example_en, example_he, seq)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'recognize',?9,?10,?11,?12,?13,?14)`)
      .bind(profile.code, c.target, c.latin, c.he_tr, c.en, c.he, c.cognate ?? null, c.type,
        JSON.stringify({ module: 'script', ...c.tags }), c.source, c.ex ?? null, c.ex_en ?? null, c.ex_he ?? null, c.seq));
    for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
    await env.DB.prepare(`INSERT OR IGNORE INTO module_progress (profile, module, data) VALUES (?, 'script', '{}')`)
      .bind(profile.code).run();
    return json({ ok: true, cards: stmts.length });
  }

  if (body.action === 'check') {
    const { score, total } = body;
    if (!Number.isInteger(score) || !Number.isInteger(total) || total < 1 || score < 0 || score > total)
      return bad('bad score');
    const row = await env.DB.prepare('SELECT * FROM module_progress WHERE profile = ? AND module = ?')
      .bind(profile.code, 'script').first();
    const data = row ? JSON.parse(row.data) : {};
    data.checks = [...dflt(data.checks, []), { at: new Date().toISOString(), score, total }].slice(-20);
    const passed = total >= (cfg.check_words ?? 20) && score / total >= (cfg.pass_threshold ?? 0.9);
    await env.DB.prepare(`INSERT INTO module_progress (profile, module, data, completed_at) VALUES (?1,'script',?2,?3)
        ON CONFLICT(profile, module) DO UPDATE SET data = ?2, completed_at = COALESCE(module_progress.completed_at, ?3)`)
      .bind(profile.code, JSON.stringify(data), passed ? new Date().toISOString() : null).run();
    return json({ passed });
  }
  return bad('unknown action');
}

// Build the module's cards from its data file, in introduction order:
// each group of letters, then their syllables; then words; then phrases.
function buildCards(code, d) {
  const out = []; let seq = 100;
  const byChar = Object.fromEntries(d.letters.map((l) => [l.char, l]));
  for (const group of d.groups) {
    for (const ch of group) {
      const l = byChar[ch];
      out.push({ type: 'letter', source: 'script', seq: seq++, target: l.char, latin: l.sound_latin, he_tr: l.sound_he,
        en: `${l.name_en} — ${l.sound_latin}`, he: `${l.name_he} — ${l.sound_he}`,
        tags: { stage: 'letters' }, ex: l.forms.initial + ' ' + l.forms.medial + ' ' + l.forms.final });
    }
    for (const ch of group) {
      if (['ا'].includes(ch)) continue; // alif carries hamza/long a; taught as a letter only
      const l = byChar[ch];
      const sl = l.sound_latin.split(' / ')[0], sh = l.sound_he.split(' / ')[0];
      d.vowels.forEach((v, i) => out.push({ type: 'syllable', source: 'script', seq: seq++, target: l.char + v,
        latin: sl + d.vowel_names[i], he_tr: sh + d.vowel_he[i], en: sl + d.vowel_names[i], he: sh + d.vowel_he[i],
        tags: { stage: 'syllables' } }));
    }
  }
  seq = 5000;
  for (const w of d.words) out.push({ type: 'word', source: 'frequency', seq: seq++, target: w.text, latin: w.latin,
    he_tr: w.hebrew, en: w.en, he: w.he, cognate: w.cognate || null, tags: { stage: 'words' } });
  seq = 6000;
  for (const p of d.phrases) out.push({ type: 'phrase', source: 'frequency', seq: seq++, target: p.text, latin: p.latin,
    he_tr: p.hebrew, en: p.en, he: p.he, tags: { stage: 'phrases' } });
  return out;
}
