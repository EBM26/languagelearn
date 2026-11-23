// All prompts live here. systemFor() is used for EVERY LLM call so the variety rules are never omitted.
export function systemFor(p) {
  return [`You are a careful lexicographer and language teacher for ${p.names.en}.`,
    p.variety_rules,
    'Reply with ONE JSON object only. No markdown, no commentary.',
    p.transliteration?.enabled ? `${p.transliteration.latin_rules || ''} ${p.transliteration.hebrew_rules || ''}`.trim() : '',
    p.cognate_hint && p.cognate_hint !== 'none'
      ? `cognate_hint: a short ${p.cognate_hint}-language cognate/false-friend note, or null. Never invent a cognate; use null when unsure.` : '',
  ].filter(Boolean).join('\n');
}

function itemSpec(p) {
  const tr = p.transliteration?.enabled;
  return `Each item is an object: {"target_text": string (${p.script} script${p.diacritics ? ', fully vowelled' : ''}${p.code === 'de' ? ', nouns with article' : ''}), ` +
    `"type": "word"|"phrase", ${tr ? '"translit_latin": string, "translit_hebrew": string, ' : ''}` +
    `"english": string, "hebrew": string (Hebrew translation, in Hebrew letters), "cognate_hint": string|null, ` +
    `"tags": {"pos": string, plus any of ${Object.keys(p.grammar_axes || {}).join('/')} that clearly apply}, ` +
    `"example": {"target": a short natural sentence using the item, "en": English, "he": Hebrew}}.`;
}

export function seedPrompt(p, from, to, recent) {
  return `TASK: seed
Produce frequency ranks RANKS ${from}-${to} of the most useful everyday spoken vocabulary for a beginner-to-intermediate learner (about 80% single words, 20% short phrases; mostly spoken-language items).
${p.seed?.instructions || ''}
Return {"items": [...]} with exactly ${to - from + 1} items. ${itemSpec(p)}
Do NOT repeat any of these already-covered items: ${JSON.stringify(recent)}`;
}

export function verifyPrompt(p, items) {
  return `TASK: verify
Check each item below against the variety rules. Replace any form that drifts toward something other than the target variety (e.g. MSA where a colloquial form exists) with the correct one, and make transliterations match the target pronunciation and schemes. Fix wrong translations. Keep the same JSON structure, the same number of items and the same order. Return {"items": [...]}.
ITEMS_JSON:${JSON.stringify({ items })}`;
}

export function phrasesPrompt(p, text, inputLang) {
  return `TASK: phrases
The learner wants to say the following (written in ${inputLang === 'he' ? 'Hebrew' : 'English'}):
"""${text.slice(0, 500)}"""
Break it into 3 to 8 learnable phrases and key words, in order of usefulness, that together let the learner say it in ${p.names.en}. Use natural phrasing for the situation.
Return {"items": [...]}. ${itemSpec(p)}`;
}

export function regeneratePrompt(p, card, note) {
  return `TASK: regenerate
The learner reported a problem with this card. Fix it (keep the same target meaning unless the card is wrong). Return {"items": [ONE corrected item]}. ${itemSpec(p)}
CARD_JSON:${JSON.stringify({ target_text: card.target_text, english: card.english, hebrew: card.hebrew,
    translit_latin: card.translit_latin, translit_hebrew: card.translit_hebrew, example_target: card.example_target })}
NOTE:${note || '(no note — check for dialect/MSA drift and wrong translations)'}`;
}

// ---- Phase 3: grammar ----
const AXES = (p) => Object.entries(p.grammar_axes || {}).map(([k, v]) => `${k}: ${v.join('/')}`).join('; ');

export function grammarPrompt(p, topicLabel, focus, n, known, avoid) {
  return `TASK: drills
Create ${n} grammar production drills for the topic "${topicLabel}".${focus ? ` Concentrate on ${focus.axis} = ${focus.value}, which the learner keeps getting wrong.` : ''}
Each drill is a PROMPT in English and Hebrew that states the grammatical axes explicitly (examples: "she wrote", "you (f) want", "with the (dat.) man"), and the learner must produce the target-language form (the ANSWER).
Use simple, high-frequency vocabulary, preferring words from this list the learner already knows: ${JSON.stringify(known)}.
Axes available for tags (use only these values): ${AXES(p)}.
Do not repeat these existing prompts: ${JSON.stringify(avoid)}.
Return {"items": [...]}. Each item: {"target_text": the ANSWER in ${p.script} script${p.diacritics ? ' (fully vowelled)' : ''},
${p.transliteration?.enabled ? '"translit_latin": string, "translit_hebrew": string, ' : ''}"english": the English prompt with axes explicit, "hebrew": the Hebrew prompt with axes explicit (Hebrew letters),
"cognate_hint": null, "tags": {one value for EACH axis that applies, using only the allowed values}, "example": {"target": a short sentence using the form, "en": English, "he": Hebrew}}.`;
}

