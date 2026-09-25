import { K, on, sfx } from '../core/bus.js';
import { $, esc, setT } from '../core/dom.js';
import { SET } from '../core/settings.js';
import { silent } from '../game/progress.js';
import { S } from '../game/state.js';

/* ================= avisos discretos =================
   Pastillas pequeñas en una esquina (dos como mucho y se van solas). Todo queda en el historial de la campana. */
const box = $('#toasts'), MAX = 2, HIST = 60;
let feedOpen = false;

/* Cuatro clases de aviso (el tercer parámetro de toast):
   imp  · importante: sale en pantalla, suena y enciende la campana.
   ok   · respuesta a algo que acabas de hacer (guardar, cargar, abrir una mina): sale en pantalla.
   err  · por qué no ha pasado lo que pedías: sale siempre y no se guarda.
   info · el día a día (noticias, ventas, compras, encargos nuevos): solo queda en la campana, salvo con «Todos».
   Sin clase: los tonos de logro y de nivel cuentan como importantes; el resto, como día a día. */
const levelOf = (tone, lvl) => lvl || (tone === 'ach' || tone === 'lv' ? 'imp' : 'info');
function ago(t){
  const s = Math.max(0, (Date.now() - t)/1000);
  if (s < 50) return 'ahora'; if (s < 3600) return `hace ${Math.round(s/60)} min`;
  if (s < 86400) return `hace ${Math.round(s/3600)} h`; return `hace ${Math.round(s/86400)} d`;
}
function remember(msg, tone, imp){
  if (!S) return;
  if (!S.feed) S.feed = [];
  const last = S.feed[0];
  if (last && last.msg === msg && Date.now() - last.t < 60000){ last.n = (last.n || 1) + 1; last.t = Date.now(); }
  else { S.feed.unshift({t: Date.now(), msg, tone: tone || '', imp: imp ? 1 : 0}); if (S.feed.length > HIST) S.feed.length = HIST; }
  if (imp && !feedOpen) S.feedUnread = (S.feedUnread || 0) + 1;
  K.feed = '';
  if (feedOpen) renderFeed();
  syncBell(imp);
}
function syncBell(ring){
  const n = (S && S.feedUnread) || 0, b = $('#bFeed');
  b.hidden = !n; setT(b, n > 9 ? '9+' : String(n));
  if (ring){ const bb = $('#navFeed'); bb.classList.remove('ring'); void bb.offsetWidth; bb.classList.add('ring'); }
}
function pop(msg, tone, imp){
  const same = [...box.children].find(el => el.dataset.msg === msg && !el.classList.contains('out'));
  if (same){ const n = +(same.dataset.n || 1) + 1; same.dataset.n = n; setT(same.querySelector('.t-n'), '×' + n); clearTimeout(same._t); same._t = setTimeout(() => out(same), 2600); return; }
  const el = document.createElement('div'); el.className = 'toast' + (imp ? ' imp' : ''); el.dataset.msg = msg;
  if (tone) el.dataset.tone = tone;
  el.innerHTML = `<span class="t-txt"></span><span class="t-n"></span>`; setT(el.querySelector('.t-txt'), msg);
  box.appendChild(el);
  while (box.children.length > MAX) box.firstChild.remove();
  el._t = setTimeout(() => out(el), imp ? 4200 : 2600);
}
function out(el){ el.classList.add('out'); setTimeout(() => el.remove(), 320); }

function showToast(msg, tone, lvl){
  if (silent) return;
  const L = levelOf(tone, lvl), imp = L === 'imp', lvlUp = /^¡Nivel \d/.test(msg);
  if (tone === 'ach') sfx('ach');
  else if (imp && tone === 'lv' && !lvlUp) sfx('ach');
  else if (imp && tone === 'down') sfx('bad');
  if (L !== 'err') remember(msg, tone, imp);
  if (lvlUp) return;
  const show = SET.toasts === 'all' || (SET.toasts === 'imp' ? L !== 'info' : L === 'err');
  if (show) pop(msg, tone, imp);
}
on('toast', showToast);

/* ---------- historial de la campana ---------- */
function renderFeed(){
  const list = (S.feed || []);
  $('#feedList').innerHTML = list.length ? list.map(f => `<li data-tone="${f.tone}"${f.imp ? ' class="imp"' : ''}><span class="f-dot"></span><span class="f-txt">${esc(f.msg)}${f.n > 1 ? ` <b>×${f.n}</b>` : ''}</span><time>${ago(f.t)}</time></li>`).join('')
    : '<li class="empty">Nada por ahora. Aquí quedan guardados los avisos para que no tengas que leerlos al vuelo.</li>';
}
export function toggleFeed(v = !feedOpen){
  feedOpen = v; const p = $('#feedPanel');
  p.hidden = !v; $('#navFeed').setAttribute('aria-expanded', String(v));
  if (v){ S.feedUnread = 0; syncBell(false); renderFeed(); sfx('ui'); }
}
$('#feedX').addEventListener('click', () => toggleFeed(false));
$('#feedClear').addEventListener('click', () => { S.feed = []; renderFeed(); });
document.addEventListener('pointerdown', e => { if (feedOpen && !e.target.closest('#feedPanel, #navFeed')) toggleFeed(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && feedOpen){ e.stopImmediatePropagation(); toggleFeed(false); } }, true);
on('ui', () => { if (feedOpen && K.feedT !== Math.floor(Date.now()/20000)){ K.feedT = Math.floor(Date.now()/20000); renderFeed(); } if (K.bell !== (S.feedUnread || 0)){ K.bell = S.feedUnread || 0; syncBell(false); } });
