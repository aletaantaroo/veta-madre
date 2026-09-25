import { K, emit, on, sfx, updateUI } from '../core/bus.js';
import { $ } from '../core/dom.js';
import { fmtT, money, mulberry32, nf1 } from '../core/format.js';
import { RM } from '../core/settings.js';
import { BIZ, DAY_LEN, ROMAN, VECINOS } from '../data/content.js';
import { S, bizCost, bizIncAll, bizLvl, bizStage, vecOn } from '../game/state.js';
import { BLD_ART, BLD_G, LAMP_G, MAP_G, MAP_GROUND, MAP_LAMPS } from '../render/cityArt.js';

/* ================= la ciudad de tus empresas (v14) =================
   Plano visto desde arriba (en perspectiva 3/4) de 1440 × 900 «unidades de diseño». Cada empresa tiene un solar;
   su edificio es un SVG que cambia con la etapa. Encima van los carteles, el marcador del edificio elegido,
   los eventos, los vecinos, el tráfico y las monedas. El plano se escala para que quepa y se puede arrastrar. */
const cview = $('#cityView'), stage = $('#cityStage');
const MAP = {x0: -600, y0: -460, x1: 2040, y1: 1400};   // hasta dónde hay suelo dibujado
const FOCUS = {x0: 0, y0: 150, x1: 1010, y1: 830};      // la zona con todos los solares
const cam = {x: 0, y: 0, s: 1};
let built = false, lots = {}, marker, night, coinT = 0, lastSel = '';

export const fmtMult = m => Number.isInteger(m) ? String(m) : nf1.format(m);
export const bizSel = () => { if (!S.bizSel || !BIZ.some(b => b.id === S.bizSel)){ const open = BIZ.find(b => bizLvl(b.id) > 0); S.bizSel = (open || BIZ[0]).id; } return S.bizSel; };
function selectBiz(id){ if (S.bizSel !== id){ S.bizSel = id; sfx('ui'); } K.biz = ''; updateUI(); if (isMobile()) focusLot(id, true); }
const isMobile = () => innerWidth <= 860;

/* ---------- dibujo ---------- */
const svg = (vb, inner, cls = '', g = BLD_G) => `<svg class="${cls}" viewBox="${vb}" aria-hidden="true">${g}${inner}</g></svg>`;
export const LOCK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="7" width="10" height="7" rx="2" fill="currentColor"/></svg>';
export const LINK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5l3-3M5 7L3.6 8.4a2.5 2.5 0 0 0 3.5 3.5L8.5 10.5M11 9l1.4-1.4a2.5 2.5 0 0 0-3.5-3.5L7.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
/* Solar vacío con cartel: «SE VENDE» si ya puedes comprarlo, o el nivel que te falta. */
function lotArt(b, sale){
  const conc = b.ground === '#d6d1c6', g = conc ? '#e6e2da' : '#c4e6ad';
  return `<rect fill="${g}" stroke-dasharray="9 6" x="10" y="70" width="180" height="120" rx="16"/>`
    + `<rect fill="rgba(255,255,255,.35)" stroke="rgba(42,26,14,.45)" stroke-width="2" stroke-dasharray="6 5" x="58" y="96" width="80" height="56" rx="3"/><path fill="none" stroke="rgba(42,26,14,.45)" stroke-width="2" stroke-dasharray="6 5" d="M58 122h80"/>`
    + `<rect stroke-width="1.6" fill="#8d5b2c" x="118" y="128" width="5" height="40"/><rect fill="#fff5de" x="88" y="104" width="66" height="28" rx="4"/>`
    + `<circle stroke-width="1.6" fill="#ffc62e" cx="93" cy="109" r="2"/><circle stroke-width="1.6" fill="#ffc62e" cx="149" cy="109" r="2"/>`
    + `<text x="121" y="123" text-anchor="middle" stroke="none" fill="${sale ? '#c42f24' : '#6b4c30'}" font-family="Lilita One, sans-serif" font-size="12" letter-spacing=".5">${sale ? 'SE VENDE' : 'NIVEL ' + b.lv}</text>`;
}
/* Edificio genérico para empresas futuras que aún no tengan dibujo propio. */
function genericArt(b, s){
  const h = 30 + s*22, w = 70 + s*8, x = 100 - w/2, y = 150 - h;
  return `<rect fill="${b.ground}" x="10" y="70" width="180" height="120" rx="16"/><rect fill="rgba(42,26,14,.2)" stroke="none" x="${x + 6}" y="${y + 6}" width="${w}" height="${h}" rx="4"/>`
    + `<rect fill="${b.badge}" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/><rect fill="rgba(255,255,255,.3)" stroke="none" x="${x + 6}" y="${y + 6}" width="${w - 12}" height="8" rx="3"/>`;
}
export const artOf = (b, s, sale) => s < 1 ? lotArt(b, sale) : BLD_ART[b.id] ? BLD_ART[b.id][Math.min(5, s) - 1] : genericArt(b, s);

