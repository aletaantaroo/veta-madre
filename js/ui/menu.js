import { drawChart, emit, resetKeys, selectDesk, sfx, showSection, syncLamps, toast } from '../core/bus.js';
import { $, $$, setT } from '../core/dom.js';
import { fmtHMS, money, nf0, smoney, weight } from '../core/format.js';
import { RM, SET, applyMotion, saveSet } from '../core/settings.js';
import { METALS, NSLOTS, OBJ, SAVE_KEY, TPC, runT } from '../data/content.js';
import { estRates, needs, openedMk, simulate } from '../game/economy.js';
import { tick, warmMarkets } from '../game/market.js';
import { setSilent } from '../game/progress.js';
import { S, cap, fresh, legAvail, migrate, save, setS } from '../game/state.js';
import { startGuide } from './guide.js';
import { paintIcons } from './icons.js';
import { applyShop } from './mine.js';
import { showNextTut } from './tutorial.js';

let resetConfirm = false;
export function renderReset(){
  const box = $('#resetBox');
  box.innerHTML = !resetConfirm ? '<button type="button" class="btn sm btn-red" id="btnReset">Borrar</button>'
    : '<span>¿Seguro? No se puede deshacer.</span><button type="button" class="btn sm danger" id="btnResetYes">Sí, borrar</button><button type="button" class="btn sm ghost" id="btnResetNo">Cancelar</button>';
}
$('#resetBox').addEventListener('click', e => {
  const id = e.target.id;
  if (id === 'btnReset'){ resetConfirm = true; renderReset(); }
  if (id === 'btnResetNo'){ resetConfirm = false; renderReset(); }
  if (id === 'btnResetYes'){
    backup('prev', true);
    resetConfirm = false; setS(fresh()); warmMarkets(); emit('sceneReset'); resetKeys(); save(); renderReset();
    selectDesk('sell'); closeMenu(); showSection('mina'); applyShop(); startGuide();
  }
});

