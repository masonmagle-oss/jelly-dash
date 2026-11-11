'use strict';
/* Jelly Dash — Level data, the official levels, and the live world built from a level.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= level data =================
   A level is { id, name, stars, pal:[themeIdx..], len (tiles), objs:[...] } with objs in tile units:
   block/spike/pad {x, y}, heart {x, y}, gap {x}, portal {x, to:'ship'|'cube'}; y = row above the ground (0..6). */
const OBJ_TYPES = ['block', 'spike', 'pad', 'heart', 'gap', 'portal', 'orb', 'gate'];   // gate {x}: a gummy gate hanging from the ceiling down to GATE_GAP above the floor: only a flattened (squished) jelly fits under it   // append only: share codes store the index
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
    // puff patterns (levels with extra.puff): pg = a gap too wide for one jump (n tiles): hop, then hold Squish to float across; hearts ride the glide. pp = a wide gap, 2 tiles of floor, then a spike: glide, land, hop at once
    // (the hearts follow the real path of a hop and a float: up near the take-off, sinking across the gap)
    pgHearts: (s, n) => { add({ t: 'heart', x: x + s + 1.5, y: 2.3 }); add({ t: 'heart', x: x + s + n / 2, y: 1.9 }); add({ t: 'heart', x: x + s + n - 1.5, y: 1.1 }); },
    pg: n => { const s = gapShift(x, n); for (let i = 0; i < n; i++) add({ t: 'gap', x: x + s + i }); C.pgHearts(s, n); x += s + n + 6; },
    pp: (n, d) => { const s = gapShift(x, n); for (let i = 0; i < n; i++) add({ t: 'gap', x: x + s + i }); add({ t: 'spike', x: x + s + n + d, y: 0 }); C.pgHearts(s, n); x += s + n + d + 1 + 5; },
    // squish patterns: a gummy gate n tiles wide (flatten to slip under it, hearts on the floor beneath); fs = a gate, d tiles of floor, then a spike: stand up and hop at once
    fl: n => { for (let i = 0; i < n; i++) { add({ t: 'gate', x: x + i }); add({ t: 'heart', x: x + i, y: 0 }); } x += n + 6; },
    fs: (n, d) => { for (let i = 0; i < n; i++) { add({ t: 'gate', x: x + i }); add({ t: 'heart', x: x + i, y: 0 }); } add({ t: 'spike', x: x + n + d, y: 0 }); arc(x + n + d - 1, x + n + d + 1, 2.8, 3); x += n + d + 1 + 5; },
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
    else if ((m = /^pg(\d)$/.exec(tok))) C.pg(+m[1]);
    else if ((m = /^pp(\d)(\d)$/.exec(tok))) C.pp(+m[1], +m[2]);
    else if ((m = /^fl(\d)$/.exec(tok))) C.fl(+m[1]);
    else if ((m = /^fs(\d)(\d)$/.exec(tok))) C.fs(+m[1], +m[2]);
    else if ((m = /^ss(\d)(\d)(\d)$/.exec(tok))) C.ss(+m[1], +m[2], +m[3]);
    else if (tok.startsWith('ship:')) C.ship([...tok.slice(5)].map(Number));
    else if (['dbl', 'stairs', 'pad', 'padh', 'bsp', 'rest'].includes(tok)) C[tok]();
    x = Math.ceil(x / TPB) * TPB;   // every pattern starts on a beat
  }
  alignSpikes(objs);
  const L = { id, name, stars, pal, len: x + 2, objs, bpm, style, auto, coy, script };   // script: kept so the tests can measure how hard each level is (see "difficulty ramp" in tests/suite.js)
  if (hints.length) L.hints = hints; if (extra && extra.tutorial) L.tutorial = true; if (extra && extra.puff) L.puff = true; if (extra && extra.bounce) L.bounce = true; if (extra && extra.intro) L.intro = true;
  return L;
}
const OFFICIAL = [
  // [name, difficulty, palette, script, bpm, song style, hold-to-hop?, coyote seconds]  (coyote: see DEF_COY; the solver proves each level at its value)
  // Patterns climb a measured ladder of safe jump windows (at 112 BPM): s1 350 ms, s2 217, g4 267, gs3x 150-333, ss2x 183-217, g5 133, ss121 133, s3/ss321/ss331 83.
  // The first two levels let you hold to keep hopping; from level 3 every hop is its own tap. Pads are no longer free passes: they chain into hops.
  // The levels are a ramp: tempo never drops from one level to the next, and the "pressure" score (hazards per second, each weighted by how narrow its window is;
  // see pressureOf in tests/suite.js) rises by at least a notch every level, from First Hop to Slime Queen. The suite fails if a change breaks that.
  ['First Hop', 1, [0, 1, 2], 's1 s1 s2 s1 b21 s2 s1 s2 b21 s2 g2 s1', 100, 0, true, .04],
  ['Candy Steps', 1, [2, 0, 1], 'b21 s2 stairs s1 b32 s2 stairs b21 s2 bsp s2 stairs g3 s2', 100, 4, true, .04],
  ['Jelly Bounce', 2, [1, 4, 0], 'pad s2 padh ss232 pad gs32 g4 padh bsp pad gs32 padh ss212 g4 pad dbl', 106, 2, false, .05],
  ['Gap Year', 2, [3, 1, 4], 'g3 s2 g4 ss232 ss212 g4 gs33 s2 g4 gs32 dbl g4 s2 ss212', 108, 3, false, .06],
  ['Little Ship', 2, [4, 0, 2], 'ss212 ss232 ship:21312 ss232 ss212 ship:13231 ss212 s2 gs31 ss232 gs32', 110, 4, false, .05],
  ['Sugar Rush', 3, [2, 5, 3], 's2 dbl g4 ss232 stairs gs32 pad ss232 g4 ss212 stairs s3 pad gs31 g4 s3 dbl s2', 116, 0, false, .06],
  ['Bubble Tea', 3, [3, 4, 5], 'padh ss212 pad ss232 gs32 padh s3 pad stairs g4 padh ss232 gs31 pad ss232 g4 padh ss321 s2 gs31', 116, 2, false, .07],
  ['Cloud Nine', 3, [1, 3, 0], 'ss212 ship:30413 ss232 ship:34021 ss232 gs32 ship:3102034 ss212 ss232 gs31 ss232 ss212 gs31', 115, 4, false, .05],
  ['Sparkle Storm', 4, [5, 4, 1], 'ss232 dbl s3 ss232 stairs ss212 g5 ss121 s2 bsp dbl gs32 pad ss212 gs32 s3 g4', 116, 1, false, .06],
  ['Heartbreaker', 4, [0, 5, 4], 's2 g4 ss212 stairs padh ss232 ship:1304031 ss232 gs32 ss212 padh stairs gs32 s3 ss232 g5 ship:2040402 gs32 ss321', 122, 3, false, .07],
  ['Moonlit Mochi', 4, [4, 3, 1], 'padh ss321 ship:2231320413 ss232 ss232 gs31 stairs ss331 ship:3120413024 padh ss232 g5 ss321 s3', 124, 5, false, .07],
  ['Slime Queen', 5, [0, 4, 5, 2], 's3 dbl stairs padh ship:2130421 gs32 ss232 ss321 dbl padh ss232 stairs ship:0413024310 ss212 g4 ss232 ss321 padh ss321 ship:2113204 stairs ss232 gs32 padh ss212 s3 ss232 dbl g5 ss331', 130, 1, false, .09],
  // jump orbs (appended, so every saved id stays valid; slotted into the difficulty order just below)
  ['Orb Orchard', 3, [3, 0, 2], 'ss212 og6 ss212 os5 b32 og6 stairs ss232 os5 og7 padh os6 g4 og6 gs32 os5', 112, 2, false, .05],
  ['Orbital', 4, [1, 5, 4], 'og7 ss232 os6 ss321 og6 padh os5 ship:20413 ss321 og7 gs32 os6 ss321 og6 s3 os6 ss331 og7 ss212 os5', 122, 1, false, .06],
  // the first-run tutorial: slow, forgiving, and every new idea arrives with a tip just before it
  ['Welcome', 1, [0, 1, 3], 'h0 rest h1 s1 s1 h2 s2 h3 g3 h4 b21 s1 h5 padh h6 og5 h7 s1 rest', 92, 4, true, .09, { tutorial: true, hints: [
    'Tap anywhere to jump over the gumdrops!', 'Hearts are bonus points — grab a few', 'Hold the screen to keep hopping', 'Gaps: jump just before the edge — you get a tiny grace after it',
    'Land on blocks and keep going', 'Pads launch you — just ride them', 'Orbs: tap while touching one for an extra jump', 'Tap on the beat for PERFECT timing. You have got this!'] }],
  // the squish power (appended, so every saved id stays valid; slotted into the order below): hold Squish to flatten and slip under gummy gates (fl = a gate, fs = a gate then a spike)
  ['Puddle Hop', 1, [0, 2, 1], 'h0 fl2 h1 fl3 s2 fl2 fl3 h2 fs23 fl2 fs33', 103, 1, false, .06, { hints: [
    'New move! Hold SQUISH to flatten and slip under the gummy gates, then let go', 'Hearts hide under the gates: squish to get them!', 'Squish, let go, then hop the gumdrop'] }],
  ['Gummy Gates', 3, [1, 3, 4], 'fl2 s2 fs23 fl3 ss212 fs22 fl2 g3 fs23 fl3 fs32 s2 fs22', 110, 9, false, .06],
  // the puff power (levels with extra.puff): hold Squish in the air to puff up into a balloon and float across gaps too wide for any jump (pg = a wide gap, pp = a wide gap, then a spike).
  // Puff Pillow is a gentle intro (extra.intro: a new power is taught below the pressure of its neighbours, so the ramp test skips it, like the Welcome level); Pillow Fort mixes both powers.
  ['Puff Pillow', 2, [1, 3, 4], 'h0 pg6 h1 s2 pg6 pg6 h2 pp63 pg7 s2 pg6 pp73', 107, 4, false, .06, { puff: true, intro: true, hints: [
    'New move! Hop, then HOLD SQUISH in the air to puff up and float', 'Let go to drop. Your puff refills when you land', 'Float, land, then hop the gumdrop'] }],
  ['Pillow Fort', 3, [2, 5, 0], 'pg7 ss232 fl2 pg7 ss212 fs23 pg7 ss321 fs22 pg7 ss232 fs22', 116, 6, false, .06, { puff: true }],
  // the bounce power (levels with extra.bounce): tap just before you land and the jelly squish-bounces higher, over blocks 3 and 4 tall (b33, b34, b44) that no ordinary jump clears. Boing Bay is the gentle intro.
  ['Boing Bay', 4, [6, 4, 5], 'h0 rest h1 b33 rest b33 h2 ss212 b34 rest b34', 118, 7, false, .06, { bounce: true, intro: true, hints: [
    'New move! Tap just BEFORE you land to bounce extra high', 'Land, bounce, land, bounce: the ring on the ground shows when to tap', 'Squish down, spring up: chain it from hop to hop'] }],
  ['Bounce House', 4, [6, 4, 5], 'ss212 b34 ss232 b33 ss321 b44 ss212 b34 ss232 b33 ss321', 117, 8, false, .06, { bounce: true }],
  // the second wave (appended, so every saved id stays valid; slotted into the difficulty order below): an easy bridge near the start, two bridges that fill the climb to the finale,
  // and the boss, Royal Jelly: the longest and hardest level, with gates, puffs, bounces and ship corridors in one run
  ['Sprinkle Path', 1, [0, 2, 1], 's2 g3 s2 stairs s1 s2 bsp s2 g3 s2', 100, 0, true, .04],
  ['Marshmallow Maze', 4, [2, 5, 0], 'pg7 ss321 fs23 pp63 ss331 fs22 ss321 pp73 ss331 fs23 pg6', 122, 6, false, .06, { puff: true }],
  ['Lullaby Lane', 4, [6, 4, 5], 'b34 ss321 b44 ss331 b33 gs32 b34 ss232 ss321 b44 ss331', 126, 5, false, .06, { bounce: true }],
  ['Royal Jelly', 5, [7, 3, 1], 'pg7 ss321 fs23 pp63 ss331 ship:2130421 ss232 b34 ss321 b44 ss331 b33 fl3 fs22 pg8 b44 ss331', 138, 8, false, .06, { puff: true, bounce: true }],
].map(([n, st, pal, sc, bpm, sty, auto, coy, extra], i) => genLevel('o' + i, n, st, pal, sc, bpm, sty, auto !== false, coy, extra));
const moveBefore = (id, beforeName) => { const [l] = OFFICIAL.splice(OFFICIAL.findIndex(q => q.id === id), 1); OFFICIAL.splice(OFFICIAL.findIndex(q => q.name === beforeName), 0, l); };
moveBefore('o12', 'Sugar Rush'); moveBefore('o13', 'Heartbreaker'); moveBefore('o14', 'First Hop'); moveBefore('o7', 'Sugar Rush'); moveBefore('o15', 'Jelly Bounce'); moveBefore('o16', 'Orb Orchard'); moveBefore('o17', 'Gap Year'); moveBefore('o18', 'Sugar Rush'); moveBefore('o19', 'Orbital'); moveBefore('o20', 'Orbital'); moveBefore('o21', 'Candy Steps'); moveBefore('o22', 'Heartbreaker'); moveBefore('o23', 'Slime Queen');   // (Royal Jelly, o24, stays last)
/* Hearts that no winning run can take together with the rest (the arc's low end hearts sit where the jump over the hazard has already lifted you), found with
   heartsSync() in solver.js (at Chill, Normal and Spicy pace) and removed so every official level can be finished with all of its hearts at every speed.
   [x, y] in level units. The test suite re-runs the search,
   so if a level script or the jump physics change, it fails until this list is regenerated (each level's `missed` list from heartsSync). */
