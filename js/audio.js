'use strict';
/* Jelly Dash — Synthesised sound effects and the beat-synced songs.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= ASMR audio ================= */
let AC = null, master = null, uiBus = null, sfxBus = null, musBus = null, verbIn = null, songBus = null, noiseBuf = null, squeakG = null, squeakO = null, humG = null, squelchG = null, squelchF = null, muted = false, simming = false;
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
function makeIR(sec, decay) {
  const len = AC.sampleRate * sec | 0, b = AC.createBuffer(2, len, AC.sampleRate);
  // exponential tail built with a running multiplier (a Math.pow per sample made this cost ~70 ms on the first click)
  const k = Math.exp(-decay * 2.3 / len);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0, env = 1; for (let i = 0; i < len; i++) { lp += ((Math.random() * 2 - 1) - lp) * .3; d[i] = lp * env; env *= k; } }
  return b;
}
function initAudio(ctx) {
  if (AC) return;
  try {
    AC = ctx || new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = muted ? 0 : .9;
    const lim = AC.createDynamicsCompressor(); lim.threshold.value = -12; lim.knee.value = 14; lim.ratio.value = 8; lim.attack.value = .003; lim.release.value = .2;   // a soft limiter: stacked sounds can never get startlingly loud
    master.connect(lim); lim.connect(AC.destination);
    const verb = AC.createConvolver(); verb.buffer = makeIR(2.6, 2.4);
    const vg = AC.createGain(); vg.gain.value = .6; verb.connect(vg); vg.connect(master);
    verbIn = AC.createGain(); verbIn.connect(verb);
    // Brightness cap for every effect: sounds above ~2 kHz are what the ear finds harshest, so they are tamed here no matter how an effect is written.
    const capIn = AC.createBiquadFilter(); capIn.type = 'highshelf'; capIn.frequency.value = 2000; capIn.gain.value = -12;
    const capLp = AC.createBiquadFilter(); capLp.type = 'lowpass'; capLp.frequency.value = 4800; capLp.Q.value = .5; capIn.connect(capLp); capLp.connect(master);
    sfxBus = AC.createGain(); sfxBus.gain.value = SET().sfx; sfxBus.connect(capIn);
    const sw = AC.createGain(); sw.gain.value = .16; sfxBus.connect(sw); sw.connect(verbIn);   // a light room for gameplay sounds
    uiBus = AC.createGain(); uiBus.gain.value = SET().sfx; uiBus.connect(capIn);   // menu sounds stay dry, so rapid taps never smear into each other
    musBus = AC.createGain(); musBus.gain.value = .75 * SET().music; musBus.connect(master);
    const mw = AC.createGain(); mw.gain.value = .8; musBus.connect(mw); mw.connect(verbIn);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    squeakO = AC.createOscillator(); squeakO.type = 'triangle'; squeakO.frequency.value = 300;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    squeakG = AC.createGain(); squeakG.gain.value = 0;
    squeakO.connect(lp); lp.connect(squeakG); squeakG.connect(sfxBus); squeakO.start();
    // soft thruster whoosh for the ship
    const hs = AC.createBufferSource(); hs.buffer = noiseBuf; hs.loop = true;
    const hb = AC.createBiquadFilter(); hb.type = 'bandpass'; hb.frequency.value = 520; hb.Q.value = .7;
    humG = AC.createGain(); humG.gain.value = 0; hs.connect(hb); hb.connect(humG); humG.connect(sfxBus); hs.start();
    // continuous wet "squelch": filtered noise whose level follows how fast the dough is being deformed
    const qs = AC.createBufferSource(); qs.buffer = noiseBuf; qs.loop = true;
    squelchF = AC.createBiquadFilter(); squelchF.type = 'bandpass'; squelchF.frequency.value = 400; squelchF.Q.value = 1.2;
    squelchG = AC.createGain(); squelchG.gain.value = 0; qs.connect(squelchF); squelchF.connect(squelchG); squelchG.connect(sfxBus); qs.start(0, .7);
  } catch (e) { AC = null; }
}
// the clock tone()/noiseHit() schedule against. Tests swap it to render a song offline on an OfflineAudioContext.
let clockOverride = null;
const nowT = () => (clockOverride ? clockOverride() : AC.currentTime);
// run fn with a throwaway audio graph on `ctx` (an OfflineAudioContext), then put the live one back
let audioSwapped = false, audioOpen = false;   // audioSwapped: a throwaway graph is live, so the game loop must not touch songs or ambience. audioOpen: the render helper is scheduling right now; any other sound (the title mascot hopping, say) is dropped
async function withAudioContext(ctx, fn) {
  const keep = { AC, master, uiBus, sfxBus, musBus, verbIn, songBus, noiseBuf, squeakG, squeakO, humG, squelchG, squelchF, song, amb };
  AC = null; song = null; songBus = null; amb = null; audioSwapped = true; initAudio(ctx);
  try { return await fn(); } finally { audioSwapped = false; audioOpen = false; clockOverride = null; ({ AC, master, uiBus, sfxBus, musBus, verbIn, songBus, noiseBuf, squeakG, squeakO, humG, squelchG, squelchF, song, amb } = keep); }
}
function tone(f, d, o = {}) {
  if (!AC || simming || (audioSwapped && !audioOpen)) return;
  const { type = 'sine', to = 0, at = 0, att = .01, lp = 0, lpTo = 0, det = 0, pan = 0 } = o, bus = o.bus || sfxBusName, vol = (o.vol == null ? .1 : o.vol) * (bus === 'song' || bus === 'mus' ? 1 : sfxTrim);
  const t = nowT() + Math.max(0, at), osc = AC.createOscillator(), g = AC.createGain();
  osc.type = type; osc.frequency.setValueAtTime(f, t); if (det) osc.detune.value = det;
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  let node = osc;
  if (lp) { const f2 = AC.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.setValueAtTime(lp, t); if (lpTo) f2.frequency.exponentialRampToValueAtTime(lpTo, t + d); osc.connect(f2); node = f2; }
  let out = g; if (pan) { const sp = AC.createStereoPanner(); sp.pan.value = pan; g.connect(sp); out = sp; }
  node.connect(g); out.connect(pickBus(bus)); osc.start(t); osc.stop(t + d + .05);
}
const pickBus = b => b === 'mus' ? musBus : b === 'song' ? (songBus || musBus) : b === 'amb' ? ((amb && amb.g) || sfxBus) : b === 'ui' ? uiBus : sfxBus;
// While an effect runs, sfxTrim scales its volume and sfxBusName picks its bus (see the table under `sfx`).
let sfxTrim = 1, sfxBusName = 'sfx';
function noiseHit(o) {
  if (!AC || simming || (audioSwapped && !audioOpen)) return;
  const { f0 = 800, f1 = 300, q = 2, d = .2, at = 0, pan = 0 } = o, bus = o.bus || sfxBusName, vol = (o.vol == null ? .15 : o.vol) * (bus === 'song' || bus === 'mus' ? 1 : sfxTrim);
  const t = nowT() + at, src = AC.createBufferSource(), bp = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = noiseBuf; bp.type = 'bandpass'; bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  let out = g; if (pan) { const sp = AC.createStereoPanner(); sp.pan.value = pan; g.connect(sp); out = sp; }
  src.connect(bp); bp.connect(g); out.connect(pickBus(bus)); src.start(t, Math.random() * 1.5, d + .1);
}
const PENT = [72, 74, 76, 79, 81, 84, 86, 88];
// each material has its own voice: wet and low for dough, bright and boingy for jelly, crinkly for foam
const SQ = {
  jelly: { f0: 1100, f1: 350, q: 3, len: 1, nv: 1, tone: 210, tv: 1 },
  slime: { f0: 800, f1: 260, q: 2.4, len: 1, nv: 1, tone: 150, tv: 1 },
  mochi: { f0: 650, f1: 240, q: 2, len: 1.2, nv: .9, tone: 140, tv: .8 },
  dough: { f0: 480, f1: 170, q: 1.3, len: 1.6, nv: 1.1, tone: 105, tv: 1.2 },
  foam: { f0: 2600, f1: 1500, q: .7, len: .8, nv: .6, tone: 0, tv: 0, crackle: true },
};
let lastBuzz = 0, squelchOn = false;
// apply the volume sliders to the live buses
function applyVolumes() { if (!AC) return; sfxBus.gain.setTargetAtTime(SET().sfx, AC.currentTime, .03); uiBus.gain.setTargetAtTime(SET().sfx, AC.currentTime, .03); musBus.gain.setTargetAtTime(SET().music, AC.currentTime, .05); if (song) song.bus.gain.setTargetAtTime(SET().music, AC.currentTime, .05); }
function buzz(ms) { if (muted || simming || !SET().haptics) return; const t = performance.now(); if (t - lastBuzz < 60) return; lastBuzz = t; try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
function setSquelch(rate, kind) {
  if (!AC) return;
  const m = SQ[kind] || SQ.slime, a = clamp((rate - 25) / 420, 0, 1); squelchOn = a > 0;
  squelchG.gain.setTargetAtTime(a * .075 * m.nv, AC.currentTime, .035);
  squelchF.frequency.setTargetAtTime(m.f0 * .55 * (1 + a * .9), AC.currentTime, .05); squelchF.Q.setTargetAtTime(m.q * .8, AC.currentTime, .1);
}
const sfx = {
  squish: (v, k = 'slime') => {
    const i = clamp(v / 1100, .08, 1), m = SQ[k] || SQ.slime;
    const pn = (Math.random() - .5) * .6;
    noiseHit({ f0: m.f0 * (.85 + Math.random() * .3), f1: m.f1, q: m.q, d: (.1 + i * .18) * m.len, vol: (.06 + .27 * i) * m.nv, pan: pn });
    if (m.tone) { const f = m.tone * (.9 + Math.random() * .2); tone(f, (.1 + i * .12) * m.len, { to: f * .45, vol: (.035 + .1 * i) * m.tv, pan: pn }); tone(f * 2.4, (.08 + i * .08) * m.len, { to: f * 1.1, vol: (.03 + .06 * i) * m.tv, pan: pn, type: 'triangle' }); tone(f * 4, .06 * m.len, { to: f * 2, vol: .02 * m.tv, pan: pn }); }   // upper partials carry the squish on small speakers
    if (m.crackle) for (let c = 0; c < 2 + i * 5; c++) noiseHit({ f0: 3500 + Math.random() * 2500, f1: 2400, q: 1.5, d: .02, vol: .012 + .03 * i, at: Math.random() * .14 });
  },
  poke: () => { const pn = (Math.random() - .5) * .5; noiseHit({ f0: 1200, f1: 500, q: 3, d: .12, vol: .1, pan: pn }); tone(260, .12, { to: 420, vol: .06, pan: pn }); tone(620, .08, { to: 900, vol: .03, pan: pn }); },
  jump: () => { tone(210, .22, { to: 540, vol: .05 }); noiseHit({ f0: 1700, f1: 800, q: 4, d: .12, vol: .04 }); beatNote(.07, 0); },
  bloop: v => { tone(300 + (v || 0) * 100, .25, { to: 150, vol: .08 }); tone(620 + (v || 0) * 200, .16, { to: 320, vol: .035, type: 'triangle' }); noiseHit({ f0: 900, f1: 400, q: 3, d: .15, vol: .07 }); },
  heart: () => beatNote(.075, 5),
  pad: () => { tone(190, .35, { to: 680, vol: .08 }); noiseHit({ f0: 1400, f1: 400, q: 2, d: .3, vol: .1 }); beatNote(.08, 5); },
  portal: () => { tone(260, .5, { to: 980, vol: .07 }); tone(mf(88), 1.2, { vol: .04, at: .12, att: .02 }); noiseHit({ f0: 2000, f1: 600, q: 3, d: .4, vol: .06 }); },
  die: () => { noiseHit({ f0: 1400, f1: 120, q: 1.2, d: .5, vol: .35 }); tone(320, .5, { to: 55, vol: .15 }); },
  win: () => [72, 76, 79, 84, 88, 91].forEach((n, i) => tone(mf(n), 1.3, { vol: .06, at: i * .12, att: .005 })),
  click: () => { const n = [84, 86, 88, 91, 93][Math.floor(Math.random() * 5)]; tone(mf(n), .16, { vol: .04, att: .004 }); tone(mf(n + 12), .08, { vol: .012, att: .003 }); },   // a soft marimba-ish tick, never the same twice
  tap: () => tone(mf(88), .08, { vol: .03, att: .002, type: 'triangle' }),
  back: () => { tone(mf(84), .12, { vol: .04, att: .003 }); tone(mf(79), .16, { vol: .04, att: .003, at: .07 }); },
  toggle: on => { tone(mf(on ? 86 : 79), .12, { vol: .045, att: .003 }); tone(mf(on ? 93 : 74), .1, { vol: .03, att: .003, at: .06 }); },
  panel: open => { noiseHit({ f0: open ? 500 : 1400, f1: open ? 1500 : 500, q: 1.4, d: .16, vol: .05 }); tone(mf(open ? 88 : 81), .1, { vol: .03, att: .004 }); },
  tick: v => tone(mf(72 + Math.round((v || 0) * 14)), .05, { vol: .03, att: .002, type: 'triangle' }),   // slider detents
  error: () => { tone(330, .13, { vol: .05, type: 'triangle', to: 270 }); tone(247, .2, { vol: .05, type: 'triangle', at: .1, to: 200 }); tone(660, .12, { vol: .015, at: .02, to: 540 }); },
  unlock: () => [79, 83, 86, 91].forEach((n, i) => { tone(mf(n), .7, { vol: .05, att: .004, at: i * .09 }); tone(mf(n + 12), .4, { vol: .018, att: .004, at: i * .09 }); }),
  start: () => { noiseHit({ f0: 400, f1: 2600, q: 1.2, d: .4, vol: .06 }); tone(mf(72), .5, { vol: .04, att: .02, to: mf(84) }); },
  checkpoint: () => { tone(mf(91), .28, { vol: .06, att: .003 }); tone(mf(98), .4, { vol: .035, att: .003, at: .07 }); },
  checkpointUndo: () => { tone(mf(91), .14, { vol: .05, att: .003 }); tone(mf(84), .22, { vol: .04, att: .003, at: .07 }); },
  newBest: () => [84, 88, 91, 96].forEach((n, i) => tone(mf(n), .5, { vol: .055, att: .004, at: i * .08 })),
  star: i => { tone(mf(76 + i * 3), .7, { vol: .06, att: .012, lp: 2400 }); tone(mf(83 + i * 3), .45, { vol: .02, att: .012, at: .02, lp: 2400 }); },   // low and soft: bright notes above ~2 kHz are what hurts the ears
  combo: n => tone(mf(79 + Math.min(12, n)), .18, { vol: .04, att: .003, type: 'triangle' }),
  land: v => { const i = clamp(v / 900, .1, 1); noiseHit({ f0: 1700, f1: 600, q: 1.2, d: .03, vol: .02 + i * .03 }); noiseHit({ f0: 420, f1: 180, q: 1, d: .08 + i * .06, vol: .02 + i * .045 }); tone(180, .1, { vol: .02 + i * .03, to: 100 }); tone(95, .1, { vol: .008 + i * .014, to: 55 }); },   // a click on top so it is heard, a thump underneath so it is felt
  close: () => noiseHit({ f0: 2400, f1: 700, q: 2, d: .12, vol: .035 }),   // a near miss whoosh
  intro: () => { [67, 72, 76, 79].forEach((n, i) => { tone(mf(n), .9, { vol: .045, att: .01, at: i * .12 }); tone(mf(n + 12), .5, { vol: .015, att: .01, at: i * .12 }); }); noiseHit({ f0: 300, f1: 2200, q: 1, d: .5, vol: .04 }); },
  orb: () => { tone(mf(84), .4, { vol: .06, att: .004 }); tone(mf(91), .35, { vol: .04, att: .004, at: .05 }); noiseHit({ f0: 3200, f1: 1600, q: 2, d: .1, vol: .04 }); },
  stick: () => { tone(170, .16, { to: 470, vol: .06, type: 'triangle' }); tone(340, .14, { to: 940, vol: .035, type: 'triangle' }); noiseHit({ f0: 1500, f1: 600, q: 2, d: .1, vol: .09 }); tone(680, .12, { to: 1500, vol: .03, type: 'triangle', at: .02 }); },   // a soft sticky 'boing' for a jump taken past the ledge
};
function setSqueak(f, g) { if (!AC) return; squeakO.frequency.setTargetAtTime(f, AC.currentTime, .05); squeakG.gain.setTargetAtTime(g, AC.currentTime, .06); }
function setHum(g) { if (!AC) return; humG.gain.setTargetAtTime(g, AC.currentTime, .08); }
/* Every effect is routed and levelled on purpose (tests/suite.js enforces the targets):
   ui effects (taps, toggles, panels...) go through the dry UI bus at about -21 dBFS peak; gameplay effects through the sfx bus at about -19; big moments (a hit, a win, an unlock) at about -15.
   SFX_TRIM holds the measured multiplier for each, so tuning an effect never silently makes it too quiet or too loud. */
const SFX_HF_CEIL = -28;   // dBFS: the loudest the part of any effect above 2 kHz may peak (calibrate.js enforces it, the test suite checks it)
const UI_SFX = new Set(['click', 'tap', 'back', 'toggle', 'panel', 'tick', 'error', 'start', 'checkpoint', 'checkpointUndo', 'combo']);
const SFX_TARGET = {   // the peak level (dBFS) every effect is calibrated to; tests/suite.js renders each effect and checks it lands within 1.5 dB
  click: -19, tap: -21, back: -19, toggle: -19, panel: -21, tick: -23, error: -17, start: -17, checkpoint: -16, checkpointUndo: -17, combo: -21,
  jump: -15, poke: -18, squish: -19, bloop: -17, pad: -14, orb: -14, stick: -18, portal: -14, land: -24, close: -27,
  intro: -11, star: -22, unlock: -11, newBest: -11, die: -11, win: -11, 'hit:gumdrop': -13, 'hit:taffy': -13, 'hit:mint': -13, 'hit:cloud': -13, 'hit:slime': -13,
};   // (heart is a note in the song's own voice, so it follows the music instead)
const SFX_TRIM = {"squish":2.59,"poke":5.78,"jump":3.6,"bloop":3.62,"pad":2.64,"portal":3.87,"die":2.07,"win":2.35,"click":11.48,"tap":17.78,"back":3.47,"toggle":7.16,"panel":9.89,"tick":11.56,"error":2.91,"unlock":3.63,"start":5.07,"checkpoint":2.85,"checkpointUndo":4.41,"newBest":1.23,"star":1.85,"combo":10.85,"land":3.04,"close":15.41,"intro":3.05,"orb":5.18,"stick":4.2,"hit:gumdrop":4.79,"hit:taffy":3.25,"hit:mint":3.33,"hit:cloud":4.65,"hit:slime":5.05};   // measured by tests/calibrate.js (run it after changing any effect, then paste the table here)
for (const k of Object.keys(sfx)) { const f = sfx[k]; sfx[k] = (...a) => { sfxTrim = SFX_TRIM[k] || 1; sfxBusName = UI_SFX.has(k) ? 'ui' : 'sfx'; try { return f(...a); } finally { sfxTrim = 1; sfxBusName = 'sfx'; } }; }
function playHit(h) { sfxTrim = SFX_TRIM['hit:' + h.id] || 1; try { h.hit(); } finally { sfxTrim = 1; } }   // a hazard's bump sound, at its calibrated level
