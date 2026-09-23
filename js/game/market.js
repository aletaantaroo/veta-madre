import { K, bump, drawChart, emit, setTicker, sfx, toast, updateUI } from '../core/bus.js';
import { $ } from '../core/dom.js';
import { clamp, fromUnit, gauss, money, nf0, pfmt, pick, rnd, smoney, weight } from '../core/format.js';
import { BIZ, BIZ_EV, EVENTS, METALS, MK, NEWS, NSLOTS, REGIMES, RES_NEWS, STOCKS, ST_NEG, ST_POS, TPC } from '../data/content.js';
import { needs, rec, resTick } from './economy.js';
import { contractsTick, reserved } from './jobs.js';
import { checkAch, earn, log, silent } from './progress.js';
import { S, ask, bid, bizCount, bizFull, bizLvl, cap, capCost, fee, has, impactOf, mk, newStock, posPnl, refineBonus, sk, unl } from './state.js';

/* ================= mercados ================= */
let newsTimer = 35, autoSellCd = 0, divTimer = 60, tecTimer = 60, bizEvTimer = 90, stEvTimer = 50;
function setPrice(m){
  const s = mk(m); s.price = s.fund*Math.exp(s.x);
  if (s.hist.length) s.hist[s.hist.length-1] = s.price;
  if (s.cur){ s.cur.c = s.price; s.cur.h = Math.max(s.cur.h, s.price); s.cur.l = Math.min(s.cur.l, s.price); }
}
function mTick(m){
  const s = mk(m), M = METALS[m];
  if ((s.regime.left -= 1) <= 0){
    let i; do { i = Math.floor(Math.random()*REGIMES.length); } while (i === s.regime.i);
    s.regime = {i, left: Math.round(rnd(90, 240))};
  }
  const R = REGIMES[s.regime.i], vol = R.vol*(1 + s.volBoost);
  s.volBoost *= 0.96;
  let sh = 0;
  if (Math.abs(s.shock) > 0.0005){ sh = s.shock*0.35; s.shock -= sh; } else s.shock = 0;
  const old = s.price;
  s.x = clamp(s.x - 0.02*s.x + M.sig*vol*gauss() + sh, -0.7, 0.7);
  s.fund = clamp(s.fund*Math.exp(R.mu + M.fvol*vol*gauss()), M.p0*.35, M.p0*10);
  s.price = s.fund*Math.exp(s.x);
  s.hist.push(s.price); if (s.hist.length > NSLOTS) s.hist.shift();
  const p = s.price;
  if (!s.cur) s.cur = {o:p, h:p, l:p, c:p, n:0};
  s.cur.h = Math.max(s.cur.h, p); s.cur.l = Math.min(s.cur.l, p); s.cur.c = p; s.cur.n++;
  if (s.cur.n >= TPC){ s.candles.push({o:s.cur.o, h:s.cur.h, l:s.cur.l, c:s.cur.c}); if (s.candles.length > NSLOTS) s.candles.shift(); s.cur = null; }
  return Math.log(s.price/old);
}
function pushS(s){ s.hist.push(s.p); if (s.hist.length > NSLOTS) s.hist.shift(); if ((s.k = (s.k||0) + 1) % TPC === 0){ s.long.push(s.p); if (s.long.length > NSLOTS) s.long.shift(); } }
function sTick(rets){
  const f = 0.0015*gauss();
  STOCKS.forEach(d => {
    const s = S.stocks[d.id] || (S.stocks[d.id] = newStock(d));
    if (s.fund == null){ s.fund = s.p; s.x = 0; }
    s.fund = Math.max(0.5, s.fund*Math.exp(d.mu + 0.3*d.vol*gauss()));
    let dx = d.vol*gauss() + f;
    for (const k in d.beta) dx += d.beta[k]*(rets[k]||0);
    if (Math.abs(s.shock) > 0.0005){ const sh = s.shock*0.35; s.shock -= sh; s.fund *= Math.exp(sh*0.5); dx += sh*0.5; } else s.shock = 0;
    s.x = clamp(s.x - 0.02*s.x + dx, -0.8, 0.8);
    s.p = Math.max(0.5, s.fund*Math.exp(s.x)); pushS(s);
  });
  BIZ.forEach(b => {
    const st = S.biz[b.id]; if (!st || !st.pub) return;
    const s = S.stocks['own_'+b.id]; if (!s) return;
    const fair = Math.max(0.01, bizFull(b)*900/st.pub.shares);
    let x = Math.log(s.p/fair);
    x += -0.03*x + 0.012*gauss() + f*0.5;
    if (Math.abs(s.shock) > 0.0005){ const sh = s.shock*0.35; s.shock -= sh; x += sh; } else s.shock = 0;
    s.p = fair*Math.exp(clamp(x,-1,1)); pushS(s);
  });
}
export function warmMarkets(){
  for (let i=0;i<NSLOTS*TPC;i++){ const r = {}; MK.forEach(m => r[m] = mTick(m)); sTick(r); }
}
export function tick(online){
  const rets = {}; MK.forEach(m => rets[m] = mTick(m));
  sTick(rets); resTick();
  processPositions(); processOrders();
  if (!online) return;
  if ((newsTimer -= 1) <= 0) news();
  eventTick(); contractsTick(); rivalTick(); stockEvents(); bizTick(); dividends(); checkAch();
}

