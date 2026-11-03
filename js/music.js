'use strict';
/* Jelly Dash — Music: instruments, song styles, the live song engine, menu music and per-world ambience.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there).

   Songs are generated live and locked to the player's distance: one tile = one 16th note, so songT = distance / speed always lands the music on the
   level's grid (also after Zen / Practice respawns). Layers fade in as you progress: pad + kick + hats, then bass, snare, arpeggio and finally a melody.
   A style is plain data (see STYLES); adding a track means adding an entry, nothing else. */

/* ================= instruments ================= */
// every voice is f (Hz), d (seconds), v (volume), at (start offset), B (bus). They only combine tone()/noiseHit() so they cost nothing to add.
const VOICES = {
  tri:     (f, d, v, at, B, pan = 0) => tone(f, d, { type: 'triangle', vol: v, att: .008, at, bus: B, lp: 4400, pan }),
  sine:    (f, d, v, at, B, pan = 0) => tone(f, d, { vol: v, att: .01, at, bus: B, pan }),
  pluck:   (f, d, v, at, B, pan = 0) => tone(f, Math.min(d, .5), { type: 'sawtooth', vol: v * .55, att: .003, at, bus: B, lp: 4600, lpTo: 600, pan }),
  bell:    (f, d, v, at, B, pan = 0) => { tone(f, d * 1.5, { vol: v, att: .003, at, bus: B, pan }); tone(f * 2.756, d * .5, { vol: v * .4, att: .003, at, bus: B, pan }); tone(f * 5.4, d * .25, { vol: v * .2, att: .003, at, bus: B, pan }); },
  marimba: (f, d, v, at, B, pan = 0) => { tone(f, .42, { vol: v * 1.1, att: .002, at, bus: B, pan }); tone(f * 4, .12, { vol: v * .55, att: .002, at, bus: B, pan }); tone(f * 10, .03, { vol: v * .2, att: .001, at, bus: B, pan }); },
  square:  (f, d, v, at, B, pan = 0) => tone(f, d, { type: 'square', vol: v * .4, att: .006, at, bus: B, lp: 2400, pan }),
  brass:   (f, d, v, at, B, pan = 0) => tone(f, d, { type: 'sawtooth', vol: v * .5, att: .03, at, bus: B, lp: 1100, lpTo: 3000, pan }),
  organ:   (f, d, v, at, B, pan = 0) => { tone(f, d, { vol: v, att: .06, at, bus: B, pan }); tone(f * 2, d, { vol: v * .4, att: .06, at, bus: B, pan }); tone(f * 3, d, { vol: v * .15, att: .06, at, bus: B, pan }); },
  // pads and choirs are spread across the stereo field (each detuned layer sits on its own side) and get a little air on top
  pad:     (f, d, v, at, B) => { tone(f, d, { type: 'sawtooth', vol: v * .5, att: .6, at, bus: B, lp: 1100, det: -7, pan: -.5 }); tone(f, d, { type: 'sawtooth', vol: v * .5, att: .6, at, bus: B, lp: 1100, det: 7, pan: .5 }); tone(f * 2, d, { type: 'triangle', vol: v * .22, att: .8, at, bus: B, lp: 3000 }); },
  choir:   (f, d, v, at, B) => { [[-9, -.55], [0, 0], [9, .55]].forEach(([det, pan]) => tone(f, d, { vol: v * .55, att: .5, at, bus: B, det, pan })); tone(f * 2, d, { vol: v * .16, att: .6, at, bus: B, pan: .3 }); tone(f * 3, d, { vol: v * .07, att: .7, at, bus: B, pan: -.3 }); },
  // the bass carries its own 2nd and 3rd harmonics: phone speakers can't play 50-100 Hz, but they play the harmonics and the ear fills in the note
  sub:     (f, d, v, at, B) => { tone(f, d, { vol: v * .8, att: .006, at, bus: B, lp: 380 }); tone(f * 2, d * .85, { vol: v * .5, att: .006, at, bus: B }); tone(f * 3, d * .6, { vol: v * .22, att: .006, at, bus: B }); },
  saw:     (f, d, v, at, B) => { tone(f, d, { type: 'sawtooth', vol: v * .5, att: .006, at, bus: B, lp: 900, lpTo: 350 }); tone(f * 2, d * .7, { vol: v * .3, att: .006, at, bus: B }); },
};

