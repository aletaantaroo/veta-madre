import { K, bump, emit, sfx, toast, updateUI } from '../core/bus.js';
import { money, niceRound, pfmt, pick, rnd, weight } from '../core/format.js';
import { CLIENTS, JOB_KINDS, METALS } from '../data/content.js';
import { rec } from './economy.js';
import { earn, log, silent } from './progress.js';
import { S, cap, clickEq, gpsEq, metalConv, mk, setDone, sk, unl } from './state.js';

/* ================= encargos =================
   Los clientes piden metal a cambio de una prima sobre el spot y un plazo (en horas del juego).
   Hay encargos normales, urgentes, grandes pedidos y cadenas de tres entregas con premio final.
   Cada cliente recuerda cuántas veces le has cumplido: con su confianza sube la prima y llegan las cadenas. */
let offerTimer = 20;

export const cliOf = id => CLIENTS.find(c => c.id === id);
const cliRec = id => ((S.cli ||= {})[id] ||= {n: 0, fail: 0});
export function trustLv(id){ const n = id && S.cli && S.cli[id] ? S.cli[id].n : 0; return n >= 12 ? 3 : n >= 6 ? 2 : n >= 2 ? 1 : 0; }
export const TRUST = ['Nuevo cliente', 'Conocido', 'Habitual', 'De toda la vida'];
export const jobKind = o => JOB_KINDS[o.kind] || JOB_KINDS.normal;
export const MAX_JOBS = 3;
/* Metal apartado para los encargos en curso: las ventas no lo tocan. */
export const reserved = m => (S.contracts || []).reduce((a, c) => a + (c.m === m ? c.g : 0), 0);