const UNREACHABLE_HEARTS = {
  'Candy Steps': [[99, 1]], 'Jelly Bounce': [[111, 1]], 'Sugar Rush': [[157, 3.6]], 'Bubble Tea': [[101, 3.6]],
  'Sparkle Storm': [[97, 2.2], [119, 1], [99, 2.2]], 'Orbital': [[82, 3.8], [254, 2.2]], 'Moonlit Mochi': [[178, 2.2]], 'Slime Queen': [[546, 2.2]],
  'Sprinkle Path': [[75, 1]], 'Lullaby Lane': [[39, 4], [113.5, 4.9], [37.5, 4.9], [81, 4.9]],
  'Boing Bay': [[54, 1.4], [68, .8]], 'Bounce House': [[22, 1.4], [69.5, 4.9], [86, 1.4], [93, 4.9], [60.333, 2.2]],
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
const WORLD_OF = { 'Welcome': 0, 'First Hop': 0, 'Candy Steps': 0, 'Puddle Hop': 0, 'Jelly Bounce': 0, 'Gummy Gates': 1, 'Puff Pillow': 1, 'Pillow Fort': 2, 'Boing Bay': 3, 'Bounce House': 3, 'Gap Year': 1, 'Little Ship': 1, 'Orb Orchard': 1, 'Cloud Nine': 1, 'Sugar Rush': 2, 'Bubble Tea': 2, 'Sparkle Storm': 2, 'Orbital': 3, 'Heartbreaker': 3, 'Moonlit Mochi': 3, 'Slime Queen': 4, 'Sprinkle Path': 0, 'Marshmallow Maze': 3, 'Lullaby Lane': 3, 'Royal Jelly': 4 };
const LEVEL_STYLE = { 'Welcome': 10, 'First Hop': 10, 'Candy Steps': 1, 'Puddle Hop': 4, 'Gummy Gates': 3, 'Puff Pillow': 9, 'Pillow Fort': 6, 'Boing Bay': 5, 'Bounce House': 3, 'Jelly Bounce': 2, 'Gap Year': 9, 'Little Ship': 4, 'Orb Orchard': 0, 'Cloud Nine': 9, 'Sugar Rush': 6, 'Bubble Tea': 7, 'Sparkle Storm': 6, 'Orbital': 11, 'Heartbreaker': 3, 'Moonlit Mochi': 5, 'Slime Queen': 8, 'Sprinkle Path': 4, 'Marshmallow Maze': 6, 'Lullaby Lane': 5, 'Royal Jelly': 11 };   // indexes into STYLES (music.js)
for (const L of OFFICIAL) { L.world = WORLD_OF[L.name]; L.style = LEVEL_STYLE[L.name]; L.pal = WORLDS[L.world].pal.slice(); }

/* ---------- live world built from the current level ---------- */
const solids = [], spikes = [], pads = [], hearts = [], gaps = [], portals = [], orbs = [], clusters = [];
let hasBounce = false;   // the level allows the bounce power (a tap just before landing springs up higher, see jumpFx)
let hasGate = false, hasPuff = false, hasSqueeze = false;   // hasGate: the level uses the squish power (flatten under gummy gates); hasPuff: it allows the puff power (glide in the air); hasSqueeze: either, so the Squish button shows and the solver also tries holding it
let curLevel = OFFICIAL[0], FINISH = OFFICIAL[0].len * T;
function buildLevel(L, usePace = false) {
  solids.length = spikes.length = pads.length = hearts.length = gaps.length = portals.length = orbs.length = 0;
  curLevel = L; FINISH = L.len * T; curBpm = (L.bpm || BASE_BPM) * (usePace ? (store.pace || 1) : 1); applyTempo(curBpm); autoHold = L.auto !== false; COY = L.coy || DEF_COY; clusters.length = 0;
  const cells = new Set(), gapCols = new Set(), gateCols = new Set();
  for (const o of L.objs) {
    if (o.t === 'block') cells.add(o.x + ',' + o.y);
    else if (o.t === 'gate') gateCols.add(o.x);
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
  { const gc = [...gateCols].sort((a, b) => a - b); let a = null, p = null;   // gummy gates: a run of columns is one gate, from the top of the screen down to GATE_GAP above the floor
    for (let i = 0; i <= gc.length; i++) { const c = gc[i]; if (c !== undefined && p !== null && c === p + 1) { p = c; continue; } if (a !== null) solids.push({ x0: a * T, x1: (p + 1) * T, top: -400, h: 0, bot: GY - GATE_GAP, ceil: true, gate: true }); a = c === undefined ? null : c; p = a; } }
  hasGate = solids.some(s => s.gate); hasPuff = !!L.puff; hasSqueeze = hasGate || hasPuff; hasBounce = !!L.bounce;
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
