/* Sprites de la mina: todo se dibuja con formas simples, relleno vivo y contorno de tinta.
   Cada función recibe (g, x, y, s, …): x,y es el punto de apoyo en el suelo y s la escala (1 ≈ un minero de 30 px). */
const INK = '#2a1a0e';
if (!CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r){ r = Math.min(typeof r === 'number' ? r : 4, w/2, h/2); this.moveTo(x+r, y); this.arcTo(x+w, y, x+w, y+h, r); this.arcTo(x+w, y+h, x, y+h, r); this.arcTo(x, y+h, x, y, r); this.arcTo(x, y, x+w, y, r); this.closePath(); };
}
function ink(g, w = 1.6){ g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; }
function fillInk(g, col){ g.fillStyle = col; g.fill(); g.stroke(); }
function rbox(g, x, y, w, h, r, col){ g.beginPath(); g.roundRect(x, y, w, h, r); fillInk(g, col); }
function disc(g, x, y, r, col){ g.beginPath(); g.arc(x, y, r, 0, 6.2832); fillInk(g, col); }
function limb(g, x1, y1, x2, y2, col, w = 3){ g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = w + 2.2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); g.strokeStyle = INK; g.lineWidth = 1.6; }
export function shade(hex, k){ const n = parseInt(hex.slice(1), 16); let r = n >> 16 & 255, gg = n >> 8 & 255, b = n & 255; const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v*(1+k) : v + (255-v)*k))); return `rgb(${f(r)},${f(gg)},${f(b)})`; }
export function lerpCol(a, b, k){ const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16); const c = s => Math.round(((A >> s) & 255)*(1-k) + ((B >> s) & 255)*k); return `rgb(${c(16)},${c(8)},${c(0)})`; }

const SKINS = ['#f6c9a0', '#e8b48a', '#c98d62', '#9c6a45', '#f3d2b5'];
const SUITS = ['#3b7dd8', '#e0632f', '#2fa37a', '#8a55d6', '#3b7dd8', '#d64a6a'];