const lastNews = {};

function news(){
  if (Math.random() < .22 && needs().e > 0){
    const [txt, k, eff] = pick(RES_NEWS); S.px[k] += eff;
    setTicker((eff > 0 ? '▲ ' : '▼ ') + txt, eff > 0 ? 'down' : 'up'); newsTimer = rnd(55,110);
    if (S.section !== 'mercado') toast(txt, eff > 0 ? 'down' : 'up');
    return;
  }
  const pool = MK.filter(m => S.opened[m]).flatMap(m => m === 'au' ? ['au','au'] : [m]);
  const m = pick(pool), list = NEWS[m];
  let i; do { i = Math.floor(Math.random()*list.length); } while (i === lastNews[m] && list.length > 1);
  lastNews[m] = i;
  const [txt, eff] = list[i];
  mk(m).shock += eff*rnd(.7, 1.3);
  setTicker((eff>0 ? '▲ ' : eff<0 ? '▼ ' : '— ') + txt, eff>0 ? 'up' : eff<0 ? 'down' : '');
  newsTimer = rnd(55, 110);
}
export function moves(E, d){ return MK.filter(m => S.opened[m]).map(m => { const s = d*E.eff[m]; return `${METALS[m].name} ${Math.abs(s)<.05 ? '=' : s>0 ? '▲' : '▼'}`; }).join(' · '); }
function eventTick(){
  if (!S.ev){
    if ((S.evNext -= 1) <= 0){
      const i = Math.floor(Math.random()*EVENTS.length), dir = Math.random() < .5 ? 1 : -1, acc = sk('t4') ? .9 : .7;
      S.ev = {i, left: Math.round(rnd(60, 90)), dir, hint: Math.random() < acc ? dir : -dir};
    }
    return;
  }
  S.ev.left -= 1;
  if (S.ev.left <= 10) MK.forEach(m => mk(m).volBoost = Math.max(mk(m).volBoost, 0.4));
  if (S.ev.left <= 0){
    const E = EVENTS[S.ev.i], d = S.ev.dir;
    MK.forEach(m => { mk(m).shock += d*E.big*E.eff[m]*rnd(.6, 1.4); mk(m).volBoost += 1.2; });
    const txt = `${E.name}: ${d>0 ? E.pos : E.neg}. ${moves(E, d)}`;
    setTicker(txt, E.eff[S.mm]*d > 0 ? 'up' : 'down');
    toast(txt, E.eff.au*d > 0 ? 'up' : 'down');
    if (has('u_informante')) log(`${E.name}: tu informante ${S.ev.hint === d ? 'acertó' : 'falló'}`, S.ev.hint === d ? 'up' : 'down');
    S.ev = null; S.evNext = Math.round(rnd(120, 200));
  }
}
function rivalTick(){
  const r = S.rival; r.fill += 1/r.T;
  if (!r.bought && r.fill > .45 && r.fill < .8 && Math.random() < .004){
    r.bought = true; mk('au').shock += rnd(.02,.035);
    setTicker('▲ Minas del Cierzo compra oro para cubrir sus contratos: el precio sube', 'up');
  }
  if (r.fill >= 1){
    const e = rnd(.04,.08); mk('au').shock -= e; mk('au').volBoost += .6;
    if (S.stocks.CIE) S.stocks.CIE.shock += .03;
    const amt = weight(cap('au')*rnd(3,7));
    const txt = `▼ Minas del Cierzo suelta ${amt} de oro de golpe: el precio se hunde`;
    setTicker(txt, 'down'); toast(txt, 'down'); log(txt, 'down');
    if (S.lastAuSale && Date.now() - S.lastAuSale < 30000) S.flags.a_rival = true;
    r.fill = 0; r.T = rnd(150, 280); r.bought = false; r.dumps++;
  }
}
function stockEvents(){
  if ((stEvTimer -= 1) > 0) return;
  stEvTimer = rnd(45, 90);
  if (Math.random() < .06){
    const up = Math.random() < .35;
    STOCKS.forEach(d => S.stocks[d.id].shock += (up ? 1 : -1)*rnd(.05,.09));
    mk('au').shock += up ? -.02 : .04;
    const txt = up ? '▲ Euforia en las bolsas: casi todo sube y el oro pierde algo de brillo' : '▼ Pánico en las bolsas: todo cae y los inversores corren hacia el oro';
    setTicker(txt, up ? 'up' : 'down', '#stTicker'); if (unl('stocks')) toast(txt, up ? 'up' : 'down');
    return;
  }
  const d = pick(STOCKS), up = Math.random() < .55;
  S.stocks[d.id].shock += (up ? 1 : -1)*rnd(.05,.14);
  setTicker((up ? '▲ ' : '▼ ') + pick(up ? ST_POS : ST_NEG).replace('{n}', d.name), up ? 'up' : 'down', '#stTicker');
}
function dividends(){
  if ((divTimer -= 1) > 0) return;
  divTimer = 60;
  let tot = 0;
  STOCKS.forEach(d => { const h = S.hold[d.id]; if (h && h.n > 0 && d.div > 0) tot += h.n*S.stocks[d.id].p*d.div*(sk('t7')?1.5:1); });
  if (tot > 0){ S.divs += tot; earn(tot, .05, 'dividendos'); log(`Dividendos cobrados: +${money(tot)}`, 'up'); }
}
function bizTick(){
  BIZ.forEach(b => { const st = S.biz[b.id]; if (st && st.boost && st.boost.left > 0) st.boost.left -= 1; });
  if (bizLvl('tec') && (tecTimer -= 1) <= 0){
    tecTimer = 60; const old = S.tecF; S.tecF = rnd(.3, 2.3);
    setTicker(`${S.tecF > old ? '▲' : '▼'} Tu tecnológica ${S.tecF > 1.5 ? 'triunfa con su nuevo producto' : S.tecF < .7 ? 'pasa una mala racha' : 'cambia de rumbo'}: rinde al ${nf0.format(S.tecF*100)} %`, S.tecF > old ? 'up' : 'down', '#bizTicker');
  }
  if (bizCount() && (bizEvTimer -= 1) <= 0){
    bizEvTimer = rnd(80, 150);
    const b = pick(BIZ.filter(b => bizLvl(b.id) > 0)), E = pick(BIZ_EV);
    S.biz[b.id].boost = {mult:E.mult, left:E.left};
    const txt = E.txt.replace('{n}', b.name.toLowerCase().startsWith('tec') ? 'tu tecnológica' : 'tu ' + b.name.toLowerCase());
    setTicker((E.tone === 'up' ? '▲ ' : '▼ ') + txt[0].toUpperCase() + txt.slice(1), E.tone, '#bizTicker');
    if (S.section !== 'empresas') toast(txt[0].toUpperCase() + txt.slice(1), E.tone);
  }
}