/* ================= menú y ajustes ================= */
export const menuOpen = () => !$('#menu').hidden;
export let menuTab = 'home';
export function updateMenuHome(){
  setT($('#mhLevel'), `Nv ${S.level}${S.sp ? ` · ${S.sp} pts` : ''}`); setT($('#mhMoney'), money(S.money));
  const R = estRates(), n = $('#mhNet'); setT(n, smoney(R.net) + '/s'); n.className = 'val ' + (R.net >= 0 ? 't-up' : 't-down');
  setT($('#mhTime'), S.runStart ? fmtHMS(runT()) : '—');
  $('#mhObj').innerHTML = S.obj < OBJ.length ? `Siguiente objetivo: <b>${OBJ[S.obj].txt}</b> (premio ${money(OBJ[S.obj].r)}).` : (S.legacy ? `Tienes ${legAvail()} lingotes sin gastar en la tienda de legado.` : '');
}
export function openMenu(tab){
  $('#menu').hidden = false; selectMenuTab(tab || 'home'); updateMenuHome();
  setTimeout(() => { const b = $('#btnResume'); if (b && menuTab === 'home') b.focus(); }, 0);
}
export function closeMenu(){ setTimeout(showNextTut, 300); $('#menu').hidden = true; $('#awayBox').hidden = true; pending = null; renderImport(); }
function selectMenuTab(t){
  menuTab = t;
  $$('.menu-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mtab === t)));
  $('#mHome').hidden = t !== 'home'; $('#mSet').hidden = t !== 'set'; $('#mSave').hidden = t !== 'save'; $('#mHelp').hidden = t !== 'help';
  syncSettings(); if (t === 'save'){ renderBackups(); renderSaveStatus(); }
}
$$('.menu-tabs button').forEach(b => b.addEventListener('click', () => { sfx('ui'); selectMenuTab(b.dataset.mtab); }));
$('#menu').addEventListener('click', e => { if (e.target.id === 'menu') closeMenu(); });
function syncSettings(){
  [['#setMotion','motion'],['#setToasts','toasts']].forEach(([sel,k]) => $$(sel + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === SET[k])));
  $$('.switch[data-k]').forEach(b => b.setAttribute('aria-checked', String(SET[b.dataset.k] === 'on')));
}
function applySet(){ saveSet(); applyMotion(); document.body.classList.toggle('calm', RM); syncSettings(); sfx('ui'); }
[['#setMotion','motion'],['#setToasts','toasts']].forEach(([sel,k]) => $$(sel + ' button').forEach(b => b.addEventListener('click', () => { SET[k] = b.dataset.v; applySet(); })));
$$('.switch[data-k]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.k; SET[k] = SET[k] === 'on' ? 'off' : 'on'; applySet(); }));

/* ================= copias de seguridad ================= */
/* Tres copias automáticas en este navegador: al abrir el juego, cada 10 minutos y cada hora. Más la de antes de borrar o cargar otra partida. */
const BK_KEY = SAVE_KEY + '-copias';
const BK_SLOTS = {boot: 'Al abrir el juego', m10: 'Hace unos minutos', h1: 'Hace un rato largo', prev: 'Antes de cargar o borrar'};
function readBk(){ try { return JSON.parse(localStorage.getItem(BK_KEY) || '{}') || {}; } catch(e){ return {}; } }
function writeBk(b){ try { localStorage.setItem(BK_KEY, JSON.stringify(b)); return true; } catch(e){ return false; } }
export function backup(slot, force){
  if (!S || (!S.clicks && !S.earned)) return;
  const b = readBk(), cur = b[slot], now = Date.now();
  const every = {m10: 6e5, h1: 36e5}[slot] || 0;
  if (!force && cur && now - cur.t < every) return;
  if (slot === 'h1' && b.m10 && (!cur || now - cur.t >= every)) b.h1 = b.m10;   // la de hace un rato pasa a ser la de hace una hora
  b[slot] = {t: now, level: S.level, money: S.money, earned: S.earned, data: JSON.stringify(S)};
  if (!writeBk(b)){ delete b.h1; writeBk(b); }
}
let bkT = 0;
export function backupTick(el){ if ((bkT += el) < 30) return; bkT = 0; backup('m10'); backup('h1'); }
function agoTxt(t){ const m = Math.round((Date.now() - t)/60000); return m < 1 ? 'hace menos de un minuto' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m/60)} h` : new Date(t).toLocaleDateString('es-ES', {day: 'numeric', month: 'short'}); }
function renderBackups(){
  const b = readBk(), keys = ['m10', 'h1', 'boot', 'prev'].filter(k => b[k]);
  $('#bkList').innerHTML = keys.length ? keys.map(k => `<div class="bk"><span class="bk-ico" data-icon="clock"></span><div class="bk-txt"><b>${BK_SLOTS[k]}</b><span>${agoTxt(b[k].t)} · nivel ${b[k].level} · ${money(b[k].money)} en caja</span></div><button type="button" class="btn sm btn-plain" data-act="bkRestore" data-id="${k}">Volver aquí</button></div>`).join('')
    : '<p class="info">Todavía no hay copias. La primera se hace en cuanto empieces a jugar.</p>';
  paintIcons($('#bkList'));
}
function renderSaveStatus(){ setT($('#saveStatus'), S.saved ? `Guardado ${agoTxt(S.saved)}. Se guarda solo cada pocos segundos en este navegador.` : 'Tu partida se guarda sola en este navegador.'); }

/* ================= exportar e importar ================= */
let pending = null;   // partida a punto de cargarse, esperando confirmación
function decode(raw){
  raw = String(raw || '').trim(); if (!raw) return null;
  let d = null;
  try { d = JSON.parse(raw); } catch(e){ try { d = JSON.parse(decodeURIComponent(escape(atob(raw)))); } catch(e2){ return null; } }
  return d && typeof d === 'object' && d.money != null && d.level != null ? d : null;
}
function stamp(){ const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; }
/* En claude.ai la descarga pasa por el permiso «downloads» del visor; fuera (GitHub, archivo suelto) es un enlace normal. */
let dlCap = null;
function dlCapability(){
  if (!dlCap) dlCap = window.claude && typeof window.claude.use === 'function' ? Promise.resolve(window.claude.use('downloads')).catch(() => null) : Promise.resolve(null);
  return dlCap;
}
dlCapability();
export async function exportFile(){
  save();
  const name = `veta-madre_nivel-${S.level}_${stamp()}.json`, data = JSON.stringify(S);
  const dl = await dlCapability();
  if (dl){
    try { await dl.save({filename: name, data}); toast('Partida descargada. Guárdala donde quieras y cárgala desde aquí cuando la necesites.', 'up'); }
    catch(e){
      const c = e && e.code;
      if (c === 'declined') return;
      if (c === 'rate_limited') toast('Ya hay una descarga esperando tu respuesta.');
      else toast('Aquí no se pueden descargar archivos. Usa el código de texto de abajo.', 'down');
    }
    return;
  }
  try {
    const blob = new Blob([data], {type: 'application/json'}), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Partida descargada. Guárdala donde quieras y cárgala desde aquí cuando la necesites.', 'up');
  } catch(e){ toast('Este navegador no deja descargar archivos. Usa el código de texto.', 'down'); }
}
export function exportSave(){
  save();
  let code = '';
  try { code = btoa(unescape(encodeURIComponent(JSON.stringify(S)))); } catch(e){ return; }
  const ta = $('#saveCode'); ta.value = code;
  const done = () => toast('Código copiado. Guárdalo donde quieras.');
  try { navigator.clipboard.writeText(code).then(done, () => { ta.select(); toast('Selecciona el código y cópialo (Ctrl+C).'); }); }
  catch(e){ ta.select(); toast('Selecciona el código y cópialo (Ctrl+C).'); }
}
function askLoad(d, from){
  const err = $('#importErr');
  if (!d){ err.textContent = from === 'file' ? 'Ese archivo no es una partida de Veta Madre.' : 'Ese código no es válido. Copia el código completo, sin espacios de más.'; err.hidden = false; pending = null; renderImport(); return; }
  err.hidden = true; pending = {d, from}; renderImport();
}
export function renderImport(){
  const box = $('#importBox'); if (!box) return;
  box.hidden = !pending;
  if (!pending){ box.innerHTML = ''; return; }
  const d = pending.d, when = d.saved ? ` · guardada ${agoTxt(d.saved)}` : '';
  box.innerHTML = `<span><b>${pending.from === 'bk' ? 'Volver a la copia' : 'Cargar partida'}:</b> nivel ${d.level} · ${money(d.money)} en caja${when}. Sustituye a la actual (antes haremos una copia).</span><button type="button" class="btn sm danger" data-act="importYes">Sí, cargar</button><button type="button" class="btn sm ghost" data-act="importNo">Cancelar</button>`;
  box.scrollIntoView({block: 'nearest', behavior: 'smooth'});
}
export function importCode(){ askLoad(decode($('#saveCode').value), 'code'); }
export function restoreBk(slot){ const b = readBk()[slot]; askLoad(b ? decode(b.data) : null, 'bk'); }
export function cancelImport(){ pending = null; renderImport(); }
export function doImport(){
  if (!pending) return;
  backup('prev', true);
  const d = pending.d; pending = null;
  setS(migrate(d)); emit('sceneReset'); resetKeys(); syncLamps(); save();
  renderImport(); closeMenu(); showSection(S.section || 'mina'); toast('Partida cargada.', 'lv');
}
$('#importFile').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { askLoad(decode(r.result), 'file'); e.target.value = ''; };
  r.onerror = () => askLoad(null, 'file');
  r.readAsText(f);
});
let lastAway = null;
export function catchUp(el, report){
  const counted = Math.min(el, 3600);
  const b = {money:S.money, mined:S.mined, level:S.level, pos:S.positions.length, ord:S.orders.length, arrears:S.arrears, debt:S.debt, stock:{...S.stock}};
  setSilent(true);
  try { simulate(counted); for (let i=0;i<Math.min(counted, NSLOTS*TPC);i++) tick(false); } finally { setSilent(false); }
  drawChart();
  if (!report) return;
  const items = [];
  const dMined = S.mined - b.mined;
  if (dMined > 0) items.push(`Tus minas extrajeron el equivalente a <b>${weight(dMined)}</b> de oro.`);
  const dm = S.money - b.money;
  if (Math.abs(dm) > .01) items.push(`Tu caja cambió <b class="${dm >= 0 ? 't-up' : 't-down'}">${smoney(dm)}</b> (empresas, ventas automáticas, nóminas y recursos).`);
  if (S.level > b.level) items.push(`Subiste al <b>nivel ${S.level}</b>.`);
  if (S.positions.length !== b.pos) items.push(`Se cerraron <b>${b.pos - S.positions.length}</b> posiciones de trading. Míralas en el Historial.`);
  if (S.orders.length !== b.ord) items.push(`Se ejecutaron <b>${b.ord - S.orders.length}</b> órdenes de venta.`);
  if (S.arrears > b.arrears) items.push(`<span class="t-down">Quedaron nóminas sin pagar: ${money(S.arrears)} de atrasos.</span>`);
  if (S.debt > b.debt + .01) items.push(`<span class="t-down">Tu deuda subió ${money(S.debt - b.debt)}.</span>`);
  const full = openedMk().filter(m => S.stock[m] >= cap(m)).map(m => METALS[m].low);
  if (needs().mv && S.maint < 30) items.push(`<span class="t-down">Tu maquinaria está al ${nf0.format(S.maint)} %: repárala en Finanzas.</span>`);
  if (full.length) items.push(`Almacén lleno de ${full.join(', ')}: parte del tiempo la mina estuvo parada.`);
  const box = $('#awayBox');
  box.innerHTML = `<span>Has estado fuera <b>${fmtHMS(el)}</b>.${el > 3600 ? ' Solo cuenta <b>1 hora</b> de trabajo.' : ''}</span>${items.length ? `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` : '<span class="info">No ha pasado gran cosa.</span>'}`;
  box.hidden = false;
  openMenu('home');
}
