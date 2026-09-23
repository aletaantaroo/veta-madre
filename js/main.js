import { drawChart, emit, selectDesk, showSection, toast, updateUI } from './core/bus.js';
import { $, $$ } from './core/dom.js';
import { RM } from './core/settings.js';
import { MK, STOCKS } from './data/content.js';
import { simulate } from './game/economy.js';
import { findsStep } from './game/finds.js';
import { tick, warmMarkets } from './game/market.js';
import { miningStep } from './game/mining.js';
import { addXp } from './game/progress.js';
import { S, fresh, load, migrate, mk, save, setS } from './game/state.js';
import { resizeChart } from './render/charts.js';
import { render, resizeScene, sceneDebug } from './render/scene.js';
import { buildBiz } from './ui/biz.js';
import { buildFin } from './ui/finance.js';
import { fxFrame, fxResize, hudMoney } from './ui/fx.js';
import { startGuide } from './ui/guide.js';
import { paintIcons } from './ui/icons.js';
import { secOpen } from './ui/layout.js';
import { backup, backupTick, catchUp, openMenu, renderImport, renderReset } from './ui/menu.js';
import { applyShop, buildCrew } from './ui/mine.js';

/* ================= Veta Madre · arranque y bucle principal =================
   La lógica vive en game/, el dibujo en render/ y la interfaz en ui/. Se comunican por core/bus.js. */
import './ui/audio.js';
import './ui/toasts.js';
import './ui/fx.js';
import './ui/tutorial.js';
import './ui/layout.js';
import './ui/mine.js';
import './ui/market.js';
import './ui/finance.js';
import './ui/biz.js';
import './ui/stocks.js';
import './ui/skills.js';
import './ui/achievements.js';
import './ui/actions.js';
import './ui/menu.js';
import './ui/museum.js';
import './ui/findcard.js';
import './ui/guide.js';
import './render/scene.js';
import './render/charts.js';

let last = performance.now(), mAcc = 0, uiAcc = 0, saveAcc = 0;
function step(el){
  simulate(el);
  mAcc += el; let n = 0;
  while (mAcc >= 1 && n < 240){ mAcc -= 1; tick(true); n++; }
  if (n) drawChart();
  if (mAcc > 1) mAcc = 0;
  miningStep(el);
  findsStep(el);
  if ((saveAcc += el) > 5){ saveAcc = 0; save(); }
  backupTick(el);
}
function loop(now){
  const el = Math.max(0, (now - last)/1000); last = now;
  if (el > 5) catchUp(el, el > 60); else step(el);
  const dt = Math.min(el, .05);
  render(now/1000, dt);
  fxFrame(dt); hudMoney(dt);
  if ((uiAcc += el) > .25){ uiAcc = 0; updateUI(); }
  requestAnimationFrame(loop);
}
function boot(data){
  const fromHot = data && data.S;
  setS(fromHot ? migrate(data.S) : (load() || fresh()));
  const needWarm = MK.some(m => mk(m).candles.length < 20) || STOCKS.some(d => !S.stocks[d.id]);
  if (needWarm) warmMarkets();
  if (S.migrated){
    const lvBefore = S.level; addXp(Math.min(S.earned*0.5 + S.clicks, 3000), true); delete S.migrated;
    if (S.level > lvBefore) setTimeout(() => toast(`Tu partida pasa al sistema de niveles: empiezas en el nivel ${S.level} con ${S.sp} puntos de habilidad.`, 'lv'), 600);
  }
  backup('boot', true);
  const awayEl = fromHot ? 0 : (Date.now() - S.saved)/1000;
  paintIcons();
  buildCrew(); buildBiz(); buildFin(); renderReset(); applyShop();
  $('#autoSell').checked = !!S.autoSell;
  $$('#stTf button').forEach(x => x.classList.toggle('on', x.dataset.tf === S.stTf));
  new ResizeObserver(() => resizeChart()).observe($('#chartWrap'));
  resizeScene(); fxResize(); selectDesk('sell'); showSection(secOpen(S.section || 'mina') ? S.section || 'mina' : 'mina');
  document.body.classList.toggle('calm', RM); renderImport();
  if (awayEl > 10) catchUp(awayEl, true);
  else if (!fromHot && (S.clicks || S.earned)){
    $('#awayBox').innerHTML = '<span>Bienvenido de vuelta. Tu compañía te estaba esperando.</span>';
    $('#awayBox').hidden = false; openMenu('home');
  }
  else if (!fromHot) startGuide();   // primera partida: nada de menús, directo a picar con el capataz al lado
  requestAnimationFrame(t => { last = t; requestAnimationFrame(loop); });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);

if (/[?&]debug/.test(location.search)) window.VM = {S: () => S, emit, updateUI, scene: sceneDebug};
const hot = window.claude && window.claude.hot;
try { if (hot && hot.snapshot) hot.snapshot(() => ({S})); } catch(e){}
if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
