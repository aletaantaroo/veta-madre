import { K, emit, on, sfx, toast, updateUI } from '../core/bus.js';
import { money } from '../core/format.js';
import { METALS } from '../data/content.js';
import { estRates, rec } from './economy.js';
import { earn, log, refIncome, silent } from './progress.js';
import { S, clickEq, mk, unl } from './state.js';

/* ================= minijuegos: fichas, premios y la apuesta «sube o baja» =================
   La vagoneta y la voladura gastan una ficha (3 al día, se recargan a medianoche) y pagan en
   «segundos de producción», así el premio crece con tu mina sin romper la economía.
   La apuesta se juega con tu caja, con un tope para que siga siendo un juego. */
export const MG_TICKETS = 3;
export const BET_PAY = 1.9;
export function mgState(){ return (S.mg ||= {tk: MG_TICKETS, best: {}, plays: {}, bets: []}); }
export const tickets = () => mgState().tk;
export function useTicket(game){
  const G = mgState(); if (G.tk <= 0) return false;
  G.tk--; G.plays[game] = (G.plays[game] || 0) + 1; K.mg = ''; return true;
}
/* Premio de un minijuego: «sec» segundos de lo que produce ahora tu compañía, con un mínimo para el principio. */
const mgUnit = () => Math.max(estRates().inc, clickEq()*mk('au').price*2, 0.4);   // lo que ingresas de verdad ahora (un almacén lleno no cuenta)
export function mgPay(game, sec, score){
  const v = Math.max(1, sec*mgUnit()), G = mgState();
  if (score != null && score > (G.best[game] || 0)){ G.best[game] = score; }
  earn(v, .4, 'otros');
  log(`Minijuego (${game === 'cart' ? 'vagoneta' : game === 'blast' ? 'voladura' : 'voladura ' + game.split('_')[1].replace('dificil', 'difícil')}): +${money(v)}`, 'up');
  K.mg = ''; updateUI();
  return v;
}
on('newDay', () => { const G = mgState(); if (G.tk < MG_TICKETS){ G.tk = MG_TICKETS; K.mg = ''; if (unl('minigames')) toast(`Nuevas fichas para los minijuegos: ${MG_TICKETS}`, 'up'); } });

/* ---- sube o baja ---- */
export const betCap = () => Math.max(20, refIncome()*300);
export function placeBet(m, dir, stake, dur){
  const G = mgState();
  if (G.bet) return 'Ya tienes una apuesta en marcha.';
  if (!S.opened[m]) return 'Ese metal aún no lo extraes.';
  stake = Math.floor(stake*100)/100;
  if (!(stake >= 1)) return 'La apuesta mínima es 1 €.';
  if (stake > betCap()) return `Como mucho puedes apostar ${money(betCap())} (5 minutos de lo que produce tu mina).`;
  if (stake > S.money) return 'No tienes tanto dinero en caja.';
  S.money -= stake; rec('otros', -stake);
  G.bet = {m, dir, stake, entry: mk(m).price, left: dur, dur, path: [mk(m).price]};
  sfx('ui'); K.mg = ''; updateUI();
  return null;
}
function settleBet(){
  const G = mgState(), b = G.bet; if (!b) return;
  const end = mk(b.m).price, diff = end - b.entry, win = b.dir > 0 ? diff > 0 : diff < 0;
  let pay = 0;
  if (diff === 0){ pay = b.stake; S.money += pay; rec('otros', pay); }
  else if (win){ pay = b.stake*BET_PAY; earn(pay, 0, 'otros'); }
  G.bets.unshift({t: Date.now(), m: b.m, dir: b.dir, stake: b.stake, pay, entry: b.entry, end}); if (G.bets.length > 8) G.bets.length = 8;
  G.bet = null; K.mg = '';
  const txt = diff === 0 ? `Apuesta empatada: recuperas ${money(pay)}` : win ? `¡Acertaste! El ${METALS[b.m].low} ${b.dir > 0 ? 'subió' : 'bajó'}: cobras ${money(pay)}` : `Fallaste: el ${METALS[b.m].low} ${diff > 0 ? 'subió' : 'bajó'} y pierdes ${money(b.stake)}`;
  log(txt, win ? 'up' : 'down'); toast(txt, win ? 'up' : 'down'); if (win) sfx('coin');
  if (!silent) emit('betDone', win);
}
export function betTick(){
  const G = S.mg, b = G && G.bet; if (!b) return;
  b.path.push(mk(b.m).price); if (b.path.length > 70) b.path.shift();
  if ((b.left -= 1) <= 0) settleBet();
}
