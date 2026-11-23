# Language Lab

Personal multi-language learning app. Plain HTML/CSS/JS on Cloudflare Pages + Pages Functions + D1.
Language behavior lives in `public/profiles/*.json`, not in code. Full spec: `language-app-prompt.md`.

**Status: Phase 2** (Phase 1 + LLM adapter, seed-deck generation, "I want to say…", deck editor, daily new-items flow).

## Layout
- `public/` static app (`js/`, `strings/{en,he}.json`, `profiles/`, `data/arabic-alphabet.json`)
- `functions/` Pages Functions (`api/*`, `_lib/fsrs.js`, `_lib/llm.js` stub for Phase 2)
- `migrations/` D1 schema

## LLM setup (Phase 2)
Provider and model are config in `wrangler.toml [vars]` (`LLM_PROVIDER` = `anthropic` | `openai` | `mock`, `LLM_MODEL`).
The key is a secret: `npx wrangler pages secret put LLM_API_KEY --project-name languagelearn`.
For local dev copy `.dev.vars.example` to `.dev.vars` (default `mock` returns canned data, no key needed;
switch to `anthropic` and add a key to test for real). To swap providers, change the vars (or add a branch in `functions/_lib/llm.js`).

## Seed decks
- A profile generates a seed deck only if `seed.enabled` is true in its JSON (on for `ar-lev`; off for `it`/`de` until Phase 7).
- Languages page → "Generate seed deck". It runs ~75 small batches (20 items each) and is resumable: close the tab, press Continue later.
  With `seed.verify: true` each batch gets a second LLM pass that corrects MSA drift.
- Edit or fix the seed at `#/deck`: search/filter, edit any field, delete, unflag, or "Regenerate with AI" for a flagged card.
- To regenerate a whole seed: delete cards with source `frequency` from the Deck page (or in D1:
  `DELETE FROM cards WHERE profile='ar-lev' AND json_extract(tags,'$.seed')=1;`) and run Generate again.

## "I want to say…"
`#/say`: describe a situation in Hebrew or English; the LLM adds 3–8 phrases/words as `personal` cards that come before the frequency list.

## Setup
1. `npm install`
2. Put the real D1 id in `wrangler.toml` (`wrangler d1 list`).
3. Local: `npm run migrate:local && npm run dev` → http://localhost:8788
4. Remote DB: `npm run migrate:remote`

## Deploy
1. `npx wrangler pages project create languagelearn --production-branch main` (once)
2. `npm run deploy`. The `DB` binding comes from `wrangler.toml`; if the dashboard shows none, add
   Settings → Bindings → D1 → `DB` → `language-app-db`.
3. **Cloudflare Access** (dashboard, not code): Zero Trust → Access → Applications → Add self-hosted →
   domain `languagelearn.pages.dev` (also cover `*.languagelearn.pages.dev` preview URLs) → policy: Allow, emails = yours.
   No secrets are needed in Phase 1.

## Using Phase 1
Open the app → Study → "Load starting cards" (if empty) (creates 143 Arabic cards: 28 letters, 81 syllables, 29 words, 5 phrases).
Alphabet page: letters with all four forms, marks, a trace/write canvas, and the reading check
(20 words, ≥90% completes the module and turns transliteration off).

## Adding or activating a language profile
- Activate: Home → Manage languages → Activate (Phase 1 only flips the flag; seed generation is Phase 2).
- New language: add `public/profiles/<code>.json` (copy `it.json`) and add the code to `public/profiles/index.json`. No code changes.
- A profile with `script_module.enabled` points to a data file like `public/data/arabic-alphabet.json`.

## Arabic transliteration schemes
**Latin:** `aa ii uu` long vowels; `H` ح, `kh` خ, `gh` غ, `'` ع and ء, `q` ق, `j` ج, `sh` ش, `th` ث, `dh` ذ;
capitals mark emphatics (`S` ص, `D` ض, `T` ط, `Z` ظ); `w y`. Doubled consonant = shadda.
**Hebrew letters:** standard Israeli convention with geresh: ג' = ج, ח' = خ, ע' = غ, ד' = ذ, ת' = ث, צ' = ض, ט' = ظ.

## Notes
- Scheduling is FSRS-4.5 with default parameters (`functions/_lib/fsrs.js`), run on the server. No same-day learning steps:
  "Again" is due in 10 minutes and the review screen re-queues it in-session.
- Dates use the browser's timezone (`X-TZ` header).