/* Manzanas del plano: las del diseño en el centro y más alrededor para que la ciudad siga al moverte. */
const COLS = [[-1000, -362], [-300, 324], [386, 664], [726, 1100], [1162, 1500], [1562, 2400]];
const ROWS = [[-900, -362], [-300, 424], [496, 1000], [1062, 1800]];
function blocksSvg(){
  const r = mulberry32(42); let o = '';
  const tree = (x, y, rr) => `<circle stroke="none" fill="rgba(42,26,14,.2)" cx="${x + 4}" cy="${y + 5}" r="${rr}"/><circle fill="${r() < .5 ? '#6cc24a' : '#4fae3a'}" cx="${x}" cy="${y}" r="${rr}"/><circle stroke="none" fill="rgba(255,255,255,.3)" cx="${x - rr*.3}" cy="${y - rr*.3}" r="${rr*.45}"/>`;
  ROWS.forEach(([y0, y1], ri) => COLS.forEach(([x0, x1], ci) => {
    const core = (ri === 1 || ri === 2) && ci >= 1 && ci <= 4;
    const conc = core ? ri === 2 && (ci === 1 || ci === 2) : r() < .45;
    o += `<rect fill="#e8dcc2" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="22"/><rect fill="${conc ? '#d6d1c6' : '#9fdc7c'}" stroke-width="2" x="${x0 + 12}" y="${y0 + 12}" width="${x1 - x0 - 24}" height="${y1 - y0 - 24}" rx="14"/>`;
    if (core) return;
    // relleno: casas en las manzanas de hormigón y árboles en los parques
    const cx0 = Math.max(x0, MAP.x0) + 30, cx1 = Math.min(x1, MAP.x1) - 30, cy0 = Math.max(y0, MAP.y0) + 30, cy1 = Math.min(y1, MAP.y1) - 30;
    if (cx1 <= cx0 || cy1 <= cy0) return;
    if (conc){
      for (let yy = cy0; yy < cy1 - 60; yy += 110) for (let xx = cx0; xx < cx1 - 70; xx += 120){
        if (r() < .25) continue;
        const w = 60 + r()*40, h = 50 + r()*36, col = ['#f0b989', '#9fc4e8', '#f4e0b0', '#c9b3e6', '#f2a7a0'][(r()*5)|0];
        o += `<rect stroke="none" fill="rgba(42,26,14,.18)" x="${xx + 7}" y="${yy + 8}" width="${w}" height="${h}" rx="5"/><rect fill="${col}" x="${xx}" y="${yy}" width="${w}" height="${h}" rx="5"/><rect stroke="none" fill="rgba(255,255,255,.35)" x="${xx + 6}" y="${yy + 6}" width="${w - 12}" height="7" rx="3"/><path fill="none" stroke="rgba(42,26,14,.3)" stroke-width="1.5" d="M${xx + 8} ${yy + h*.55}h${w - 16}"/>`;
      }
    } else {
      const n = Math.round((cx1 - cx0)*(cy1 - cy0)/16000);
      for (let i = 0; i < n; i++) o += tree(cx0 + r()*(cx1 - cx0), cy0 + r()*(cy1 - cy0), 10 + r()*10);
    }
  }));
  // marcas viales: líneas discontinuas por el centro de cada calle y pasos de cebra en los cruces
  let d = '';
  const vRoads = COLS.slice(1).map((c, i) => (COLS[i][1] + c[0])/2), hRoads = ROWS.slice(1).map((rw, i) => (ROWS[i][1] + rw[0])/2);
  hRoads.forEach(y => { let x = MAP.x0; COLS.forEach(([x0, x1]) => { if (x1 > MAP.x0 && x0 < MAP.x1){ d += `M${Math.max(MAP.x0, x0)} ${y}H${Math.min(MAP.x1, x1)}`; } }); });
  vRoads.forEach(x => ROWS.forEach(([y0, y1]) => { if (y1 > MAP.y0 && y0 < MAP.y1) d += `M${x} ${Math.max(MAP.y0, y0)}V${Math.min(MAP.y1, y1)}`; }));
  o += `<path fill="none" stroke="#fff5de" stroke-width="3" stroke-dasharray="18 14" stroke-linecap="butt" d="${d}"/>`;
  return o;
}
function lampGlow(){
  let o = '<defs><radialGradient id="lampG"><stop offset="0" stop-color="#ffe27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffe27a" stop-opacity="0"/></radialGradient></defs>';
  (MAP_LAMPS.match(/cx="(\d+)" cy="(\d+)"/g) || []).forEach(m => { const [, x, y] = m.match(/cx="(\d+)" cy="(\d+)"/); o += `<circle cx="${x}" cy="${y}" r="46" fill="url(#lampG)" stroke="none"/>`; });
  return o;
}
const TRUCK = '<svg viewBox="0 0 58 26" aria-hidden="true"><g stroke="#2a1a0e" stroke-width="2" stroke-linejoin="round"><rect stroke="none" fill="rgba(42,26,14,.22)" x="4" y="6" width="54" height="20" rx="4"/><rect fill="#ff9636" x="1" y="2" width="38" height="20" rx="3"/><path fill="#8d5b2c" d="M5 6q15-4 30 0v12q-15 4-30 0z"/><circle stroke="none" fill="#ffc62e" cx="14" cy="10" r="2"/><circle stroke="none" fill="#ffc62e" cx="26" cy="14" r="1.8"/><circle stroke="none" fill="#d7e2ef" cx="20" cy="9" r="1.6"/><rect fill="#ffd36b" x="40" y="3" width="16" height="18" rx="4"/><rect stroke-width="1.4" fill="#bfe6ff" x="49" y="6" width="5" height="12" rx="1.5"/></g></svg>';
const VAN = '<svg viewBox="0 0 42 24" aria-hidden="true"><g stroke="#2a1a0e" stroke-width="2" stroke-linejoin="round"><rect stroke="none" fill="rgba(42,26,14,.22)" x="4" y="5" width="38" height="19" rx="5"/><rect fill="#7d8a96" x="1" y="2" width="38" height="20" rx="5"/><rect stroke="none" fill="#9aa7b4" x="13" y="5" width="22" height="14" rx="3"/><rect stroke="none" fill="#ffc62e" x="22" y="5" width="4" height="14"/><rect stroke-width="1.4" fill="#bfe6ff" x="4" y="5" width="6" height="14" rx="2"/></g></svg>';
const CAR = c => `<svg viewBox="0 0 40 22" aria-hidden="true"><g stroke="#2a1a0e" stroke-width="2" stroke-linejoin="round"><rect stroke="none" fill="rgba(42,26,14,.22)" x="4" y="5" width="36" height="17" rx="6"/><rect fill="${c}" x="1" y="2" width="36" height="17" rx="6"/><rect stroke-width="1.4" fill="#bfe6ff" x="22" y="5" width="8" height="11" rx="2"/><rect stroke-width="1.4" fill="#bfe6ff" x="6" y="5" width="6" height="11" rx="2"/></g></svg>`;
const MARK = '<svg viewBox="0 0 36 40" aria-hidden="true"><path d="M9 3h18v15h7L18 37 2 18h7z" fill="#ffc62e" stroke="#2a1a0e" stroke-width="3" stroke-linejoin="round"/><path d="M13 7h4v12" fill="none" stroke="#fff1b8" stroke-width="3" stroke-linecap="round"/></svg>';

