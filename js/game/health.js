import { fmtT, money, nf0 } from '../core/format.js';
import { CREW, METALS } from '../data/content.js';
import { estRates, needs, openedMk, repairCost } from './economy.js';
import { MORAL_MIN, S, cap, crewMult, fac, gps, maintF, moralF, opF, physPrice } from './state.js';

/* ================= salud de la compañía =================
   Qué va mal, cuánto te está costando y cómo arreglarlo. Nivel 0: todo bien · 1: atención · 2: problemas. */

/* Rendimiento real del equipo frente al que tendría sin problemas (energía, combustible, explosivos, desgaste y moral). */
export function efficiency(){
  let pot = 0, act = 0;
  CREW.forEach(c => { const n = S.owned[c.id] || 0; if (!n) return; const v = n*c.gps*crewMult(c.id); pot += v; act += v*opF(c); });
  return pot > 0 ? act/pot : 1;
}
/* Valor de lo que sacan ahora mismo tus minas (una mina con el almacén lleno no produce). */
export function prodValue(){ return openedMk().reduce((a, m) => a + (S.stock[m] < cap(m) ? gps(m)*physPrice(m) : 0), 0); }

export function health(){
  const L = [], ms = openedMk();
  const full = ms.filter(m => S.stock[m] >= cap(m));
  if (full.length) L.push({lv: full.length === ms.length ? 2 : 1, key: 'full', short: 'almacén lleno',
    txt: `Almacén de ${full.map(m => METALS[m].low).join(' y ')} lleno: ${full.length > 1 ? 'esas minas están paradas' : 'esa mina está parada'}`, fix: 'Vende o amplía la caja fuerte', act: 'buyCap'});
  if (S.moral <= 0) L.push({lv: 2, key: 'strike', short: 'huelga', txt: `Huelga: la plantilla trabaja al ${nf0.format(MORAL_MIN*100)} %`, fix: `Paga ${money(S.arrears)} de atrasos`, act: 'payArrears'});
  else if (S.moral < 60) L.push({lv: 1, key: 'moral', short: 'moral baja', txt: `Moral baja (${nf0.format(S.moral)} %): la plantilla rinde al ${nf0.format(moralF()*100)} %`, fix: 'Paga las nóminas a tiempo', go: 'finanzas'});
  if (S.arrears > 0 && S.moral > 0) L.push({lv: 2, key: 'arrears', short: 'nóminas sin pagar', txt: `Nóminas sin pagar: ${money(S.arrears)}. Cada paga que falles baja la moral`, fix: 'Pagar atrasos', act: 'payArrears'});
  if (fac.e < .99) L.push({lv: fac.e < .5 ? 2 : 1, key: 'energy', short: 'sin energía', txt: `Falta energía: las máquinas rinden al ${nf0.format(fac.e*100)} %`, fix: 'Compra energía o pon paneles', go: 'finanzas'});
  if (fac.f < .99) L.push({lv: 1, key: 'fuel', short: 'sin combustible', txt: 'Falta combustible: excavadoras y tuneladoras van a medio gas', fix: 'Compra combustible', go: 'finanzas'});
  if (fac.x < .99) L.push({lv: 1, key: 'tnt', short: 'sin explosivos', txt: 'Faltan explosivos: las voladuras se paran', fix: 'Compra explosivos', go: 'finanzas'});
  if (needs().mv && S.maint < 50) L.push({lv: S.maint < 25 ? 2 : 1, key: 'maint', short: 'máquinas gastadas', txt: `Maquinaria al ${nf0.format(S.maint)} %: rinde al ${nf0.format(maintF()*100)} %`, fix: `Reparar · ${money(repairCost())}`, act: 'repair'});
  if (!S.arrears && S.nomina > 0 && S.money < S.nomina*60 && S.payT < 25 && !S.autoPay) L.push({lv: 1, key: 'pay', short: 'nómina en camino', txt: `Nómina de ${money(S.nomina*60)} en ${fmtT(S.payT)} y no te llega la caja`, fix: 'Vende metal'});
  const R = estRates();
  if (R.net < 0 && !full.length) L.push({lv: S.debt > 0 ? 2 : 1, key: 'loss', short: 'pierdes dinero', txt: `Gastas ${money(-R.net)}/s más de lo que ingresas${S.debt > 0 ? ` y debes ${money(S.debt)} al banco` : ''}`, go: 'finanzas'});
  L.sort((a, b) => b.lv - a.lv);
  return {lv: L.reduce((a, x) => Math.max(a, x.lv), 0), list: L};
}
export const HEALTH_TXT = ['Todo en orden', 'Atención', 'Problemas'];
/* Producción que estás dejando de ganar por culpa de los problemas (en €/s). */
export function prodLoss(){
  const e = Math.max(.01, efficiency());
  const pot = openedMk().reduce((a, m) => a + gps(m)/e*physPrice(m), 0);
  return Math.max(0, pot - prodValue());
}
