import { K } from '../core/bus.js';
import { $, setT } from '../core/dom.js';
import { fmtT, money, nf0, nf1, weight } from '../core/format.js';
import { BIZ } from '../data/content.js';
import { jewelEvery } from '../game/gems.js';
import { S, bizCost, bizCount, bizFull, bizInc, bizLvl, bizMult, bizTotal, jewelPrice, jewelRate, lvReq, mgrCost, ownFrac, refineBonus, sk, unl } from '../game/state.js';
import { building, cloud, tree } from '../render/sprites.js';
import { bizSel, selectBiz } from './city.js';

/* ---- empresas ---- */
export function buildBiz(){
  $('#bizGrid').innerHTML = BIZ.map(b => `<article class="card" data-b="${b.id}">
    <canvas class="card-art" data-r="art" aria-hidden="true"></canvas>
    <div class="card-head"><h3>${b.name}</h3><span class="lvl" data-r="lv"></span></div>
    <p>${b.desc}</p>
    <dl class="kv"><div><dt>Ingresos</dt><dd data-r="inc">—</dd></div><div><dt data-r="fxl">Efecto</dt><dd data-r="fx">—</dd></div></dl>
    <p class="boost" data-r="boost"></p>
    <div class="card-actions">
      <button type="button" class="btn sm primary" data-act="bizUp" data-id="${b.id}" data-r="up">—</button>
      <button type="button" class="btn sm" data-act="bizMgr" data-id="${b.id}" data-r="mgr">—</button>
      <button type="button" class="btn sm" data-act="bizIpo" data-id="${b.id}" data-r="ipo">Salir a bolsa</button>
      <button type="button" class="btn sm ghost" data-act="bizPause" data-id="${b.id}" data-r="pause" hidden>Pausar</button>
      <button type="button" class="btn sm ghost" data-act="jewelGems" data-r="gems" hidden>Gemas</button>
    </div></article>`).join('');
}
export function updateBiz(){
  const on = unl('biz'); $('#bizLocked').hidden = on; $('#bizBody').hidden = !on;
  setT($('#bizLocked'), `Las empresas se desbloquean en el nivel ${lvReq('biz')}. Estás en el ${S.level}: sigue minando y vendiendo para ganar experiencia.`);
  setT($('#bizSum'), `${bizCount()} de ${BIZ.length} · ingresan ${money(bizTotal())}/s`);
  if (!on) return;
  const sel = bizSel();
  const tk = BIZ.map(b => b.id + bizLvl(b.id) + (S.level >= b.lv ? 'a' : 'l') + (S.money >= bizCost(b) ? 'c' : '')).join() + sel;
  if (tk !== K.bizTabs){
    K.bizTabs = tk;
    $('#bizTabs').innerHTML = BIZ.map(b => { const lv = bizLvl(b.id), avail = S.level >= b.lv, can = avail && S.money >= bizCost(b);
      return `<button type="button" role="tab" data-biz="${b.id}" aria-selected="${b.id === sel}" class="${lv ? 'open' : avail ? 'sale' : 'locked'}${can ? ' can' : ''}"><b>${b.name}</b><small>${lv ? `nv ${lv}` : avail ? 'se vende' : `nivel ${b.lv}`}</small></button>`; }).join('');
  }
  BIZ.forEach(b => {
    const card = $(`[data-b="${b.id}"]`); if (!card) return;
    card.hidden = b.id !== sel; if (card.hidden) return;
    const st = S.biz[b.id] || {lv:0}, avail = S.level >= b.lv, q = r => card.querySelector(`[data-r="${r}"]`);
    card.classList.toggle('off', !avail);
    const art = q('art'), ak = Math.min(3, Math.floor((st.lv || 1)/8)) + '|' + (st.lv ? 1 : 0);
    if (art.dataset.k !== ak && art.offsetWidth){ art.dataset.k = ak; drawBizArt(art, b.id, st.lv || 1, !st.lv); }
    setT(q('lv'), st.lv ? `Nv ${st.lv}${st.mgr ? ' · con gerente' : ''}` : avail ? 'Sin abrir' : `Nivel ${b.lv}`);
    let inc = bizInc(b), fxl = 'Efecto', fx = '—';
    setT(card.querySelector('dt'), st.lv ? 'Ingresos' : 'Ingresos en nv 1');
    if (b.id === 'joyeria'){ const r = jewelRate(); inc += (S.stock.au > 0 ? r*jewelPrice()*ownFrac(b) : 0); fxl = 'Consume'; fx = st.lv ? (st.paused ? 'En pausa' : `${weight(r)}/s de oro`) : `${weight(0.08*1.06)}/s de oro`; }
    if (b.id === 'refineria'){ fxl = 'Precio de venta'; fx = `+${nf0.format(refineBonus()*100)} %`; }
    if (b.id === 'transporte'){ fxl = 'Cajas fuertes'; fx = `+${nf0.format(bizLvl('transporte')*20)} %`; }
    if (b.id === 'tec'){ fxl = 'Rendimiento'; fx = `${nf0.format(S.tecF*100)} %`; }
    if (st.pub){ fxl = 'Tu participación'; fx = `${nf1.format(ownFrac(b)*100)} %`; }
    setT(q('inc'), `${money(st.lv ? inc : b.inc*1.06*bizMult())}/s`);
    setT(q('fxl'), fxl); setT(q('fx'), fx);
    const bo = st.boost && st.boost.left > 0 ? st.boost : null;
    setT(q('boost'), bo ? `${bo.mult > 1 ? '▲' : '▼'} Ingresos ×${nf1.format(bo.mult)} durante ${fmtT(bo.left)}` : '');
    q('boost').className = 'boost ' + (bo ? (bo.mult > 1 ? 't-up' : 't-down') : '');
    const up = q('up'), c = bizCost(b);
    up.hidden = !avail; setT(up, st.lv >= 30 ? 'Nivel máximo' : `${st.lv ? 'Mejorar' : 'Abrir'} · ${money(c)}`); up.classList.toggle('cant', S.money < c || st.lv >= 30);
    const mg = q('mgr'); mg.hidden = !st.lv || st.mgr; setT(mg, `Gerente · ${money(mgrCost(b))}`); mg.classList.toggle('cant', S.money < mgrCost(b));
    const ipo = q('ipo'); ipo.hidden = !st.lv || st.pub || !unl('ipo');
    if (!ipo.hidden){ const ok = st.lv >= 5; setT(ipo, ok ? `Salir a bolsa · +${money(bizFull(b)*900*.4*(sk('e6')?1.3:1))}` : 'Salir a bolsa (nv 5)'); ipo.classList.toggle('cant', !ok); }
    const pz = q('pause'); pz.hidden = b.id !== 'joyeria' || !st.lv; setT(pz, st.paused ? 'Reanudar' : 'Pausar');
    const gz = q('gems'); gz.hidden = b.id !== 'joyeria' || !st.lv; setT(gz, S.jewelGems === false ? 'Engastar gemas: no' : `Engastar gemas: sí (1 cada ${jewelEvery()} s)`);
  });
}