function buildCity(){
  if (built) return; built = true;
  const W = MAP.x1 - MAP.x0, H = MAP.y1 - MAP.y0;
  let h = `<svg class="city-ground" viewBox="${MAP.x0} ${MAP.y0} ${W} ${H}" style="left:${MAP.x0}px;top:${MAP.y0}px;width:${W}px;height:${H}px" aria-hidden="true">${MAP_G}${blocksSvg()}${MAP_GROUND}</g></svg>`;
  h += `<div class="city-cars" aria-hidden="true">`
    + `<span class="car e" style="--y:465px;--d:17s;--k:0s">${TRUCK}</span><span class="car w" style="--y:430px;--d:22s;--k:-9s">${VAN}</span>`
    + `<span class="car e" style="--y:468px;--d:14s;--k:-6s">${CAR('#3ea8ff')}</span><span class="car w" style="--y:432px;--d:19s;--k:-15s">${CAR('#ff5b4f')}</span>`
    + `<span class="car s" style="--x:340px;--d:15s;--k:-4s">${CAR('#3fcf6c')}</span><span class="car n" style="--x:1116px;--d:18s;--k:-11s">${CAR('#a06bff')}</span></div>`;
  BIZ.forEach(b => {
    const [x, y] = b.cell;
    h += `<div class="lot" data-lot="${b.id}" style="left:${x}px;top:${y}px" role="button" tabindex="-1" aria-label="${b.name}"><svg class="bld" viewBox="0 0 200 200" aria-hidden="true">${BLD_G}</g></svg></div>`;
  });
  h += svg(`0 0 1440 900`, MAP_LAMPS, 'city-lamps', LAMP_G);
  h += `<div class="city-night" id="cityNight" style="left:${MAP.x0}px;top:${MAP.y0}px;width:${W}px;height:${H}px"></div>`;
  h += `<svg class="city-glow" viewBox="0 0 1440 900" aria-hidden="true">${lampGlow()}</svg>`;
  h += `<span class="city-dist" style="left:22px;top:170px">Centro</span><span class="city-dist" style="left:18px;top:522px">Polígono industrial</span><span class="city-dist" style="left:752px;top:522px">Parque tecnológico</span>`;
  h += `<button type="button" class="city-mine" data-go="mina" style="left:12px;top:432px"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L4 8l6 5M4 8h9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>A la mina</button>`;
  VECINOS.forEach((V, i) => {
    const A = BIZ.find(b => b.id === V.a), B = BIZ.find(b => b.id === V.b); if (!A || !B) return;
    const [L, R] = A.cell[0] < B.cell[0] ? [A, B] : [B, A]; if (L.cell[1] !== R.cell[1]) return;
    const x0 = L.cell[0] + 192, x1 = R.cell[0] + 8, y = L.cell[1] + 128, pct = Math.round(Math.max(...Object.values(V.fx))*100);
    h += `<div class="vlink" data-v="${i}" style="left:${x0}px;top:${y}px;width:${x1 - x0}px" title="${V.name}: ${V.txt}"><span class="vchip"><i></i>+${pct} %</span></div>`;
  });
  BIZ.forEach(b => { const [x, y] = b.cell; h += `<div class="evb" data-ev="${b.id}" style="left:${x + 150}px;top:${y + 40}px" hidden></div>`; });
  BIZ.forEach(b => { const [x, y] = b.cell; h += `<div class="plate-wrap" style="left:${x}px;top:${y + 172}px"><button type="button" class="plate" data-biz="${b.id}"><span class="pl-b"></span><span class="pl-t"><b>${b.name}</b><small></small></span><span class="pl-up" hidden>▲</span></button></div>`; });
  h += `<div class="city-mark" aria-hidden="true">${MARK}</div><div class="city-fx" aria-hidden="true"></div>`;
  stage.innerHTML = h;
  marker = stage.querySelector('.city-mark'); night = $('#cityNight');
  BIZ.forEach(b => { const el = stage.querySelector(`[data-lot="${b.id}"]`); lots[b.id] = {b, el, g: el.querySelector('g'), plate: stage.querySelector(`.plate[data-biz="${b.id}"]`), ev: stage.querySelector(`[data-ev="${b.id}"]`), key: '', top: 70}; });
  stage.querySelectorAll('.vchip i').forEach(i => i.innerHTML = LINK);
}