/* ---- venta física ---- */
export function sell(m, frac, auto){
  const keep = Math.min(S.stock[m], reserved(m)), amt = (S.stock[m] - keep)*frac;
  if (!(amt > 0) || amt*mk(m).price < 0.005){ if (!auto) toast(keep > 0 ? `Todo tu ${METALS[m].low} está apartado para encargos: entrégalos desde la mina.` : `No tienes ${METALS[m].low} que vender.`); return 0; }
  const s = mk(m), imp = impactOf(m, amt), fill = s.price*(1 - imp/2)*(1 - fee())*(1 + refineBonus());
  const rev = amt*fill;
  S.stock[m] = frac >= 1 ? keep : S.stock[m] - amt; S.sold += amt*METALS[m].p0/80;
  if (m === 'au'){
    if (s.price > S.best) S.best = s.price;
    S.lastAuSale = Date.now();
    const mean = s.hist.reduce((a,b)=>a+b,0)/s.hist.length; if (s.price > mean*1.05) S.flags.a_high = true;
  }
  earn(rev, auto ? .06 : .5, 'metal');
  const at = s.price; s.x -= imp; setPrice(m);
  const msg = `${auto ? auto + ': v' : 'V'}endidos ${weight(amt)} de ${METALS[m].low} a ${pfmt(m, fill)} · +${money(rev)}`;
  log(msg, 'up'); if (!auto) toast(msg);
  if (imp > 0.004 && !auto) setTicker(`▼ Tu venta de ${weight(amt)} empuja el precio del ${METALS[m].low}: de ${pfmt(m, at)} a ${pfmt(m, s.price)}`, 'down');
  bump('#pillMoney'); drawChart(); if (!auto) sfx('sell');
  if (!silent) emit('sold', m, rev, auto);
  return rev;
}
export function buyCap(){
  const c = capCost(S.cap); if (S.money < c) return;
  S.money -= c; S.cap++;
  toast(`Caja fuerte ampliada al nivel ${S.cap+1}`); updateUI();
}

