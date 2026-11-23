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