function drawBizArt(cv, id, lv, ghost){
  const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), w = r.width, h = r.height;
  cv.width = Math.round(w*d); cv.height = Math.round(h*d);
  const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#79c6ff'); sky.addColorStop(1, '#d6f0ff'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
  cloud(g, w*.18, h*.3, .7); cloud(g, w*.82, h*.2, .55);
  g.fillStyle = '#a5dc86'; g.beginPath(); g.moveTo(0, h - 16); for (let x = 0; x <= w; x += 20) g.lineTo(x, h - 30 - Math.sin(x/60)*8); g.lineTo(w, h - 16); g.closePath(); g.fill();
  g.fillStyle = '#6cc24a'; g.fillRect(0, h - 17, w, 17); g.strokeStyle = '#2a1a0e'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, h - 17); g.lineTo(w, h - 17); g.stroke();
  tree(g, w*.1, h - 15, .85, 1); tree(g, w*.9, h - 15, .75, 0);
  const fl = 1 + Math.min(3, Math.floor(lv/8)), est = {joyeria: 33 + (fl-1)*10, refineria: 48 + (fl-1)*8, transporte: 36, inmo: 33 + (fl-1)*14, banco: 44 + (fl-1)*8, tec: 59 + (fl-1)*16}[id] || 40;
  if (ghost) g.globalAlpha = .55;
  building(g, id, w/2, h - 15, Math.min(1.7, (h - 26)/est), lv, 1, false);
  g.globalAlpha = 1;
}

$('#bizTabs').addEventListener('click', e => { const b = e.target.closest('[data-biz]'); if (b) selectBiz(b.dataset.biz); });
