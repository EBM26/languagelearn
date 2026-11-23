const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
async function call(method, path, body) {
  const res = await fetch(path, { method, headers: { 'content-type': 'application/json', 'x-tz': tz },
    body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}
export const api = {
  get: (p) => call('GET', p),
  post: (p, b) => call('POST', p, b ?? {}),
  put: (p, b) => call('PUT', p, b),
  del: (p) => call('DELETE', p),
};
