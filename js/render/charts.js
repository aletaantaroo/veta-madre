import { drawChart, on, updateUI } from '../core/bus.js';
import { $, $$, dpr } from '../core/dom.js';
import { clamp, fmtT, nf0, nf2, pfmt, plab, rgba, weight } from '../core/format.js';
import { METALS, NSLOTS, TPC } from '../data/content.js';
import { S, has, mk } from '../game/state.js';

/* ================= gráficos ================= */
const chart = $('#chart'), cctx = chart.getContext('2d');
let CW=0, CH=0, tf='tick', hoverI=null;
export function resetHover(){ hoverI = null; }
export function resizeChart(){
  const r = chart.getBoundingClientRect(); CW = r.width; CH = r.height;
  if (!CW) return;
  chart.width = Math.round(CW*dpr); chart.height = Math.round(CH*dpr); drawChart();
}
function seriesData(){
  const s = mk(S.mm);
  if (tf === 'tick') return s.hist.map(v => ({o:v,h:v,l:v,c:v}));
  const a = s.candles.slice(); if (s.cur) a.push({o:s.cur.o, h:s.cur.h, l:s.cur.l, c:s.cur.c});
  return a.slice(-NSLOTS);
}
function sma(a,p){ const o=[]; let s=0; for (let i=0;i<a.length;i++){ s+=a[i]; if (i>=p) s-=a[i-p]; o.push(i>=p-1 ? s/p : null); } return o; }
function boll(a,p,k){
  const m = sma(a,p), up=[], dn=[];
  for (let i=0;i<a.length;i++){
    if (m[i]==null){ up.push(null); dn.push(null); continue; }
    let v=0; for (let j=i-p+1;j<=i;j++) v += (a[j]-m[i])**2; const sd = Math.sqrt(v/p);
    up.push(m[i]+k*sd); dn.push(m[i]-k*sd);
  }
  return {up, dn};
}
function rsi(a,p){
  const o = new Array(a.length).fill(null); if (a.length <= p) return o;
  let g=0,l=0;
  for (let i=1;i<=p;i++){ const d=a[i]-a[i-1]; if (d>0) g+=d; else l-=d; }
  g/=p; l/=p; o[p] = l===0 ? 100 : 100 - 100/(1+g/l);
  for (let i=p+1;i<a.length;i++){ const d=a[i]-a[i-1]; g=(g*(p-1)+Math.max(d,0))/p; l=(l*(p-1)+Math.max(-d,0))/p; o[i] = l===0 ? 100 : 100 - 100/(1+g/l); }
  return o;
}
function renderChart(){
  if (!CW || !S || S.section !== 'mercado') return;
  const m = S.mm, M = METALS[m], s = mk(m);
  const g = cctx; g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,CW,CH);
  const data = seriesData(), n = data.length; if (n < 2) return;
  const closes = data.map(d => d.c);
  const rsiOn = has('u_rsi') && S.ind.rsi, rsiH = rsiOn ? 72 : 0, mainH = CH - rsiH;
  const smv = has('u_analista') && S.ind.sma ? sma(closes,20) : null, bb = has('u_bollinger') && S.ind.boll ? boll(closes,20,2) : null;
  let lo = Math.min(...data.map(d=>d.l)), hi = Math.max(...data.map(d=>d.h));
  if (bb){ bb.up.forEach(v => { if (v!=null) hi = Math.max(hi,v); }); bb.dn.forEach(v => { if (v!=null) lo = Math.min(lo,v); }); }
  const pad = Math.max((hi-lo)*0.12, hi*0.004); lo -= pad; hi += pad;
  const padR = 66, padT = 8, padB = 8, pw = CW - padR;
  const X = i => (i + (NSLOTS - n) + 0.5)/NSLOTS*pw;
  const Y = v => padT + (hi - v)/(hi - lo)*(mainH - padT - padB);
  const inR = v => v >= lo && v <= hi;
  g.font = '800 11px Nunito, ui-rounded, system-ui, sans-serif'; g.textBaseline = 'middle';
  const ly0 = clamp(Y(s.price), 10, mainH-10);
  [.15,.5,.85].forEach(f => {
    const v = lo + (hi-lo)*f, y = Y(v);
    g.strokeStyle = 'rgba(160,190,255,.12)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0,y); g.lineTo(pw,y); g.stroke();
    if (Math.abs(y - ly0) > 16){ g.fillStyle = '#8ea3cc'; g.textAlign='left'; g.fillText(plab(m,v), pw+8, y); }
  });
  const path = arr => { g.beginPath(); let st=false; arr.forEach((v,i)=>{ if (v==null) return; if (st) g.lineTo(X(i),Y(v)); else { g.moveTo(X(i),Y(v)); st=true; } }); };
  if (bb){
    g.beginPath(); let st=false;
    bb.up.forEach((v,i)=>{ if (v==null) return; if (st) g.lineTo(X(i),Y(v)); else { g.moveTo(X(i),Y(v)); st=true; } });
    for (let i=n-1;i>=0;i--) if (bb.dn[i]!=null) g.lineTo(X(i),Y(bb.dn[i]));
    g.closePath(); g.fillStyle = 'rgba(149,163,157,.08)'; g.fill();
    g.strokeStyle = 'rgba(149,163,157,.45)'; g.lineWidth = 1; path(bb.up); g.stroke(); path(bb.dn); g.stroke();
  }
  if (tf === 'tick'){
    const area = g.createLinearGradient(0,padT,0,mainH);
    area.addColorStop(0, rgba(M.line,.26)); area.addColorStop(1, rgba(M.line,0));
    path(closes); g.lineTo(X(n-1), mainH); g.lineTo(X(0), mainH); g.closePath(); g.fillStyle = area; g.fill();
    g.strokeStyle = M.line; g.lineWidth = 1.75; g.lineJoin = 'round'; path(closes); g.stroke();
  } else {
    const bw = Math.max(1.5, pw/NSLOTS*0.62);
    data.forEach((d,i) => {
      const col = d.c >= d.o ? '#5fe08a' : '#ff7d72', x = X(i);
      g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(x, Y(d.h)); g.lineTo(x, Y(d.l)); g.stroke();
      const y1 = Y(Math.max(d.o,d.c)), y2 = Y(Math.min(d.o,d.c));
      g.fillStyle = col; g.fillRect(x - bw/2, y1, bw, Math.max(1, y2-y1));
    });
  }
  if (smv){ g.strokeStyle = '#8fb8c9'; g.lineWidth = 1.5; path(smv); g.stroke(); }
  const level = (v, col, dash, label) => {
    if (!inR(v)) return;
    const y = Y(v); g.setLineDash(dash); g.strokeStyle = col; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0,y); g.lineTo(pw,y); g.stroke(); g.setLineDash([]);
    g.textAlign = 'left'; const w = g.measureText(label).width + 8;
    g.fillStyle = 'rgba(10,16,34,.92)'; g.fillRect(4, y-8, w, 16);
    g.fillStyle = col; g.fillText(label, 8, y);
  };
  S.positions.filter(p => p.m === m).forEach(p => {
    const col = p.dir > 0 ? '#5fe08a' : '#ff7d72';
    level(p.entry, col, [6,4], `${p.dir>0?'Largo':'Corto'} ${weight(p.g)}`);
    if (p.sl) level(p.sl, '#ff7d72', [2,3], 'SL');
    if (p.tp) level(p.tp, '#5fe08a', [2,3], 'TP');
  });
  S.orders.filter(o => o.m === m).forEach(o => level(o.target, M.line, [2,3], `Orden ${o.kind==='above'?'≥':'≤'} ${plab(m,o.target)}`));
  if (tf === 'tick'){
    const ex = X(n-1), ey = Y(s.price);
    g.fillStyle = rgba(M.line,.25); g.beginPath(); g.arc(ex,ey,7,0,6.283); g.fill();
    g.fillStyle = M.line; g.beginPath(); g.arc(ex,ey,3.5,0,6.283); g.fill();
  }
  g.textAlign = 'left'; g.fillStyle = M.line; g.fillRect(pw+2, ly0-9, padR-2, 18);
  g.fillStyle = M.ink; g.fillText(plab(m, s.price), pw+7, ly0);
  if (rsiOn){
    const r = rsi(closes,14), top = mainH + 10, h = rsiH - 16, RY = v => top + (100 - v)/100*h;
    g.fillStyle = 'rgba(185,163,218,.07)'; g.fillRect(0, RY(70), pw, RY(30)-RY(70));
    g.strokeStyle = 'rgba(149,163,157,.25)'; g.setLineDash([3,3]);
    [30,70].forEach(v => { g.beginPath(); g.moveTo(0,RY(v)); g.lineTo(pw,RY(v)); g.stroke(); });
    g.setLineDash([]);
    g.fillStyle = '#8ea3cc'; g.fillText('70', pw+8, RY(70)); g.fillText('30', pw+8, RY(30));
    g.strokeStyle = '#b9a3da'; g.lineWidth = 1.4;
    g.beginPath(); let st=false; r.forEach((v,i)=>{ if (v==null) return; if (st) g.lineTo(X(i),RY(v)); else { g.moveTo(X(i),RY(v)); st=true; } }); g.stroke();
    const last = r[r.length-1];
    g.fillStyle = '#b9a3da'; g.fillText(`RSI ${last==null?'—':nf0.format(last)}`, 6, top + 6);
    g.strokeStyle = 'rgba(160,190,255,.2)'; g.beginPath(); g.moveTo(0, mainH+2); g.lineTo(CW, mainH+2); g.stroke();
  }
  const tip = $('#tip');
  if (hoverI != null && hoverI >= 0 && hoverI < n){
    const x = X(hoverI), d = data[hoverI];
    g.strokeStyle = 'rgba(231,228,215,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, CH); g.stroke();
    const age = (n-1-hoverI)*(tf==='tick' ? 1 : TPC);
    tip.textContent = (age ? `hace ${fmtT(age)} · ` : 'ahora · ') + (tf==='tick' ? pfmt(m, d.c) : `A ${plab(m,d.o)} · Máx ${plab(m,d.h)} · Mín ${plab(m,d.l)} · C ${plab(m,d.c)}`);
    tip.hidden = false;
  } else tip.hidden = true;
}
function chartHover(e){
  const r = chart.getBoundingClientRect(), x = e.clientX - r.left, pw = CW - 66, n = seriesData().length;
  hoverI = x > pw ? null : Math.floor(x/pw*NSLOTS) - (NSLOTS - n);
  drawChart();
}
chart.addEventListener('pointermove', chartHover);
chart.addEventListener('pointerdown', chartHover);
chart.addEventListener('pointerleave', () => { hoverI = null; drawChart(); });
$$('#tfSeg button').forEach(b => b.addEventListener('click', () => {
  tf = b.dataset.tf; $$('#tfSeg button').forEach(x => x.classList.toggle('on', x === b));
  $('#tfLabel').textContent = tf === 'tick' ? 'Cada punto es 1 segundo' : 'Cada vela son 10 segundos';
  drawChart();
}));
$$('.ind').forEach(b => b.addEventListener('click', () => { S.ind[b.dataset.k] = !S.ind[b.dataset.k]; drawChart(); updateUI(); }));