/* ---- trading ---- */
export function openPos(dir){
  const err = $('#trErr'); err.hidden = true;
  const m = S.mm, fail = t => { err.textContent = t; err.hidden = false; };
  const amount = parseFloat($('#tMargin').value);
  if (!(amount > 0)) return fail('Escribe cuánto quieres invertir.');
  if (amount > S.money + 1e-9) return fail(`No tienes tanto en caja: tienes ${money(S.money)}.`);
  if (S.positions.length >= 5) return fail('Puedes tener como mucho 5 posiciones abiertas.');
  const entry = dir > 0 ? ask(m) : bid(m);
  const slv = parseFloat($('#tSL').value), tpv = parseFloat($('#tTP').value);
  const sl = slv > 0 ? fromUnit(m, slv) : null, tp = tpv > 0 ? fromUnit(m, tpv) : null;
  if (sl && (dir > 0 ? sl >= entry : sl <= entry)) return fail(dir > 0 ? 'En un largo, el stop loss va por debajo del precio de compra.' : 'En un corto, el stop loss va por encima del precio de venta.');
  if (tp && (dir > 0 ? tp <= entry : tp >= entry)) return fail(dir > 0 ? 'En un largo, el take profit va por encima del precio de compra.' : 'En un corto, el take profit va por debajo del precio de venta.');
  const lev = S.lev, g = amount*lev/entry;
  S.money -= amount;
  S.positions.push({id:S.uid++, m, dir, g, entry, margin:amount, lev, sl, tp});
  log(`Abres ${dir>0?'largo':'corto'} de ${weight(g)} de ${METALS[m].low} a ${pfmt(m, entry)} (margen ${money(amount)}, 1:${lev})`);
  $('#tSL').value = ''; $('#tTP').value = '';
  K.pos = ''; drawChart(); updateUI();
}
export function closePos(p, reason){
  const i = S.positions.indexOf(p); if (i < 0) return;
  S.positions.splice(i,1);
  let pnl = reason === 'liq' ? -p.margin : posPnl(p);
  S.trades++;
  if (pnl > 0){ S.money += p.margin; earn(pnl, .6, 'trading'); S.wins++; if (pnl >= 1000) S.flags.a_big = true; }
  else { S.money += Math.max(0, p.margin + pnl); rec('trading', pnl); }
  if (reason === 'liq') S.flags.a_liq = true;
  S.pnlReal += pnl;
  const label = {liq:'Liquidada', sl:'Stop loss', tp:'Take profit'}[reason] || 'Cerrada';
  const msg = `${label}: ${p.dir>0?'largo':'corto'} de ${weight(p.g)} de ${METALS[p.m].low} · ${smoney(pnl)}`;
  log(msg, pnl >= 0 ? 'up' : 'down'); toast(msg, pnl >= 0 ? 'up' : 'down');
  K.pos = ''; drawChart();
}
function processPositions(){
  for (const p of S.positions.slice()){
    if (p.margin + posPnl(p) <= 0){ closePos(p, 'liq'); continue; }
    const px = p.dir > 0 ? bid(p.m) : ask(p.m);
    if (p.sl && (p.dir > 0 ? px <= p.sl : px >= p.sl)){ closePos(p, 'sl'); continue; }
    if (p.tp && (p.dir > 0 ? px >= p.tp : px <= p.tp)){ closePos(p, 'tp'); continue; }
  }
}

