import { K, toast, updateUI } from '../core/bus.js';
import { $ } from '../core/dom.js';
import { money, nf0, smoney } from '../core/format.js';
import { BIZ, NSLOTS } from '../data/content.js';
import { rec } from './economy.js';
import { addXp, earn, log } from './progress.js';
import { S, allStocks, bizCost, bizFull, mgrCost, sk, stComm, unl } from './state.js';

/* ---- empresas ---- */
export function bizUp(id){
  const b = BIZ.find(x=>x.id===id); if (!b || !unl('biz') || S.level < b.lv) return;
  const st = S.biz[id] || (S.biz[id] = {lv:0});
  if (st.lv >= 30) return;
  const c = bizCost(b); if (S.money < c) return;
  S.money -= c; st.lv++;
  toast(st.lv === 1 ? `Abres ${b.name.toLowerCase()}` : `${b.name} sube a nivel ${st.lv}`, 'up');
  log(st.lv === 1 ? `Empresa nueva: ${b.name} (−${money(c)})` : `${b.name} a nivel ${st.lv} (−${money(c)})`);
  addXp(c*0.05); K.biz = ''; updateUI();
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
