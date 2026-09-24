import { K } from '../core/bus.js';
import { $, esc, setT } from '../core/dom.js';
import { fmtT, money, nf0, nf1, pfmt, weight } from '../core/format.js';
import { CLIENTS, METALS } from '../data/content.js';
import { whenTxt } from '../game/economy.js';
import { TRUST, chainBonus, cliOf, jobKind, maxJobs, trustLv } from '../game/jobs.js';
import { S, unl } from '../game/state.js';
import { icon, paintIcons } from './icons.js';

/* ================= encargos en pantalla =================
   El tablón (Mercado → Encargos) y la lista corta de la mina, desde donde se entrega. */
function ava(cid, sm){
  const C = cliOf(cid) || {ico: 'star', col: '#c9ab7c'};
  return `<span class="job-ava${sm ? ' sm' : ''}" style="--cc:${C.col}">${icon(C.ico)}</span>`;
}
function tagHtml(o){
  const J = jobKind(o);
  if (o.kind === 'cadena') return `<span class="job-tag k-cadena">Cadena ${(o.step || 0) + 1}/${o.steps}</span>`;
  return o.kind && o.kind !== 'normal' ? `<span class="job-tag k-${o.kind}">${J.name}</span>` : '';
}
function trustHtml(cid){ if (!cid) return ''; const t = trustLv(cid); return `<span class="job-trust t${t}" title="Encargos cumplidos con este cliente: ${(S.cli && S.cli[cid] ? S.cli[cid].n : 0)}">${'★'.repeat(t)}${'☆'.repeat(3 - t)} ${TRUST[t]}</span>`; }
function offerCard(o){
  const J = jobKind(o), pay = o.g*o.price;
  return `<div class="job k-${o.kind || 'normal'}" data-oid="${o.id}">${ava(o.cid)}
    <div class="job-main">
      <div class="job-top"><b>${esc(o.client)}</b>${tagHtml(o)}${trustHtml(o.cid)}</div>
      <div class="job-ask">Quiere <b>${weight(o.g)} de ${METALS[o.m].low}</b> a ${pfmt(o.m, o.price)} <span class="t-up">+${nf1.format(o.prem*100)} %</span></div>
      <div class="job-sub">Paga <b>${money(pay)}</b> · plazo <span data-r="due"></span> · si fallas, ${money(o.pen)}</div>
      ${o.steps ? `<div class="job-chain">${o.steps} entregas, cada una mayor que la anterior · al completarla, premio extra del ${nf0.format(J.bonus*100)} %</div>` : ''}
    </div>
    <div class="job-side"><span class="job-exp" data-r="exp"></span><div class="job-btns"><button type="button" class="btn sm btn-plain" data-act="reject" data-id="${o.id}" aria-label="Rechazar">✕</button><button type="button" class="btn sm btn-green" data-act="accept" data-id="${o.id}">Aceptar</button></div></div>
  </div>`;
}
function activeCard(c, mini){
  if (mini) return `<div class="mj" data-cid="${c.id}">${ava(c.cid, true)}<div class="mj-main"><span class="mj-txt"><b>${weight(c.g)} de ${METALS[c.m].low}</b> · ${esc(c.client)}</span><span class="bar mj-bar"><i data-r="prog"></i></span></div><span class="mj-left" data-r="left"></span><button type="button" class="btn sm btn-green" data-act="deliver" data-id="${c.id}" data-r="btn">Entregar</button></div>`;
  return `<div class="job active k-${c.kind || 'normal'}" data-cid="${c.id}">${ava(c.cid)}
    <div class="job-main">
      <div class="job-top"><b>${esc(c.client)}</b>${tagHtml(c)}</div>
      <div class="job-ask">${weight(c.g)} de ${METALS[c.m].low} a ${pfmt(c.m, c.price)} → <b>${money(c.g*c.price)}</b>${c.steps ? ` <span class="meta">(premio final ≈ ${money(chainBonus(c))})</span>` : ''}</div>
      <div class="job-prog"><span class="bar"><i data-r="prog"></i></span><span data-r="have"></span></div>
      <div class="job-prog time"><span class="bar"><i data-r="time"></i></span><span data-r="due"></span></div>
    </div>
    <div class="job-side"><button type="button" class="btn sm btn-green" data-act="deliver" data-id="${c.id}" data-r="btn">Entregar</button></div>
  </div>`;
}
function tickActive(root){
  S.contracts.forEach(c => {
    const row = root.querySelector(`[data-cid="${c.id}"]`); if (!row) return;
    const f = Math.min(1, S.stock[c.m]/c.g), ready = f >= 1, lf = Math.max(0, c.left/(c.time || c.left || 1));
    const pr = row.querySelector('[data-r=prog]'); if (pr){ pr.style.width = (f*100).toFixed(1) + '%'; pr.parentNode.classList.toggle('ok', ready); }
    const tm = row.querySelector('[data-r=time]'); if (tm){ tm.style.width = (lf*100).toFixed(1) + '%'; tm.parentNode.classList.toggle('late', c.left < 30); }
    const hv = row.querySelector('[data-r=have]'); if (hv) setT(hv, ready ? '¡Listo para entregar!' : `Tienes ${weight(Math.min(S.stock[c.m], c.g))} de ${weight(c.g)}`);
    const du = row.querySelector('[data-r=due]'); if (du) setT(du, `hasta ${whenTxt(c.left)} · ${fmtT(c.left)}`);
    const lt = row.querySelector('[data-r=left]'); if (lt){ setT(lt, fmtT(c.left)); lt.classList.toggle('late', c.left < 30); }
    const bt = row.querySelector('[data-r=btn]'); if (bt) bt.classList.toggle('cant', !ready);
    row.classList.toggle('ready', ready);
  });
}
export function updateJobsMarket(){
  const on = unl('contracts'); $('#conLocked').hidden = on; $('#conBody').hidden = !on; if (!on) return;
  const full = Math.floor(S.rep), half = S.rep - full >= .5;
  setT($('#stars'), '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0)));
  setT($('#repTxt'), `${nf1.format(S.rep)} de 5 · mejores precios cuanto más alta`);
  setT($('#jobCount'), `${S.contracts.length} de ${maxJobs()}`);
  const ol = $('#offList'), okey = 'k' + S.offers.map(o => o.id).join(',') + '|' + S.contracts.length;
  if (okey !== K.off){ K.off = okey; ol.innerHTML = S.offers.length ? S.offers.map(offerCard).join('') : '<p class="empty">No hay encargos en el tablón. Llegan cada minuto, más o menos.</p>'; paintIcons(ol); }
  S.offers.forEach(o => { const r = ol.querySelector(`[data-oid="${o.id}"]`); if (!r) return; setT(r.querySelector('[data-r=exp]'), `se va en ${fmtT(o.exp)}`); setT(r.querySelector('[data-r=due]'), whenTxt(o.time)); r.querySelector('[data-act=accept]').classList.toggle('cant', S.contracts.length >= maxJobs()); });
  const cl = $('#conList'), ckey = 'k' + S.contracts.map(c => c.id).join(',');
  if (ckey !== K.con){ K.con = ckey; cl.innerHTML = S.contracts.length ? S.contracts.map(c => activeCard(c)).join('') : '<p class="empty">Ningún encargo en curso. Acepta uno del tablón.</p>'; }
  tickActive(cl);
  const ck = Object.entries(S.cli || {}).map(([k, v]) => k + v.n).join();
  if (ck !== K.cli){
    K.cli = ck;
    $('#cliList').innerHTML = CLIENTS.map(C => { const R = (S.cli || {})[C.id], t = trustLv(C.id), open = C.m.some(m => S.opened[m]);
      return `<div class="cli${open ? '' : ' off'}">${ava(C.id, true)}<div><b>${C.name}</b> <span class="job-trust t${t}">${'★'.repeat(t)}${'☆'.repeat(3 - t)} ${TRUST[t]}</span><span class="fine">${C.txt} ${open ? `Pide ${C.m.map(m => METALS[m].low).join(' y ')}.` : `Pide ${C.m.map(m => METALS[m].low).join(' y ')}: abre esa mina para que llame.`}${R ? ` · Cumplidos: ${R.n}` : ''}</span></div></div>`; }).join('');
    paintIcons($('#cliList'));
  }
}
export function updateJobsMine(){
  const box = $('#mineJobs'), chip = $('#jobChip'), n = S.contracts.length, ready = S.contracts.filter(c => S.stock[c.m] >= c.g).length;
  box.hidden = !n; chip.hidden = !n;
  if (n){ setT(chip, ready ? `${ready} listo${ready > 1 ? 's' : ''}` : `${n} encargo${n > 1 ? 's' : ''}`); chip.classList.toggle('ready', ready > 0); }
  const key = 'k' + S.contracts.map(c => c.id).join(',');
  if (key !== K.jobs){ K.jobs = key; $('#mineJobList').innerHTML = S.contracts.map(c => activeCard(c, true)).join(''); }
  if (n) tickActive($('#mineJobList'));
}
