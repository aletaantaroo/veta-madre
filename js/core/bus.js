/* Bus de eventos: la lógica del juego avisa y la interfaz decide cómo mostrarlo. */
const HANDLERS = {};
export function on(k, f){ (HANDLERS[k] ||= []).push(f); }
export function emit(k, ...a){ const l = HANDLERS[k]; if (l) for (const f of l) f(...a); }

/* Claves de caché de la interfaz: vaciarlas obliga a redibujar esa parte. */
export const K = {nav:'', vein:'', mkt:'', up:'', biz:'', st:'', pos:'', ord:'', off:'', con:'', museo:'', log:true, ach:true, respec:false, prest:false, imp:false};
export function resetKeys(){ for (const k in K) K[k] = typeof K[k] === 'boolean' ? (k === 'log' || k === 'ach') : ''; }

/* Llamadas que la lógica hace a la interfaz, sin conocerla. */
export const updateUI = () => emit('ui');
export const drawChart = () => emit('chart');
/* lvl: 'imp' importante · 'ok' respuesta a lo que acabas de hacer · 'err' por qué no ha pasado · 'info' el día a día (solo campana). */
export const toast = (msg, tone, lvl) => emit('toast', msg, tone, lvl);
export const sfx = k => emit('sfx', k);
export const bump = sel => emit('bump', sel);
export const setTicker = (txt, tone, sel) => emit('ticker', txt, tone, sel);
export const showSection = k => emit('section', k);
export const selectDesk = k => emit('desk', k);
export const syncLamps = () => emit('crew');
export const queueTut = k => emit('tut', k);
