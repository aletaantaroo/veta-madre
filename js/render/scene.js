import { K, emit, on, sfx, showSection, updateUI } from '../core/bus.js';
import { $, dpr, refreshDpr, setT } from '../core/dom.js';
import { clamp, money, mulberry32, nf0, weight } from '../core/format.js';
import { RM } from '../core/settings.js';
import { BIZ, CREW, DAY_LEN, FINDS, GAL_DEPTH, METALS, MK, RARITY, STRATA } from '../data/content.js';
import { gameMin, needs } from '../game/economy.js';
import { collectFind, patTopo, secret, visibleFinds } from '../game/finds.js';
import { collectNugget, dig, nugget } from '../game/mining.js';
import { bubble, popBubble, powerById } from '../game/powerups.js';
import { openVein } from '../game/shop.js';
import { S, cap, capCost, fac, frenteDepth, gps, lvReq, stratumIdx, unl } from '../game/state.js';
import { findImg } from './findArt.js';
import { building, cage, cart, cloud, drill, excavator, headframe, lerpCol, miner, nuggetSprite, plant, powerBubble, rival, shade, solar, tank, tbm, tree, truck, turbine, vault } from './sprites.js';

/* ================= La mina viva =================
   Un corte de la montaña que baja contigo: cielo con día y noche, superficie con el castillete, la caja fuerte y tus empresas,
   y bajo tierra seis estratos, una galería por yacimiento, el frente de avance y todo lo que la roca esconde. */
const cv = $('#world'), g = cv.getContext('2d');
const railCv = $('#railMap'), rgx = railCv.getContext('2d');
let W = 0, H = 0, SD = 1, L = null, layoutAge = 99, frameDt = 0;
let camY = 0, camTarget = null, camVel = 0, drag = null, lastVein = null, vetaBuf = '';
let parts = [], floats = [], trucks = [], flashes = [], shake = 0, swingK = 0, blastCd = {au: 6, ag: 9, cu: 12, pt: 15}, lastRivalDumps = -1;
let idleT = 0, sleeping = false, moonHits = 0, astroT = 0, flagDance = 0, topoVis = null, topoCd = 25;
const MCOL = {au: {ore: '#ffc62e', hi: '#fff3b0', vein: ['#e0950b', '#ffe27a'], txt: '#ffd84a'}, ag: {ore: '#d7e2ef', hi: '#ffffff', vein: ['#8e9db0', '#f4f8fc'], txt: '#e8f0fa'}, cu: {ore: '#ff8a4c', hi: '#ffd0b0', vein: ['#b8521f', '#ffb27d'], txt: '#ffa06b'}, pt: {ore: '#b8c6ea', hi: '#f2f5ff', vein: ['#6a78a0', '#dfe6fb'], txt: '#dfe6ff'}};
const TEX = [
  {base: '#c98b52', hi: '#e2a86c', lo: '#a36a3a', kind: 'sand'},
  {base: '#6f6a78', hi: '#8a8594', lo: '#54505e', kind: 'slate'},
  {base: '#9a7f73', hi: '#c2a698', lo: '#6d564c', kind: 'granite'},
  {base: '#b8aecb', hi: '#e6def2', lo: '#8f84a6', kind: 'quartz'},
  {base: '#3f3a48', hi: '#5a5466', lo: '#29252f', kind: 'basalt'},
  {base: '#5e2923', hi: '#8e3a24', lo: '#3e1a16', kind: 'magma'},
];
const PATS = [];
const vis = (n, max) => n <= 0 ? 0 : Math.min(max, 1 + Math.floor(Math.log2(n)));
const smooth = (a, b, x) => { const k = clamp((x - a)/(b - a), 0, 1); return k*k*(3 - 2*k); };

/* ---------- texturas de cada estrato (se repiten sin costuras) ---------- */
function makeTile(i){
  const T = TEX[i], N = 120, c = document.createElement('canvas'); c.width = c.height = N*2;
  const x = c.getContext('2d'); x.scale(2, 2);
  x.fillStyle = T.base; x.fillRect(0, 0, N, N);
  const r = mulberry32(900 + i*31);
  const at = (fn) => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) fn(ox, oy); };
  const dot = (cx, cy, rad, col, a = 1) => at((ox, oy) => { x.globalAlpha = a; x.fillStyle = col; x.beginPath(); x.arc(cx + ox, cy + oy, rad, 0, 6.2832); x.fill(); x.globalAlpha = 1; });
  if (T.kind === 'sand'){
    for (const [yy, col] of [[28, T.lo], [84, T.hi]]){ x.globalAlpha = .28; x.fillStyle = col; x.beginPath(); x.moveTo(0, yy); for (let k = 0; k <= N; k += 4) x.lineTo(k, yy + Math.sin(k/N*6.2832*2)*3); for (let k = N; k >= 0; k -= 4) x.lineTo(k, yy + 7 + Math.sin(k/N*6.2832*2 + 1)*3); x.closePath(); x.fill(); x.globalAlpha = 1; }
    for (let k = 0; k < 45; k++) dot(r()*N, r()*N, .6 + r()*1.3, r() < .5 ? T.hi : T.lo, .7);
  } else if (T.kind === 'slate'){
    for (let k = 0; k < 10; k++){ x.globalAlpha = .35; x.strokeStyle = k % 2 ? T.hi : T.lo; x.lineWidth = 2; x.beginPath(); x.moveTo(0, k*12 + 4); x.lineTo(N, k*12 + 4); x.stroke(); x.globalAlpha = 1; }
    for (let k = 0; k < 14; k++){ const cx = r()*N, cy = r()*N; at((ox, oy) => { x.fillStyle = r() < .5 ? T.hi : T.lo; x.globalAlpha = .6; x.beginPath(); x.moveTo(cx + ox, cy + oy); x.lineTo(cx + ox + 7, cy + oy - 1); x.lineTo(cx + ox + 9, cy + oy + 2); x.lineTo(cx + ox + 2, cy + oy + 3); x.closePath(); x.fill(); x.globalAlpha = 1; }); }
  } else if (T.kind === 'granite'){
    const cols = [T.hi, T.lo, '#ead8cf', '#4d3b33', '#b48e80'];
    for (let k = 0; k < 110; k++) dot(r()*N, r()*N, .7 + r()*1.8, cols[k % cols.length], .85);
  } else if (T.kind === 'quartz'){
    for (let k = 0; k < 50; k++) dot(r()*N, r()*N, .6 + r()*1.2, r() < .5 ? T.hi : T.lo, .8);
    for (let k = 0; k < 7; k++){ const cx = r()*N, cy = r()*N; at((ox, oy) => { x.fillStyle = '#efe8fa'; x.globalAlpha = .75; x.beginPath(); x.moveTo(cx + ox, cy + oy); x.lineTo(cx + ox + 3, cy + oy - 7); x.lineTo(cx + ox + 6, cy + oy); x.closePath(); x.fill(); x.globalAlpha = 1; }); }
  } else if (T.kind === 'basalt'){
    for (let k = 0; k < 6; k++){ const cx = k*20; x.fillStyle = T.lo; x.fillRect(cx, 0, 2.5, N); x.fillStyle = T.hi; x.fillRect(cx + 2.5, 0, 1.6, N); const cy = r()*N; x.fillStyle = T.lo; x.fillRect(cx, cy, 20, 2); x.fillRect(cx, (cy + 55) % N, 20, 2); }
  } else {
    for (let k = 0; k < 6; k++){ let cx = r()*N, cy = r()*N; const pts = [[cx, cy]]; for (let s = 0; s < 4; s++){ cx += (r() - .5)*30; cy += (r() - .3)*22; pts.push([cx, cy]); }
      at((ox, oy) => { x.strokeStyle = '#ff7a2e'; x.globalAlpha = .55; x.lineWidth = 1.8; x.beginPath(); pts.forEach(([a, b], j) => j ? x.lineTo(a + ox, b + oy) : x.moveTo(a + ox, b + oy)); x.stroke(); x.globalAlpha = 1; }); }
    for (let k = 0; k < 30; k++) dot(r()*N, r()*N, .6 + r()*1.2, r() < .3 ? '#ffb347' : T.lo, .8);
  }
  const p = g.createPattern(c, 'repeat');
  try { p.setTransform(new DOMMatrix().scale(.5)); } catch(e){}
  return p;
}

/* ---------- geometría: la pantalla y el mundo ---------- */
export function resizeScene(){
  refreshDpr();
  W = innerWidth; H = innerHeight; SD = Math.min(dpr, 1.6);
  cv.width = Math.round(W*SD); cv.height = Math.round(H*SD);
  if (!PATS.length) TEX.forEach((_, i) => PATS.push(makeTile(i)));
  L = null;
}
function rectOf(sel){ const el = $(sel); if (!el || el.closest('[hidden]')) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? r : null; }
function depthY(d){
  const {STY} = L;
  for (let i = 0; i < 6; i++){
    const top = i ? STRATA[i-1].to : 0, to = i < 5 ? STRATA[i].to : 10000;
    if (d < to || i === 5) return STY[i] + clamp((d - top)/(to - top), 0, 1)*(STY[i+1] - STY[i]);
  }
  return STY[6];
}
function layoutScene(){
  const mobile = W <= 860;
  const hud = rectOf('#hud'), dock = rectOf('#nav');
  const shopR = !mobile && S.section === 'mina' ? rectOf('#shop') : null;
  const railR = S.section === 'mina' ? rectOf('#rail') : null;
  const dig = S.section === 'mina' ? rectOf('#digDock') : null;
  const card = !mobile && S.section === 'mina' ? rectOf('#prodCard') : null;
  const sx0 = 0, sx1 = shopR ? shopR.left - 10 : (!mobile && L ? L.sx1 : W);
  const railLeft = railR ? railR.left - 6 : (L ? L.railLeft : sx1);
  const sy0 = hud ? hud.bottom : 70, sy1 = dock ? dock.top : H - 90;
  let digTop = dig ? Math.min(dig.top, sy1) : (L ? L.digTop : sy1 - 150);
  if (dig && mobile) digTop = Math.min(digTop, sy1 - 48);
  const SW = sx1 - sx0, SH = digTop - sy0;
  const u = clamp(Math.min(SW/980, SH/540)*1.12, .58, 1.25);
  const gy = Math.round(sy0 + SH*(mobile ? .42 : .36));
  const lx0 = card ? card.right + 10 : (!mobile && L ? L.lx0 : sx0);   // borde izquierdo visible (a la derecha del panel de producción)
  const shaftX = Math.round(Math.min(Math.max(sx0 + Math.max(SW*(mobile ? .24 : .3), 70*u), lx0 + 150*u), railLeft - 280*u));
  const HS = Math.round(Math.max(560*u, SH*1.1)), top0 = gy + 14*u;
  const STY = []; for (let i = 0; i < 6; i++) STY.push(top0 + i*HS); STY.push(top0 + 5*HS + HS*1.6);
  const gh = 58*u, tot = CREW.reduce((a, c) => a + (S.owned[c.id] || 0), 0);
  const maxX = Math.min(sx1, railLeft) - 22*u, x0 = shaftX + 20*u;
  const len = Math.min(maxX - x0, (250 + 60*Math.log2(1 + tot))*u);
  L = {sx0, lx0, sx1, sy0, sy1, SW, SH, u, gy, shaftX, gh, HS, STY, digTop, mobile, tot, railLeft, maxX, gal: {}, fpos: {}};
  MK.forEach(m => { const y = Math.round(depthY(GAL_DEPTH[m]) + gh*.5); L.gal[m] = {m, y, top: y - gh, x0, x1: x0 + len, maxX}; });
  FINDS.forEach((f, i) => {
    const r = mulberry32(i*977 + 13);
    let y = depthY(f.d) + (r() - .5)*30*u, x = lx0 + 50*u + r()*(maxX - lx0 - 100*u);
    if (Math.abs(x - shaftX) < 70*u) x = shaftX + (x < shaftX ? -80 : 100)*u;
    MK.forEach(m => { const G = L.gal[m]; if (y > G.top - 40*u && y < G.y + 40*u && x > shaftX - 50*u && x < G.x1 + 50*u) y = G.y + 70*u; });
    L.fpos[f.id] = {x: Math.max(lx0 + 34*u, x), y};
  });
  L.frenteY = depthY(frenteDepth());
  L.camMax = Math.max(0, L.frenteY + 170*u - digTop);
  layoutAge = 0;
}
function clampCam(){ camY = clamp(camY, 0, L ? L.camMax : 0); }
function focusY(wy){ if (!L) return; camTarget = clamp(wy - (L.sy0 + (L.digTop - L.sy0)*.5), 0, L.camMax); camVel = 0; }
const openedList = () => MK.filter(m => S.opened[m]);

