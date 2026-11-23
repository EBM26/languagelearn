# Build: Personal Multi-Language Learning App

## Goal
A personal, single-user web app that teaches me languages to conversational fluency through a ~25-minute daily session per language. It supports multiple languages through **language profiles**:

- **Arabic (Levantine/Palestinian):** active from day one. I have some prior classes and once knew the alphabet but have mostly forgotten it, so reading/writing must be refreshed first.
- **Italian:** profile defined now, inactive until I turn it on.
- **German:** profile defined now, inactive until I turn it on.

Build everything language-agnostic. Language-specific behavior lives in profile config, not in code branches. Adding a fourth language later should mean writing a new profile, not changing the app.

The app is built on these learning principles. Every feature should serve at least one:
- Spaced repetition (review items just before they're forgotten)
- Retrieval over recognition (default card direction: my language → target language, produce from memory)
- High-frequency vocabulary first
- Comprehensible input (stories/dialogues mostly in known words, a few new ones)
- Speaking practice with correction, where mistakes become new review cards
- Daily consistency (streak, short sessions)

## Stack and conventions
- Plain HTML/CSS/JS, no frameworks. Small vendored libraries are OK if justified (e.g. an FSRS implementation).
- Cloudflare Pages + Pages Functions + D1. Workers AI where noted.
- Protect the whole app with Cloudflare Access (single user, my email). No custom auth.
- LLM calls only from Functions; API keys in Cloudflare secrets. Write one small LLM adapter (`/functions/_lib/llm.js`) so the provider can be swapped by changing config.
- White background. Mobile-first: I'll mostly use this on my phone.
- Fonts: a good Arabic web font (e.g. Noto Naskh Arabic from Google Fonts) for Arabic, large size, `dir="rtl"` on Arabic elements. Font and direction come from the profile.

### Header controls
- **Language switcher:** pick the active learning language (only activated profiles appear). Each language has its own deck, stats, streak and session.
- **Interface language toggle (Hebrew / English):** a global setting that controls:
  - Interface language (all UI text in a simple strings file, `he` and `en`)
  - Translation language on cards, stories, and tap-to-translate
  - Language of grammar explanations and speaking-practice corrections
  - Hebrew mode is RTL for the whole page; English mode is LTR. Target-language elements always use the profile's own direction.
  - Production cards prompt in the chosen language ("היא כתבה" → produce the target language)
- **Transliteration toggle** (only for profiles with a non-Latin script): Hebrew letters or Latin, defaulting to match the interface language; hideable entirely.
- **Diacritics toggle** (only for profiles that use them, i.e. Arabic): show/hide harakat.

## Language profiles
Store profiles as config files (`/profiles/ar-lev.json`, `it.json`, `de.json`) plus an `active` flag and start date in D1. A profile defines:
- code, display names (he/en), direction (rtl/ltr), font, script
- dialect/variety rules injected into every LLM system prompt
- whether it has a script module (alphabet) and its contents
- whether it uses transliteration and diacritics
- pronoun set and grammar axes for tagging (person, gender, number, tense, case…)
- grammar topic list in learning order
- cognate hint type (Hebrew, English, or none)
- speech settings: Whisper language code, TTS voice preference
- seed deck source/instructions

Activating a profile triggers its seed-deck generation. Inactive profiles cost nothing: no seed generation, no LLM calls.

### Profile: Arabic, Levantine/Palestinian (`ar-lev`, active)
- Target: Levantine, Palestinian flavor. Not Modern Standard Arabic. Every LLM system prompt says so and says to avoid MSA forms when a dialect form exists.
- Pronouns: ana, inta, inti, huwwe, hiyye, ihna, intu, humme (no dual).
- Levantine has no fixed spelling. Write dialect in Arabic script with diacritics, spelled consistently by the app (store the canonical spelling with each card).
- Transliteration in two schemes: Latin (consistent scheme, documented in README) and Hebrew letters using the standard Israeli convention with geresh for letters Hebrew lacks: ג' = ج, ח' = خ, ע' = غ, ד' = ذ, ת' = ث, צ' = ض, ט' = ظ.
- Cognate hints: Hebrew (e.g. كتب / כתב, بيت / בית). Never invent a cognate: leave the field empty when unsure.
- Script module: yes (see Alphabet module).
- Grammar topics: subject pronouns; attached possessive/object suffixes ("my book", "I saw him"); past tense; present with b- prefix; imperative; future (rah/ha-); negation; gender/number agreement; ~50 most common verbs first.
- TTS: browser Arabic voices are MSA-accented. Accept this for now; keep TTS swappable.

### Profile: Italian (`it`, inactive)
- Standard Italian.
- No transliteration, no script module. Instead a short **pronunciation module**: letter combinations (c/ch/ci, g/gh/gi, gli, gn, sc), double consonants, stress.
- Pronouns: io, tu, lui, lei, Lei (formal), noi, voi, loro.
- Grammar topics: noun gender and plurals; definite/indefinite articles; present tense (-are/-ere/-ire) and key irregulars (essere, avere, fare, andare, volere, potere, dovere); passato prossimo with avere vs essere; reflexive verbs; imperfetto; future; object pronouns; prepositions with articles (del, nella…).
- Cognate hints: English (Latin roots), and note false friends explicitly.
- TTS: browser Italian voices are good.

### Profile: German (`de`, inactive)
- Standard German (Hochdeutsch).
- No transliteration, no script module. Instead a short **pronunciation module**: umlauts, ß, ch, ei/ie, eu/äu, final devoicing, z/s/w/v.
- Pronouns: ich, du, er, sie, es, wir, ihr, sie, Sie (formal).
- Grammar topics: noun gender (always learn nouns with der/die/das, color-code by gender) and plurals; cases: nominative, accusative, dative, genitive last; article and adjective endings; present tense and key irregulars (sein, haben, werden, modal verbs); word order (verb second, verb-final in subordinate clauses); separable verbs; Perfekt with haben vs sein; Präteritum of common verbs; two-way prepositions.
- Grammar tags include case, so weak-spot tracking can say "you keep missing dative".
- Cognate hints: English, and note false friends explicitly.
- TTS: browser German voices are good.

## Shared card model
Card fields: profile, target_text, translit_latin (nullable), translit_hebrew (nullable), english, hebrew, cognate_hint (nullable), audio, type, tags (JSON of grammar axes), source (frequency / personal / mistake / grammar), example sentence with English and Hebrew translations. Generate all fields at card creation so toggling languages never needs a new LLM call.

Every card has a "report problem" button that flags it for review/regeneration, since LLM-generated content will sometimes be wrong (especially Levantine drifting into MSA).

## Modules (shared across profiles, driven by profile config)

### 1. Script or pronunciation module
**Arabic alphabet refresh (first ~2–3 weeks, then fades out):**
- 28 letters, each in its forms: isolated, initial, medial, final. Then short vowels/harakat, sukun, shadda, taa marbuta, hamza basics, alif variants, and which letters don't connect to the left.
- Progression: letter recognition → letter-to-sound → syllables → reading real high-frequency words → reading short phrases.
- Writing: an on-screen canvas to trace and then write letters/words from memory. Self-check against the model (overlay toggle). Optional: send the canvas image to a vision-capable LLM for feedback.
- Letters and syllables are spaced-repetition cards like everything else.
- Mark complete when I pass a reading check (e.g. read 20 random words, ≥90% correct). Then default transliteration to off.

**Italian/German pronunciation modules:** a short sequence of listen-and-repeat items and reading drills from the profile's list, recorded through the speaking pipeline for feedback. Complete after a reading-aloud check.

### 2. Vocabulary and phrases
- Seed deck per profile from a frequency-ordered word/phrase list. On activation, generate the initial ~1,500 items via the LLM in batches, store them in D1, and let me review/edit the seed.
- **"I want to say…" list (per profile):** I type situations or sentences in Hebrew or English (e.g. "ordering at a falafel stand", "telling a client the site is delayed"). The LLM breaks each into 3–8 learnable phrases and key words and adds them to the queue, prioritized ahead of the frequency list.

### 3. Grammar
- Topics come from the profile's grammar list, in order.
- Drills are generated as cards: given a prompt with the grammar axes explicit (e.g. "she wrote", "you (f) want", "with the (dat.) man"), produce the target language. Tag each card with its axes so the app can show weak spots.
- A per-language reference page with tables for everything learned (conjugations, pronouns, articles/case endings).

### 4. Daily story (comprehensible input)
- Each day the LLM generates a short story or dialogue (80–200 words at first) using mostly known words, 3–5 new ones, and the day's grammar focus.
- Tap any word for translation (and transliteration where relevant) and to add it as a card.
- Audio playback of the whole text and of individual sentences.
- Store stories so I can reread them.

### 5. Speaking practice
- A short voice conversation (5–10 turns) with an AI partner on the day's topic, at my level, in the profile's language/variety.
- Speech-to-text: record with MediaRecorder and transcribe via Workers AI Whisper using the profile's language code (works on iOS too, unlike Web Speech recognition). Fall back to typing.
- After each of my turns: the AI replies in character. After the conversation: a correction summary (what I said → better version, with a short explanation in my interface language). Each correction becomes a review card with source = mistake.
- Text-to-speech: browser `speechSynthesis` with the profile's voice preference, behind one function so a better provider can be swapped in later. Cache generated audio in D1/R2 where possible.

## Daily session flow (per active language)
One "Start today" button runs, in order:
1. Reviews due today (cap ~10 min; carry over the rest)
2. New items (5–10/day, adjustable per profile; script/pronunciation items while that module is active)
3. Grammar drill focused on my weakest tag
4. Daily story
5. Speaking practice

Show a progress bar through the session. Any step can be skipped. If more than one language is active, the home screen shows each language's session status for today.

Stats page per language: streak, minutes per day, total items learned, retention rate, weakest grammar areas.

Once a week, show a nudge: "Talk to a real person this week" with a checkbox to log it, per active language. The app is not a replacement for human conversation.

## Spaced repetition
- Use FSRS (vendor a small JS implementation) with Again/Hard/Good/Easy buttons. SM-2 is acceptable if FSRS adds too much complexity; explain the choice.
- Default direction is my language → target (produce). Add target → my language (recognize) cards for reading practice during script modules.
- For production cards, I answer by speaking or typing, then reveal and grade myself.
- Review queues are separate per profile.

## Data (D1): suggested tables
profiles_state, cards, review_state, review_log, phrase_requests, stories, conversations, corrections, module_progress, settings, daily_log. Every learning table has a `profile` column. Design the exact schema, include migrations, and keep it simple.

## Build in phases (each phase deployable and usable on its own)
1. Project setup, Access, D1 schema with profiles, profile config loader, header controls, card model, FSRS review screen, Arabic alphabet module
2. Seed-deck generation on profile activation + "I want to say…" list + daily new-items flow
3. Grammar drills + reference page + weak-spot tracking
4. Daily stories with tap-to-translate and audio
5. Speaking practice with transcription and corrections → cards
6. Stats, streaks, weekly human-practice nudge, multi-language home screen
7. (Later, when I'm ready) Activate and test Italian and German profiles, including their pronunciation modules

Only Arabic content is generated during phases 1–6. Italian and German exist only as config until phase 7, but every phase must work for any profile without code changes.

Before starting each phase, show me the plan and wait for my OK. At the end of each phase, give me deploy steps and what to test.

## Deliverables
- Working app deployed to Cloudflare Pages
- README: setup, secrets, deploy, how to add or activate a language profile, the Arabic transliteration schemes, how to edit or regenerate a seed deck
