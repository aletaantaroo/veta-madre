import { $, setT } from '../core/dom.js';
import { clamp, fmtT, money, nf0, smoney } from '../core/format.js';
import { CATS_IN, CATS_OUT, RES } from '../data/content.js';
import { LOAN_RATE, capR, capRCost, estRates, isDay, loanLimit, mineCostMult, needs, openedMk, plantCost, plantOut, rPrice, rUnitFmt, repairCost, solarCost, solarOut, taxRate, util, windCost, windOut } from '../game/economy.js';
import { S, fac, has, lvReq, maintF, unl } from '../game/state.js';
import { fitCanvas } from '../render/charts.js';
import { paintIcons } from './icons.js';

/* ---- finanzas ---- */
export function buildFin(){
  $('#resList').innerHTML = ['e','f','x'].map(k => `<div class="res-card" data-res="${k}">
    <div class="res-top"><b><span data-icon="${{e:'bolt', f:'drop', x:'tnt'}[k]}"></span>${RES[k].name}</b><span class="meta" data-r="price">—</span></div>
    <div class="bar" data-r="barw"><i data-r="bar"></i></div>
    <span class="info" data-r="stock">—</span>
    <span class="info" data-r="use">—</span>
    ${k === 'e' ? '<label class="check"><input type="checkbox" data-chk="autoE" id="chkAutoE"> Comprar a la red lo que falte, al precio del momento</label><label class="check"><input type="checkbox" data-chk="chargeE" id="chkChargeE"> Cargar las baterías de noche, con la tarifa barata</label>'
      : `<label class="check"><input type="checkbox" data-chk="auto${k}" id="chkAuto${k}"> Reponer automáticamente cuando baje del 20 %</label>`}
    <div class="acts"><button type="button" class="btn sm btn-gold" data-act="resBuy" data-id="${k}" data-r="buy">Llenar</button><button type="button" class="btn sm btn-blue" data-act="resUp" data-id="${k}" data-r="up">Ampliar</button>${k === 'e' ? '<button type="button" class="btn sm btn-green" data-act="solar" data-r="solar">Panel solar</button><button type="button" class="btn sm btn-green" data-act="wind" data-r="wind">Aerogenerador</button>' : `<button type="button" class="btn sm btn-green" data-act="plant" data-id="${k}" data-r="plant">—</button>`}</div>
  </div>`).join('');
  paintIcons($('#resList'));
}
function drawBars(c, arr){
  const f = fitCanvas(c); if (!f) return; const {g, w, h} = f;
  g.font = '800 11px Nunito, ui-rounded, system-ui, sans-serif'; g.textBaseline = 'top';
  if (!arr.length){ g.fillStyle = '#8ea3cc'; g.fillText('Aún no hay ningún minuto completo.', 8, h/2 - 6); return; }
  const mx = Math.max(1, ...arr.map(Math.abs)), mid = h/2, bw = w/30;
  g.strokeStyle = 'rgba(149,163,157,.3)'; g.beginPath(); g.moveTo(0,mid); g.lineTo(w,mid); g.stroke();
  arr.forEach((v,i) => { const x = (30 - arr.length + i)*bw + 2, bh = Math.abs(v)/mx*(mid - 18); g.fillStyle = v >= 0 ? '#5fe08a' : '#ff7d72'; g.fillRect(x, v >= 0 ? mid - bh : mid, Math.max(2, bw - 4), Math.max(1, bh)); });
  g.fillStyle = '#b9c8e6'; g.fillText(`Último minuto: ${smoney(arr[arr.length-1])}`, 6, 4);
}
function barState(el, frac){ el.querySelector('i').style.width = clamp(frac*100,0,100) + '%'; el.classList.toggle('warn', frac < .5 && frac >= .2); el.classList.toggle('bad', frac < .2); }
export function updateFin(){
  const R = estRates(), N0 = needs(), cm = mineCostMult();
  const N = {e:N0.e*cm*util, f:N0.f*cm*util, x:N0.x*cm*util, sal:N0.sal*cm*(0.2+0.8*util), mv:N0.mv};
  const fn = $('#fNet'); setT(fn, smoney(R.net) + '/s'); fn.className = 'val ' + (R.net >= 0 ? 't-up' : 't-down');
  setT($('#fInc'), money(R.inc) + '/s'); setT($('#fExp'), money(R.exp) + '/s');
  const fd = $('#fDebt'); setT(fd, S.debt ? money(S.debt) : 'Sin deuda'); fd.className = 'val ' + (S.debt ? 't-down' : '');
  drawBars($('#finChart'), S.fin.hist);
  const hasLast = Object.keys(S.fin.last).length, src = hasLast ? S.fin.last : S.fin.cur;
  setT($('#plTitle'), hasLast ? 'Cuenta de resultados · último minuto' : `Cuenta de resultados · minuto en curso (${fmtT(S.fin.t)})`);
  let tin = 0, tout = 0;
  const row = ([k, l]) => { const v = src[k] || 0; return `<tr><td>${l}</td><td class="${v > 0 ? 't-up' : v < 0 ? 't-down' : 'zero'}">${v ? smoney(v) : '—'}</td></tr>`; };
  CATS_IN.forEach(([k]) => tin += src[k] || 0); CATS_OUT.forEach(([k]) => tout += src[k] || 0);
  $('#plTable').innerHTML = `<tr class="grp"><td>Ingresos</td><td>${smoney(tin)}</td></tr>${CATS_IN.map(row).join('')}<tr class="grp"><td>Gastos</td><td>${smoney(tout)}</td></tr>${CATS_OUT.map(row).join('')}<tr class="tot"><td>Resultado</td><td class="${tin+tout >= 0 ? 't-up' : 't-down'}">${smoney(tin + tout)}</td></tr>`;
  const dp = $('#dayPill'); setT(dp, (isDay() ? `Día · tarifa punta · noche en ${fmtT(120 - S.tarT)}` : `Noche · tarifa valle · día en ${fmtT(60 - S.tarT)}`) + ` · viento ${nf0.format(S.windF*100)} %`); dp.dataset.tone = isDay() ? 'down' : 'up';
  const use = {e:N.e, f:N.f, x:N.x};
  ['e','f','x'].forEach(k => {
    const card = $(`[data-res="${k}"]`); if (!card) return; const q = r => card.querySelector(`[data-r="${r}"]`);
    setT(q('price'), rUnitFmt(k, rPrice(k)));
    barState(q('barw'), S.res[k]/capR(k));
    setT(q('stock'), `En tu ${RES[k].store}: ${nf0.format(S.res[k])} de ${nf0.format(capR(k))} ${RES[k].unit}`);
    const base = {e:N0.e, f:N0.f, x:N0.x}[k];
    let u = !base ? `Aún no lo necesitas: lo usan ${RES[k].users}.` : use[k] < 1e-9 ? 'Máquinas paradas: tus almacenes están llenos, así que ahora no se gasta.' : `Consumo: ${nf0.format(use[k])} ${RES[k].unit}/s (${money(use[k]*rPrice(k))}/s) · cubierto al ${nf0.format(fac[k]*100)} %`;
    const own = k === 'e' ? solarOut() + windOut() : plantOut(k);
    if (own > 0 || (k === 'e' ? S.solar + S.wind : k === 'f' ? S.plants.bio : S.plants.fab)) u += ` · producción propia: ${nf0.format(own)} ${RES[k].unit}/s${k === 'e' ? ` (${S.solar} paneles, ${S.wind} aerogeneradores)` : ` (${k === 'f' ? S.plants.bio + ' plantas' : S.plants.fab + ' fábricas'}, gastan energía)`}`;
    setT(q('use'), u);
    const room = capR(k) - S.res[k], bb = q('buy'); setT(bb, room >= 1 ? `Llenar · ${money(room*rPrice(k))}` : 'Lleno'); bb.classList.toggle('cant', room < 1 || S.money < 1);
    const ub = q('up'); setT(ub, `Ampliar ×3 · ${money(capRCost(k))}`); ub.classList.toggle('cant', S.money < capRCost(k));
    if (k === 'e'){ const sb = q('solar'); setT(sb, `Panel solar · ${money(solarCost())}`); sb.classList.toggle('cant', S.money < solarCost());
      const wb = q('wind'); setT(wb, `Aerogenerador · ${money(windCost())}`); wb.classList.toggle('cant', S.money < windCost()); }
    else { const pb = q('plant'); setT(pb, `${k === 'f' ? 'Planta de biodiésel' : 'Fábrica de explosivos'} · ${money(plantCost(k))}`); pb.classList.toggle('cant', S.money < plantCost(k)); }
  });
  $('#chkAutoE').checked = !!S.auto.e; $('#chkChargeE').checked = !!S.auto.eCharge; $('#chkAutof').checked = !!S.auto.f; $('#chkAutox').checked = !!S.auto.x;
  $('#chkAutoPay').checked = !!S.autoPay; $('#chkMaint').checked = !!S.maintAuto;
  setT($('#moralTxt'), S.moral <= 0 ? 'Huelga' : `${nf0.format(S.moral)} %`); barState($('#moralBarW'), S.moral/100);
  setT($('#payInfo'), `Nómina: ${money(N.sal*60)} cada minuto${openedMk().length > 1 ? ` (${openedMk().length} minas: +50 % de plantilla por cada mina extra)` : ''} · próxima paga en ${fmtT(S.payT)}${S.arrears ? ` · atrasos: ${money(S.arrears)}` : ''}. Con los almacenes llenos la plantilla para y cobra solo el 20 %. Por debajo del 60 % de moral se rinde menos; a 0 hay huelga.`);
  const ba = $('#btnArrears'); ba.hidden = !S.arrears; setT(ba, `Pagar atrasos · ${money(S.arrears)}`);
  setT($('#maintTxt'), N.mv ? `${nf0.format(S.maint)} %` : '—'); barState($('#maintBarW'), N.mv ? S.maint/100 : 1);
  setT($('#maintInfo'), N.mv ? `Las máquinas se desgastan con el uso y rinden al ${nf0.format(maintF()*100)} %. ${has('u_taller') ? 'Tu taller reduce el desgaste a la mitad.' : ''}` : 'Solo se desgastan las máquinas (desde la vagoneta en adelante).');
  const rc = repairCost(), br = $('#btnRepair'); setT(br, rc > 0.01 ? `Reparar · ${money(rc)}` : 'Sin averías'); br.classList.toggle('cant', rc <= 0.01 || S.money < rc);
  const lOn = unl('loans'); $('#loanLocked').hidden = lOn; $('#loanBody').hidden = !lOn;
  setT($('#loanLocked'), `El banco te presta dinero a partir del nivel ${lvReq('loans')}.`);
  if (lOn){
    const lim = loanLimit(); $('#loanBar').style.width = clamp(S.debt/lim*100,0,100) + '%';
    setT($('#loanInfo'), `Debes ${money(S.debt)} de un límite de ${money(lim)} (sube con tu nivel). Intereses: ${money(S.debt*LOAN_RATE)} por minuto. Lo que no puedas pagar de impuestos o gastos también se suma a la deuda.`);
    ['bor25','bor50','bor100'].forEach(id => $('#'+id).classList.toggle('cant', lim - S.debt < 1));
    ['rep50','rep100'].forEach(id => $('#'+id).classList.toggle('cant', !S.debt || S.money <= 0));
  }
  const tOn = unl('taxes'); $('#taxLocked').hidden = tOn; $('#taxBody').hidden = !tOn;
  setT($('#taxLocked'), `Hacienda aún no sabe que existes. Empezarás a pagar impuestos en el nivel ${lvReq('taxes')}.`);
  if (tOn){ setT($('#taxRateTxt'), `${nf0.format(taxRate()*100)} % del beneficio`); setT($('#taxInfo'), `Próximo pago en ${fmtT(S.taxT)}. Beneficio acumulado: ${smoney(S.taxBase)} → pagarías ${money(Math.max(0,S.taxBase)*taxRate())}. Si pierdes dinero en el periodo, no pagas.`); }
}
