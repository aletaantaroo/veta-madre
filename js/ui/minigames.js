import { K, on, sfx, showSection, toast, updateUI } from '../core/bus.js';
import { $, $$, dpr, setT } from '../core/dom.js';
import { money, mulberry32, nf1, nf2, pfmt, rgba } from '../core/format.js';
import { METALS, MK } from '../data/content.js';
import { hhmm } from '../game/economy.js';
import { BET_PAY, MG_TICKETS, betCap, mgPay, mgState, placeBet, tickets, useTicket } from '../game/minigames.js';
import { S, has, lvReq, mk, unl } from '../game/state.js';
import { fitCanvas, resetHover } from '../render/charts.js';
import { cart, miner, nuggetSprite } from '../render/sprites.js';
import { icon } from './icons.js';
import { updateTrading } from './market.js';

/* ================= Minijuegos =================
   Menú con cuatro juegos: «Sube o baja» (apuesta rápida), «Vagoneta desbocada» (corredor),
   «Voladura» (puntería con el tiempo) y el trading con apalancamiento de siempre. */
let view = 'menu';
const GAMES = [
  {id: 'bet',   name: 'Sube o baja',        ico: 'chart', col: 'var(--blue)',   txt: 'Apuesta a si el precio de un metal sube o baja en los próximos segundos.', cost: 'Con tu caja · paga ×1,9'},
  {id: 'cart',  name: 'Vagoneta desbocada', ico: 'cart',  col: 'var(--orange)', txt: 'La vagoneta se ha soltado: salta rocas y agujeros y coge pepitas.', cost: '1 ficha'},
  {id: 'blast', name: 'Voladura',           ico: 'tnt',   col: 'var(--red)',    txt: 'Detona cada carga en el momento justo. Tres dificultades: normal, difícil y experto.', cost: '1 ficha'},
  {id: 'trade', name: 'Trading',            ico: 'bull',  col: 'var(--green)',  txt: 'Largo o corto con apalancamiento, sin tocar tu almacén. Para los valientes.', cost: 'Con tu caja · riesgo alto'},
];
const VIEWS = {menu: '#mgMenu', bet: '#mgBet', cart: '#mgCart', blast: '#mgBlast', trade: '#mgTrade'};

function tradeOpen(){ return has('u_broker'); }
function cardsHtml(){
  const G = mgState();
  return GAMES.map(g => {
    const lock = g.id === 'trade' && !tradeOpen(), needTk = g.id === 'cart' || g.id === 'blast', noTk = needTk && G.tk <= 0;
    const best = g.id === 'cart' && G.best.cart ? `Récord: ${G.best.cart} pepitas` : g.id === 'blast' && (G.best.blast || G.best.blast_dificil || G.best.blast_experto) ? `Récord: ${['experto', 'dificil', 'normal'].filter(k => G.best[bestKey(k)]).map(k => `${nf1.format(G.best[bestKey(k)])} (${BLAST_MODES[k].name.toLowerCase()})`)[0]}` : g.id === 'bet' && G.bets.length ? `${G.bets.filter(b => b.pay > b.stake).length} de ${G.bets.length} acertadas` : g.id === 'trade' && S.trades ? `${S.wins}/${S.trades} operaciones ganadas` : '';
    const live = g.id === 'bet' && G.bet ? '<span class="mg-live">En juego</span>' : g.id === 'trade' && S.positions.length ? `<span class="mg-live">${S.positions.length} abierta${S.positions.length > 1 ? 's' : ''}</span>` : '';
    return `<button type="button" class="mg-card${lock ? ' locked' : ''}${noTk ? ' spent' : ''}" data-mg="${g.id}" style="--gc:${g.col}">
      <span class="mg-ico">${icon(g.ico)}</span>
      <span class="mg-txt"><b>${g.name}</b>${live}<span>${g.txt}</span></span>
      <span class="mg-foot"><span class="mg-cost">${lock ? `Necesitas la Cuenta en un bróker${unl('trading') ? '' : ` (nivel ${lvReq('trading')})`}` : noTk ? 'Sin fichas hasta medianoche' : g.cost}</span>${best ? `<span class="mg-best">${best}</span>` : ''}</span>
    </button>`;
  }).join('');
}
function tkTxt(){ const t = tickets(); return `Fichas: ${'●'.repeat(t)}${'○'.repeat(Math.max(0, MG_TICKETS - t))} · se recargan a medianoche (${hhmm(0)} del Día ${(S.day || 0) + 1})`; }
function openGame(id){
  if (id === 'trade' && !tradeOpen()){ toast(unl('trading') ? 'Compra la Cuenta en un bróker (Tienda → Mejoras → Mercado) para operar.' : `El trading se abre en el nivel ${lvReq('trading')}.`); return; }
  if (view !== id) bankUnfinished();
  view = VIEWS[id] ? id : 'menu';
  Object.entries(VIEWS).forEach(([k, sel]) => $(sel).hidden = k !== view);
  if (view === 'cart') cartReady(); else stopCart();
  if (view === 'blast') blastReady(); else stopBlast();
  sfx('ui'); K.mg = ''; updateUI();
}
$('#mgCards').addEventListener('click', e => { const b = e.target.closest('[data-mg]'); if (b) openGame(b.dataset.mg); });
document.addEventListener('click', e => { if (e.target.closest('[data-mg-back]')) openGame('menu'); });
on('mgOpen', id => { showSection('minijuegos'); openGame(id); });
/* Si sales a mitad de partida no pierdes lo ganado: se cobra lo que llevabas. */
function bankUnfinished(){
  if (C && !C.done && C.t > 0){ C.done = true; if (C.got) mgPay('cart', C.got*2, C.got); }
  if (B && !B.over && B.res.length){ B.over = true; if (B.pts) mgPay(bestKey(B.mode), B.pts*BLAST_PAY, B.pts); }
}
on('section', k => { if (k !== 'minijuegos'){ bankUnfinished(); stopCart(); stopBlast(); if (view === 'cart' || view === 'blast') openGameQuiet('menu'); } });
function openGameQuiet(id){ view = id; Object.entries(VIEWS).forEach(([k, sel]) => $(sel).hidden = k !== view); }

