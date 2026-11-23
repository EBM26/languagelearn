// Shared UI components. Styling lives entirely in app.css.
import { h } from './dom.js';

const ICONS = {
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
};
export function icon(name) {
  const t = document.createElement('template'); t.innerHTML = ICONS[name];      // static constants only
  return t.content.firstChild;
}

export const pageHead = (title, sub) => h('div', { class: 'page-head' }, h('h1', {}, title), sub && h('p', {}, sub));
export const field = (label, control) => h('div', { class: 'field' }, h('span', { class: 'field__label' }, label), control);
export const badge = (text, variant = 'neutral') => h('span', { class: `badge badge--${variant}` }, text);
export const statusBadge = (status, label) => badge(label, { done: 'success', failed: 'danger', pending: 'warning' }[status] || 'neutral');

// One error, one place. `action` is an optional element (e.g. a Retry button).
export function alertEl(message, action, kind = 'danger') {
  return h('div', { class: `alert alert--${kind}`, role: kind === 'danger' ? 'alert' : 'status' }, h('span', {}, message), action);
}

export function toggle({ checked, onChange, label }) {
  const input = h('input', { type: 'checkbox', checked: !!checked, onchange: (e) => onChange?.(e.target.checked) });
  return h('label', { class: 'switch' }, input, h('span', { class: 'switch__track' }), h('span', {}, label));
}

export function segmented({ value, options, onChange, label }) {
  const root = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  options.forEach((o) => root.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(o.value === value),
    onclick: () => { if (o.value !== value) onChange?.(o.value); } }, o.label)));
  return root;
}

// Custom, keyboard-accessible select (replaces native <select>). onChange(value) fires on selection.
const closeAll = (except) => document.querySelectorAll('.select.open').forEach((s) => { if (s !== except) s.classList.remove('open'); });
document.addEventListener('click', (e) => closeAll(e.target.closest('.select')));
export function select({ value, options, onChange, label, variant = '', footer = [] }) {
  const root = h('div', { class: `select ${variant ? 'select--' + variant : ''}` });
  const current = () => options.find((o) => o.value === value) ?? options[0];
  const text = h('span', { class: 'select__label' }, current()?.label ?? '');
  const btn = h('button', { type: 'button', class: 'select__btn', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': label }, text, icon('chevron'));
  const menu = h('ul', { class: 'select__menu', role: 'listbox' });
  const close = () => { root.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
  const open = () => { closeAll(root); root.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    (menu.querySelector('[aria-selected="true"]') || menu.firstChild)?.focus(); };
  for (const o of options) {
    const li = h('li', { role: 'option', tabindex: '-1', class: 'select__opt', 'aria-selected': String(o.value === value) }, o.label);
    li.onclick = () => { value = o.value; text.textContent = o.label;
      menu.querySelectorAll('[role=option]').forEach((x) => x.setAttribute('aria-selected', String(x === li)));
      close(); btn.focus(); onChange?.(o.value); };
    menu.append(li);
  }
  for (const f of footer) menu.append(h('li', { role: 'option', tabindex: '-1', class: 'select__opt select__opt--action', onclick: () => { close(); f.onClick(); } }, f.label));
  btn.onclick = () => (root.classList.contains('open') ? close() : open());
  root.addEventListener('keydown', (e) => {
    const items = [...menu.children], i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { close(); btn.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (!root.classList.contains('open')) open(); else items[Math.min(i + 1, items.length - 1)]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(i - 1, 0)]?.focus(); }
    else if ((e.key === 'Enter' || e.key === ' ') && i >= 0) { e.preventDefault(); document.activeElement.click(); }
  });
  root.append(btn, menu);
  return root;
}
