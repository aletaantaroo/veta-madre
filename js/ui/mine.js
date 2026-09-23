import { K, emit, on, sfx, updateUI } from '../core/bus.js';
import { $, $$, esc, setT } from '../core/dom.js';
import { money, nf0, pfmt, weight } from '../core/format.js';
import { CREW, METALS, MK, OBJ, UP } from '../data/content.js';
import { HEALTH_TXT, efficiency, health, prodValue } from '../game/health.js';
import { dig, fullFlash } from '../game/mining.js';
import { buyCrew, buyUp, qty, setQty } from '../game/shop.js';
import { S, cap, capCost, clickPow, costN, crewMult, gps, gpsOf, has, lvReq, maxN, metalConv, mk, opF, physPrice, prodMult, unl } from '../game/state.js';
import { drawCrewIcon } from '../render/sprites.js';
import { kindIcon } from './icons.js';
import { secOpen } from './layout.js';

/* ---------- panel de producción: cuánto sacas, de qué, dónde picas y si algo va mal ---------- */
let prodOpen = innerWidth > 860, issuesOpen = false;
function setProdOpen(v){ prodOpen = v; $('#prodCard').classList.toggle('open', v); $('#prodHead').setAttribute('aria-expanded', String(v)); emit('layout'); }
$('#prodHead').addEventListener('click', () => { sfx('ui'); if (!prodOpen) setProdOpen(true); else if (health().lv && !issuesOpen){ issuesOpen = true; K.prod = ''; updateMine(); } else { issuesOpen = false; setProdOpen(innerWidth > 860 ? true : false); K.prod = ''; updateMine(); } });
on('vaultTap', () => { setProdOpen(true); const b = $('#vaultRow'); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); });
function prodRows(){
  const ms = MK.filter(m => S.opened[m]), next = MK.find(m => !S.opened[m]);
  const rows = ms.map(m => {
    const M = METALS[m], f = Math.min(1, S.stock[m]/cap(m)), full = f >= 1, on = m === S.vein;
    return `<button type="button" class="pr-row${on ? ' on' : ''}${full ? ' full' : ''}" data-act="vein" data-m="${m}" id="pr_${m}" title="${on ? 'Aquí picas tú' : 'Toca para picar aquí'} · ${weight(S.stock[m])} de ${weight(cap(m))} · ${pfmt(m, mk(m).price)}">
      <span class="pr-dot"></span><span class="pr-name">${M.name}${on ? '<i class="pr-you" aria-label="picas aquí"></i>' : ''}</span>
      <span class="pr-rate">${full ? 'parada' : `${weight(gps(m))}/s`}</span>
      <span class="pr-bar"><i style="width:${(f*100).toFixed(1)}%"></i></span><span class="pr-pct">${full ? 'lleno' : nf0.format(f*100) + ' %'}</span></button>`;
  });
  if (next){
    const M = METALS[next], ok = unl(next), can = ok && S.money >= M.open;
    rows.push(`<button type="button" class="pr-row lockd${can ? ' can' : ''}" data-act="vein" data-m="${next}" ${ok ? '' : 'disabled'}><span class="pr-dot"></span><span class="pr-name">${M.name}</span>
      <span class="pr-lock">${ok ? `Abrir · ${money(M.open)}` : `nivel ${lvReq(next)}`}</span></button>`);
  }
  return rows.join('');
}
export function updateMine(){
  const m = S.vein, M = METALS[m], H = health(), eff = efficiency();
  const key = [S.vein, S.level, S.cap, Object.keys(S.opened).join(), ...MK.map(x => S.opened[x] ? Math.floor(Math.min(1, S.stock[x]/cap(x))*40) + ':' + weight(gps(x)) : unl(x) + ':' + (S.money >= METALS[x].open)), mk(m).price.toFixed(3)].join('|');
  if (key !== K.vein){ K.vein = key; $('#prodRows').innerHTML = prodRows(); }
  $('#prodCard').classList.toggle('open', prodOpen);
  const pv = prodValue(); setT($('#prodVal'), `${money(pv)}/s`);
  const hp = $('#healthPill'); hp.dataset.h = String(H.lv);
  setT($('#healthTxt'), H.lv ? `${HEALTH_TXT[H.lv]}: ${H.list[0].short}${H.list.length > 1 ? ` +${H.list.length - 1}` : ''}` : HEALTH_TXT[0]);
  $('#prodCard').dataset.h = String(H.lv);
  const pe = $('#prodEff'), cut = [];
  if (eff < .99) cut.push(`el equipo rinde al ${nf0.format(eff*100)} %`);
  const full = MK.filter(x => S.opened[x] && S.stock[x] >= cap(x)).length;
  if (full) cut.push(full > 1 ? `${full} minas paradas por almacén lleno` : 'una mina parada por almacén lleno');
  const none = !MK.some(x => S.opened[x] && gps(x) > 0);
  pe.hidden = !cut.length && !none; pe.classList.toggle('hint', none && !cut.length);
  if (cut.length) setT(pe, `▼ ${cut.join(' · ')}`); else if (none) setT(pe, 'Contrata equipo en la tienda y la mina producirá sola.');
  const pi = $('#prodIssues'), showIss = issuesOpen && H.lv > 0;
  pi.hidden = !showIss;
  const ik = showIss ? H.list.map(x => x.key + x.txt).join() : '';
  if (ik !== K.prod){ K.prod = ik; pi.innerHTML = H.list.map(x => `<li data-h="${x.lv}"><span>${esc(x.txt)}</span>${x.act ? `<button type="button" class="btn sm ${x.lv > 1 ? 'btn-red' : 'btn-gold'}" data-act="${x.act}">${esc(x.fix || 'Arreglar')}</button>` : x.go && secOpen(x.go) ? `<button type="button" class="btn sm btn-plain" data-go="${x.go}">Ver ${x.go}</button>` : x.fix ? `<small>${esc(x.fix)}</small>` : ''}</li>`).join(''); }
  // caja fuerte
  const cc = capCost(S.cap), canCap = S.money >= cc;
  setT($('#vaultLv'), 'Caja fuerte');
  setT($('#vaultInfo'), `nv ${S.cap + 1} · ${M.low} ${weight(cap(m))} → ${weight(cap(m)*3)}`); $('#vaultRow').title = MK.filter(x => S.opened[x]).map(x => `${METALS[x].name}: caben ${weight(cap(x))}, ampliada ${weight(cap(x)*3)}`).join(' · ');
  const bv = $('#btnVault'); setT(bv, `Ampliar · ${money(cc)}`); bv.classList.toggle('cant', !canCap);
  $('#vaultRow').classList.toggle('urgent', full > 0);
  setT($('#clickInfo'), `+${weight(clickPow(m))} ${M.low}`);
  const tr = mk(m).price >= (mk(m).hist[Math.max(0, mk(m).hist.length - 61)] || mk(m).price);
  $('#qsInfo').innerHTML = `${M.name}: <b>${weight(S.stock[m])}</b> · vale ≈ <b>${money(S.stock[m]*physPrice(m))}</b><br><span class="meta">a ${pfmt(m, mk(m).price)} <span class="${tr ? 't-up' : 't-down'}">${tr ? '▲' : '▼'}</span></span>`;
  const ob = $('#objBar'); ob.hidden = S.obj >= OBJ.length;
  if (!ob.hidden){ const o = OBJ[S.obj]; setT($('#objN'), `Objetivo ${S.obj+1}/${OBJ.length}`); setT($('#objTxt'), o.txt); setT($('#objR'), `premio ${money(o.r)}`); }
  const amb = $('#autoMineBox'); amb.hidden = !S.perks.p_auto;
  if (!amb.hidden){ $('#chkAutoMine').checked = !!S.autoMine.on; if (document.activeElement !== $('#autoMineTh')) $('#autoMineTh').value = String(S.autoMine.th); }
  $('#qs50').classList.toggle('cant', !(S.stock[m] > 0)); $('#qs100').classList.toggle('cant', !(S.stock[m] > 0));
  $('#digDock').classList.toggle('full', S.stock[m] >= cap(m) || fullFlash > 0);
  updateCrew(); updateUps();
}
export function buildCrew(){
  const list = $('#crewList'); list.innerHTML = '';
  CREW.forEach(c => {
    const b = document.createElement('button'); b.type='button'; b.className='row'; b.id='crew_'+c.id;
    b.innerHTML = '<canvas class="r-ico" width="58" height="58" aria-hidden="true"></canvas><span class="r-main"><span class="r-name"></span><span class="r-desc"></span><span class="r-prod"></span></span><span class="r-side"><span class="r-owned"></span><span class="r-cost"></span></span>';
    b.addEventListener('click', () => { if (!b.disabled) buyCrew(c); });
    list.appendChild(b);
    c.eIco = b.querySelector('.r-ico'); c.icoDrawn = false;
    c.el = b; c.eName = b.querySelector('.r-name'); c.eDesc = b.querySelector('.r-desc'); c.eProd = b.querySelector('.r-prod');
    c.eOwned = b.querySelector('.r-owned'); c.eCost = b.querySelector('.r-cost');
  });
}
function updateCrew(){
  let mystery = false; const conv = metalConv(S.vein)*prodMult();
  CREW.forEach((c,i) => {
    const own = S.owned[c.id]||0;
    const revealed = own > 0 || i === 0 || S.earned >= c.cost*0.35;
    if (!revealed){
      if (mystery){ c.el.hidden = true; return; }
      mystery = true; c.el.hidden = false; c.el.disabled = true; c.el.className = 'row mystery'; c.icoDrawn = false;
      { const cv = c.eIco, x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); }
      setT(c.eName,'Bloqueado'); setT(c.eDesc, `Se desbloquea cuando hayas ingresado ${money(c.cost*0.35)} en total.`);
      setT(c.eProd,''); setT(c.eOwned,''); setT(c.eCost,'');
      return;
    }
    c.el.hidden = false; c.el.disabled = false;
    if (!c.icoDrawn && c.eIco.offsetWidth){ drawCrewIcon(c.eIco, c.id); c.icoDrawn = true; }
    const n = qty==='max' ? Math.max(1, maxN(c)) : qty;
    const cost = costN(c,n), can = S.money >= cost;
    c.el.className = 'row' + (can ? '' : ' cant') + (own ? ' has' : '');
    c.el.setAttribute('aria-disabled', String(!can));
    setT(c.eName, c.name); setT(c.eDesc, c.desc);
    const res = [c.e && 'energía', c.f && 'combustible', c.x && 'explosivos'].filter(Boolean), of = opF(c);
    setT(c.eProd, `+${weight(c.gps*crewMult(c.id)*conv)}/s cada uno` + (own ? ` · ${weight(gpsOf(c)*conv)}/s en total` : '') + ` · nómina ${money(c.gps*80*c.sal*60)}/min` + (res.length ? ` · usa ${res.join(', ')}` : '') + (own && of < .99 ? ` · rinde al ${nf0.format(of*100)} %` : ''));
    c.el.title = c.el.className.includes('cant') ? `Te faltan ${money(cost - S.money)}` : '';
    setT(c.eOwned, String(own));
    setT(c.eCost, (n > 1 ? `×${n} · ` : '') + money(cost));
  });
}
/* Mejoras agrupadas por tipo en desplegables: solo abres lo que te interesa. */
const KORDER = ['Mina', 'Equipo', 'Mercado', 'Operaciones'];
const KSUB = {Mina: 'Golpes más fuertes', Equipo: 'Tu plantilla rinde el doble', Mercado: 'Vender mejor y más información', Operaciones: 'Gastos, moral y mantenimiento'};
function upRow(u){
  const b = document.createElement('button'); b.type='button'; b.className='row'; b.id='up_'+u.id; b.dataset.cost = u.cost;
  b.innerHTML = `<span class="r-ico up-ico k-${u.kind.toLowerCase()}">${kindIcon(u.kind)}</span><span class="r-main"><span class="r-name"></span><span class="r-desc"></span></span><span class="r-side"><span class="r-cost"></span></span>`;
  b.querySelector('.r-name').textContent = u.name;
  b.querySelector('.r-desc').textContent = u.desc; b.querySelector('.r-cost').textContent = money(u.cost);
  b.addEventListener('click', () => buyUp(u));
  return b;
}
function updateUps(){
  const avail = UP.filter(u => !has(u.id) && u.req());
  const key = avail.map(u=>u.id).join(',') + '|' + Object.keys(S.ups).length;
  const list = $('#upList');
  if (key !== K.up){
    K.up = key; list.innerHTML = '';
    if (!avail.length){ const p = document.createElement('p'); p.className='empty'; p.textContent='No hay mejoras disponibles ahora. Sigue ampliando la mina y aparecerán más.'; list.appendChild(p); }
    KORDER.forEach(kind => {
      const items = avail.filter(u => u.kind === kind); if (!items.length) return;
      const d = document.createElement('details'); d.className = 'up-group'; d.dataset.kind = kind;
      d.innerHTML = `<summary><span class="ug-ico up-ico k-${kind.toLowerCase()}">${kindIcon(kind)}</span><span class="ug-txt"><b>${kind}</b><small>${KSUB[kind]}</small></span><span class="ug-meta"></span><span class="ug-caret" aria-hidden="true"></span></summary><div class="ug-body"></div>`;
      d.open = S.upOpenKind === kind;
      d.querySelector('summary').addEventListener('click', () => setTimeout(() => {
        S.upOpenKind = d.open ? kind : null; sfx('ui');
        if (d.open) list.querySelectorAll('.up-group[open]').forEach(o => { if (o !== d) o.open = false; });   // uno abierto a la vez
      }, 0));
      items.forEach(u => d.querySelector('.ug-body').appendChild(upRow(u)));
      list.appendChild(d);
    });
    const bought = UP.filter(u => has(u.id));
    if (bought.length){
      const d = document.createElement('details'); d.className='bought';
      d.innerHTML = `<summary>Compradas (${bought.length})</summary><ul></ul>`;
      bought.forEach(u => { const li = document.createElement('li'); li.textContent = u.name; d.querySelector('ul').appendChild(li); });
      list.appendChild(d);
    }
  }
  let affordable = 0;
  list.querySelectorAll('.up-group').forEach(d => {
    let n = 0, can = 0;
    d.querySelectorAll('.row').forEach(b => { n++; const ok = S.money >= +b.dataset.cost; if (ok) can++; b.classList.toggle('cant', !ok); });
    affordable += can;
    const meta = d.querySelector('.ug-meta'), txt = can ? `${can} al alcance` : `${n}`;
    if (meta.textContent !== txt){ meta.textContent = txt; meta.classList.toggle('can', can > 0); }
  });
  const badge = $('#upBadge'); badge.hidden = !affordable; setT(badge, String(affordable));
  const crewAff = CREW.filter(c => c.el && !c.el.hidden && !c.el.disabled && !c.el.classList.contains('cant')).length;
  const sb = $('#shopBadge'), tot = affordable + crewAff; sb.hidden = !tot; setT(sb, String(tot));
}

