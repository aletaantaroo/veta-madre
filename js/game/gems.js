import { K, emit, queueTut, sfx, toast, updateUI } from '../core/bus.js';
import { clamp, gauss, money, nf0 } from '../core/format.js';
import { GEMS } from '../data/content.js';
import { luckActive } from './finds.js';
import { earn, log, silent } from './progress.js';
import { S, buff, frenteDepth, gpsEq } from './state.js';

/* ================= gemas =================
   Salen al picar (más o menos 1 de cada 250 golpes) y, de vez en cuando, con tu equipo (1 cada 4 minutos).
   Qué gema sale depende de lo hondo que esté el frente: las nuevas son más raras y valen mucho más.
   Su precio se mueve un poco (entre el 70 % y el 135 % del de referencia). La joyería las engasta y las vende al doble. */
const CLICK_P = 1/250, CREW_P = 1/240;
const gemById = id => GEMS.find(g => g.id === id);
const gemAvail = () => GEMS.filter(g => frenteDepth() >= g.d);
export const gemsOpen = () => frenteDepth() >= GEMS[0].d;
export const gemPrice = id => gemById(id).p*(S.gemPx[id] || 1);
export const gemCount = () => GEMS.reduce((a, g) => a + (S.gems[g.id] || 0), 0);
export const gemValue = () => GEMS.reduce((a, g) => a + (S.gems[g.id] || 0)*gemPrice(g.id), 0);
const gemLuck = () => (buff('lince') ? 3 : 1)*(luckActive() ? 2 : 1);
function pickGem(){
  const L = gemAvail(); let r = Math.random()*L.reduce((a, g) => a + g.w, 0);
  for (const g of L){ if ((r -= g.w) <= 0) return g; }
  return L[L.length - 1];
}
export function rollGem(src, x, y){
  if (!gemsOpen() || Math.random() >= (src === 'click' ? CLICK_P : CREW_P)*gemLuck()) return null;
  const G = pickGem(), first = !S.gemsFound[G.id];
  S.gems[G.id] = (S.gems[G.id] || 0) + 1; S.gemsFound[G.id] = (S.gemsFound[G.id] || 0) + 1; K.gems = '';
  if (silent) return G;
  emit('gemFound', G, x, y, src); sfx('nugget');
  const un = G.f ? 'una' : 'un';
  toast(first ? `¡${G.f ? 'Tu primera' : 'Tu primer'} ${G.name.toLowerCase()}! Vale unos ${money(gemPrice(G.id))}` : `${src === 'crew' ? 'Tu equipo encuentra' : 'Encuentras'} ${un} ${G.name.toLowerCase()}`, 'up', first ? 'imp' : 'info');
  if (Object.keys(S.gemsFound).length === 1 && first) queueTut('gems');
  return G;
}
/* Vende una gema (id) o todas (sin id). */
export function sellGems(id){
  const ids = id ? [id] : GEMS.map(g => g.id);
  let rev = 0, n = 0;
  ids.forEach(k => { const c = S.gems[k] || 0; if (!c) return; rev += c*gemPrice(k); n += c; S.gems[k] = 0; });
  if (!n){ toast('No tienes gemas que vender.', '', 'err'); return; }
  earn(rev, .1, 'gemas'); K.gems = '';
  const msg = `Vendes ${n === 1 ? (id ? `${gemById(id).f ? 'una' : 'un'} ${gemById(id).name.toLowerCase()}` : 'una gema') : `${nf0.format(n)} gemas`} por ${money(rev)}`;
  log(msg, 'up'); toast(msg, 'up'); sfx('sell'); emit('bump', '#pillMoney'); updateUI();
}
let jewelT = 0;
/* Cada segundo: el precio de las gemas se mueve, el equipo a veces encuentra una y la joyería engasta las que tengas. */
export function gemTick(){
  GEMS.forEach(g => { const p = S.gemPx[g.id] || 1; S.gemPx[g.id] = clamp(p*Math.exp(gauss()*.006 + (1 - p)*.004), .7, 1.35); });
  if (gpsEq() > 0) rollGem('crew');
  const st = S.biz.joyeria; if (!st || !st.lv || st.paused || S.jewelGems === false) return;
  if ((jewelT += 1) < jewelEvery()) return;
  const G = [...GEMS].reverse().find(g => S.gems[g.id] > 0); if (!G) return;
  jewelT = 0; S.gems[G.id]--; K.gems = '';
  const v = gemPrice(G.id)*2; earn(v, .05, 'empresas');
  if (!silent) emit('jewelGem', G, v);
}
/* Segundos que tarda la joyería en engastar una gema (va más rápida cuanto más nivel tiene). */
export const jewelEvery = () => { const st = S.biz.joyeria; return Math.max(6, Math.round(30/(1 + ((st && st.lv) || 0)/10))); };
