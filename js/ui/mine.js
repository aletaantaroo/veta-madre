import { K, emit, sfx, updateUI } from '../core/bus.js';
import { $, $$, setT } from '../core/dom.js';
import { money, nf0, pfmt, weight } from '../core/format.js';
import { CREW, METALS, MK, OBJ, STRATA, UP } from '../data/content.js';
import { dig, fullFlash } from '../game/mining.js';
import { buyCrew, buyUp, qty, setQty } from '../game/shop.js';
import { S, cap, clickPow, costN, crewMult, depth, gpsOf, has, maxN, metalConv, mk, opF, physPrice, prodMult, stratumIdx } from '../game/state.js';
import { drawCrewIcon } from '../render/sprites.js';
import { kindIcon } from './icons.js';
import { metalSegHtml, opsIssues } from './layout.js';

export function updateMine(){
  const key = S.vein + '|' + S.level + '|' + Object.keys(S.opened).join() + '|' + MK.map(x => S.opened[x] ? Math.floor(Math.min(1, S.stock[x]/cap(x))*20) : S.money >= METALS[x].open).join();
  if (key !== K.vein){ K.vein = key; $('#veinSeg').innerHTML = metalSegHtml('vein', S.vein); }
  const m = S.vein, M = METALS[m];
  setT($('#stratum'), `⛏ ${STRATA[stratumIdx()].name} · ${nf0.format(depth())} m de profundidad`);
  $('#fullWarn').hidden = !(S.stock[m] >= cap(m) || fullFlash > 0);
  setT($('#clickInfo'), `+${weight(clickPow(m))} ${M.low}`);
  $('#qsInfo').innerHTML = `${M.name}: <b>${weight(S.stock[m])}</b> · vale ≈ <b>${money(S.stock[m]*physPrice(m))}</b><br><span class="meta">a ${pfmt(m, mk(m).price)}</span>`;
  const ob = $('#objBar'); ob.hidden = S.obj >= OBJ.length;
  if (!ob.hidden){ const o = OBJ[S.obj]; setT($('#objN'), `Objetivo ${S.obj+1}/${OBJ.length}`); setT($('#objTxt'), o.txt); setT($('#objR'), `premio ${money(o.r)}`); }
  const amb = $('#autoMineBox'); amb.hidden = !S.perks.p_auto;
  if (!amb.hidden){ $('#chkAutoMine').checked = !!S.autoMine.on; if (document.activeElement !== $('#autoMineTh')) $('#autoMineTh').value = String(S.autoMine.th); }
  const iss = opsIssues(), ow = $('#opsWarn'); ow.hidden = !iss.length; if (iss.length){ setT(ow, `⚠ ${iss[0][0].toUpperCase() + iss[0].slice(1)}${iss.length > 1 ? ` y ${iss.length - 1} aviso${iss.length > 2 ? 's' : ''} más` : ''} · ver Finanzas`); ow.title = iss.join(' · '); }
  $('#qs50').classList.toggle('cant', !(S.stock[m] > 0)); $('#qs100').classList.toggle('cant', !(S.stock[m] > 0));
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
function updateUps(){
  const avail = UP.filter(u => !has(u.id) && u.req());
  const key = avail.map(u=>u.id).join(',') + '|' + Object.keys(S.ups).length;
  const list = $('#upList');
  if (key !== K.up){
    K.up = key; list.innerHTML = '';
    if (!avail.length){ const p = document.createElement('p'); p.className='empty'; p.textContent='No hay mejoras disponibles ahora. Sigue ampliando la mina y aparecerán más.'; list.appendChild(p); }
    avail.forEach(u => {
      const b = document.createElement('button'); b.type='button'; b.className='row'; b.id='up_'+u.id; b.dataset.cost = u.cost;
      b.innerHTML = `<span class="r-ico up-ico k-${u.kind.toLowerCase()}">${kindIcon(u.kind)}</span><span class="r-main"><span class="r-kind"></span><span class="r-name"></span><span class="r-desc"></span></span><span class="r-side"><span class="r-cost"></span></span>`;
      b.querySelector('.r-kind').textContent = u.kind; b.querySelector('.r-name').textContent = u.name;
      b.querySelector('.r-desc').textContent = u.desc; b.querySelector('.r-cost').textContent = money(u.cost);
      b.addEventListener('click', () => buyUp(u));
      list.appendChild(b);
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
  list.querySelectorAll('.row').forEach(b => { const can = S.money >= +b.dataset.cost; if (can) affordable++; b.classList.toggle('cant', !can); });
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
function setShopOpen(open){
  const sh = $('#shop'); sh.classList.toggle('open', open); $('#shopHandle').setAttribute('aria-expanded', String(open));
  $('#sec-mina').classList.toggle('shop-open', open); if (open) K.up = ''; emit('layout'); updateUI();
}
$('#shopHandle').addEventListener('click', () => { sfx('ui'); setShopOpen(!$('#shop').classList.contains('open')); });