/* ---------- el minero, con varias posturas ---------- */
export function miner(g, x, y, s, o = {}){
  const t = o.t || 0, pose = o.pose || 'idle', seed = o.seed || 0;
  const skin = o.skin || SKINS[seed % SKINS.length], suit = o.suit || SUITS[seed % SUITS.length], hat = o.hat || '#ffc62e';
  g.save(); g.translate(x, y); g.scale((o.dir || 1)*s, s); ink(g, 1.6);
  const walk = pose === 'walk' || pose === 'push';
  const ph = Math.sin(t*10 + seed);
  const bob = walk ? Math.abs(ph)*1.2 : pose === 'idle' ? Math.sin(t*2 + seed)*0.4 : 0;
  g.translate(0, -bob);
  if (pose === 'pan'){
    rbox(g, -7, -9, 12, 7, 3, shade(suit, -.25));      // piernas dobladas
    rbox(g, -9, -4, 6, 4, 2, '#5a3a1a');                // bota
  } else {
    const a = walk ? ph*3 : 0;
    rbox(g, -5 - a*.3, -10, 4.4, 10, 2, shade(suit, -.25));
    rbox(g, 0.6 + a*.3, -10, 4.4, 10, 2, shade(suit, -.25));
    rbox(g, -6.5 - a*.3, -2.6, 6, 3.4, 1.6, '#5a3a1a');
    rbox(g, 0 + a*.3, -2.6, 6, 3.4, 1.6, '#5a3a1a');
  }
  const ty = pose === 'pan' ? 5 : 0;
  g.translate(0, ty);
  rbox(g, -6.8, -21, 13.6, 12.5, 4.5, suit);              // torso
  g.fillStyle = shade(suit, .35); g.fillRect(-4.2, -20, 2, 7); g.fillRect(2.2, -20, 2, 7);
  rbox(g, -6.8, -12, 13.6, 2.6, 1, '#5a3a1a');           // cinturón
  // brazos y herramienta
  if (pose === 'swing'){
    const k = o.swing != null ? o.swing : (0.5 + 0.5*Math.sin(t*(o.speed || 6) + seed));
    const ang = -2.3 + k*2.5, hx = 1 + Math.cos(ang)*7.5, hy = -17 + Math.sin(ang)*7.5;
    const ex = hx + Math.cos(ang)*12, ey = hy + Math.sin(ang)*12;
    limb(g, hx, hy, ex, ey, '#b77838', 1.8);
    g.save(); g.translate(ex, ey); g.rotate(ang + 1.5708);
    g.beginPath(); g.moveTo(-8, 2); g.quadraticCurveTo(0, -4.5, 8, 2); g.quadraticCurveTo(0, -1, -8, 2); fillInk(g, '#dfe7ef');
    g.restore();
    limb(g, 1, -17, hx, hy, suit, 3.2);
    disc(g, hx, hy, 1.9, skin);
  } else if (pose === 'pan'){
    const w = Math.sin(t*5 + seed)*0.25;
    limb(g, 2, -17, 8, -12, suit, 3);
    g.save(); g.translate(10, -11); g.rotate(w);
    g.beginPath(); g.ellipse(0, 0, 7.5, 2.4, 0, 0, 6.2832); fillInk(g, '#8d5b2c');
    g.fillStyle = '#7fc8f0'; g.beginPath(); g.ellipse(0, -0.6, 5, 1.2, 0, 0, 6.2832); g.fill();
    if (Math.sin(t*3 + seed) > .6){ g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(1.5, -0.8, 0.9, 0, 6.2832); g.fill(); }
    g.restore();
    disc(g, 8, -12, 1.9, skin);
  } else if (pose === 'dyn'){
    const lift = Math.sin(t*3 + seed)*0.3;
    limb(g, 1, -17, 6, -26 + lift*4, suit, 3.2);
    rbox(g, 4.6, -33 + lift*4, 3, 8, 1, '#ff5b4f');
    const sp = t*20 % 1;
    g.fillStyle = sp < .5 ? '#ffe36b' : '#ff9636'; g.beginPath(); g.arc(6.4, -35 + lift*4, 1.8 + sp, 0, 6.2832); g.fill();
    limb(g, -2, -17, -6, -10, suit, 3.2);
  } else if (pose === 'push'){
    limb(g, 1, -17, 9, -14, suit, 3.2); disc(g, 9, -14, 1.9, skin);
  } else {
    const sw = walk ? ph*3 : Math.sin(t*2 + seed);
    limb(g, -3, -17, -4 - sw, -10, suit, 3.2);
    limb(g, 3, -17, 4 + sw, -10, suit, 3.2);
  }
  // cabeza
  disc(g, 0.5, -26.5, 6.2, skin);
  g.fillStyle = INK; g.beginPath(); g.arc(2.6, -26.8, 0.95, 0, 6.2832); g.arc(5, -26.8, 0.95, 0, 6.2832); g.fill();
  disc(g, 6.4, -25, 1.5, shade(skin, -.12));
  if (seed % 3 === 0){ g.fillStyle = seed % 2 ? '#6b3e1f' : '#3a2616'; g.beginPath(); g.ellipse(3.4, -23.2, 3.4, 1.4, 0, 0, 6.2832); g.fill(); }
  // casco
  g.beginPath(); g.moveTo(-6.4, -28.4); g.quadraticCurveTo(-6, -35.6, 1, -35.6); g.quadraticCurveTo(7.6, -35.6, 7.4, -28.4); g.closePath(); fillInk(g, hat);
  rbox(g, -7.4, -29.6, 16.4, 2.6, 1.2, hat);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(-3.6, -34, 3, 1.3);
  disc(g, 5.4, -31.6, 1.8, '#fff6c8');
  g.restore();
}

/* ---------- vagoneta ---------- */
export function cart(g, x, y, s, ore, fill = 1){
  g.save(); g.translate(x, y); g.scale(s, s); ink(g, 1.6);
  disc(g, -6.5, -3.2, 3.1, '#4a4a52'); disc(g, 6.5, -3.2, 3.1, '#4a4a52');
  g.fillStyle = '#9aa0aa'; g.beginPath(); g.arc(-6.5, -3.2, 1.1, 0, 6.2832); g.arc(6.5, -3.2, 1.1, 0, 6.2832); g.fill();
  if (fill > 0){
    const h = 2 + 4*fill;
    g.beginPath(); g.moveTo(-9, -15); g.quadraticCurveTo(-6, -15 - h, -2, -15 - h*.7); g.quadraticCurveTo(1, -15 - h*1.2, 4, -15 - h*.8); g.quadraticCurveTo(8, -15 - h*.9, 9, -15); g.closePath(); fillInk(g, ore);
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(-3, -15 - h*.6, .9, 0, 6.2832); g.arc(4, -15 - h*.7, .8, 0, 6.2832); g.fill();
  }
  g.beginPath(); g.moveTo(-11, -16); g.lineTo(11, -16); g.lineTo(9, -5.5); g.lineTo(-9, -5.5); g.closePath(); fillInk(g, '#a86d36');
  g.strokeStyle = '#6b411c'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-4, -15.4); g.lineTo(-3.5, -6); g.moveTo(4, -15.4); g.lineTo(3.5, -6); g.stroke();
  rbox(g, -12, -17.5, 24, 2.6, 1.2, '#7c848f');
  g.restore();
}

