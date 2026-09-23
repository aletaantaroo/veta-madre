import { K, updateUI } from '../core/bus.js';
import { $, $$, esc, setT } from '../core/dom.js';
import { money, nf0, nf1, smoney } from '../core/format.js';
import { METALS } from '../data/content.js';
import { buyStock, sellStock } from '../game/biz.js';
import { S, allStocks, lvReq, sk, stComm, unl } from '../game/state.js';
import { drawLine } from '../render/charts.js';

/* ---- bolsa ---- */
function buildStocks(){
  const list = allStocks(), key = list.map(d=>d.id).join();
  if (key === K.st) return; K.st = key;
  $('#stList').innerHTML = list.map(d => `<button type="button" class="st-row" data-act="stock" data-id="${d.id}" data-s="${d.id}">
    <span class="st-id">${d.own ? 'TUYA' : d.id}</span><span class="st-name">${esc(d.name)}<small>${esc(d.sector)}</small></span>
    <canvas class="spark"></canvas><span class="st-p" data-r="p">—</span><span class="st-ch" data-r="ch">—</span></button>`).join('');
}
export function updateStocks(){
  const on = unl('stocks'); $('#stLocked').hidden = on; $('#stBody').hidden = !on;
  setT($('#stLocked'), `La bolsa se desbloquea en el nivel ${lvReq('stocks')}. Estás en el ${S.level}.`);
  if (!on) return;
  buildStocks();
  const list = allStocks();
  if (!list.find(d => d.id === S.selStock)) S.selStock = 'CIE';
  setT($('#stComm'), sk('t7') ? '0 %' : '0,2 %');
  let val = 0, cost = 0;
  list.forEach(d => {
    const s = S.stocks[d.id], h = S.hold[d.id], row = $(`.st-row[data-s="${d.id}"]`); if (!s || !row) return;
    if (h && h.n > 0 && !d.own){ val += h.n*s.p; cost += h.cost; }
    const ref = s.hist[0] || s.p, ch = (s.p/ref - 1)*100;
    setT(row.querySelector('[data-r=p]'), money(s.p));
    const ce = row.querySelector('[data-r=ch]'); setT(ce, `${ch>=0?'+':''}${nf1.format(ch)} %`); ce.className = 'st-ch ' + (ch>=0?'t-up':'t-down');
    row.classList.toggle('sel', d.id === S.selStock);
    drawLine(row.querySelector('.spark'), s.hist, ch >= 0 ? '#1c9146' : '#d2382d', false);
  });
  setT($('#pfVal'), money(val));
  const pp = $('#pfPnl'); setT(pp, cost ? smoney(val - cost) : '—'); pp.className = 'val ' + (cost ? (val-cost >= 0 ? 't-up' : 't-down') : '');
  setT($('#pfDiv'), money(S.divs));
  const d = list.find(x => x.id === S.selStock), s = S.stocks[d.id], h = S.hold[d.id];
  setT($('#sdName'), d.name); setT($('#sdPrice'), money(s.p));
  const betaTxt = Object.keys(d.beta).map(k => `se mueve con el ${METALS[k].low}`).join(', ');
  setT($('#sdDesc'), `${d.sector}. ${d.desc}${betaTxt ? ` (${betaTxt}).` : ''}${d.div ? ` Dividendo: ${nf1.format(d.div*100*(sk('t7')?1.5:1))} % cada minuto.` : ''}`);
  const arr = S.stTf === 'long' ? s.long : s.hist, ch = (s.p/(arr[0]||s.p) - 1)*100;
  const sc = $('#sdCh'); setT(sc, `${ch>=0?'+':''}${nf1.format(ch)} % en ${S.stTf === 'long' ? '30 min' : '3 min'}`); sc.className = 'meta ' + (ch>=0?'t-up':'t-down');
  drawLine($('#stChart'), arr, '#ffc62e', true);
  $('#sdHold').innerHTML = h && h.n > 0
    ? `<b>${nf0.format(h.n)}</b> acciones · valen <b>${money(h.n*s.p)}</b>${d.own ? ` · el ${nf1.format(h.n/S.biz[d.bizId].pub.shares*100)} % de la empresa` : ` · ${smoney(h.n*s.p - h.cost)}`}`
    : 'No tienes acciones.';
  const n = Math.max(0, Math.floor(parseFloat($('#sQty').value) || 0));
  setT($('#sdCost'), n ? `${nf0.format(n)} acciones ≈ ${money(n*s.p*(1+stComm()))} al comprar · ${money(n*s.p*(1-stComm()))} al vender` : 'Elige cuántas acciones.');
}
$$('#stTf button').forEach(b => b.addEventListener('click', () => { S.stTf = b.dataset.tf; $$('#stTf button').forEach(x => x.classList.toggle('on', x === b)); updateUI(); }));
$$('#sPresets button').forEach(b => b.addEventListener('click', () => {
  const s = S.stocks[S.selStock];
  $('#sQty').value = b.dataset.n === 'max' ? Math.max(0, Math.floor(S.money/(s.p*(1+stComm())))) : b.dataset.n; updateUI();
}));
$('#sQty').addEventListener('input', () => updateUI());
$('#btnBuyS').addEventListener('click', () => buyStock(parseFloat($('#sQty').value)));
$('#btnSellS').addEventListener('click', () => sellStock(parseFloat($('#sQty').value)));
