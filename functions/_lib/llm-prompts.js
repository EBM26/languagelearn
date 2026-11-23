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