/* ---------- perforadora sobre orugas ---------- */
export function drill(g, x, y, s, t){
  const j = Math.sin(t*55)*0.45;
  g.save(); g.translate(x, y); g.scale(s, s); ink(g, 1.6);
  rbox(g, -14, -7, 24, 7, 3.5, '#4a4a52');
  g.fillStyle = '#7c848f'; for (let i = -10; i <= 6; i += 5.3){ g.beginPath(); g.arc(i, -3.5, 1.6, 0, 6.2832); g.fill(); }
  rbox(g, -13, -19 + j*.3, 17, 12.5, 3.5, '#ffc62e');
  rbox(g, -10, -17 + j*.3, 7, 5, 1.5, '#8fd3ff');
  g.fillStyle = INK; g.beginPath(); g.moveTo(-12, -8.4 + j*.3); for (let i = 0; i < 4; i++){ g.lineTo(-12 + i*4 + 2, -10.4 + j*.3); g.lineTo(-12 + i*4 + 4, -8.4 + j*.3); } g.lineTo(-12, -8.4 + j*.3); g.fill();
  rbox(g, 3, -16 + j*.3, 10, 5, 2, '#7c848f');
  g.save(); g.translate(13 + j, -13.5 + j*.3);
  g.beginPath(); g.moveTo(0, -4); g.lineTo(10, 0); g.lineTo(0, 4); g.closePath(); fillInk(g, '#dfe7ef');
  g.strokeStyle = '#8b96a3'; g.lineWidth = 1; const off = (t*30) % 3;
  for (let k = 0; k < 3; k++){ const xx = k*3 + off; if (xx > 9) continue; const hh = 4*(1 - xx/10); g.beginPath(); g.moveTo(xx, -hh); g.lineTo(xx + 1.5, hh); g.stroke(); }
  g.restore();
  g.restore();
}

/* ---------- excavadora ---------- */
export function excavator(g, x, y, s, t, seed = 0){
  g.save(); g.translate(x, y); g.scale(s, s); ink(g, 1.6);
  const a1 = -0.75 + 0.3*Math.sin(t*1.3 + seed), a2 = 1.3 + 0.45*Math.sin(t*1.3 + seed + 1.2);
  rbox(g, -18, -8, 30, 8, 4, '#4a4a52');
  g.fillStyle = '#7c848f'; for (let i = -14; i <= 8; i += 5.5){ g.beginPath(); g.arc(i, -4, 1.8, 0, 6.2832); g.fill(); }
  rbox(g, -16, -20, 24, 12, 3, '#ffb020');
  rbox(g, -14, -31, 11, 12, 3, '#ffb020');
  rbox(g, -12, -29, 7, 7, 1.5, '#8fd3ff');
  g.fillStyle = '#6a6f78'; g.fillRect(-9, -24, 0, 0);
  const bx = 6, by = -18, ex = bx + Math.cos(a1)*20, ey = by + Math.sin(a1)*20;
  limb(g, bx, by, ex, ey, '#ffb020', 4);
  const fx = ex + Math.cos(a1 + a2)*14, fy = ey + Math.sin(a1 + a2)*14;
  limb(g, ex, ey, fx, fy, '#ffb020', 3.2);
  g.save(); g.translate(fx, fy); g.rotate(a1 + a2 - 0.6);
  g.beginPath(); g.moveTo(-3, -2); g.lineTo(6, -3); g.lineTo(7, 4); g.quadraticCurveTo(0, 7, -3, 2); g.closePath(); fillInk(g, '#8b96a3');
  g.restore();
  disc(g, ex, ey, 2, '#6a6f78'); disc(g, bx, by, 2.2, '#6a6f78');
  g.restore();
}

/* ---------- tuneladora (TBM) ---------- */
export function tbm(g, x, y, s, t){
  g.save(); g.translate(x, y); g.scale(s, s); ink(g, 1.8);
  rbox(g, -74, -30, 30, 24, 5, '#8b96a3');
  g.fillStyle = '#6a6f78'; g.fillRect(-72, -12, 26, 4);
  rbox(g, -46, -36, 42, 32, 8, '#ff9636');
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-42, -33, 34, 4);
  g.strokeStyle = shade('#ff9636', -.35); g.lineWidth = 1.6; for (let i = -38; i < -6; i += 8){ g.beginPath(); g.moveTo(i, -35); g.lineTo(i, -5); g.stroke(); }
  ink(g, 1.8);
  disc(g, -58, -24, 3, '#fff6c8');
  g.save(); g.translate(0, -20); g.rotate(t*1.6);
  disc(g, 0, 0, 19, '#7c848f');
  for (let k = 0; k < 6; k++){ g.rotate(1.0472); rbox(g, -1.8, 3, 3.6, 15, 1.5, '#4a4a52'); g.fillStyle = '#dfe7ef'; g.beginPath(); g.arc(0, 12, 1.4, 0, 6.2832); g.arc(0, 7, 1.2, 0, 6.2832); g.fill(); }
  disc(g, 0, 0, 5, '#ffc62e');
  g.restore();
  rbox(g, -70, -6, 64, 6, 3, '#4a4a52');
  g.restore();
}

