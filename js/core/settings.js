const SYS_RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SET_KEY = 'veta-madre-ajustes';
export let SET = {sound:'on', motion: SYS_RM ? 'calm' : 'full', toasts:'imp', tuts:'on', v:2};
/* v2: los avisos pasan a «Importantes» por defecto (antes salían todos). */
try { const o = JSON.parse(localStorage.getItem(SET_KEY) || '{}'); if (!(o.v >= 2)){ delete o.toasts; o.v = 2; } Object.assign(SET, o); } catch(e){}
export let RM = SET.motion === 'calm';
export function applyMotion(){ RM = SET.motion === 'calm'; }
export function saveSet(){ try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch(e){} }
