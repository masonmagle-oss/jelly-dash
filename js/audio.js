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
  const { type = 'sine', to = 0, at = 0, att = .01, lp = 0, lpTo = 0, det = 0, pan = 0, vib = null } = o, bus = o.bus || sfxBusName, vol = (o.vol == null ? .1 : o.vol) * (bus === 'song' || bus === 'mus' ? 1 : sfxTrim);
  const t = nowT() + Math.max(0, at), osc = AC.createOscillator(), g = AC.createGain();
  osc.type = type; osc.frequency.setValueAtTime(f, t); if (det) osc.detune.value = det;
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + d);
  if (vib) { const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = vib[0]; lg.gain.value = vib[1]; lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + d + .05); }   // vib = [rate Hz, depth Hz]: the wobble that makes a tone sound like it is quivering
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
/* Voice banks: every squish, jump, landing and pad bounce picks one of several different voices (never the same one twice in a row, and not the one before either),
   so a long run of hops sounds like a bowl of jelly being played with, not one sample on repeat. Each voice has a gain (VOICE_GAIN) that levels it against the others. */
const lastVoice = {}; let forceVoice = null;   // forceVoice: tests and the calibration play one chosen voice
function pickVoice(key, n) {
  if (forceVoice !== null) return forceVoice % n;
  let v; do v = Math.floor(Math.random() * n); while (n > 2 && (v === lastVoice[key] || v === lastVoice[key + '2']));
  lastVoice[key + '2'] = lastVoice[key]; lastVoice[key] = v; return v;
}
// b = the material's base pitch, i = how hard (0..1), p = pan, V = volume scaler for the hardness; each voice is wet: falling and rising bends, bubbles, quivering vibrato, slurpy noise sweeps
const SQUISH_VOICES = [
  /* gloop   */ (b, i, p, V) => { noiseHit({ f0: b * 5, f1: b * 1.6, q: 3, d: .14 + .1 * i, vol: V(.12), pan: p }); tone(b * 1.6, .16 + .14 * i, { to: b * .55, vol: V(.1), pan: p, vib: [26, b * .12] }); tone(b * 3.2, .1, { to: b * 1.2, vol: V(.04), pan: p, type: 'triangle' }); },
  /* bloop   */ (b, i, p, V) => { tone(b * .9, .12 + .1 * i, { to: b * 2.4, vol: V(.1), pan: p, att: .006 }); tone(b * 1.8, .1, { to: b * 4.2, vol: V(.04), pan: p, type: 'triangle', att: .006 }); noiseHit({ f0: b * 6, f1: b * 2, q: 3, d: .06, vol: V(.05), pan: p }); },
  /* blub    */ (b, i, p, V) => { tone(b, .09, { to: b * 2.2, vol: V(.09), pan: p, att: .005 }); tone(b * 1.35, .12, { to: b * 2.9, vol: V(.08), pan: p, at: .085, att: .005 }); noiseHit({ f0: b * 5, f1: b * 2, q: 2, d: .07, vol: V(.05), pan: p }); },
  /* squelch */ (b, i, p, V) => { noiseHit({ f0: b * 8, f1: b * 1.5, q: 5, d: .2 + .12 * i, vol: V(.2), pan: p }); noiseHit({ f0: b * 4, f1: b * 1.2, q: 2, d: .16, vol: V(.1), pan: p, at: .03 }); tone(b * 1.2, .18, { to: b * .5, vol: V(.05), pan: p }); },
  /* wobble  */ (b, i, p, V) => { tone(b * 1.1, .3 + .25 * i, { to: b * .8, vol: V(.09), pan: p, vib: [18, b * .25] }); tone(b * 2.2, .25 + .15 * i, { vol: V(.035), pan: p, type: 'triangle', vib: [18, b * .4] }); noiseHit({ f0: b * 4, f1: b * 2, q: 1.5, d: .12, vol: V(.04), pan: p }); },
  /* splat   */ (b, i, p, V) => { noiseHit({ f0: b * 6, f1: b, q: 1, d: .09 + .05 * i, vol: V(.22), pan: p }); tone(b * .7, .12 + .06 * i, { to: b * .35, vol: V(.12), pan: p }); noiseHit({ f0: b * 3, f1: b * 1.4, q: 3, d: .1, vol: V(.07), pan: p, at: .05 }); },
  /* glug    */ (b, i, p, V) => { tone(b * 2.2, .07, { to: b * 1.4, vol: V(.08), pan: p, att: .004 }); tone(b * 1.8, .08, { to: b * 1.1, vol: V(.08), pan: p, at: .075, att: .004 }); tone(b * 1.4, .1 + .06 * i, { to: b * .8, vol: V(.09), pan: p, at: .155, att: .004 }); },
  /* pudding */ (b, i, p, V) => { tone(b * .6, .35 + .3 * i, { to: b * .42, vol: V(.14), pan: p, vib: [9, b * .1] }); tone(b * 1.2, .3 + .2 * i, { to: b * .85, vol: V(.05), pan: p, vib: [11, b * .2], type: 'triangle' }); noiseHit({ f0: b * 3, f1: b, q: 1.2, d: .3, vol: V(.06), pan: p }); },
  /* slurp   */ (b, i, p, V) => { noiseHit({ f0: b * 2, f1: b * 10, q: 4, d: .12, vol: V(.12), pan: p }); noiseHit({ f0: b * 10, f1: b * 2.5, q: 4, d: .16, vol: V(.14), pan: p, at: .1 }); tone(b * 1.5, .12, { to: b * 3.5, vol: V(.05), pan: p }); tone(b * 3.5, .16, { to: b * 1.2, vol: V(.05), pan: p, at: .12 }); },
  /* plop    */ (b, i, p, V) => { tone(b * 3.5, .07 + .05 * i, { to: b * .9, vol: V(.12), pan: p, att: .002 }); noiseHit({ f0: b * 10, f1: b * 4, q: 2, d: .03, vol: V(.06), pan: p }); tone(b * .8, .14, { to: b * .5, vol: V(.05), pan: p }); },
];
const VOICE_GAIN = { squish: [1, 1.6, .68, 1.86, 1.05, .98, .5, .6, .82, 1.47], land: [1.46, 1, .73, 1.27, .78, .41], jump: [1.05, .88, 1.13, .67, 1, .95], pad: [1.06, 1, .7] };   // measured by the calibration (tests/calibrate.js prints it): every voice peaks at the same level
// landing voices: b/i as above; heavier falls are lower and longer
const LAND_VOICES = [
  /* thud    */ (i, V) => { noiseHit({ f0: 1700, f1: 600, q: 1.2, d: .03, vol: V(.02 + i * .03) }); noiseHit({ f0: 420, f1: 180, q: 1, d: .08 + i * .06, vol: V(.02 + i * .045) }); tone(180, .1, { vol: V(.02 + i * .03), to: 100 }); tone(95, .1, { vol: V(.008 + i * .014), to: 55 }); },
  /* splut   */ (i, V) => { noiseHit({ f0: 900, f1: 180, q: 2.2, d: .12 + .08 * i, vol: V(.06 + i * .08) }); tone(160, .14 + .08 * i, { to: 70, vol: V(.04 + i * .05), vib: [20, 18] }); },
  /* boing   */ (i, V) => { tone(150, .2 + .2 * i, { to: 90, vol: V(.05 + i * .06), vib: [16, 22] }); tone(300, .14, { to: 170, vol: V(.02 + i * .02), type: 'triangle', vib: [16, 30] }); noiseHit({ f0: 600, f1: 220, q: 1.5, d: .08, vol: V(.03 + i * .03) }); },
  /* pop     */ (i, V) => { tone(320, .06, { to: 110, vol: V(.05 + i * .06), att: .003 }); noiseHit({ f0: 900, f1: 300, q: 2, d: .07 + .05 * i, vol: V(.04 + i * .05) }); tone(80, .12, { to: 50, vol: V(.015 + i * .03) }); },
  /* slap    */ (i, V) => { noiseHit({ f0: 700, f1: 200, q: 1, d: .1 + .06 * i, vol: V(.07 + i * .09) }); tone(110, .18 + .12 * i, { to: 60, vol: V(.04 + i * .06), vib: [11, 12] }); },
  /* blub    */ (i, V) => { tone(130, .09, { to: 260, vol: V(.04 + i * .05), att: .004 }); tone(100, .15 + .1 * i, { to: 60, vol: V(.04 + i * .06), at: .06 }); noiseHit({ f0: 800, f1: 300, q: 2.5, d: .08, vol: V(.03 + i * .04) }); },
];
const JUMP_VOICES = [
  /* chirp   */ () => { tone(210, .22, { to: 540, vol: .05 }); noiseHit({ f0: 1700, f1: 800, q: 4, d: .12, vol: .04 }); },
  /* boing   */ () => { tone(180, .3, { to: 480, vol: .055, vib: [22, 14] }); tone(360, .22, { to: 900, vol: .02, type: 'triangle' }); noiseHit({ f0: 1200, f1: 500, q: 3, d: .1, vol: .035 }); },
  /* bwip    */ () => { tone(260, .14, { to: 700, vol: .06, att: .004 }); tone(520, .1, { to: 1100, vol: .02, type: 'triangle', at: .02 }); noiseHit({ f0: 1500, f1: 700, q: 4, d: .08, vol: .03 }); },
  /* bloop   */ () => { tone(160, .18, { to: 420, vol: .06, att: .006 }); tone(420, .13, { to: 300, vol: .04, at: .1 }); noiseHit({ f0: 900, f1: 400, q: 3, d: .1, vol: .035 }); },
  /* spring  */ () => { tone(300, .2, { to: 760, vol: .045, type: 'triangle', vib: [30, 25] }); tone(150, .22, { to: 380, vol: .03 }); noiseHit({ f0: 1400, f1: 700, q: 3, d: .09, vol: .03 }); },
  /* wobble  */ () => { tone(200, .26, { to: 520, vol: .05, vib: [14, 30] }); noiseHit({ f0: 1100, f1: 500, q: 2, d: .14, vol: .04 }); tone(400, .2, { to: 800, vol: .015, type: 'triangle', vib: [14, 40] }); },
];
const PAD_VOICES = [
  /* whoosh  */ () => { tone(190, .35, { to: 680, vol: .08 }); noiseHit({ f0: 1400, f1: 400, q: 2, d: .3, vol: .1 }); },
  /* sproing */ () => { tone(140, .4, { to: 760, vol: .08, vib: [18, 22] }); tone(280, .3, { to: 1000, vol: .025, type: 'triangle', vib: [18, 40] }); noiseHit({ f0: 1200, f1: 350, q: 2, d: .25, vol: .08 }); },
  /* boomboing */ () => { tone(120, .3, { to: 220, vol: .09 }); tone(220, .38, { to: 820, vol: .06, at: .05 }); noiseHit({ f0: 900, f1: 300, q: 2.2, d: .22, vol: .09 }); },
];
const sfx = {
  squish: (v, k = 'slime') => {
    const i = clamp(v / 1100, .08, 1), m = SQ[k] || SQ.slime;
    const pn = (Math.random() - .5) * .6;
    if (!m.crackle) {   // jelly, slime, mochi and dough pick a wet voice; foam keeps its own crinkly one below
      const vc = pickVoice('squish', SQUISH_VOICES.length), b = m.tone * (.9 + Math.random() * .2), vs = (.35 + .9 * i) * VOICE_GAIN.squish[vc];
      SQUISH_VOICES[vc](b, i, pn, x => x * vs); return;
    }
    noiseHit({ f0: m.f0 * (.85 + Math.random() * .3), f1: m.f1, q: m.q, d: (.1 + i * .18) * m.len, vol: (.06 + .27 * i) * m.nv, pan: pn });
    if (m.tone) { const f = m.tone * (.9 + Math.random() * .2); tone(f, (.1 + i * .12) * m.len, { to: f * .45, vol: (.035 + .1 * i) * m.tv, pan: pn }); tone(f * 2.4, (.08 + i * .08) * m.len, { to: f * 1.1, vol: (.03 + .06 * i) * m.tv, pan: pn, type: 'triangle' }); tone(f * 4, .06 * m.len, { to: f * 2, vol: .02 * m.tv, pan: pn }); }   // upper partials carry the squish on small speakers
    if (m.crackle) for (let c = 0; c < 2 + i * 5; c++) noiseHit({ f0: 3500 + Math.random() * 2500, f1: 2400, q: 1.5, d: .02, vol: .012 + .03 * i, at: Math.random() * .14 });
  },
  poke: () => { const pn = (Math.random() - .5) * .5; noiseHit({ f0: 1200, f1: 500, q: 3, d: .12, vol: .1, pan: pn }); tone(260, .12, { to: 420, vol: .06, pan: pn }); tone(620, .08, { to: 900, vol: .03, pan: pn }); },
  jump: () => { const vc = pickVoice('jump', JUMP_VOICES.length); sfxTrim *= VOICE_GAIN.jump[vc]; JUMP_VOICES[vc](); beatNote(.07, 0); },
  bloop: v => { tone(300 + (v || 0) * 100, .25, { to: 150, vol: .08 }); tone(620 + (v || 0) * 200, .16, { to: 320, vol: .035, type: 'triangle' }); noiseHit({ f0: 900, f1: 400, q: 3, d: .15, vol: .07 }); },
  heart: () => beatNote(.075, 5),
  pad: () => { const vc = pickVoice('pad', PAD_VOICES.length); sfxTrim *= VOICE_GAIN.pad[vc]; PAD_VOICES[vc](); beatNote(.08, 5); },
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
  land: v => { const i = clamp(v / 900, .1, 1), vc = pickVoice('land', LAND_VOICES.length); LAND_VOICES[vc](i, x => x * VOICE_GAIN.land[vc]); },   // a click on top so it is heard, a thump underneath so it is felt (voice 0); the others are wetter
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
const SFX_TRIM = {"squish":3.32,"poke":5.78,"jump":3.47,"bloop":3.62,"pad":2.59,"portal":3.87,"die":2.07,"win":2.35,"click":11.48,"tap":17.78,"back":3.47,"toggle":7.16,"panel":9.89,"tick":11.56,"error":2.91,"unlock":3.63,"start":5.07,"checkpoint":2.85,"checkpointUndo":4.41,"newBest":1.23,"star":1.85,"combo":10.85,"land":2.3,"close":15.41,"intro":3.05,"orb":5.18,"stick":4.2,"hit:gumdrop":4.79,"hit:taffy":3.25,"hit:mint":3.33,"hit:cloud":4.65,"hit:slime":5.05};   // measured by tests/calibrate.js (run it after changing any effect, then paste the table here)
for (const k of Object.keys(sfx)) { const f = sfx[k]; sfx[k] = (...a) => { sfxTrim = SFX_TRIM[k] || 1; sfxBusName = UI_SFX.has(k) ? 'ui' : 'sfx'; try { return f(...a); } finally { sfxTrim = 1; sfxBusName = 'sfx'; } }; }
function playHit(h) { sfxTrim = SFX_TRIM['hit:' + h.id] || 1; try { h.hit(); } finally { sfxTrim = 1; } }   // a hazard's bump sound, at its calibrated level
