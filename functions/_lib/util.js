export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
export const bad = (msg, status = 400) => json({ error: msg }, status);

// Local date (YYYY-MM-DD) in the user's timezone, sent by the client as X-TZ.
export function localDay(request, now = new Date()) {
  let tz = request.headers.get('x-tz') || 'UTC';
  try { return now.toLocaleDateString('en-CA', { timeZone: tz }); }
  catch { return now.toLocaleDateString('en-CA', { timeZone: 'UTC' }); }
}

export async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}
