import { K } from '../core/bus.js';
import { $, setT } from '../core/dom.js';
import { fmtT, money, nf0, nf1, weight } from '../core/format.js';
import { BIZ, BIZ_STAGE_LV, DISTRICTS, ROMAN, VECINOS } from '../data/content.js';
import { bizFixedTotal } from '../game/economy.js';
import { jewelEvery } from '../game/gems.js';
import { S, axCost, bizCost, bizCount, bizFixed, bizFull, bizIncAll, bizLvl, bizMult, bizTotal, hasAx, jewelGold, jewelPct, mgrCost, ownFrac, refineBonus, sk, stageOf, unl, vecOn } from '../game/state.js';
import { LINK, LOCK_SVG, artOf, bizSel, fmtMult, updateCity } from './city.js';
import { icon } from './icons.js';

/* ================= ficha de la empresa elegida =================
   En el escritorio es el panel de madera de la derecha; en el móvil, una hoja que sale desde abajo (se puede plegar).
   Se redibuja entera cuando cambia algo de su estructura (nivel, etapa, anexos...) y los números se refrescan solos. */
const cpBox = $('#cpIn'), panel = $('#cityPanel');
const MGR_ICO = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="6.5" r="3.8" fill="#efe1c4" stroke="#2a1a0e" stroke-width="1.6"/><path d="M3 18a7 6 0 0 1 14 0z" fill="#efe1c4" stroke="#2a1a0e" stroke-width="1.6" stroke-linejoin="round"/></svg>';
export function buildBiz(){ panel.addEventListener('click', e => { if (e.target.closest('.cp-grip')){ panel.classList.toggle('min'); K.biz = ''; requestAnimationFrame(() => updateCity()); } }); }

