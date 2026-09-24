import { K, on, sfx, updateUI } from '../core/bus.js';
import { $, dpr } from '../core/dom.js';
import { money, mulberry32, nf1 } from '../core/format.js';
import { RM } from '../core/settings.js';
import { BIZ, DAY_LEN } from '../data/content.js';
import { S, bizCost, bizLvl, unl } from '../game/state.js';
import { building, cloud, lerpCol, miner, truck } from '../render/sprites.js';

/* ================= la ciudad de tus empresas =================
   Una calle con un solar por empresa. Los edificios crecen con el nivel, llevan cartel luminoso,
   gerente en la puerta y bandera si cotizan en bolsa. Hay tráfico, gente, farolas y el mismo día y noche que la mina.
   Toca un edificio (o su pestaña) para ver su ficha y mejorarlo. */
const cityCv = $('#cityCv'), cc = cityCv.getContext('2d');
let CTW = 0, CTH = 0, raf = 0, ctLast = 0, lots = [], cars = [], walkers = [], coins = [], hover = null, sparkT = 0;
const LOT_COL = {joyeria: '#ff9ec0', refineria: '#8fa6bd', transporte: '#ffd36b', inmo: '#7fc3a7', banco: '#f1e6cf', tec: '#3ea8ff'};
const EST = {joyeria: 44, refineria: 58, transporte: 40, inmo: 58, banco: 52, tec: 76};   // altura aproximada del edificio a escala 1

export const bizSel = () => { if (!S.bizSel || !BIZ.some(b => b.id === S.bizSel)){ const open = BIZ.find(b => bizLvl(b.id) > 0); S.bizSel = (open || BIZ[0]).id; } return S.bizSel; };
export function selectBiz(id){ S.bizSel = id; K.biz = ''; sfx('ui'); updateUI(); scrollToLot(id); }
/* En el móvil la calle es más ancha que la pantalla: se desliza hasta el edificio elegido. */
function scrollToLot(id){ const wrap = cityCv.parentNode, L = lots.find(x => x.b.id === id); if (!L || wrap.scrollWidth <= wrap.clientWidth) return; wrap.scrollTo({left: Math.max(0, L.x - wrap.clientWidth/2), behavior: RM ? 'auto' : 'smooth'}); }