/* ---------- cielo, sol, luna y montañas ---------- */
const STARS = Array.from({length: 70}, (_, i) => { const r = mulberry32(i*977 + 5); return [r(), r()*.9, .5 + r()*1.2, r()*6]; });
const CLOUDS = Array.from({length: 6}, (_, i) => { const r = mulberry32(i*131 + 9); return {x: r(), y: .12 + r()*.45, s: .7 + r()*.7, v: .6 + r()*.8}; });
const tt120 = () => ((S.tarT/DAY_LEN*120) % 120 + 120) % 120;
function dayK(){ const tt = tt120(); return smooth(58, 68, tt)*(1 - smooth(110, 120, tt)); }
function drawSky(t, k){
  const {gy, u, sx0, SW, sy0} = L;
  const sk = g.createLinearGradient(0, 0, 0, gy); sk.addColorStop(0, lerpCol('#0c1433', '#4fb0ff', k)); sk.addColorStop(1, lerpCol('#2b3f7a', '#c4ebff', k));
  g.fillStyle = sk; g.fillRect(0, 0, W, gy + 4);
  const dusk = k > 0 && k < 1 ? Math.sin(k*Math.PI) : 0;
  if (dusk > .02){ const dg = g.createLinearGradient(0, gy*.4, 0, gy); dg.addColorStop(0, 'rgba(255,150,90,0)'); dg.addColorStop(1, `rgba(255,140,80,${.55*dusk})`); g.fillStyle = dg; g.fillRect(0, 0, W, gy); }
  if (k < 1) STARS.forEach(([x, y, s, ph]) => { g.globalAlpha = (1 - k)*(.45 + .55*Math.abs(Math.sin(t*.8 + ph))); g.fillStyle = '#fff'; g.fillRect(x*W, y*gy, s, s); });
  g.globalAlpha = 1;
  const tt = tt120(), arc = gy - sy0;
  L.moon = null;
  if (tt >= 56){
    const p = clamp((tt - 58)/62, 0, 1), x = sx0 + SW*(.08 + .84*p), y = gy - 20*u - arc*.72*Math.sin(Math.PI*p);
    const gl = g.createRadialGradient(x, y, 0, x, y, 60*u); gl.addColorStop(0, 'rgba(255,236,150,.55)'); gl.addColorStop(1, 'rgba(255,236,150,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x, y, 60*u, 0, 6.2832); g.fill();
    g.lineWidth = 2.5; g.strokeStyle = '#2a1a0e'; g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(x, y, 17*u, 0, 6.2832); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(x - 6*u, y - 6*u, 5*u, 0, 6.2832); g.fill();
  } else {
    const p = clamp(tt/58, 0, 1), x = sx0 + SW*(.08 + .84*p), y = gy - 20*u - arc*.7*Math.sin(Math.PI*p);
    g.lineWidth = 2.5; g.strokeStyle = '#2a1a0e'; g.fillStyle = '#f4f1dc'; g.beginPath(); g.arc(x, y, 14*u, 0, 6.2832); g.fill(); g.stroke();
    g.fillStyle = lerpCol('#0c1433', '#4fb0ff', k); g.beginPath(); g.arc(x + 6*u, y - 4*u, 12*u, 0, 6.2832); g.fill();
    L.moon = {x, y, r: 16*u};
    if (astroT > 0) astronaut(x - 34*u, y + 10*u, u, t);
  }
  const wind = .4 + (S.windF || .8);
  CLOUDS.forEach(c => { const span = W + 200; const x = ((c.x*span + t*8*c.v*wind) % span) - 100; cloud(g, x, sy0*.3 + (gy - sy0*.3)*c.y*.8, c.s*u, k > .3 ? 'rgba(255,255,255,.92)' : 'rgba(150,170,210,.55)'); });
  g.fillStyle = lerpCol('#27335e', '#8db5e0', k); g.strokeStyle = 'rgba(42,26,14,.5)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, gy); for (let x = 0; x <= W + 40; x += 40) g.lineTo(x, gy - 70*u - Math.sin(x/170 + 1)*38*u - Math.sin(x/61)*12*u); g.lineTo(W, gy); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = lerpCol('#233b35', '#7fcf63', k); g.beginPath(); g.moveTo(0, gy); for (let x = 0; x <= W + 30; x += 30) g.lineTo(x, hillY(x)); g.lineTo(W, gy); g.closePath(); g.fill(); g.stroke();
}
function hillY(x){ return L.gy - 26*L.u - Math.sin(x/230 + 2)*16*L.u; }
function astronaut(x, y, u, t){
  g.save(); g.translate(x, y + Math.sin(t*1.5)*4*u); g.rotate(Math.sin(t*.8)*.2); g.lineWidth = 2; g.strokeStyle = '#2a1a0e';
  g.fillStyle = '#f4f7fa'; g.beginPath(); g.roundRect(-7*u, -4*u, 14*u, 16*u, 5*u); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, -10*u, 8*u, 0, 6.2832); g.fill(); g.stroke();
  g.fillStyle = '#3ea8ff'; g.beginPath(); g.ellipse(1*u, -10*u, 5*u, 4*u, 0, 0, 6.2832); g.fill(); g.stroke();
  const wave = Math.sin(t*8)*.5; g.save(); g.translate(7*u, -1*u); g.rotate(-1 + wave); g.fillStyle = '#f4f7fa'; g.beginPath(); g.roundRect(0, -2.5*u, 10*u, 5*u, 2.5*u); g.fill(); g.stroke(); g.restore();
  g.restore();
}

/* ---------- superficie ---------- */
function surfaceItems(){
  const items = [];
  const lx = vis(S.owned.lix || 0, 4); if (lx) items.push({k: 'lix', n: lx, w: lx*26 + 8});
  for (let i = 0; i < Math.min(2, S.plants.bio || 0); i++) items.push({k: 'bio', w: 40});
  for (let i = 0; i < Math.min(2, S.plants.fab || 0); i++) items.push({k: 'fab', w: 42});
  BIZ.forEach(b => { const st = S.biz[b.id]; if (st && st.lv) items.push({k: 'biz', id: b.id, lv: st.lv, w: b.id === 'transporte' ? 74 : b.id === 'banco' || b.id === 'refineria' ? 62 : 50}); });
  return items;
}
function drawGround(){
  const {u, gy, shaftX, lx0} = L;
  g.fillStyle = '#6cc24a'; g.beginPath(); g.moveTo(0, gy - 3*u);
  for (let x = 0; x <= W + 10; x += 10) g.lineTo(x, gy - 3*u + Math.sin(x*.9)*1.4*u);
  g.lineTo(W, gy + 9*u); g.lineTo(0, gy + 9*u); g.closePath(); g.fill();
  g.fillStyle = '#4c9a34'; g.fillRect(0, gy + 6*u, W, 4*u);
  g.strokeStyle = '#2a1a0e'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, gy + 10*u); g.lineTo(W, gy + 10*u); g.stroke();
  const rx0 = lx0 + 26*u, rx1 = shaftX - 50*u;
  if (rx1 - rx0 > 60*u){
    g.beginPath(); g.moveTo(rx0, gy - 1); g.quadraticCurveTo((rx0 + rx1)/2, gy + 16*u, rx1, gy - 1); g.closePath();
    g.fillStyle = '#58b7f0'; g.fill(); g.strokeStyle = '#2a1a0e'; g.lineWidth = 2; g.stroke();
  }
  g.strokeStyle = '#8a5a2e'; g.lineWidth = 2*u;
  for (let i = 0; i < 9; i++){ const r = mulberry32(i*53 + 7), x = r()*W, len = (18 + r()*30)*u; if (Math.abs(x - shaftX) < 40*u) continue; g.beginPath(); g.moveTo(x, gy + 10*u); g.quadraticCurveTo(x + (r() - .5)*20*u, gy + 10*u + len*.6, x + (r() - .5)*14*u, gy + 10*u + len); g.stroke(); }
}
function drawSurface(t, k){
  const {u, gy, shaftX, lx0} = L, sx1 = Math.min(L.sx1, L.railLeft), night = k < .4;
  const nw = Math.min(7, S.wind || 0), ns = Math.min(14, S.solar || 0);
  for (let i = 0; i < nw; i++){ const x = sx1 - 40*u - i*52*u; turbine(g, x, hillY(x) + 4*u, .95*u, t*(0.6 + 3*(S.windF || .8)) + i); }
  for (let i = 0; i < ns; i++){ const x = shaftX + 110*u + i*20*u; solar(g, x, hillY(x) + 6*u, .8*u); }
  const rt = mulberry32(3);
  for (let i = 0; i < 5; i++){ const x = lx0 + 8*u + rt()*Math.max(0, shaftX - lx0 - 80*u); tree(g, x, gy - 1, (.75 + rt()*.4)*u, i, t); }
  const nb = vis(S.owned.batea || 0, 6), rx0 = lx0 + 26*u, rx1 = shaftX - 50*u;
  for (let i = 0; i < nb; i++){ const x = rx0 + 16*u + (rx1 - rx0 - 32*u)*(nb > 1 ? i/(nb - 1) : .5); miner(g, x, gy + 2*u, .82*u, {pose: 'pan', t, seed: i*7 + 1, dir: i % 2 ? -1 : 1}); }
  headframe(g, shaftX, gy + 2*u, u, t*1.4);
  const anyFull = openedList().some(m => S.stock[m] >= cap(m));
  const vx = shaftX + 76*u; vault(g, vx, gy + 2*u, .95*u, S.cap + 1, anyFull, t); L.vaultX = vx;
  L.vaultBox = {x0: vx - 32*u, x1: vx + 32*u, y0: gy - 70*u, y1: gy + 6*u};
  if (anyFull && Math.floor(t*2) % 2) plate(g, vx, gy - 78*u, '¡Lleno!', '#ff5b4f', '#ffffff', u*.8);
  else if (S.money >= capCost(S.cap) && openedList().some(m => S.stock[m] >= cap(m)*.8)) plate(g, vx, gy - 78*u, '+ Ampliar', '#ffc62e', '#2a1a0e', u*.75);
  const items = surfaceItems(), start = vx + 44*u, end = sx1 - 90*u;
  const total = items.reduce((a, it) => a + it.w*u + 10*u, 0), f = total > end - start && total > 0 ? (end - start)/total : 1;
  let x = start;
  items.forEach(it => {
    const w = it.w*u*f, cx = x + w/2;
    if (it.k === 'lix') for (let j = 0; j < it.n; j++) tank(g, x + 13*u*f + j*26*u*f, gy + 2*u, .8*u, t, j % 2 ? '#a4f06e' : '#6ee07a', j);
    else if (it.k === 'bio' || it.k === 'fab') plant(g, it.k, cx, gy + 2*u, .95*u, t);
    else { building(g, it.id, cx, gy + 2*u, .95*u, it.lv, t, night); if (it.id === 'refineria' && Math.random() < .05) parts.push({k: 'smoke', x: cx + 10*u, y: gy - 60*u, vx: 6 + (S.windF || .8)*10, vy: -14, life: 3, max: 3, s: 5*u, col: 'rgba(220,220,230,'}); }
    x += w + 10*u*f;
  });
  if (S.moral <= 0 || S.arrears > 0) picket(t, vx);
  const rx = sx1 - 44*u, dance = flagDance > 0;
  g.save(); if (dance) g.translate(0, -Math.abs(Math.sin(t*14))*5*u);
  rival(g, rx, gy + 2*u, .9*u, clamp(S.rival.fill, 0, 1), dance ? t*6 : t);
  g.restore();
  L.flag = {x0: rx - 18*u, x1: rx + 4*u, y0: gy - 80*u, y1: gy - 64*u};
  if (lastRivalDumps >= 0 && S.rival.dumps > lastRivalDumps){ for (let i = 0; i < 20; i++) parts.push({k: 'dust', x: sx1 - 30*u, y: gy - 10*u, vx: (Math.random() - .5)*80, vy: -20 - Math.random()*40, life: 1.4, max: 1.4, s: (6 + Math.random()*8)*u, col: 'rgba(160,150,150,'}); trucks.push({x: sx1 - 20*u, dir: 1, v: 70*u, ore: '#8d8490'}); }
  lastRivalDumps = S.rival.dumps;
  trucks = trucks.filter(tr => { tr.x += tr.dir*tr.v*frameDt; truck(g, tr.x, gy + 2*u, .9*u, tr.ore, tr.dir, 1, t); return tr.x < W + 60 && tr.x > -60; });
}

