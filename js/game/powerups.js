import { K, emit, sfx, toast, updateUI } from '../core/bus.js';
import { POWERUPS } from '../data/content.js';
import { S, unl } from './state.js';

/* ================= power-ups =================
   Cada 2-4 minutos que pases en la mina aparece una burbuja en una galería. Dura 14 s: si la tocas,
   tienes su ventaja un rato (se suma si ya la tenías). La vagoneta, si llegas a la salida, también regala una. */
export let bubble = null;
let bubbleT = 75;
export const powerById = id => POWERUPS.find(p => p.id === id);
export function powerStep(el){
  for (const k in S.buffs){
    if (S.buffs[k] > 0 && (S.buffs[k] -= el) <= 0){ S.buffs[k] = 0; K.buffs = ''; emit('buffEnd', k); }
  }
  if (!unl('power') || S.section !== 'mina') return;
  if (bubble){ if ((bubble.life -= el) <= 0) bubble = null; return; }
  if ((bubbleT -= el) <= 0){ spawnBubble(); bubbleT = 120 + Math.random()*120; }
}
function spawnBubble(){
  const P = POWERUPS[Math.floor(Math.random()*POWERUPS.length)];
  bubble = {id: P.id, m: null, u: .18 + Math.random()*.55, life: 14};   // la galería la elige la escena: una que estés viendo
  sfx('sparkle');
}
export function popBubble(){ if (!bubble) return; const id = bubble.id; bubble = null; givePower(id); }
export function givePower(id){
  const P = powerById(id); if (!P) return;
  S.buffs[id] = Math.max(0, S.buffs[id] || 0) + P.dur; S.flags.a_power = true; K.buffs = '';
  emit('powerUp', P); sfx('ach');
  toast(`${P.name}: ${P.txt.toLowerCase()} durante ${P.dur} s`, 'up', 'ok');
  updateUI();
}
export const randomPower = () => POWERUPS[Math.floor(Math.random()*POWERUPS.length)].id;
