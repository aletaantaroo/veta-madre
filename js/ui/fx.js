import { on, sfx } from '../core/bus.js';
import { $, dpr, setT } from '../core/dom.js';
import { clamp, money } from '../core/format.js';
import { RM } from '../core/settings.js';
import { UNLOCKS } from '../data/content.js';
import { S } from '../game/state.js';

/* Efectos de juego sobre todo lo demás: monedas que vuelan al marcador, confeti, destellos y la subida de nivel. */
const fxCv = $('#fx'), fxg = fxCv.getContext('2d');
let FW = 0, FH = 0, FS = 1, flyers = [], confetti = [], sparks = [], lastPtr = [innerWidth/2, innerHeight/2], dispMoney = null, lastOre = 0, lvHide = 0, fxDirty = false, arrivedAt = {};
const CONF = ['#ffc62e', '#3fcf6c', '#3ea8ff', '#ff5b4f', '#a06bff', '#ff9636', '#2cd3c6', '#fff5de'];
const ORE = {au:'#ffc62e', ag:'#d7e2ef', cu:'#ff8a4c'};

export function fxResize(){ FW = innerWidth; FH = innerHeight; FS = Math.min(dpr, 1.6); fxCv.width = Math.round(FW*FS); fxCv.height = Math.round(FH*FS); }
addEventListener('resize', fxResize);
document.addEventListener('pointerdown', e => { lastPtr = [e.clientX, e.clientY]; }, true);

