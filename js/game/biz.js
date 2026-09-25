import { K, emit, sfx, toast, updateUI } from '../core/bus.js';
import { $ } from '../core/dom.js';
import { money, nf0, smoney } from '../core/format.js';
import { BIZ, DISTRICTS, NSLOTS, ROMAN } from '../data/content.js';
import { rec } from './economy.js';
import { earn, log, xpMoney } from './progress.js';
import { S, allStocks, axCost, bizCost, bizFull, mgrCost, sk, stComm, stageOf, unl } from './state.js';

/* ---- empresas ---- */
export function bizUp(id){
  const b = BIZ.find(x=>x.id===id); if (!b || !unl('biz') || S.level < b.lv) return;
  const st = S.biz[id] || (S.biz[id] = {lv:0});
  if (st.lv >= 30) return;
  const c = bizCost(b); if (S.money < c) return;
  S.money -= c; st.lv++;
  const s0 = stageOf(st.lv - 1), s1 = stageOf(st.lv);
  if (st.lv === 1){ toast(`Abres ${b.name.toLowerCase()} en ${DISTRICTS[b.district].en}`, 'up', 'imp'); }
  else if (s1 > s0){ toast(`¡${b.name} pasa a la etapa ${ROMAN[s1]}: ${b.stages[s1 - 1]}! +25 % de ingresos${s1 <= 4 ? ' y un anexo nuevo' : ''}`, 'lv', 'imp'); sfx('ach'); emit('bizStage', id); }
  else toast(`${b.name} sube a nivel ${st.lv}`, 'up');
  log(st.lv === 1 ? `Empresa nueva: ${b.name} (−${money(c)})` : `${b.name} a nivel ${st.lv}${s1 > s0 ? ` · etapa ${ROMAN[s1]}` : ''} (−${money(c)})`);
  emit('bizUp', id);
  xpMoney(c, .05); K.biz = ''; updateUI();
}
/* Construir un anexo: se abre con la etapa II, III o IV y se paga una sola vez. */
export function bizAnx(id, i){
  const b = BIZ.find(x=>x.id===id), st = S.biz[id], A = b && b.anexos[i]; if (!A || !st || !st.lv) return;
  st.ax ||= {}; if (st.ax[A.id] || stageOf(st.lv) < i + 2) return;
  const c = axCost(b, i); if (S.money < c) return;
  S.money -= c; st.ax[A.id] = 1;
  if (A.id === 'idi'){ S.sp = (S.sp || 0) + 1; K.nav = ''; }
  if (A.id === 'datos') S.tecF = Math.max(.8, S.tecF);
  toast(`${A.name} construido en ${b.name.toLowerCase()}: ${A.fx.charAt(0).toLowerCase() + A.fx.slice(1)}`, 'up', 'imp');
  log(`Anexo ${A.name} en ${b.name} (−${money(c)})`);
  sfx('buy'); emit('bizUp', id);
  xpMoney(c, .05); K.biz = ''; updateUI();
}
export function bizMgr(id){
  const b = BIZ.find(x=>x.id===id), st = S.biz[id]; if (!b || !st || !st.lv || st.mgr) return;
  const c = mgrCost(b); if (S.money < c) return;
  S.money -= c; st.mgr = true; toast(`Gerente contratado en ${b.name.toLowerCase()}: produce el doble`, 'up'); log(`Gerente en ${b.name} (−${money(c)})`); updateUI();
}
export function bizIpo(id){
  const b = BIZ.find(x=>x.id===id), st = S.biz[id]; if (!b || !st || st.pub || st.lv < 5 || !unl('ipo')) return;
  const val = bizFull(b)*900, cash = val*0.4*(sk('e6')?1.3:1), shares = Math.max(100, Math.round(val/20));
  st.pub = {shares};
  S.hold['own_'+id] = {n: shares*0.6, cost: 0};
  const s = {p: val/shares, hist:[], long:[], k:0, shock:0};
  for (let i=0;i<NSLOTS;i++){ s.hist.push(s.p); s.long.push(s.p); }
  S.stocks['own_'+id] = s;
  earn(cash, .1, 'otros'); S.flags.a_ipo = true;
  const msg = `${b.name} sale a bolsa: vendes el 40 % por ${money(cash)}`;
  toast(msg, 'up'); log(msg, 'up'); K.st = ''; K.biz = ''; updateUI();
}
export function bizPause(id){ const st = S.biz[id]; if (!st) return; st.paused = !st.paused; updateUI(); }

/* ---- bolsa ---- */
export function buyStock(n){
  const err = $('#sErr'); err.hidden = true;
  const id = S.selStock, s = S.stocks[id]; if (!s) return;
  n = Math.floor(n); if (!(n >= 1)) { err.textContent = 'Indica cuántas acciones.'; err.hidden = false; return; }
  const cost = n*s.p*(1+stComm());
  if (cost > S.money){ err.textContent = `No te llega: cuestan ${money(cost)} y tienes ${money(S.money)}.`; err.hidden = false; return; }
  S.money -= cost; const h = S.hold[id] || (S.hold[id] = {n:0, cost:0}); h.n += n; h.cost += cost;
  S.flags.a_stock = true;
  const d = allStocks().find(x=>x.id===id);
  log(`Compras ${nf0.format(n)} acciones de ${d.name} a ${money(s.p)}`); toast(`Compradas ${nf0.format(n)} acciones de ${d.name}`); updateUI();
}
export function sellStock(n){
  const err = $('#sErr'); err.hidden = true;
  const id = S.selStock, s = S.stocks[id], h = S.hold[id];
  n = Math.floor(n);
  if (!h || h.n < 1){ err.textContent = 'No tienes acciones de esta empresa.'; err.hidden = false; return; }
  n = Math.min(n, Math.floor(h.n)); if (!(n >= 1)) return;
  const rev = n*s.p*(1-stComm()), avg = h.cost/h.n, pnl = rev - avg*n;
  h.cost -= avg*n; h.n -= n; if (h.n < 1e-9){ h.n = 0; h.cost = 0; }
  if (pnl > 0){ S.money += rev - pnl; earn(pnl, .3, 'bolsa'); } else { S.money += rev; rec('bolsa', pnl); }
  S.stPnl += pnl;
  const d = allStocks().find(x=>x.id===id);
  const msg = `Vendes ${nf0.format(n)} acciones de ${d.name} · ${smoney(pnl)}`;
  log(msg, pnl >= 0 ? 'up' : 'down'); toast(msg, pnl >= 0 ? 'up' : 'down'); updateUI();
}
