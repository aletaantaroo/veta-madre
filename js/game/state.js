import { rnd } from '../core/format.js';
import { BIZ, CLICK_PACE, CLICK_UPS, CREW, FIND_SETS, GAL_DEPTH, METALS, MK, PACE, REGIMES, SAVE_KEY, SPREAD, STOCKS, STRATA, UNLOCKS } from '../data/content.js';

/* ================= estado ================= */
export let S;
export function setS(v){ S = v; }
function newMk(m){ const p = METALS[m].p0; return {fund:p, x:0, price:p, hist:[], candles:[], cur:null, shock:0, volBoost:0, regime:{i:Math.floor(Math.random()*4), left:Math.round(rnd(60,200))}}; }
export function newStock(d){ return {p:d.p, fund:d.p, x:0, hist:[], long:[], k:0, shock:0}; }
export const fresh = () => ({v:6, money:0, stock:{au:0,ag:0,cu:0}, vein:'au', opened:{au:true}, mined:0, earned:0, allEarned:0, clicks:0, sold:0, best:0, nuggets:0,
  owned:{}, ups:{}, cap:0, mk:{au:newMk('au'), ag:newMk('ag'), cu:newMk('cu')},
  positions:[], pnlReal:0, trades:0, wins:0, lev:5, orders:[], autoSell:false, offers:[], contracts:[], rep:0, conDone:0, conFail:0,
  ev:null, evNext:60, log:[], ind:{sma:true, boll:true, rsi:true}, uid:1,
  level:1, xp:0, sp:0, skills:{}, biz:{}, tecF:1, stocks:{}, hold:{}, divs:0, stPnl:0, rival:{fill:.2, T:200, bought:false, dumps:0},
  ach:{}, flags:{}, legacy:0, prestiges:0, section:'mina', mm:'au', selStock:'CIE', stTf:'tick', lastAuSale:0,
  res:{e:5000, f:1000, x:100}, resLv:{e:0, f:0, x:0}, auto:{e:true, eCharge:false, f:true, x:true}, autoPay:true, solar:0, maint:100, maintAuto:false,
  moral:100, arrears:0, unpaid:false, payT:60, nomina:0, debt:0, borrowed:false, taxT:300, taxBase:0, tarT:195, day:0, px:{fx:0, xx:0, ex:0, fs:0, es:0},
  fin:{cur:{}, last:{}, hist:[], t:0}, runStart:Date.now(), records:{}, recDone:{},
  perks:{}, legSpent:0, autoMine:{on:true, th:0.02}, autoMineT:{}, wind:0, windF:.8, plants:{bio:0, fab:0}, obj:0, tutSeen:{}, finds:{}, lastStratum:0, shopOpen:false, guide:0, saved:Date.now()});