function anchorOf(sel){
  const el = $(sel); if (!el) return null; const r = el.getBoundingClientRect(); if (!r.width) return null;
  const ico = el.querySelector('.pill-ico'); if (ico){ const q = ico.getBoundingClientRect(); return [q.left + q.width/2, q.top + q.height/2]; }
  return [r.left + r.width/2, r.top + r.height/2];
}
function flyTo(x, y, sel, n, kind, col){
  const tgt = anchorOf(sel); if (!tgt) return;
  for (let i = 0; i < n && flyers.length < 90; i++) flyers.push({x0: x, y0: y, x1: tgt[0], y1: tgt[1], t: -i*.045, d: .5 + Math.random()*.25, ox: (Math.random() - .5)*140, oy: -40 - Math.random()*120, kind, col, sel, spin: Math.random()*6});
  fxDirty = true;
}
function flyFrom(sel, x, y, n){
  const src = anchorOf(sel); if (!src) return;
  for (let i = 0; i < n; i++) flyers.push({x0: src[0], y0: src[1], x1: x, y1: y, t: -i*.05, d: .45, ox: (Math.random() - .5)*60, oy: 30, kind: 'coin', sel: null, spin: 0, spend: true});
  fxDirty = true;
}
function confettiBurst(x, y, n, spread = 1){
  if (RM) n = Math.min(n, 12);
  for (let i = 0; i < n && confetti.length < 260; i++){ const a = -Math.PI/2 + (Math.random() - .5)*2.4*spread, v = 260 + Math.random()*420; confetti.push({x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v, r: Math.random()*6, vr: (Math.random() - .5)*14, w: 6 + Math.random()*6, h: 4 + Math.random()*5, col: CONF[i % CONF.length], life: 2.2 + Math.random()*1.2}); }
  fxDirty = true;
}
function sparkBurst(x, y, col, n = 10){
  for (let i = 0; i < n; i++){ const a = i/n*6.2832, v = 90 + Math.random()*120; sparks.push({x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v, life: .6, col}); }
  fxDirty = true;
}
function drawCoinFx(x, y, r, spin){
  fxg.save(); fxg.translate(x, y); fxg.scale(Math.max(.28, Math.abs(Math.cos(spin))), 1);
  fxg.beginPath(); fxg.arc(0, 0, r, 0, 6.2832); fxg.fillStyle = '#ffc62e'; fxg.fill(); fxg.lineWidth = 2; fxg.strokeStyle = '#2a1a0e'; fxg.stroke();
  fxg.beginPath(); fxg.arc(0, 0, r*.62, 0, 6.2832); fxg.strokeStyle = '#e0950b'; fxg.lineWidth = 1.6; fxg.stroke();
  fxg.fillStyle = 'rgba(255,255,255,.75)'; fxg.beginPath(); fxg.arc(-r*.35, -r*.35, r*.22, 0, 6.2832); fxg.fill();
  fxg.restore();
}
export function fxFrame(dt){
  if (!FW) fxResize();
  if (!fxDirty) return;
  fxg.setTransform(FS, 0, 0, FS, 0, 0); fxg.clearRect(0, 0, FW, FH);
  flyers = flyers.filter(f => {
    f.t += dt; if (f.t < 0) return true;
    const p = Math.min(1, f.t/f.d), e = p*p*(3 - 2*p);
    const cx = (f.x0 + f.x1)/2 + f.ox, cy = Math.min(f.y0, f.y1) + f.oy;
    const x = (1 - e)*(1 - e)*f.x0 + 2*(1 - e)*e*cx + e*e*f.x1, y = (1 - e)*(1 - e)*f.y0 + 2*(1 - e)*e*cy + e*e*f.y1;
    f.spin += dt*12;
    const r = (f.kind === 'coin' ? 9 : 6)*(1 - .35*e);
    if (f.kind === 'coin') drawCoinFx(x, y, r, f.spin);
    else { fxg.save(); fxg.translate(x, y); fxg.rotate(f.spin*.4); fxg.beginPath(); fxg.moveTo(-r, -r*.3); fxg.lineTo(-r*.3, -r); fxg.lineTo(r, -r*.4); fxg.lineTo(r*.7, r*.8); fxg.lineTo(-r*.6, r*.7); fxg.closePath(); fxg.fillStyle = f.col; fxg.fill(); fxg.lineWidth = 1.6; fxg.strokeStyle = '#2a1a0e'; fxg.stroke(); fxg.restore(); }
    if (p >= 1){
      if (f.sel){ const now = performance.now(); if (now - (arrivedAt[f.sel] || 0) > 120){ arrivedAt[f.sel] = now; bumpEl(f.sel); if (f.kind === 'coin') sfx('coin'); } }
      return false;
    }
    return true;
  });
  confetti = confetti.filter(c => {
    c.life -= dt; if (c.life <= 0 || c.y > FH + 20) return false;
    c.vy += 520*dt; c.vx *= (1 - 1.6*dt); c.vy *= (1 - .9*dt); c.x += c.vx*dt + Math.sin(c.life*9 + c.r)*30*dt; c.y += c.vy*dt; c.r += c.vr*dt;
    fxg.save(); fxg.translate(c.x, c.y); fxg.rotate(c.r); fxg.scale(1, Math.cos(c.life*7)); fxg.globalAlpha = Math.min(1, c.life*1.5);
    fxg.fillStyle = c.col; fxg.fillRect(-c.w/2, -c.h/2, c.w, c.h); fxg.restore();
    return true;
  });
  sparks = sparks.filter(s => {
    s.life -= dt; if (s.life <= 0) return false;
    s.x += s.vx*dt; s.y += s.vy*dt; s.vx *= .92; s.vy *= .92;
    const r = 3 + 6*s.life; fxg.globalAlpha = Math.min(1, s.life*2); fxg.fillStyle = s.col;
    fxg.beginPath(); fxg.moveTo(s.x, s.y - r); fxg.lineTo(s.x + r*.28, s.y - r*.28); fxg.lineTo(s.x + r, s.y); fxg.lineTo(s.x + r*.28, s.y + r*.28); fxg.lineTo(s.x, s.y + r); fxg.lineTo(s.x - r*.28, s.y + r*.28); fxg.lineTo(s.x - r, s.y); fxg.lineTo(s.x - r*.28, s.y - r*.28); fxg.closePath(); fxg.fill();
    return true;
  });
  fxg.globalAlpha = 1;
  rainFrame(dt);
  if (!flyers.length && !confetti.length && !sparks.length && !rain.length){ fxg.clearRect(0, 0, FW, FH); fxDirty = false; }
}