/* ---------- tanques de lixiviación ---------- */
export function tank(g, x, y, s, t, liquid = '#6ee07a', seed = 0){
  g.save(); g.translate(x, y); g.scale(s, s); ink(g, 1.6);
  rbox(g, -12, -30, 24, 30, 5, '#c7d3de');
  const lv = 0.55 + 0.08*Math.sin(t*.7 + seed);
  g.save(); g.beginPath(); g.roundRect(-10, -28, 20, 26, 4); g.clip();
  g.fillStyle = liquid; g.fillRect(-10, -2 - 26*lv, 20, 26*lv);
  g.fillStyle = 'rgba(255,255,255,.7)';
  for (let k = 0; k < 4; k++){ const by = ((t*14 + k*7 + seed*3) % 26); g.beginPath(); g.arc(-6 + k*4, -2 - by, 1.1 + (k % 2)*.5, 0, 6.2832); g.fill(); }
  g.restore();
  g.beginPath(); g.roundRect(-10, -28, 20, 26, 4); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(-8, -26, 3, 20);
  rbox(g, -14, -33, 28, 5, 2, '#9aa7b4');
  g.restore();
}

/* ---------- castillete del pozo ---------- */
export function headframe(g, x, y, s, t){
  g.save(); g.translate(x, y); g.scale(s, s); ink(g, 2);
  const red = '#d9573b', dark = '#a63b24';
  g.beginPath(); g.moveTo(-20, 0); g.lineTo(-5, -86); g.lineTo(5, -86); g.lineTo(20, 0); g.lineTo(13, 0); g.lineTo(2, -76); g.lineTo(-2, -76); g.lineTo(-13, 0); g.closePath(); fillInk(g, red);
  g.strokeStyle = dark; g.lineWidth = 2;
  for (let k = 0; k < 4; k++){ const y1 = -8 - k*19, y2 = y1 - 19, w1 = 16 - k*3.2, w2 = 16 - (k+1)*3.2; g.beginPath(); g.moveTo(-w1, y1); g.lineTo(w2, y2); g.moveTo(w1, y1); g.lineTo(-w2, y2); g.stroke(); }
  ink(g, 2);
  g.beginPath(); g.moveTo(20, 0); g.lineTo(44, 0); g.lineTo(8, -70); g.lineTo(3, -64); g.closePath(); fillInk(g, red);
  rbox(g, -9, -92, 18, 7, 2, '#7c848f');
  g.save(); g.translate(0, -94); g.rotate(t*2.2);
  g.beginPath(); g.arc(0, 0, 11, 0, 6.2832); g.lineWidth = 3.2; g.strokeStyle = INK; g.stroke(); g.lineWidth = 1.8; g.strokeStyle = '#dfe7ef'; g.stroke();
  ink(g, 1.4); for (let k = 0; k < 6; k++){ g.rotate(1.0472); g.beginPath(); g.moveTo(0, 0); g.lineTo(10, 0); g.stroke(); }
  disc(g, 0, 0, 2.6, '#ffc62e');
  g.restore();
  g.restore();
}

/* ---------- jaula del ascensor ---------- */
export function cage(g, x, y, s, ore){
  g.save(); g.translate(x, y); g.scale(s, s); ink(g, 1.6);
  rbox(g, -10, -20, 20, 20, 2, 'rgba(160,172,186,.9)');
  g.strokeStyle = '#4a4a52'; g.lineWidth = 1.3; for (let i = -5; i <= 5; i += 5){ g.beginPath(); g.moveTo(i, -19); g.lineTo(i, -1); g.stroke(); }
  if (ore){ g.fillStyle = ore; ink(g, 1.2); g.beginPath(); g.moveTo(-8, -1); g.quadraticCurveTo(-4, -9, 0, -6); g.quadraticCurveTo(5, -10, 8, -1); g.closePath(); g.fill(); g.stroke(); }
  ink(g, 1.6); rbox(g, -12, -22, 24, 3, 1, '#7c848f');
  g.restore();
}

