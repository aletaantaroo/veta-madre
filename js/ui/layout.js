import { K, drawChart, emit, on, queueTut, selectDesk, sfx, showSection, toast, updateUI } from '../core/bus.js';
import { $, $$, setT } from '../core/dom.js';
import { clamp, money, nf0, smoney, weight } from '../core/format.js';
import { METALS, MK } from '../data/content.js';
import { estRates, gameMin, hhmm, isDay } from '../game/economy.js';
import { health } from '../game/health.js';
import { dig } from '../game/mining.js';
import { S, cap, findCount, legAvail, lvReq, posPnl, unl, xpNeed } from '../game/state.js';
import { resizeChart } from '../render/charts.js';
import { updateAch } from './achievements.js';
import { updateBiz } from './biz.js';
import { updateFin } from './finance.js';
import { icon } from './icons.js';
import { updateMarket } from './market.js';
import { closeMenu, menuOpen, menuTab, openMenu, updateMenuHome } from './menu.js';
import { pressDig, updateMine } from './mine.js';
import { updateMinigames } from './minigames.js';
import { updateMuseo } from './museum.js';
import { updateTree } from './skills.js';
import { updateStocks } from './stocks.js';
import { showNextTut, tutCur, tutQ } from './tutorial.js';

/* ================= interfaz: HUD, dock y ventanas ================= */
const SECTIONS = ['mina', 'mercado', 'finanzas', 'empresas', 'bolsa', 'minijuegos', 'habilidades', 'museo', 'logros'];

/* Qué desbloquea cada sección del dock. La mina siempre está; el museo, en cuanto tienes un hallazgo. */
const SEC_KEY = {mercado: 'mercado', finanzas: 'finanzas', empresas: 'biz', bolsa: 'stocks', minijuegos: 'minigames', habilidades: 'habilidades', logros: 'logros'};
export function secOpen(k){ return k === 'mina' || (k === 'museo' ? findCount() > 0 : unl(SEC_KEY[k])); }
function nextLocked(){
  let best = null;
  Object.entries(SEC_KEY).forEach(([sec, key]) => { if (!unl(key) && (!best || lvReq(key) < best.lv)) best = {sec, lv: lvReq(key)}; });
  return best;
}
const secName = k => { const b = $(`#nav button[data-sec="${k}"] .d-lbl`); return b ? b.textContent : k; };
function openSection(k){
  if (!SECTIONS.includes(k)) k = 'mina';
  if (S && !secOpen(k)){
    const key = SEC_KEY[k];
    toast(key ? `${secName(k)} se desbloquea en el nivel ${lvReq(key)}. Sube de nivel vendiendo, cumpliendo objetivos y descubriendo hallazgos.` : 'Aún no tienes hallazgos. Baja por la mina y busca lo que brilla.', '', 'err');
    const b = $(`#nav button[data-sec="${k}"]`); if (b){ b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); }
    sfx('bad'); return;
  }
  const prev = S.section;
  S.section = k;
  if (!S.secSeen) S.secSeen = {};
  if (!S.secSeen[k]){ S.secSeen[k] = 1; K.nav = ''; }
  $$('#nav button[data-sec]').forEach(b => { if (b.dataset.sec === k) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  $$('.sec').forEach(s => s.hidden = s.id !== 'sec-' + k);
  if (k === 'mercado') queueTut('market'); if (k === 'finanzas') queueTut('finanzas');
  if (prev !== k) sfx('ui');
  requestAnimationFrame(() => { emit('layout'); resizeChart(); drawChart(); });
  K.log = true; updateUI();
}
$$('#nav button[data-sec]').forEach(b => b.addEventListener('click', () => showSection(S.section === b.dataset.sec && b.dataset.sec !== 'mina' ? 'mina' : b.dataset.sec)));
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (!b) return; showSection(b.dataset.go); if (b.dataset.deskGo && S.section === b.dataset.go) selectDesk(b.dataset.deskGo); });
$$('.win-wrap').forEach(w => w.addEventListener('click', e => { if (e.target === w) showSection('mina'); }));

function updateNav(){
  const key = S.level + '|' + S.sp + '|' + findCount() + '|' + JSON.stringify(S.secSeen || {});
  if (key === K.nav) return; K.nav = key;
  if (!S.secSeen){ S.secSeen = {}; SECTIONS.forEach(k => { if (secOpen(k)) S.secSeen[k] = 1; }); }
  const nx = nextLocked();
  $$('#nav button[data-sec]').forEach(b => {
    const k = b.dataset.sec, open = secOpen(k), isNext = !open && nx && nx.sec === k;
    b.hidden = !open && !isNext;
    let s = b.querySelector('.lock');
    const name = b.querySelector('.d-lbl').textContent;
    if (isNext){ if (!s){ s = document.createElement('span'); s.className = 'lock'; b.appendChild(s); } s.textContent = 'Nv ' + nx.lv; b.setAttribute('aria-label', `${name} (se desbloquea en el nivel ${nx.lv})`); }
    else if (s){ s.remove(); b.removeAttribute('aria-label'); }
    const fresh = open && k !== 'mina' && !S.secSeen[k];
    b.classList.toggle('new', fresh);
    let nb = b.querySelector('.new-tag');
    if (fresh && !nb){ nb = document.createElement('span'); nb.className = 'new-tag'; nb.textContent = '¡Nuevo!'; b.appendChild(nb); }
    else if (!fresh && nb) nb.remove();
  });
  const sp = $('#bNavSp'); sp.hidden = !S.sp; setT(sp, String(S.sp));
  const ls = $('#bLvlSp'); ls.hidden = !S.sp; setT(ls, String(S.sp));
}
on('unlock', u => { K.nav = ''; toast(`Desbloqueado: ${u.txt}`, 'lv'); if (u.sec) requestAnimationFrame(() => { const b = $(`#nav button[data-sec="${u.sec}"]`); if (b){ b.classList.remove('born'); void b.offsetWidth; b.classList.add('born'); emit('layout'); } }); });
export function metalSegHtml(act, cur){
  return MK.map(m => {
    const M = METALS[m], open = S.opened[m], lvOk = unl(m);
    const extra = open ? (act === 'vein' ? `<small>${nf0.format(Math.min(100, S.stock[m]/cap(m)*100))} % lleno</small>` : '') : !lvOk ? `<small class="lk">Nv ${lvReq(m)}</small>` : act === 'vein' ? `<small>abrir · ${money(M.open)}</small>` : '<small class="lk">sin abrir</small>';
    const dis = (!open && (act === 'mkt' || !lvOk)) ? ' disabled' : '';
    return `<button type="button" data-act="${act}" data-m="${m}" class="${m === cur ? 'on' : ''}"${dis}>${M.name}${extra}</button>`;
  }).join('');
}

