import { K } from '../core/bus.js';
import { $, setT } from '../core/dom.js';
import { fmtHMS } from '../core/format.js';
import { ACH, MILESTONES, PERKS, runT } from '../data/content.js';
import { S, legAvail, legacyGain, lvReq } from '../game/state.js';

/* ---- logros y prestigio ---- */
export function updateAch(){
  if (K.ach){
    K.ach = false;
    $('#achGrid').innerHTML = ACH.filter(a => !a.timed && !a.cond).map(a => a.secret && !S.ach[a.id] ? '<div class="ach"><b>???</b><span>Logro secreto. Búscalo por la mina.</span></div>' : `<div class="ach ${S.ach[a.id] ? 'done' : ''}"><b>${S.ach[a.id] ? '★ ' : ''}${a.name}</b><span>${a.desc}</span></div>`).join('');
  }
  setT($('#runMeta'), S.runStart ? `Tiempo de esta compañía: ${fmtHMS(runT())}` : 'Esta compañía es anterior al contrarreloj: tus tiempos cuentan desde la próxima');
  $('#timedGrid').innerHTML = ACH.filter(a => a.timed || a.cond).map(a => {
    const done = S.ach[a.id], t = runT();
    let st, cls;
    if (done){ st = 'Conseguido'; cls = 'done'; }
    else if (a.timed){ if (t > a.timed){ st = S.runStart ? 'Fuera de tiempo en esta compañía' : 'Disponible en tu próxima compañía'; cls = 'fail'; } else { st = `Quedan ${fmtHMS(a.timed - t)}`; cls = 'run'; } }
    else { if (a.failed()){ st = 'Roto en esta compañía'; cls = 'fail'; } else { st = 'En curso'; cls = 'run'; } }
    return `<div class="ach ${cls}"><b>${done ? '★ ' : ''}${a.name}</b><span>${a.desc}</span><em>${st}</em></div>`;
  }).join('');
  setT($('#shopMeta'), `${legAvail()} lingotes sin gastar de ${S.legacy}`);
  const pkey = legAvail() + '|' + Object.keys(S.perks).join(), pg = $('#perkGrid');
  if (pg.dataset.k !== pkey){
    pg.dataset.k = pkey;
    pg.innerHTML = PERKS.map(pk => { const own = S.perks[pk.id], can = legAvail() >= pk.cost;
      return `<div class="ach perk ${own ? 'done' : ''}"><b>${own ? '★ ' : ''}${pk.name}</b><span>${pk.desc}</span>${own ? '<em>Comprada</em>' : `<button type="button" class="btn sm ${can ? 'primary' : 'cant'}" data-act="perk" data-id="${pk.id}">${pk.cost} lingotes</button>`}</div>`; }).join('');
  }
  $('#records').innerHTML = MILESTONES.map(([k, label]) => `<li class="${S.records[k] ? 'done' : ''}"><b>${S.records[k] ? fmtHMS(S.records[k]) : '—'}</b><span>${label}</span></li>`).join('');
  const n = Object.keys(S.ach).length;
  setT($('#achMeta'), `${n} de ${ACH.length} · +${n} % a producción, clics y empresas`);
  setT($('#legacyMeta'), S.legacy ? `${S.legacy} lingotes (${legAvail()} sin gastar) · +${legAvail()*5} % a todo` : 'Aún no has vendido ninguna compañía');
  const gain = legacyGain(), lvOk = S.level >= lvReq('prestige'), ok = lvOk && gain >= 1;
  const key = [gain, lvOk, K.prest, S.legacy].join('|'), box = $('#prest');
  if (box.dataset.k !== key){
    box.dataset.k = key;
    box.innerHTML = `<div><p class="info">Vende todo (mina, empresas, acciones y habilidades) y funda una compañía nueva. A cambio recibes <b>lingotes de legado</b>: cada uno sin gastar da un +5 % permanente a todo, o puedes gastarlos en la tienda de legado. Empiezas con algo de capital y conservas logros, récords y ventajas.</p>
      <p class="info" style="margin-top:8px">Lingotes que recibirías ahora: <b>${gain}</b> (dependen de la raíz cuadrada de lo ingresado en esta compañía: 1 por cada millón, 10 por 100 millones…).</p></div>
      <div class="prest-acts"><span class="big">+${gain}</span>${!lvOk ? `<span class="info">Disponible en el nivel ${lvReq('prestige')}.</span>` : gain < 1 ? '<span class="info">Necesitas haber ingresado al menos 1 M€ en esta compañía.</span>' : ''}
      ${ok && !K.prest ? '<button type="button" class="btn primary" data-act="prest1" id="btnPrest">Vender la compañía</button>' : ''}
      ${ok && K.prest ? '<span class="info">Se reinicia todo salvo logros y lingotes.</span><div class="confirm"><button type="button" class="btn danger" data-act="prest2" id="btnPrestYes">Sí, vender y empezar</button><button type="button" class="btn ghost" data-act="prest0" id="btnPrestNo">Cancelar</button></div>' : ''}</div>`;
  }
}