/* ---------- caja fuerte (almacén) ---------- */
export function vault(g, x, y, s, lv, full, t){
  g.save(); g.translate(x, y); g.scale(s, s); ink(g, 1.8);
  const h = 38 + Math.min(4, lv)*3;
  rbox(g, -28, -h, 56, h, 4, '#e7d6b4');
  g.fillStyle = '#d2bd95'; for (let r = 0; r < h - 6; r += 7) g.fillRect(-26, -h + 4 + r, 52, 1.4);
  g.beginPath(); g.moveTo(-32, -h); g.lineTo(0, -h - 14); g.lineTo(32, -h); g.closePath(); fillInk(g, '#8d5b2c');
  disc(g, 0, -h*0.45, 12, '#b8c7d6');
  g.save(); g.translate(0, -h*0.45); g.rotate(t*0.6);
  ink(g, 1.4); for (let k = 0; k < 4; k++){ g.rotate(1.5708); g.beginPath(); g.moveTo(3, 0); g.lineTo(9, 0); g.stroke(); }
  disc(g, 0, 0, 3.4, '#ffc62e');
  g.restore();
  disc(g, 20, -h + 8, 6, '#ffc62e');
  g.fillStyle = INK; g.font = '400 8px "Lilita One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(lv), 20, -h + 8.5);
  if (full){ const on = Math.floor(t*4) % 2; disc(g, 0, -h - 15, 4, on ? '#ff5b4f' : '#8a2a22'); if (on){ g.fillStyle = 'rgba(255,91,79,.35)'; g.beginPath(); g.arc(0, -h - 15, 10, 0, 6.2832); g.fill(); } }
  g.restore();
}

/* ---------- empresas en la superficie ---------- */
export function building(g, id, x, y, s, lv, t, night){
  g.save(); g.translate(x, y); g.scale(s, s); ink(g, 1.8);
  const fl = 1 + Math.min(3, Math.floor(lv/8));
  const lit = night ? '#ffe27a' : '#9fdcff';
  const win = (wx, wy, w = 5, h = 5) => rbox(g, wx, wy, w, h, 1, lit);
  if (id === 'joyeria'){
    const H = 28 + (fl-1)*10;
    rbox(g, -20, -H, 40, H, 3, '#ff9ec0');
    for (let f = 1; f < fl; f++){ win(-14, -H + 4 + (f-1)*10, 8, 6); win(6, -H + 4 + (f-1)*10, 8, 6); }
    rbox(g, -15, -17, 16, 13, 2, lit);
    g.save(); g.translate(-7, -10.5); g.rotate(Math.sin(t*2)*.1);
    g.beginPath(); g.moveTo(-4, -2); g.lineTo(0, -5); g.lineTo(4, -2); g.lineTo(0, 4); g.closePath(); fillInk(g, '#8fe7ff'); g.restore();
    rbox(g, 4, -17, 10, 17, 1.5, '#b2476b');
    g.beginPath(); g.moveTo(-23, -19); g.lineTo(23, -19); g.lineTo(21, -24); g.lineTo(-21, -24); g.closePath(); fillInk(g, '#fff');
    g.fillStyle = '#ff5b8a'; for (let i = -21; i < 21; i += 8) g.fillRect(i, -23.6, 4, 4.3);
  } else if (id === 'refineria'){
    const H = 26 + (fl-1)*8;
    rbox(g, 6, -H - 22, 8, 24, 1.5, '#7c848f'); rbox(g, 16, -H - 14, 7, 16, 1.5, '#7c848f');
    g.fillStyle = '#ff5b4f'; g.fillRect(6.8, -H - 20, 6.4, 3); g.fillRect(16.8, -H - 12, 5.4, 3);
    rbox(g, -24, -H, 48, H, 3, '#8fa6bd');
    g.beginPath(); g.moveTo(-24, -H); g.lineTo(-16, -H - 8); g.lineTo(-8, -H); g.lineTo(0, -H - 8); g.lineTo(6, -H); g.closePath(); fillInk(g, '#6f88a3');
    const glow = 0.6 + 0.4*Math.sin(t*5);
    rbox(g, -18, -14, 14, 10, 2, `rgba(255,${130 + glow*60|0},40,1)`);
    win(2, -14, 6, 6); win(11, -14, 6, 6);
  } else if (id === 'transporte'){
    rbox(g, -26, -26, 36, 26, 3, '#ffd36b');
    g.beginPath(); g.moveTo(-28, -26); g.lineTo(-8, -34); g.lineTo(12, -26); g.closePath(); fillInk(g, '#d0620a');
    rbox(g, -21, -19, 26, 19, 1.5, '#9aa0aa');
    g.strokeStyle = '#6a6f78'; g.lineWidth = 1.2; for (let r = -16; r < 0; r += 3.5){ g.beginPath(); g.moveTo(-20, r); g.lineTo(4, r); g.stroke(); }
    truck(g, 24, 0, 0.62, '#ffc62e', 1, 0.7, t);
  } else if (id === 'inmo'){
    const H = 30 + (fl-1)*14;
    rbox(g, -18, -H, 36, H, 3, '#7fc3a7');
    for (let r = 0; r < fl*2; r++) for (let c = 0; c < 3; c++) win(-13 + c*10, -H + 5 + r*7, 5, 4.5);
    rbox(g, -4, -9, 8, 9, 1.5, '#5a3a1a');
    rbox(g, -20, -H - 3, 40, 4, 1.5, '#4f9a7d');
  } else if (id === 'banco'){
    const H = 30 + (fl-1)*8;
    rbox(g, -26, -H, 52, H, 2, '#f1e6cf');
    g.beginPath(); g.moveTo(-30, -H); g.lineTo(0, -H - 14); g.lineTo(30, -H); g.closePath(); fillInk(g, '#e2cfa7');
    disc(g, 0, -H - 5, 4, '#ffc62e');
    for (let c = 0; c < 5; c++) rbox(g, -21 + c*9.5, -H + 4, 4.5, H - 8, 1, '#fff');
    rbox(g, -28, -5, 56, 5, 1, '#d2bd95');
  } else if (id === 'tec'){
    const H = 44 + (fl-1)*16;
    const gr = g.createLinearGradient(-14, 0, 14, 0); gr.addColorStop(0, '#3ea8ff'); gr.addColorStop(1, '#8fd3ff');
    g.beginPath(); g.roundRect(-14, -H, 28, H, 3); g.fillStyle = gr; g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.2; for (let r = -H + 6; r < -4; r += 6){ g.beginPath(); g.moveTo(-12, r); g.lineTo(12, r); g.stroke(); }
    ink(g, 1.8); g.beginPath(); g.moveTo(0, -H); g.lineTo(0, -H - 12); g.stroke();
    const on = Math.floor(t*2) % 2; disc(g, 0, -H - 13, 2.4, on ? '#ff5b4f' : '#8a2a22');
    if (night) for (let r = -H + 8; r < -6; r += 12){ g.fillStyle = 'rgba(255,240,150,.55)'; g.fillRect(-10, r, 20, 3); }
  }
  g.restore();
}

