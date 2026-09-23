import { on } from '../core/bus.js';
import { SET } from '../core/settings.js';
import { silent } from '../game/progress.js';

/* Efectos de sonido sintetizados con WebAudio: nada que descargar. */
let AC = null, noiseBuf = null, lastPlay = {};
function ctx(){
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume();
  if (!noiseBuf){ noiseBuf = AC.createBuffer(1, AC.sampleRate*.5, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1; }
  return AC;
}
function tone(f, d, type = 'sine', vol = .06, at = 0, f2){
  const a = AC, t = a.currentTime + at, o = a.createOscillator(), gn = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + .012); gn.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(gn).connect(a.destination); o.start(t); o.stop(t + d + .03);
}
function noise(d, vol = .08, freq = 900, at = 0, q = .8){
  const a = AC, t = a.currentTime + at, src = a.createBufferSource(), f = a.createBiquadFilter(), gn = a.createGain();
  src.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + .008); gn.gain.exponentialRampToValueAtTime(.0001, t + d);
  src.connect(f).connect(gn).connect(a.destination); src.start(t); src.stop(t + d + .05);
}
let userActed = false;
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { userActed = true; }, {capture: true, once: true}));
function playSfx(kind){
  if (SET.sound !== 'on' || silent || !userActed) return;
  const now = performance.now(); if (now - (lastPlay[kind] || 0) < (kind === 'dig' ? 40 : 70)) return; lastPlay[kind] = now;
  try {
    ctx();
    switch (kind){
      case 'dig': noise(.09, .12, 700 + Math.random()*500); tone(150 + Math.random()*40, .09, 'triangle', .09, 0, 70); break;
      case 'sell': case 'coin': tone(988, .1, 'square', .025); tone(1319, .22, 'square', .03, .07); tone(1319*2, .15, 'sine', .02, .07); break;
      case 'buy': [523, 659, 784].forEach((f, i) => tone(f, .12, 'square', .025, i*.05)); tone(1046, .2, 'sine', .04, .15); break;
      case 'lv': [523, 659, 784, 1046].forEach((f, i) => tone(f, .22, 'square', .03, i*.09)); tone(1318, .5, 'sine', .05, .36); tone(1568, .5, 'sine', .03, .42); break;
      case 'ach': [784, 988, 1175, 1568].forEach((f, i) => tone(f, .18, 'triangle', .05, i*.07)); break;
      case 'bad': tone(180, .22, 'sawtooth', .035, 0, 110); break;
      case 'ui': tone(660, .05, 'sine', .04); break;
      case 'nugget': [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, .14, 'sine', .04, i*.05)); break;
      case 'sparkle': tone(2637, .12, 'sine', .015); tone(3136, .12, 'sine', .012, .08); break;
      case 'boom': noise(.6, .09, 260, 0, .5); tone(70, .4, 'sine', .08, 0, 40); break;
      case 'pop': tone(420, .08, 'sine', .05, 0, 900); break;
    }
  } catch(e){}
}
on('sfx', playSfx);
