import { K, drawChart, emit, resetKeys, selectDesk, sfx, showSection, syncLamps, toast } from '../core/bus.js';
import { $, $$, setT } from '../core/dom.js';
import { fmtHMS, money, nf0, smoney, weight } from '../core/format.js';
import { RM, SET, applyMotion, saveSet } from '../core/settings.js';
import { METALS, NSLOTS, OBJ, TPC, runT } from '../data/content.js';
import { estRates, needs, openedMk, simulate } from '../game/economy.js';
import { tick, warmMarkets } from '../game/market.js';
import { setSilent } from '../game/progress.js';
import { S, cap, fresh, legAvail, migrate, save, setS } from '../game/state.js';
import { showNextTut } from './tutorial.js';

let resetConfirm = false;
export function renderReset(){
  const box = $('#resetBox');
  box.innerHTML = !resetConfirm ? '<button type="button" class="btn ghost" id="btnReset">Borrar partida</button>'
    : '<span>Se borra todo, también logros y legado.</span><button type="button" class="btn danger" id="btnResetYes">Sí, borrar</button><button type="button" class="btn ghost" id="btnResetNo">Cancelar</button>';
}
$('#resetBox').addEventListener('click', e => {
  const id = e.target.id;
  if (id === 'btnReset'){ resetConfirm = true; renderReset(); }
  if (id === 'btnResetNo'){ resetConfirm = false; renderReset(); }
  if (id === 'btnResetYes'){
    resetConfirm = false; setS(fresh()); warmMarkets(); emit('sceneReset'); resetKeys(); save(); renderReset();
    selectDesk('sell'); closeMenu(); showSection('mina'); toast('Partida nueva. Suerte con la veta.');
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
export function closeMenu(){ setTimeout(showNextTut, 300); $('#menu').hidden = true; $('#awayBox').hidden = true; K.imp = false; renderImport(); }
function selectMenuTab(t){
  menuTab = t;
  $$('.menu-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mtab === t)));
  $('#mHome').hidden = t !== 'home'; $('#mSet').hidden = t !== 'set'; $('#mHelp').hidden = t !== 'help';
  syncSettings();
}
$$('.menu-tabs button').forEach(b => b.addEventListener('click', () => { sfx('ui'); selectMenuTab(b.dataset.mtab); }));
$('#menu').addEventListener('click', e => { if (e.target.id === 'menu') closeMenu(); });
function syncSettings(){
  [['#setSound','sound'],['#setMotion','motion'],['#setToasts','toasts'],['#setTuts','tuts']].forEach(([sel,k]) => $$(sel + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === SET[k])));
}
[['#setSound','sound'],['#setMotion','motion'],['#setToasts','toasts'],['#setTuts','tuts']].forEach(([sel,k]) => $$(sel + ' button').forEach(b => b.addEventListener('click', () => {
  SET[k] = b.dataset.v; saveSet(); applyMotion(); document.body.classList.toggle('calm', RM); syncSettings(); sfx('ui');
})));
export function exportSave(){
  save();
  let code = '';
  try { code = btoa(unescape(encodeURIComponent(JSON.stringify(S)))); } catch(e){ return; }
  const ta = $('#saveCode'); ta.value = code;
  const done = () => toast('Código copiado. Guárdalo donde quieras.');
  try { navigator.clipboard.writeText(code).then(done, () => { ta.select(); toast('Selecciona el código y cópialo (Ctrl+C).'); }); }
  catch(e){ ta.select(); toast('Selecciona el código y cópialo (Ctrl+C).'); }
}
export function parseCode(){
  const raw = $('#saveCode').value.trim(); if (!raw) return null;
  try { const d = JSON.parse(decodeURIComponent(escape(atob(raw)))); if (!d || typeof d !== 'object' || d.money == null) return null; return d; } catch(e){ return null; }
}
export function renderImport(){
  const box = $('#importBox'); if (!box) return;
  box.innerHTML = !K.imp ? '<button type="button" class="btn sm" data-act="import1" id="btnImport">Cargar partida del código</button>'
    : '<span>Reemplaza la partida actual.</span><button type="button" class="btn sm danger" data-act="import2" id="btnImportYes">Sí, cargar</button><button type="button" class="btn sm ghost" data-act="import0" id="btnImportNo">Cancelar</button>';
}
export function doImport(){
  const d = parseCode(), err = $('#importErr');
  if (!d){ err.textContent = 'Ese código no es válido. Copia el código completo, sin espacios de más.'; err.hidden = false; K.imp = false; renderImport(); return; }
  err.hidden = true; setS(migrate(d)); emit('sceneReset'); resetKeys(); syncLamps(); save();
  K.imp = false; renderImport(); closeMenu(); showSection(S.section || 'mina'); toast('Partida cargada.', 'lv');
}
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
