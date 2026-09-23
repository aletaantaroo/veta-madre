export const $ = s => document.querySelector(s);
export const $$ = s => Array.from(document.querySelectorAll(s));

export const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const setT = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };
export let dpr = Math.min(2, window.devicePixelRatio || 1);
export function refreshDpr(){ dpr = Math.min(2, window.devicePixelRatio || 1); return dpr; }