export function updateMinigames(){
  const G = mgState();
  setT($('#mgMeta'), `Fichas ${G.tk}/${MG_TICKETS}`);
  if (view === 'menu'){
    const key = [G.tk, G.bet ? 1 : 0, G.bets.length, G.best.cart, G.best.blast, G.best.blast_dificil, G.best.blast_experto, tradeOpen(), S.positions.length, S.trades, S.level].join('|');
    if (key !== K.mg){ K.mg = key; $('#mgCards').innerHTML = cardsHtml(); }
  }
  if (view === 'bet') updateBet();
  if (view === 'trade') updateTradeView();
  if (view === 'cart') setT($('#cartMeta'), tkTxt());
  if (view === 'blast') setT($('#blastMeta'), tkTxt());
}

/* ---------- línea de precio sencilla para los minijuegos ---------- */
function sparkline(cv, arr, col, ref){
  const f = fitCanvas(cv); if (!f || arr.length < 2) return;
  const {g, w, h} = f;
  let lo = Math.min(...arr, ref ?? Infinity), hi = Math.max(...arr, ref ?? -Infinity); const pad = Math.max((hi - lo)*.15, hi*.0015); lo -= pad; hi += pad;
  const X = i => 6 + i/(arr.length - 1)*(w - 70), Y = v => 6 + (hi - v)/(hi - lo)*(h - 12);
  if (ref != null){ g.setLineDash([5, 4]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, Y(ref)); g.lineTo(w - 64, Y(ref)); g.stroke(); g.setLineDash([]); }
  const area = g.createLinearGradient(0, 0, 0, h); area.addColorStop(0, rgba(col, .25)); area.addColorStop(1, rgba(col, 0));
  g.beginPath(); arr.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))); g.lineTo(X(arr.length - 1), h); g.lineTo(X(0), h); g.closePath(); g.fillStyle = area; g.fill();
  g.strokeStyle = col; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath(); arr.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))); g.stroke();
  const ly = Y(arr[arr.length - 1]); g.fillStyle = col; g.beginPath(); g.arc(X(arr.length - 1), ly, 4, 0, 6.2832); g.fill();
  g.font = '800 11px Nunito, ui-rounded, system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillStyle = '#b9c8e6';
  g.fillText(nf2.format(arr[arr.length - 1]), w - 58, Math.max(10, Math.min(h - 10, ly)));
}

/* ---------- sube o baja ---------- */
let betM = null, betDur = 10;
function betMetal(){ if (!betM || !S.opened[betM]) betM = S.vein && S.opened[S.vein] ? S.vein : 'au'; return betM; }
$('#betSeg').addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (!b || b.disabled) return; betM = b.dataset.m; K.betSeg = ''; updateBet(); });
$$('#betDur button').forEach(b => b.addEventListener('click', () => { betDur = +b.dataset.d; $$('#betDur button').forEach(x => x.classList.toggle('on', x === b)); }));
$$('#betPresets button').forEach(b => b.addEventListener('click', () => { const f = b.dataset.f, v = f === 'max' ? Math.min(betCap(), S.money) : Math.min(betCap(), S.money*+f); $('#betStake').value = Math.max(0, Math.floor(v*100)/100); }));
function doBet(dir){
  const err = $('#betErr'), msg = placeBet(betMetal(), dir, parseFloat($('#betStake').value) || 0, betDur);
  err.hidden = !msg; if (msg) setT(err, msg);
}
$('#betUp').addEventListener('click', () => doBet(1));
$('#betDown').addEventListener('click', () => doBet(-1));
function updateBet(){
  const G = mgState(), b = G.bet, m = b ? b.m : betMetal(), s = mk(m);
  const segKey = m + '|' + Object.keys(S.opened).join() + (b ? 'b' : '');
  if (segKey !== K.betSeg){ K.betSeg = segKey; $('#betSeg').innerHTML = MK.map(x => `<button type="button" data-m="${x}" class="${x === m ? 'on' : ''}"${!S.opened[x] || b ? ' disabled' : ''}>${METALS[x].name}</button>`).join(''); }
  setT($('#betName'), METALS[m].name); setT($('#betPrice'), pfmt(m, s.price));
  const ref = s.hist[Math.max(0, s.hist.length - 11)] || s.price, ch = (s.price/ref - 1)*100, bc = $('#betChg');
  setT(bc, `${ch >= 0 ? '▲' : '▼'} ${nf2.format(Math.abs(ch))} % en 10 s`); bc.className = 'chg ' + (ch >= 0 ? 't-up' : 't-down');
  sparkline($('#betChart'), b ? b.path : s.hist.slice(-60), METALS[m].line, b ? b.entry : null);
  setT($('#betCap'), `Tope: ${money(betCap())} por apuesta · tienes ${money(S.money)}`);
  setT($('#betMeta'), b ? 'Apuesta en juego' : 'Elige metal, cantidad y tiempo');
  $('#betUp').disabled = $('#betDown').disabled = !!b;
  const live = $('#betLive'); live.hidden = !b;
  if (b){
    const d = s.price - b.entry, good = b.dir > 0 ? d > 0 : d < 0;
    live.dataset.state = d === 0 ? '' : good ? 'win' : 'lose';
    live.innerHTML = `<b>${b.dir > 0 ? '▲ Sube' : '▼ Baja'} · ${money(b.stake)}</b><span>Desde ${pfmt(b.m, b.entry)} · ahora ${pfmt(b.m, s.price)}</span><span class="bl-big">${d === 0 ? 'Igual' : good ? `Vas ganando: ${money(b.stake*BET_PAY)}` : 'Vas perdiendo'}</span><span class="bl-t">Quedan ${b.left} s</span><span class="bar"><i style="width:${(b.left/b.dur*100).toFixed(1)}%"></i></span>`;
  }
  const hk = G.bets.map(x => x.t).join();
  if (hk !== K.betHist){ K.betHist = hk; $('#betHist').innerHTML = G.bets.length ? G.bets.map(x => `<li class="${x.pay > x.stake ? 't-up' : x.pay === x.stake ? '' : 't-down'}">${x.dir > 0 ? '▲' : '▼'} ${METALS[x.m].name} · ${money(x.stake)} → ${x.pay > x.stake ? '+' + money(x.pay - x.stake) : x.pay === x.stake ? 'empate' : '−' + money(x.stake)}</li>`).join('') : '<li class="empty">Aún no has apostado.</li>'; }
}
on('betDone', () => { K.betSeg = ''; });

