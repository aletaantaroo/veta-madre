import { on, selectDesk, sfx, showSection } from '../core/bus.js';
import { $, setT } from '../core/dom.js';
import { SET } from '../core/settings.js';
import { TUTS } from '../data/content.js';
import { S } from '../game/state.js';
import { miner } from '../render/sprites.js';
import { menuOpen } from './menu.js';

export const tutQ = []; export let tutCur = null;
function enqueueTut(k){
  if (!S || SET.tuts !== 'on' || !TUTS[k] || S.tutSeen[k] || tutQ.includes(k) || tutCur === k) return;
  tutQ.push(k); showNextTut();
}
export function showNextTut(){
  if (tutCur || menuOpen() || !tutQ.length) return;
  const k = tutQ.shift(), T = TUTS[k]; tutCur = k; S.tutSeen[k] = true;
  setT($('#tutEyebrow'), T.t.startsWith('Nuevo') ? 'Desbloqueado' : 'Tutorial');
  setT($('#tutTitle'), T.t.replace(/^Nuevo: /, ''));
  $('#tutSteps').innerHTML = T.s.map(x => `<li>${x}</li>`).join('');
  $('#tutGo').hidden = S.section === T.sec && !T.desk;
  const el = $('#tut'); el.hidden = false; document.body.classList.add('tut-open'); drawForeman(); sfx('pop');
  document.documentElement.style.setProperty('--tut-h', el.offsetHeight + 'px');
}
export function closeTut(go){
  const T = TUTS[tutCur]; tutCur = null; $('#tut').hidden = true; document.body.classList.remove('tut-open');
  if (go && T){ if (S.section !== T.sec) showSection(T.sec); if (T.desk) selectDesk(T.desk); }
  setTimeout(showNextTut, 400);
}

function drawForeman(){
  const cv = $('#tutFace'), g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
  miner(g, 50, 152, 3.4, {pose:'idle', t: 0, seed: 3, suit:'#e0632f', skin:'#f6c9a0'});
}
on('tut', enqueueTut);