function size(){
  const r = cityCv.getBoundingClientRect(); if (!r.width) return false;
  const d = Math.min(2, dpr);
  if (CTW !== r.width || CTH !== r.height){ CTW = r.width; CTH = r.height; cityCv.width = Math.round(CTW*d); cityCv.height = Math.round(CTH*d); }
  cc.setTransform(d, 0, 0, d, 0, 0); return true;
}
function cityDayK(){ const tt = ((S.tarT/DAY_LEN*120) % 120 + 120) % 120, sm = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a)/(b - a))); return k*k*(3 - 2*k); }; return sm(58, 68, tt)*(1 - sm(110, 120, tt)); }
function layout(){
  const n = BIZ.length, pad = 16, street = CTH*.8, lw = (CTW - pad*2)/n;
  lots = BIZ.map((b, i) => ({b, x: pad + lw*i + lw/2, w: lw, y: street}));
  return street;
}
function citySky(k){
  const sk = cc.createLinearGradient(0, 0, 0, CTH*.8); sk.addColorStop(0, lerpCol('#0c1433', '#4fb0ff', k)); sk.addColorStop(1, lerpCol('#2b3f7a', '#c4ebff', k));
  cc.fillStyle = sk; cc.fillRect(0, 0, CTW, CTH);
  if (k < 1) for (let i = 0; i < 40; i++){ const r = mulberry32(i*31 + 3); cc.globalAlpha = (1 - k)*(.4 + .6*r()); cc.fillStyle = '#fff'; cc.fillRect(r()*CTW, r()*CTH*.45, 1.5, 1.5); }
  cc.globalAlpha = 1;
  // silueta lejana de la ciudad
  cc.fillStyle = lerpCol('#1d2750', '#9cc4e8', k);
  const rr = mulberry32(99);
  for (let x = -10; x < CTW + 40;){ const w = 18 + rr()*34, h = 30 + rr()*CTH*.3; cc.fillRect(x, CTH*.8 - h, w, h); x += w + 2; }
  if (k < .5){ cc.fillStyle = 'rgba(255,230,140,.55)'; const r2 = mulberry32(7); for (let i = 0; i < 70; i++){ cc.fillRect(r2()*CTW, CTH*.8 - 12 - r2()*CTH*.28, 2, 2); } }
  const t = performance.now()/1000;
  for (let i = 0; i < 3; i++){ const span = CTW + 200, x = ((i*260 + t*7*(1 + i*.3)) % span) - 100; cloud(cc, x, 26 + i*18, .7 + i*.15, k > .3 ? 'rgba(255,255,255,.9)' : 'rgba(150,170,210,.5)'); }
}
function drawStreet(street, k, t){
  // acera y calzada
  cc.fillStyle = '#d9c9a8'; cc.fillRect(0, street, CTW, 8);
  cc.strokeStyle = '#2a1a0e'; cc.lineWidth = 2; cc.beginPath(); cc.moveTo(0, street); cc.lineTo(CTW, street); cc.stroke();
  cc.fillStyle = '#4a4550'; cc.fillRect(0, street + 8, CTW, CTH - street - 8);
  cc.strokeStyle = '#ffd84a'; cc.lineWidth = 2; cc.setLineDash([14, 12]); cc.beginPath(); cc.moveTo(0, street + 8 + (CTH - street - 8)/2); cc.lineTo(CTW, street + 8 + (CTH - street - 8)/2); cc.stroke(); cc.setLineDash([]);
  // farolas entre solares
  lots.forEach((L, i) => { if (!i) return; const x = L.x - L.w/2; cc.strokeStyle = '#2a1a0e'; cc.lineWidth = 2.4; cc.beginPath(); cc.moveTo(x, street + 2); cc.lineTo(x, street - 46); cc.lineTo(x + 8, street - 46); cc.stroke();
    if (k < .6){ const gl = cc.createRadialGradient(x + 8, street - 42, 0, x + 8, street - 42, 40); gl.addColorStop(0, `rgba(255,220,120,${.5*(1 - k)})`); gl.addColorStop(1, 'rgba(255,220,120,0)'); cc.fillStyle = gl; cc.fillRect(x - 32, street - 82, 80, 90); }
    cc.fillStyle = k < .6 ? '#ffe27a' : '#dfe7ef'; cc.beginPath(); cc.arc(x + 8, street - 43, 3.5, 0, 6.2832); cc.fill(); cc.stroke(); });
}
function lotState(b){ const lv = bizLvl(b.id); return lv > 0 ? 'open' : S.level >= b.lv ? 'sale' : 'locked'; }
function drawLot(L, k, t){
  const b = L.b, st = S.biz[b.id] || {lv: 0}, state = lotState(b), sel = bizSel() === b.id, street = L.y;
  // solar
  cc.fillStyle = state === 'open' ? '#8fcf6a' : '#b89a6a'; cc.fillRect(L.x - L.w/2 + 4, street - 6, L.w - 8, 6);
  if (state !== 'open'){
    // valla y cartel
    cc.strokeStyle = '#7a4d26'; cc.lineWidth = 2;
    for (let x = L.x - L.w/2 + 8; x < L.x + L.w/2 - 6; x += 8){ cc.beginPath(); cc.moveTo(x, street - 2); cc.lineTo(x, street - 16); cc.stroke(); }
    cc.beginPath(); cc.moveTo(L.x - L.w/2 + 6, street - 12); cc.lineTo(L.x + L.w/2 - 6, street - 12); cc.stroke();
    if (state === 'sale'){
      cc.strokeStyle = '#2a1a0e'; cc.beginPath(); cc.moveTo(L.x, street - 14); cc.lineTo(L.x, street - 40); cc.stroke();
      cc.save(); cc.globalAlpha = .3; building(cc, b.id, L.x, street - 2, scaleFor(L, 1), 1, t, false); cc.restore();
      plateTxt(L.x, street - 50, 'Se vende', '#ffc62e', '#2a1a0e', 11);
      plateTxt(L.x, street - 30, money(bizCost(b)), S.money >= bizCost(b) ? '#3fcf6c' : '#fff5de', S.money >= bizCost(b) ? '#fff' : '#2a1a0e', 10);
    } else plateTxt(L.x, street - 34, `Nivel ${b.lv}`, '#e9dcc3', '#2a1a0e', 11, true);
  } else {
    const s = scaleFor(L, st.lv), night = k < .45;
    /* anexos: a partir del nivel 15 la empresa ocupa más solar */
    if (st.lv >= 15) building(cc, b.id, L.x + L.w*.3, street - 2, s*.5, 1, t, night);
    if (st.lv >= 25) building(cc, b.id, L.x - L.w*.3, street - 2, s*.5, 1, t, night);
    building(cc, b.id, L.x, street - 2, s, st.lv, t, night);
    const top = street - 2 - EST[b.id]*s*(1 + Math.min(3, Math.floor(st.lv/8))*.18);
    if (st.lv >= 10) plateTxt(L.x, Math.max(22, top - 12), b.name, night ? '#ff5fa8' : '#fff5de', night ? '#fff' : '#2a1a0e', 10);
    if (st.pub){ const fx = L.x + L.w*.28, fy = Math.max(14, top - 4); cc.strokeStyle = '#2a1a0e'; cc.lineWidth = 1.6; cc.beginPath(); cc.moveTo(fx, fy + 22); cc.lineTo(fx, fy); cc.stroke(); cc.fillStyle = '#3fcf6c'; cc.beginPath(); cc.moveTo(fx, fy); cc.lineTo(fx + 14 + Math.sin(t*4)*2, fy + 4); cc.lineTo(fx, fy + 9); cc.closePath(); cc.fill(); cc.stroke(); }
    if (st.mgr) miner(cc, L.x - L.w*.3, street - 1, .95, {pose: 'idle', t, seed: 3, suit: '#2a3550', hat: '#2a3550'});
    if (st.lv >= 30){ cc.fillStyle = '#ffc62e'; cc.strokeStyle = '#2a1a0e'; cc.lineWidth = 1.4; star(L.x + L.w*.3, street - 16, 6); }
    const bo = st.boost && st.boost.left > 0 ? st.boost : null;
    if (bo) plateTxt(L.x, Math.max(36, top - 30) + Math.sin(t*3)*2, bo.mult > 1 ? `▲ ×${nf1.format(bo.mult)}` : `▼ ×${nf1.format(bo.mult)}`, bo.mult > 1 ? '#3fcf6c' : '#ff5b4f', '#fff', 10);
    if (b.id === 'joyeria' && st.paused) plateTxt(L.x, street - 20, 'Cerrado', '#ff5b4f', '#fff', 10);
  }
  // selección
  if (sel || hover === b.id){
    cc.save(); cc.strokeStyle = sel ? '#ffc62e' : 'rgba(255,255,255,.7)'; cc.lineWidth = sel ? 3 : 2; cc.setLineDash(sel ? [] : [5, 4]);
    cc.beginPath(); cc.roundRect(L.x - L.w/2 + 3, 8, L.w - 6, street + 4 - 8, 12); cc.stroke(); cc.restore();
    if (sel){ cc.fillStyle = '#ffc62e'; cc.beginPath(); cc.moveTo(L.x - 8, street + 12); cc.lineTo(L.x + 8, street + 12); cc.lineTo(L.x, street + 4); cc.closePath(); cc.fill(); }
  }
}
function scaleFor(L, lv){ const fl = 1 + Math.min(3, Math.floor(lv/8)), est = EST[L.b.id]*(1 + (fl - 1)*.18); return Math.min(L.w/50, (L.y - 34)/est)*(.78 + Math.min(lv, 30)/30*.22); }
function star(x, y, r){ cc.beginPath(); for (let i = 0; i < 10; i++){ const a = -Math.PI/2 + i*Math.PI/5, rr = i % 2 ? r*.45 : r; cc.lineTo(x + Math.cos(a)*rr, y + Math.sin(a)*rr); } cc.closePath(); cc.fill(); cc.stroke(); }
function plateTxt(x, y, text, bg, fg, size, lock){
  cc.font = `400 ${size}px "Lilita One", sans-serif`; const w = cc.measureText(text).width + 12 + (lock ? 10 : 0), h = size + 7;
  cc.fillStyle = bg; cc.strokeStyle = '#2a1a0e'; cc.lineWidth = 1.8; cc.beginPath(); cc.roundRect(x - w/2, y - h/2, w, h, 5); cc.fill(); cc.stroke();
  cc.fillStyle = fg; cc.textAlign = 'center'; cc.textBaseline = 'middle'; cc.fillText(text, x + (lock ? 5 : 0), y + 1);
  if (lock){ cc.fillStyle = fg; cc.fillRect(x - w/2 + 6, y - 1, 7, 5); cc.strokeStyle = fg; cc.lineWidth = 1.4; cc.beginPath(); cc.arc(x - w/2 + 9.5, y - 1, 2.4, Math.PI, 0); cc.stroke(); }
}
/* tráfico y gente: más cuanto más grande es tu imperio */
function traffic(dt, street, t){
  const lvTot = BIZ.reduce((a, b) => a + bizLvl(b.id), 0), want = Math.min(6, Math.ceil(lvTot/8)), people = Math.min(10, Math.ceil(lvTot/4));
  if (cars.length < want && Math.random() < dt*.8){ const dir = Math.random() < .5 ? 1 : -1; cars.push({x: dir > 0 ? -40 : CTW + 40, dir, v: 40 + Math.random()*40, col: ['#ff5b4f', '#3ea8ff', '#3fcf6c', '#ffc62e', '#a06bff'][(Math.random()*5)|0], truck: Math.random() < .3}); }
  if (walkers.length < people && Math.random() < dt){ const dir = Math.random() < .5 ? 1 : -1; walkers.push({x: dir > 0 ? -10 : CTW + 10, dir, v: 14 + Math.random()*10, seed: (Math.random()*50)|0}); }
  const lane = street + 8 + (CTH - street - 8)*.5;
  cars = cars.filter(c => { c.x += c.dir*c.v*dt; const y = c.dir > 0 ? lane + 12 : lane - 2;
    if (c.truck) truck(cc, c.x, y, .7, '#ffc62e', c.dir, .6, t); else car(c.x, y, c.dir, c.col); return c.x > -60 && c.x < CTW + 60; });
  walkers = walkers.filter(p => { p.x += p.dir*p.v*dt; miner(cc, p.x, street + 6, .7, {pose: 'walk', t, seed: p.seed, dir: p.dir, hat: 'transparent'}); return p.x > -20 && p.x < CTW + 20; });
}
function car(x, y, dir, col){
  cc.save(); cc.translate(x, y); cc.scale(dir, 1); cc.strokeStyle = '#2a1a0e'; cc.lineWidth = 1.6;
  cc.fillStyle = col; cc.beginPath(); cc.roundRect(-14, -10, 28, 8, 3); cc.fill(); cc.stroke();
  cc.beginPath(); cc.roundRect(-7, -16, 14, 7, 3); cc.fill(); cc.stroke();
  cc.fillStyle = '#8fd3ff'; cc.fillRect(-4, -14, 8, 4);
  cc.fillStyle = '#3a3a40'; [-8, 8].forEach(wx => { cc.beginPath(); cc.arc(wx, -2, 3.2, 0, 6.2832); cc.fill(); cc.stroke(); });
  cc.restore();
}
/* monedas que salen de las empresas: más cuanto más ganan */
function moneyFx(dt, t){
  sparkT += dt;
  if (sparkT > .35){ sparkT = 0;
    const open = lots.filter(L => bizLvl(L.b.id) > 0); if (open.length){ const L = open[(Math.random()*open.length)|0], s = scaleFor(L, bizLvl(L.b.id)); coins.push({x: L.x + (Math.random() - .5)*20, y: L.y - EST[L.b.id]*s*.6, vy: -26 - Math.random()*14, life: 1.4}); } }
  coins = coins.filter(c => { c.y += c.vy*dt; c.life -= dt; cc.globalAlpha = Math.max(0, Math.min(1, c.life)); cc.fillStyle = '#ffc62e'; cc.strokeStyle = '#2a1a0e'; cc.lineWidth = 1.2; cc.beginPath(); cc.ellipse(c.x, c.y, 4*Math.abs(Math.sin(t*6 + c.x)), 4, 0, 0, 6.2832); cc.fill(); cc.stroke(); cc.globalAlpha = 1; return c.life > 0; });
}
function frame(now){
  raf = 0;
  if (S.section !== 'empresas' || !unl('biz') || document.hidden) return;
  const dt = Math.min(.05, (now - ctLast)/1000); ctLast = now;
  if (!size()){ raf = requestAnimationFrame(frame); return; }
  const t = now/1000, k = cityDayK(), street = layout();
  cc.clearRect(0, 0, CTW, CTH);
  citySky(k);
  lots.forEach(L => drawLot(L, k, t));
  drawStreet(street, k, t);
  if (!RM){ moneyFx(dt, t); traffic(dt, street, t); }
  if (k < 1){ cc.fillStyle = `rgba(12,20,60,${(1 - k)*.22})`; cc.fillRect(0, 0, CTW, CTH); }
  raf = requestAnimationFrame(frame);
}
function startCity(){ if (!raf){ ctLast = performance.now(); raf = requestAnimationFrame(frame); } }
function lotAt(e){ const r = cityCv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; return lots.find(L => Math.abs(x - L.x) < L.w/2 && y < L.y + 12); }
cityCv.addEventListener('pointerdown', e => { const L = lotAt(e); if (L) selectBiz(L.b.id); });
cityCv.addEventListener('pointermove', e => { const L = lotAt(e); hover = L ? L.b.id : null; cityCv.style.cursor = L ? 'pointer' : 'default'; });
cityCv.addEventListener('pointerleave', () => { hover = null; });
on('section', k => { if (k === 'empresas') requestAnimationFrame(() => { startCity(); requestAnimationFrame(() => scrollToLot(bizSel())); }); });
on('ui', () => { if (S.section === 'empresas') startCity(); });