export function referencePrompt(p, topicLabel, only) {
  return `TASK: reference
Write ${only ? 'ONE reference table' : '1 to 3 compact reference tables'} for the grammar topic "${topicLabel}" in ${p.names.en}.${only ? ` Table title: ${JSON.stringify(only.title)}. ${only.note ? 'Learner note: ' + only.note : ''}` : ''}
Pronouns of this language: ${JSON.stringify(p.pronouns)}. Axes: ${AXES(p)}.
Return {"tables": [{"title": {"en": string, "he": string}, "columns": [{"en": string, "he": string}, ...],
"rows": [[cell, ...], ...], "notes": {"en": string, "he": string} | null}]}.
Every row has exactly as many cells as there are columns, and at least 2 rows. A cell is either a label {"en": string, "he": string}
or a target-language form {"t": string in ${p.script} script${p.diacritics ? ' (fully vowelled)' : ''}${p.transliteration?.enabled ? ', "latin": string, "hebrew": string (transliteration in Hebrew letters)' : ''}}.
Use a model verb or noun that is common and regular where the topic needs examples.`;
}

// ---- Phase 4: stories ----
export function storyPrompt(p, { format, words, known, newWords, grammar, note }) {
  const tr = p.transliteration?.enabled;
  const sentences = Math.max(4, Math.round(words / 8));
  return `TASK: story
Write ${format === 'dialogue' ? 'a short DIALOGUE between two people (give each line a "speaker", a first name)' : 'a short STORY (simple narrative)'} in ${p.names.en} of ABOUT ${words} words, in about ${sentences} short sentences.
Level: the learner knows ONLY these words (plus very common function words and pronouns): ${JSON.stringify(known)}.
${known.length < 15 ? 'The learner knows almost nothing yet: use very short, very simple sentences and repeat words.' : ''}
Use ALL of these new words, and no other unfamiliar vocabulary: ${JSON.stringify(newWords)}.
${grammar ? `Grammar focus for today: ${grammar.topic}${grammar.focus ? ` (especially ${grammar.focus})` : ''}. Use it naturally several times.` : ''}
${note ? 'Learner feedback on the previous version: ' + note : ''}
Return {"title": {"target": string, "en": string, "he": string}, "sentences": [{"speaker": string|null, "target": the sentence in ${p.script} script${p.diacritics ? ' (fully vowelled)' : ''}, ${tr ? '"translit_latin": string, "translit_hebrew": string, ' : ''}"en": English, "he": Hebrew}]}.`;
}

export function glossPrompt(p, sentences) {
  const tr = p.transliteration?.enabled;
  return `TASK: gloss
Split each sentence into word tokens for a tap-to-translate reader. Tokens, joined by spaces, must reproduce the sentence's words in order (keep punctuation attached to its word).
For each token give: "t" the surface form exactly as written; "b" the base form worth learning as a vocabulary item (colloquial ${p.names.en}; same as "t" if unchanged; for attached clitics/suffixes give the base word);
${tr ? '"latin" and "hebrew": transliteration of "b" (Hebrew letters for "hebrew"); ' : ''}"en": short English gloss of the word in context; "he": short Hebrew gloss (Hebrew letters).
SENTENCES_JSON:${JSON.stringify(sentences.map((s, i) => ({ i, target: s.target })))}
Return {"sentences": [{"i": index, "tokens": [{"t","b",${tr ? '"latin","hebrew",' : ''}"en","he"}]}]}`;
}

// ---- Phase 5: speaking practice ----
export function talkPrompt(p, { topic, known, history, mode }) {
  const tr = p.transliteration?.enabled;
  const how = mode === 'first' ? 'Start the conversation: greet the learner and ask ONE simple question about the topic.'
    : mode === 'final' ? 'This is the last turn: reply briefly and close the conversation warmly. Do not ask a question.'
    : 'Reply in character to the learner\'s last message, then ask ONE short question to keep the conversation going.';
  return `TASK: talk
You are a friendly conversation partner chatting with a language learner, speaking ${p.names.en}.
Topic / situation: ${topic}
Level: the learner knows roughly these words: ${JSON.stringify(known)}. Use short, simple sentences (under ~10 words) built mostly from them; at most one unfamiliar word per turn.
${how}
The learner's lines come from speech recognition and may contain transcription slips: be forgiving, never correct them here, and never switch to English or Hebrew.
CONVERSATION_JSON:${JSON.stringify(history)}
Return {"reply": {"target": your line in ${p.script} script${p.diacritics ? ' (fully vowelled)' : ''}, ${tr ? '"translit_latin": string, "translit_hebrew": string, ' : ''}"en": English, "he": Hebrew}}.`;
}

export function correctPrompt(p, history) {
  return `TASK: correct
Below is a practice conversation in ${p.names.en}. Review ONLY the learner's lines ("role":"user"). They come from speech recognition, so ignore likely transcription artifacts and minor punctuation.
Pick up to 5 of the learner's most useful real mistakes (grammar, wrong word, unnatural or wrong-variety phrasing) and give the better version. If there are no real mistakes, return an empty list.
For each: "said" (what the learner said), "item" (the better version as a flashcard), "explanation" (one or two short sentences in English and in Hebrew saying what was wrong).
Also write a 1-2 sentence encouraging "summary" of how it went, in English and Hebrew.
Return {"summary": {"en": string, "he": string}, "corrections": [{"said": string, "item": ITEM, "explanation": {"en": string, "he": string}}]}.
ITEM: ${itemSpec(p)} Use "type": "phrase" unless it is a single word.
USER_TURNS_JSON:${JSON.stringify(history)}`;
}