export function fitCanvas(c){
  const r = c.getBoundingClientRect(); if (!r.width) return null;
  const w = Math.round(r.width*dpr), h = Math.round(r.height*dpr);
  if (c.width !== w || c.height !== h){ c.width = w; c.height = h; }
  const g = c.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,r.width,r.height);
  return {g, w:r.width, h:r.height};
}
export function drawLine(c, arr, col, labels){
  const f = fitCanvas(c); if (!f || arr.length < 2) return;
  const {g, w, h} = f, padR = labels ? 60 : 0, pw = w - padR;
  let lo = Math.min(...arr), hi = Math.max(...arr); const pad = Math.max((hi-lo)*.12, hi*.002); lo -= pad; hi += pad;
  const X = i => (i + (NSLOTS - arr.length) + .5)/NSLOTS*pw, Y = v => 4 + (hi - v)/(hi - lo)*(h - 8);
  if (labels){
    g.font = '800 11px Nunito, ui-rounded, system-ui, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
    [.15,.5,.85].forEach(k => { const v = lo + (hi-lo)*k, y = Y(v); g.strokeStyle = 'rgba(160,190,255,.12)'; g.beginPath(); g.moveTo(0,y); g.lineTo(pw,y); g.stroke(); g.fillStyle = '#8ea3cc'; g.fillText(nf2.format(v), pw+8, y); });
    const area = g.createLinearGradient(0,0,0,h); area.addColorStop(0, rgba(col,.22)); area.addColorStop(1, rgba(col,0));
    g.beginPath(); arr.forEach((v,i)=> i ? g.lineTo(X(i),Y(v)) : g.moveTo(X(i),Y(v))); g.lineTo(X(arr.length-1),h); g.lineTo(X(0),h); g.closePath(); g.fillStyle = area; g.fill();
  }
  g.strokeStyle = col; g.lineWidth = labels ? 1.75 : 1.3; g.lineJoin = 'round';
  g.beginPath(); arr.forEach((v,i)=> i ? g.lineTo(X(i),Y(v)) : g.moveTo(X(i),Y(v))); g.stroke();
  if (labels){ const y = clamp(Y(arr[arr.length-1]), 10, h-10); g.fillStyle = col; g.fillRect(pw+2, y-9, padR-2, 18); g.fillStyle = '#10181a'; g.fillText(nf2.format(arr[arr.length-1]), pw+7, y); }
}
on('chart', renderChart);