/* ---------- consecuencias visibles: huelga, falta de energía y desgaste ---------- */
function picket(t, vx){
  const {u, gy} = L;
  [[48, 0], [74, 1], [100, 2]].forEach(([dx, i]) => {
    const x = vx + dx*u, bob = Math.abs(Math.sin(t*3 + i*1.3))*3*u;
    miner(g, x, gy + 2*u, .82*u, {pose: 'idle', t, seed: i*4 + 2, dir: i % 2 ? -1 : 1});
    g.save(); g.translate(x + 7*u, gy - 22*u - bob); g.rotate(Math.sin(t*2 + i)*.08);
    g.strokeStyle = '#2a1a0e'; g.lineWidth = 2.4*u; g.beginPath(); g.moveTo(0, 14*u); g.lineTo(0, -12*u); g.stroke();
    g.strokeStyle = '#7a4a1d'; g.lineWidth = 1.2*u; g.stroke();
    g.fillStyle = '#fff5de'; g.strokeStyle = '#2a1a0e'; g.lineWidth = 1.8; g.beginPath(); g.roundRect(-16*u, -26*u, 32*u, 16*u, 3*u); g.fill(); g.stroke();
    g.fillStyle = '#d2382d'; g.font = `400 ${Math.round(8.5*u)}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(i === 1 ? '¡PAGA!' : '¡HUELGA!', 0, -17.5*u);
    g.restore();
  });
}
function statusBadge(x, y, kind, t){
  const {u} = L, b = Math.sin(t*4)*2*u;
  g.save(); g.translate(x, y + b);
  g.fillStyle = kind === 'e' ? '#2a1a0e' : '#fff5de'; g.strokeStyle = '#2a1a0e'; g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, 11*u, 0, 6.2832); g.fill(); g.stroke();
  if (kind === 'e'){ g.fillStyle = '#ffc62e'; g.beginPath(); g.moveTo(2*u, -8*u); g.lineTo(-5*u, 1.5*u); g.lineTo(-.5*u, 1.5*u); g.lineTo(-2*u, 8*u); g.lineTo(5*u, -1.5*u); g.lineTo(.5*u, -1.5*u); g.closePath(); g.fill(); }
  else { g.fillStyle = '#6b4c30'; g.beginPath(); g.arc(-2*u, -2*u, 5*u, 0, 6.2832); g.fill(); g.fillStyle = '#fff5de'; g.beginPath(); g.arc(-2*u, -2*u, 2.2*u, 0, 6.2832); g.fill(); g.strokeStyle = '#6b4c30'; g.lineWidth = 3*u; g.beginPath(); g.moveTo(1*u, 1*u); g.lineTo(6*u, 6*u); g.stroke(); }
  g.restore();
}

/* ---------- los estratos ---------- */
function drawStrata(v0, v1, t){
  const {STY, u} = L;
  for (let i = 0; i < 6; i++){
    const a = STY[i], b = STY[i+1];
    if (b + 20 < v0 || a - 20 > v1) continue;
    const yTop = x => a + (i ? Math.sin(x/140 + i*1.7)*8*u : 0), bot = Math.min(b + 14*u, v1 + 30);
    g.beginPath(); g.moveTo(0, yTop(0)); for (let x = 24; x <= W + 24; x += 24) g.lineTo(x, yTop(x));
    g.lineTo(W + 24, bot); g.lineTo(0, bot); g.closePath();
    g.fillStyle = PATS[i] || TEX[i].base; g.fill();
    if (i){ g.strokeStyle = 'rgba(42,26,14,.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, yTop(0)); for (let x = 24; x <= W + 24; x += 24) g.lineTo(x, yTop(x)); g.stroke(); }
    drawDecor(i, Math.max(a, v0), Math.min(b, v1), t);
  }
}
function drawDecor(i, y0, y1, t){
  const {u, STY} = L, T = TEX[i], cell = 160*u;
  for (let c = Math.floor(y0/cell); c <= Math.floor(y1/cell); c++){
    const r = mulberry32(c*7919 + i*104729 + 11);
    for (let k = 0; k < 5; k++){
      const x = r()*W, y = c*cell + r()*cell, s = (3 + r()*6)*u, kind = r(), rot = r()*3;
      if (y < STY[i] + 12*u || y > STY[i+1] - 8*u) continue;
      if (kind < .5){
        g.fillStyle = shade(T.base, -.2); g.beginPath(); g.ellipse(x, y, s*1.3, s, rot, 0, 6.2832); g.fill();
        g.fillStyle = shade(T.base, .2); g.beginPath(); g.ellipse(x - s*.3, y - s*.35, s*.55, s*.3, 0, 0, 6.2832); g.fill();
      } else if (kind < .64 && i <= 2){
        g.strokeStyle = 'rgba(255,240,215,.38)'; g.lineWidth = 2*u; g.beginPath();
        for (let a = 0; a < 12; a += .3){ const rr = s*1.4*(1 - a/13); g.lineTo(x + Math.cos(a + rot)*rr, y + Math.sin(a + rot)*rr); } g.stroke();
      } else if (i === 3 && kind < .88){
        g.lineWidth = 1.4; g.strokeStyle = '#2a1a0e';
        for (let q = -1; q <= 1; q++){ g.beginPath(); g.moveTo(x + q*s*.7, y); g.lineTo(x + q*s*.7 + s*.2, y - s*(1.6 - Math.abs(q)*.5)); g.lineTo(x + q*s*.7 + s*.45, y); g.closePath(); g.fillStyle = ['#d9c8f2', '#b8e8f5', '#efe3ff'][q + 1]; g.fill(); g.stroke(); }
        const tw = Math.pow(.5 + .5*Math.sin(t*2 + x*.1), 12);
        if (tw > .15){ const sp = (2 + 5*tw)*u; g.strokeStyle = `rgba(255,255,255,${tw})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - sp, y - s); g.lineTo(x + sp, y - s); g.moveTo(x, y - s - sp); g.lineTo(x, y - s + sp); g.stroke(); }
      } else if (i === 4 && kind < .8){
        g.strokeStyle = '#1d1a22'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x, y - s*.4); g.lineTo(x + s*1.2, y + s*.2); g.stroke();
        if (!RM && Math.random() < frameDt*.5 && parts.length < 320) parts.push({k: 'smoke', x, y: y - 4, vx: (Math.random() - .5)*8, vy: -22, life: 2.2, max: 2.2, s: 5*u, col: 'rgba(230,230,240,'});
      } else if (i === 5 && kind < .8){
        const gl = .5 + .5*Math.sin(t*2 + x); g.strokeStyle = `rgba(255,${120 + gl*80|0},40,${.5 + gl*.4})`; g.lineWidth = 2.4*u; g.beginPath(); g.moveTo(x - s*1.5, y); g.lineTo(x - s*.3, y - s*.5); g.lineTo(x + s, y + s*.3); g.lineTo(x + s*1.8, y - s*.2); g.stroke();
      } else if (kind > .95){
        g.fillStyle = ['#a06bff', '#2cd3c6', '#ff7eb3'][k % 3]; g.strokeStyle = '#2a1a0e'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, y - s*.8); g.lineTo(x + s*.6, y); g.lineTo(x, y + s*.8); g.lineTo(x - s*.6, y); g.closePath(); g.fill(); g.stroke();
      }
    }
  }
}
function drawAmbient(v0, v1, t){
  const {u, STY, fpos} = L;
  // goteras y murciélagos en la pizarra
  if (STY[2] > v0 && STY[1] < v1){
    for (let i = 0; i < 7; i++){
      const r = mulberry32(i*337 + 3), x = r()*W, y = STY[1] + 30*u + r()*(STY[2] - STY[1] - 120*u), per = 1.8 + r()*1.6, p = ((t + r()*per) % per)/per;
      if (y < v0 - 60 || y > v1 + 60) continue;
      g.fillStyle = '#54505e'; g.strokeStyle = '#2a1a0e'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - 6*u, y); g.lineTo(x + 6*u, y); g.lineTo(x, y + 12*u); g.closePath(); g.fill(); g.stroke();
      if (p < .8){ const dy = 12*u + p*p*60*u; g.fillStyle = '#9fdcff'; g.beginPath(); g.ellipse(x, y + dy, 2*u, 3*u, 0, 0, 6.2832); g.fill(); }
      else { g.strokeStyle = `rgba(159,220,255,${(1 - p)*4})`; g.lineWidth = 1.4; g.beginPath(); g.ellipse(x, y + 72*u, (p - .8)*40*u, (p - .8)*10*u, 0, 0, 6.2832); g.stroke(); }
    }
    for (let i = 0; i < 3; i++){
      const r = mulberry32(i*911 + 41), x = r()*W, y = STY[1] + 60*u + r()*(STY[2] - STY[1] - 160*u);
      if (y < v0 - 40 || y > v1 + 40) continue;
      g.save(); g.translate(x, y); g.rotate(Math.sin(t*1.3 + i)*.12); g.fillStyle = '#3a2a3a'; g.strokeStyle = '#2a1a0e'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-8*u, 4*u, -12*u, 12*u); g.quadraticCurveTo(-4*u, 8*u, 0, 16*u); g.quadraticCurveTo(4*u, 8*u, 12*u, 12*u); g.quadraticCurveTo(8*u, 4*u, 0, 0); g.fill(); g.stroke();
      g.fillStyle = '#ffd84a'; g.fillRect(-2.5*u, 11*u, 1.5*u, 1.5*u); g.fillRect(1*u, 11*u, 1.5*u, 1.5*u);
      g.restore();
    }
  }
  // el lago del basalto
  const lake = fpos.pez;
  if (lake && frenteDepth() >= 1560 && lake.y > v0 - 120 && lake.y < v1 + 120){
    const lx = clamp(lake.x, L.sx0 + 120*u, L.maxX - 120*u), ly = lake.y + 40*u;
    g.fillStyle = '#1b1822'; g.beginPath(); g.ellipse(lx, ly - 10*u, 130*u, 46*u, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#2c9fd6'; g.strokeStyle = '#2a1a0e'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(lx, ly, 124*u, 22*u, 0, 0, Math.PI); g.lineTo(lx - 124*u, ly); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(191,243,255,.8)'; g.lineWidth = 2.5*u; for (let k = 0; k < 3; k++){ const wx = lx - 80*u + k*70*u + Math.sin(t + k)*8*u; g.beginPath(); g.moveTo(wx, ly + 6*u); g.lineTo(wx + 24*u, ly + 6*u); g.stroke(); }
    if (S.finds.pez){ const p = (t % 5)/5; if (p < .3){ const j = Math.sin(p/.3*Math.PI); g.save(); g.translate(lx + 30*u, ly - j*34*u); g.rotate(-1 + p/.3*2); g.fillStyle = '#e8e2f2'; g.strokeStyle = '#2a1a0e'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(0, 0, 10*u, 5*u, 0, 0, 6.2832); g.fill(); g.stroke(); g.restore(); } }
  }
  // el río de lava (y sus patitos)
  if (frenteDepth() >= 4300){
    const ry = depthY(4400) + 36*u;
    if (ry > v0 - 60 && ry < v1 + 60){
      g.fillStyle = '#ff7a2e'; g.strokeStyle = '#2a1a0e'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(0, ry); for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, ry + Math.sin(x/60 + t*1.5)*4*u); g.lineTo(W + 20, ry + 26*u); g.lineTo(0, ry + 26*u); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,240,150,.8)'; for (let k = 0; k < 8; k++){ const fx = ((k*170 + t*40) % (W + 100)) - 50; g.fillRect(fx, ry + 10*u, 26*u, 3*u); }
      if (S.finds.patitos) for (let k = 0; k < 5; k++){ const dx = ((k*230 + t*22) % (W + 120)) - 60, dy = ry - 2*u + Math.sin(t*3 + k)*2*u; duck(dx, dy, u); }
    }
  }
}
function duck(x, y, u){
  g.save(); g.translate(x, y); g.lineWidth = 1.6; g.strokeStyle = '#2a1a0e'; g.fillStyle = '#ffd84a';
  g.beginPath(); g.ellipse(0, 0, 11*u, 6*u, 0, 0, 6.2832); g.fill(); g.stroke();
  g.beginPath(); g.arc(-7*u, -7*u, 5*u, 0, 6.2832); g.fill(); g.stroke();
  g.fillStyle = '#ff9636'; g.beginPath(); g.moveTo(-12*u, -7*u); g.lineTo(-17*u, -5*u); g.lineTo(-12*u, -4*u); g.fill(); g.stroke();
  g.fillStyle = '#2a1a0e'; g.beginPath(); g.arc(-8*u, -8*u, 1*u, 0, 6.2832); g.fill();
  g.restore();
}