export const has = id => !!S.ups[id];
export const sk = id => !!S.skills[id];
export const lvReq = key => (UNLOCKS.find(u=>u.key===key) || {lv:1}).lv;
/* «grand»: partidas de versiones anteriores conservan lo que ya tenían abierto. */
export const unl = key => S.level >= lvReq(key) || !!(S.grand && S.grand[key]);
const achMult = () => 1 + 0.01*Object.keys(S.ach).length;
export const legAvail = () => Math.max(0, S.legacy - (S.legSpent||0));
const legMult = () => 1 + 0.05*legAvail();
export const setDone = k => FIND_SETS[k].items.every(id => S.finds && S.finds[id]);
export const findCount = () => Object.keys(S.finds || {}).length;
const findMult = () => (1 + 0.005*findCount())*(setDone('pre') ? 1.1 : 1)*(setDone('mis') ? 1.1 : 1);
export const mk = m => S.mk[m];
export const crewMult = id => (has(`u_${id}_0`)?2:1) * (has(`u_${id}_1`)?2:1);
export const fac = {e:1, f:1, x:1};
export const maintF = () => 0.4 + 0.6*S.maint/100;
/* Con la moral baja la plantilla rinde menos, pero nunca se para del todo: así una mala racha no hunde la partida. */
export const MORAL_MIN = 0.35;
export const moralF = () => S.moral >= 60 ? 1 : MORAL_MIN + (1 - MORAL_MIN)*S.moral/60;
export const opF = c => (c.e ? fac.e*maintF() : 1)*(c.f ? fac.f : 1)*(c.x ? fac.x : 1)*moralF();
export const gpsOf = c => (S.owned[c.id]||0) * c.gps * crewMult(c.id) * opF(c);
const baseGps = () => CREW.reduce((a,c)=>a+gpsOf(c), 0);
export const prodMult = () => (sk('m3')?1.2:1)*(sk('m5')?1.3:1)*(sk('m7')?1.5:1)*achMult()*legMult()*findMult();
export const metalConv = m => (80/METALS[m].p0) * METALS[m].yld * (m !== 'au' && sk('m6') ? 1.25 : 1);
export const gpsEq = () => baseGps()*prodMult();
export const gps = (m = S.vein) => gpsEq()*metalConv(m);
export const clickEq = () => (0.025*CLICK_PACE*CLICK_UPS.reduce((a,id)=>a*(has(id)?2:1),1)*(sk('m1')?1.5:1)*achMult()*legMult()) + (has('u_detector') ? gpsEq()*0.05 : 0);
export const clickPow = (m = S.vein) => clickEq()*metalConv(m);
export const bizLvl = id => (S.biz[id] && S.biz[id].lv) || 0;
export const bizCount = () => BIZ.filter(b => bizLvl(b.id) > 0).length;
const capOf = (m,l) => METALS[m].capBase*Math.pow(3,l)*(1 + 0.2*bizLvl('transporte'));
export const cap = m => capOf(m, S.cap);
export const capCost = l => 250*Math.pow(3.2,l)*(sk('m4')?0.7:1);
export const fee = () => (has('u_tasador')?0.01:0.03)*(sk('t1')?0.6:1);
export const refineBonus = () => Math.min(0.4, 0.02*bizLvl('refineria')*(sk('e4')?2:1));
export const physPrice = m => mk(m).price*(1-fee())*(1+refineBonus());
export const spread = () => SPREAD*(sk('t2')?0.5:1);
export const bid = m => mk(m).price*(1 - spread()/2);
export const ask = m => mk(m).price*(1 + spread()/2);
export const impactOf = (m,g) => Math.min(0.12, 0.06*g/(cap(m)*(has('u_londres')?3:1)));
/* Profundidad del frente: rápida al principio y cada vez más costosa (los hallazgos hondos llegan tras horas o varias compañías). */
const depth = () => { const m = Math.max(0, S.mined); return m <= 4e4 ? 2 + 3*Math.sqrt(m) : 602*Math.pow(m/4e4, .25); };
export const frenteDepth = () => Math.max(depth(), ...MK.filter(m => S.opened[m]).map(m => GAL_DEPTH[m] + 12));
export const stratumIdx = () => { const d = frenteDepth(); return STRATA.findIndex(s => d < s.to); };
export const posPnl = p => p.dir > 0 ? (bid(p.m) - p.entry)*p.g : (p.entry - ask(p.m))*p.g;
/* Experiencia por nivel: sube un 18 % por nivel hasta el 15 y un 12 % después (la experiencia se mide en segundos de producción vendida). */
export const xpNeed = L => Math.round(100*Math.pow(1.18, Math.min(L, 15) - 1)*Math.pow(1.12, Math.max(0, L - 15)));
export const legacyGain = () => Math.floor(Math.sqrt(S.earned/1e6));
export const stComm = () => sk('t7') ? 0 : 0.002;
export function costN(c,n){ const k=S.owned[c.id]||0; return c.cost*Math.pow(1.15,k)*(Math.pow(1.15,n)-1)/0.15; }
export function maxN(c){ const k=S.owned[c.id]||0; const b=c.cost*Math.pow(1.15,k); return Math.max(0, Math.floor(Math.log(Math.max(0,S.money)*0.15/b+1)/Math.log(1.15))); }

