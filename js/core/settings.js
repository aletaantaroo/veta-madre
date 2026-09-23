const SYS_RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SET_KEY = 'veta-madre-ajustes';
export let SET = {sound:'on', motion: SYS_RM ? 'calm' : 'full', toasts:'all', tuts:'on'};
try { Object.assign(SET, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch(e){}
export let RM = SET.motion === 'calm';
export function applyMotion(){ RM = SET.motion === 'calm'; }
export function saveSet(){ try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch(e){} }
