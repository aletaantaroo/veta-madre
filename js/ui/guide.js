import { on, sfx } from '../core/bus.js';
import { $, setT } from '../core/dom.js';
import { money } from '../core/format.js';
import { CREW } from '../data/content.js';
import { S, costN } from '../game/state.js';
import { miner } from '../render/sprites.js';

/* ================= primeros pasos =================
   La primera vez que entras, el capataz te dice qué pulsar y una flecha lo señala:
   pica → vende → contrata. Se va solo en cuanto lo has hecho (o con «Ya sé jugar»). */
const STEP = {FIRST: 1, MORE: 2, SELL: 3, HIRE: 4, DONE: 5, OFF: 9};
let doneT = 0, lastTgt = null, faceDrawn = false;

function stepInfo(){
  const g = S.guide, desk = innerWidth > 860, shopOpen = $('#shop').classList.contains('open');
  if (g === STEP.FIRST) return {t: '¡Bienvenido a Veta Madre!', s: 'Haz tu primer clic para empezar: pulsa «¡Pica!» o toca la roca del fondo de la galería.', tgt: '#btnDig', dir: 'down'};
  if (g === STEP.MORE) return {t: '¡Eso es, minero!', s: `Cada golpe arranca un poco de oro. Pica ${Math.max(1, 15 - S.clicks)} ${15 - S.clicks === 1 ? 'vez' : 'veces'} más.`, tgt: '#btnDig', dir: 'down', quiet: true};
  if (g === STEP.SELL) return {t: 'Ahora, véndelo', s: 'Pulsa «Vender todo»: con el dinero contratarás gente que pique por ti.', tgt: '#qs100', dir: 'down'};
  if (g === STEP.HIRE){
    const c = CREW[0], cost = costN(c, 1);
    if (S.money < cost) return {t: 'Junta para tu primer ayudante', s: `Un buscador cuesta ${money(cost)}. Pica y vende hasta tenerlos.`, tgt: '#btnDig', dir: 'down', quiet: true};
    if (!shopOpen) return {t: 'Abre la tienda', s: 'Ahí contratas equipo que trabaja solo, aunque tú no piques.', tgt: '#shopHandle', dir: desk ? 'right' : 'down'};
    return {t: 'Contrata a tu primer buscador', s: 'Trabaja solo, aunque tú no piques. ¡Pulsa sobre él!', tgt: '#crew_batea', dir: desk ? 'right' : 'down'};
  }
  if (g === STEP.DONE) return {t: '¡Tu mina ya trabaja sola!', s: 'Arriba tienes los objetivos: síguelos y aprenderás el resto poco a poco.', tgt: '#objBar', dir: 'left'};
  return null;
}
function advance(){
  const g = S.guide;
  if (g === STEP.FIRST && S.clicks >= 1) S.guide = STEP.MORE;
  if (S.guide === STEP.MORE && (S.clicks >= 15 || S.sold > 0)) S.guide = S.sold > 0 ? STEP.HIRE : STEP.SELL;
  if (S.guide === STEP.SELL && S.sold > 0) S.guide = STEP.HIRE;
  if (S.guide === STEP.HIRE && CREW.some(c => (S.owned[c.id] || 0) > 0)){ S.guide = STEP.DONE; doneT = performance.now(); }
  if (S.guide === STEP.DONE && performance.now() - doneT > 8000) S.guide = STEP.OFF;
  if (g !== S.guide) lastTgt = null;
}
function drawFace(){
  const cv = $('#guideFace'), x = cv.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
  miner(x, 46, 142, 3.2, {pose: 'idle', t: 0, seed: 3, suit: '#e0632f', skin: '#f6c9a0'});
  faceDrawn = true;
}
function place(info){
  const box = $('#guide'), arr = $('#guideArrow'), el = $(info.tgt);
  const r = el && !el.closest('[hidden]') ? el.getBoundingClientRect() : null;
  if (!r || !r.width){ box.hidden = true; arr.hidden = true; return; }
  if (lastTgt !== el){ document.querySelectorAll('.coach-target').forEach(x => x.classList.remove('coach-target')); el.classList.add('coach-target'); lastTgt = el; }
  box.hidden = false; arr.hidden = !!info.quiet; document.body.classList.add('coaching');
  const bw = box.offsetWidth, bh = box.offsetHeight, A = 58, m = 10, W = innerWidth, H = innerHeight;
  let ax, ay, bx, by;
  let dir = info.dir;
  if (dir === 'left' && r.right + A + bw + 24 > W) dir = 'up';
  arr.dataset.dir = dir;
  if (dir === 'left'){
    ax = r.right + 6; ay = r.top + r.height/2 - A/2;
    bx = ax + A + 4; by = r.top + r.height/2 - bh/2;
  } else if (dir === 'right'){
    ax = r.left - A - 6; ay = r.top + r.height/2 - A/2;
    bx = ax - bw - 4; by = r.top + r.height/2 - bh/2;
  } else if (dir === 'up'){
    ax = r.left + Math.min(r.width/2, 120) - A/2; ay = r.bottom + 6;
    bx = ax + A/2 - 60; by = ay + A + 4;
  } else {
    ax = r.left + r.width/2 - A/2; ay = r.top - A - 6;
    bx = r.left + r.width/2 - bw/2; by = ay - bh - 2;
  }
  bx = Math.max(m, Math.min(W - bw - m, bx)); by = Math.max(m + 60, Math.min(H - bh - m, by));
  box.style.transform = `translate(${Math.round(bx)}px, ${Math.round(by)}px)`;
  arr.style.left = Math.round(ax) + 'px'; arr.style.top = Math.round(ay) + 'px';
}
function hideAll(){
  $('#guide').hidden = true; $('#guideArrow').hidden = true; document.body.classList.remove('coaching');
  document.querySelectorAll('.coach-target').forEach(x => x.classList.remove('coach-target')); lastTgt = null;
}
function tickGuide(){
  if (!S || !S.guide || S.guide >= STEP.OFF){ if (!$('#guide').hidden) hideAll(); return; }
  advance();
  const info = stepInfo(), blocked = S.section !== 'mina' || !$('#menu').hidden || !$('#fcard').hidden;
  if (!info || blocked){ hideAll(); return; }
  if (!faceDrawn) drawFace();
  const box = $('#guide');
  if (box.dataset.k !== info.t){ box.dataset.k = info.t; box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop'); }
  setT($('#guideT'), info.t); setT($('#guideS'), info.s);
  place(info);
}
export function startGuide(){ if (S && !S.guide && !S.clicks && !S.earned){ S.guide = STEP.FIRST; tickGuide(); } }
$('#guideSkip').addEventListener('click', () => { S.guide = STEP.OFF; hideAll(); sfx('ui'); });
$('#guide').addEventListener('click', e => { if (S.guide === STEP.DONE && e.target.id !== 'guideSkip'){ S.guide = STEP.OFF; hideAll(); } });
on('ui', tickGuide);
on('dig', () => { if (S.guide && S.guide < STEP.OFF) tickGuide(); });
on('layout', () => { if (S && S.guide && S.guide < STEP.OFF) requestAnimationFrame(tickGuide); });
addEventListener('resize', () => { if (S && S.guide && S.guide < STEP.OFF) tickGuide(); });
