import { on, sfx } from '../core/bus.js';
import { $ } from '../core/dom.js';
import { SET } from '../core/settings.js';
import { silent } from '../game/progress.js';

/* Avisos emergentes con icono según el tono. */
function showToast(msg, tone){
  if (silent) return;
  const lvl = /^¡Nivel \d/.test(msg);
  const imp = tone === 'lv' || tone === 'down' || tone === 'ach' || /^(Logro|¡|Tiempo|Huelga)/.test(msg);
  if (tone === 'ach') sfx('ach');
  else if (tone === 'lv' && !lvl) sfx('ach');
  else if (tone === 'down' && imp) sfx('bad');
  if (lvl) return;
  if (SET.toasts === 'none' || (SET.toasts === 'imp' && !imp)) return;
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; if (tone) el.dataset.tone = tone;
  const box = $('#toasts'); box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 4100);
  setTimeout(() => el.remove(), 4500);
  el.addEventListener('click', () => el.remove());
}
on('toast', showToast);
