// Provider-agnostic LLM adapter. Choose the provider/model via env vars (wrangler.toml [vars]);
// the key comes from the LLM_API_KEY secret. To add a provider, add a branch in `complete`.
export async function llm(env, { system, user, maxTokens = 6000 }) {
  const provider = env.LLM_PROVIDER || 'anthropic';
  if (provider === 'mock') return mock(user);
  if (!env.LLM_API_KEY) throw new Error('LLM_API_KEY is not set');
  if (!env.LLM_MODEL) throw new Error('LLM_MODEL is not set');
  return complete(provider, env, system, user, maxTokens);
}

async function complete(provider, env, system, user, maxTokens) {
  if (provider === 'anthropic') {
    const res = await fetch((env.LLM_BASE_URL || 'https://api.anthropic.com') + '/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.LLM_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: env.LLM_MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    return (j.content || []).map((b) => b.text || '').join('');
  }
  if (provider === 'openai') {
    const res = await fetch((env.LLM_BASE_URL || 'https://api.openai.com') + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.LLM_API_KEY}` },
      body: JSON.stringify({ model: env.LLM_MODEL, max_tokens: maxTokens, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
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
  throw new Error('mock: unknown task');
}
