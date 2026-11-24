// Background music: an original funky game-show groove, synthesised live with Web Audio.
// No audio files, so there is nothing to license. Soft by default.
const BPM = 108, STEP = 60 / BPM / 4, SWING = 0.16; // 16th notes, light swing
const VOL = 0.16;
let ctx = null, master = null, bus = null, noiseBuf = null;
let timer = null, nextT = 0, step = 0;
let wanted = false, ducked = false, muted = false;
try { muted = localStorage.getItem("reelsmart-mute") === "1" } catch (e) { }

const hz = m => 440 * Math.pow(2, (m - 69) / 12);
// 8-bar loop. Chords as MIDI notes: Em9, A13, Dm9, G13, Em9, A13, Cmaj7, B7#9
const CHORDS = [[52, 55, 59, 62, 66], [55, 59, 61, 64, 66], [50, 53, 57, 60, 64], [53, 57, 59, 62, 64],
  [52, 55, 59, 62, 66], [55, 59, 61, 64, 66], [48, 52, 55, 59, 62], [51, 54, 57, 62, 63]];
const ROOTS = [40, 45, 38, 43, 40, 45, 36, 35];
// Bass: semitone offset from the root per 16th step (null = rest), syncopated funk line
const BASS = [0, null, null, 12, null, null, 0, null, 10, null, 12, null, 7, null, 10, 0];
const KICK = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0];
const SNARE = [0, 0, 0, 0, 1, 0, 0, .25, 0, .2, 0, 0, 1, 0, 0, .3];
const STAB = [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0];
// Brass riff on bars 4 and 8: [step, midi, length in steps]
const RIFF4 = [[0, 76, 1], [2, 79, 1], [3, 81, 2], [6, 79, 1], [8, 83, 2], [11, 81, 1], [12, 79, 3]];
const RIFF8 = [[0, 76, 1], [2, 78, 1], [4, 79, 1], [6, 81, 1], [8, 83, 1], [10, 86, 2], [12, 88, 4]];

function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
  bus = ctx.createGain(); bus.connect(comp); comp.connect(master); master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec) }
function kick(t) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + .12);
  env(g, t, .002, .9, .25); o.connect(g); g.connect(bus); o.start(t); o.stop(t + .3);
}
function noise(t, v, type, f, dec) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf;
  fl.type = type; fl.frequency.value = f; env(g, t, .001, v, dec); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t); s.stop(t + dec + .05);
}
function snare(t, v) { noise(t, .5 * v, "bandpass", 1800, .14); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 190; env(g, t, .001, .25 * v, .08); o.connect(g); g.connect(bus); o.start(t); o.stop(t + .12) }
function bass(t, m, len) {
  const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.value = hz(m);
  f.type = "lowpass"; f.Q.value = 8; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(220, t + .14);
  env(g, t, .004, .38, len); o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + len + .05);
}
function stab(t, notes) {
  const f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "lowpass"; f.frequency.value = 2400; env(g, t, .004, .07, .16); f.connect(g); g.connect(bus);
  for (const m of notes) for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = hz(m + 12); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + .22) }
}
function pad(t, notes, len) {
  const f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "lowpass"; f.frequency.value = 900;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(.035, t + .3); g.gain.linearRampToValueAtTime(0.0001, t + len); f.connect(g); g.connect(bus);
  for (const m of notes) { const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = hz(m); o.connect(f); o.start(t); o.stop(t + len + .05) }
}
function brass(t, m, len) {
  const f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = "lowpass"; f.Q.value = 2;
  f.frequency.setValueAtTime(600, t); f.frequency.linearRampToValueAtTime(3200, t + .05); f.frequency.linearRampToValueAtTime(1500, t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(.11, t + .03); g.gain.setValueAtTime(.09, t + len * .8); g.gain.linearRampToValueAtTime(0.0001, t + len + .06);
  f.connect(g); g.connect(bus);
  for (const det of [-9, 0, 9]) { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(m); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + len + .1) }
}
function schedule(s, t) {
  const bar = Math.floor(s / 16) % 8, i = s % 16, len16 = STEP;
  if (i === 0) pad(t, CHORDS[bar], STEP * 16);
  if (KICK[i]) kick(t);
  if (SNARE[i]) snare(t, SNARE[i]);
  noise(t, i % 4 === 2 ? .09 : .045, "highpass", 7500, i % 4 === 2 ? .12 : .035);
  if (BASS[i] !== null) bass(t, ROOTS[bar] + BASS[i], len16 * 1.6);
  if (STAB[i] && bar % 4 !== 3) stab(t, CHORDS[bar].slice(1, 4));
  const riff = bar === 3 ? RIFF4 : bar === 7 ? RIFF8 : null;
  if (riff) for (const [st, m, l] of riff) if (st === i) brass(t, m - 12, l * STEP * .95);
}
function tick() {
  while (nextT < ctx.currentTime + 0.12) {
    schedule(step, nextT + (step % 2 ? SWING * STEP : 0));
    step++; nextT += STEP;
  }
}
function apply() {
  if (!ctx) return;
  const on = wanted && !ducked && !muted && !document.hidden, t = ctx.currentTime;
  master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t);
  if (on) {
    if (ctx.state === "suspended") ctx.resume();
    if (!timer) { nextT = ctx.currentTime + .05; timer = setInterval(tick, 25) }
    master.gain.linearRampToValueAtTime(VOL, t + 1.2);
  } else {
    master.gain.linearRampToValueAtTime(0, t + .4);
    if (timer) { const tm = timer; timer = null; setTimeout(() => clearInterval(tm), 450) }
  }
}
// Browsers only allow sound after the first tap or key press.
function unlock() { if (init()) { if (ctx.state === "suspended") ctx.resume(); apply() } }
["pointerdown", "keydown", "touchstart"].forEach(e => window.addEventListener(e, unlock, { capture: true, passive: true }));
document.addEventListener("visibilitychange", apply);

const listeners = new Set();
export const music = {
  // Should music be playing on this screen?
  want(on) { wanted = !!on; apply() },
  // Pause while a clip plays.
  duck(on) { ducked = !!on; apply() },
  isMuted: () => muted,
  setMuted(m) { muted = !!m; try { localStorage.setItem("reelsmart-mute", muted ? "1" : "0") } catch (e) { } listeners.forEach(f => f(muted)); if (!muted) unlock(); apply() },
  toggle() { music.setMuted(!muted) },
  onChange(f) { listeners.add(f) },
  state: () => ({ playing: !!timer, gain: master ? +master.gain.value.toFixed(3) : 0, wanted, ducked, muted })
};
window.__music = music;