/* ================= styles (the songs) =================
   root: MIDI note of the key  •  scale: scale degrees in semitones (5 or 7 notes)  •  prog: one entry per bar [root offset, chord tones]
   drums: step lists (0-15) for kick / snare / clap / hat / open / perc / shaker, and kit: soft | lofi | tight | epic
   bass: {steps, voice, oct}  •  lead: {density, voice, oct}  •  arp: {pattern (16 chord-tone indexes, -1 = rest), voice, oct}  •  pad: {voice}
   swing: 0-.3 delays every second 16th  •  gain: loudness trim (tests keep every song within a few dB of the others)  •  bpm: used by menus, the Studio and the editor (levels carry their own)  •  menu: true = not offered in the editor */
const A_MAJ7 = [0, 4, 7, 11], A_MIN7 = [0, 3, 7, 10], A_MAJ = [0, 4, 7], A_MIN = [0, 3, 7], A_DOM7 = [0, 4, 7, 10], PENT_MAJ = [0, 2, 4, 7, 9], PENT_MIN = [0, 3, 5, 7, 10];
const STYLES = [
  { name: 'Lo-fi Cloud', root: 60, scale: PENT_MAJ, bpm: 96, kit: 'lofi', swing: .12, prog: [[0, A_MAJ7], [-3, A_MIN7], [-7, A_MAJ7], [-5, [0, 4, 7, 9]]],
    drums: { kick: [0, 10], snare: [4, 12], hat: [2, 6, 10, 14] }, bass: { steps: [0, 6, 10], voice: 'sub' }, lead: { density: .34, voice: 'pluck' }, pad: { voice: 'pad' } },
  { name: 'Pop Sparkle', root: 62, scale: PENT_MAJ, bpm: 112, kit: 'tight', prog: [[0, A_MAJ], [-3, A_MIN], [-7, A_MAJ], [-5, A_MAJ]],
    drums: { kick: [0, 4, 8, 12], clap: [4, 12], hat: [2, 6, 10, 14], open: [14] }, bass: { steps: [0, 3, 8, 11], voice: 'pluck' }, lead: { density: .42, voice: 'marimba' },
    arp: { pattern: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 3, -1], voice: 'pluck', oct: 12 }, pad: { voice: 'organ' } },
  { name: 'Bouncy Bubble', root: 65, scale: PENT_MAJ, bpm: 108, kit: 'soft', prog: [[0, [0, 4, 7, 9]], [-3, A_MIN7], [-7, A_MAJ7], [-5, A_DOM7]],
    drums: { kick: [0, 3, 8, 11], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] }, bass: { steps: [0, 3, 6, 10, 14], voice: 'sub' }, lead: { density: .4, voice: 'bell' },
    arp: { pattern: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3], voice: 'marimba', oct: 12 }, pad: { voice: 'pad' } },
  { name: 'Dreamy Minor', root: 57, scale: PENT_MIN, bpm: 100, kit: 'soft', swing: .06, prog: [[0, A_MIN7], [-4, A_MAJ7], [3, A_MAJ7], [-2, A_DOM7]],
    drums: { kick: [0, 7, 10], snare: [4, 12], hat: [2, 6, 10, 14] }, bass: { steps: [0, 6, 10], voice: 'sub' }, lead: { density: .32, voice: 'bell' }, pad: { voice: 'choir' } },
  { name: 'Soft Daydream', root: 67, scale: PENT_MAJ, bpm: 92, kit: 'soft', prog: [[0, A_MAJ7], [-3, A_MIN7], [-7, A_MAJ7], [-5, [0, 4, 7, 9]]],
    drums: { kick: [0, 8], clap: [12], shaker: [2, 6, 10, 14] }, bass: { steps: [0, 8], voice: 'sub' }, lead: { density: .28, voice: 'bell' }, pad: { voice: 'organ' } },
  { name: 'Moonlit Mochi', root: 55, scale: PENT_MIN, bpm: 84, kit: 'lofi', prog: [[0, A_MIN7], [-4, A_MAJ7], [3, A_MAJ7], [-2, A_DOM7]],
    drums: { kick: [0, 11], perc: [8], shaker: [2, 6, 10, 14], pulse: [0, 4, 8, 12] }, bass: { steps: [0, 7], voice: 'sub' }, lead: { density: .3, voice: 'bell' }, pad: { voice: 'pad' } },
  { name: 'Sugar Synth', root: 62, scale: PENT_MAJ, bpm: 126, kit: 'tight', prog: [[0, A_MAJ], [-3, A_MIN], [-5, A_MAJ], [-7, A_MAJ]],
    drums: { kick: [0, 4, 8, 12], clap: [4, 12], hat: [2, 6, 10, 14], open: [6] }, bass: { steps: [0, 2, 4, 6, 8, 10, 12, 14], voice: 'saw', vol: .04 }, lead: { density: .45, voice: 'square', oct: 12 },
    arp: { pattern: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3], voice: 'pluck', oct: 12, vol: .022 }, pad: { voice: 'pad' } },
  { name: 'Factory Funk', root: 58, scale: PENT_MIN, bpm: 110, kit: 'tight', swing: .08, prog: [[0, A_MIN7], [0, A_MIN7], [-2, A_DOM7], [-4, A_DOM7]],
    drums: { kick: [0, 3, 6, 10, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [6, 14], perc: [7, 15] }, bass: { steps: [0, 3, 5, 6, 10, 11, 13], voice: 'saw', vol: .08 }, lead: { density: .24, voice: 'square' }, pad: { voice: 'organ' } },
  { name: 'Slime Epic', gain: .8, root: 52, scale: PENT_MIN, bpm: 120, kit: 'epic', prog: [[0, A_MIN], [-2, A_MAJ], [-4, A_MAJ], [-5, A_MIN]],
    drums: { kick: [0, 3, 8, 10], snare: [4, 12], open: [6, 14], perc: [2, 11] }, bass: { steps: [0, 2, 6, 8, 10, 14], voice: 'sub', vol: .08 }, lead: { density: .36, voice: 'brass' },
    arp: { pattern: [0, -1, -1, 1, -1, -1, 2, -1, 0, -1, -1, 1, -1, 3, -1, -1], voice: 'bell', oct: 12 }, pad: { voice: 'choir', vol: .028 } },
  { name: 'Cloud Choir', root: 65, scale: PENT_MAJ, bpm: 100, kit: 'soft', prog: [[0, A_MAJ7], [-5, A_MAJ7], [-3, A_MIN7], [-7, A_MAJ7]],
    drums: { kick: [0, 8], shaker: [2, 6, 10, 14] }, bass: { steps: [0, 8], voice: 'sub' }, lead: { density: .22, voice: 'bell' },
    arp: { pattern: [0, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1, 0, -1, 1, -1], voice: 'bell', oct: 12, vol: .018 }, pad: { voice: 'choir', vol: .03 } },
  { name: 'Marimba Meadow', root: 64, scale: PENT_MAJ, bpm: 104, kit: 'soft', prog: [[0, A_MAJ], [5, A_MAJ], [7, A_MAJ], [5, A_MAJ]],
    drums: { kick: [0, 8], perc: [4, 12], shaker: [2, 6, 10, 14], pulse: [0, 4, 8, 12] }, bass: { steps: [0, 6, 8, 14], voice: 'pluck' }, lead: { density: .4, voice: 'marimba' },
    arp: { pattern: [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 3, 2], voice: 'marimba', oct: 12, vol: .02 }, pad: { voice: 'organ' } },
  { name: 'Night Garden', root: 57, scale: PENT_MIN, bpm: 90, kit: 'lofi', swing: .1, prog: [[0, A_MIN7], [-4, A_MAJ7], [-2, A_DOM7], [-5, A_MIN7]],
    drums: { kick: [0, 10], clap: [12], hat: [4, 12], pulse: [0, 4, 8, 12] }, bass: { steps: [0, 7], voice: 'sub' }, lead: { density: .3, voice: 'bell' },
    arp: { pattern: [0, -1, -1, 1, -1, -1, 2, -1, -1, 1, -1, -1, 3, -1, 2, -1], voice: 'bell', oct: 12, vol: .02 }, pad: { voice: 'pad' } },
  // ---- menu music: always fully layered, never offered in the editor or Studio (they sit after the playable styles)
  { name: 'Title Theme', menu: true, root: 60, scale: PENT_MAJ, bpm: 84, kit: 'soft', prog: [[0, A_MAJ7], [-3, A_MIN7], [5, A_MAJ7], [7, A_DOM7]],
    drums: { kick: [0], shaker: [2, 6, 10, 14] }, bass: { steps: [0, 8], voice: 'sub', vol: .07 }, lead: { density: .26, voice: 'bell', vol: .026 },
    arp: { pattern: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 3, -1], voice: 'marimba', oct: 12, vol: .016 }, pad: { voice: 'choir', vol: .026 } },
  { name: 'Map Theme', menu: true, root: 62, scale: PENT_MAJ, bpm: 100, kit: 'soft', swing: .05, prog: [[0, A_MAJ], [-3, A_MIN], [-5, A_MAJ], [-7, A_MAJ]],
    drums: { kick: [0, 8], perc: [4, 12], hat: [2, 6, 10, 14] }, bass: { steps: [0, 6, 10], voice: 'pluck', vol: .07 }, lead: { density: .34, voice: 'marimba', vol: .026 },
    arp: { pattern: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 3, -1], voice: 'pluck', oct: 12, vol: .016 }, pad: { voice: 'organ', vol: .02 } },
  { name: 'Cozy Room', menu: true, root: 57, scale: PENT_MAJ, bpm: 76, kit: 'lofi', swing: .14, prog: [[0, A_MAJ7], [-4, A_MIN7], [3, A_MAJ7], [-2, A_DOM7]],
    drums: { kick: [0, 10], clap: [12], hat: [2, 6, 10, 14] }, bass: { steps: [0, 7], voice: 'sub', vol: .07 }, lead: { density: .24, voice: 'bell', vol: .024 }, pad: { voice: 'pad', vol: .02 } },
];
const SONG_N = STYLES.findIndex(s => s.menu);   // playable styles come first; menu styles follow
const MENU_STYLE = { title: SONG_N, select: SONG_N + 1, room: SONG_N + 2 };
const nextStyle = i => ((i | 0) + 1) % SONG_N;
const styleIndex = v => clamp(Math.floor(+v) || 0, 0, SONG_N - 1);

