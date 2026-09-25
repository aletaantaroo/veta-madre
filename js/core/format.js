/* ================= formato ================= */
const nf = d => new Intl.NumberFormat('es-ES', {minimumFractionDigits:d, maximumFractionDigits:d});
export const nf0 = nf(0), nf1 = nf(1), nf2 = nf(2), nf3 = nf(3);
export function money(v){
  const a = Math.abs(v);
  if (a < 100) return nf2.format(v) + ' €';
  if (a < 1e4) return nf0.format(v) + ' €';
  if (a < 1e6) return nf1.format(v/1e3) + ' mil €';
  if (a < 1e9) return nf2.format(v/1e6) + ' M€';
  if (a < 1e12) return nf2.format(v/1e9) + ' mil M€';
  return nf2.format(v/1e12) + ' B€';
}
export const smoney = v => (v >= 0 ? '+' : '−') + money(Math.abs(v));
export function weight(g){
  const a = Math.abs(g);
  if (a < 1){ const mg = g*1000; return (mg < 10 ? nf1.format(mg) : nf0.format(mg)) + ' mg'; }
  if (a < 1000) return (a < 10 ? nf2.format(g) : a < 100 ? nf1.format(g) : nf0.format(g)) + ' g';
  if (a < 1e6) return nf2.format(g/1000) + ' kg';
  return nf2.format(g/1e6) + ' t';
}
export const unitOf = m => m === 'cu' ? '€/kg' : '€/g';
export const toUnit = (m,p) => m === 'cu' ? p*1000 : p;
export const fromUnit = (m,v) => m === 'cu' ? v/1000 : v;
export const plab = (m,p) => m === 'ag' ? nf3.format(p) : nf2.format(toUnit(m,p));
export const pfmt = (m,p) => plab(m,p) + ' ' + unitOf(m);
export const fmtHMS = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s/3600), m = Math.floor(s%3600/60), x = s%60; return (h ? h + ':' + String(m).padStart(2,'0') : m) + ':' + String(x).padStart(2,'0'); };
/* Minutos legibles: «45 s», «3,3 min», «1 h 12 min». */
export const fmtMin = m => !isFinite(m) ? '—' : m < 1 ? `${nf0.format(m*60)} s` : m < 60 ? `${nf1.format(m)} min` : `${Math.floor(m/60)} h ${Math.round(m % 60)} min`;
export const fmtT = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
export const clock = t => new Date(t).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
export const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
export const rnd = (a,b) => a + Math.random()*(b-a);
export const pick = a => a[Math.floor(Math.random()*a.length)];
export function niceRound(v){ if (v <= 0) return 0; const e = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v/e)*e; }
export function gauss(){ let u=0,v=0; while(!u) u=Math.random(); while(!v) v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function rgba(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
