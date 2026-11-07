'use strict';
/* Jelly Dash — Level data, the official levels, and the live world built from a level.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= level data =================
   A level is { id, name, stars, pal:[themeIdx..], len (tiles), objs:[...] } with objs in tile units:
   block/spike/pad {x, y}, heart {x, y}, gap {x}, portal {x, to:'ship'|'cube'}; y = row above the ground (0..6). */
const OBJ_TYPES = ['block', 'spike', 'pad', 'heart', 'gap', 'portal', 'orb'];   // append only: share codes store the index
// Shift every ground-spike group (by less than a tile) so its IDEAL takeoff lands exactly on an 8th-note line of the music grid
// (8th note = 2 tiles). Jumping on the beat is then the centre of the safe window, not just a nice idea.
// a gap of n starting at tile a is placed 0 or 1 tile later so that its ideal takeoff (a-1.96+n/2, minus the player's half width) falls closest to a beat line
function gapShift(a, n) {
  const f = s => { const m = (((a + s - 2.335 + n / 2) % 2) + 2) % 2; return Math.min(m, 2 - m); };
  return f(0) <= f(1) ? 0 : 1;
}
function alignSpikes(objs) {
  const sp = objs.filter(o => o.t === 'spike' && o.y === 0).sort((p, q) => p.x - q.x);
  for (let i = 0; i < sp.length;) {
    let j = i; while (j + 1 < sp.length && sp[j + 1].x - sp[j].x <= 1.01) j++;
    const a = sp[i].x, n = j - i + 1, w = a - 1.65 + (n - 1) / 2 - .375, d = Math.round(w / 2) * 2 - w, b = sp[j].x;
    for (const o of objs) if (o.t === 'orb' && o.x >= a - .01 && o.x <= b + .01) o.x += d;   // an orb over a group moves with it
    for (let k = i; k <= j; k++) sp[k].x += d;
    i = j + 1;
  }
}
function genLevel(id, name, stars, pal, script, bpm = BASE_BPM, style = 0, auto = true, coy = .09, extra = null) {
  const objs = [], hints = []; let x = 16;   // 16 tiles = one bar of intro
  const add = o => objs.push(o);
  const arc = (a, b, h, n = 4) => { for (let i = 0; i < n; i++) { const t = n === 1 ? .5 : i / (n - 1); add({ t: 'heart', x: a + (b - a) * t, y: h - .5 - Math.pow(2 * t - 1, 2) * .9 }); } };
  const C = {
    spike: n => { for (let i = 0; i < n; i++) add({ t: 'spike', x: x + i, y: 0 }); arc(x - 1, x + n, 2.6); x += n + 5; },
    gap: w => { const s = gapShift(x, w); for (let i = 0; i < w; i++) add({ t: 'gap', x: x + s + i }); arc(x + s - 1, x + s + w, 2.6); x += s + w + 5; },
    block: (w, h) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) add({ t: 'block', x: x + i, y: j }); arc(x, x + w - 1, h + 1.4, 3); x += w + 5; },
    // gap of n, d tiles of ground, then a spike (the landing has to be precise); spike group a, d ground, spike group b (a hop-chain)
    gs: (n, d) => { const s = gapShift(x, n); for (let i = 0; i < n; i++) add({ t: 'gap', x: x + s + i }); add({ t: 'spike', x: x + s + n + d, y: 0 }); arc(x + s - 1, x + s + n + d + 1, 2.8); x += s + n + d + 1 + 5; },
    ss: (a, d, b) => { for (let i = 0; i < a; i++) add({ t: 'spike', x: x + i, y: 0 }); for (let i = 0; i < b; i++) add({ t: 'spike', x: x + a + d + i, y: 0 }); arc(x - 1, x + a + d + b + 1, 2.8); x += a + d + b + 5; },
    dbl: () => { add({ t: 'spike', x, y: 0 }); add({ t: 'spike', x: x + 5, y: 0 }); arc(x - 1, x + 1.5, 2.6, 3); arc(x + 4, x + 6, 2.6, 3); x += 11; },
    stairs: () => {
      add({ t: 'block', x, y: 0 }); add({ t: 'block', x: x + 1, y: 0 }); add({ t: 'spike', x: x + 2, y: 0 });
      for (const dx of [3, 4]) for (const j of [0, 1]) add({ t: 'block', x: x + dx, y: j });
      arc(x, x + 1, 2.4, 2); arc(x + 3, x + 4, 3.4, 2); x += 10;
    },
    pad: () => { add({ t: 'pad', x, y: 0 }); for (let i = 1; i <= 4; i++) add({ t: 'spike', x: x + i, y: 0 }); arc(x + 1, x + 5, 5.0, 5); x += 12; },
    padh: () => { add({ t: 'pad', x, y: 0 }); for (let i = 2; i <= 3; i++) add({ t: 'spike', x: x + i, y: 0 }); arc(x + 1, x + 4, 4.4, 4); x += 9; },   // a gentle pad: two spikes behind it (the pad is the teacher here, not the test)
    bsp: () => { for (let i = 0; i < 4; i++) add({ t: 'block', x: x + i, y: 0 }); add({ t: 'spike', x: x + 2, y: 1 }); arc(x, x + 3, 2.4, 4); x += 9; },
    rest: () => { arc(x, x + 6, 2.2, 4); x += 8; },
    // orb patterns: a hazard too wide for one jump, with an orb over its middle for the second
    og: n => { const sh = gapShift(x, n); for (let i = 0; i < n; i++) add({ t: 'gap', x: x + sh + i }); add({ t: 'orb', x: x + sh + (n - 1) / 2, y: 2 }); arc(x + sh - 1, x + sh + n, 3.2, 3); x += sh + n + 5; },
    os: n => { for (let i = 0; i < n; i++) add({ t: 'spike', x: x + i, y: 0 }); add({ t: 'orb', x: x + (n - 1) / 2, y: 2 }); arc(x - 1, x + n, 3.4, 3); x += n + 5; },   // a short breather of flat ground, no hazards
    ship: rows => {
      const len = 6 + rows.length * 7 + 6;
      add({ t: 'portal', x: x + 1, to: 'ship' }); add({ t: 'portal', x: x + len - 1, to: 'cube' });
      rows.forEach((s, i) => {
        const px = x + 7 + i * 7;
        for (let dx = 0; dx < 2; dx++) { for (let j = 7 - s; j <= 6; j++) add({ t: 'block', x: px + dx, y: j }); for (let j = 0; j < 4 - s; j++) add({ t: 'block', x: px + dx, y: j }); }
        add({ t: 'heart', x: px + .5, y: 5 - s });
        if (i < rows.length - 1) add({ t: 'heart', x: px + 4, y: ((5 - s) + (5 - rows[i + 1])) / 2 });
      });
      x += len + 5;
    },
  };
  for (const tok of script.split(/\s+/).filter(Boolean)) {
    let m;
    if ((m = /^h(\d)$/.exec(tok))) { const t = extra && extra.hints && extra.hints[+m[1]]; if (t) hints.push({ x, text: t }); }   // a tip that appears as the player nears this point; takes no space
    else if ((m = /^s(\d)$/.exec(tok))) C.spike(+m[1]);
    else if ((m = /^og(\d)$/.exec(tok))) C.og(+m[1]);
    else if ((m = /^os(\d)$/.exec(tok))) C.os(+m[1]);
    else if ((m = /^g(\d)$/.exec(tok))) C.gap(+m[1]);
    else if ((m = /^b(\d)(\d)$/.exec(tok))) C.block(+m[1], +m[2]);
    else if ((m = /^gs(\d)(\d)$/.exec(tok))) C.gs(+m[1], +m[2]);
    else if ((m = /^ss(\d)(\d)(\d)$/.exec(tok))) C.ss(+m[1], +m[2], +m[3]);
    else if (tok.startsWith('ship:')) C.ship([...tok.slice(5)].map(Number));
    else if (['dbl', 'stairs', 'pad', 'padh', 'bsp', 'rest'].includes(tok)) C[tok]();
    x = Math.ceil(x / TPB) * TPB;   // every pattern starts on a beat
  }
  alignSpikes(objs);
  const L = { id, name, stars, pal, len: x + 2, objs, bpm, style, auto, coy };
  if (hints.length) L.hints = hints; if (extra && extra.tutorial) L.tutorial = true;
  return L;
}
const OFFICIAL = [
  // [name, difficulty, palette, script, bpm, song style, hold-to-hop?, coyote seconds]  (coyote: see DEF_COY; the solver proves each level at its value)
  // Patterns climb a measured ladder of safe jump windows (at 112 BPM): s1 350 ms, s2 217, g4 267, gs3x 150-333, ss2x 183-217, g5 133, ss121 133, s3/ss321/ss331 83.
  // The first two levels let you hold to keep hopping; from level 3 every hop is its own tap. Pads are no longer free passes: they chain into hops.
  ['First Hop', 1, [0, 1, 2], 's1 s1 s2 s1 b21 s2 s1 s2 b21 s2 g2 s1', 100, 0, true, .04],
  ['Candy Steps', 1, [2, 0, 1], 'b21 s2 stairs s1 b32 s2 stairs b21 s2 bsp s2 stairs g3 s2', 104, 4, true, .04],
  ['Jelly Bounce', 2, [1, 4, 0], 'pad s2 pad ss232 pad gs32 g4 pad bsp pad gs32 pad ss212 g4 pad dbl', 108, 2, false, .05],
  ['Gap Year', 2, [3, 1, 4], 'g3 s1 g4 g3 ss212 g4 gs33 s3 g4 gs32 dbl g5 s2 g3', 110, 3, false, .06],
  ['Little Ship', 2, [4, 0, 2], 's2 s1 ship:22222 rest ss232 s2 ship:12321 rest s2 ss212 gs31 s1 gs32', 105, 4, false, .05],
  ['Sugar Rush', 3, [2, 5, 3], 's2 dbl g4 ss232 stairs gs32 pad bsp g4 ss212 stairs s3 pad gs31 g5 s2 dbl s3', 116, 0, false, .06],
  ['Bubble Tea', 3, [3, 4, 5], 'pad ss212 pad bsp gs32 pad s3 pad stairs g4 pad ss232 gs31 pad b32 g5 pad ss321 s2 gs31', 112, 2, false, .07],
  ['Cloud Nine', 3, [1, 3, 0], 's1 ship:21232 rest ss232 ship:34121 rest s2 gs32 ship:2102034 rest s2 gs31 ss212 s3 gs31', 108, 4, false, .05],
  ['Sparkle Storm', 4, [5, 4, 1], 'ss232 dbl s3 ss232 stairs ss212 g5 ss121 s2 bsp dbl gs32 pad ss212 gs32 s3 g4', 122, 1, false, .06],
  ['Heartbreaker', 4, [0, 5, 4], 's3 g4 ss212 stairs pad bsp ship:1304031 rest ss232 gs32 ss212 pad stairs b32 s3 ss232 g5 ship:2040402 rest gs32 ss321', 118, 3, false, .07],
  ['Moonlit Mochi', 4, [4, 3, 1], 'pad ss321 ship:2231320413 rest b21 gs31 stairs ss331 ship:3120413024 rest pad bsp g5 ss321 s3', 100, 5, false, .07],
  ['Slime Queen', 5, [0, 4, 5, 2], 's3 dbl stairs pad ship:2130421 rest gs32 ss232 bsp dbl pad b32 stairs ship:0413024310 rest ss212 g4 ss232 s2 pad bsp ship:2113204 rest stairs ss232 gs32 pad ss212 s3 b32 dbl g5', 125, 1, false, .09],
  // jump orbs (appended, so every saved id stays valid; slotted into the difficulty order just below)
  ['Orb Orchard', 3, [3, 0, 2], 's2 og6 s1 os5 b32 og6 stairs ss212 os5 og7 pad os6 g3 og6 gs32 os5', 108, 2, false, .05],
  ['Orbital', 4, [1, 5, 4], 'og7 ss232 os6 stairs og6 pad os5 ship:2130 rest og7 gs32 os6 ss321 og6 s3 os6 og7 ss212 os5', 118, 1, false, .06],
  // the first-run tutorial: slow, forgiving, and every new idea arrives with a tip just before it
  ['Welcome', 1, [0, 1, 3], 'h0 rest h1 s1 s1 h2 s2 h3 g3 h4 b21 s1 h5 padh h6 og5 h7 s1 rest', 92, 4, true, .09, { tutorial: true, hints: [
    'Tap anywhere to jump over the gumdrops!', 'Hearts are bonus points — grab a few', 'Hold the screen to keep hopping', 'Gaps: jump just before the edge — you get a tiny grace after it',
    'Land on blocks and keep going', 'Pads launch you — just ride them', 'Orbs: tap while touching one for an extra jump', 'Tap on the beat for PERFECT timing. You have got this!'] }],
].map(([n, st, pal, sc, bpm, sty, auto, coy, extra], i) => genLevel('o' + i, n, st, pal, sc, bpm, sty, auto !== false, coy, extra));
const moveBefore = (id, beforeName) => { const [l] = OFFICIAL.splice(OFFICIAL.findIndex(q => q.id === id), 1); OFFICIAL.splice(OFFICIAL.findIndex(q => q.name === beforeName), 0, l); };
moveBefore('o12', 'Sugar Rush'); moveBefore('o13', 'Heartbreaker'); moveBefore('o14', 'First Hop'); moveBefore('o7', 'Sugar Rush');
/* Hearts that no winning run can take together with the rest (the arc's low end hearts sit where the jump over the hazard has already lifted you), found with
   heartsSync() in solver.js (at Normal and at Spicy pace, the paces that keep hearts) and removed so every official level can be finished with all of its hearts.
   [x, y] in level units. The test suite re-runs the search,
   so if a level script or the jump physics change, it fails until this list is regenerated (each level's `missed` list from heartsSync). */