/* ---------- cámara: escala para que quepa y se arrastra con el dedo o el ratón ---------- */
function free(){
  const vw = innerWidth, vh = innerHeight, cs = getComputedStyle(document.documentElement);
  const hud = parseFloat(cs.getPropertyValue('--hud-h')) || 64, dock = parseFloat(cs.getPropertyValue('--dock-h')) || 92;
  const p = $('#cityPanel').getBoundingClientRect(), mob = isMobile();
  return {x0: 0, y0: hud + 8, x1: mob || !p.width ? vw : p.left - 8, y1: mob && p.height ? p.top - 6 : vh - dock - 10, vw, vh, mob};
}
/* La cámara no deja ver más allá del suelo dibujado dentro de la zona libre (lo que tapan la ficha y el dock da igual). */
function clampCity(F){
  const s = cam.s;
  cam.x = Math.min(Math.max(cam.x, MAP.x0 + 20 - F.x0/s), MAP.x1 - 20 - F.x1/s);
  cam.y = Math.min(Math.max(cam.y, MAP.y0 + 20 - F.y0/s), MAP.y1 - 20 - F.y1/s);
}
function applyCam(){
  stage.style.transform = `translate(${(-cam.x*cam.s).toFixed(1)}px,${(-cam.y*cam.s).toFixed(1)}px) scale(${cam.s.toFixed(4)})`;
  stage.style.setProperty('--ps', (isMobile() ? Math.min(1.4, .82/cam.s) : Math.min(1.25, Math.max(1, .85/cam.s))).toFixed(3));
}
function fitCam(){
  const F = free();
  if (F.mob) cam.s = Math.min(.85, Math.max(.6, F.vw/560));
  else cam.s = Math.min(1.45, Math.max(.5, Math.min((F.x1 - F.x0)/1040, (F.y1 - F.y0)/700)));
  return F;
}
function centerOn(dx, dy, F){ cam.x = dx - (F.x0 + F.x1)/2/cam.s; cam.y = dy - (F.y0 + F.y1)/2/cam.s; clampCity(F); applyCam(); }
function resetCam(){ const F = fitCam(); if (F.mob){ const b = BIZ.find(x => x.id === bizSel()); centerOn(b.cell[0] + 100, b.cell[1] + 115, F); } else centerOn((FOCUS.x0 + FOCUS.x1)/2, (FOCUS.y0 + FOCUS.y1)/2, F); }
function focusLot(id, smooth){
  const b = BIZ.find(x => x.id === id); if (!b) return;
  const F = free(), tx = b.cell[0] + 100, ty = b.cell[1] + 115, sx = (tx - cam.x)*cam.s, sy = (ty - cam.y)*cam.s;
  if (sx > F.x0 + 60 && sx < F.x1 - 60 && sy > F.y0 + 60 && sy < F.y1 - 40) return;
  const x0 = cam.x, y0 = cam.y; centerOn(tx, ty, F);
  if (smooth && !RM){ const x1 = cam.x, y1 = cam.y, t0 = performance.now(); cam.x = x0; cam.y = y0;
    const step = now => { const k = Math.min(1, (now - t0)/350), e = 1 - Math.pow(1 - k, 3); cam.x = x0 + (x1 - x0)*e; cam.y = y0 + (y1 - y0)*e; applyCam(); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step); }
}
let cdrag = null, dragged = false;
cview.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  cdrag = {id: e.pointerId, x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false}; dragged = false;
});
addEventListener('pointermove', e => {
  if (!cdrag || e.pointerId !== cdrag.id) return;
  const dx = e.clientX - cdrag.x, dy = e.clientY - cdrag.y;
  if (!cdrag.moved && Math.hypot(dx, dy) > 7){ cdrag.moved = true; cview.classList.add('dragging'); try { cview.setPointerCapture(e.pointerId); } catch(err){} }
  if (cdrag.moved){ cam.x = cdrag.cx - dx/cam.s; cam.y = cdrag.cy - dy/cam.s; clampCity(free()); applyCam(); }
});
const endDrag = e => { if (!cdrag || e.pointerId !== cdrag.id) return; dragged = cdrag.moved; cdrag = null; cview.classList.remove('dragging'); };
addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
/* Un arrastre no cuenta como toque: se descarta el clic que llega justo después. */
cview.addEventListener('click', e => { if (dragged){ e.stopPropagation(); e.preventDefault(); dragged = false; return; }
  const el = e.target.closest('.plate,[data-lot]'); if (el) selectBiz(el.dataset.biz || el.dataset.lot); }, true);
