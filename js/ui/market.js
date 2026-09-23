import { K, on, selectDesk, updateUI } from '../core/bus.js';
import { $, $$, esc, setT } from '../core/dom.js';
import { clamp, clock, fmtT, money, nf0, nf1, pfmt, plab, smoney, toUnit, unitOf, weight } from '../core/format.js';
import { EVENTS, METALS, MK, REGIMES } from '../data/content.js';
import { reserved } from '../game/jobs.js';
import { buyCap, createOrder, moves, openPos, sell } from '../game/market.js';
import { S, ask, bid, cap, capCost, fee, has, impactOf, mk, physPrice, posPnl, refineBonus, sk, spread, unl } from '../game/state.js';
import { updateJobsMarket } from './jobs.js';
import { metalSegHtml } from './layout.js';

/* ---- mercado ---- */
export let desk = 'sell';
const DESKS = {sell:'#pSell', trade:'#pTrade', con:'#pCon', ord:'#pOrd', log:'#pLog'};
function openDesk(k){
  desk = k;
  $$('#deskTabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.desk === k)));
  Object.entries(DESKS).forEach(([key, sel]) => { $(sel).hidden = key !== k; });
  if (k === 'ord') $('#oPrice').value = (toUnit(S.mm, mk(S.mm).price*1.03)).toFixed(S.mm === 'ag' ? 3 : 2);
  K.log = true; updateUI();
}
$$('#deskTabs button').forEach(b => b.addEventListener('click', () => selectDesk(b.dataset.desk)));
$$('.sell').forEach(b => b.addEventListener('click', () => { sell(S.mm, +b.dataset.frac); updateUI(); }));
$('#btnCap').addEventListener('click', buyCap);
$('#btnLong').addEventListener('click', () => openPos(1));
$('#btnShort').addEventListener('click', () => openPos(-1));
$('#btnOrder').addEventListener('click', createOrder);
$('#autoSell').addEventListener('change', e => { S.autoSell = e.target.checked; });
$$('#tPresets button').forEach(b => b.addEventListener('click', () => { $('#tMargin').value = Math.floor(Math.max(0,S.money)*(+b.dataset.pct)*100)/100; updateTradeForm(); }));
$$('#levSeg button').forEach(b => b.addEventListener('click', () => { if (b.disabled) return; S.lev = +b.dataset.lev; updateTradeForm(); }));
['tMargin','tSL','tTP'].forEach(id => $('#'+id).addEventListener('input', updateTradeForm));
function levOk(l){ return l === 1 || l === 5 || (l === 20 && has('u_pro')) || (l === 50 && sk('t6')); }
function updateTradeForm(){
  if (!levOk(S.lev)) S.lev = 5;
  $$('#levSeg button').forEach(b => { const l = +b.dataset.lev; b.disabled = !levOk(l); b.title = b.disabled ? (l === 20 ? 'Necesitas la Cuenta profesional' : 'Necesitas la habilidad Sangre fría') : ''; b.classList.toggle('on', l === S.lev); });
  const m = S.mm, amount = parseFloat($('#tMargin').value) || 0, notional = amount*S.lev, g = notional/mk(m).price;
  setT($('#tSLl'), `Stop loss (${unitOf(m)}, opcional)`); setT($('#tTPl'), `Take profit (${unitOf(m)}, opcional)`);
  $('#trPreview').innerHTML = amount > 0
    ? `Controlas <b>${weight(g)}</b> de ${METALS[m].low} (${money(notional)}). Cada 1 % que se mueva son <b>${money(notional*0.01)}</b>, un ${S.lev} % de tu margen. Si va un <b>${nf1.format(100/S.lev)} %</b> en tu contra, se liquida.`
    : `Elige cuánto invertir. Con 1:${S.lev} controlas ${S.lev} veces esa cantidad en ${METALS[m].low}.`;
}
export function updateMarket(){
  const m = S.mm, M = METALS[m], s = mk(m);
  const key = m + '|' + S.level + '|' + Object.keys(S.opened).join();
  if (key !== K.mkt){ K.mkt = key; $('#mktSeg').innerHTML = metalSegHtml('mkt', m); }
  const h = s.hist;
  if (h.length){ setT($('#hiLo'), `Máx ${plab(m, Math.max(...h))} · Mín ${plab(m, Math.min(...h))} (3 min)`); }
  const sig = $('#signal'); sig.hidden = !has('u_analista');
  if (!sig.hidden){
    const mean = h.reduce((a,b)=>a+b,0)/h.length, r = s.price/mean;
    if (r > 1.035){ setT(sig,'Precio alto: buen momento para vender'); sig.dataset.tone='up'; }
    else if (r < 0.965){ setT(sig,'Precio bajo: mejor esperar'); sig.dataset.tone='down'; }
    else { setT(sig,'Precio en la media'); sig.dataset.tone=''; }
  }
  const rg = $('#regime'); rg.hidden = !has('u_analista');
  if (!rg.hidden){ const R = REGIMES[s.regime.i]; setT(rg, `${M.name}: ${R.name.toLowerCase()}`); rg.dataset.tone = R.tone; }
  [['#indSma','u_analista','sma'],['#indBoll','u_bollinger','boll'],['#indRsi','u_rsi','rsi']].forEach(([sel,u,k]) => {
    const b = $(sel); b.hidden = !has(u); b.classList.toggle('on', !!S.ind[k]); b.setAttribute('aria-pressed', String(!!S.ind[k]));
  });
  if (S.ev){
    const E = EVENTS[S.ev.i];
    setT($('#evName'), E.name); setT($('#evCd'), `en ${fmtT(S.ev.left)}`);
    setT($('#evHint'), has('u_informante') ? `Tu informante cree: ${moves(E, S.ev.hint)}. Acierta ${sk('t4') ? 9 : 7} de cada 10 veces.` : 'Al publicarse, los precios darán un salto. Un informante podría adelantarte hacia dónde.');
  } else { setT($('#evName'), 'por anunciar'); setT($('#evCd'), `se anuncia en ${fmtT(S.evNext)}`); setT($('#evHint'), 'Los datos económicos mueven mucho los precios justo al publicarse.'); }
  const spy = sk('t5') || !!(S.finds && S.finds.capsula);
  $('#rivBarWrap').hidden = !spy;
  if (spy){ $('#rivBar').style.width = clamp(S.rival.fill*100,0,100) + '%'; setT($('#rivCd'), `almacén al ${nf0.format(S.rival.fill*100)} %`); setT($('#rivHint'), `Tu espía calcula que soltará su oro en unos ${fmtT((1-S.rival.fill)*S.rival.T)}. Vende antes y ganarás más.`); }
  else { setT($('#rivCd'), `${S.rival.dumps} ventas masivas`); setT($('#rivHint'), 'Acumula oro y de vez en cuando lo suelta todo de golpe, hundiendo el precio. La habilidad «Espía en la competencia» te deja verlo venir.'); }
  updateDesk();
}
function posItem(p){
  const pnl = posPnl(p);
  return `<div class="item" data-pid="${p.id}"><div><span class="tag ${p.dir>0?'long':'short'}">${p.dir>0?'Largo':'Corto'}</span><b>${weight(p.g)}</b> de ${METALS[p.m].low} desde ${plab(p.m,p.entry)} · 1:${p.lev}
    <div class="sub">Margen ${money(p.margin)}${p.sl?` · SL ${plab(p.m,p.sl)}`:''}${p.tp?` · TP ${plab(p.m,p.tp)}`:''}</div></div>
    <div class="item-side"><span class="pnl ${pnl>=0?'t-up':'t-down'}" data-r="pnl">${smoney(pnl)} (${nf1.format(pnl/p.margin*100)} %)</span><button type="button" class="btn sm" data-act="close" data-id="${p.id}">Cerrar</button></div></div>`;
}
function updateDesk(){
  const m = S.mm, M = METALS[m];
  const lockTxt = (btn, locked) => { let s = btn.querySelector('.lock'); if (locked && !s){ s = document.createElement('span'); s.className='lock'; s.setAttribute('aria-label','bloqueado'); btn.appendChild(s); } if (!locked && s) s.remove(); };
  lockTxt($('#dtTrade'), !has('u_broker')); lockTxt($('#dtOrd'), !has('u_agente')); lockTxt($('#dtCon'), !unl('contracts'));
  const bt = $('#bTrade'); bt.hidden = !S.positions.length; setT(bt, String(S.positions.length));
  const bc = $('#bCon'); bc.hidden = !S.offers.length; setT(bc, String(S.offers.length));
  const bo = $('#bOrd'); bo.hidden = !S.orders.length; setT(bo, String(S.orders.length));
  if (desk === 'sell'){
    const rsv = Math.min(S.stock[m], reserved(m)), free = S.stock[m] - rsv;
    setT($('#stockInfo'), `Tu ${M.low} en el almacén: ${weight(S.stock[m])} de ${weight(cap(m))}${rsv > 0 ? ` (${weight(rsv)} apartado para encargos)` : ''}`);
    setT($('#physPrice'), pfmt(m, physPrice(m)));
    setT($('#feeInfo'), `(spot − comisión del ${nf1.format(fee()*100)} %${refineBonus() ? ` + refinería ${nf0.format(refineBonus()*100)} %` : ''})`);
    [['est10',.1],['est50',.5],['est100',1]].forEach(([id,f]) => { const amt = free*f, imp = impactOf(m, amt); setT($('#'+id), amt > 0 ? '≈ ' + money(amt*physPrice(m)*(1-imp/2)) : '—'); });
    const impAll = impactOf(m, free);
    setT($('#impactTxt'), S.stock[m] > 0 ? `Vender mucho de golpe empuja el precio a la baja. Venderlo todo ahora lo bajaría un ${nf1.format(impAll*100)} %.` : 'Vender mucho de golpe empuja el precio a la baja: repartir las ventas suele salir mejor.');
    $$('.sell').forEach(b => b.classList.toggle('cant', !(S.stock[m] > 0)));
    setT($('#capLvl'), String(S.cap+1));
    setT($('#capDesc'), MK.filter(x => S.opened[x]).map(x => `${METALS[x].name} ${weight(cap(x))}`).join(' · '));
    const cc = capCost(S.cap), bcap = $('#btnCap'); setT(bcap, `Ampliar ×3 · ${money(cc)}`); bcap.classList.toggle('cant', S.money < cc);
  }
  if (desk === 'trade'){
    const on = has('u_broker'); $('#trLocked').hidden = on; $('#trBody').hidden = !on;
    if (on){
      const used = S.positions.reduce((a,p)=>a+p.margin,0), open = S.positions.reduce((a,p)=>a+posPnl(p),0);
      setT($('#trMargin'), money(used));
      const to = $('#trOpen'); setT(to, S.positions.length ? smoney(open) : '—'); to.className = 'val ' + (S.positions.length ? (open>=0?'t-up':'t-down') : '');
      const tr = $('#trReal'); setT(tr, S.trades ? smoney(S.pnlReal) : '—'); tr.className = 'val ' + (S.trades ? (S.pnlReal>=0?'t-up':'t-down') : '');
      setT($('#bid'), pfmt(m, bid(m))); setT($('#ask'), pfmt(m, ask(m))); setT($('#spreadTxt'), `Diferencial ${nf1.format(spread()*100)} %`);
      updateTradeForm();
      const key = 'k' + S.positions.map(p=>p.id).join(','), list = $('#posList');
      if (key !== K.pos){ K.pos = key; list.innerHTML = S.positions.length ? S.positions.map(posItem).join('') : '<p class="empty">No tienes posiciones abiertas.</p>'; }
      else S.positions.forEach(p => { const el = list.querySelector(`[data-pid="${p.id}"] [data-r=pnl]`); if (!el) return; const pnl = posPnl(p); setT(el, `${smoney(pnl)} (${nf1.format(pnl/p.margin*100)} %)`); el.className = 'pnl ' + (pnl>=0?'t-up':'t-down'); });
    }
  }
  if (desk === 'con') updateJobsMarket();
  if (desk === 'ord'){
    const on = has('u_agente'); $('#orLocked').hidden = on; $('#orBody').hidden = !on;
    $('#autoSell').checked = !!S.autoSell; setT($('#oPriceL'), `Precio (${unitOf(m)})`);
    const key = 'k' + S.orders.map(o=>o.id).join(','), list = $('#ordList');
    if (key !== K.ord){
      K.ord = key;
      list.innerHTML = S.orders.length ? S.orders.map(o => `<div class="item"><div><span class="tag gold">${METALS[o.m].name} · ${o.kind==='above'?'si sube':'si baja'}</span>Vender ${o.frac===1?'todo':Math.round(o.frac*100)+' %'} a ${pfmt(o.m,o.target)}</div>
        <div class="item-side"><button type="button" class="btn sm" data-act="cancel" data-id="${o.id}">Cancelar</button></div></div>`).join('')
        : '<p class="empty">No hay órdenes activas.</p>';
    }
  }
  if (desk === 'log' && K.log){
    K.log = false;
    $('#logList').innerHTML = S.log.length ? S.log.map(l => `<li data-tone="${l.tone}"><time>${clock(l.t)}</time><span>${esc(l.txt)}</span></li>`).join('') : '<li><time></time><span>Aún no hay operaciones.</span></li>';
  }
}
on('desk', openDesk);
on('ticker', (txt, tone, sel) => { const t = $(sel || '#ticker'); if (!t) return; t.textContent = txt; t.dataset.tone = tone || ''; t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); });
