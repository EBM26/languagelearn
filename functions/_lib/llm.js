// Provider-agnostic LLM adapter. Provider/models are config (wrangler.toml [vars]); the key is the
// LLM_API_KEY secret. Default provider: Gemini. LLM_MODEL is tried first; if it fails with a transient
// error (429, 5xx, network) or returns nothing, LLM_FALLBACK_MODEL (e.g. Flash -> Flash Lite) is tried.
export async function llm(env, { system, user, maxTokens = 16000 }) {
  const provider = env.LLM_PROVIDER || 'gemini';
  if (provider === 'mock') return mock(user);
  if (!env.LLM_API_KEY) throw new Error('LLM_API_KEY is not set');
  const models = [env.LLM_MODEL, env.LLM_FALLBACK_MODEL].filter(Boolean);
  if (!models.length) throw new Error('LLM_MODEL is not set');
  let last;
  for (const model of models) {
    try {
      const out = await complete(provider, env, model, system, user, maxTokens);
      if (out && out.trim()) return out;
      last = new Error(`empty reply from ${model}`);
    } catch (e) {
      last = e;
      const transient = e.status === undefined || e.status === 429 || e.status >= 500;
      if (!transient) throw e;           // bad key / bad request: another model won't help
    }
  }
  throw last;
}

async function httpError(provider, res) {
  const e = new Error(`LLM ${provider} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  e.status = res.status;
  return e;
}

async function complete(provider, env, model, system, user, maxTokens) {
  if (provider === 'gemini') {
    const base = env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com';
    const res = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.LLM_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw await httpError(provider, res);
    const j = await res.json();
    return (j.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('');
  }
  if (provider === 'anthropic') {
    const res = await fetch((env.LLM_BASE_URL || 'https://api.anthropic.com') + '/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.LLM_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw await httpError(provider, res);
    return ((await res.json()).content || []).map((b) => b.text || '').join('');
  }
  if (provider === 'openai') {
    const res = await fetch((env.LLM_BASE_URL || 'https://api.openai.com') + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.LLM_API_KEY}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!res.ok) throw await httpError(provider, res);
    return (await res.json()).choices[0].message.content;
  }
  throw new Error(`Unknown LLM_PROVIDER "${provider}"`);
}

export function parseJson(text) {
  const s = text.replace(/```(?:json)?/g, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no JSON in LLM reply');
  return JSON.parse(s.slice(a, b + 1));
}

// Ask for JSON; retry once if it doesn't parse or `validate` throws.
export async function llmJson(env, { system, user, validate, maxTokens }) {
  let lastErr;
  for (let i = 0; i < 2; i++) {
    try {
      const out = parseJson(await llm(env, { system, user, maxTokens }));
      return validate ? validate(out) : out;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// ---- mock provider: deterministic canned replies so the app can be tested without a key ----
function mock(user) {
  const task = /^TASK: (\w+)/m.exec(user)?.[1];
  const arabic = (n) => { const L = 'بتنمسلكرد'; let w = ''; do { w += L[n % L.length]; n = Math.floor(n / L.length); } while (n); return w + 'َ'; };
  const item = (n, extra = {}) => ({ target_text: arabic(n), type: 'word', translit_latin: 'mock' + n, translit_hebrew: 'מוק' + n,
    english: 'mock word ' + n, hebrew: 'מילה ' + n, cognate_hint: null, tags: { pos: 'noun' },
    example: { target: arabic(n) + ' ' + arabic(n + 1), en: 'example ' + n, he: 'דוגמה ' + n }, ...extra });
  if (task === 'seed') {
    const [a, b] = /RANKS (\d+)-(\d+)/.exec(user).slice(1).map(Number);
    return JSON.stringify({ items: Array.from({ length: b - a + 1 }, (_, i) => item(a + i + 100)) });
  }
  if (task === 'verify') return JSON.stringify(JSON.parse(user.slice(user.indexOf('ITEMS_JSON:') + 11)));
  if (task === 'regenerate') {
    const c = JSON.parse(user.slice(user.indexOf('CARD_JSON:') + 10).split('\nNOTE:')[0]);
    return JSON.stringify({ items: [{ ...item(7), target_text: c.target_text, english: c.english + ' (regenerated)' }] });
  }
  if (task === 'phrases') return JSON.stringify({ items: [1, 2, 3, 4].map((i) => item(900 + i, { type: i > 2 ? 'word' : 'phrase' })) });
  if (task === 'drills') {
    const n = +/Create (\d+)/.exec(user)[1], f = /Concentrate on (\w+) = (\w+)/.exec(user);
    const seen = new Set(JSON.parse(/existing prompts: (\[.*\])\./.exec(user)?.[1] || '[]'));
    const T = ['past', 'present', 'future'], G = ['m', 'f'];
    return JSON.stringify({ items: Array.from({ length: n }, (_, i) => {
      const k = seen.size + i + 1000 + Math.floor(Math.random() * 1e6);
      return item(k, { type: 'word', english: 'drill ' + k, hebrew: 'תרגיל ' + k,
        tags: { person: String(1 + (k % 3)), gender: G[k % 2], number: 'sg', tense: T[k % 3], ...(f ? { [f[1]]: f[2] } : {}) } });
    }) });
  }
  if (task === 'reference') {
    const cell = (n) => ({ t: arabic(n), latin: 'm' + n, hebrew: 'מ' + n });
    return JSON.stringify({ tables: [{ title: { en: 'Mock table', he: 'טבלת דוגמה' }, columns: [{ en: 'Pronoun', he: 'כינוי' }, { en: 'Form', he: 'צורה' }],
      rows: [[{ en: 'I', he: 'אני' }, cell(1)], [{ en: 'you', he: 'אתה' }, cell(2)]], notes: null }] });
  }
  if (task === 'story') {
    const words = +/ABOUT (\d+) words/.exec(user)[1], dialogue = /DIALOGUE/.test(user);
    const n = Math.max(4, Math.round(words / 8)), seed = 3000 + Math.floor(Math.random() * 1e5);
    const sent = (i) => Array.from({ length: 6 }, (_, k) => arabic(seed + i * 7 + k)).join(' ') + '.';
    return JSON.stringify({ title: { target: arabic(seed), en: 'A mock ' + (dialogue ? 'dialogue' : 'story'), he: 'סיפור דוגמה' },
      sentences: Array.from({ length: n }, (_, i) => ({ speaker: dialogue ? (i % 2 ? 'Sara' : 'Omar') : null, target: sent(i),
        translit_latin: 'mock sentence ' + i, translit_hebrew: 'משפט ' + i, en: 'Mock sentence ' + i, he: 'משפט דוגמה ' + i })) });
  }
  if (task === 'gloss') {
    const list = JSON.parse(user.slice(user.indexOf('SENTENCES_JSON:') + 15).split('\nReturn')[0]);
    return JSON.stringify({ sentences: list.map((s) => ({ i: s.i, tokens: s.target.split(' ').map((w, k) => ({ t: w, b: w.replace('.', ''), latin: 'w' + k, hebrew: 'ו' + k, en: 'word ' + k, he: 'מילה ' + k })) })) });
  }
  throw new Error('mock: unknown task');
}