/* ---------- trading (el de siempre, con su propio gráfico) ---------- */
$('#trSeg').addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (!b || b.disabled || !S.opened[b.dataset.m]) return; S.mm = b.dataset.m; K.trSeg = ''; resetHover(); updateTradeView(); });
function updateTradeView(){
  const m = S.mm, key = m + '|' + Object.keys(S.opened).join();
  if (key !== K.trSeg){ K.trSeg = key; $('#trSeg').innerHTML = MK.map(x => `<button type="button" data-m="${x}" class="${x === m ? 'on' : ''}"${!S.opened[x] ? ' disabled' : ''}>${METALS[x].name}</button>`).join(''); }
  setT($('#trName'), METALS[m].name); setT($('#trPriceBig'), pfmt(m, mk(m).price));
  setT($('#trMeta'), S.positions.length ? `${S.positions.length} posición${S.positions.length > 1 ? 'es' : ''} abierta${S.positions.length > 1 ? 's' : ''}` : 'Sin posiciones abiertas');
  sparkline($('#trChart'), mk(m).hist.slice(-120), METALS[m].line);
  updateTrading();
}

/* ================= vagoneta desbocada ================= */
const CV = $('#cartCv'), cg = CV.getContext('2d');
let C = null, cRaf = 0, cW = 0, cH = 0, cLast = 0;
function sizeCanvas(cv){ const r = cv.getBoundingClientRect(); const w = Math.round(r.width), h = Math.round(r.height); if (!w) return [0, 0]; if (cv.width !== Math.round(w*dpr)){ cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); } return [w, h]; }
function overlay(el, html){ el.innerHTML = html; el.hidden = !html; }
function cartReady(){
  stopCart(); C = null;
  const tk = tickets();
  overlay($('#cartOv'), `<div class="ov-card"><span class="ov-ico">${icon('cart')}</span><b>Vagoneta desbocada</b><span>Salta con un toque, <b>espacio</b> o <b>↑</b>. Cada pepita vale unos segundos de producción de tu mina; si llegas a la salida, premio extra.</span>
    ${tk > 0 ? `<button type="button" class="btn btn-gold big" id="cartGo">¡Vamos! (1 ficha · te quedan ${tk})</button>` : '<span class="ov-warn">No te quedan fichas. Vuelve después de medianoche.</span>'}</div>`);
  drawCartIdle();
}
function drawCartIdle(){ [cW, cH] = sizeCanvas(CV); if (!cW) return; cg.setTransform(dpr, 0, 0, dpr, 0, 0); drawCartScene(0, true); }
$('#cartOv').addEventListener('click', e => { if (e.target.id === 'cartGo') startCart(); if (e.target.id === 'cartAgain') cartReady(); });
function startCart(){
  if (!useTicket('cart')){ toast('No te quedan fichas.'); return; }
  [cW, cH] = sizeCanvas(CV); const u = cH/300;
  C = {u, t: -3, dur: 40, dist: 0, v: 300*u, y: 0, vy: 0, air: false, buf: 0, obs: [], nug: [], got: 0, next: 520*u, over: null, overT: 0, parts: [], shake: 0, tilt: 0};
  overlay($('#cartOv'), ''); CV.focus(); sfx('ui');
  cLast = performance.now(); cancelAnimationFrame(cRaf); cRaf = requestAnimationFrame(cartLoop);
}
function stopCart(){ cancelAnimationFrame(cRaf); cRaf = 0; }
function cartJump(){
  if (!C || C.over || C.t < 0) return;
  if (!C.air){ C.vy = 640*C.u; C.air = true; sfx('pop'); } else C.buf = .14;
}
CV.addEventListener('pointerdown', e => { e.preventDefault(); cartJump(); });
document.addEventListener('keydown', e => { if (view !== 'cart' || S.section !== 'minijuegos' || !C) return; if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w'){ e.preventDefault(); cartJump(); } });
function spawnCart(){
  const {u} = C, x0 = C.dist + cW + 60*u, r = Math.random();
  if (r < .5){ const w = (70 + Math.random()*50)*u; C.obs.push({k: 'gap', x: x0, w}); arcNug(x0 + w/2, 110*u); }
  else { const h = (26 + Math.random()*14)*u; C.obs.push({k: 'rock', x: x0, w: 34*u, h}); if (Math.random() < .7) arcNug(x0 + 17*u, h + 70*u); }
  if (Math.random() < .6){ const n = 3, gap = 36*u, sx = x0 + 180*u; for (let i = 0; i < n; i++) C.nug.push({x: sx + i*gap, y: 16*u}); }
  const spacing = C.v*(1.05 + Math.random()*.6) + 120*u;
  C.next = x0 + spacing - cW - 60*u;
}
function arcNug(cx, top){ const {u} = C; [-46, -23, 0, 23, 46].forEach(dx => C.nug.push({x: cx + dx*u, y: 18*u + (top - 18*u)*(1 - (dx/60)**2)})); }
function cartLoop(now){
  const dt = Math.min(.05, (now - cLast)/1000); cLast = now;
  if (!C) return;
  const {u} = C, cx = cW*.22, railY = cH*.76;
  if (!C.over){
    C.t += dt;
    if (C.t >= 0){
      C.v = Math.min(600*u, (300 + C.t*9)*u);
      C.dist += C.v*dt;
      if (C.dist >= C.next) spawnCart();
      // salto
      if (C.air){ C.vy -= 1750*u*dt; C.y += C.vy*dt; if (C.y <= 0){ C.y = 0; C.vy = 0; C.air = false; if (C.buf > 0){ C.buf = 0; cartJump(); } } }
      if (C.buf > 0) C.buf -= dt;
      C.tilt += ((C.air ? -C.vy/(640*u)*.25 : 0) - C.tilt)*Math.min(1, dt*10);
      // choques
      const wx = C.dist + cx;
      for (const o of C.obs){
        if (o.k === 'rock' && wx + 22*u > o.x + 4*u && wx - 22*u < o.x + o.w - 4*u && C.y < o.h - 4*u) { crashCart('¡Contra la roca!'); break; }
        if (o.k === 'gap' && !C.air && wx > o.x + 12*u && wx < o.x + o.w - 12*u){ crashCart('¡Al agujero!'); C.fall = true; break; }
      }
      for (const n of C.nug){ if (!n.got && Math.hypot(n.x - wx, (n.y) - (C.y + 18*u)) < 30*u){ n.got = true; C.got++; sfx('coin'); for (let i = 0; i < 6; i++) C.parts.push({x: n.x - C.dist, y: railY - n.y, vx: (Math.random() - .5)*160, vy: -Math.random()*160, life: .5}); } }
      C.obs = C.obs.filter(o => o.x + o.w > C.dist - 40*u); C.nug = C.nug.filter(n => n.x > C.dist - 40*u);
      if (C.t >= C.dur){ C.over = 'win'; C.overT = 0; sfx('lv'); }
    }
  } else {
    C.overT += dt; if (C.fall) C.y -= 500*u*dt;
    if (C.overT > 1.1 && !C.done){ C.done = true; finishCart(); }
  }
  C.parts.forEach(p => { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 500*dt; p.life -= dt; }); C.parts = C.parts.filter(p => p.life > 0);
  if (C.shake > 0) C.shake = Math.max(0, C.shake - dt*20);
  cg.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCartScene(now/1000, false);
  if (!C.done) cRaf = requestAnimationFrame(cartLoop);
}
function crashCart(msg){ C.over = 'crash'; C.overT = 0; C.msg = msg; C.shake = 8; sfx('boom'); }
function finishCart(){
  const sec = C.got*2 + (C.over === 'win' ? 10 : 0), best = (mgState().best.cart || 0);
  const pay = mgPay('cart', sec, C.got), rec = C.got > best;
  const tk = tickets();
  overlay($('#cartOv'), `<div class="ov-card"><b>${C.over === 'win' ? '¡Llegaste a la salida!' : C.msg}</b>
    <span class="ov-big">${C.got} pepita${C.got === 1 ? '' : 's'}${C.over === 'win' ? ' + premio de salida' : ''}</span>
    <span class="ov-pay">+${money(pay)}</span>${rec ? '<span class="ov-rec">¡Nuevo récord!</span>' : ''}
    <div class="ov-btns">${tk > 0 ? `<button type="button" class="btn btn-gold" id="cartAgain">Otra vez (quedan ${tk})</button>` : '<span class="ov-warn">Sin fichas hasta medianoche</span>'}<button type="button" class="btn btn-plain" data-mg-back>Volver</button></div></div>`);
}
function drawCartScene(t, idle){
  const w = cW, h = cH; if (!w) return;
  const u = h/300, railY = h*.76, dist = C ? C.dist : 0, cx = w*.22;
  const sh = C && C.shake ? (Math.random() - .5)*C.shake : 0;
  cg.save(); cg.clearRect(0, 0, w, h); cg.translate(sh, 0);
  const bg = cg.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#2a1a0e'); bg.addColorStop(.55, '#4a2f1a'); bg.addColorStop(1, '#2a1a0e');
  cg.fillStyle = bg; cg.fillRect(-10, 0, w + 20, h);
  // vetas de fondo
  cg.strokeStyle = 'rgba(255,198,46,.18)'; cg.lineWidth = 3*u;
  for (let i = 0; i < 5; i++){ const ox = ((i*260*u - dist*.3) % (w + 300*u) + w + 300*u) % (w + 300*u) - 150*u; cg.beginPath(); cg.moveTo(ox, h*.2 + i*9*u); cg.quadraticCurveTo(ox + 60*u, h*.12 + i*14*u, ox + 140*u, h*.25 + i*7*u); cg.stroke(); }
  // vigas y farolillos
  const beam = 200*u;
  for (let x = -((dist*.6) % beam); x < w + beam; x += beam){
    cg.fillStyle = '#7a4d26'; cg.strokeStyle = '#2a1a0e'; cg.lineWidth = 2;
    cg.fillRect(x, h*.08, 12*u, railY - h*.08); cg.strokeRect(x, h*.08, 12*u, railY - h*.08);
    cg.fillRect(x - 30*u, h*.06, 72*u, 12*u); cg.strokeRect(x - 30*u, h*.06, 72*u, 12*u);
    const lg = cg.createRadialGradient(x + 40*u, h*.2, 0, x + 40*u, h*.2, 70*u); lg.addColorStop(0, 'rgba(255,200,110,.35)'); lg.addColorStop(1, 'rgba(255,200,110,0)'); cg.fillStyle = lg; cg.fillRect(x - 40*u, h*.2 - 70*u, 160*u, 140*u);
    cg.fillStyle = '#ffe9a8'; cg.beginPath(); cg.arc(x + 40*u, h*.2, 5*u, 0, 6.2832); cg.fill(); cg.stroke();
  }
  // suelo y vía (con agujeros)
  const gaps = C ? C.obs.filter(o => o.k === 'gap') : [];
  cg.fillStyle = '#5b3a1f'; cg.fillRect(-10, railY + 4*u, w + 20, h - railY);
  gaps.forEach(o => { const gx = o.x - dist; cg.fillStyle = '#120a04'; cg.fillRect(gx, railY - 2*u, o.w, h - railY + 4*u); });
  const tieW = 26*u;
  for (let x = -((dist) % tieW); x < w; x += tieW){ const wx = x + dist; if (gaps.some(o => wx > o.x - 4*u && wx < o.x + o.w)) continue; cg.fillStyle = '#6b411c'; cg.fillRect(x, railY + 2*u, 16*u, 6*u); }
  cg.strokeStyle = '#b8c0c9'; cg.lineWidth = 3*u;
  let segs = [[-10, w + 10]];
  gaps.forEach(o => { const a = o.x - dist, b = a + o.w; segs = segs.flatMap(([s, e]) => b <= s || a >= e ? [[s, e]] : [[s, a], [b, e]].filter(([p, q]) => q > p)); });
  segs.forEach(([s, e]) => { cg.beginPath(); cg.moveTo(s, railY); cg.lineTo(e, railY); cg.stroke(); });
  // rocas
  if (C) C.obs.filter(o => o.k === 'rock').forEach(o => {
    const x = o.x - dist, y = railY;
    cg.fillStyle = '#8d8490'; cg.strokeStyle = '#2a1a0e'; cg.lineWidth = 2.2;
    cg.beginPath(); cg.moveTo(x, y); cg.lineTo(x + 4*u, y - o.h*.7); cg.lineTo(x + o.w*.4, y - o.h); cg.lineTo(x + o.w*.8, y - o.h*.8); cg.lineTo(x + o.w, y); cg.closePath(); cg.fill(); cg.stroke();
    cg.fillStyle = 'rgba(255,255,255,.25)'; cg.beginPath(); cg.arc(x + o.w*.4, y - o.h*.7, 3*u, 0, 6.2832); cg.fill();
  });
  // pepitas
  if (C) C.nug.forEach(n => { if (n.got) return; nuggetSprite(cg, n.x - dist, railY - n.y, u*.7, '#ffc62e', '#fff3b0', t); });
  // la vagoneta con su pasajero
  const cy = railY - (C ? C.y : 0);
  cg.save(); cg.translate(cx, cy); cg.rotate(C ? C.tilt : 0);
  miner(cg, -2*u, -18*u, 1.5*u, {pose: 'idle', t, seed: 1, hat: '#ff5b4f', suit: '#3b7dd8'});
  cart(cg, 0, 0, 2.4*u, '#ffc62e', C ? Math.min(1, .2 + C.got*.05) : .3);
  cg.restore();
  if (C && !C.air && C.t > 0 && !C.over && Math.random() < .5) C.parts.push({x: cx - 20*u, y: railY - 2*u, vx: -120 - Math.random()*80, vy: -40*Math.random(), life: .25, spark: true});
  if (C) C.parts.forEach(p => { cg.fillStyle = p.spark ? `rgba(255,220,120,${p.life*4})` : `rgba(255,198,46,${p.life*2})`; cg.fillRect(p.x, p.y, 3*u, 3*u); });
  // marcador
  if (C && !idle){
    cg.font = `400 ${Math.round(20*u)}px "Lilita One", sans-serif`; cg.textBaseline = 'top'; cg.textAlign = 'left'; cg.lineWidth = 4; cg.strokeStyle = '#2a1a0e'; cg.fillStyle = '#fff';
    const left = Math.max(0, Math.ceil(C.dur - Math.max(0, C.t)));
    const s1 = `Pepitas: ${C.got}`, s2 = `${left} s`;
    cg.strokeText(s1, 12, 10); cg.fillText(s1, 12, 10); cg.textAlign = 'right'; cg.strokeText(s2, w - 12, 10); cg.fillText(s2, w - 12, 10);
    if (C.t < 0){ const n = Math.ceil(-C.t); cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.font = `400 ${Math.round(64*u)}px "Lilita One", sans-serif`; cg.strokeText(String(n), w/2, h*.4); cg.fillStyle = '#ffc62e'; cg.fillText(String(n), w/2, h*.4); }
    if (C.over){ cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.font = `400 ${Math.round(40*u)}px "Lilita One", sans-serif`; const m = C.over === 'win' ? '¡Salida!' : C.msg; cg.strokeText(m, w/2, h*.38); cg.fillStyle = C.over === 'win' ? '#5fe08a' : '#ff7d72'; cg.fillText(m, w/2, h*.38); }
  }
  cg.restore();
}

/* ================= voladura ================= */
const BV = $('#blastCv'), bg2 = BV.getContext('2d');
let B = null, bRaf = 0, bW = 0, bH = 0, bLast = 0;
/* Tres dificultades: más cargas, aguja más rápida, zona más estrecha (y que se mueve). Cada una guarda su récord. */
const BLAST_MODES = {
  normal:  {name: 'Normal',  n: 5,  sp: [.75, .22],  w: [.13, .017, .05],  good: .12, drift: [99, 0],   lives: 0, col: 'var(--green)', txt: '5 cargas. Para calentar.'},
  dificil: {name: 'Difícil', n: 8,  sp: [1.0, .15],  w: [.11, .01, .045],  good: .09, drift: [3, .10],  lives: 0, col: 'var(--gold)',  txt: '8 cargas más rápidas. La zona verde se mueve.'},
  experto: {name: 'Experto', n: 12, sp: [1.25, .12], w: [.09, .006, .035], good: .07, drift: [1, .16],  lives: 3, col: 'var(--red)',   txt: '12 cargas a toda velocidad. Al tercer fallo, se acabó.'},
};
const BLAST_PAY = 8;   // segundos de producción por punto
const bestKey = m => m === 'normal' ? 'blast' : 'blast_' + m;
function modeCards(tk){
  const G = mgState(), cur = G.bmode || 'normal';
  return `<div class="bm-list">${Object.entries(BLAST_MODES).map(([k, M]) => {
    const best = G.best[bestKey(k)];
    return `<button type="button" class="bm${k === cur ? ' on' : ''}" data-bmode="${k}" style="--bc:${M.col}"${tk > 0 ? '' : ' disabled'}><b>${M.name}</b><span>${M.txt}</span><small>${best ? `Récord: ${nf2.format(best)} pts` : 'Sin récord'}</small></button>`;
  }).join('')}</div>`;
}
function blastReady(){
  stopBlast(); B = null; $('#blastBtn').disabled = true;
  const tk = tickets();
  overlay($('#blastOv'), `<div class="ov-card wide"><b>Elige la voladura</b><span class="ov-sub">Detona cuando la aguja esté en la zona <b>verde</b>. Cuantas más cargas, más puedes ganar.</span>
    ${modeCards(tk)}
    ${tk > 0 ? `<span class="fine">Cada partida gasta 1 ficha · te quedan ${tk}</span>` : '<span class="ov-warn">No te quedan fichas. Vuelve después de medianoche.</span>'}</div>`);
  [bW, bH] = sizeCanvas(BV); if (bW){ bg2.setTransform(dpr, 0, 0, dpr, 0, 0); drawBlast(0); }
}
$('#blastOv').addEventListener('click', e => {
  const m = e.target.closest('[data-bmode]'); if (m && !m.disabled){ mgState().bmode = m.dataset.bmode; startBlast(); return; }
  if (e.target.id === 'blastAgain') startBlast();
  if (e.target.id === 'blastModes') blastReady();
});
function newZone(i){ const M = B.M; return {c0: .2 + Math.random()*.6, c: 0, w: Math.max(M.w[2], M.w[0] - i*M.w[1]), ph: Math.random()*6.28, amp: i >= M.drift[0] ? M.drift[1] : 0}; }
function startBlast(){
  if (!useTicket('blast')){ toast('No te quedan fichas.'); return; }
  const mode = mgState().bmode || 'normal', M = BLAST_MODES[mode];
  [bW, bH] = sizeCanvas(BV);
  B = {mode, M, i: 0, n: 0, dir: 1, speed: M.sp[0], zone: null, res: [], streak: 0, pts: 0, fails: 0, anim: 0, parts: [], shake: 0, flash: 0, label: '', over: false, t: 0};
  B.zone = newZone(0); B.zone.c = B.zone.c0;
  overlay($('#blastOv'), ''); $('#blastBtn').disabled = false; $('#blastBtn').focus(); sfx('ui');
  bLast = performance.now(); cancelAnimationFrame(bRaf); bRaf = requestAnimationFrame(blastLoop);
}
function stopBlast(){ cancelAnimationFrame(bRaf); bRaf = 0; }
function detonate(){
  if (!B || B.over || B.anim > 0) return;
  const d = Math.abs(B.n - B.zone.c), half = B.zone.w/2;
  let kind, pts = 0;
  if (d <= half){ kind = 'perfect'; pts = Math.min(2, 1 + .25*B.streak); B.streak++; }
  else if (d <= half + B.M.good){ kind = 'good'; pts = .5; B.streak = 0; }
  else { kind = 'fail'; B.streak = 0; B.fails++; }
  B.pts += pts; B.res.push(kind); B.anim = 1;
  B.label = kind === 'perfect' ? (B.streak > 1 ? `¡Perfecta! Combo ×${nf2.format(Math.min(2, 1 + .25*(B.streak - 1)))}` : '¡Perfecta!') : kind === 'good' ? 'Buena' : B.M.lives && B.fails >= B.M.lives ? '¡Derrumbe!' : '¡Fallida!';
  const u = bH/300, cx = bW*.5, cy = bH*.38, big = kind === 'perfect' ? 1 : kind === 'good' ? .6 : .25;
  if (kind !== 'fail'){ B.flash = big; B.shake = 10*big; for (let i = 0; i < 40*big; i++){ const a = Math.random()*6.2832, v = (120 + Math.random()*320)*u; B.parts.push({x: cx, y: cy, vx: Math.cos(a)*v, vy: Math.sin(a)*v - 120*u, life: .8 + Math.random()*.6, k: Math.random() < .35 ? 'ore' : 'rock', s: (3 + Math.random()*6)*u}); } sfx('boom'); }
  else { B.shake = 4; for (let i = 0; i < 12; i++) B.parts.push({x: cx, y: cy, vx: (Math.random() - .5)*100*u, vy: -Math.random()*80*u, life: 1, k: 'smoke', s: 10*u}); sfx('bad'); }
}
$('#blastBtn').addEventListener('click', detonate);
BV.addEventListener('pointerdown', e => { e.preventDefault(); detonate(); });
document.addEventListener('keydown', e => { if (view !== 'blast' || S.section !== 'minijuegos' || !B) return; if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); detonate(); } });
function blastLoop(now){
  const dt = Math.min(.05, (now - bLast)/1000); bLast = now;
  if (!B) return;
  if (B.anim > 0){
    B.anim -= dt*1.1;
    if (B.anim <= 0){
      B.anim = 0; B.i++;
      if (B.i >= B.M.n || (B.M.lives && B.fails >= B.M.lives)){ B.over = true; $('#blastBtn').disabled = true; finishBlast(); }
      else { B.zone = newZone(B.i); B.speed = B.M.sp[0] + B.i*B.M.sp[1]; B.label = ''; }
    }
  } else if (!B.over){
    B.t += dt; const z = B.zone; z.c = Math.max(z.w/2 + .02, Math.min(1 - z.w/2 - .02, z.c0 + z.amp*Math.sin(B.t*1.7 + z.ph)));
    B.n += B.dir*B.speed*dt; if (B.n > 1){ B.n = 2 - B.n; B.dir = -1; } if (B.n < 0){ B.n = -B.n; B.dir = 1; }
  }
  B.parts.forEach(p => { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += (p.k === 'smoke' ? -20 : 700)*dt; p.life -= dt; }); B.parts = B.parts.filter(p => p.life > 0);
  if (B.shake > 0) B.shake = Math.max(0, B.shake - dt*25); if (B.flash > 0) B.flash = Math.max(0, B.flash - dt*2.5);
  bg2.setTransform(dpr, 0, 0, dpr, 0, 0); drawBlast(now/1000);
  if (!B.over || B.parts.length) bRaf = requestAnimationFrame(blastLoop);
}
function finishBlast(){
  const key = bestKey(B.mode), best = mgState().best[key] || 0, score = Math.round(B.pts*100)/100;
  const pay = B.pts > 0 ? mgPay(key, B.pts*BLAST_PAY, score) : 0, rec = score > best;
  const tk = tickets(), per = B.res.filter(r => r === 'perfect').length, all = per === B.M.n;
  const title = all ? '¡Todas perfectas!' : B.M.lives && B.fails >= B.M.lives ? '¡Derrumbe! Se acabó la voladura' : B.pts >= B.M.n*.6 ? '¡Buena voladura!' : 'Voladura terminada';
  overlay($('#blastOv'), `<div class="ov-card"><span class="bm-tag" style="--bc:${B.M.col}">${B.M.name}</span><b>${title}</b>
    <span class="ov-big bm-res">${B.res.map(r => r === 'perfect' ? '★' : r === 'good' ? '✔' : '✖').join(' ')}</span><span>${nf2.format(B.pts)} puntos · ${per} perfecta${per === 1 ? '' : 's'} de ${B.M.n}</span>
    ${pay ? `<span class="ov-pay">+${money(pay)}</span>` : '<span class="ov-warn">Sin premio esta vez</span>'}${rec ? '<span class="ov-rec">¡Nuevo récord!</span>' : ''}
    <div class="ov-btns">${tk > 0 ? `<button type="button" class="btn btn-red" id="blastAgain">Otra vez (quedan ${tk})</button><button type="button" class="btn btn-gold" id="blastModes">Cambiar dificultad</button>` : '<span class="ov-warn">Sin fichas hasta medianoche</span>'}<button type="button" class="btn btn-plain" data-mg-back>Volver</button></div></div>`);
}
function drawBlast(t){
  const w = bW, h = bH; if (!w) return;
  const u = h/300, sh = B && B.shake ? (Math.random() - .5)*B.shake : 0;
  bg2.save(); bg2.clearRect(0, 0, w, h); bg2.translate(sh, sh*.5);
  // pared de roca
  const bgc = bg2.createLinearGradient(0, 0, 0, h); bgc.addColorStop(0, '#6f6a78'); bgc.addColorStop(1, '#3f3a48');
  bg2.fillStyle = bgc; bg2.fillRect(-10, -10, w + 20, h + 20);
  const rr = mulberry32(7);
  for (let i = 0; i < 26; i++){ const x = rr()*w, y = rr()*h*.62, r = (10 + rr()*28)*u; bg2.fillStyle = `rgba(0,0,0,${.08 + rr()*.1})`; bg2.beginPath(); bg2.arc(x, y, r, 0, 6.2832); bg2.fill(); }
  bg2.strokeStyle = 'rgba(255,198,46,.55)'; bg2.lineWidth = 5*u; bg2.beginPath(); bg2.moveTo(0, h*.3); bg2.bezierCurveTo(w*.3, h*.18, w*.6, h*.5, w, h*.28); bg2.stroke();
  // cartuchos de dinamita
  const cx = w*.5, cy = h*.38;
  if (!B || B.anim <= 0 || B.anim > .95){
    for (let k = -1; k <= 1; k++){ bg2.fillStyle = '#ff5b4f'; bg2.strokeStyle = '#2a1a0e'; bg2.lineWidth = 2; bg2.beginPath(); bg2.roundRect(cx + k*16*u - 7*u, cy - 26*u, 14*u, 44*u, 4*u); bg2.fill(); bg2.stroke(); }
    bg2.strokeStyle = '#2a1a0e'; bg2.lineWidth = 2; bg2.beginPath(); bg2.moveTo(cx, cy - 26*u); bg2.quadraticCurveTo(cx + 20*u, cy - 50*u, cx + 36*u, cy - 44*u); bg2.stroke();
    if (B && !B.over){ const f = .5 + .5*Math.sin(t*30); bg2.fillStyle = `rgba(255,${180 + 60*f},60,1)`; bg2.beginPath(); bg2.arc(cx + 36*u, cy - 44*u, (4 + 3*f)*u, 0, 6.2832); bg2.fill(); }
  }
  // partículas
  if (B) B.parts.forEach(p => {
    if (p.k === 'smoke'){ bg2.fillStyle = `rgba(200,200,210,${p.life*.5})`; bg2.beginPath(); bg2.arc(p.x, p.y, p.s*(1.5 - p.life), 0, 6.2832); bg2.fill(); return; }
    bg2.fillStyle = p.k === 'ore' ? '#ffc62e' : '#8d8490'; bg2.strokeStyle = '#2a1a0e'; bg2.lineWidth = 1; bg2.beginPath(); bg2.rect(p.x, p.y, p.s, p.s); bg2.fill(); bg2.stroke();
  });
  if (B && B.flash > 0){ bg2.fillStyle = `rgba(255,240,200,${B.flash*.7})`; bg2.fillRect(-10, -10, w + 20, h + 20); }
  // medidor
  const gx = w*.08, gw = w*.84, gy = h*.74, gh = 26*u;
  bg2.fillStyle = '#2a1a0e'; bg2.beginPath(); bg2.roundRect(gx - 5*u, gy - 5*u, gw + 10*u, gh + 10*u, 10*u); bg2.fill();
  bg2.fillStyle = '#ff5b4f'; bg2.fillRect(gx, gy, gw, gh);
  if (B){
    const z = B.zone, yl = Math.max(0, z.c - z.w/2 - B.M.good), yr = Math.min(1, z.c + z.w/2 + B.M.good);
    bg2.fillStyle = '#ffc62e'; bg2.fillRect(gx + yl*gw, gy, (yr - yl)*gw, gh);
    bg2.fillStyle = '#3fcf6c'; bg2.fillRect(gx + (z.c - z.w/2)*gw, gy, z.w*gw, gh);
    const nx = gx + B.n*gw;
    bg2.fillStyle = '#fff'; bg2.strokeStyle = '#2a1a0e'; bg2.lineWidth = 2.5;
    bg2.beginPath(); bg2.moveTo(nx, gy - 2*u); bg2.lineTo(nx - 10*u, gy - 18*u); bg2.lineTo(nx + 10*u, gy - 18*u); bg2.closePath(); bg2.fill(); bg2.stroke();
    bg2.fillRect(nx - 2*u, gy, 4*u, gh);
  }
  // marcador
  bg2.font = `400 ${Math.round(20*u)}px "Lilita One", sans-serif`; bg2.lineWidth = 4; bg2.strokeStyle = '#2a1a0e'; bg2.fillStyle = '#fff'; bg2.textBaseline = 'top';
  if (B){
    bg2.textAlign = 'left'; const s1 = `${B.M.name} · carga ${Math.min(B.M.n, B.i + 1)}/${B.M.n}`; bg2.strokeText(s1, 12, 10); bg2.fillText(s1, 12, 10);
    if (B.M.lives){ const left = Math.max(0, B.M.lives - B.fails); bg2.font = `400 ${Math.round(18*u)}px "Lilita One", sans-serif`; const s3 = '♥'.repeat(left) + '♡'.repeat(B.M.lives - left); bg2.strokeText(s3, 12, 36*u); bg2.fillStyle = '#ff7d72'; bg2.fillText(s3, 12, 36*u); bg2.fillStyle = '#fff'; bg2.font = `400 ${Math.round(20*u)}px "Lilita One", sans-serif`; }
    bg2.textAlign = 'right'; const s2 = `${nf2.format(B.pts)} pts`; bg2.strokeText(s2, w - 12, 10); bg2.fillText(s2, w - 12, 10);
    if (B.label){ bg2.textAlign = 'center'; bg2.textBaseline = 'middle'; bg2.font = `400 ${Math.round(34*u)}px "Lilita One", sans-serif`; bg2.strokeText(B.label, w/2, h*.16); bg2.fillStyle = B.label.startsWith('¡Fall') ? '#ff7d72' : B.label.startsWith('Buena') ? '#ffe27a' : '#5fe08a'; bg2.fillText(B.label, w/2, h*.16); }
  }
  bg2.restore();
}
addEventListener('resize', () => { if (view === 'cart' && !cRaf) drawCartIdle(); if (view === 'blast' && !bRaf){ [bW, bH] = sizeCanvas(BV); if (bW){ bg2.setTransform(dpr, 0, 0, dpr, 0, 0); drawBlast(0); } } });