/* ---------- energía ---------- */
export function solar(g, x, y, s){
  g.save(); g.translate(x, y); g.scale(s, s); ink(g, 1.4);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -8); g.stroke();
  g.beginPath(); g.moveTo(-11, -6); g.lineTo(9, -10); g.lineTo(12, -18); g.lineTo(-8, -14); g.closePath(); fillInk(g, '#2f6fcf');
  g.strokeStyle = '#8fd3ff'; g.lineWidth = .9;
  g.beginPath(); g.moveTo(-1, -8); g.lineTo(2, -16); g.moveTo(-9.5, -10); g.lineTo(10.5, -14); g.stroke();
  g.restore();
}
export function turbine(g, x, y, s, ang){
  g.save(); g.translate(x, y); g.scale(s, s); ink(g, 1.4);
  g.beginPath(); g.moveTo(-2.4, 0); g.lineTo(-1, -46); g.lineTo(1, -46); g.lineTo(2.4, 0); g.closePath(); fillInk(g, '#f4f7fa');
  g.save(); g.translate(0, -47); g.rotate(ang);
  for (let k = 0; k < 3; k++){ g.rotate(2.0944); g.beginPath(); g.moveTo(0, -1.5); g.quadraticCurveTo(10, -3, 22, 0); g.quadraticCurveTo(10, 2.5, 0, 1.5); g.closePath(); fillInk(g, '#ffffff'); }
  disc(g, 0, 0, 2.6, '#dfe7ef');
  g.restore(); g.restore();
}
export function plant(g, kind, x, y, s, t){
  g.save(); g.translate(x, y); g.scale(s, s); ink(g, 1.6);
  if (kind === 'bio'){
    rbox(g, -14, -26, 16, 26, 7, '#7bd88f'); rbox(g, 4, -18, 12, 18, 5, '#5cc27a');
    g.save(); g.translate(-6, -14); g.rotate(-.5);
    g.beginPath(); g.ellipse(0, 0, 3.4, 6, 0, 0, 6.2832); fillInk(g, '#2e9a4e'); g.restore();
  } else {
    rbox(g, -16, -18, 32, 18, 3, '#b8a58a');
    g.save(); g.beginPath(); g.roundRect(-16, -8, 32, 5, 1); g.clip();
    for (let i = -20; i < 20; i += 6){ g.fillStyle = '#ffc62e'; g.beginPath(); g.moveTo(i, -3); g.lineTo(i + 3, -3); g.lineTo(i + 6, -8); g.lineTo(i + 3, -8); g.fill(); g.fillStyle = INK; g.beginPath(); g.moveTo(i + 3, -3); g.lineTo(i + 6, -3); g.lineTo(i + 9, -8); g.lineTo(i + 6, -8); g.fill(); }
    g.restore(); g.strokeRect(-16, -8, 32, 5);
    g.beginPath(); g.moveTo(0, -17); g.lineTo(5, -10); g.lineTo(-5, -10); g.closePath(); fillInk(g, '#ffc62e');
  }
  g.restore();
}