function baseQty(m){ return Math.max(clickEq()*metalConv(m)*rnd(25, 50), gpsEq()*metalConv(m)*rnd(60, 160)); }
function pickKind(C){
  const r = Math.random(), lv = S.level, trust = trustLv(C.id);
  if (lv >= JOB_KINDS.cadena.lv && (trust >= 1 || C.chain) && r < .12 + (C.chain || 0)) return 'cadena';
  const r2 = Math.random();
  if (lv >= JOB_KINDS.grande.lv && r2 < .1 + (C.big || 0)) return 'grande';
  if (lv >= JOB_KINDS.urgente.lv && Math.random() < .15 + (C.urgent || 0)) return 'urgente';
  return 'normal';
}
function premFor(C, J){
  return rnd(...J.prem) + (C.prem || 0) + S.rep*0.008 + trustLv(C.id)*0.02 + (sk('t3') ? .03 : 0) + (S.perks.p_clients ? .05 : 0) + (setDone('his') ? .10 : 0);
}
function stepQty(m, J, step){ return niceRound(Math.min(baseQty(m)*rnd(...J.mult)*(J.steps ? [1, 1.4, 1.9][step] : 1), cap(m)*0.9)); }
function makeOffer(){
  const cands = CLIENTS.filter(C => C.m.some(m => S.opened[m]) && !S.offers.some(o => o.cid === C.id) && !S.contracts.some(c => c.cid === C.id && c.kind === 'cadena'));
  if (!cands.length) return;
  const C = pick(cands), m = pick(C.m.filter(x => S.opened[x])), kind = pickKind(C), J = JOB_KINDS[kind];
  const g = stepQty(m, J, 0); if (!(g > 0)) return;
  const prem = premFor(C, J), price = mk(m).price*(1 + prem);
  const o = {id: S.uid++, cid: C.id, client: C.name, m, kind, g, price, prem, time: Math.round(rnd(...J.t)/5)*5, pen: 0.25*g*price, exp: 45};
  if (J.steps){ o.step = 0; o.steps = J.steps; }
  S.offers.push(o); K.off = '';
  if (!silent) toast(`Nuevo encargo de ${C.name}: ${weight(g)} de ${METALS[m].low}${kind !== 'normal' ? ` (${J.name.toLowerCase().replace(/[¡!]/g, '')})` : ''}`);
}
export function contractsTick(){
  if (unl('contracts') && S.offers.length < 3 && (offerTimer -= 1) <= 0){ makeOffer(); offerTimer = rnd(35, 75)*(sk('t3') ? .6 : 1); }
  for (const o of S.offers.slice()) if ((o.exp -= 1) <= 0){ S.offers.splice(S.offers.indexOf(o), 1); K.off = ''; }
  for (const c of S.contracts.slice()){
    if (!c.ready && S.stock[c.m] >= c.g){ c.ready = true; if (!silent) toast(`Ya tienes el metal para ${c.client}: entrégalo desde la mina`, 'up'); K.jobs = ''; }
    if (c.ready && S.stock[c.m] < c.g) c.ready = false;
    if ((c.left -= 1) <= 0) failJob(c);
  }
}
function failJob(c){
  S.contracts.splice(S.contracts.indexOf(c), 1); K.con = ''; K.jobs = '';
  const pen = Math.min(Math.max(0, S.money), c.pen); S.money -= pen; rec('contratos', -pen);
  S.rep = Math.max(0, S.rep - 1); S.conFail++;
  if (c.cid){ const R = cliRec(c.cid); R.fail++; R.n = Math.max(0, R.n - 2); }
  const msg = `Encargo incumplido con ${c.client}: penalización de ${money(pen)}${c.steps ? ' y se rompe la cadena' : ''}`;
  log(msg, 'down'); toast(msg, 'down');
}
export function acceptOffer(id){
  const o = S.offers.find(x => x.id === id); if (!o) return;
  if (S.contracts.length >= MAX_JOBS){ toast(`Tienes ${MAX_JOBS} encargos en curso. Entrega alguno antes de aceptar más.`); return; }
  S.offers.splice(S.offers.indexOf(o), 1);
  S.contracts.push({id: o.id, cid: o.cid, m: o.m, client: o.client, kind: o.kind || 'normal', g: o.g, price: o.price, prem: o.prem, pen: o.pen, left: o.time, time: o.time, step: o.step, steps: o.steps, paid: 0});
  log(`Aceptas entregar ${weight(o.g)} de ${METALS[o.m].low} a ${o.client} a ${pfmt(o.m, o.price)}`);
  K.off = K.con = K.jobs = ''; sfx('ui'); updateUI();
}
export function rejectOffer(id){ const i = S.offers.findIndex(x => x.id === id); if (i >= 0){ S.offers.splice(i, 1); K.off = ''; updateUI(); } }
/* Lo que pagará la cadena entera al completarse (premio aparte de cada entrega). */
export const chainBonus = c => (c.paid + c.g*c.price)*JOB_KINDS.cadena.bonus;
export function deliver(id){
  const c = S.contracts.find(x => x.id === id); if (!c) return;
  if (S.stock[c.m] < c.g){ toast(`Te faltan ${weight(c.g - S.stock[c.m])} de ${METALS[c.m].low} para ${c.client}.`); return; }
  const J = jobKind(c);
  S.stock[c.m] -= c.g; S.sold += c.g*METALS[c.m].p0/80;
  const rev = c.g*c.price; earn(rev, J.xp, 'contratos');
  S.rep = Math.min(5, S.rep + J.rep); S.conDone++;
  const st = (S.jobStats ||= {}); st[c.kind] = (st[c.kind] || 0) + 1;
  let msg = `Entregado a ${c.client}: ${weight(c.g)} de ${METALS[c.m].low} · +${money(rev)}`;
  const i = S.contracts.indexOf(c);
  if (c.steps && c.step < c.steps - 1){
    // la cadena sigue: el siguiente pedido es más grande y llega con plazo nuevo
    const paid = c.paid + rev, step = c.step + 1, g = stepQty(c.m, J, step), price = mk(c.m).price*(1 + c.prem);
    S.contracts[i] = {...c, id: S.uid++, step, paid, g, price, pen: 0.25*g*price, left: Math.round(rnd(...J.t)/5)*5, ready: false};
    msg += ` · cadena ${step}/${c.steps}`;
  } else {
    S.contracts.splice(i, 1);
    if (c.steps){
      const bonus = (c.paid + rev)*J.bonus; earn(bonus, 1.2, 'contratos'); S.rep = Math.min(5, S.rep + 1); st.chain = (st.chain || 0) + 1;
      msg = `¡Cadena completa con ${c.client}! Premio de ${money(bonus)} además del pago`;
      if (!silent) emit('chainDone', c);
    }
  }
  if (c.cid){
    const before = trustLv(c.cid); cliRec(c.cid).n++;
    const after = trustLv(c.cid);
    if (after > before) toast(`${c.client} ya te considera «${TRUST[after]}»: mejores precios${after === 1 ? ' y pedidos en cadena' : ''}`, 'lv');
  }
  K.con = K.jobs = '';
  log(msg, 'up'); toast(msg, 'up'); bump('#pillMoney'); sfx('sell'); emit('sold', c.m, rev, false); updateUI();
}
