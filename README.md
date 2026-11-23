# Language Lab

Personal multi-language learning app. Plain HTML/CSS/JS on Cloudflare Pages + Pages Functions + D1.
Language behavior lives in `public/profiles/*.json`, not in code. Full spec: `language-app-prompt.md`.

**Status: Phase 3** (Phases 1–2 + grammar drills, reference page, weak-spot tracking).

## Layout
- `public/` static app (`js/`, `strings/{en,he}.json`, `profiles/`, `data/arabic-alphabet.json`)
- `functions/` Pages Functions (`api/*`, `_lib/fsrs.js`, `_lib/llm.js` stub for Phase 2)
- `migrations/` D1 schema

## LLM setup
Provider and models are config in `wrangler.toml [vars]`:
`LLM_PROVIDER = "gemini"`, `LLM_MODEL = "gemini-2.5-flash"` (tried first) and `LLM_FALLBACK_MODEL = "gemini-2.5-flash-lite"`.
If the primary model returns 429, a 5xx, a network error or an empty reply, the adapter retries once with the fallback model
(auth/bad-request errors are not retried). Check the model IDs against Google's current model list if Google renames them.
The API key is a secret and is **never committed**: set `LLM_API_KEY` in the Cloudflare dashboard (see Deploy).
Local dev: copy `.dev.vars.example` to `.dev.vars` and put your Gemini key in it
(`LLM_PROVIDER=mock` gives canned data with no key). Other providers (`anthropic`, `openai`) are still available via the same vars.

## Seed decks
- A profile generates a seed deck only if `seed.enabled` is true in its JSON (on for `ar-lev`; off for `it`/`de` until Phase 7).
- Languages page → "Generate seed deck". It runs ~75 small batches (20 items each) and is resumable: close the tab, press Continue later.
  With `seed.verify: true` each batch gets a second LLM pass that corrects MSA drift.
- Edit or fix the seed at `#/deck`: search/filter, edit any field, delete, unflag, or "Regenerate with AI" for a flagged card.
- To regenerate a whole seed: delete cards with source `frequency` from the Deck page (or in D1:
  `DELETE FROM cards WHERE profile='ar-lev' AND json_extract(tags,'$.seed')=1;`) and run Generate again.

## Grammar (Phase 3)
- Topics come from the profile's `grammar_topics` (labels in `grammar_topic_labels`, he/en). Starting a topic generates ~20 production
  drills (prompt states the axes: "she wrote" → answer) plus its reference tables. Drills are tagged with the profile's `grammar_axes`
  and are `source = grammar`; they enter only through the daily grammar step, never the new-items queue.
- **Unlock rule:** the next topic starts automatically when the current one reaches ≥70% Good/Easy over its last 60 reviews
  (min. 15 reviews). You can also start it yourself on `#/reference`.
- **Weak spots:** recency-weighted miss rate per axis value (Again = 1, Hard = 0.5, half-life 30 days, min. 5 reviews). The daily
  grammar step drills the weakest value (≥25% missed) with fresh targeted cards, otherwise continues the current topic.
- **Reference page** (`#/reference`): tables for the topics you've started, plus weak spots. "Report / regenerate" rewrites a table
  using your note. New profiles get this for free from their JSON; add `grammar_topic_labels` for readable topic names.
- Tuning constants are at the top of `functions/_lib/grammar.js`.
- Remember `npm run migrate:remote` after pushing (migration 0003).

## "I want to say…"
`#/say`: describe a situation in Hebrew or English; the LLM adds 3–8 phrases/words as `personal` cards that come before the frequency list.

## Local development
1. `npm install`
2. `cp .dev.vars.example .dev.vars` and add your Gemini key.
3. `npm run migrate:local && npm run dev` → http://localhost:8788

## Deploy (GitHub push)
Production deploys on every push to `main` through Cloudflare Pages' Git integration. `wrangler.toml` is the source of truth
for the D1 binding and the `[vars]`; the dashboard only holds the secret.
1. **One-time:** Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick this repo.
   Production branch `main`, build command: *(empty)*, build output directory: `public`. Functions in `/functions` are detected automatically.
2. **One-time secret:** Pages project → Settings → Variables and Secrets → add `LLM_API_KEY` (type *Secret*) for Production
   (and Preview, if you use preview deployments).
3. **Database migrations are not run by a push.** After pushing a commit that adds a file to `migrations/`, run
   `npm run migrate:remote` (applies pending migrations to `language-app-db`). Run it before relying on the new code.
4. **Cloudflare Access** (dashboard, not code): Zero Trust → Access → Applications → Add self-hosted → domain
   `<project>.pages.dev` (also `*.<project>.pages.dev` for previews) → policy: Allow, your email.
5. Deploy = `git push origin main`; watch the build under the project's Deployments tab.

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