cview.addEventListener('wheel', e => { if (S.section !== 'empresas') return; e.preventDefault(); cam.x += (e.shiftKey ? e.deltaY : e.deltaX)/cam.s; cam.y += (e.shiftKey ? 0 : e.deltaY)/cam.s; clampCity(free()); applyCam(); }, {passive: false});
addEventListener('resize', () => { if (S.section === 'empresas') requestAnimationFrame(resetCam); });

/* ---------- actualización (4 veces por segundo con la ciudad abierta) ---------- */
function cityDayK(){ const tt = ((S.tarT/DAY_LEN*120) % 120 + 120) % 120, sm = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a)/(b - a))); return k*k*(3 - 2*k); }; return sm(58, 68, tt)*(1 - sm(110, 120, tt)); }
export function updateCity(){
  buildCity();
  const sel = bizSel();
  BIZ.forEach(b => {
    const L = lots[b.id], st = S.biz[b.id] || {lv: 0}, lv = st.lv || 0, s = bizStage(b.id), avail = S.level >= b.lv, can = avail && lv < 30 && S.money >= bizCost(b);
    const key = s + (s ? '' : avail ? 's' : 'l');
    if (L.key !== key){
      L.key = key; L.g.innerHTML = artOf(b, s, avail);
      try { const bb = L.g.getBBox(); L.top = Math.max(-60, Math.min(70, bb.y)); } catch(err){ L.top = 70; }
      L.el.classList.toggle('empty', !s);
    }
    L.el.classList.toggle('sel', b.id === sel);
    // cartel
    const P = L.plate, badge = P.querySelector('.pl-b'), sub = P.querySelector('small');
    P.classList.toggle('on', b.id === sel);
    P.classList.toggle('lk', !lv && !avail);
    const bk = s ? 'r' + s : avail ? 'sale' : 'lock';
    if (badge.dataset.k !== bk){ badge.dataset.k = bk; badge.innerHTML = s ? ROMAN[s] : avail ? '€' : LOCK_SVG; badge.style.background = s ? b.badge : avail ? '#3fcf6c' : '#efe1c4'; }
    const subTxt = lv ? `Nv ${lv} · +${money(bizIncAll(b))}/s` : avail ? `Se vende · ${money(bizCost(b))}` : `Nivel ${b.lv}`;
    if (sub.textContent !== subTxt) sub.textContent = subTxt;
    P.querySelector('.pl-up').hidden = !can;
    P.setAttribute('aria-label', `${b.name}: ${subTxt}${can ? ' (puedes mejorarla)' : ''}`);
    // evento en curso
    const bo = st.boost && st.boost.left > 0 ? st.boost : null, E = L.ev;
    E.hidden = !bo;
    if (bo){
      const up = bo.mult > 1, t = `${bo.name || (up ? 'Buena racha' : 'Mala racha')} ×${fmtMult(bo.mult)}`;
      E.className = 'evb ' + (up ? 'up' : 'down'); E.style.top = `${b.cell[1] + L.top + 12}px`;
      const html = `<span class="evi">${up ? '▲' : '▼'}</span><span><b>${t}</b><small>Quedan ${fmtT(bo.left)}</small></span>`;
      if (E.dataset.h !== html){ E.dataset.h = html; E.innerHTML = html; }
    }
  });
  // vecinos
  stage.querySelectorAll('.vlink').forEach(el => { const V = VECINOS[+el.dataset.v], on = vecOn(V); el.classList.toggle('on', on); });
  // marcador sobre el edificio elegido
  const Ls = lots[sel]; marker.style.left = `${Ls.b.cell[0] + 82}px`; marker.style.top = `${Ls.b.cell[1] + Ls.top - 50}px`;
  if (lastSel !== sel){ lastSel = sel; marker.classList.remove('drop'); void marker.offsetWidth; marker.classList.add('drop'); }
  // tráfico: más coches cuanto más grande es tu imperio
  const lvTot = BIZ.reduce((a, b) => a + bizLvl(b.id), 0), nCars = Math.min(6, 1 + Math.floor(lvTot/10));
  stage.querySelectorAll('.car').forEach((c, i) => c.hidden = i >= nCars);
  // día y noche
  const k = cityDayK(); night.style.opacity = ((1 - k)*.9).toFixed(2); stage.style.setProperty('--glow', (1 - k).toFixed(2));
}

