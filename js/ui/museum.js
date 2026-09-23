import { K, emit, sfx } from '../core/bus.js';
import { $, esc, setT } from '../core/dom.js';
import { nf0, nf1 } from '../core/format.js';
import { FINDS, FIND_SETS, RARITY, SECRETS, STRATA } from '../data/content.js';
import { visibleFinds } from '../game/finds.js';
import { S, findCount, setDone, stratumIdx } from '../game/state.js';
import { findSvg } from '../render/findArt.js';

/* ================= Museo de hallazgos ================= */
let muTab = 'all', muSel = null;
const TAB_COL = ['#c98b52', '#6f6a78', '#9a7f73', '#b8aecb', '#3f3a48', '#6a2e28'];
const stratumOf = f => Math.max(0, STRATA.findIndex(s => f.d < s.to));
const rangeTxt = i => `${nf0.format(i ? STRATA[i-1].to : 0)}–${i < 5 ? nf0.format(STRATA[i].to) + ' m' : '…'}`;
const artUrl = id => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(findSvg(id));

export function updateMuseo(){
  const n = findCount(), si = Math.max(0, stratumIdx());
  setT($('#muMeta'), `${n} de ${FINDS.length} encontrados · +${nf1.format(n*.5)} % a la producción`);
  S.museoSeen = n;
  const vis = new Set(visibleFinds().map(f => f.id));
  const key = [n, muTab, muSel, [...vis].join(), si, S.finds.topo ? 1 : 0, Object.keys(S.flags || {}).filter(k => k.startsWith('s_')).join()].join('|');
  if (K.museo === key) return; K.museo = key;
  // pestañas por estrato
  const tabs = [['all', `Todo · ${n}/${FINDS.length}`, '']].concat(STRATA.map((s, i) => {
    const list = FINDS.filter(f => stratumOf(f) === i), got = list.filter(f => S.finds[f.id]).length;
    const known = i <= si || got > 0;
    return [String(i), `${known ? s.name : '???'} · ${known ? got + '/' + list.length : '?'}`, TAB_COL[i]];
  }));
  $('#muTabs').innerHTML = tabs.map(([t, label, col]) => `<button type="button" role="tab" data-t="${t}" aria-selected="${t === muTab}" style="${col ? '--tc:' + col : ''}">${esc(label)}</button>`).join('');
  // piezas
  const list = FINDS.filter(f => muTab === 'all' || stratumOf(f) === +muTab);
  $('#muItems').innerHTML = list.map(f => {
    const R = RARITY[f.rar], got = S.finds[f.id], i = stratumOf(f), glow = vis.has(f.id);
    const style = `--rc:${got || glow ? R.col : '#6b4c30'}`;
    if (got) return `<button type="button" class="mu-it" data-fid="${f.id}" aria-pressed="${muSel === f.id}" style="${style}"><img src="${artUrl(f.id)}" alt=""><b>${esc(f.name)}</b><small>${nf0.format(f.d)} m · ${R.name}</small></button>`;
    if (glow) return `<button type="button" class="mu-it glow" data-go-find="${f.id}" style="${style}"><img src="${artUrl(f.id)}" alt=""><b>¡Brilla en la mina!</b><small>A ${nf0.format(f.d)} m · toca para ir</small></button>`;
    return `<div class="mu-it unk" style="${style}"><img src="${artUrl(f.id)}" alt=""><b>???</b><small>${f.night ? 'Solo de noche · ' : ''}${i <= si + 1 ? STRATA[i].name : '???'} · ${rangeTxt(i)}</small></div>`;
  }).join('');
  // ficha
  const d = $('#muDetail'), f = FINDS.find(x => x.id === muSel && S.finds[x.id]) || FINDS.filter(x => S.finds[x.id]).sort((a, b) => S.finds[b.id].t - S.finds[a.id].t)[0];
  if (!f){ d.style.setProperty('--rc', 'var(--line)'); d.innerHTML = '<p>Aún no has encontrado nada. Mientras tu mina baja, la roca deja ver cosas que brillan: tócalas para desenterrarlas.</p>'; }
  else {
    const R = RARITY[f.rar], got = S.finds[f.id], setK = Object.keys(FIND_SETS).find(k => FIND_SETS[k].items.includes(f.id));
    d.style.setProperty('--rc', R.col);
    d.innerHTML = `<div class="md-top"><img src="${artUrl(f.id)}" alt=""><div style="display:flex;flex-direction:column;gap:5px"><h3>${esc(f.name)}</h3><span class="md-rar">${R.name}</span></div></div>
      <p>${esc(f.txt)}</p>
      <span class="md-meta">Encontrado a ${nf0.format(got.d)} m · compañía nº ${got.co} · ${new Date(got.t).toLocaleDateString('es-ES')}${setK ? ` · colección ${FIND_SETS[setK].hidden && !setDone(setK) ? '???' : FIND_SETS[setK].name}` : ''}</span>`;
  }
  // colecciones
  $('#muSets').innerHTML = Object.entries(FIND_SETS).map(([k, St]) => {
    const got = St.items.filter(id => S.finds[id]).length, done = got === St.items.length, hide = St.hidden && !done;
    return `<div class="mu-set ${done ? 'done' : hide ? 'dark' : ''}"><div class="ms-top"><span>${hide ? '???' : St.name}</span><span>${got}/${St.items.length}</span></div>
      <div class="bar"><i style="width:${got/St.items.length*100}%"></i></div><small>${done ? 'Conseguido: ' : 'Completa: '}${hide ? '???' : St.reward}</small></div>`;
  }).join('');
  // secretos
  $('#muSecrets').innerHTML = SECRETS.map(s => S.flags[s.id]
    ? `<div class="mu-sec"><b>${esc(s.name)}</b><span>${esc(s.desc)}</span></div>`
    : '<div class="mu-sec unk"><b>???</b><span>Secreto por descubrir</span></div>').join('');
}
document.addEventListener('click', e => {
  const t = e.target.closest('#muTabs button'); if (t){ muTab = t.dataset.t; sfx('ui'); updateMuseo(); return; }
  const it = e.target.closest('.mu-it[data-fid]'); if (it){ muSel = it.dataset.fid; sfx('ui'); updateMuseo(); return; }
  const gf = e.target.closest('[data-go-find]'); if (gf) emit('focusFind', gf.dataset.goFind);
});
export function selectMuseoFind(id){ muSel = id; muTab = 'all'; K.museo = ''; }