const STYLE_DEFAULTS = { kit: 'soft', swing: 0, bpm: 100, drums: {}, bass: { steps: [0], voice: 'sub', oct: -12, vol: .08 }, lead: { density: .3, voice: 'tri', oct: 0, vol: .03 }, arp: null, pad: { voice: 'pad', vol: .02 } };
const styleCache = new Map();
function styleCfg(i) {   // the style at index i, with every optional field filled in
  const k = ((i | 0) % STYLES.length + STYLES.length) % STYLES.length; if (styleCache.has(k)) return styleCache.get(k);
  const r = STYLES[k], D = STYLE_DEFAULTS, c = Object.assign({}, D, r);
  c.drums = Object.assign({ kick: [], snare: [], clap: [], hat: [], open: [], perc: [], shaker: [], pulse: [] }, r.drums);
  c.bass = Object.assign({}, D.bass, r.bass); c.lead = Object.assign({}, D.lead, r.lead); c.pad = Object.assign({}, D.pad, r.pad); c.arp = r.arp ? Object.assign({ vol: .02, oct: 12 }, r.arp) : null;
  styleCache.set(k, c); return c;
}

/* ================= the song engine ================= */
let song = null, songT = 0, combo = 0, lastBeat = -1;
let scoreNow = 0, judgeBase = 0, judgeN = 0, judged = { PERFECT: 0, GREAT: 0, GOOD: 0, OK: 0 }, winStars = 1;
const hashStr = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 1000; };
const degMidi = (c, d) => { const n = c.scale.length; return c.root + 12 + 12 * Math.floor(d / n) + c.scale[((d % n) + n) % n]; };
function songStart(L, atT = 0) {
  songStop();
  songT = atT;
  if (!AC || simming) return;
  const cfg = styleCfg(L.style), bpm = L.studio || L.menu ? L.bpm : (state === 'play' ? curBpm : (L.bpm || BASE_BPM));
  const bus = AC.createGain(); bus.gain.value = 0; bus.gain.setTargetAtTime(SET().music * (L.menu ? .85 : 1) * (cfg.gain || 1), AC.currentTime, .05);
  // gentle bus compression: music is sparse and spiky, so without it the average level sits far under the peaks (and under the effects)
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -30; comp.knee.value = 14; comp.ratio.value = 3.5; comp.attack.value = .006; comp.release.value = .22;
  const mk = AC.createGain(); mk.gain.value = cfg.makeup || .75; // a fixed "small speaker" EQ: nothing below 55 Hz (a phone cannot play it and it only eats headroom), bass trimmed, the top lifted so hats, bells and plucks cut through
  const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 55; hp.Q.value = .6;
  const ls = AC.createBiquadFilter(); ls.type = 'lowshelf'; ls.frequency.value = 160; ls.gain.value = -4;
  const hs = AC.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 3000; hs.gain.value = 6;
  bus.connect(hp); hp.connect(ls); ls.connect(hs); hs.connect(comp); comp.connect(mk); mk.connect(master);
  const send = AC.createGain(); send.gain.value = .4; bus.connect(send); send.connect(verbIn);
  songBus = bus;
  // melody and arpeggio go through a stereo echo (a dotted-8th on the left, an 8th on the right): width and bounce without muddying the drums or bass
  const sixT = 60 / bpm / 4, fx = AC.createGain(), fxNodes = [fx]; fx.connect(bus);
  for (const [beats, pan] of [[3, -.8], [2, .8]]) {
    const dly = AC.createDelay(1), fb = AC.createGain(), wet = AC.createGain(), pn = AC.createStereoPanner();
    dly.delayTime.value = sixT * beats; fb.gain.value = .32; wet.gain.value = .3; pn.pan.value = pan;
    fx.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(pn); pn.connect(bus); fxNodes.push(dly, fb, wet, pn);
  }
  song = { eq: [hp, ls, hs], fx, fxNodes, comp, mk, cfg, bpm, step: Math.max(0, Math.ceil(atT / (60 / bpm / 4) - 1e-6)), walk: 4, seed: hashStr(L.id || L.name), bus, send, mot: {},
    // which layers are audible at which progress; in Squish Studio "progress" is your kneading flow, so the song is built by your hands
    th: L.studio ? { kick: .25, hat: .12, snare: .4, bass: .3, lead: .5, arp: .62 } : L.menu ? { kick: 0, hat: 0, snare: 0, bass: 0, lead: 0, arp: 0 } : { kick: 0, hat: 0, snare: .1, bass: .06, lead: .18, arp: .3 } };
}
function songStop() {
  if (!song) return;
  const s = song; song = null; songBus = null;
  try { s.bus.gain.setTargetAtTime(0, AC.currentTime, .04); setTimeout(() => { try { s.bus.disconnect(); s.send.disconnect(); s.comp.disconnect(); s.mk.disconnect(); s.fxNodes.forEach(n => n.disconnect()); s.eq.forEach(n => n.disconnect()); } catch (e) {} }, 800); } catch (e) {}
}
function motif(s, bi) {
  if (s.mot[bi]) return s.mot[bi];
  const r = rng(s.seed * 131 + bi * 17 + 5), c = s.cfg, n = c.scale.length, m = new Array(16).fill(0); let w = 4 + bi % 3;
  for (let i = 0; i < 16; i++) {
    const p = i % 4 === 0 ? c.lead.density * 1.3 : i % 2 === 0 ? c.lead.density : c.lead.density * .35;
    if (r() < p) { w = clamp(w + Math.floor(r() * 5) - 2, 0, 2 * n - 1); m[i] = degMidi(c, w); }
  }
  return (s.mot[bi] = m);
}
// drum kits: how each hit sounds. soft = round and warm, lofi = dusty, tight = electronic, epic = big and low
const KITS = {
  soft:  { kick: (at, B, v) => { tone(120, .17, { to: 46, vol: .13 * v, att: .003, at, bus: B }); tone(210, .06, { to: 90, vol: .05 * v, att: .002, at, bus: B }); noiseHit({ f0: 2400, f1: 900, q: 1, d: .02, vol: .025 * v, at, bus: B }); },
           snare: (at, B, v) => { noiseHit({ f0: 2800, f1: 1800, q: 1, d: .09, vol: .07 * v, at, bus: B, pan: .1 }); tone(200, .07, { to: 140, vol: .04 * v, at, bus: B }); tone(420, .05, { to: 300, vol: .015 * v, at, bus: B }); }, hat: 8200 },
  lofi:  { kick: (at, B, v) => { tone(100, .22, { to: 44, vol: .085 * v, att: .004, at, bus: B, lp: 600 }); tone(190, .07, { to: 80, vol: .05 * v, att: .003, at, bus: B }); noiseHit({ f0: 1800, f1: 700, q: 1, d: .02, vol: .02 * v, at, bus: B }); },
           snare: (at, B, v) => { noiseHit({ f0: 2000, f1: 1200, q: .8, d: .12, vol: .07 * v, at, bus: B, pan: .1 }); tone(170, .08, { to: 120, vol: .035 * v, at, bus: B }); tone(380, .06, { to: 280, vol: .014 * v, at, bus: B }); }, hat: 6200 },
  tight: { kick: (at, B, v) => { tone(150, .14, { to: 42, vol: .16 * v, att: .002, at, bus: B }); tone(260, .05, { to: 100, vol: .05 * v, att: .001, at, bus: B }); noiseHit({ f0: 3200, f1: 1000, q: 1, d: .02, vol: .04 * v, at, bus: B }); },
           snare: (at, B, v) => { noiseHit({ f0: 3400, f1: 2100, q: .9, d: .08, vol: .075 * v, at, bus: B, pan: .1 }); tone(220, .06, { to: 150, vol: .04 * v, at, bus: B }); tone(480, .04, { to: 340, vol: .015 * v, at, bus: B }); }, hat: 9400 },
  epic:  { kick: (at, B, v) => { tone(90, .3, { to: 38, vol: .09 * v, att: .003, at, bus: B }); tone(170, .08, { to: 70, vol: .06 * v, at, bus: B }); noiseHit({ f0: 800, f1: 140, q: 1, d: .12, vol: .06 * v, at, bus: B }); noiseHit({ f0: 2600, f1: 900, q: 1, d: .02, vol: .03 * v, at, bus: B }); },
           snare: (at, B, v) => { noiseHit({ f0: 2000, f1: 1000, q: .7, d: .18, vol: .09 * v, at, bus: B, pan: .1 }); tone(150, .15, { to: 90, vol: .05 * v, at, bus: B }); }, hat: 7000 },
};
function songStep(s, step, at, prog) {
  const c = s.cfg, d = c.drums, kit = KITS[c.kit] || KITS.soft, bar = Math.floor(step / 16), i = step % 16, ch = c.prog[bar % c.prog.length], root = c.root + ch[0], B = 'song';
  const sixT = 60 / s.bpm / 4, sec = (bar % 8) >= 4 ? 1 : 0;   // sec: the A / B halves of every 8 bars (B is busier)
  if (i % 2 === 1) at += c.swing * sixT;
  const fillBar = bar % 4 === 3;   // the last bar of every phrase leads into the next one
  if (prog >= s.th.kick && d.kick.includes(i)) kit.kick(at, B, 1);
  if (prog > s.th.snare) {
    if (d.snare.includes(i) || (fillBar && c.kit !== 'epic' && (i === 14 || i === 15))) kit.snare(at, B, i >= 14 && fillBar ? .7 : 1);
    if (d.clap.includes(i)) for (let k = 0; k < 3; k++) noiseHit({ f0: 1900, f1: 1300, q: 1, d: .03, vol: .07, at: at + k * .011, bus: B });
    if (d.perc.includes(i)) { tone(c.kit === 'epic' ? 160 : 1700, c.kit === 'epic' ? .2 : .04, { to: c.kit === 'epic' ? 80 : 1500, vol: c.kit === 'epic' ? .07 : .03, at, bus: B, pan: -.25 }); if (c.kit !== 'epic') noiseHit({ f0: 2400, f1: 1900, q: 2, d: .03, vol: .02, at, bus: B, pan: -.25 }); }
    if (c.kit === 'epic' && fillBar && i >= 12 && i % 2 === 0) tone(150 - (i - 12) * 12, .18, { to: 70, vol: .06, at, bus: B });   // a tom fill at the end of every fourth bar
  }
  if (prog >= s.th.hat) {   // hats and shakers keep the pulse audible (and on the grid the rhythm judge scores against)
    if (d.hat.includes(i)) noiseHit({ f0: kit.hat, f1: kit.hat * .86, q: .8, d: .035, vol: i % 4 === 0 ? .045 : .07, at, bus: B, pan: .35 });
    if (d.open.includes(i)) noiseHit({ f0: kit.hat, f1: kit.hat * .7, q: .7, d: .14, vol: .06, at, bus: B, pan: .5 });
    if (d.shaker.includes(i)) noiseHit({ f0: 6600, f1: 5400, q: 1.3, d: .055, vol: .055, at, bus: B, pan: i % 4 === 2 ? -.35 : .25 });
    if (d.pulse && d.pulse.includes(i)) { tone(i === 0 ? 2700 : 2100, .035, { vol: .028, att: .001, at, bus: B }); noiseHit({ f0: 3200, f1: 2400, q: 3, d: .02, vol: .012, at, bus: B }); }   // a soft wood-block tick: the beat, clear enough to jump on
  }
  if (prog > s.th.bass) {
    const bs = c.bass.steps, k = bs.findIndex(x => (Array.isArray(x) ? x[0] : x) === i);
    if (k >= 0) { const iv = Array.isArray(bs[k]) ? bs[k][1] : (c.bass.voice === 'saw' && k % 3 === 2 ? 7 : 0); (VOICES[c.bass.voice] || VOICES.sub)(mf(root + (c.bass.oct || -12) + iv), .32, (c.bass.vol || .1) * .55, at, B); }
  }
  if (i === 0) ch[1].forEach(n => (VOICES[c.pad.voice] || VOICES.pad)(mf(root + n), 3.4, c.pad.vol, at, B));
  if (c.arp && prog > s.th.arp && (sec === 1 || c.arp.always)) {
    const a = c.arp.pattern[i]; if (a >= 0) (VOICES[c.arp.voice] || VOICES.pluck)(mf(root + c.arp.oct + ch[1][a % ch[1].length]), .32, c.arp.vol * 1.7, at, 'songfx', (step % 2 ? .4 : -.4));
  }
  if (prog > s.th.lead) {   // the melody is doubled: one copy left, one slightly detuned and a hair late on the right, which makes it wide
    const m = motif(s, bar % 4 + (sec ? 4 : 0))[i];
    if (m) { const lv = VOICES[c.lead.voice] || VOICES.tri, f = mf(m + (c.lead.oct || 0)), v = (c.lead.vol || .03) * 1.2; lv(f, .75, v, at, 'songfx', -.45); lv(f * 1.0035, .75, v, at + .011, 'songfx', .45); }
  }
  if (bar % 8 === 7 && i === 8 && prog >= s.th.hat) noiseHit({ f0: 700, f1: 7000, q: .8, d: sixT * 8, vol: .022, at, bus: B, pan: -.2 });   // a riser into the next 8-bar section
  if (i === 0 && bar % 4 === 0 && prog > s.th.lead) VOICES.bell(mf(root + 36 + (ch[1][2] || 7)), 1.2, .008, at, B, bar % 8 ? -.3 : .3);   // a little glitter on the first beat of a phrase
}
function songUpdate(prog) {
  if (!song || !AC) return;
  const six = 60 / song.bpm / 4;
  while (song.step * six < songT + .22) { songStep(song, song.step, Math.max(0, song.step * six - songT), prog); song.step++; }
}
// player notes: always in the song's key and voice, snapped to the next 16th if it is close (otherwise instant so it never feels laggy)
function beatNote(vol, up) {
  if (!AC || simming) return;
  if (curTune && song && up === 0) return;   // in a world with a tune, jumps are voiced by the tune (tunes.js), not by a random scale note
  if (!song) { const n = PENT[Math.floor(Math.random() * PENT.length)]; tone(mf(n), 1.0, { vol, att: .004 }); return; }
  const six = 60 / song.bpm / 4, d0 = Math.ceil(songT / six - 1e-6) * six - songT, d = d0 < .06 ? d0 : 0, c = song.cfg, n = c.scale.length;
  song.walk = clamp(song.walk + Math.floor(Math.random() * 5) - 2, 0, 2 * n - 1);
  const m = degMidi(c, clamp(song.walk + up, 0, 3 * n - 1));
  (VOICES[c.lead.voice] || VOICES.tri)(mf(m), .9, vol * 1.15, d, 'song'); tone(mf(m + 12), .5, { vol: vol * .3, att: .004, at: d, bus: 'song' });
}
function beatPulse() {
  const live = !!song;   // a song is playing (a run, the editor preview, the Studio, or a menu): the beat comes from it
  const bpm = song ? song.bpm : (state === 'play' || state === 'dead' || state === 'win' || state === 'edit') ? (state === 'edit' ? ((edLevel && edLevel.bpm) || BASE_BPM) : curBpm) : 76;
  return Math.exp(-(((live ? songT : tg) * bpm / 60) % 1) * 4.5);
}