/* ---------- pozo, galerías y frente ---------- */
function shaftBottom(){ const deep = Math.max(...openedList().map(m => L.gal[m].y)); return Math.max(L.frenteY, deep) + 14*L.u; }
function drawShaft(v0, v1){
  const {u, gy, shaftX} = L, sw = 38*u, sx = shaftX - sw/2, top = gy + 4*u, bot = shaftBottom();
  const a = Math.max(top, v0 - 30), b = Math.min(bot, v1 + 30); if (b <= a) return;
  g.fillStyle = '#2b1a0e'; g.fillRect(sx, a, sw, b - a);
  g.fillStyle = '#3b2616'; g.fillRect(sx + 5*u, a, sw - 10*u, b - a);
  g.strokeStyle = '#8d5b2c'; g.lineWidth = 3*u; const st = 26*u;
  for (let y = top + Math.ceil((a - top)/st)*st + 12*u; y < b - 4*u; y += st){ g.beginPath(); g.moveTo(sx + 2*u, y); g.lineTo(sx + sw - 2*u, y); g.stroke(); }
  g.strokeStyle = '#6b411c'; g.lineWidth = 4*u; g.beginPath(); g.moveTo(sx + 3*u, a); g.lineTo(sx + 3*u, b); g.moveTo(sx + sw - 3*u, a); g.lineTo(sx + sw - 3*u, b); g.stroke();
  g.strokeStyle = '#2a1a0e'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(sx, a); g.lineTo(sx, b); g.moveTo(sx + sw, a); g.lineTo(sx + sw, b); if (bot <= v1 + 30){ g.moveTo(sx, bot); g.lineTo(sx + sw, bot); } g.stroke();
}
function drawTicks(v0, v1){
  const {u, shaftX, STY} = L, fd = frenteDepth(), x = shaftX - 24*u;
  g.font = `400 ${Math.round(11*u)}px "Lilita One", sans-serif`; g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let i = 0; i < 6; i++){
    if (STY[i+1] < v0 || STY[i] > v1) continue;
    const top = i ? STRATA[i-1].to : 0, to = i < 5 ? STRATA[i].to : 10000, pxm = (STY[i+1] - STY[i])/(to - top);
    const step = [5, 10, 25, 50, 100, 250, 500, 1000, 2500].find(s => s*pxm >= 64*u) || 2500;
    for (let d = Math.ceil((top + 1)/step)*step; d < to && d <= fd; d += step){
      const y = depthY(d); if (y < v0 - 10 || y > v1 + 10) continue;
      const txt = `${nf0.format(d)} m`, w = g.measureText(txt).width + 10*u;
      g.fillStyle = 'rgba(42,26,14,.72)'; g.beginPath(); g.roundRect(x - w, y - 8*u, w, 16*u, 5*u); g.fill();
      g.fillStyle = '#fff5de'; g.fillText(txt, x - 5*u, y + .5);
      g.strokeStyle = '#2a1a0e'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8*u, y); g.stroke();
    }
  }
  const si = Math.max(0, stratumIdx());
  for (let i = 1; i < 6; i++){
    const y = STY[i]; if (y < v0 - 30 || y > v1 + 30 || i > si + 1) continue;
    const reached = i <= si;
    plate(g, shaftX + 150*L.u, y, `${reached ? STRATA[i].name : '???'} · ${nf0.format(STRATA[i-1].to)} m`, reached ? TEX[i].hi : '#6b4c30', reached ? '#2a1a0e' : '#f2d59e', u);
  }
}
function galleryUnits(m){
  const G = L.gal[m], {u} = L, su = .95*u, face = G.x1 - 12*u, list = [];
  let cur = face;
  if ((S.owned.tbm || 0) > 0){ list.push({k: 'tbm', x: cur}); cur -= 84*su; }
  if (m === S.vein){ list.push({k: 'you', x: cur - 6*su}); cur -= 26*su; }
  const add = (k, n, w) => { for (let i = 0; i < n && cur - w*su > G.x0 + 26*u; i++){ list.push({k, x: cur - w*su*.5, i}); cur -= w*su; } };
  add('pico', vis(S.owned.pico || 0, 5), 24);
  add('perfo', vis(S.owned.perfo || 0, 3), 40);
  add('voladura', vis(S.owned.voladura || 0, 2), 24);
  add('excav', vis(S.owned.excav || 0, 2), 50);
  return {list, face, carts: vis(S.owned.vagoneta || 0, 3), su};
}
function drawGallery(m, t){
  const {u, shaftX, gh} = L, G = L.gal[m], M = METALS[m], mc = MCOL[m], {x0, x1, y, top} = G, r = 16*u, sw = 38*u;
  g.beginPath(); g.roundRect(shaftX, top, x1 - shaftX, gh + 6*u, [0, r, r, 0]);
  const gr = g.createLinearGradient(0, top, 0, y); gr.addColorStop(0, '#24160c'); gr.addColorStop(1, '#3d2716'); g.fillStyle = gr; g.fill();
  g.fillStyle = '#6b4a2e'; g.fillRect(shaftX + sw/2, y - 5*u, x1 - shaftX - sw/2 - 4*u, 11*u);
  g.strokeStyle = '#2a1a0e'; g.lineWidth = 3; g.beginPath(); g.roundRect(shaftX + sw/2 - 1, top, x1 - shaftX - sw/2 + 1, gh + 6*u, [0, r, r, 0]); g.stroke();
  if ((S.owned.vagoneta || 0) > 0){
    g.strokeStyle = '#5a3a1a'; g.lineWidth = 3*u; for (let x = x0; x < x1 - 20*u; x += 12*u){ g.beginPath(); g.moveTo(x, y - 1*u); g.lineTo(x + 6*u, y - 1*u); g.stroke(); }
    g.strokeStyle = '#9aa0aa'; g.lineWidth = 1.6*u; g.beginPath(); g.moveTo(x0, y - 3*u); g.lineTo(x1 - 22*u, y - 3*u); g.stroke();
  }
  g.fillStyle = '#9a6a3a'; g.strokeStyle = '#2a1a0e'; g.lineWidth = 1.8;
  for (let x = x0 + 34*u; x < x1 - 30*u; x += 70*u){ g.beginPath(); g.rect(x - 3*u, top + 4*u, 6*u, gh - 8*u); g.fill(); g.stroke(); g.beginPath(); g.rect(x - 12*u, top + 2*u, 24*u, 6*u); g.fill(); g.stroke(); }
  const fx = x1 - 8*u, rv = mulberry32(m.charCodeAt(0)*31 + (x1|0));
  g.beginPath(); g.moveTo(fx, top - 2*u); for (let k = 0; k <= 8; k++) g.lineTo(fx + (rv() - .3)*10*u, top + (gh + 6*u)*k/8);
  g.lineTo(x1 + 30*u, y + 8*u); g.lineTo(x1 + 30*u, top - 2*u); g.closePath();
  g.fillStyle = shade(TEX[Math.min(5, Math.max(0, STRATA.findIndex(s => GAL_DEPTH[m] < s.to)))].base, -.12); g.fill(); g.strokeStyle = '#2a1a0e'; g.lineWidth = 2.5; g.stroke();
  for (let v = 0; v < 3; v++){ g.strokeStyle = mc.vein[0]; g.lineWidth = (5 - v)*u; g.beginPath(); let yy = top + gh*(.2 + v*.3); g.moveTo(fx - 4*u, yy); for (let x = fx; x < x1 + 30*u; x += 8*u){ yy += (rv() - .5)*8*u; g.lineTo(x, yy); } g.stroke(); g.strokeStyle = mc.vein[1]; g.lineWidth = 1.6*u; g.stroke(); }
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let x = x0 + 70*u; x < x1 - 20*u; x += 70*u){ const gl = g.createRadialGradient(x, top + 18*u, 0, x, top + 18*u, 60*u); gl.addColorStop(0, 'rgba(255,190,90,.30)'); gl.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = gl; g.fillRect(x - 60*u, top, 120*u, gh + 6*u); }
  g.restore();
  for (let x = x0 + 70*u; x < x1 - 20*u; x += 70*u){ g.strokeStyle = '#2a1a0e'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, top + 8*u); g.lineTo(x, top + 14*u); g.stroke(); g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(x, top + 17*u, 3.4*u, 0, 6.2832); g.fill(); g.stroke(); }
  const {list, face, carts, su} = galleryUnits(m);
  const strike = S.moral <= 0, lowMoral = S.moral < 60, noE = fac.e < .5, worn = S.maint < 40 && needs().mv > 0;
  const full = S.stock[m] >= cap(m), tm = noE || full ? 0 : t;
  for (let k = 0; k < 6; k++){ const tw = Math.pow(.5 + .5*Math.sin(t*2.3 + k*1.7 + m.length), 10); if (tw < .1) continue; const sx = face + 6*u + (k % 3)*8*u, sy = top + gh*(.2 + (k*.13) % .7), s = (2 + 4*tw)*u; g.strokeStyle = `rgba(255,250,220,${tw})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(sx - s, sy); g.lineTo(sx + s, sy); g.moveTo(sx, sy - s); g.lineTo(sx, sy + s); g.stroke(); }
  for (let i = 0; i < carts; i++){
    const tc = noE || strike || full ? i*3.7 : t;
    const a = x0 + 14*u, b = face - 30*u, sp = .16 + i*.05, p = .5 - .5*Math.cos(tc*sp*2 + i*2.1), x = a + (b - a)*p, left = Math.sin(tc*sp*2 + i*2.1) < 0;
    cart(g, x, y - 1*u, su, mc.ore, left ? 1 : .15);
    miner(g, x + (left ? 16 : -16)*su, y, su*.9, {pose: noE || strike || full ? 'idle' : 'push', t, seed: i + 11, dir: left ? -1 : 1});
  }
  if (S.finds.vagoneta && dayK() < .35 && m === openedList()[openedList().length - 1]){
    const p = .5 - .5*Math.cos(t*.3), x = x0 + 20*u + (face - x0 - 60*u)*p;
    g.save(); g.globalAlpha = .45 + .15*Math.sin(t*3); cart(g, x, y - 6*u - Math.sin(t*2)*3*u, su, '#e8f4ff', 0); g.restore();
  }
  list.forEach(it => {
    if (it.k === 'tbm'){ tbm(g, it.x, y + 1*u, .9*su, tm); if (tm && Math.random() < .25) chipsAt(it.x + 4*su, y - 20*su, 1, m); }
    else if (it.k === 'you'){
      const k = swingK > 0 ? 1 - swingK : null;
      if (sleeping){
        miner(g, it.x, y, su*1.08, {pose: 'idle', t: 0, hat: '#ff5b4f', suit: '#3b7dd8', seed: 1});
        g.font = `400 ${Math.round(14*u)}px "Lilita One", sans-serif`; g.textAlign = 'center';
        for (let z = 0; z < 3; z++){ const p = ((t*.5 + z/3) % 1); g.globalAlpha = 1 - p; g.fillStyle = '#fff5de'; g.strokeStyle = '#2a1a0e'; g.lineWidth = 3; const zx = it.x + 8*u + p*20*u, zy = y - 44*su - p*30*u; g.strokeText('z', zx, zy); g.fillText('z', zx, zy); }
        g.globalAlpha = 1;
      } else miner(g, it.x, y, su*1.08, {pose: 'swing', swing: k != null ? k : (.5 + .5*Math.sin(t*1.5))*.25, hat: '#ff5b4f', suit: '#3b7dd8', seed: 1});
      if (S.clicks < 40 && S.section === 'mina') arrow(g, it.x, y - 60*su - Math.abs(Math.sin(t*4))*6*u, u);
    }
    else if (it.k === 'pico'){ const idle = strike || full || (lowMoral && it.i % 2 === 0), sp = 5 + (it.i % 3); miner(g, it.x, y, su, {pose: idle ? 'idle' : 'swing', t, speed: sp, seed: it.i*5 + 3}); if (!idle && Math.sin(t*sp + it.i*5 + 3) > .985) chipsAt(it.x + 16*su, y - 14*su, 2, m); }
    else if (it.k === 'perfo'){ drill(g, it.x, y + 1*u, su*1.05, tm ? t + it.i : it.i); if (tm && Math.random() < .08) parts.push({k: 'dust', x: it.x + 32*su, y: y - 14*su, vx: 10, vy: -6, life: .8, max: .8, s: 4*u, col: 'rgba(210,190,160,'}); }
    else if (it.k === 'voladura') miner(g, it.x, y, su, {pose: strike || full ? 'idle' : 'dyn', t, seed: it.i*3 + 4});
    else if (it.k === 'excav') excavator(g, it.x, y + 1*u, su*.92, tm, it.i*2);
    if (worn && it.k !== 'you' && it.k !== 'pico' && it.k !== 'voladura' && Math.random() < .03) parts.push({k: 'dust', x: it.x, y: y - 26*su, vx: 4, vy: -18, life: 1.6, max: 1.6, s: 6*u, col: 'rgba(70,64,60,'});
  });
  const machines = list.filter(it => it.k === 'perfo' || it.k === 'excav' || it.k === 'tbm');
  if (noE && machines.length) statusBadge(machines[0].x, top - 2*u, 'e', t);
  else if (worn && machines.length) statusBadge(machines[0].x, top - 2*u, 'w', t);
  if (strike) plate(g, (x0 + face)/2, y - gh*.55, '¡Huelga! Paga los atrasos', '#ff5b4f', '#ffffff', u*.85);
  else if (full) plate(g, (x0 + face)/2, y - gh*.55, 'Almacén lleno: mina parada', '#ffc62e', '#2a1a0e', u*.8);
  if ((S.owned.voladura || 0) > 0 && !RM && !strike && !full && fac.x > .5){
    blastCd[m] -= frameDt;
    if (blastCd[m] <= 0){ blastCd[m] = 9 + Math.random()*9; flashes.push({x: face + 10*u, y: top + gh*.5, life: .5, max: .5, r: 60*u}); chipsAt(face + 4*u, top + gh*.5, 16, m); for (let i = 0; i < 8; i++) parts.push({k: 'dust', x: face, y: top + gh*.5, vx: -20 - Math.random()*60, vy: (Math.random() - .5)*30, life: 1.2, max: 1.2, s: (6 + Math.random()*6)*u, col: 'rgba(200,180,150,'}); if (inView(top, y)) { shake = Math.max(shake, 2); sfx('boom'); } }
  }
  plate(g, x0 + 40*u, top - 10*u, `${M.name} · ${nf0.format(GAL_DEPTH[m])} m · ${weight(gps(m))}/s`, m === S.vein ? mc.ore : '#fff5de', '#2a1a0e', u*.85);
}
function drawCage(t){
  const {u, gy, shaftX} = L, G = L.gal[S.vein], D = Math.max(40*u, G.y - gy - 30*u);
  const per = 2*(D/(260*u) + 1.4), ph = (t % per)/per, pp = ph < .5 ? ph*2 : 2 - ph*2, e = pp < .5 ? 2*pp*pp : 1 - Math.pow(-2*pp + 2, 2)/2;
  const cy = gy + 26*u + (D - 4*u)*e, cx = shaftX - 7*u;
  g.strokeStyle = '#2a1a0e'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, gy - 92*u); g.lineTo(cx, cy - 22*u); g.stroke();
  cage(g, cx, cy, .82*u, ph < .5 ? null : MCOL[S.vein].ore);
}
/* Cubo de extracción: sube el mineral desde el frente hasta la superficie (se ve lo hondo que está la mina). */
function drawSkip(t, v0, v1){
  const {u, gy, shaftX, frenteY} = L, top = gy + 18*u, D = frenteY - 20*u - top; if (D < 60*u || !(S.owned.pico || S.owned.perfo || S.owned.tbm)) return;
  const per = 2*(D/(340*u) + .8), ph = (t % per)/per, pp = ph < .5 ? ph*2 : 2 - ph*2, e = pp < .5 ? 2*pp*pp : 1 - Math.pow(-2*pp + 2, 2)/2;
  const y = top + D*(1 - e), x = shaftX + 11*u;   // arriba cargado, abajo vacío
  g.strokeStyle = 'rgba(42,26,14,.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, Math.max(v0 - 10, gy - 80*u)); g.lineTo(x, y - 14*u); g.stroke();
  if (y < v0 - 30 || y > v1 + 30) return;
  g.save(); g.translate(x, y); g.lineWidth = 1.6; g.strokeStyle = '#2a1a0e';
  g.fillStyle = '#7c848f'; g.beginPath(); g.moveTo(-7*u, -14*u); g.lineTo(7*u, -14*u); g.lineTo(5*u, 0); g.lineTo(-5*u, 0); g.closePath(); g.fill(); g.stroke();
  if (ph >= .5 || ph < .02){ g.fillStyle = MCOL[S.vein].ore; g.beginPath(); g.moveTo(-6*u, -14*u); g.quadraticCurveTo(0, -21*u, 6*u, -14*u); g.closePath(); g.fill(); g.stroke(); }
  g.restore();
}
function drawFrente(t, v0, v1){
  const {u, shaftX, frenteY} = L; if (frenteY < v0 - 120 || frenteY > v1 + 120) return;
  const x = shaftX, y = frenteY, j = Math.sin(t*50)*.8*u, crew = (S.owned.pico || 0) > 0;
  // cámara de trabajo al fondo del pozo: se hunde con la mina y lleva a tu gente y tu mejor máquina
  if (crew){
    const w0 = x - 70*u, w1 = x + 96*u, top = y - 44*u;
    g.fillStyle = '#24160c'; g.beginPath(); g.roundRect(w0, top, w1 - w0, 58*u, 14*u); g.fill();
    g.strokeStyle = '#2a1a0e'; g.lineWidth = 2.5; g.stroke();
    const gl = g.createRadialGradient(x + 10*u, y - 30*u, 0, x + 10*u, y - 30*u, 90*u); gl.addColorStop(0, 'rgba(255,190,90,.28)'); gl.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = gl; g.fillRect(w0, top, w1 - w0, 58*u);
    g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(x + 20*u, top + 8*u, 3.2*u, 0, 6.2832); g.fill(); g.strokeStyle = '#2a1a0e'; g.lineWidth = 1.2; g.stroke();
    const idle = S.moral <= 0, noE = fac.e < .5, tm = noE ? 0 : t, su = .85*u;
    const nm = Math.min(3, vis(S.owned.pico || 0, 3));
    for (let i = 0; i < nm; i++) miner(g, x - 30*u - i*16*u, y + 10*u, su, {pose: idle ? 'idle' : 'swing', t, speed: 5 + i, seed: i*7 + 40});
    const best = (S.owned.tbm || 0) ? 'tbm' : (S.owned.excav || 0) ? 'excav' : (S.owned.voladura || 0) ? 'voladura' : (S.owned.perfo || 0) ? 'perfo' : null;
    if (best === 'tbm') tbm(g, x + 62*u, y + 11*u, .62*u, tm);
    else if (best === 'excav') excavator(g, x + 58*u, y + 11*u, .62*u, tm, 3);
    else if (best === 'perfo') drill(g, x + 52*u, y + 11*u, .75*u, tm);
    else if (best === 'voladura') miner(g, x + 50*u, y + 10*u, su, {pose: idle ? 'idle' : 'dyn', t, seed: 9});
    if (best && tm && !RM && Math.random() < .2) parts.push({k: 'dust', x: x + 70*u, y: y - 4*u, vx: 14, vy: -10, life: .9, max: .9, s: 5*u, col: 'rgba(210,190,160,'});
  }
  g.save(); g.translate(x, y); g.lineWidth = 2.2; g.strokeStyle = '#2a1a0e';
  g.fillStyle = '#ffc62e'; g.beginPath(); g.roundRect(-16*u + j, -30*u, 32*u, 20*u, 5*u); g.fill(); g.stroke();
  g.fillStyle = '#8fd3ff'; g.beginPath(); g.roundRect(-10*u + j, -26*u, 10*u, 8*u, 2*u); g.fill(); g.stroke();
  g.fillStyle = '#7c848f'; g.fillRect(-4*u, -10*u, 8*u, 8*u); g.strokeRect(-4*u, -10*u, 8*u, 8*u);
  g.fillStyle = '#dfe7ef'; g.beginPath(); g.moveTo(-6*u, -2*u); g.lineTo(6*u, -2*u); g.lineTo(0, 14*u); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = '#8b96a3'; g.lineWidth = 1; const off = (t*20) % 4; for (let k = 0; k < 3; k++){ const yy = -1*u + (k*4 + off)*u; if (yy > 12*u) continue; const hw = 6*u*(1 - (yy + 2*u)/(16*u)); g.beginPath(); g.moveTo(-hw, yy); g.lineTo(hw, yy + 2*u); g.stroke(); }
  g.restore();
  if (!RM && Math.random() < .5){ parts.push({k: 'chip', x: x + (Math.random() - .5)*10*u, y: y + 12*u, vx: (Math.random() - .5)*140, vy: -40 - Math.random()*80, life: .5, max: .5, s: 2*u, col: Math.random() < .5 ? '#ffd84a' : TEX[Math.max(0, stratumIdx())].lo, r: 0}); }
  const px = x - (crew ? 110 : 76)*u, tight = px - 62*u < L.lx0 + 4;
  plate(g, tight ? x + (crew ? 14 : 0)*u : px, tight ? y - (crew ? 58 : 44)*u : y - 18*u, `Frente · ${nf0.format(frenteDepth())} m`, '#ff5b4f', '#ffffff', u*.9);
}
/* Tajos: pequeños frentes de trabajo en cada estrato ya atravesado (a la izquierda del pozo). */
const SITE_D = [40, 100, 300, 700, 1000, 1500, 2200, 3000, 4000, 5500, 7000, 8500];
function drawSites(t, v0, v1){
  const {u, shaftX} = L, fd = frenteDepth(), n = S.owned.pico || 0; if (!n) return;
  const busy = MK.filter(m => S.opened[m]).map(m => GAL_DEPTH[m]);
  const maxSites = Math.min(SITE_D.length, 1 + Math.floor(Math.log2(n + 1)));   // más mineros, más tajos abiertos
  let shown = 0;
  SITE_D.forEach((d, i) => {
    if (d > fd - 30 || shown >= maxSites || busy.some(b => Math.abs(b - d) < 45)) return;
    const y = depthY(d) + 30*u; if (Math.abs(y - L.frenteY) < 110*u) return;
    shown++;
    if (y < v0 - 60 || y > v1 + 60) return;
    const si = Math.max(0, STRATA.findIndex(st => d < st.to));
    const x1 = shaftX - 19*u, x0 = Math.max(L.lx0 + 4*u, x1 - 96*u), top = y - 40*u; if (x1 - x0 < 60*u) return;
    g.fillStyle = '#24160c'; g.beginPath(); g.roundRect(x0, top, x1 - x0 + 4*u, 46*u, [14*u, 0, 0, 14*u]); g.fill();
    g.strokeStyle = '#2a1a0e'; g.lineWidth = 2.2; g.stroke();
    g.fillStyle = '#6b4a2e'; g.fillRect(x0 + 6*u, y - 3*u, x1 - x0 - 6*u, 7*u);
    const gl = g.createRadialGradient(x0 + 50*u, top + 10*u, 0, x0 + 50*u, top + 10*u, 50*u); gl.addColorStop(0, 'rgba(255,190,90,.25)'); gl.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = gl; g.fillRect(x0, top, x1 - x0, 46*u);
    const idle = S.moral <= 0;
    miner(g, x0 + 22*u, y, .82*u, {pose: idle ? 'idle' : 'swing', t, speed: 4 + (i % 3), seed: i*13 + 5, dir: -1});
    if (n >= 10 && (S.owned.vagoneta || 0) > 0){ const p = .5 - .5*Math.cos(t*.5 + i), cx = x0 + 40*u + p*36*u; cart(g, cx, y - 1*u, .75*u, TEX[si].hi, p > .5 ? 1 : .2); }
    if (!idle && Math.sin(t*(4 + (i % 3)) + i*13 + 5) > .985) chipsAt(x0 + 8*u, y - 12*u, 2, S.vein);
    plate(g, (x0 + x1)/2, top - 8*u, `Tajo · ${nf0.format(d)} m`, '#fff5de', '#2a1a0e', u*.7);
  });
}
/* ---------- gente y máquinas bajando por el pozo ---------- */
const CREW_LAB = {batea: 'buscador', pico: 'minero', vagoneta: 'vagoneta', perfo: 'perforadora', voladura: 'artificiero', excav: 'excavadora', tbm: 'tuneladora'};
let travelers = [], lastHour = null, shiftPlate = 0;
function destOf(id){
  if (id === 'perfo' || id === 'tbm') return {y: L.frenteY + 10*L.u, x: L.shaftX + 44*L.u};
  const G = L.gal[S.vein]; return {y: G.y, x: G.x0 + 50*L.u};
}
function spawnTraveler(id, n, dir, delay, quiet){
  if (!L || !CREW_LAB[id] || travelers.length > 16) return;
  travelers.push({id, n, dir, t: -delay, dest: destOf(id), seed: (Math.random()*99)|0, quiet, rx: Math.random()});
}
function travelerPos(v){
  const {u, gy, shaftX} = L, d = v.dest, ride = Math.min(5, Math.max(1.1, Math.abs(d.y - gy)/(330*u)));
  const walk1 = .9, walk2 = .9, total = walk1 + ride + walk2;
  if (v.id === 'batea'){
    const rx0 = L.lx0 + 26*u, rx1 = shaftX - 50*u, tx = rx0 + 16*u + Math.max(0, rx1 - rx0 - 32*u)*v.rx, k = Math.min(1, v.t/1.6);
    return {x: shaftX - 20*u + (tx - shaftX + 20*u)*k, y: gy + 2*u, pose: k < 1 ? 'walk' : 'pan', face: -1, a: v.t < 1.6 ? 1 : Math.max(0, 1 - (v.t - 1.6)*2), done: v.t > 2.2, riding: false};
  }
  let tt = v.t;
  if (v.dir === 'up') tt = total - v.t;   // subir es lo mismo al revés
  let x, y, pose = 'walk', riding = false, a = 1, face = 1;
  if (tt < walk1){ const k = tt/walk1; x = shaftX - 80*u + 73*u*k; y = gy + 2*u; }
  else if (tt < walk1 + ride){ const k = (tt - walk1)/ride, e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2)/2; x = shaftX - 7*u; y = gy + 22*u + (d.y - gy - 22*u)*e; pose = 'idle'; riding = true; }
  else { const k = Math.min(1, (tt - walk1 - ride)/walk2); x = shaftX - 7*u + (d.x - shaftX + 7*u)*k; y = d.y; }
  if (v.dir === 'up'){ face = -1; if (v.t > total - .35) a = Math.max(0, (total - v.t)/.35); if (v.t < .3) a = v.t/.3; }
  else if (tt > total - .35) a = Math.max(0, (total - tt)/.35);
  return {x, y, pose, riding, a, face, done: v.t > total};
}
function drawTravelers(dt, t, v0, v1){
  if (!travelers.length) return;
  const {u, gy} = L;
  travelers.forEach(v => { v.t += dt; });
  travelers = travelers.filter(v => {
    if (v.t < 0) return true;
    const p = travelerPos(v); if (p.done) return false;
    if (p.y < v0 - 80 || p.y > v1 + 80) return true;
    g.save(); g.globalAlpha = Math.max(0, Math.min(1, p.a));
    if (p.riding){
      g.strokeStyle = '#2a1a0e'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(p.x, Math.max(v0 - 10, gy - 80*u)); g.lineTo(p.x, p.y - 34*u); g.stroke();
      g.fillStyle = '#7c848f'; g.strokeStyle = '#2a1a0e'; g.lineWidth = 1.6; g.beginPath(); g.rect(p.x - 13*u, p.y, 26*u, 4*u); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(p.x - 12*u, p.y); g.lineTo(p.x, p.y - 34*u); g.lineTo(p.x + 12*u, p.y); g.stroke();
    }
    const id = v.id, s1 = .8*u;
    if (id === 'vagoneta') cart(g, p.x, p.y - 1*u, .8*u, MCOL[S.vein].ore, .2);
    else if (id === 'perfo') drill(g, p.x, p.y + 1*u, .62*u, p.riding ? 0 : t);
    else if (id === 'excav') excavator(g, p.x, p.y + 1*u, .5*u, p.riding ? 0 : t, 2);
    else if (id === 'tbm') tbm(g, p.x, p.y + 1*u, .45*u, p.riding ? 0 : t);
    else miner(g, p.x, p.y, s1, {pose: p.pose, t, seed: v.seed, dir: p.face, suit: v.dir === 'up' ? '#8d8490' : undefined});
    g.restore();
    if (!v.quiet && (p.riding || v.id === 'batea') && v.t < 3.5){ plate(g, p.x + 44*u, p.y - 30*u, `+${v.n} ${CREW_LAB[id]}${v.n > 1 ? (/[aeiou]$/.test(CREW_LAB[id]) ? 's' : 'es') : ''}`, '#3fcf6c', '#ffffff', u*.75); }
    return true;
  });
}
/* Cambio de turno a las 06:00, 14:00 y 22:00: baja un grupo y sube el que termina. */
function shiftCheck(){
  const h = Math.floor(gameMin()/60);
  if (lastHour != null && h !== lastHour && (h === 6 || h === 14 || h === 22) && (S.owned.pico || 0) > 0 && S.moral > 0){
    const n = Math.min(4, 1 + vis(S.owned.pico || 0, 4));
    for (let i = 0; i < n; i++){ spawnTraveler('pico', 1, 'down', i*.7, true); spawnTraveler('pico', 1, 'up', .3 + i*.7, true); }
    shiftPlate = 3.5;
  }
  lastHour = h;
}
function drawFog(v1){
  const {u, frenteY} = L, a = frenteY + 26*u; if (a > v1) return;
  const fg = g.createLinearGradient(0, a, 0, a + 110*u); fg.addColorStop(0, 'rgba(22,12,5,0)'); fg.addColorStop(1, 'rgba(22,12,5,.86)');
  g.fillStyle = fg; g.fillRect(0, a, W, 110*u);
  g.fillStyle = 'rgba(22,12,5,.86)'; g.fillRect(0, a + 110*u, W, Math.max(0, v1 - a - 110*u + 40));
}
function drawSigns(v0, v1){
  const {u, shaftX, gh} = L;
  MK.forEach(m => {
    const G = L.gal[m], M = METALS[m];
    if (S.opened[m]){ G.sign = null; return; }
    const y = G.y - gh*.5, x = shaftX + 110*u; if (y < v0 - 40 || y > v1 + 40){ G.sign = null; return; }
    const lvOk = unl(m);
    plate(g, x, y, lvOk ? `Abrir ${M.low} · ${money(M.open)}` : `${M.name} · nivel ${lvReq(m)}`, lvOk ? '#ffc62e' : '#e9dcc3', '#2a1a0e', u, !lvOk);
    G.sign = {x0: x - 110*u, x1: x + 110*u, y0: y - 16*u, y1: y + 16*u};
  });
}
function drawFinds(t, v0, v1){
  const {u, fpos} = L, fd = frenteDepth();
  visibleFinds().forEach(f => {
    const p = fpos[f.id]; if (!p || p.y < v0 - 80 || p.y > v1 + 80) return;
    const R = RARITY[f.rar], big = f.rar === 'e' || f.rar === 'l', s = (big ? 62 : 50)*u, bob = Math.sin(t*2.4 + p.x)*3*u;
    const gl = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s*1.4); gl.addColorStop(0, 'rgba(255,245,200,.85)'); gl.addColorStop(.5, R.col + '66'); gl.addColorStop(1, R.col + '00');
    g.fillStyle = gl; g.beginPath(); g.arc(p.x, p.y, s*1.4*(1 + .06*Math.sin(t*3)), 0, 6.2832); g.fill();
    const im = findImg(f.id); if (im) g.drawImage(im, p.x - s/2, p.y - s/2 + bob, s, s);
    const by = p.y - s*.75 + bob - Math.abs(Math.sin(t*3))*4*u;
    g.lineWidth = 2.4; g.strokeStyle = '#2a1a0e'; g.fillStyle = R.col; g.beginPath(); g.arc(p.x + s*.42, by, 11*u, 0, 6.2832); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = `400 ${Math.round(15*u)}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', p.x + s*.42, by + 1);
    const sp = (t*1.1 + p.x*.01) % 1; if (sp < .6){ const r = (3 + sp*9)*u, sx = p.x - s*.45, sy = p.y - s*.3; g.globalAlpha = 1 - sp/.6; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(sx, sy - r); g.lineTo(sx + r*.25, sy - r*.25); g.lineTo(sx + r, sy); g.lineTo(sx + r*.25, sy + r*.25); g.lineTo(sx, sy + r); g.lineTo(sx - r*.25, sy + r*.25); g.lineTo(sx - r, sy); g.lineTo(sx - r*.25, sy - r*.25); g.closePath(); g.fill(); g.globalAlpha = 1; }
  });
  const next = FINDS.filter(f => !S.finds[f.id] && f.d > fd && !f.night).sort((a, b) => a.d - b.d)[0];
  if (next){ const p = fpos[next.id]; if (p && p.y < L.frenteY + L.HS*.9 && p.y > v0 - 40 && p.y < v1 + 40){ g.globalAlpha = .28 + .12*Math.sin(t*2); g.fillStyle = '#f2d59e'; g.font = `400 ${Math.round(30*u)}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', p.x, p.y); g.globalAlpha = 1; } }
}
function drawTopo(t){
  if (!topoVis) return;
  const {u} = L, v = topoVis, e = Math.min(1, (7 - v.life)*4, v.life*3), x = v.x, y = v.y;
  g.save(); g.translate(x, y); g.lineWidth = 2; g.strokeStyle = '#2a1a0e';
  g.fillStyle = '#2b1a0e'; g.beginPath(); g.ellipse(0, 10*u, 26*u, 9*u, 0, 0, 6.2832); g.fill(); g.stroke();
  g.beginPath(); g.rect(-30*u, -30*u, 60*u, 40*u); g.clip();
  g.translate(0, (1 - e)*26*u);
  g.fillStyle = '#7a5a44'; g.beginPath(); g.moveTo(-18*u, 10*u); g.bezierCurveTo(-18*u, -16*u, 18*u, -16*u, 18*u, 10*u); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ff8fb1'; g.beginPath(); g.arc(0, 0, 3.4*u, 0, 6.2832); g.fill(); g.stroke();
  g.fillStyle = '#1d1d24'; g.beginPath(); g.roundRect(-13*u, -8*u, 10*u, 6*u, 2*u); g.roundRect(3*u, -8*u, 10*u, 6*u, 2*u); g.fill(); g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-11*u, -6*u); g.lineTo(-8*u, -6*u); g.stroke();
  g.restore();
}
function plate(c, x, y, text, bgc, fg, u, locked){
  c.save(); c.font = `400 ${Math.round(13*u)}px "Lilita One", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + (locked ? 34 : 18)*u, h = 22*u;
  c.lineWidth = 2; c.strokeStyle = '#2a1a0e'; c.fillStyle = '#2a1a0e';
  c.beginPath(); c.roundRect(x - w/2, y - h/2 + 2.5*u, w, h, 7*u); c.fill();
  c.fillStyle = bgc; c.beginPath(); c.roundRect(x - w/2, y - h/2, w, h, 7*u); c.fill(); c.stroke();
  c.fillStyle = fg; c.fillText(text, x + (locked ? 8*u : 0), y + 1);
  if (locked){ const lx = x - w/2 + 13*u; c.strokeStyle = fg; c.lineWidth = 1.8*u; c.beginPath(); c.arc(lx, y - 2*u, 3.2*u, Math.PI, 0); c.stroke(); c.fillStyle = fg; c.fillRect(lx - 4.6*u, y - 1.5*u, 9.2*u, 7*u); }
  c.restore();
}
function arrow(c, x, y, u){
  c.save(); c.translate(x, y); c.lineWidth = 2.2; c.strokeStyle = '#2a1a0e'; c.fillStyle = '#ffc62e';
  c.beginPath(); c.moveTo(-9*u, -12*u); c.lineTo(9*u, -12*u); c.lineTo(9*u, -2*u); c.lineTo(15*u, -2*u); c.lineTo(0, 12*u); c.lineTo(-15*u, -2*u); c.lineTo(-9*u, -2*u); c.closePath(); c.fill(); c.stroke();
  c.restore();
}

/* ---------- partículas y textos flotantes (en coordenadas del mundo) ---------- */
function chipsAt(x, y, n, m){
  const mc = MCOL[m] || MCOL.au, st = TEX[Math.max(0, stratumIdx())];
  for (let i = 0; i < n && parts.length < 420; i++){ const gold = i % 3 === 0; parts.push({k: 'chip', x, y, vx: (Math.random() - .5)*220, vy: -60 - Math.random()*200, life: .7 + Math.random()*.5, max: 1.2, s: (gold ? 3 : 2 + Math.random()*3)*L.u, col: gold ? mc.ore : (Math.random() < .5 ? st.base : st.lo), r: Math.random()*6}); }
}
function floater(x, y, text, col, size = 18){ floats.push({x: x + (Math.random() - .5)*28, y: y + (Math.random() - .5)*10, text, col, life: 1.1, max: 1.1, size}); if (floats.length > 30) floats.shift(); }
function drawParticles(dt){
  parts = parts.filter(p => (p.life -= dt) > 0);
  parts.forEach(p => {
    const a = Math.min(1, p.life/p.max*2);
    if (p.k === 'chip'){ p.vy += 620*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.r += dt*8; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = a; g.fillStyle = p.col; g.fillRect(-p.s/2, -p.s/2, p.s, p.s); g.strokeStyle = 'rgba(42,26,14,.8)'; g.lineWidth = 1; g.strokeRect(-p.s/2, -p.s/2, p.s, p.s); g.restore(); }
    else { p.x += p.vx*dt; p.y += p.vy*dt; const r = p.s*(1.6 - p.life/p.max*.6); g.fillStyle = p.col + (a*.55).toFixed(3) + ')'; g.beginPath(); g.arc(p.x, p.y, r, 0, 6.2832); g.fill(); }
  });
  g.globalAlpha = 1;
  flashes = flashes.filter(f => (f.life -= dt) > 0);
  flashes.forEach(f => { const k = f.life/f.max, gl = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r*(1.4 - k*.4)); gl.addColorStop(0, `rgba(255,245,200,${k})`); gl.addColorStop(.4, `rgba(255,170,60,${k*.7})`); gl.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gl; g.beginPath(); g.arc(f.x, f.y, f.r*1.4, 0, 6.2832); g.fill(); });
  floats = floats.filter(f => (f.life -= dt) > 0);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  floats.forEach(f => {
    const k = 1 - f.life/f.max, y = f.y - k*54, sc = k < .15 ? .6 + k/.15*.5 : 1.1 - Math.min(.1, k - .15);
    g.globalAlpha = Math.min(1, f.life*2.2); g.font = `400 ${Math.round(f.size*sc)}px "Lilita One", sans-serif`;
    g.strokeStyle = '#2a1a0e'; g.lineWidth = 5; g.strokeText(f.text, f.x, y); g.fillStyle = f.col; g.fillText(f.text, f.x, y);
  });
  g.globalAlpha = 1;
}