/* Monedas que salen de las empresas abiertas: más a menudo cuanto más ganan. */
function coinTick(){
  if (S.section !== 'empresas' || RM || document.hidden || !built) return;
  const open = BIZ.filter(b => bizLvl(b.id) > 0); if (!open.length) return;
  const b = open[(Math.random()*open.length)|0], L = lots[b.id], el = document.createElement('i');
  el.className = 'ccoin'; el.style.left = `${b.cell[0] + 70 + Math.random()*60}px`; el.style.top = `${b.cell[1] + Math.max(L.top, 20) + 20}px`;
  el.addEventListener('animationend', () => el.remove());
  stage.querySelector('.city-fx').appendChild(el);
}
setInterval(coinTick, 700);

function lotScreen(id){ const L = lots[id]; if (!L) return null; const r = L.el.getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height*.45]; }
on('bizUp', id => { if (S.section !== 'empresas' || !lots[id]) return; const el = lots[id].el; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); const p = lotScreen(id); if (p) emit('fxBurst', p[0], p[1], '#ffc62e'); });
on('bizStage', id => { if (S.section !== 'empresas') return; const p = lotScreen(id); if (p){ emit('fxBurst', p[0], p[1], '#ffffff'); emit('fxBurst', p[0], p[1] - 30, BIZ.find(b => b.id === id).badge); } });
on('section', k => { if (k === 'empresas') requestAnimationFrame(() => { buildCity(); updateCity(); resetCam(); requestAnimationFrame(resetCam); }); });