/* ================= menu music =================
   The title, the level list and the Squish Room each have their own song. update() keeps the right one playing; a run, the editor preview and the
   Studio start their own songs and menu music steps aside. */
let menuKey = null;
function menuWanted() { return state === 'title' ? 'title' : (state === 'select' || state === 'settings') ? 'select' : (state === 'room' && !studio) ? 'room' : null; }
function syncMenuMusic(dt) {
  if (audioSwapped) return;
  const want = menuWanted();
  if (want) {
    if (menuKey !== want || !song) { songStart({ id: 'menu-' + want, name: 'menu', style: MENU_STYLE[want], bpm: STYLES[MENU_STYLE[want]].bpm, menu: true }, 0); if (song) menuKey = want; }
    if (song && menuKey) { songT += dt; songUpdate(1); }
  } else if (menuKey) menuKey = null;   // (whatever started next owns the song now)
}

/* ================= ambience =================
   A quiet bed and a few random sounds per world (breeze and birds, wind and chimes, machines, crickets, bubbles). Everything is routed through one gain
   node, so it fades out as a unit. ambTick() is called every update. */
let amb = null;
const AMB = {
  meadow:  { bed: [[900, .5, .035, .12]], evt: () => { const f = 2400 + Math.random() * 900; for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) tone(f * (1 + k * .08), .07, { vol: .012, att: .004, at: k * .09, to: f * 1.25, bus: 'amb' }); return 4 + Math.random() * 6; } },
  cloud:   { bed: [[1800, .3, .03, .07], [500, .3, .018, .05]], evt: () => { const n = [88, 91, 93, 96, 100][Math.floor(Math.random() * 5)]; tone(mf(n), 1.6, { vol: .012, att: .01, bus: 'amb' }); tone(mf(n) * 2.756, .6, { vol: .003, att: .01, bus: 'amb' }); return 5 + Math.random() * 7; } },
  factory: { bed: [[110, 1.2, .045, .2]], evt: () => { if (Math.random() < .3) noiseHit({ f0: 5000, f1: 2500, q: .6, d: .4, vol: .012, bus: 'amb' }); else { tone(900, .03, { vol: .01, att: .002, bus: 'amb' }); tone(700, .03, { vol: .008, att: .002, at: .18, bus: 'amb' }); } return .9 + Math.random() * 1.6; } },
  night:   { bed: [[300, .4, .02, .05]], evt: () => { const f = 4300 + Math.random() * 400; for (let k = 0; k < 3; k++) tone(f, .035, { vol: .006, att: .003, at: k * .06, bus: 'amb' }); if (Math.random() < .08) { tone(330, .3, { vol: .014, att: .05, to: 290, bus: 'amb' }); tone(300, .4, { vol: .012, att: .05, at: .35, to: 250, bus: 'amb' }); } return 1.2 + Math.random() * 1.8; } },
  slime:   { bed: [[260, 1.4, .05, .3], [90, .8, .03, .15]], evt: () => { const f = 160 + Math.random() * 220; tone(f, .12, { vol: .02, att: .005, to: f * 2.4, bus: 'amb' }); noiseHit({ f0: 700, f1: 300, q: 2, d: .08, vol: .01, at: .08, bus: 'amb' }); return .5 + Math.random() * 1.6; } },
};
function ambStart(kind) {
  ambStop(); if (!AC || simming || !AMB[kind]) return;
  const g = AC.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(.9, AC.currentTime, .8); g.connect(sfxBus);
  const nodes = [];
  for (const [freq, q, vol, rate] of AMB[kind].bed) {   // a bed = looping noise through a band-pass, its level slowly breathing
    const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    const bg = AC.createGain(); bg.gain.value = vol; const lfo = AC.createOscillator(); lfo.frequency.value = rate; const lg = AC.createGain(); lg.gain.value = vol * .6;
    lfo.connect(lg); lg.connect(bg.gain); src.connect(bp); bp.connect(bg); bg.connect(g); src.start(0, Math.random()); lfo.start(); nodes.push(src, lfo);
  }
  amb = { kind, g, nodes, next: AC.currentTime + 1.2 };
}
function ambStop() {
  if (!amb) return;
  const a = amb; amb = null;
  try { a.g.gain.setTargetAtTime(0, AC.currentTime, .25); setTimeout(() => { try { a.nodes.forEach(n => n.stop()); a.g.disconnect(); } catch (e) {} }, 1500); } catch (e) {}
}
function ambTick() {
  if (!amb || !AC || simming || audioSwapped) return;
  while (amb.next < AC.currentTime + .4) amb.next += AMB[amb.kind].evt();
}

/* ================= offline rendering (tests) =================
   Renders a style to an AudioBuffer without making a sound, so tests can prove every song is audible, finite and within the limiter. */
async function renderSongOffline(L, secs, prog = 1, sr = 22050) {
  const oc = new OfflineAudioContext(2, Math.round(sr * secs), sr);
  return withAudioContext(oc, async () => {
    clockOverride = () => songT; audioOpen = true; songStart(L, 0);
    for (songT = 0; songT < secs; songT += .1) songUpdate(prog);
    audioOpen = false; return oc.startRendering();
  });
}
// the same for any short sound: fn() schedules it at time 0 of a fresh offline context
async function renderSfxOffline(fn, secs = 2, sr = 22050) {
  const oc = new OfflineAudioContext(2, Math.round(sr * secs), sr);
  return withAudioContext(oc, async () => { clockOverride = () => 0; audioOpen = true; fn(); audioOpen = false; return oc.startRendering(); });
}
