import { K, emit, queueTut, resetKeys, showSection, toast, updateUI } from '../core/bus.js';
import { fmtHMS, money } from '../core/format.js';
import { ACH, MILESTONES, OBJ, PERKS, SKILLS, UNLOCKS, runT } from '../data/content.js';
import { openedMk, rec } from './economy.js';
import { warmMarkets } from './market.js';
import { S, bizTotal, clickEq, fresh, gps, has, legAvail, legacyGain, lvReq, mk, physPrice, save, setS, sk, xpNeed } from './state.js';

/* ================= avisos, xp, ingresos ================= */
export let silent = false;
/* Experiencia de objetivos y logros, en fracción del nivel actual. */
export const XP_FR = {obj: .15, ach: .06, click: .15};
export function setSilent(v){ silent = v; }

export function log(txt, tone){ S.log.unshift({t:Date.now(), txt, tone:tone||''}); if (S.log.length > 80) S.log.length = 80; K.log = true; }

export function addXp(v, quiet){
  if (!(v > 0)) return;
  if (silent) v *= 0.25;
  S.xp += v;
  while (S.xp >= xpNeed(S.level)){
    S.xp -= xpNeed(S.level); S.level++;
    const pts = 1 + (S.level % 5 === 0 ? 1 : 0); S.sp += pts;
    if (!quiet){
      toast(`¡Nivel ${S.level}! +${pts} punto${pts>1?'s':''} de habilidad`, 'lv');
      if (!silent) emit('levelup', S.level, pts);
      UNLOCKS.filter(u => u.lv === S.level).forEach(u => {
        queueTut(u.key); log(`Nivel ${S.level}: desbloqueas ${u.txt[0].toLowerCase() + u.txt.slice(1)}`, 'up');
        if (!silent) emit('unlock', u);
      });
      K.nav = ''; K.mkt = ''; K.vein = ''; K.up = '';
    }
  }
}
/* La experiencia por dinero se mide en «segundos de producción»: vender lo que tu mina saca en un minuto
   da la misma experiencia al principio que al final, así que el ritmo de niveles no se dispara con la economía. */
export function refIncome(){
  const pas = openedMk().reduce((a, m) => a + gps(m)*physPrice(m), 0) + bizTotal();
  return Math.max(pas, clickEq()*mk('au').price*2, 0.05);
}
export function xpMoney(v, rate){ if (v > 0) addXp(rate*v/refIncome()); }
export function earn(v, rate, cat){ if (!(v > 0)) return; S.money += v; S.earned += v; S.allEarned += v; xpMoney(v, rate); rec(cat || 'metal', v); }


function checkObj(){
  if (S.obj >= OBJ.length) return;
  const o = OBJ[S.obj]; if (!o.test()) return;
  S.money += o.r; S.obj++; addXp(xpNeed(S.level)*XP_FR.obj);
  toast(`Objetivo cumplido: ${o.txt} · +${money(o.r)}`, 'lv'); if (!silent) emit('objective', o); log(`Objetivo: ${o.txt} (+${money(o.r)})`, 'up');
}
export function buyPerk(id){
  const pk = PERKS.find(x => x.id === id); if (!pk || S.perks[id]) return;
  if (legAvail() < pk.cost){ toast(`Necesitas ${pk.cost} lingotes sin gastar.`); return; }
  S.legSpent = (S.legSpent||0) + pk.cost; S.perks[id] = true;
  if (id === 'p_clients' && S.rep < 2) S.rep = 2;
  toast(`Ventaja de legado: ${pk.name}`, 'lv'); log(`Tienda de legado: ${pk.name} (−${pk.cost} lingotes)`, 'up'); updateUI();
}
export function checkAch(){
  checkObj();
  if (S.runStart) MILESTONES.forEach(([k, label, t]) => {
    if (S.recDone[k] || !t()) return;
    S.recDone[k] = true; const tm = runT(), prev = S.records[k];
    if (!prev || tm < prev){ S.records[k] = tm; toast(prev ? `¡Nuevo récord! ${label} en ${fmtHMS(tm)} (antes ${fmtHMS(prev)})` : `Tiempo registrado: ${label} en ${fmtHMS(tm)}`, 'lv'); }
  });
  ACH.forEach(a => {
    if (S.ach[a.id] || !a.test() || (a.timed && runT() > a.timed)) return;
    S.ach[a.id] = true;
    toast(`Logro: ${a.name} · +1 % a todo`, 'ach'); if (!silent) emit('ach', a); log(`Logro desbloqueado: ${a.name}`, 'up');
    addXp(xpNeed(S.level)*XP_FR.ach);
    K.ach = true;
  });
}


/* ---- habilidades y prestigio ---- */
export function learn(id){
  const s = SKILLS.find(x=>x.id===id); if (!s || sk(id)) return;
  if (!s.req.every(sk)){ toast('Primero aprende las habilidades anteriores de la rama.'); return; }
  if (S.sp < s.cost){ toast(`Necesitas ${s.cost} puntos. Subes de nivel ganando experiencia.`); return; }
  S.sp -= s.cost; S.skills[id] = true;
  toast(`Habilidad aprendida: ${s.name}`, 'up'); log(`Habilidad: ${s.name}`, 'up'); updateUI();
}
export function respec(){
  const cost = Math.floor(S.money*0.1), pts = SKILLS.filter(s=>sk(s.id)).reduce((a,s)=>a+s.cost,0);
  S.money -= cost; S.sp += pts; S.skills = {};
  if (S.lev > 20 || (S.lev === 20 && !has('u_pro'))) S.lev = 5;
  toast(`Puntos devueltos: ${pts}. Reparte de nuevo.`); log(`Reasignas habilidades (−${money(cost)})`); updateUI();
}
export function prestige(){
  const gain = legacyGain(); if (S.level < lvReq('prestige') || gain < 1) return;
  const keep = {ach:S.ach, flags:S.flags, legacy:S.legacy + gain, prestiges:S.prestiges + 1, allEarned:S.allEarned, ind:S.ind, records:S.records, perks:S.perks, legSpent:S.legSpent, autoMine:S.autoMine, obj:S.obj, tutSeen:S.tutSeen, finds:S.finds, guide:9, shopOpen:S.shopOpen, upOpenKind:S.upOpenKind, secSeen:S.secSeen, feed:S.feed};
  setS(Object.assign(fresh(), keep));
  S.money = 500*S.legacy; setTimeout(() => queueTut('legacy'), 800);
  if (S.perks.p_crew){ S.owned.batea = 10; S.owned.pico = 5; }
  if (S.perks.p_bank){ S.ups.u_broker = true; S.ups.u_analista = true; }
  if (S.perks.p_vault) S.cap = 2;
  if (S.perks.p_clients) S.rep = 2;
  if (S.perks.p_level) while (S.level < 5) addXp(xpNeed(S.level) - S.xp + 0.01, true);
  warmMarkets(); emit('sceneReset'); resetKeys(); save();
  toast(`Vendes la compañía. Tienes ${legAvail()} lingotes sin gastar (+${legAvail()*5} % a todo). Míralos en la tienda de legado.`, 'up');
  showSection('mina'); updateUI();
}