function renderUI(){
  if (S.sp > 0) queueTut('skills');
  if (!tutCur && tutQ.length) showNextTut();
  if (menuOpen() && menuTab === 'home') updateMenuHome();
  // nivel y experiencia
  setT($('#kLevel'), String(S.level));
  $('#xpRing').style.strokeDasharray = `${clamp(S.xp/xpNeed(S.level)*100, 0, 100).toFixed(1)} 100`;
  $('#lvlBadge').title = `Nivel ${S.level} · ${nf0.format(S.xp)} de ${nf0.format(xpNeed(S.level))} de experiencia${S.sp ? ` · ${S.sp} puntos por gastar` : ''}`;
  // caja y beneficio
  const RR = estRates(), ki = $('#kInc');
  const inPos = S.positions.reduce((a, p) => a + p.margin + posPnl(p), 0);
  setT(ki, `${smoney(RR.net)}/s` + (S.positions.length ? ` · ${money(inPos)} en trading` : ''));
  ki.classList.toggle('neg', RR.net < 0);
  $('#pillMoney').title = `Ingresos ${money(RR.inc)}/s · gastos ${money(RR.exp)}/s`;
  const gm = gameMin(), day = isDay(); setT($('#kClock'), hhmm(gm)); setT($('#kDay'), `Día ${S.day || 0}`);
  const ci = $('#kClockIco'); if (ci.dataset.icon !== (day ? 'sun' : 'moon')){ ci.dataset.icon = day ? 'sun' : 'moon'; ci.innerHTML = icon(ci.dataset.icon); $('#pillClock').classList.toggle('night', !day); }
  $('#pillClock').title = `Día ${S.day || 0}, ${hhmm(gm)} · ${day ? 'de día: tarifa punta de la luz hasta las 18:00' : 'de noche: tarifa valle hasta las 06:00 y salen los hallazgos nocturnos'} · un día dura 6 minutos`;
  const lc = $('#legacyChip'); lc.hidden = !S.legacy; setT(lc, `Legado ${S.legacy} · +${legAvail()*5} %`);
  const H = health(), bf = $('#bNavFin'); bf.hidden = !H.lv || !secOpen('finanzas'); bf.classList.toggle('bad', H.lv > 1);
  const newF = findCount() - (S.museoSeen || 0), bmu = $('#bNavMu'); bmu.hidden = newF <= 0 || S.section === 'museo'; setT(bmu, String(newF));
  const bg = $('#bNavMg'), tk = S.mg && S.mg.pass ? (S.mg.pass.cart || 0) + (S.mg.pass.blast || 0) : 0; bg.hidden = !tk || !secOpen('minijuegos') || S.section === 'minijuegos'; setT(bg, String(tk));
  const bm = $('#bNavMk'); const pend = S.offers.length; bm.hidden = !pend; setT(bm, String(pend));
  updateNav();
  switch (S.section){
    case 'mina': updateMine(); break;
    case 'mercado': updateMarket(); break;
    case 'empresas': updateBiz(); break;
    case 'bolsa': updateStocks(); break;
    case 'habilidades': updateTree(); break;
    case 'logros': updateAch(); break;
    case 'finanzas': updateFin(); break;
    case 'museo': updateMuseo(); break;
    case 'minijuegos': updateMinigames(); break;
  }
  if (S.section === 'logros'){
    setT($('#sMined'), weight(S.mined)); setT($('#sEarned'), money(S.earned)); setT($('#sAll'), money(S.allEarned));
    setT($('#sTrade'), S.trades ? `${smoney(S.pnlReal)} · ${S.wins}/${S.trades} ganadas` : '—');
    setT($('#sCon'), S.conFail ? `${S.conDone} (${S.conFail} incumplidos)` : String(S.conDone));
    setT($('#sClicks'), nf0.format(S.clicks)); setT($('#sPrest'), String(S.prestiges));
  }
}

/* ---------- teclado ---------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){ e.preventDefault(); if (menuOpen()) closeMenu(); else if (S.section !== 'mina') showSection('mina'); else openMenu(); return; }
  const tg = e.target, typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT');
  if (typing || menuOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[1-9]$/.test(e.key)){ const vis = SECTIONS.filter(secOpen); if (vis[+e.key - 1]) showSection(vis[+e.key - 1]); return; }
  if (e.key !== ' ' || e.repeat || S.section !== 'mina') return;
  if (tg !== document.body && tg !== document.documentElement) return;
  e.preventDefault(); dig(); pressDig();
});
on('ui', renderUI);
on('newDay', d => toast(`Medianoche: empieza el Día ${d}`));
on('section', openSection);
