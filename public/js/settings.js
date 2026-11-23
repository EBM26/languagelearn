import { api } from './api.js';
import { setLang } from './i18n.js';

// Global client state. Settings live in D1 and are mirrored to localStorage for instant boot.
export const S = { settings: { ui_lang: 'he', translit: 'auto', diacritics: 'on' }, states: {}, profiles: {}, codes: [], active: null };

const cached = () => { try { return JSON.parse(localStorage.getItem('settings') || '{}'); } catch { return {}; } };
const cache = () => { try { localStorage.setItem('settings', JSON.stringify(S.settings)); } catch {} };

export async function boot() {
  Object.assign(S.settings, cached());
  S.codes = await fetch('/profiles/index.json').then((r) => r.json());
  const [state, ...cfgs] = await Promise.all([api.get('/api/state'),
    ...S.codes.map((c) => fetch(`/profiles/${c}.json`).then((r) => r.json()))]);
  Object.assign(S.settings, state.settings); cache();
  S.codes.forEach((c, i) => { S.profiles[c] = cfgs[i]; });
  S.states = Object.fromEntries(state.profiles.map((p) => [p.profile, p]));
  setLang(S.settings.ui_lang);
  pickActive();
}
export const activeCodes = () => S.codes.filter((c) => S.states[c]?.active);
export function pickActive() {
  const act = activeCodes();
  S.active = act.includes(S.settings.active_profile) ? S.settings.active_profile : act[0] ?? null;
}
export const profile = () => S.profiles[S.active];

export async function setSetting(key, value) {
  S.settings[key] = value; cache();
  if (key === 'ui_lang') setLang(value);
  await api.put('/api/settings', { key, value });
}
export async function setProfileActive(code, active, newPerDay) {
  await api.post(`/api/profile/${code}`, { active, new_per_day: newPerDay });
  const st = (await api.get('/api/state')).profiles;
  S.states = Object.fromEntries(st.map((p) => [p.profile, p]));
  pickActive();
}

// 'latin' | 'hebrew' | 'off' for the active profile.
export function translitMode(p = profile()) {
  if (!p?.transliteration?.enabled) return 'off';
  const m = S.settings.translit;
  if (m === 'auto') return S.settings.ui_lang === 'he' ? 'hebrew' : 'latin';
  return m;
}
export const diacriticsOn = () => S.settings.diacritics !== 'off';