/* ---------- el raíl: mapa de toda la mina ---------- */
function drawRail(t){
  const r = railCv.getBoundingClientRect(); if (!r.width || !L) return;
  const w = r.width, h = r.height, D = Math.min(2, dpr);
  if (railCv.width !== Math.round(w*D) || railCv.height !== Math.round(h*D)){ railCv.width = Math.round(w*D); railCv.height = Math.round(h*D); }
  const c = rgx; c.setTransform(D, 0, 0, D, 0, 0); c.clearRect(0, 0, w, h);
  const top = L.gy, bot = L.STY[6], map = y => clamp((y - top)/(bot - top), 0, 1)*h;
  c.save(); c.beginPath(); c.roundRect(0, 0, w, h, 10); c.clip();
  for (let i = 0; i < 6; i++){ const y0 = map(L.STY[i]), y1 = map(L.STY[i+1]); c.fillStyle = TEX[i].base; c.fillRect(0, y0, w, y1 - y0 + 1); }
  c.fillStyle = '#6cc24a'; c.fillRect(0, 0, w, map(L.STY[0]));
  const fy = map(L.frenteY); c.fillStyle = 'rgba(15,8,3,.6)'; c.fillRect(0, fy, w, h - fy);
  c.restore();
  c.lineWidth = 2; c.strokeStyle = '#2a1a0e';
  MK.forEach(m => { const y = map(L.gal[m].y); c.fillStyle = S.opened[m] ? MCOL[m].ore : 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(w*.28, y, 4.5, 0, 6.2832); c.fill(); c.stroke(); });
  FINDS.forEach(f => { const p = L.fpos[f.id]; if (!p) return; const y = map(p.y);
    if (S.finds[f.id]){ c.fillStyle = 'rgba(255,245,222,.8)'; c.beginPath(); c.arc(w*.72, y, 1.8, 0, 6.2832); c.fill(); }
    else if (f.d <= frenteDepth() && (!f.night || dayK() < .35)){ const pul = 3.8 + Math.sin(t*6)*1; c.fillStyle = RARITY[f.rar].col; c.beginPath(); c.arc(w*.72, y, pul, 0, 6.2832); c.fill(); c.stroke(); }
  });
  if (nugget && S.opened[nugget.m]){ const y = map(L.gal[nugget.m].y); c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(w*.5, y, 3.5 + Math.sin(t*8), 0, 6.2832); c.fill(); c.stroke(); }
  if (bubble && bubble.m){ const y = map(L.gal[bubble.m].y), P = powerById(bubble.id); c.fillStyle = P.col; c.beginPath(); c.arc(w*.5, y, 4.5 + Math.sin(t*8)*1.5, 0, 6.2832); c.fill(); c.stroke(); }
  c.fillStyle = '#ff5b4f'; c.beginPath(); c.moveTo(0, fy - 5); c.lineTo(8, fy); c.lineTo(0, fy + 5); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#ff5b4f'; c.lineWidth = 2; c.beginPath(); c.moveTo(6, fy); c.lineTo(w, fy); c.stroke();
  const vy0 = map(camY + L.sy0), vy1 = map(camY + L.digTop), vh = Math.max(8, vy1 - vy0);
  c.lineWidth = 3; c.strokeStyle = '#2a1a0e'; c.beginPath(); c.roundRect(1.5, vy0, w - 3, vh, 5); c.stroke();
  c.lineWidth = 2; c.strokeStyle = '#ffffff'; c.beginPath(); c.roundRect(1.5, vy0, w - 3, vh, 5); c.stroke();
  setT($('#railDepth'), `${nf0.format(frenteDepth())} m`);
}

