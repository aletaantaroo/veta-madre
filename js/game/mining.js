import { emit, on, sfx, toast } from '../core/bus.js';
import { weight } from '../core/format.js';
import { CREW, METALS, MK } from '../data/content.js';
import { luckActive } from './finds.js';
import { rollGem } from './gems.js';
import { powerStep } from './powerups.js';
import { XP_FR, addXp, xpMoney } from './progress.js';
import { S, buff, cap, clickPow, gps, mk, setDone, sk } from './state.js';

/* ================= Picar y pepitas ================= */
export let fullFlash = 0;
export let nugget = null;
let nuggetTimer = 45;
export const totalOwned = () => CREW.reduce((a, c) => a + (S.owned[c.id] || 0), 0);

/* Cada golpe pica a la vez en todas las minas abiertas. (x, y) es donde tocaste: allí sale lo que sacas de la veta
   que estás mirando; las demás lo enseñan en su propia galería. */
export let lastDigAt = 0;
export function dig(x, y){
  let any = false;
  MK.forEach(m => {
    if (!S.opened[m] || S.stock[m] >= cap(m)) return;
    const p = Math.min(clickPow(m), cap(m) - S.stock[m]);
    S.stock[m] += p; S.mined += p*METALS[m].p0/80; any = true;
    emit('dig', m === S.vein ? x : null, m === S.vein ? y : null, m, p);
  });
  if (!any){ fullFlash = 1.2; sfx('bad'); emit('digFull', x, y, S.vein); return false; }
  S.clicks++; lastDigAt = performance.now();
  addXp(XP_FR.click);
  sfx('dig');
  rollGem('click', x, y);
  return true;
}
export function spawnNugget(){
  if (S.section !== 'mina') return;
  nugget = {m: S.vein, life: 13, u: .2 + Math.random()*.55, v: Math.random() < .5 ? -1 : 1};
  sfx('sparkle');
}
export function collectNugget(){
  if (!nugget) return;
  const m = nugget.m, g = nuggetSize(m);
  S.stock[m] += g; S.mined += g*METALS[m].p0/80; S.nuggets++;
  emit('nuggetGot', m, g);
  toast(`Has encontrado una pepita de ${weight(g)} de ${METALS[m].low}`, 'up');
  xpMoney(g*mk(m).price, .3);
  sfx('nugget');
  nugget = null;
}
export function nuggetSize(m){ return Math.max(gps(m)*45, clickPow(m)*25)*(sk('m2') ? 2 : 1)*(setDone('tes') ? 2 : 1); }
export function miningStep(el){
  powerStep(el);
  if (!nugget && (nuggetTimer -= el*(luckActive() ? 4 : 1)*(buff('lince') ? 3 : 1)) <= 0){ spawnNugget(); nuggetTimer = (70 + Math.random()*90)/(sk('m2') ? 1.4 : 1); }
  if (nugget && (nugget.life -= el) <= 0) nugget = null;
  if (fullFlash > 0) fullFlash -= el;
}
function clearNugget(){ nugget = null; }
on('sceneReset', clearNugget);
