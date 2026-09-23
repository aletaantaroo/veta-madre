import { K, emit, queueTut, sfx, toast, updateUI } from '../core/bus.js';
import { money, nf0 } from '../core/format.js';
import { FINDS, FIND_SETS, METALS, RARITY, SECRETS } from '../data/content.js';
import { estRates, isDay } from './economy.js';
import { nuggetSize, spawnNugget } from './mining.js';
import { addXp, earn, log, silent } from './progress.js';
import { S, frenteDepth, gpsEq, mk, setDone, stratumIdx, xpNeed } from './state.js';

/* ================= Hallazgos, colecciones y secretos ================= */
let luckT = 0, announced = null, topoN = 0;
export const luckActive = () => luckT > 0;
const isNight = () => !isDay();
function findVisible(f){ return !S.finds[f.id] && frenteDepth() >= f.d && (!f.night || isNight()); }
export function visibleFinds(){ return FINDS.filter(findVisible); }
function findReward(f){ const R = RARITY[f.rar]; return Math.max(R.floor*.05*Math.pow(1.6, S.level - 1), R.sec*Math.max(estRates().inc, gpsEq()*mk('au').price)); }

export function findsStep(el){
  if (luckT > 0) luckT -= el;
  const vis = visibleFinds();
  if (!announced){ announced = new Set(vis.map(f => f.id)); }
  vis.forEach(f => {
    if (announced.has(f.id)) return;
    announced.add(f.id);
    if (silent) return;
    toast(`Algo brilla en la roca a ${nf0.format(f.d)} m…`, 'up');
    queueTut('finds');
    emit('findRevealed', f);
  });
  const si = Math.max(0, stratumIdx());
  if (si > (S.lastStratum || 0)){
    S.lastStratum = si;
    if (!silent) emit('stratum', si);
  }
}
export function collectFind(id){
  const f = FINDS.find(x => x.id === id); if (!f || S.finds[id] || !findVisible(f)) return;
  const R = RARITY[f.rar], cash = findReward(f);
  const before = Object.keys(FIND_SETS).filter(setDone);
  S.finds[id] = {t: Date.now(), d: Math.round(frenteDepth()), co: (S.prestiges || 0) + 1};
  earn(cash, 0, 'otros');
  addXp(xpNeed(S.level)*R.xp);
  if (f.fx === 'moral') S.moral = 100;
  if (f.fx === 'rep') S.rep = Math.min(5, S.rep + 1);
  if (f.fx === 'luck') luckT = 600;
  if (f.fx === 'nugget') spawnNugget();
  if (f.fx === 'legacy') S.legacy += 1;
  log(`Hallazgo ${R.name.toLowerCase()}: ${f.name} (+${money(cash)})`, 'up');
  sfx(f.rar === 'l' || f.rar === 'e' ? 'ach' : 'nugget');
  emit('found', f, cash);
  Object.keys(FIND_SETS).filter(k => setDone(k) && !before.includes(k)).forEach(k => {
    const St = FIND_SETS[k];
    toast(`¡Colección completa: ${St.name}! ${St.reward}.`, 'ach');
    log(`Colección completa: ${St.name}`, 'up');
  });
  K.ach = true; K.museo = '';
  updateUI();
}
export function secret(id){
  if (!S.flags || S.flags[id]) return false;
  S.flags[id] = true; K.ach = true; K.museo = '';
  emit('secret', SECRETS.find(x => x.id === id));
  return true;
}
export function patTopo(){
  const m = S.vein, g = nuggetSize(m)*.5;
  S.stock[m] += g; S.mined += g*METALS[m].p0/80;
  topoN++; S.flags.topoN = (S.flags.topoN || 0) + 1;
  if (S.flags.topoN >= 5) secret('s_topo');
  sfx('nugget');
  return g;
}