/* Efecto propio de cada empresa (tercera casilla de la ficha). */
function fxOf(b, lv){
  const st = S.biz[b.id] || {};
  if (st.pub) return ['Tu parte', `${nf1.format(ownFrac(b)*100)} %`];
  switch (b.id){
    case 'joyeria': return ['Oro a joyas/s', lv ? (st.paused ? 'En pausa' : weight(jewelGold())) : `${nf1.format(jewelPct(1, false)*100)} %`];
    case 'refineria': return ['Precio del metal', `+${nf0.format(refineBonus()*100)} %`];
    case 'transporte': return ['Cajas fuertes', `+${nf0.format(((1 + .2*lv)*(hasAx('transporte', 'helipuerto') ? 1.25 : 1) - 1)*100)} %`];
    case 'tec': return ['Rendimiento', lv ? `${nf0.format(S.tecF*100)} %` : 'Muy variable'];
    case 'banco': return ['Rendimiento', 'Alto y fijo'];
    default: return ['Rendimiento', 'Estable'];
  }
}
const nextOf = lv => BIZ_STAGE_LV.find(l => l > lv);
function nextTxt(b, lv, s, avail){
  if (!lv) return avail ? `Ábrela por ${money(bizCost(b))}. Empieza como «${b.stages[0]}».` : `Se desbloquea en el nivel ${b.lv} (estás en el ${S.level}).`;
  if (s >= 5) return 'Etapa máxima: el edificio ya no crece más.';
  return `En el nv ${nextOf(lv)} pasa a «${b.stages[s]}»: +25 % de ingresos${s < 4 ? ' y un anexo nuevo' : ''}.`;
}
function panelHtml(b){
  const st = S.biz[b.id] || {lv: 0}, lv = st.lv || 0, s = stageOf(lv), avail = S.level >= b.lv;
  const ns = Math.min(5, Math.max(1, s + 1)), thumb = artOf(b, lv ? (s >= 5 ? 5 : ns) : 1, true);
  const pips = [1, 2, 3, 4, 5].map(i => `<i class="${i <= s ? 'on' : ''}"></i>`).join('');
  const built = b.anexos.filter(A => hasAx(b.id, A.id)).length;
  const ax = b.anexos.map((A, i) => {
    const isB = hasAx(b.id, A.id), open = lv && s >= i + 2, cls = isB ? 'built' : open ? 'buy' : 'locked';
    const tail = isB ? '<span class="ax-tag">Hecho</span>' : open ? `<button type="button" class="btn sm btn-gold" data-act="bizAnx" data-id="${b.id}" data-i="${i}" data-r="ax${i}">—</button>` : `<span class="ax-lock">${LOCK_SVG}Etapa ${ROMAN[i + 2]}</span>`;
    return `<div class="ax ${cls}"><span class="ax-st" style="${cls === 'buy' ? `background:${b.badge}` : ''}">${ROMAN[i + 2]}</span><span class="ax-tx"><b>${A.name}</b><small>${A.fx}</small></span>${tail}</div>`;
  }).join('');
  const vec = VECINOS.filter(V => V.a === b.id || V.b === b.id).map(V => {
    const o = BIZ.find(x => x.id === (V.a === b.id ? V.b : V.a)), on = vecOn(V);
    return `<div class="vec ${on ? 'on' : ''}"><span class="vec-i">${LINK}</span><span class="vec-tx"><b>${o.name}</b><small>${V.name}: ${V.txt}</small></span><span class="vec-tag">${on ? 'Activo' : bizLvl(o.id) ? 'Abre esta' : 'Sin abrir'}</span></div>`;
  }).join('');
  const ipoOk = unl('ipo') && lv;
  const extra = lv ? [
    st.mgr ? `<div class="cp-row ok">${MGR_ICO}<span>Gerente contratado: produce el doble${b.id === 'joyeria' ? ' y procesa más oro' : ''}</span><b>×2</b></div>`
           : `<div class="cp-row">${MGR_ICO}<span>Sin gerente: rinde la mitad</span><button type="button" class="btn sm btn-gold" data-act="bizMgr" data-id="${b.id}" data-r="mgr">—</button></div>`,
    ipoOk ? (st.pub ? `<div class="cp-row ok"><span class="cp-row-i">${icon('bull')}</span><span>Cotiza en bolsa: cobras el <b data-r="own">—</b> de sus beneficios</span></div>`
                    : `<div class="cp-row"><span class="cp-row-i">${icon('bull')}</span><span>Salir a bolsa: vendes el 40 % de golpe</span><button type="button" class="btn sm" data-act="bizIpo" data-id="${b.id}" data-r="ipo">—</button></div>`) : '',
    b.id === 'joyeria' ? `<div class="cp-row two"><button type="button" class="btn sm ghost" data-act="bizPause" data-id="joyeria">${st.paused ? 'Reabrir' : 'Cerrar'} la tienda</button><button type="button" class="btn sm ghost" data-act="jewelGems" data-r="gems">—</button></div>` : '',
  ].join('') : '';
  return `<button type="button" class="cp-grip" aria-label="Plegar o desplegar la ficha"><i></i></button>
  <div class="cp-head">
    <span class="cp-badge" style="background:${s ? b.badge : '#efe1c4'}">${s ? ROMAN[s] : LOCK_SVG}</span>
    <div class="cp-tt"><small>${DISTRICTS[b.district] ? DISTRICTS[b.district].name : ''}</small><h2>${b.name}</h2></div>
    <span class="cp-lv">${lv ? `Nv ${lv}` : avail ? 'En venta' : `Nivel ${b.lv}`}</span>
  </div>
  <p class="cp-desc">${b.desc}</p>
  <div class="cp-stage">
    <div class="cs-l">
      <small>${lv ? `Etapa ${ROMAN[s]} de V` : 'Sin abrir'}</small>
      <b>${lv ? b.stages[s - 1] : avail ? 'Solar en venta' : 'Solar cerrado'}</b>
      <div class="pips">${pips}</div>
      <div class="bar"><i data-r="prog"></i></div>
      <span class="cs-next">${nextTxt(b, lv, s, avail)}</span>
    </div>
    <div class="cs-thumb" style="background:${b.ground}"><svg viewBox="-6 -34 212 232" aria-hidden="true"><g stroke="#2a1a0e" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${thumb}</g></svg><span>${!lv ? 'Etapa I' : s >= 5 ? 'Máxima' : `Etapa ${ROMAN[ns]}`}</span></div>
  </div>
  <div class="cp-stats">
    <div><small>${lv ? 'Ingresos/s' : 'Ingresos/s nv 1'}</small><b class="t-up" data-r="inc">—</b></div>
    <div><small>Gastos fijos/s</small><b class="t-down" data-r="exp">—</b></div>
    <div><small data-r="fxl">—</small><b data-r="fx">—</b></div>
  </div>
  <p class="cp-ev" data-r="ev" hidden></p>
  <button type="button" class="btn big primary cp-up" data-act="bizUp" data-id="${b.id}" data-r="up">—</button>
  ${extra}
  <div class="cp-sec"><h3>Anexos</h3><small>${lv ? `${built} de 3 construidos` : 'Se abren con cada etapa'}</small></div>
  <div class="ax-list">${ax}</div>
  ${vec ? `<div class="cp-sec"><h3>Vecinos</h3><small>Bonus por compartir calle</small></div><div class="vec-list">${vec}</div>` : ''}`;
}