/* ---------- bucle de dibujo ---------- */
const inView = (y0, y1) => y1 > camY - 40 && y0 < camY + H + 40;
export function render(t, dt){
  if (!W) resizeScene();
  if (!L || (layoutAge += dt) > .5) layoutScene();
  frameDt = dt;
  if (swingK > 0) swingK = Math.max(0, swingK - dt*6);
  if (flagDance > 0) flagDance -= dt;
  if (astroT > 0) astroT -= dt;
  // cámara
  if (S.vein !== lastVein){ if (lastVein) focusY(L.gal[S.vein].top); lastVein = S.vein; }
  if (!drag){
    if (camTarget != null){ camY += (camTarget - camY)*Math.min(1, dt*7); if (Math.abs(camTarget - camY) < .5){ camY = camTarget; camTarget = null; } }
    else if (Math.abs(camVel) > 8){ camY += camVel*dt; camVel *= Math.pow(.05, dt); } else camVel = 0;
  }
  clampCam();
  // siesta y topo
  if (S.section === 'mina'){
    idleT += dt;
    if (!sleeping && idleT > 120){ sleeping = true; secret('s_siesta'); }
    if (S.finds.topo){
      if (topoVis){ if ((topoVis.life -= dt) <= 0){ topoVis = null; topoCd = 40 + Math.random()*60; } }
      else if ((topoCd -= dt) <= 0){
        const {u} = L, y = camY + L.sy0 + 60*u + Math.random()*Math.max(10, L.digTop - L.sy0 - 120*u), x = L.lx0 + 60*u + Math.random()*(L.maxX - L.lx0 - 120*u);
        const hitGal = MK.some(m => { const G = L.gal[m]; return y > G.top - 30*u && y < G.y + 30*u && x > L.shaftX - 40*u && x < G.x1 + 40*u; });
        if (y > L.gy + 30*u && y < L.frenteY && !hitGal && Math.abs(x - L.shaftX) > 60*u) topoVis = {x, y, life: 7};
        else topoCd = 2;
      }
    }
  }
  g.setTransform(SD, 0, 0, SD, 0, 0);
  const sx = shake && !RM ? (Math.random() - .5)*shake*2 : 0, sy = shake && !RM ? (Math.random() - .5)*shake*2 : 0;
  shake = shake > .2 ? shake*.85 : 0;
  g.translate(sx, sy - camY);
  const v0 = camY, v1 = camY + H, k = dayK();
  if (L.gy > v0 - 10){ drawSky(t, k); }
  drawStrata(Math.max(v0, L.gy), v1, t);
  if (L.gy + 20 > v0) drawGround();
  drawAmbient(v0, v1, t);
  drawFog(v1);
  drawShaft(v0, v1);
  drawTicks(v0, v1);
  openedList().forEach(m => { const G = L.gal[m]; if (inView(G.top - 30, G.y + 30)) drawGallery(m, t); });
  drawSites(t, v0, v1);
  drawSkip(t, v0, v1);
  drawCage(t);
  drawFrente(t, v0, v1);
  drawSigns(v0, v1);
  drawFinds(t, v0, v1);
  drawTopo(t);
  if (nugget && S.opened[nugget.m]){
    const G = L.gal[nugget.m], x = G.x0 + (G.x1 - G.x0)*nugget.u, y = nugget.v < 0 ? G.top - 16*L.u : G.y + 18*L.u;
    if (!(nugget.life < 3 && Math.floor(t*6) % 2) && inView(y - 30, y + 30)) nuggetSprite(g, x, y, L.u, MCOL[nugget.m].ore, MCOL[nugget.m].hi, t);
    nugget.px = x; nugget.py = y;
  }
  if (bubble && !bubble.m){ const open = openedList(), mid = camY + H*.45; bubble.m = open.reduce((b, m) => Math.abs(L.gal[m].y - mid) < Math.abs(L.gal[b].y - mid) ? m : b, open[0]); }
  if (bubble && S.opened[bubble.m]){
    const G = L.gal[bubble.m], P = powerById(bubble.id), u = L.u, x = G.x0 + (G.x1 - G.x0)*bubble.u, y = G.top + (G.y - G.top)*.42 + Math.sin(t*2.2)*5*u;
    if (!(bubble.life < 3 && Math.floor(t*6) % 2) && inView(y - 40, y + 40)) powerBubble(g, x, y, u, P, t);
    bubble.px = x; bubble.py = y;
  }
  if (L.gy > v0 - 140){
    drawSurface(t, k);
    if (shiftPlate > 0){ shiftPlate -= dt; plate(g, L.shaftX - 60*L.u, L.gy - 104*L.u, 'Cambio de turno', '#ffc62e', '#2a1a0e', L.u*.8); }
    if (k < 1){ g.fillStyle = `rgba(12,20,60,${(1 - k)*.28})`; g.fillRect(0, 0, W, L.gy + 2); }
  }
  shiftCheck();
  drawTravelers(dt, t, v0, v1);
  drawParticles(dt);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (S.section === 'mina') drawRail(t);
}