const UNREACHABLE_HEARTS = {
  'Candy Steps': [[99, 1]], 'Jelly Bounce': [[111, 1]], 'Orb Orchard': [[133, 3.6]], 'Sugar Rush': [[99, 1], [157, 3.6]],
  'Bubble Tea': [[55, 1], [101, 3.6], [205, 3.6], [45, 3.6], [81, 3.6], [137, 3.6], [173, 3.6]],
  'Sparkle Storm': [[97, 2.2], [119, 1]], 'Orbital': [[160, 1.8]], 'Heartbreaker': [[75, 1]], 'Moonlit Mochi': [[281, 3.6], [291, 1]],
  'Slime Queen': [[163, 1], [361, 3.6], [371, 1], [460, 2], [519, 1.2]],
};
for (const L of OFFICIAL) { const drop = UNREACHABLE_HEARTS[L.name]; if (drop) L.objs = L.objs.filter(o => o.t !== 'heart' || !drop.some(([x, y]) => Math.abs(o.x - x) < .002 && Math.abs(o.y - y) < .002)); }
/* ---------- worlds ----------
   Every official level belongs to a world; a world sets the palette, the song and the ambience. Levels run in order, so each world is a contiguous stretch. */
const WORLDS = [
  { id: 'meadow', name: 'Candy Meadow', tag: 'bright, bouncy and a little bit sticky', pal: [0, 2, 1], amb: 'meadow' },
  { id: 'cloud', name: 'Cloud Kingdom', tag: 'soft, high up and very floaty', pal: [1, 3, 4], amb: 'cloud' },
  { id: 'factory', name: 'Sugar Factory', tag: 'gears, fizz and sweet machinery', pal: [2, 5, 0], amb: 'factory' },
  { id: 'night', name: 'Night Garden', tag: 'moonlight, music boxes and mochi', pal: [6, 4, 5], amb: 'night' },
  { id: 'slime', name: 'Slime Palace', tag: 'the queen is home', pal: [7, 3, 1], amb: 'slime' },
];
const WORLD_OF = { 'Welcome': 0, 'First Hop': 0, 'Candy Steps': 0, 'Jelly Bounce': 0, 'Gap Year': 1, 'Little Ship': 1, 'Orb Orchard': 1, 'Cloud Nine': 1, 'Sugar Rush': 2, 'Bubble Tea': 2, 'Sparkle Storm': 2, 'Orbital': 3, 'Heartbreaker': 3, 'Moonlit Mochi': 3, 'Slime Queen': 4 };
const LEVEL_STYLE = { 'Welcome': 10, 'First Hop': 10, 'Candy Steps': 1, 'Jelly Bounce': 2, 'Gap Year': 9, 'Little Ship': 4, 'Orb Orchard': 0, 'Cloud Nine': 9, 'Sugar Rush': 6, 'Bubble Tea': 7, 'Sparkle Storm': 6, 'Orbital': 11, 'Heartbreaker': 3, 'Moonlit Mochi': 5, 'Slime Queen': 8 };   // indexes into STYLES (music.js)
for (const L of OFFICIAL) { L.world = WORLD_OF[L.name]; L.style = LEVEL_STYLE[L.name]; L.pal = WORLDS[L.world].pal.slice(); }

