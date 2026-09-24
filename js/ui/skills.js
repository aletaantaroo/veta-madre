import { K, on, sfx } from '../core/bus.js';
import { $, $$, setT } from '../core/dom.js';
import { BRANCHES, SKILLS, SYNERGIES, UNLOCKS, syn } from '../data/content.js';
import { skillReady } from '../game/progress.js';
import { S, sk } from '../game/state.js';
import { icon, paintIcons } from './icons.js';

/* ================= árbol de habilidades =================
   Cuatro ramas en pestañas. Cada rama baja por filas; la penúltima es una elección («o una o la otra»)
   y la última, la habilidad maestra. Debajo, las sinergias entre ramas. */
let brSel = null;
const branchOf = k => BRANCHES.find(B => B.k === k);
const spentIn = k => SKILLS.filter(s => s.b === k && sk(s.id)).reduce((a, s) => a + s.cost, 0);
function nodeState(s){
  if (sk(s.id)) return 'owned';
  if (s.ex && SKILLS.some(o => o.ex === s.ex && o.id !== s.id && sk(o.id))) return 'excluded';
  return skillReady(s) ? 'avail' : 'locked';
}
function nodeHtml(s){
  return `<button type="button" class="node${s.cap ? ' cap' : ''}${s.ex ? ' ex' : ''}" data-act="skill" data-id="${s.id}">
    ${s.cap ? '<span class="n-tag">Maestra</span>' : ''}
    <span class="n-name">${s.name}</span><span class="n-desc">${s.desc}</span>
    <span class="n-foot"><span class="n-cost">${s.cost} pt${s.cost > 1 ? 's' : ''}</span><span class="n-state"></span></span></button>`;
}
function buildBranch(k){
  const rows = [];
  for (let t = 0; t <= 5; t++){
    const list = SKILLS.filter(s => s.b === k && s.t === t); if (!list.length) continue;
    const ex = list.some(s => s.ex);
    rows.push(`<div class="trow${ex ? ' choice' : ''}${t === 5 ? ' last' : ''}">${ex ? '<span class="choice-lbl">Elige una</span>' : ''}${list.map(nodeHtml).join(ex ? '<span class="or">o</span>' : '')}</div>`);
  }
  const B = branchOf(k);
  $('#tree').innerHTML = `<div class="branch2 c-${B.col}"><p class="br-desc">${B.desc}</p>${rows.join('')}</div>`;
  $('#tree').dataset.b = k; K.tree = '';
}
function tabsHtml(){
  return BRANCHES.map(B => { const own = SKILLS.filter(s => s.b === B.k && sk(s.id)).length, tot = SKILLS.filter(s => s.b === B.k && !(s.ex && s.id.endsWith('9'))).length, cap = SKILLS.some(s => s.b === B.k && s.cap && sk(s.id));
    return `<button type="button" role="tab" class="br-tab c-${B.col}${cap ? ' mastered' : ''}" data-br="${B.k}" aria-selected="${B.k === brSel}"><span class="br-ico">${icon(B.ico)}</span><span class="br-txt"><b>${B.name}</b><small>${own}/${tot} · ${spentIn(B.k)} pts</small></span>${cap ? '<span class="br-crown">★</span>' : ''}</button>`; }).join('');
}
$('#brTabs').addEventListener('click', e => { const b = e.target.closest('[data-br]'); if (!b) return; brSel = b.dataset.br; S.brSel = brSel; sfx('ui'); K.brTabs = ''; buildBranch(brSel); updateTree(); });
function synHtml(){
  return SYNERGIES.map(X => {
    const on = syn(X.id);
    return `<div class="syn${on ? ' on' : ''}"><div class="syn-head"><b>${X.name}</b>${on ? '<span class="syn-on">Activa</span>' : ''}</div>
      <div class="syn-req">${X.req.map(id => { const s = SKILLS.find(x => x.id === id), B = branchOf(s.b); return `<span class="syn-sk c-${B.col}${sk(id) ? ' got' : ''}" data-br-go="${s.b}">${sk(id) ? '✓ ' : ''}${s.name}</span>`; }).join('<span class="plus">+</span>')}</div>
      <span class="syn-fx">${X.desc}</span></div>`;
  }).join('');
}
$('#synList').addEventListener('click', e => { const t = e.target.closest('[data-br-go]'); if (!t) return; brSel = t.dataset.brGo; S.brSel = brSel; K.brTabs = ''; buildBranch(brSel); updateTree(); $('#tree').scrollIntoView({block: 'nearest', behavior: 'smooth'}); });
export function updateTree(){
  if (!brSel) brSel = S.brSel || 'm';
  if ($('#tree').dataset.b !== brSel) buildBranch(brSel);
  setT($('#spNum'), String(S.sp));
  const key = SKILLS.map(s => sk(s.id) ? 1 : 0).join('') + '|' + S.sp + '|' + brSel;
  if (key !== K.brTabs){ K.brTabs = key; $('#brTabs').innerHTML = tabsHtml(); paintIcons($('#brTabs')); $('#synList').innerHTML = synHtml(); }
  $$('#tree .node').forEach(el => {
    const s = SKILLS.find(x => x.id === el.dataset.id), st = nodeState(s);
    if (!el.classList.contains(st)){ el.classList.remove('owned', 'avail', 'locked', 'excluded'); el.classList.add(st); }
    const need = s.req.filter(r => !sk(r)).map(r => SKILLS.find(x => x.id === r).name);
    const txt = st === 'owned' ? 'Aprendida' : st === 'excluded' ? 'Descartada' : st === 'locked' ? (need.length ? 'Requiere ' + need.join(' y ') : 'Elige una de arriba') : S.sp >= s.cost ? 'Aprender' : `Faltan ${s.cost - S.sp} pts`;
    setT(el.querySelector('.n-state'), txt);
    el.classList.toggle('afford', st === 'avail' && S.sp >= s.cost);
  });
  $('#road').innerHTML = UNLOCKS.map(u => `<li class="${S.level >= u.lv ? 'done' : ''}"><b>Nv ${u.lv}</b><span>${u.txt}</span></li>`).join('');
  const box = $('#respecBox'), spent = SKILLS.some(s => sk(s.id)), rk = spent + '|' + K.respec;
  if (box.dataset.k !== rk){
    box.dataset.k = rk;
    box.innerHTML = !spent ? '' : !K.respec
      ? '<button type="button" class="btn sm ghost" data-act="respec1" id="btnRespec">Reasignar puntos</button>'
      : `<span>Cuesta el 10 % de tu caja.</span><button type="button" class="btn sm danger" data-act="respec2" id="btnRespecYes">Reasignar</button><button type="button" class="btn sm ghost" data-act="respec0" id="btnRespecNo">Cancelar</button>`;
  }
}
on('synergy', () => { K.brTabs = ''; });