/* ---------- interacción ---------- */
function digPoint(){
  if (!L) return [W/2, H/2];
  const G = L.gal[S.vein], x = G.x1 - 14*L.u, y = G.top + L.gh*.55;
  if (y - camY > L.sy0 && y - camY < L.digTop) return [x, y];
  const b = rectOf('#btnDig'); return b ? [b.left + b.width/2, b.top - 30 + camY] : [W/2, camY + H/2];
}
/* Punto de picado de otra galería: solo si se ve en pantalla (si no, no hace falta enseñarlo). */
function digPointOf(m){
  if (!L || m === S.vein) return digPoint();
  const G = L.gal[m], x = G.x1 - 14*L.u, y = G.top + L.gh*.55;
  return y - camY > L.sy0 && y - camY < L.digTop ? [x, y] : null;
}
function wake(){ idleT = 0; if (sleeping){ sleeping = false; const [x, y] = digPoint(); floater(x, y - 40*L.u, '¡Ya voy, ya voy!', '#fff5de', 17); } }
function tapAt(x, sy){
  if (!L) return;
  const y = sy + camY, u = L.u;
  wake();
  if (L.moon && Math.hypot(x - L.moon.x, y - L.moon.y) < L.moon.r + 10){
    moonHits++; floater(L.moon.x, L.moon.y - 20*u, moonHits < 10 ? `${moonHits}` : '¡Hola!', '#f4f1dc', 16); sfx('ui');
    if (moonHits >= 10){ moonHits = 0; astroT = 10; secret('s_luna'); }
    return;
  }
  if (L.flag && x > L.flag.x0 && x < L.flag.x1 && y > L.flag.y0 && y < L.flag.y1){ flagDance = 3; secret('s_bandera'); sfx('pop'); return; }
  if (topoVis && Math.hypot(x - topoVis.x, y - topoVis.y) < 32*u){ const g0 = patTopo(); floater(topoVis.x, topoVis.y - 30*u, `¡Gracias, topo! +${weight(g0)}`, '#ffd84a', 18); chipsAt(topoVis.x, topoVis.y, 12, S.vein); emit('fxOre', x, sy, S.vein); topoVis = null; topoCd = 50 + Math.random()*70; return; }
  for (const f of visibleFinds()){ const p = L.fpos[f.id]; if (p && Math.hypot(x - p.x, y - p.y) < 42*u){ chipsAt(p.x, p.y, 24, S.vein); flashes.push({x: p.x, y: p.y, life: .6, max: .6, r: 80*u}); emit('fxBurst', p.x, p.y - camY, RARITY[f.rar].col); collectFind(f.id); return; } }
  if (bubble && bubble.px != null && Math.hypot(x - bubble.px, y - bubble.py) < 38*u){ const bx = bubble.px, by = bubble.py, P = powerById(bubble.id); popBubble(); flashes.push({x: bx, y: by, life: .6, max: .6, r: 90*u}); emit('fxBurst', bx, by - camY, P.col); floater(bx, by - 30*u, P.name + '!', '#fff5de', 22); return; }
  if (nugget && nugget.px != null && Math.hypot(x - nugget.px, y - nugget.py) < 34*u){ collectNugget(); return; }
  const vb = L.vaultBox; if (vb && x > vb.x0 && x < vb.x1 && y > vb.y0 && y < vb.y1){ emit('vaultTap'); sfx('ui'); return; }
  for (const m of MK){ const G = L.gal[m]; if (G.sign && x > G.sign.x0 && x < G.sign.x1 && y > G.sign.y0 && y < G.sign.y1){ openVein(m); return; } }
  for (const m of MK){ const G = L.gal[m]; if (S.opened[m] && x > L.shaftX && x < G.x1 + 30*u && y > G.top - 14*u && y < G.y + 12*u && m !== S.vein){ lastVein = m; S.vein = m; K.vein = ''; updateUI(); break; } }
  dig(x, y);
}
cv.addEventListener('pointerdown', e => {
  if (S.section !== 'mina') return;
  drag = {id: e.pointerId, y: e.clientY, cam: camY, moved: false, lastY: e.clientY, lastT: performance.now()};
  camTarget = null; camVel = 0;
  try { cv.setPointerCapture(e.pointerId); } catch(err){}
});
cv.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dy = e.clientY - drag.y;
  if (!drag.moved && Math.abs(dy) > 8) drag.moved = true;
  if (drag.moved){ camY = drag.cam - dy; clampCam(); const now = performance.now(), dtm = Math.max(8, now - drag.lastT); camVel = -(e.clientY - drag.lastY)/dtm*1000; drag.lastY = e.clientY; drag.lastT = now; }
});
cv.addEventListener('pointerup', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  if (d.moved){ if (performance.now() - d.lastT > 90) camVel = 0; return; }
  camVel = 0; tapAt(e.clientX, e.clientY);
});
cv.addEventListener('pointercancel', () => { drag = null; });
cv.addEventListener('wheel', e => { if (S.section !== 'mina') return; e.preventDefault(); camTarget = null; camVel = 0; camY += e.deltaY*(e.deltaMode === 1 ? 32 : 1); clampCam(); }, {passive: false});
cv.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); wake(); dig(); } });
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tg = e.target; if (tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) return;
  if (/^[a-zA-Z]$/.test(e.key)){ vetaBuf = (vetaBuf + e.key.toUpperCase()).slice(-4); if (vetaBuf === 'VETA'){ vetaBuf = ''; secret('s_veta'); emit('coinRain'); } }
  if (S.section !== 'mina' || !L || !$('#menu').hidden) return;
  const step = {ArrowDown: 140, ArrowUp: -140, PageDown: 520, PageUp: -520}[e.key];
  if (step){ e.preventDefault(); camTarget = clamp((camTarget ?? camY) + step, 0, L.camMax); }
  else if (e.key === 'Home'){ e.preventDefault(); camTarget = 0; }
  else if (e.key === 'End'){ e.preventDefault(); camTarget = L.camMax; }
});
$('#railUp').addEventListener('click', () => { camTarget = 0; camVel = 0; sfx('ui'); });
$('#railDown').addEventListener('click', () => { if (L){ camTarget = L.camMax; camVel = 0; } sfx('ui'); });
railCv.addEventListener('pointerdown', e => { if (!L) return; const r = railCv.getBoundingClientRect(); focusY(L.gy + (e.clientY - r.top)/r.height*(L.STY[6] - L.gy)); });

