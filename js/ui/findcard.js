import { emit, on, sfx, showSection, toast } from '../core/bus.js';
import { $, setT } from '../core/dom.js';
import { money, nf0 } from '../core/format.js';
import { FIND_SETS, RARITY, STRATA } from '../data/content.js';
import { secret } from '../game/finds.js';
import { S } from '../game/state.js';
import { findSvg } from '../render/findArt.js';
import { selectMuseoFind } from './museum.js';

/* Tarjeta al desenterrar un hallazgo y cartel al llegar a un estrato nuevo. */
const cardQ = [];
let cardCur = null, bannerT = 0;
const FX_TXT = {luck: 'Pepitas ×4 durante 10 min', nugget: 'Aparece una pepita', topo: 'El topo vendrá a verte', moral: 'Moral al 100 %', rep: '+1 estrella de reputación', spy: 'Ves venir al rival', legacy: '+1 lingote de legado'};
const ST_TXT = ['', 'Goteras, murciélagos y fósiles muy antiguos.', 'Roca dura y muy vieja. Aquí están la plata y el cobre.', 'Más duro de picar, pero esconde cristales y cofres.', 'Hace calor y se oye agua. Hay un lago escondido.', 'Ríos de lava. Aquí solo llegan los valientes.'];
const ST_COL = ['#c98b52', '#6f6a78', '#9a7f73', '#b8aecb', '#3f3a48', '#8e3a24'];

function showCard(f, cash){
  if (cardCur){ cardQ.push([f, cash]); return; }
  cardCur = f;
  const R = RARITY[f.rar], box = $('#fcardBox'), setK = Object.keys(FIND_SETS).find(k => FIND_SETS[k].items.includes(f.id));
  box.className = 'fcard r-' + f.rar;
  box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
  setT($('#fcRib'), f.rar === 'l' ? '¡Hallazgo legendario!' : f.rar === 'e' ? '¡Hallazgo épico!' : f.rar === 'r' ? '¡Hallazgo raro!' : 'Hallazgo');
  $('#fcImg').src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(findSvg(f.id));
  setT($('#fcName'), f.name);
  setT($('#fcWhere'), `${nf0.format(f.d)} m · ${STRATA[Math.max(0, STRATA.findIndex(s => f.d < s.to))].name} · ${R.name}`);
  setT($('#fcTxt'), f.txt);
  const chips = [`<span class="cash">+${money(cash)}</span>`];
  if (f.fx && FX_TXT[f.fx]) chips.push(`<span class="fx">${FX_TXT[f.fx]}</span>`);
  if (setK){ const St = FIND_SETS[setK], got = St.items.filter(id => S.finds[id]).length; chips.push(`<span>${St.hidden && got < St.items.length ? '???' : St.name} ${got}/${St.items.length}</span>`); }
  $('#fcChips').innerHTML = chips.join('');
  setT($('#fcOk'), f.id === 'centro' && !S.flags.s_campana ? 'Tocar la campanilla' : '¡Genial!');
  $('#fcard').hidden = false;
  if (f.rar === 'e' || f.rar === 'l') emit('fxBurst', innerWidth/2, innerHeight*.35, R.col);
  setTimeout(() => $('#fcOk').focus(), 50);
}
function closeCard(toMuseo){
  const f = cardCur; if (!f) return;
  if (!toMuseo && f.id === 'centro' && !S.flags.s_campana){ secret('s_campana'); sfx('coin'); toast('Ding, dong… Nadie contesta. Vuelve en otra era geológica.', 'lv'); }
  $('#fcard').hidden = true; cardCur = null;
  if (toMuseo){ cardQ.length = 0; selectMuseoFind(f.id); showSection('museo'); return; }
  if (cardQ.length) setTimeout(() => showCard(...cardQ.shift()), 250);
}
$('#fcOk').addEventListener('click', () => { sfx('ui'); closeCard(false); });
$('#fcMuseo').addEventListener('click', () => { sfx('ui'); closeCard(true); });
$('#fcard').addEventListener('click', e => { if (e.target.id === 'fcard') closeCard(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && cardCur){ e.stopImmediatePropagation(); closeCard(false); } }, true);

function showBanner(si){
  const b = $('#stBanner');
  if (!$('#lvup').hidden || !$('#fcard').hidden){ clearTimeout(bannerT); bannerT = setTimeout(() => showBanner(si), 1500); return; }
  b.style.setProperty('--sbc', ST_COL[si]);
  setT($('#sbName'), `${STRATA[si].name} · ${nf0.format(STRATA[si-1] ? STRATA[si-1].to : 0)} m`);
  setT($('#sbTxt'), ST_TXT[si] || '');
  b.classList.remove('out'); b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  sfx('ach'); clearTimeout(bannerT);
  bannerT = setTimeout(() => { b.classList.add('out'); setTimeout(() => { b.hidden = true; b.classList.remove('out'); }, 450); }, 3800);
}
on('found', showCard);
on('stratum', si => { if (si > 0){ lastSi = si; showBanner(si); } });
let lastSi = 0;
on('celebrate', () => { const b = $('#stBanner'); if (b.hidden || !lastSi) return; b.hidden = true; clearTimeout(bannerT); bannerT = setTimeout(() => showBanner(lastSi), 2700); });