/* ---------- camión de mineral ---------- */
export function truck(g, x, y, s, ore, dir = 1, load = 1, t = 0){
  g.save(); g.translate(x, y); g.scale(s*dir, s); ink(g, 1.8);
  const r = t*8;
  if (load > 0){ g.beginPath(); g.moveTo(-18, -18); g.quadraticCurveTo(-10, -18 - 9*load, -2, -18 - 6*load); g.quadraticCurveTo(2, -18 - 8*load, 6, -18); g.closePath(); fillInk(g, ore); }
  g.beginPath(); g.moveTo(-22, -20); g.lineTo(8, -20); g.lineTo(6, -7); g.lineTo(-20, -7); g.closePath(); fillInk(g, '#ffc62e');
  rbox(g, 8, -17, 12, 10, 3, '#ffb020');
  rbox(g, 13, -15, 5, 5, 1, '#8fd3ff');
  for (const wx of [-13, 12]){ g.save(); g.translate(wx, -4.5); g.rotate(r); disc(g, 0, 0, 4.6, '#3a3a40'); g.fillStyle = '#9aa0aa'; g.fillRect(-1, -3, 2, 6); g.restore(); }
  g.restore();
}

/* ---------- la mina rival ---------- */
export function rival(g, x, y, s, fill, t){
  g.save(); g.translate(x, y); g.scale(s, s); ink(g, 1.8);
  const h = 6 + 22*fill;
  g.beginPath(); g.moveTo(-8, 0); g.quadraticCurveTo(12, -h*2, 34, 0); g.closePath(); fillInk(g, '#8d8490');
  g.fillStyle = '#ffd84a'; for (let k = 0; k < 5; k++){ g.beginPath(); g.arc(4 + k*5, -h*.5 - (k % 2)*3, 1.2, 0, 6.2832); g.fill(); }
  g.beginPath(); g.moveTo(-26, 0); g.lineTo(-18, -56); g.lineTo(-12, -56); g.lineTo(-4, 0); g.lineTo(-9, 0); g.lineTo(-15, -46); g.lineTo(-21, 0); g.closePath(); fillInk(g, '#6b6470');
  g.save(); g.translate(-15, -60); g.rotate(-t*1.5); disc(g, 0, 0, 7, '#8b96a3'); ink(g, 1.2); for (let k = 0; k < 4; k++){ g.rotate(1.5708); g.beginPath(); g.moveTo(0, 0); g.lineTo(6, 0); g.stroke(); } g.restore();
  ink(g, 1.6); g.beginPath(); g.moveTo(-15, -67); g.lineTo(-15, -84); g.stroke();
  const wv = Math.sin(t*4)*2;
  g.beginPath(); g.moveTo(-15, -84); g.quadraticCurveTo(-7, -86 + wv, 1, -83); g.lineTo(1, -75); g.quadraticCurveTo(-7, -77 + wv, -15, -76); g.closePath(); fillInk(g, '#8a55d6');
  g.fillStyle = '#fff'; g.font = '400 7px "Lilita One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('C', -7, -79.5);
  g.restore();
}

