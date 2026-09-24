import { emit, toast, updateUI } from '../core/bus.js';
import { clamp, gauss, money, nf0, nf2, nf3 } from '../core/format.js';
import { BIZ, CREW, DAY_LEN, METALS, MK, RES, syn } from '../data/content.js';
import { sell } from './market.js';
import { earn, log, silent, xpMoney } from './progress.js';
import { S, bizInc, bizMult, bizTotal, cap, crewMult, fac, gps, has, jewelPrice, jewelRate, metalConv, mk, ownFrac, physPrice, prodMult, sk, unl } from './state.js';

/* ================= operaciones: recursos, gastos, finanzas ================= */

export const capR = k => RES[k].base*Math.pow(3, S.resLv[k]);
export const capRCost = k => RES[k].cost*Math.pow(3.3, S.resLv[k]);
export const isDay = () => (S.tarT % DAY_LEN) >= DAY_LEN/2;
/* Reloj del juego: S.tarT son los segundos del ciclo (0 = 18:00, DAY_LEN/2 = 06:00) y S.day cuenta las medianoches. */
export const gameMin = () => (1080 + S.tarT/DAY_LEN*1440) % 1440;
export const hhmm = m => `${String(Math.floor(m/60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
const toGameMin = sec => sec/DAY_LEN*1440;
/* Hora y día del juego dentro de «sec» segundos reales, para plazos. */
export function whenTxt(sec){
  const m = gameMin() + toGameMin(sec), d = Math.floor(m/1440);
  return `${d === 0 ? 'hoy' : d === 1 ? 'mañana' : `el día ${(S.day || 0) + d}`} a las ${hhmm(m % 1440)}`;
}
function advanceClock(dt){
  const mid = DAY_LEN/4, a = S.tarT, b = a + dt;
  if ((a < mid && b >= mid) || (a < mid + DAY_LEN && b >= mid + DAY_LEN)){ S.day = (S.day || 0) + 1; if (!silent) emit('newDay', S.day); }
  S.tarT = b % DAY_LEN;
}
const ePrice = () => (isDay() && !sk('o9') ? .20 : .08)*Math.exp(S.px.ex);
const fPrice = () => 1.2*Math.exp(S.px.fx);
const xPrice = () => 6*Math.exp(S.px.xx);
export const rPrice = k => k === 'e' ? ePrice() : k === 'f' ? fPrice() : xPrice();
export const rUnitFmt = (k,p) => (k === 'e' ? nf3.format(p) : nf2.format(p)) + ' €/' + RES[k].unit;
export const solarOut = () => isDay() ? S.solar*100*(sk('o8') ? 2 : 1) : 0;
const perkHalf = () => S.perks && S.perks.p_plants ? .5 : 1;
export const solarCost = () => 15000*Math.pow(1.15, S.solar)*perkHalf();
export const windOut = () => S.wind*80*S.windF*(sk('o8') ? 2 : 1);
export const windCost = () => 25000*Math.pow(1.15, S.wind)*perkHalf();
export const plantCost = k => (k === 'f' ? 40000 : 35000)*Math.pow(1.15, k === 'f' ? S.plants.bio : S.plants.fab)*perkHalf();
export const plantOut = k => k === 'f' ? S.plants.bio*20 : S.plants.fab*4;
const plantsOn = () => ({bio: S.res.f < capR('f') ? S.plants.bio : 0, fab: S.res.x < capR('x') ? S.plants.fab : 0});
const effE = () => (has('u_ahorro') ? .75 : 1)*(sk('o2') ? .8 : 1);
const salF = () => (sk('o6') ? .8 : 1)*(syn('equipo') ? .9 : 1);
const supF = () => sk('o4') ? .75 : 1;
export function needs(){
  let e=0, f=0, x=0, sal=0, mv=0;
  CREW.forEach(c => { const n = S.owned[c.id]||0; if (!n) return; const v = c.gps*80*n; sal += v*c.sal*salF(); if (c.e){ e += v*effE(); mv += n*c.cost; } if (c.f) f += v*.1/1.2*supF(); if (c.x) x += v*.08/6*supF(); });
  return {e, f, x, sal, mv};
}
export const repairCost = () => (100 - S.maint)/100*needs().mv*0.03;
export const loanLimit = () => Math.round(1000*Math.pow(1.55, S.level-1));
export const LOAN_RATE = 0.005;
export const taxRate = () => has('u_asesor') ? .05 : .10;
function bizFixed(b){ const st = S.biz[b.id]; if (!st || !st.lv) return 0; return 0.3*b.inc*st.lv*Math.pow(1.06,st.lv)*bizMult()*(st.mgr?2:1)*ownFrac(b); }
const bizFixedTotal = () => BIZ.reduce((a,b)=>a+bizFixed(b),0);

export function rec(cat, v){ S.fin.cur[cat] = (S.fin.cur[cat]||0) + v; if (unl('taxes') && cat !== 'impuestos') S.taxBase += v; }
function spend(v, cat){ if (!(v > 0)) return; S.money -= v; rec(cat, -v); }
function spendOrDebt(v, cat){ if (!(v > 0)) return; const p = Math.min(v, Math.max(0, S.money)); S.money -= p; if (v - p > 1e-9) S.debt += v - p; rec(cat, -v); }
function consume(k, need){
  if (need <= 0) return 1;
  if (S.auto[k] && S.res[k] < need + capR(k)*0.2){
    const p = rPrice(k), b = Math.min(capR(k) - S.res[k] + need, Math.max(0,S.money)/p);
    if (b > 0){ S.res[k] += b; spend(b*p, RES[k].cat); }
  }
  const u = Math.min(S.res[k], need); S.res[k] -= u; return u/need;
}
function sellForCash(deficit){
  let got = 0;
  MK.forEach(m => {
    if (got >= deficit || !S.opened[m] || !(S.stock[m] > 0)) return;
    const pp = physPrice(m), take = Math.min(S.stock[m], (deficit - got)/pp);
    S.stock[m] -= take; S.sold += take*METALS[m].p0/80; earn(take*pp, .06, 'metal'); got += take*pp;
  });
  if (got > 0) log(`Tu administrador vende metal por ${money(got)} para pagar las nóminas`);
}
function payday(total){
  const owed = total + S.arrears;
  if (S.money < owed && S.autoPay) sellForCash(owed - Math.max(0, S.money));
  const p = Math.min(owed, Math.max(0, S.money));
  S.money -= p; rec('nominas', -p); S.arrears = owed - p;
  if (S.arrears > 0.01){
    S.unpaid = true; S.moral = Math.max(sk('o10') ? 60 : 0, S.moral - (sk('o1') ? 12 : 25));
    const msg = S.moral <= 0 ? `Huelga: la plantilla trabaja al mínimo hasta que pagues ${money(S.arrears)} de atrasos` : `No llegas a pagar las nóminas: debes ${money(S.arrears)} y la moral baja al ${nf0.format(S.moral)} %`;
    toast(msg, 'down'); log(msg, 'down');
  } else { S.arrears = 0; if (total > 0) S.moral = Math.min(100, S.moral + (has('u_comedor') ? 25 : 10)); }
}
export const openedMk = () => MK.filter(m => S.opened[m]);
export const mineCostMult = () => 1 + 0.5*(openedMk().length - 1);
const rawGps = m => CREW.reduce((a,c)=>a+(S.owned[c.id]||0)*c.gps*crewMult(c.id),0)*prodMult()*metalConv(m);
export let util = 1;
function calcUtil(dt){
  const ms = openedMk(); let u = 0;
  ms.forEach(m => { const pot = rawGps(m)*dt, room = cap(m) - S.stock[m]; u += pot > 0 ? clamp(room/pot, 0, 1) : 1; });
  return ms.length ? u/ms.length : 1;
}
function econStep(dt){
  advanceClock(dt);
  util = calcUtil(dt);
  const N0 = needs(), cm = mineCostMult();
  const N = {e:N0.e*cm*util, f:N0.f*cm*util, x:N0.x*cm*util, sal:N0.sal*cm*(0.2 + 0.8*util), mv:N0.mv};
  S.nomina = N.sal;
  const PO = plantsOn(), plantE = PO.bio*60 + PO.fab*40;
  const need = (N.e + plantE)*dt; let got = 0;
  const sol = (solarOut() + windOut())*dt, useS = Math.min(sol, need); got += useS;
  S.res.e = Math.min(capR('e'), S.res.e + (sol - useS));
  let r = need - got; const u = Math.min(S.res.e, r); S.res.e -= u; got += u; r -= u;
  if (r > 0 && S.auto.e){ const p = ePrice(), b = Math.min(r, Math.max(0,S.money)/p); if (b > 0){ spend(b*p, 'energia'); got += b; } }
  if (S.auto.eCharge && !isDay()){ const room = capR('e') - S.res.e; if (room > 0){ const p = ePrice(), b = Math.min(room, capR('e')*0.05*dt, Math.max(0,S.money)/p); if (b > 0){ S.res.e += b; spend(b*p, 'energia'); } } }
  fac.e = need > 0 ? got/need : 1;
  if (PO.bio) S.res.f = Math.min(capR('f'), S.res.f + PO.bio*20*dt*fac.e);
  if (PO.fab) S.res.x = Math.min(capR('x'), S.res.x + PO.fab*4*dt*fac.e);
  fac.f = consume('f', N.f*dt);
  fac.x = consume('x', N.x*dt);
  openedMk().forEach(m => { const g = gps(m), c = cap(m); if (S.stock[m] < c && g > 0){ const add = Math.min(g*dt, c - S.stock[m]); S.stock[m] += add; S.mined += add*METALS[m].p0/80; } });
  if (S.autoSell && has('u_agente')) openedMk().forEach(m => { if (S.stock[m] >= cap(m)) sell(m, 0.5, 'Venta automática'); });
  if (S.perks.p_auto && S.autoMine.on) openedMk().forEach(m => {
    S.autoMineT[m] = (S.autoMineT[m] || 0) - dt; if (S.autoMineT[m] > 0) return;
    const sm = mk(m), mean = sm.hist.reduce((a,b)=>a+b,0)/Math.max(1, sm.hist.length), fill = S.stock[m]/cap(m);
    if (fill >= .9 || (fill >= .2 && sm.price >= mean*(1 + S.autoMine.th))){ sell(m, fill >= .9 ? .5 : .35, 'Venta automática de la mina'); S.autoMineT[m] = fill >= .9 ? 2 : 8; }
  });
  if (N.mv > 0){
    const dec = dt/12*(has('u_taller') ? .5 : 1)*(sk('o3') ? .6 : 1)*(sk('o10') ? 0 : 1)*util;
    if (S.maintAuto){ if (S.maint < 100){ const c2 = repairCost(); spendOrDebt(c2*1.2, 'mantenimiento'); S.maint = 100; } spendOrDebt(dec/100*N.mv*0.03*1.2, 'mantenimiento'); }
    else S.maint = Math.max(0, S.maint - dec);
  }
  BIZ.forEach(b => { const inc = bizInc(b)*dt; if (inc > 0) earn(inc, .03, 'empresas'); spendOrDebt(bizFixed(b)*dt, 'gastosEmp'); });
  const jr = jewelRate();
  if (jr && S.stock.au > 0){ const used = Math.min(S.stock.au, jr*dt); S.stock.au -= used; earn(used*jewelPrice()*ownFrac(BIZ[0]), .03, 'empresas'); }
  if (S.debt > 0) spendOrDebt(S.debt*LOAN_RATE/60*dt, 'intereses');
  if (S.arrears <= 0) S.moral = Math.min(100, S.moral + dt/(sk('o1') ? 15 : 30));
  if (sk('o10') && S.moral < 60) S.moral = 60;
  if ((S.payT -= dt) <= 0){ S.payT += 60; payday(N.sal*60); }
  if (unl('taxes') && (S.taxT -= dt) <= 0){
    S.taxT += 300; const tax = Math.max(0, S.taxBase)*taxRate();
    if (tax > 0){ spendOrDebt(tax, 'impuestos'); log(`Hacienda cobra ${money(tax)} (${nf0.format(taxRate()*100)} % de tus beneficios de 5 min)`, 'down'); toast(`Impuestos: −${money(tax)}`, 'down'); }
    S.taxBase = 0;
  }
  if ((S.fin.t += dt) >= 60){
    S.fin.t -= 60; S.fin.last = S.fin.cur; S.fin.cur = {};
    S.fin.hist.push(Object.values(S.fin.last).reduce((a,b)=>a+b,0)); if (S.fin.hist.length > 30) S.fin.hist.shift();
  }
}
export function simulate(el){ while (el > 1e-9){ const d = Math.min(5, el); econStep(d); el -= d; } }
export function resTick(){
  const px = S.px; let sh;
  sh = Math.abs(px.fs) > .0005 ? px.fs*.3 : (px.fs = 0); px.fs -= sh;
  px.fx = clamp(px.fx - .01*px.fx + .007*gauss() + sh, -.8, .8);
  sh = Math.abs(px.es) > .0005 ? px.es*.3 : (px.es = 0); px.es -= sh;
  px.ex = clamp(px.ex - .05*px.ex + .01*gauss() + sh, -.6, 1);
  px.xx = clamp(px.xx - .02*px.xx + .003*gauss(), -.3, .3);
  S.windF = clamp(S.windF + .04*(.8 - S.windF) + .06*gauss(), .05, 1.5);
}
export function estRates(){
  const N0 = needs(), cm = mineCostMult(), u = util;
  const N = {e:N0.e*cm*u, f:N0.f*cm*u, x:N0.x*cm*u, sal:N0.sal*cm*(0.2+0.8*u), mv:N0.mv};
  const inc = openedMk().reduce((a,m) => a + (S.stock[m] < cap(m) ? gps(m)*physPrice(m) : 0), 0) + bizTotal();
  const PO = plantsOn(), eGrid = Math.max(0, N.e*fac.e + PO.bio*60 + PO.fab*40 - solarOut() - windOut());
  const exp = N.sal + eGrid*ePrice() + Math.max(0, N.f*fac.f - PO.bio*20)*fPrice() + Math.max(0, N.x*fac.x - PO.fab*4)*xPrice() + bizFixedTotal() + S.debt*LOAN_RATE/60
    + (S.maintAuto && N.mv ? (1/12)*(has('u_taller')?.5:1)*(sk('o3')?.6:1)*(sk('o10')?0:1)*u/100*N.mv*.03*1.2 : 0);
  return {inc, exp, net: inc - exp};
}
export function buyRes(k){
  const room = capR(k) - S.res[k], p = rPrice(k), b = Math.min(room, Math.max(0,S.money)/p);
  if (b < 1){ toast(room < 1 ? `Tu ${RES[k].store} ya está lleno.` : 'No tienes caja para comprar.'); return; }
  S.res[k] += b; spend(b*p, RES[k].cat);
  toast(`Compras ${nf0.format(b)} ${RES[k].unit} de ${RES[k].name.toLowerCase()} por ${money(b*p)}`); updateUI();
}
export function upRes(k){ const c = capRCost(k); if (S.money < c) return; S.money -= c; S.resLv[k]++; toast(`Amplías tu ${RES[k].store}: caben ${nf0.format(capR(k))} ${RES[k].unit}`); updateUI(); }
export function buyWind(){ const c = windCost(); if (S.money < c) return; S.money -= c; S.wind++; xpMoney(c, .05); toast(`Aerogenerador instalado (${S.wind}). Produce día y noche según el viento.`, 'up'); updateUI(); }
export function buyPlant(k){ const c = plantCost(k); if (S.money < c) return; S.money -= c; xpMoney(c, .05); if (k === 'f') S.plants.bio++; else S.plants.fab++; toast(k === 'f' ? 'Planta de biodiésel en marcha: 20 L/s a cambio de energía' : 'Fábrica de explosivos en marcha: 4 kg/s a cambio de energía', 'up'); updateUI(); }
export function buySolar(){ const c = solarCost(); if (S.money < c) return; S.money -= c; xpMoney(c, .05); S.solar++; toast(`Panel solar instalado (${S.solar}). De día genera ${nf0.format(S.solar*100)} kWh/s.`, 'up'); log(`Panel solar nº ${S.solar} (−${money(c)})`); updateUI(); }
export function repair(){
  const c = repairCost(); if (c <= 0.01) return;
  if (S.money < c){ toast(`Reparar cuesta ${money(c)}.`); return; }
  if (S.maint < 30) S.flags.a_fix = true;
  spend(c, 'mantenimiento'); S.maint = 100; toast('Maquinaria reparada al 100 %', 'up'); log(`Reparas la maquinaria (−${money(c)})`); updateUI();
}
export function payArrears(){
  const p = Math.min(S.arrears, Math.max(0, S.money)); if (p <= 0) return;
  S.money -= p; rec('nominas', -p); S.arrears -= p;
  if (S.arrears < .01){ S.arrears = 0; S.moral = Math.max(S.moral, 40); toast('Atrasos pagados: la plantilla vuelve al trabajo', 'up'); log('Pagas los atrasos de nóminas', 'up'); }
  updateUI();
}
export function borrow(frac){
  if (!unl('loans')) return;
  const a = Math.floor(Math.max(0, loanLimit() - S.debt)*frac);
  if (a < 1){ toast('Has llegado a tu límite de crédito.'); return; }
  S.debt += a; S.money += a; S.borrowed = true;
  log(`Pides un préstamo de ${money(a)}`); toast(`Préstamo concedido: +${money(a)}`); updateUI();
}
export function repay(frac){
  const a = Math.min(S.debt*frac, Math.max(0, S.money)); if (a <= 0) return;
  S.debt -= a; S.money -= a; if (S.debt < .01) S.debt = 0;
  log(`Devuelves ${money(a)} al banco`); toast(`Devueltos ${money(a)} al banco`); updateUI();
}