/* ---- empresas ---- */
export const bizMult = () => (sk('e2')?1.25:1)*(sk('e5')?1.4:1)*(sk('e7')?1.5:1)*achMult()*legMult()*(setDone('mis') ? 1.1 : 1);
export const bizCost = b => b.cost*Math.pow(1.55, bizLvl(b.id))*(sk('e1')?0.85:1);
export const mgrCost = b => b.cost*8*(sk('e3')?0.5:1);
export function bizFull(b){ const st = S.biz[b.id]; if (!st || !st.lv) return 0; let v = b.inc*st.lv*Math.pow(1.06, st.lv)*bizMult()*(st.mgr?2:1); if (b.id==='tec') v *= S.tecF; return v; }
const boostOf = st => st && st.boost && st.boost.left > 0 ? st.boost.mult : 1;
export function ownFrac(b){ const st = S.biz[b.id]; if (!st || !st.pub) return 1; const h = S.hold['own_'+b.id]; return (h ? h.n : 0)/st.pub.shares; }
export const bizInc = b => bizFull(b)*boostOf(S.biz[b.id])*ownFrac(b);
export function jewelRate(){ const st = S.biz.joyeria; if (!st || !st.lv || st.paused) return 0; return 0.08*PACE*st.lv*Math.pow(1.06,st.lv)*(st.mgr?2:1)*boostOf(st)*bizMult()/(achMult()*legMult()); }
export const jewelPrice = () => mk('au').price*1.3*(sk('e4')?1.15:1);
export function bizTotal(){ let v = 0; BIZ.forEach(b => v += bizInc(b)); const jr = jewelRate(); if (jr && S.stock.au > 0) v += jr*jewelPrice()*ownFrac(BIZ[0]); return v; }
export function allStocks(){
  const own = BIZ.filter(b => S.biz[b.id] && S.biz[b.id].pub).map(b => ({id:'own_'+b.id, name:`${b.name} Veta Madre`, sector:'Tu empresa', own:true, bizId:b.id, div:0, beta:{}, desc:'Es tu empresa: cobras de sus beneficios el porcentaje de acciones que tengas.'}));
  return STOCKS.concat(own);
}

/* ================= guardado ================= */
export function save(){ try{ S.saved = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} }
export function migrate(d){
  const f = fresh();
  if (!d.v || d.v < 4) d.runStart = 0;
  if (!d.v || d.v < 3){
    d.mk = {au: {fund:d.fund||80, x:d.x||0, price:d.price||80, hist:d.hist||[], candles:d.candles||[], cur:d.cur||null, shock:d.shock||0, volBoost:d.volBoost||0, regime:d.regime||{i:2,left:120}}};
    d.stock = {au:d.gold||0, ag:0, cu:0};
    ['fund','x','price','hist','candles','cur','shock','volBoost','regime','gold'].forEach(k => delete d[k]);
    (d.positions||[]).forEach(p => p.m = p.m || 'au');
    (d.orders||[]).forEach(o => o.m = o.m || 'au');
    (d.offers||[]).forEach(o => o.m = o.m || 'au');
    (d.contracts||[]).forEach(c => c.m = c.m || 'au');
    d.allEarned = d.earned || 0;
    d.migrated = true;
  }
  const o = Object.assign(f, d);
  if ((d.v || 0) < 6){ o.tarT = ((d.tarT || 0) % 120)*3; o.day = o.day || 0; }
  if (d.guide == null) o.guide = (d.clicks || d.earned) ? 9 : 0;
  if (d.shopOpen == null) o.shopOpen = !!(d.clicks || d.earned);
  if ((d.v || 0) < 5 && (d.clicks || d.earned)){
    /* v10: nueva curva de experiencia y desbloqueos más espaciados. Se conserva el nivel y todo lo que ya estaba abierto. */
    const oldNeed = 60*Math.pow(1.6, (o.level || 1) - 1);
    o.xp = Math.min(.95, (o.xp || 0)/oldNeed)*xpNeed(o.level || 1);
    const OLD = {contracts:3, loans:4, ag:5, taxes:6, biz:8, cu:10, stocks:12, ipo:15, prestige:20};
    o.grand = {habilidades:1, logros:1, mercado:1, finanzas:1};
    Object.entries(OLD).forEach(([k, lv]) => { if ((o.level || 1) >= lv) o.grand[k] = 1; });
    if (o.ups && o.ups.u_broker) o.grand.trading = 1;
  }
  o.v = 6;
  ['res','resLv','auto','px','fin','autoMine','plants'].forEach(k => o[k] = Object.assign({}, f[k], o[k]));
  MK.forEach(m => { if (!o.mk[m]) o.mk[m] = newMk(m); if (!o.mk[m].regime || !REGIMES[o.mk[m].regime.i]) o.mk[m].regime = {i:2,left:120}; });
  o.ind = Object.assign({sma:true, boll:true, rsi:true}, o.ind);
  o.stock = Object.assign({au:0,ag:0,cu:0}, o.stock);
  o.opened = Object.assign({au:true}, o.opened);
  o.rival = Object.assign({fill:.2, T:200, bought:false, dumps:0}, o.rival);
  if (!o.opened[o.vein]) o.vein = 'au';
  if (!o.opened[o.mm]) o.mm = 'au';
  return o;
}
export function load(){ try{ const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null; return migrate(JSON.parse(raw)); }catch(e){ return null; } }
