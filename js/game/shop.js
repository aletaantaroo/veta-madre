import { K, drawChart, emit, queueTut, sfx, syncLamps, toast, updateUI } from '../core/bus.js';
import { money } from '../core/format.js';
import { METALS } from '../data/content.js';
import { addXp, log } from './progress.js';
import { S, costN, has, maxN } from './state.js';

/* ---- tienda de la mina ---- */
export let qty = 1;
export function setQty(v){ qty = v; }
export function buyCrew(c){
  const n = qty==='max' ? maxN(c) : qty; if (n < 1) return;
  const cost = costN(c,n); if (S.money < cost) return;
  S.money -= cost; S.owned[c.id] = (S.owned[c.id]||0) + n; addXp(cost*0.05);
  sfx('buy'); emit('bought', c.id, n);
  syncLamps(); updateUI();
}
export function buyUp(u){
  if (has(u.id) || S.money < u.cost) return;
  S.money -= u.cost; S.ups[u.id] = true; addXp(u.cost*0.05); sfx('buy');
  if (u.id === 'u_broker') queueTut('broker'); if (u.id === 'u_agente') queueTut('agente'); if (u.id === 'u_analista') queueTut('analista');
  toast(`Mejora comprada: ${u.name}`); log(`Mejora: ${u.name} (−${money(u.cost)})`);
  drawChart(); updateUI();
}
export function openVein(m){
  const M = METALS[m];
  if (S.opened[m]){ S.vein = m; K.vein = ''; updateUI(); return; }
  if (S.level < M.lv){ toast(`El yacimiento de ${M.low} se desbloquea en el nivel ${M.lv}.`); return; }
  if (S.money < M.open){ toast(`Abrir el yacimiento de ${M.low} cuesta ${money(M.open)}.`); return; }
  S.money -= M.open; addXp(M.open*0.05); S.opened[m] = true; S.vein = m; K.vein = K.mkt = ''; sfx('lv'); emit('layout');
  toast(`Yacimiento de ${M.low} abierto. Tu equipo ya trabaja esa veta.`, 'up'); log(`Abres el yacimiento de ${M.low} (−${money(M.open)})`, 'up');
  updateUI();
}
