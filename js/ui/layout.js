import { K, drawChart, emit, on, queueTut, sfx, showSection, updateUI } from '../core/bus.js';
import { $, $$, setT } from '../core/dom.js';
import { clamp, fmtT, money, nf0, nf1, pfmt, smoney, weight } from '../core/format.js';
import { METALS, MK } from '../data/content.js';
import { estRates, needs, openedMk } from '../game/economy.js';
import { dig } from '../game/mining.js';
import { S, cap, fac, findCount, legAvail, lvReq, mk, posPnl, unl, xpNeed } from '../game/state.js';
import { resizeChart } from '../render/charts.js';
import { updateAch } from './achievements.js';
import { updateBiz } from './biz.js';
import { updateFin } from './finance.js';
import { updateMarket } from './market.js';
import { closeMenu, menuOpen, menuTab, openMenu, updateMenuHome } from './menu.js';
import { pressDig, updateMine } from './mine.js';
import { updateMuseo } from './museum.js';
import { updateTree } from './skills.js';
import { updateStocks } from './stocks.js';
import { showNextTut, tutCur, tutQ } from './tutorial.js';

/* ================= interfaz: HUD, dock y ventanas ================= */
const SECTIONS = ['mina', 'mercado', 'finanzas', 'empresas', 'bolsa', 'habilidades', 'museo', 'logros'];
const METAL_ICON = {au:['#ffc62e', '#ffe68a'], ag:['#c9d6e8', '#f4f8fc'], cu:['#ff8a4c', '#ffc39e']};

function openSection(k){
  if (!SECTIONS.includes(k)) k = 'mina';
  if (k === 'empresas' && !unl('biz') || k === 'bolsa' && !unl('stocks')){ /* se abre igual: dentro explica el candado */ }
  const prev = S.section;
  S.section = k;
  $$('#nav button[data-sec]').forEach(b => { if (b.dataset.sec === k) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  $$('.sec').forEach(s => s.hidden = s.id !== 'sec-' + k);
  if (k === 'mercado') queueTut('market'); if (k === 'finanzas') queueTut('finanzas');
  if (prev !== k) sfx('ui');
  requestAnimationFrame(() => { emit('layout'); resizeChart(); drawChart(); });
  K.log = true; updateUI();
}
$$('#nav button[data-sec]').forEach(b => b.addEventListener('click', () => showSection(S.section === b.dataset.sec && b.dataset.sec !== 'mina' ? 'mina' : b.dataset.sec)));
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) showSection(b.dataset.go); });
$$('.win-wrap').forEach(w => w.addEventListener('click', e => { if (e.target === w) showSection('mina'); }));

function updateNav(){
  const key = S.level + '|' + S.sp;
  if (key === K.nav) return; K.nav = key;
  [['#navEmpresas', 'biz'], ['#navBolsa', 'stocks']].forEach(([sel, k]) => {
    const b = $(sel); let s = b.querySelector('.lock');
    const name = b.querySelector('.d-lbl').textContent;
    if (!unl(k)){ if (!s){ s = document.createElement('span'); s.className = 'lock'; b.appendChild(s); } s.textContent = 'Nv ' + lvReq(k); b.setAttribute('aria-label', `${name} (bloqueado hasta el nivel ${lvReq(k)})`); }
    else if (s){ s.remove(); b.removeAttribute('aria-label'); }
  });
  const sp = $('#bNavSp'); sp.hidden = !S.sp; setT(sp, String(S.sp));
  const ls = $('#bLvlSp'); ls.hidden = !S.sp; setT(ls, String(S.sp));
}
export function metalSegHtml(act, cur){
  return MK.map(m => {
    const M = METALS[m], open = S.opened[m], lvOk = S.level >= M.lv;
    const extra = open ? (act === 'vein' ? `<small>${nf0.format(Math.min(100, S.stock[m]/cap(m)*100))} % lleno</small>` : '') : !lvOk ? `<small class="lk">Nv ${M.lv}</small>` : act === 'vein' ? `<small>abrir · ${money(M.open)}</small>` : '<small class="lk">sin abrir</small>';
    const dis = (!open && (act === 'mkt' || !lvOk)) ? ' disabled' : '';
    return `<button type="button" data-act="${act}" data-m="${m}" class="${m === cur ? 'on' : ''}"${dis}>${M.name}${extra}</button>`;
  }).join('');
}

export function opsIssues(){
  const w = [];
  openedMk().forEach(m => { if (S.stock[m] >= cap(m)) w.push(`almacén de ${METALS[m].low} lleno`); });
  if (fac.e < .99) w.push(`falta energía (${nf0.format(fac.e*100)} %)`);
  if (fac.f < .99) w.push('falta combustible');
  if (fac.x < .99) w.push('faltan explosivos');
  if (needs().mv && S.maint < 50) w.push(`maquinaria al ${nf0.format(S.maint)} %`);
  if (S.moral < 60) w.push(S.moral <= 0 ? 'huelga' : 'moral baja');
  if (S.arrears > 0) w.push(`atrasos de ${money(S.arrears)}`);
  else if (S.nomina > 0 && S.money < S.nomina*60 && S.payT < 30 && !S.autoPay) w.push(`nómina de ${money(S.nomina*60)} en ${fmtT(S.payT)} sin caja suficiente`);
  return w;
}

function renderUI(){
  if (S.sp > 0) queueTut('skills');
  if (!tutCur && tutQ.length) showNextTut();
  if (menuOpen() && menuTab === 'home') updateMenuHome();
  const v = S.vein, c = cap(v), full = S.stock[v] >= c;
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
  // almacén del metal activo
  const [c1, c2] = METAL_ICON[v], pm = $('#pillMetal');
  pm.style.setProperty('--ic1', c1); pm.style.setProperty('--ic2', c2);
  setT($('#kGold'), innerWidth < 560 ? weight(S.stock[v]) : `${weight(S.stock[v])} / ${weight(c)}`);
  $('#capFill').style.width = clamp(S.stock[v]/c*100, 0, 100) + '%';
  $('#capBar').classList.toggle('full', full);
  pm.title = `Almacén de ${METALS[v].low}`;
  // precio
  const m = S.section === 'mina' ? v : S.mm, s = mk(m);
  setT($('#kSpotLbl'), `${METALS[m].name} spot`);
  setT($('#kPrice'), pfmt(m, s.price));
  const ref = s.hist[Math.max(0, s.hist.length - 61)] || s.price, ch = (s.price/ref - 1)*100;
  const kc = $('#kChg'); setT(kc, `${ch >= 0 ? '▲' : '▼'} ${nf1.format(Math.abs(ch))} %`); kc.className = 'chg ' + (ch >= 0 ? 't-up' : 't-down');
  const lc = $('#legacyChip'); lc.hidden = !S.legacy; setT(lc, `Legado ${S.legacy} · +${legAvail()*5} %`);
  const bf = $('#bNavFin'); bf.hidden = !opsIssues().length;
  const newF = findCount() - (S.museoSeen || 0), bmu = $('#bNavMu'); bmu.hidden = newF <= 0 || S.section === 'museo'; setT(bmu, String(newF));
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
  if (/^[1-8]$/.test(e.key)){ showSection(SECTIONS[+e.key - 1]); return; }
  if (e.key !== ' ' || e.repeat || S.section !== 'mina') return;
  if (tg !== document.body && tg !== document.documentElement) return;
  e.preventDefault(); dig(); pressDig();
});
on('ui', renderUI);
on('section', openSection);