on('dig', (x, y, m, p) => {
  if (!L) return;
  if (x == null){ const pt = digPointOf(m); if (!pt){ emit('fxOre', W*.5, H*.5, m); return; } [x, y] = pt; x += (Math.random() - .5)*20; y += (Math.random() - .5)*20; }
  wake();
  swingK = 1; chipsAt(x, y, RM ? 4 : 10, m); floater(x, y - 12, '+' + weight(p), MCOL[m].txt, 20);
  if (!RM) shake = Math.max(shake, 2.2);
  emit('fxOre', x, y - camY, m);
});
on('gemFound', (G, x, y, src) => {
  if (!L || S.section !== 'mina') return;
  let px = x, py = y;
  if (px == null){ const pt = src === 'crew' ? null : digPoint(); if (!pt) return; [px, py] = pt; }
  for (let i = 0; i < 16 && parts.length < 420; i++){ const a = Math.random()*6.2832, v = 80 + Math.random()*160; parts.push({k: 'chip', x: px, y: py, vx: Math.cos(a)*v, vy: Math.sin(a)*v - 80, life: .8, max: .8, s: (2.5 + Math.random()*3)*L.u, col: i % 2 ? G.col : G.hi, r: Math.random()*6}); }
  floater(px, py - 26*L.u, `¡${G.name}!`, G.hi, 24); emit('fxBurst', px, py - camY, G.col);
});
on('digFull', (x, y) => { if (!L) return; if (x == null) [x, y] = digPoint(); floater(x, y, '¡Almacén lleno!', '#ff7d72', 18); });
on('nuggetGot', (m, g0) => { if (!nugget || nugget.px == null) return; const x = nugget.px, y = nugget.py; chipsAt(x, y, 22, m); floater(x, y - 16, '¡Pepita! +' + weight(g0), MCOL[m].txt, 24); emit('fxBurst', x, y - camY, MCOL[m].ore); });
on('sold', m => { if (!L) return; trucks.push({x: (L.vaultX || L.shaftX) + 20*L.u, dir: 1, v: 110*L.u, ore: MCOL[m] ? MCOL[m].ore : '#ffc62e'}); });
on('bought', (id, n) => { if (!L) return; L = null; layoutScene(); spawnTraveler(id, n || 1, 'down', 0, false); const G = L.gal[S.vein], surf = id === 'batea' || id === 'lix'; const x = surf ? (id === 'batea' ? L.shaftX - 80*L.u : L.shaftX + 150*L.u) : G.x0 + 60*L.u, y = surf ? L.gy - 10*L.u : G.y - 20*L.u; for (let i = 0; i < 14; i++) parts.push({k: 'dust', x, y, vx: (Math.random() - .5)*120, vy: -Math.random()*60, life: .9, max: .9, s: (5 + Math.random()*5)*L.u, col: 'rgba(255,240,210,'}); });
export function sceneDebug(){ return {L, camY}; }
on('focusFind', id => { if (L && L.fpos[id]){ focusY(L.fpos[id].y); if (S.section !== 'mina') showSection('mina'); } });
on('sceneReset', () => { parts = []; floats = []; trucks = []; travelers = []; lastHour = null; L = null; camY = 0; camTarget = null; lastVein = null; topoVis = null; });
on('crew', () => { L = null; });
on('layout', () => { L = null; });
addEventListener('resize', resizeScene);
