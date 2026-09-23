import { K } from '../core/bus.js';
import { $, $$, setT } from '../core/dom.js';
import { BRANCHES, SKILLS, UNLOCKS } from '../data/content.js';
import { S, sk } from '../game/state.js';

/* ---- habilidades ---- */
let treeBuilt = false;
function buildTree(){
  $('#tree').innerHTML = BRANCHES.map(B => {
    const tiers = [0,1,2,3].map(t => `<div class="tier">${SKILLS.filter(s => s.b === B.k && s.t === t).map(s =>
      `<button type="button" class="node" data-act="skill" data-id="${s.id}"><span class="n-name">${s.name}</span><span class="n-desc">${s.desc}</span><span class="n-foot"><span class="n-cost">${s.cost} pt${s.cost>1?'s':''}</span><span class="n-state"></span></span></button>`).join('')}</div>`).join('');
    return `<div class="branch"><div class="branch-head"><h3>${B.name}</h3><p>${B.desc}</p></div>${tiers}</div>`;
  }).join('');
  treeBuilt = true;
}
export function updateTree(){
  if (!treeBuilt) buildTree();
  setT($('#spNum'), String(S.sp));
  $$('.node').forEach(el => {
    const s = SKILLS.find(x => x.id === el.dataset.id), own = sk(s.id), reqOk = s.req.every(sk);
    const cls = own ? 'owned' : reqOk ? 'avail' : 'locked';
    if (!el.classList.contains(cls)){ el.classList.remove('owned','avail','locked'); el.classList.add(cls); }
    const state = own ? 'Aprendida' : !reqOk ? 'Requiere ' + s.req.filter(r=>!sk(r)).map(r => SKILLS.find(x=>x.id===r).name).join(' y ') : S.sp >= s.cost ? 'Aprender' : 'Faltan puntos';
    setT(el.querySelector('.n-state'), state);
  });
  $('#road').innerHTML = UNLOCKS.map(u => `<li class="${S.level >= u.lv ? 'done' : ''}"><b>Nv ${u.lv}</b><span>${u.txt}</span></li>`).join('');
  const box = $('#respecBox'), spent = SKILLS.some(s => sk(s.id)), key = spent + '|' + K.respec;
  if (box.dataset.k !== key){
    box.dataset.k = key;
    box.innerHTML = !spent ? '' : !K.respec
      ? '<button type="button" class="btn sm ghost" data-act="respec1" id="btnRespec">Reasignar puntos</button>'
      : `<span>Cuesta el 10 % de tu caja.</span><button type="button" class="btn sm danger" data-act="respec2" id="btnRespecYes">Reasignar</button><button type="button" class="btn sm ghost" data-act="respec0" id="btnRespecNo">Cancelar</button>`;
  }
}