/* ---------- live world built from the current level ---------- */
const solids = [], spikes = [], pads = [], hearts = [], gaps = [], portals = [], orbs = [], clusters = [];
let curLevel = OFFICIAL[0], FINISH = OFFICIAL[0].len * T;
function buildLevel(L, usePace = false) {
  solids.length = spikes.length = pads.length = hearts.length = gaps.length = portals.length = orbs.length = 0;
  curLevel = L; FINISH = L.len * T; curBpm = (L.bpm || BASE_BPM) * (usePace ? (store.pace || 1) : 1); applyTempo(curBpm); autoHold = L.auto !== false; COY = L.coy || DEF_COY; clusters.length = 0;
  const cells = new Set(), gapCols = new Set();
  for (const o of L.objs) {
    if (o.t === 'block') cells.add(o.x + ',' + o.y);
    else if (o.t === 'spike') spikes.push({ x: o.x * T, base: GY - o.y * T });
    else if (o.t === 'pad') pads.push({ x: o.x * T, base: GY - o.y * T, sq: 0, cool: 0 });
    else if (o.t === 'heart') hearts.push({ x: (o.x + .5) * T, y: GY - (o.y + .5) * T, got: false });
    else if (o.t === 'gap') gapCols.add(o.x);
    else if (o.t === 'portal') portals.push({ x: o.x * T, to: o.to });
    else if (o.t === 'orb') orbs.push({ x: (o.x + .5) * T, y: GY - (o.y + .5) * T, used: false });
  }
  portals.sort((a, b) => a.x - b.x);
  // merge block cells into rectangles (rows -> horizontal runs -> vertical stacks)
  const rows = new Map();
  for (const k of cells) { const [x, y] = k.split(',').map(Number); if (!rows.has(y)) rows.set(y, []); rows.get(y).push(x); }
  const runs = [];
  for (const [y, xs] of rows) { xs.sort((a, b) => a - b); let s = xs[0], p = xs[0]; for (let i = 1; i <= xs.length; i++) { if (i < xs.length && xs[i] === p + 1) { p = xs[i]; continue; } runs.push({ x: s, w: p - s + 1, y }); s = xs[i]; p = xs[i]; } }
  runs.sort((a, b) => a.x - b.x || a.w - b.w || a.y - b.y);
  for (let i = 0; i < runs.length;) {
    const r = runs[i]; let h = 1, j = i + 1;
    while (j < runs.length && runs[j].x === r.x && runs[j].w === r.w && runs[j].y === r.y + h) { h++; j++; }
    // skip over unrelated runs sharing x/w but not stacked
    solids.push({ x0: r.x * T, x1: (r.x + r.w) * T, top: GY - (r.y + h) * T, h });
    i = j;
  }
  // ground with gaps
  const cols = [...gapCols].sort((a, b) => a - b); let s0 = null, pv = null;
  for (let i = 0; i <= cols.length; i++) { const c = cols[i]; if (c !== undefined && pv !== null && c === pv + 1) { pv = c; continue; } if (s0 !== null) gaps.push([s0 * T, (pv + 1) * T]); s0 = c === undefined ? null : c; pv = c === undefined ? null : c; }
  let sx = -3000; for (const g of gaps) { solids.push({ x0: sx, x1: g[0], top: GY, h: 99, ground: true }); sx = g[1]; }
  solids.push({ x0: sx, x1: FINISH + 1500, top: GY, h: 99, ground: true });
  // ceilings for ship sections
  for (let i = 0; i < portals.length; i++) if (portals[i].to === 'ship') { const nx = portals.slice(i + 1).find(p => p.to === 'cube'); solids.push({ x0: portals[i].x, x1: nx ? nx.x : FINISH, top: -400, h: 0, bot: CEIL, ceil: true }); }
  solids.forEach(s => { if (s.bot == null) s.bot = s.top + s.h * T; });
  // Hazard clusters with their IDEAL takeoff (player-centre tile) and safe window (tiles). Measured by sweeping every possible press:
  // spikes: window 2.72-(n-1), ideal a-1.65+(n-1)/2 | gaps: window 5.44-n, ideal a-1.96+n/2 | ground blocks: ~3.5 wide, ideal a-2.49.
  // The ideal for spikes lands on the 8th-note grid (within ~3 ms), so "jump on the beat" is also the mechanically safest jump.
  const sg = spikes.filter(s => s.base === GY).sort((p, q) => p.x - q.x);
  for (let i = 0; i < sg.length;) {
    let j = i; while (j + 1 < sg.length && sg[j + 1].x - sg[j].x <= T + 1) j++;
    const a = sg[i].x / T, n = j - i + 1; clusters.push({ kind: 'spike', a, n, ideal: a - 1.65 + (n - 1) / 2, win: Math.max(0, 2.72 - (n - 1)), end: a + n }); i = j + 1;
  }
  // wide windows: put the footprint on the nearest beat, but never outside the safe window
  const snapIdeal = (v, win) => { const s = Math.round((v - .375) / 2) * 2 + .375; return Math.abs(s - v) <= win / 2 - .1 ? s : v; };
  for (const g of gaps) { const a = g[0] / T, n = (g[1] - g[0]) / T, win = Math.max(0, 5.44 - n); clusters.push({ kind: 'gap', a, n, ideal: snapIdeal(a - 1.96 + n / 2, win), win, end: a + n }); }
  for (const s of solids) if (!s.ground && !s.ceil && Math.abs(s.top + s.h * T - GY) < 1) { const a = s.x0 / T, win = 3.5 - 1.1 * (s.h - 1); clusters.push({ kind: 'block', a, n: (s.x1 - s.x0) / T, h: s.h, ideal: snapIdeal(a - 2.49, win), win, end: s.x1 / T }); }
  clusters.sort((p, q) => p.a - q.a); clusters.forEach(c => { c.done = false; c.ship = formAt(c.a * T + T / 2) === 'ship'; });
}
// (the first buildLevel(OFFICIAL[0]) runs from main.js, once every module has loaded)

const rnd = rng(7);
const clouds = Array.from({ length: 9 }, () => ({ x: rnd() * 1400, y: 40 + rnd() * 180, s: .7 + rnd() * .9, p: .08 + rnd() * .12 }));
const floaters = Array.from({ length: 16 }, () => ({ x: rnd() * 1400, y: 40 + rnd() * 330, s: 5 + rnd() * 9, ph: rnd() * 6, k: rnd() < .5 ? 'h' : 's' }));