export function updateBiz(){
  updateCity();
  setT($('#csCount'), `${bizCount()} de ${BIZ.length} empresas`);
  setT($('#csInc'), `+${money(bizTotal())}/s`);
  setT($('#csExp'), `gastos −${money(bizFixedTotal())}/s`);
  const b = BIZ.find(x => x.id === bizSel()), st = S.biz[b.id] || {lv: 0}, lv = st.lv || 0, s = stageOf(lv), avail = S.level >= b.lv;
  const key = [b.id, lv, s, !!st.mgr, JSON.stringify(st.ax || {}), !!st.pub, !!st.paused, avail, unl('ipo'), VECINOS.map(vecOn).join(), bizLvl('banco') > 0].join('|');
  if (K.biz !== key){ K.biz = key; cpBox.innerHTML = panelHtml(b); }
  const q = r => cpBox.querySelector(`[data-r="${r}"]`);
  // números que cambian solos
  const inc = lv ? bizIncAll(b) : b.inc*1.06*bizMult();
  setT(q('inc'), `+${money(inc)}`);
  setT(q('exp'), `−${money(lv ? bizFixed(b) : b.inc*1.06*bizMult()*.3)}`);
  const [fl, fv] = fxOf(b, lv); setT(q('fxl'), fl); setT(q('fx'), fv);
  const pr = q('prog'); if (pr){ const a = s ? BIZ_STAGE_LV[s - 1] : 0, z = nextOf(lv); pr.style.width = `${s >= 5 ? 100 : !lv ? 0 : Math.round((lv - a)/(z - a)*100)}%`; }
  const bo = st.boost && st.boost.left > 0 ? st.boost : null, ev = q('ev');
  ev.hidden = !bo || !lv;
  if (bo){ ev.className = 'cp-ev ' + (bo.mult > 1 ? 'up' : 'down'); setT(ev, `${bo.mult > 1 ? '▲' : '▼'} ${bo.name || 'Evento'}: ingresos ×${fmtMult(bo.mult)} · quedan ${fmtT(bo.left)}`); }
  const up = q('up'), c = bizCost(b);
  setT(up, lv >= 30 ? 'Nivel máximo' : !avail ? `Se desbloquea en el nivel ${b.lv}` : lv ? `Mejorar a nv ${lv + 1} · ${money(c)}` : `Abrir · ${money(c)}`);
  up.classList.toggle('cant', !avail || lv >= 30 || S.money < c); up.disabled = !avail || lv >= 30;
  const mg = q('mgr'); if (mg){ const mc = mgrCost(b); setT(mg, `Contratar · ${money(mc)}`); mg.classList.toggle('cant', S.money < mc); }
  const ipo = q('ipo'); if (ipo){ const ok = lv >= 5; setT(ipo, ok ? `+${money(bizFull(b)*900*.4*(sk('e6') ? 1.3 : 1))}` : 'Desde nv 5'); ipo.classList.toggle('cant', !ok); }
  const own = q('own'); if (own) setT(own, `${nf1.format(ownFrac(b)*100)} %`);
  const gz = q('gems'); if (gz){ setT(gz, S.jewelGems === false ? 'Gemas: no' : `Gemas: 1 cada ${jewelEvery()} s`); gz.title = 'Engastar gemas en las joyas (valen el doble que sueltas)'; }
  b.anexos.forEach((A, i) => { const x = q('ax' + i); if (x){ const ac = axCost(b, i); setT(x, money(ac)); x.classList.toggle('cant', S.money < ac); } });
}