/* ---- órdenes ---- */
export function createOrder(){
  const err = $('#orErr'); err.hidden = true;
  const m = S.mm, kind = $('#oKind').value, tv = parseFloat($('#oPrice').value), frac = parseFloat($('#oFrac').value);
  const fail = t => { err.textContent = t; err.hidden = false; };
  if (!(tv > 0)) return fail('Escribe el precio al que quieres vender.');
  const target = fromUnit(m, tv), now = mk(m).price;
  if (kind === 'above' && target <= now) return fail(`Para «si sube a», pon un precio por encima del actual (${pfmt(m, now)}).`);
  if (kind === 'below' && target >= now) return fail(`Para «si baja a», pon un precio por debajo del actual (${pfmt(m, now)}).`);
  if (S.orders.length >= 6) return fail('Como mucho 6 órdenes activas.');
  S.orders.push({id:S.uid++, m, kind, target, frac});
  log(`Orden: vender ${frac===1?'todo el':Math.round(frac*100)+' % del'} ${METALS[m].low} si ${kind==='above'?'sube':'baja'} a ${pfmt(m, target)}`);
  K.ord = ''; drawChart(); updateUI();
}
function processOrders(){
  for (const o of S.orders.slice()){
    const now = mk(o.m).price;
    if (o.kind === 'above' ? now >= o.target : now <= o.target){
      S.orders.splice(S.orders.indexOf(o),1); K.ord = '';
      const rev = sell(o.m, o.frac, 'Orden ejecutada');
      if (rev) toast(`Orden ejecutada: ${METALS[o.m].low} a ${pfmt(o.m, now)} · +${money(rev)}`, 'up');
      else log(`Orden de ${METALS[o.m].low} a ${pfmt(o.m, o.target)} ejecutada con el almacén vacío`);
    }
  }
}