/* ---------- marcador de dinero que rueda ---------- */
export function hudMoney(dt){
  if (!S) return;
  if (dispMoney == null || !isFinite(dispMoney)) dispMoney = S.money;
  const diff = S.money - dispMoney;
  if (Math.abs(diff) <= Math.max(.005, Math.abs(S.money)*2e-4)) dispMoney = S.money; else dispMoney += diff*Math.min(1, dt*7);
  setT($('#kMoney'), money(dispMoney));
}
function resetMoneyDisplay(){ dispMoney = null; }
function bumpEl(sel){ const el = $(sel); if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

/* ---------- subida de nivel ---------- */
function showLevel(lv, pts){
  const el = $('#lvup'), card = el.querySelector('.lvup-card');
  setT($('#lvupN'), String(lv));
  const u = UNLOCKS.find(x => x.lv === lv);
  setT($('#lvupTxt'), u ? `Desbloqueas: ${u.txt}` : `+${pts} punto${pts > 1 ? 's' : ''} de habilidad`);
  el.classList.remove('out'); el.hidden = false;
  card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  sfx('lv'); confettiBurst(FW/2, FH*.45, 120, 1.3);
  const b = $('#lvlBadge'); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
  clearTimeout(lvHide); lvHide = setTimeout(hideLevel, 2600);
}
function hideLevel(){ const el = $('#lvup'); if (el.hidden) return; el.classList.add('out'); setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 340); }
$('#lvup').addEventListener('click', hideLevel);

on('levelup', showLevel);
on('ach', () => confettiBurst(FW/2, (anchorOf('#toasts') || [0, 90])[1] + 20, 50, .8));
on('objective', () => { const a = anchorOf('#objBar'); if (a) flyTo(a[0], a[1], '#pillMoney', 8, 'coin'); bumpEl('#objBar'); const o = $('#objBar'); if (o){ o.classList.remove('done'); void o.offsetWidth; o.classList.add('done'); } });
on('sold', (m, rev, auto) => { if (auto) return; const n = clamp(Math.round(Math.log10(rev + 1)*2.2), 3, 14); flyTo(lastPtr[0], lastPtr[1], '#pillMoney', n, 'coin'); });
on('fxOre', (x, y, m) => { const now = performance.now(); if (now - lastOre < 90) return; lastOre = now; flyTo(x, y, '#pillMetal', 1, 'ore', ORE[m]); });
on('fxBurst', (x, y, col) => { sparkBurst(x, y, col, 12); confettiBurst(x, y, 24, .6); });
on('bump', bumpEl);
on('bought', id => { const row = $('#crew_' + id); if (row){ row.classList.remove('fresh'); void row.offsetWidth; row.classList.add('fresh'); const r = row.getBoundingClientRect(); flyFrom('#pillMoney', r.right - 40, r.top + r.height/2, 4); } });
on('sceneReset', () => { resetMoneyDisplay(); flyers = []; confetti = []; sparks = []; fxDirty = true; });
/* ---------- lluvia de monedas (palabra secreta) ---------- */
let rain = [];
function coinRain(){ for (let i = 0; i < (RM ? 20 : 70); i++) rain.push({x: Math.random()*FW, y: -20 - Math.random()*FH*.6, vy: 260 + Math.random()*260, spin: Math.random()*6}); fxDirty = true; sfx('coin'); }
function rainFrame(dt){
  if (!rain.length) return;
  rain = rain.filter(c => { c.y += c.vy*dt; c.spin += dt*10; drawCoinFx(c.x, c.y, 10, c.spin); return c.y < FH + 20; });
  if (rain.length) fxDirty = true;
}
on('coinRain', coinRain);
on('secret', () => confettiBurst(FW/2, FH*.4, 70, 1.2));