/* ---------- decoración ---------- */
export function tree(g, x, y, s, kind = 0, t = 0){
  g.save(); g.translate(x, y); g.scale(s, s); ink(g, 1.6);
  const sway = Math.sin(t*1.2 + x*.05)*.04;
  g.rotate(sway);
  rbox(g, -2.5, -12, 5, 12, 1.5, '#8d5b2c');
  if (kind % 2){
    g.beginPath(); g.moveTo(0, -40); g.lineTo(13, -12); g.lineTo(-13, -12); g.closePath(); fillInk(g, '#3fae5a');
    g.beginPath(); g.moveTo(0, -46); g.lineTo(9, -26); g.lineTo(-9, -26); g.closePath(); fillInk(g, '#52c46c');
  } else {
    g.beginPath(); g.arc(-6, -20, 8, 0, 6.2832); g.arc(6, -21, 8, 0, 6.2832); g.arc(0, -29, 9, 0, 6.2832); g.fillStyle = '#4cbc63'; g.fill();
    g.beginPath(); g.arc(-6, -20, 8, 2.2, 5.2); g.stroke(); g.beginPath(); g.arc(6, -21, 8, -1.6, 1.2); g.stroke(); g.beginPath(); g.arc(0, -29, 9, 3.4, 6.2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(-3, -31, 3, 0, 6.2832); g.fill();
  }
  g.restore();
}
export function cloud(g, x, y, s, col = '#fff'){
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = col;
  g.beginPath(); g.arc(-14, 0, 9, 0, 6.2832); g.arc(0, -6, 13, 0, 6.2832); g.arc(15, -1, 10, 0, 6.2832); g.roundRect(-24, -2, 50, 11, 5); g.fill();
  g.restore();
}
export function nuggetSprite(g, x, y, s, col, hi, t){
  g.save(); g.translate(x, y); g.scale(s, s);
  const p = 1 + Math.sin(t*5)*.12;
  const gl = g.createRadialGradient(0, 0, 0, 0, 0, 26*p); gl.addColorStop(0, 'rgba(255,240,170,.8)'); gl.addColorStop(1, 'rgba(255,240,170,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 26*p, 0, 6.2832); g.fill();
  g.rotate(Math.sin(t*2)*.15); ink(g, 1.8);
  g.beginPath(); const pts = [[-9,-2],[-5,-8],[3,-9],[9,-4],[8,4],[2,8],[-6,7],[-10,3]];
  pts.forEach(([a, b], i) => i ? g.lineTo(a*p, b*p) : g.moveTo(a*p, b*p)); g.closePath(); fillInk(g, col);
  g.fillStyle = hi; g.beginPath(); g.moveTo(-5*p, -6*p); g.lineTo(2*p, -7*p); g.lineTo(-1*p, -2*p); g.closePath(); g.fill();
  const sp = (t*1.3) % 1; g.fillStyle = '#fff'; g.globalAlpha = 1 - sp;
  g.beginPath(); const sx = 7, sy = -8, r = 2 + sp*4; g.moveTo(sx, sy - r); g.lineTo(sx + r*.25, sy - r*.25); g.lineTo(sx + r, sy); g.lineTo(sx + r*.25, sy + r*.25); g.lineTo(sx, sy + r); g.lineTo(sx - r*.25, sy + r*.25); g.lineTo(sx - r, sy); g.lineTo(sx - r*.25, sy - r*.25); g.closePath(); g.fill();
  g.globalAlpha = 1;
  g.restore();
}

/* ---------- iconos de la tienda: el mismo sprite en pequeño ---------- */
const ICON_SKY = ['#bfe6ff', '#8fcaf2'];
export function drawCrewIcon(cv, id){
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = r.width || 58, h = r.height || 58;
  cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr);
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const underground = !['batea', 'lix'].includes(id);
  const bg = g.createLinearGradient(0, 0, 0, h);
  if (underground){ bg.addColorStop(0, '#6b4a2e'); bg.addColorStop(1, '#3b2616'); } else { bg.addColorStop(0, ICON_SKY[0]); bg.addColorStop(1, ICON_SKY[1]); }
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (underground){ const gl = g.createRadialGradient(w*.5, h*.45, 2, w*.5, h*.45, w*.7); gl.addColorStop(0, 'rgba(255,200,110,.45)'); gl.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = gl; g.fillRect(0, 0, w, h); }
  g.fillStyle = underground ? '#8a6242' : '#6cc24a'; g.fillRect(0, h - 9, w, 9);
  const t = 1.1, gy = h - 7, k = w/58;
  switch (id){
    case 'batea': g.fillStyle = '#58b7f0'; g.fillRect(0, h - 9, w, 4); miner(g, w*.42, gy, 1.2*k, {pose:'pan', t, seed:1}); break;
    case 'pico': miner(g, w*.4, gy, 1.25*k, {pose:'swing', swing:.2, seed:2}); break;
    case 'vagoneta': cart(g, w*.5, gy, 1.55*k, '#ffc62e'); break;
    case 'perfo': drill(g, w*.42, gy, 1.3*k, 0); break;
    case 'voladura': miner(g, w*.45, gy, 1.2*k, {pose:'dyn', t:.3, seed:4}); break;
    case 'excav': excavator(g, w*.5, gy, 1*k, 0); break;
    case 'lix': tank(g, w*.34, gy, .9*k, 0, '#6ee07a'); tank(g, w*.68, gy, .75*k, 1, '#a4f06e', 3); break;
    case 'tbm': g.save(); g.translate(w*.78, 0); tbm(g, 0, gy, .62*k, .4); g.restore(); break;
  }
}
