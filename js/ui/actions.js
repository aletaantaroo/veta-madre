import { K, drawChart, selectDesk, sfx, toast, updateUI } from '../core/bus.js';
import { $ } from '../core/dom.js';
import { bizIpo, bizMgr, bizPause, bizUp } from '../game/biz.js';
import { borrow, buyPlant, buyRes, buySolar, buyWind, payArrears, repair, repay, upRes } from '../game/economy.js';
import { acceptOffer, closePos, deliver, sell } from '../game/market.js';
import { buyPerk, learn, prestige, respec } from '../game/progress.js';
import { openVein } from '../game/shop.js';
import { S } from '../game/state.js';
import { resetHover } from '../render/charts.js';
import { desk } from './market.js';
import { closeMenu, doImport, exportSave, openMenu, parseCode, renderImport } from './menu.js';
import { closeTut } from './tutorial.js';

/* ---- acciones globales ---- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const id = b.dataset.id, nid = +id;
  switch (b.dataset.act){
    case 'close': { const p = S.positions.find(x=>x.id===nid); if (p){ closePos(p,'manual'); updateUI(); } break; }
    case 'cancel': { const i = S.orders.findIndex(x=>x.id===nid); if (i>=0){ S.orders.splice(i,1); K.ord=''; drawChart(); updateUI(); } break; }
    case 'accept': acceptOffer(nid); break;
    case 'reject': { const i = S.offers.findIndex(x=>x.id===nid); if (i>=0){ S.offers.splice(i,1); K.off=''; updateUI(); } break; }
    case 'deliver': deliver(nid); break;
    case 'vein': openVein(b.dataset.m); break;
    case 'mkt': if (S.opened[b.dataset.m]){ S.mm = b.dataset.m; K.mkt = ''; resetHover(); if (desk === 'ord') selectDesk('ord'); drawChart(); updateUI(); } break;
    case 'qsell': sell(S.vein, +b.dataset.frac); updateUI(); break;
    case 'bizUp': bizUp(id); break;
    case 'bizMgr': bizMgr(id); break;
    case 'bizIpo': bizIpo(id); break;
    case 'bizPause': bizPause(id); break;
    case 'stock': S.selStock = id; $('#sErr').hidden = true; updateUI(); break;
    case 'skill': learn(id); break;
    case 'respec1': K.respec = true; updateUI(); break;
    case 'respec0': K.respec = false; updateUI(); break;
    case 'respec2': K.respec = false; respec(); break;
    case 'prest1': K.prest = true; updateUI(); break;
    case 'prest0': K.prest = false; updateUI(); break;
    case 'prest2': K.prest = false; prestige(); break;
    case 'resBuy': buyRes(id); break;
    case 'tutOk': closeTut(false); break;
    case 'tutGo': closeTut(true); break;
    case 'tutReset': S.tutSeen = {}; toast('Los tutoriales volverán a aparecer.'); break;
    case 'wind': buyWind(); break;
    case 'plant': buyPlant(id); break;
    case 'perk': buyPerk(id); break;
    case 'menu': openMenu(); break;
    case 'resume': closeMenu(); sfx('ui'); break;
    case 'exportSave': exportSave(); break;
    case 'import1': if (!parseCode()){ const er = $('#importErr'); er.textContent = 'Pega primero un código válido en el cuadro.'; er.hidden = false; } else { K.imp = true; renderImport(); } break;
    case 'import0': K.imp = false; renderImport(); break;
    case 'import2': doImport(); break;
    case 'resUp': upRes(id); break;
    case 'solar': buySolar(); break;
    case 'repair': repair(); break;
    case 'payArrears': payArrears(); break;
    case 'borrow': borrow(+b.dataset.frac); break;
    case 'repay': repay(+b.dataset.frac); break;
  }
});
$('#autoMineTh').addEventListener('change', e => { S.autoMine.th = +e.target.value; });
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.chk; if (!k) return; const v = e.target.checked;
  ({autoMine:()=>S.autoMine.on=v, autoE:()=>S.auto.e=v, chargeE:()=>S.auto.eCharge=v, autof:()=>S.auto.f=v, autox:()=>S.auto.x=v, autoPay:()=>S.autoPay=v, maintAuto:()=>S.maintAuto=v})[k]?.();
  updateUI();
});
