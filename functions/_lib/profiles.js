// Profiles are static JSON in /public/profiles. Functions read them through the ASSETS binding.
export async function loadProfile(env, request, code) {
  if (!/^[a-z][a-z-]{0,15}$/.test(code || '')) return null;
  const res = await env.ASSETS.fetch(new URL(`/profiles/${code}.json`, request.url));
  return res.ok ? res.json() : null;
}
export async function loadAsset(env, request, path) {
  const res = await env.ASSETS.fetch(new URL(path, request.url));
  return res.ok ? res.json() : null;
}