$$('#qty button').forEach(b => b.addEventListener('click', () => {
  setQty(b.dataset.q === 'max' ? 'max' : +b.dataset.q);
  $$('#qty button').forEach(x => x.classList.toggle('on', x === b)); updateCrew();
}));
function selectTab(up){
  $('#tabCrew').setAttribute('aria-selected', String(!up)); $('#tabUp').setAttribute('aria-selected', String(up));
  $('#crewList').hidden = up; $('#upList').hidden = !up; $('#qty').style.visibility = up ? 'hidden' : 'visible';
}
$('#tabCrew').addEventListener('click', () => selectTab(false));
$('#tabUp').addEventListener('click', () => selectTab(true));

export function pressDig(){ const b = $('#btnDig'); b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); clearTimeout(pressDig.t); pressDig.t = setTimeout(() => b.classList.remove('hit'), 160); }
$('#btnDig').addEventListener('click', () => { dig(); pressDig(); });
/* Tienda: en escritorio se pliega en una pestaña al borde (y la mina se ve más grande); en el móvil es una hoja que sube. */
let mobOpen = false;
const deskView = () => innerWidth > 860;
export function applyShop(){
  if (!S) return;
  const desk = deskView(), open = desk ? S.shopOpen !== false : mobOpen;
  $('#shop').classList.toggle('open', open); $('#shopHandle').setAttribute('aria-expanded', String(open));
  $('#shopHandle').title = open ? 'Cerrar la tienda' : 'Abrir la tienda';
  $('#sec-mina').classList.toggle('shop-open', open && !desk);
  document.documentElement.classList.toggle('shop-closed', desk && !open);
  if (open) K.up = '';
}
function setShopOpen(open){
  if (deskView()) S.shopOpen = open; else mobOpen = open;
  applyShop(); emit('layout'); updateUI();
  requestAnimationFrame(() => emit('layout'));
  setTimeout(() => emit('layout'), 300);
}
const shopIsOpen = () => $('#shop').classList.contains('open');
$('#shopHandle').addEventListener('click', () => { sfx('ui'); setShopOpen(!shopIsOpen()); });
$('#shopClose').addEventListener('click', () => { sfx('ui'); setShopOpen(false); });
addEventListener('resize', () => applyShop());
on('sceneReset', () => { mobOpen = false; applyShop(); });
