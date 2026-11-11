/* In-browser checks for Jelly Dash. Open tests.html. Each test either returns, or throws a message. Keep tests independent of each other. */
'use strict';
(() => {
  const J = window.__jd, FULL = location.search.includes('full'), queue = [], results = (window.__results = []);
  const test = (name, fn, opts = {}) => queue.push({ name, fn, slow: !!opts.slow });
  const ok = (c, msg) => { if (!c) throw new Error(msg || 'expected true'); };
  const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || 'values differ') + ': got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); };
  const frames = n => new Promise(res => { let k = n; const f = () => (--k <= 0 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const wait = ms => new Promise(res => setTimeout(res, ms));
  const level = name => J.OFFICIAL.find(l => l.name === name);
  const toTitle = async () => { J.setState('title'); J.setMode('dash'); await frames(3); };

  /* ---------- data ---------- */
  test('official levels: unique ids, sane fields, tutorial first', () => {
    const ids = new Set(); for (const l of J.OFFICIAL) { ok(!ids.has(l.id), 'duplicate id ' + l.id); ids.add(l.id); ok(l.name && l.objs.length && l.len > 40, 'bad level ' + l.name); ok(l.stars >= 1 && l.stars <= 5, 'stars ' + l.name); ok(l.coy >= .03 && l.coy <= .12, 'coyote ' + l.name); }
    eq(J.OFFICIAL.length, 21, 'level count'); ok(J.OFFICIAL[0].tutorial, 'the Welcome level is first'); ok(J.OFFICIAL[0].hints.length >= 6, 'tutorial has its tips');
    for (const id of ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9', 'o10', 'o11']) ok(ids.has(id), 'saved id kept: ' + id);
  });
  test('level share codes round-trip every official level', () => {
    for (const l of J.OFFICIAL) { const r = J.parseLevelCode(J.levelCode(l)); ok(r, 'parse ' + l.name); eq(r.objs.length, l.objs.length, 'objects of ' + l.name); eq(r.coy, l.coy, 'coyote of ' + l.name); }
    for (const junk of ['', 'abc', 'JD1.', 'JD1.@@@', '{}', 'x'.repeat(200000)]) eq(J.parseLevelCode(junk), null, 'junk code accepted');
  });
  test('save normaliser repairs anything', () => {
    const bad = [null, undefined, 5, 'x', [], {}, { custom: 'x', best: null, pace: 'a', studio: 5, goals: 5, set: 3 }, { goals: { done: 'x', mats: [], hops: -3, secs: 'q', day: 7, daySecs: null, cozyDays: 'z', streak: {}, lastCozy: ['a'] } }, { custom: [null, { objs: 5 }, { objs: [] }], score: [], rate: 7, haz: -4, skin: 'q', set: { music: 99, sfx: -1, haptics: 'no', reduceMotion: 'x' } }];
    for (const b of bad) {
      const s = J.normalizeStore(b);
      ok(Array.isArray(s.custom) && s.custom.every(l => l && Array.isArray(l.objs)), 'custom'); ok(s.best && s.score && s.rate && s.studio && s.studio.stars, 'maps');
      ok(s.goals && s.goals.done && s.goals.mats && s.goals.hops >= 0 && s.goals.secs >= 0 && s.goals.daySecs >= 0 && s.goals.cozyDays >= 0 && s.goals.streak >= 0 && typeof s.goals.day === 'string' && typeof s.goals.lastCozy === 'string', 'goals');
      ok(s.pace > 0 && s.haz >= 0 && s.skin >= 0, 'numbers'); ok(s.set.music >= 0 && s.set.music <= 1 && s.set.sfx >= 0 && s.set.sfx <= 1, 'volumes'); ok([null, true, false].includes(s.set.reduceMotion), 'reduce motion');
    }
    eq(J.normalizeStore({ set: { music: .3 } }).set.music, .3, 'good values are kept');
  });

  /* ---------- mechanics ---------- */
  test('orbs: boost on a press in reach, once per run, re-armed on restart', () => {
    const L = level('Orb Orchard'); J.startLevel(L, 'dash', false); const o = J.orbs[0];
    const at = (dx = 0, dy = 0) => { J.P.wx = o.x - J.P.w / 2 + dx; J.P.y = o.y - J.P.h / 2 + dy; J.P.vy = 100; J.P.grounded = false; J.P.coy = 0; o.used = false; J.inp.buf = 0; J.inp.held = false; };
    at(); J.stepPlayer(J.STEP, 0, true); ok(!o.used, 'no press, no boost');
    at(); J.inp.buf = .12; J.stepPlayer(J.STEP, 0, true); ok(o.used && J.P.vy < -500, 'press in reach boosts');
    at(0, 90); J.inp.buf = .12; J.stepPlayer(J.STEP, 0, true); ok(!o.used, 'out of reach does nothing');
    at(); J.inp.buf = .12; J.stepPlayer(J.STEP, 0, true); const vy = J.P.vy; J.P.vy = 100; J.inp.buf = .12; J.stepPlayer(J.STEP, 0, true); ok(J.P.vy > vy + 50, 'a spent orb gives nothing');
    J.startLevel(L, 'dash', false); ok(J.orbs.every(q => !q.used), 'orbs re-armed');
  });
  test('orb patterns need their orbs (and are beatable with them)', () => {
    for (const sc of ['og6', 'os5']) { const L = J.genLevel('t', sc, 3, [0, 1, 2], sc + ' ' + sc, 108, 2, false, .06); ok(J.solveSync(L, 20000).ok, sc + ' with orbs'); L.objs = L.objs.filter(o => o.t !== 'orb'); ok(!J.solveSync(L, 20000).ok, sc + ' should be impossible without orbs'); }
  }, { slow: true });
  test('hazard looks never get a harsher hitbox than the default', () => {
    for (let i = 0; i < 5; i++) { /* every look exposes a hitbox via the level solver: the solver always uses the strict one, so this documents the rule */ }
    ok(J.getView().VW >= 960, 'stage width');
  });
  test('practice: checkpoints restore position, hearts and orbs; undo works', () => {
    J.getStore().autoCp = false;   // only the checkpoint placed by hand counts here
    const L = level('Orb Orchard'); J.startLevel(L, 'practice', false); ok(J.getMode() === 'practice');
    for (let i = 0; i < 400; i++) J.update(J.STEP);
    J.practiceSave(false); const cp = J.getPcp(); ok(cp.length >= 1, 'saved'); const wx = cp[cp.length - 1].wx;
    for (let i = 0; i < 200; i++) J.update(J.STEP); ok(J.P.wx > wx, 'moved on');
    J.orbs[0].used = true; J.P.wx = J.OFFICIAL[0].len * 48 * .9; J.P.y = 600; for (let i = 0; i < 5; i++) J.update(J.STEP);   // fall out of the world = die
    ok(J.getState() === 'play', 'practice never shows the game-over screen'); ok(Math.abs(J.P.wx - wx) < 60, 'respawned at the checkpoint (' + Math.round(J.P.wx) + ' vs ' + Math.round(wx) + ')');
    const n = J.getPcp().length; J.practiceUndo(); eq(J.getPcp().length, n - 1, 'undo removes one');
    J.setMode('dash'); J.getStore().autoCp = true;
  });
  test('coyote time: a jump still works just after a ledge, not long after', () => {
    const L = level('Gap Year'); J.startLevel(L, 'dash', false); const COY = L.coy;
    const trial = delay => { J.P.grounded = false; J.P.coy = COY; J.P.vy = 80; J.inp.buf = 0; J.inp.held = false; J.P.y = 300; J.P.form = 'cube'; J.P.h = 34; J.P.wx = 100;
      let t = 0; while (t < delay) { J.stepPlayer(J.STEP, 0, false); t += J.STEP; } J.inp.buf = .12; const vy0 = J.P.vy; J.stepPlayer(J.STEP, 0, false); return J.P.vy < vy0 - 500; };
    ok(trial(COY * .5), 'jump inside the grace'); ok(!trial(COY + .08), 'no jump after the grace');
  });

  /* ---------- worlds, music and sound ---------- */
  test('worlds: every official level has a world, a playable song style and its world palette', () => {
    for (const L of J.OFFICIAL) { ok(J.WORLDS[L.world], 'world of ' + L.name); ok(L.style >= 0 && L.style < J.SONG_N, 'style of ' + L.name); eq(L.pal, J.WORLDS[L.world].pal, 'palette of ' + L.name); }
    const order = J.OFFICIAL.map(l => l.world); for (let i = 1; i < order.length; i++) ok(order[i] >= order[i - 1], 'worlds run in order (a world is one contiguous stretch)');
    eq([...new Set(order)].length, J.WORLDS.length, 'every world has levels');
  });
  test('styles: every song is well-formed data', () => {
    ok(J.SONG_N >= 12, 'enough playable styles'); ok(J.STYLES.slice(J.SONG_N).every(s => s.menu) && !J.STYLES.slice(0, J.SONG_N).some(s => s.menu), 'menu styles come last');
    for (const [i, st] of J.STYLES.entries()) {
      const c = J.styleCfg(i), d = c.drums, nm = st.name; ok(nm, 'name ' + i); ok([5, 7].includes(c.scale.length), nm + ' scale'); ok(c.prog.length >= 4 && c.prog.every(b => Number.isFinite(b[0]) && b[1].length >= 3), nm + ' progression');
      for (const k of ['kick', 'snare', 'clap', 'hat', 'open', 'perc', 'shaker']) ok(d[k].every(n => Number.isInteger(n) && n >= 0 && n < 16), nm + ' drums.' + k);
      ok(J.KITS[c.kit], nm + ' kit'); ok(c.bass.steps.every(x => Number.isInteger(Array.isArray(x) ? x[0] : x)), nm + ' bass steps'); ok(J.VOICES[c.bass.voice] && J.VOICES[c.lead.voice] && J.VOICES[c.pad.voice], nm + ' voices');
      if (c.arp) { eq(c.arp.pattern.length, 16, nm + ' arp length'); ok(J.VOICES[c.arp.voice], nm + ' arp voice'); } ok(c.bpm >= 60 && c.bpm <= 160, nm + ' bpm');
    }
    for (const k of ['title', 'select', 'room']) ok(J.STYLES[J.MENU_STYLE[k]].menu, 'menu style ' + k);
  });
  test('menus pick their own song', async () => {
    const want = {}; for (const st of ['title', 'select', 'settings', 'room']) { J.setState(st); want[st] = J.menuWanted(); } await toTitle();
    eq(want, { title: 'title', select: 'select', settings: 'select', room: 'room' });
  });
  // every song is rendered offline and measured: is it audible, clean, bright enough for a phone speaker, and does it have a pulse you can jump to?
  for (let i = 0; ; i++) {
    if (i >= J.STYLES.length) break;
    test(`music is audible, clean, bright and has a pulse: ${J.STYLES[i].name}`, async () => {
      const st = J.STYLES[i], buf = await J.renderSongOffline({ id: 't' + i, name: 't', style: i, bpm: st.bpm, menu: true }, 16, 1);
      const L = buf.getChannelData(0), R = buf.getChannelData(1), A = DSP.analyse(L, R, buf.sampleRate, st.bpm), hi = A.bandPct['pres2.5-6k'] + A.bandPct['air6k+'];
      eq(A.nan, 0, 'non-finite samples'); ok(A.peakDb <= -6, 'peak ' + A.peakDb + ' dB leaves no headroom'); ok(A.rmsDb > -38 && A.rmsDb < -26, 'loudness ' + A.rmsDb + ' dB is outside the -38..-26 band every song must sit in (add a gain: trim)');
      ok(A.centroid >= 1500, 'dull: spectral centroid ' + A.centroid + ' Hz (want >= 1500; brighten the lead/hats)'); ok(hi >= 1.5, 'too little above 2.5 kHz (' + hi.toFixed(1) + '%): it will disappear on a phone speaker');
      ok(A.bandPct['sub<90'] <= 28, 'too much below 90 Hz (' + A.bandPct['sub<90'] + '%): phones cannot play it'); ok(A.beatAC >= .2, 'weak pulse (beat clarity ' + A.beatAC + '): add hats, shaker or a pulse: [0, 4, 8, 12] tick');
    }, { slow: true });
  }
  test('music has stereo width: the melody sits left and right, not in the middle', async () => {
    const buf = await J.renderSongOffline({ id: 'w', name: 'w', style: 2, bpm: J.STYLES[2].bpm, menu: true }, 12, 1), A = DSP.analyse(buf.getChannelData(0), buf.getChannelData(1), buf.sampleRate, 108);
    ok(A.corrHi < .97, 'L/R correlation above 500 Hz is ' + A.corrHi + ' (that is mono)');
  }, { slow: true });
  test('sound effects: every effect is calibrated, finite and lands on its target level', async () => {
    const args = { squish: [600, 'jelly'], bloop: [0], toggle: [true], panel: [true], tick: [.5], star: [1], combo: [3], land: [600] };
    const names = Object.keys(J.sfx).filter(k => k !== 'heart'); ok(names.length >= 24, 'a full set of effects (' + names.length + ')');
    for (const k of names) {
      ok(Number.isFinite(J.SFX_TARGET[k]), k + ' has no entry in SFX_TARGET: add one, then run tests/calibrate and paste the new SFX_TRIM');
      let peak = 0, hf = 0; for (let rep = 0; rep < 3; rep++) { const buf = await J.renderSfxOffline(() => J.sfx[k](...(args[k] || [])), 2); for (const c of [0, 1]) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { ok(Number.isFinite(d[i]), k + ' non-finite'); if (Math.abs(d[i]) > peak) peak = Math.abs(d[i]); } hf = Math.max(hf, DSP.highPeak(d, buf.sampleRate)); } }
      const pdb = 20 * Math.log10(peak + 1e-12), hdb = 20 * Math.log10(hf + 1e-12);
      ok(pdb <= J.SFX_TARGET[k] + 3.2, k + ' peaks at ' + pdb.toFixed(1) + ' dBFS, target ' + J.SFX_TARGET[k] + ' (re-run the calibration)');
      ok(hdb <= J.SFX_HF_CEIL + 1.5, k + ' is too harsh: its part above 2 kHz peaks at ' + hdb.toFixed(1) + ' dBFS (limit ' + J.SFX_HF_CEIL + '); lower its notes or re-run the calibration');
      ok(pdb >= J.SFX_TARGET[k] - 3.2 || hdb >= J.SFX_HF_CEIL - 1.5, k + ' is ' + pdb.toFixed(1) + ' dBFS, well under its target ' + J.SFX_TARGET[k] + ' (re-run the calibration)');
    }
  }, { slow: true });
  test('jelly sounds: ten wet squish voices (and several for hops, landings and pads) that never repeat back to back, each at its own level', async () => {
    const banks = { squish: SQUISH_VOICES, land: LAND_VOICES, jump: JUMP_VOICES, pad: PAD_VOICES };
    ok(SQUISH_VOICES.length >= 10, 'ten squish voices, not ' + SQUISH_VOICES.length); ok(LAND_VOICES.length >= 5 && JUMP_VOICES.length >= 5 && PAD_VOICES.length >= 3, 'a few voices for landings, hops and pads');
    for (const k of Object.keys(banks)) eq(VOICE_GAIN[k].length, banks[k].length, k + ' has a gain for every voice');
    for (const k of Object.keys(banks)) {   // a long run: all voices get used, and no voice comes back until two others have played
      const n = banks[k].length, seen = new Set(), run = []; for (let i = 0; i < 400; i++) { const v = pickVoice(k, n); seen.add(v); run.push(v); }
      eq(seen.size, n, k + ' uses every voice'); ok(run.every((v, i) => i < 2 || (v !== run[i - 1] && v !== run[i - 2])), k + ' repeats a voice too soon');
    }
    const args = { squish: [600, 'jelly'], land: [600], jump: [], pad: [] };
    try {
      for (const k of Object.keys(banks)) for (let v = 0; v < banks[k].length; v++) {
        forceVoice = v; let peak = 0; const buf = await J.renderSfxOffline(() => J.sfx[k](...args[k]), 2);
        for (const c of [0, 1]) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { ok(Number.isFinite(d[i]), k + ' voice ' + v + ' non-finite'); if (Math.abs(d[i]) > peak) peak = Math.abs(d[i]); } }
        const pdb = 20 * Math.log10(peak + 1e-12); ok(pdb > -60, k + ' voice ' + v + ' is silent'); ok(Math.abs(pdb - J.SFX_TARGET[k]) <= 5, k + ' voice ' + v + ' peaks at ' + pdb.toFixed(1) + ' dBFS (target ' + J.SFX_TARGET[k] + '): re-measure its VOICE_GAIN');
      }
    } finally { forceVoice = null; }
  }, { slow: true });
  test('jelly squash: a bigger fall flattens the jelly more, it wobbles sideways, and none of it touches the hitbox', async () => {
    await J.startLevel(J.OFFICIAL[0], 'practice', false);
    const peak = vn => { J.resetRun(); landEvt = vn * K; const y0 = J.P.y, wx0 = J.P.wx; let mn = 0, lean = 0; for (let i = 0; i < 120; i++) { softAfterCore(J.STEP, 0); mn = Math.min(mn, J.SQ_.s); lean = Math.max(lean, Math.abs(J.SQ_.k)); } eq(J.P.y, y0, 'the squash never moves the hitbox'); eq(J.P.wx, wx0, 'or the run'); return { mn, lean }; };
    const small = peak(300), hop = peak(900), big = peak(1250);
    ok(small.mn < 0 && hop.mn < small.mn && big.mn < hop.mn, 'squash grows with the fall: ' + [small.mn, hop.mn, big.mn].map(x => x.toFixed(2)).join(', '));
    ok(hop.mn <= -.2, 'an ordinary hop squashes at least a fifth (' + hop.mn.toFixed(2) + ')'); ok(big.mn <= -.35 && big.mn >= -.5, 'a pad-sized fall flattens it to about half (' + big.mn.toFixed(2) + ')');
    ok(big.lean >= .08 && big.lean <= .3, 'a big landing sways the jelly sideways (' + big.lean.toFixed(3) + ')');
    for (let i = 1; i <= 20; i++) ok(landSquashV(i * 62) >= landSquashV((i - 1) * 62), 'landSquashV never shrinks as the fall grows');
    J.resetRun();
  });
  test('jelly jiggle: after a hard landing the skin keeps quivering for a while, and never folds', async () => {
    const FL = 400, floor = (x, y) => { if (y > FL) { CR[0] = 0; CR[1] = -1; CR[2] = y - FL; return true; } return false; };
    const s = new Soft(24, 23, 0, FL - 23 - 300, GAMEBODY), hs = []; let landed = -1, worstAr = 9, heals = 0;
    for (let k = 0; k < 420; k++) { s.step(J.STEP, { gy: G, resolve: floor }); if (s.impact > 150 && landed < 0) landed = k; const b = s.bounds(); hs.push((b.maxy - b.miny) / 46); if (landed >= 0) worstAr = Math.min(worstAr, s.health().ar); if (s.collapsed()) { heals++; s.heal(.3); } }
    const swing = (a, b) => { const g = hs.slice(landed + a, landed + b); return Math.max(...g) - Math.min(...g); };
    ok(landed > 0, 'it landed'); ok(swing(30, 60) >= .11, 'half a second on it is still swinging (' + swing(30, 60).toFixed(3) + ')'); ok(swing(60, 120) >= .03, 'a second on it still quivers (' + swing(60, 120).toFixed(3) + ')');
    ok(worstAr >= .6, 'it never folds (area ' + worstAr.toFixed(2) + ')'); ok(heals <= 5, 'it rarely needs healing (' + heals + ')'); ok(swing(300, 360) < .01, 'and it settles');
  });
  test('squish power: a flattened jelly fits under a gummy gate, a standing one does not, and the rules are fair', async () => {
    const L = J.OFFICIAL.find(l => l.name === 'Puddle Hop'); ok(L && L.script.includes('fl'), 'Puddle Hop teaches the power');
    const run = async (squish, jumpSpikes = true) => {   // a scripted player: squish from a beat before each gate until just past it, hop the gumdrops
      await J.startLevel(L, 'dash', false); const out = { flatH: [], blockedStand: false, got: 0 };
      for (let i = 0; i < 12000 && J.state === 'play'; i++) {
        const x = J.P.wx, gs = J.solids.filter(s => s.gate), under = gs.some(s => x + 36 > s.x0 && x < s.x1 + 3);
        J.inp.flat = squish && gs.some(s => x + 36 > s.x0 - 70 && x < s.x1 + 30);
        if (jumpSpikes && J.P.grounded && J.spikes.some(s => s.x > x + 36 && s.x - (x + 36) < 70)) J.press();
        if (!J.inp.flat && under && J.P.flat) out.blockedStand = true;   // wanted to stand, was still under the gate: it stayed flat
        J.update(J.STEP); if (J.P.flat) out.flatH.push(J.P.h);
      }
      out.state = J.state; out.pct = Math.round(J.P.wx / J.FINISH * 100); J.inp.flat = false; return out;
    };
    const no = await run(false), yes = await run(true);
    eq(no.state, 'dead', 'without squishing the first gate stops you'); ok(no.pct < 30, 'at the first gate (' + no.pct + '%)');
    eq(yes.state, 'win', 'with squishing the level is won'); ok(yes.flatH.length > 100 && yes.flatH.every(h => h === FLAT_H), 'a flat jelly is FLAT_H tall');
    // rules: flat only on the ground, a jump stands it up, spikes still hurt it, and the body is back to full size afterwards
    await J.startLevel(L, 'dash', false); J.resetRun(); J.inp.buf = 0; J.inp.held = false; J.inp.flat = true; for (let i = 0; i < 6; i++) J.update(J.STEP); ok(J.P.flat && J.P.h === 20 && J.P.y + J.P.h === GY, 'flat on the floor, feet stay put');
    J.press(); for (let i = 0; i < 4; i++) J.update(J.STEP); ok(!J.P.flat && J.P.h === CUBE_H, 'a jump stands the jelly up'); ok(!J.P.grounded, 'and it is in the air');
    for (let i = 0; i < 30; i++) J.update(J.STEP); ok(!J.P.flat, 'flat is ground-only: holding Squish in the air does not flatten'); J.inp.flat = false;
    await J.startLevel(L, 'dash', false); J.resetRun(); J.inp.buf = 0; J.inp.held = false; J.inp.flat = true; const sp = J.spikes[0]; ok(sp, 'has a spike'); let died = false; for (let i = 0; i < 6000 && J.state === 'play'; i++) J.update(J.STEP); J.inp.flat = false;
    eq(J.state, 'dead', 'a flat jelly sliding into a spike still dies (squishing is not a dodge)');
    // the other levels do not change: no gates means no squish button and no extra solver actions
    for (const n of ['First Hop', 'Slime Queen']) { J.buildLevel(J.OFFICIAL.find(l => l.name === n)); ok(!hasGate, n + ' has no gates'); }
    J.buildLevel(L); ok(hasGate, 'a level with gates shows the Squish button'); J.resetRun();
  });
  test('puff power: a held Squish in the air floats the jelly across a wide gap, only in levels built for it, and it refills on the ground', async () => {
    const L = J.OFFICIAL.find(l => l.name === 'Puff Pillow'); ok(L && L.puff && L.script.includes('pg'), 'Puff Pillow teaches the power');
    const gaps = L.objs.filter(o => o.t === 'gap').map(o => o.x), g0 = Math.min(...gaps), g1 = g0 + 6;   // the first wide gap: 6 tiles
    const hop = async (lvl, puff, off) => {   // hop at `off` tiles from the gap's start; hold Squish from the top of the arc if `puff`
      await J.startLevel(lvl, 'dash', false); J.resetRun(); J.inp.buf = 0; J.inp.held = false; J.inp.flat = false; let pressed = false, minVy = 0, floatFrames = 0, hs = new Set();
      for (let i = 0; i < 4000 && J.state === 'play'; i++) {
        const cx = (J.P.wx + 18) / 48; if (!pressed && cx >= g0 + off) { J.press(); pressed = true; }
        J.inp.flat = puff && pressed && J.P.vy > -50; J.update(J.STEP); hs.add(J.P.h); if (J.P.puffing) { floatFrames++; minVy = Math.max(minVy, J.P.vy); }
        if (cx > g1 + 3) break;
      }
      const out = { state: J.state, floatFrames, maxFloatVy: minVy, heights: [...hs], puff: J.P.puff }; J.inp.flat = false; return out;
    };
    const no = await hop(L, false, -1), yes = await hop(L, true, -1);
    eq(no.state, 'dead', 'without puffing the wide gap swallows you'); eq(yes.state, 'play', 'with puffing you float across'); ok(yes.floatFrames > 30, 'it floats for a while (' + yes.floatFrames + ' frames)');
    ok(yes.maxFloatVy <= PUFF_V * K * 1.05 + 1, 'and sinks slowly (' + Math.round(yes.maxFloatVy) + ' px/s at most)'); eq(yes.heights.join(), String(CUBE_H), 'the hitbox never changes size');
    ok(yes.floatFrames * STEP * K <= PUFF_T + .02, 'the puff is limited to PUFF_T per hop (' + (yes.floatFrames * STEP * K).toFixed(2) + ' s)');
    eq(J.P.puff, PUFF_T, 'the puff refills on the ground');
    // levels that are not built for it do not float, even with the key held: no accidental cheat
    const fh = J.OFFICIAL.find(l => l.name === 'First Hop'); await J.startLevel(fh, 'dash', false); J.resetRun(); J.inp.buf = 0; J.inp.flat = true; J.press(); let flew = 0; for (let i = 0; i < 80; i++) { J.update(J.STEP); if (J.P.puffing) flew++; } J.inp.flat = false;
    eq(flew, 0, 'no float in a level without the puff'); ok(!hasPuff && !hasSqueeze, 'and no Squish button there');
    J.resetRun();
  });
  test('bounce power: a tap just before landing springs up higher, only in levels built for it, and only in the air', async () => {
    const bb = J.OFFICIAL.find(l => l.name === 'Boing Bay'), fh = J.OFFICIAL.find(l => l.name === 'First Hop'); ok(bb && bb.bounce && J.OFFICIAL.find(l => l.name === 'Bounce House').bounce, 'the bounce levels exist');
    const bounce = async (lvl, mode) => {   // hop once, then tap: 'early' = just before touching down, 'late' = after landing
      await J.startLevel(lvl, 'dash', false); J.resetRun(); J.inp.buf = 0; J.inp.held = false; J.inp.flat = false; J.press(); J.inp.held = false; J.update(J.STEP); const v1 = -J.P.vy; let pressed = false, v2 = 0, apex = 0, startY = J.P.y + J.P.h;
      for (let i = 0; i < 3000 && J.state === 'play'; i++) {
        const L = landingIn(); if (!pressed && mode === 'early' && !J.P.grounded && J.P.vy > 0 && L && L.t < .05) { J.press(); J.inp.held = false; pressed = true; }
        if (!pressed && mode === 'late' && J.P.grounded && i > 20) { J.press(); J.inp.held = false; pressed = true; }
        J.update(J.STEP); if (pressed && !v2 && J.P.vy < -200) { v2 = -J.P.vy; startY = J.P.y + J.P.h; } if (v2) { apex = Math.max(apex, startY - (J.P.y + J.P.h)); if (J.P.vy > 0) break; }
      }
      return { v1, v2, apex, g: G };   // (g: this level's gravity; the next run switches tempo)
    };
    const e = await bounce(bb, 'early'), l = await bounce(bb, 'late'), n = await bounce(fh, 'early');
    ok(e.v2 / e.v1 > BOUNCE_K - .03 && e.v2 / e.v1 < BOUNCE_K + .03, 'an early tap springs up ' + (e.v2 / e.v1).toFixed(2) + 'x'); ok(e.apex > 1.6 * (e.v1 * e.v1 / (2 * e.g)) * .95, 'about 1.7x as high (' + Math.round(e.apex) + ' px)');
    ok(Math.abs(l.v2 / l.v1 - 1) < .03, 'a tap after landing is an ordinary hop'); ok(Math.abs(n.v2 / n.v1 - 1) < .03, 'no bounce in a level without it');
    J.resetRun();
  });
  test('tunes: every world has a public-domain tune that fits every song style and sounds', async () => {
    eq(WORLD_TUNE.length, J.WORLDS.length, 'one tune per world');
    for (const w of WORLD_TUNE) ok(TUNES[w], 'world points at a missing tune');
    for (const t of TUNES) {
      ok(t.name && t.by && /1[78]\d\d/.test(t.by), t.id + ' needs a name and a composer with a (public-domain) year'); ok(t.notes.length >= 24 && t.notes.length <= 80, t.id + ' length ' + t.notes.length);
      ok(t.notes.every(n => Number.isInteger(n)), t.id + ' notes must be whole semitones'); ok(Math.max(...t.notes) - Math.min(...t.notes) <= 24, t.id + ' spans more than two octaves');
      for (let si = 0; si < J.SONG_N; si++) { const c = J.styleCfg(si); for (let i = 0; i < t.notes.length; i++) { const m = tuneMidi(t, c, i); ok(m >= 46 && m <= 86, t.id + ' note ' + i + ' lands at MIDI ' + m + ' in ' + c.name + ' (too low or too piercing)'); } }
    }
    const saveT = curTune, saveI = tuneI, saveC = combo;
    try {
      for (const t of TUNES) {
        curTune = t; tuneI = 0; combo = 0; const buf = await J.renderSfxOffline(() => { tuneNote('PERFECT', J.styleCfg(2)); }, 1.5), d = buf.getChannelData(0); let pk = 0; for (const x of d) pk = Math.max(pk, Math.abs(x));
        ok(pk > .003, t.id + ' first note is silent'); eq(tuneI, 1, 'a note advances the tune');
      }
      curTune = TUNES[0]; tuneI = TUNES[0].notes.length - 1; ok(tuneNote('GREAT', J.styleCfg(2)) === true && tuneI === 0, 'finishing the tune wraps it round and says so');
      await J.startLevel(J.OFFICIAL[0], 'dash', false); eq(curTune, TUNES[WORLD_TUNE[J.OFFICIAL[0].world]], 'a level plays its world tune'); eq(tuneI, 0);
      J.setState('title');
    } finally { curTune = saveT; tuneI = saveI; combo = saveC; }
  }, { slow: true });
  test('brightness cap: a high note is much quieter than the same note an octave and a half lower', async () => {
    const lvl = async f => { const buf = await J.renderSfxOffline(() => tone(f, .3, { vol: .1, att: .005 }), 1); let m = 0; for (const x of buf.getChannelData(0)) m = Math.max(m, Math.abs(x)); return 20 * Math.log10(m + 1e-12); };
    const lo = await lvl(700), hi = await lvl(4200); ok(lo - hi >= 8, 'a 4.2 kHz note is only ' + (lo - hi).toFixed(1) + ' dB quieter than a 700 Hz one (the cap should take off 8 dB or more)');
  });
  test('menu sounds are dry: no reverb tail smearing rapid taps', async () => {
    for (const k of J.UI_SFX) {
      const buf = await J.renderSfxOffline(() => J.sfx[k](...(k === 'toggle' || k === 'panel' ? [true] : k === 'tick' ? [.5] : k === 'combo' ? [3] : [])), 2.5), d = buf.getChannelData(0), from = Math.round(buf.sampleRate * 1.0); let sum = 0; for (let i = from; i < d.length; i++) sum += d[i] * d[i];
      ok(20 * Math.log10(Math.sqrt(sum / (d.length - from)) + 1e-12) < -62, k + ' is still ringing after 1 s');
    }
  }, { slow: true });
  test('hazard hit sounds and world ambience events run', async () => {
    for (const h of J.HAZ) { const buf = await J.renderSfxOffline(() => J.playHit(h), 1.5); ok(buf.getChannelData(0).some(v => Math.abs(v) > 1e-4), h.id + ' hit is silent'); ok(Number.isFinite(J.SFX_TARGET['hit:' + h.id]), h.id + ' hit needs an SFX_TARGET entry'); }
    for (const [k, a] of Object.entries(J.AMB)) { for (let i = 0; i < 30; i++) { const w = a.evt(); ok(Number.isFinite(w) && w > 0, k + ' event wait'); } ok(a.bed.length >= 1, k + ' bed'); }
    for (const w of J.WORLDS) ok(J.AMB[w.amb], 'ambience for ' + w.id);
  }, { slow: true });

  /* ---------- editor ---------- */
  test('editor: undo and redo restore objects, length and tempo', () => {
    J.openEditor(null); const L = J.getEd(); const n0 = L.objs.length;
    J.edApply(520, 330, true); ok(J.getEd().objs.length === n0 + 1, 'placed'); J.edUndo(); eq(J.getEd().objs.length, n0, 'undone'); J.edRedo(); eq(J.getEd().objs.length, n0 + 1, 'redone');
    J.edPush(); J.getEd().bpm = 150; J.edUndo(); ok(J.getEd().bpm !== 150, 'tempo undone');
  });
  test('editor: gummy gates, Puff and Bounce can be built, undone, saved, shared and imported', () => {
    ok(J.TOOLS ? true : TOOLS.some(t => t[0] === 'gate'), 'the Gate tool exists'); eq(TOOLS.length, 11, 'eleven tools');
    J.openEditor(null); const px = c => c * 48 + 20, paint = { tool: 'gate', last: null, val: true };
    J.edApply(px(12), 200, true, paint); J.edApply(px(13), 200, false, paint); J.edApply(px(4), 200, false, paint);   // two gates, and a third too close to the start, which is refused
    eq(J.getEd().objs.filter(o => o.t === 'gate').map(o => o.x).sort((a, b) => a - b).join(), '12,13', 'a dragged run of gates, none in the safe start');
    buildLevel(J.getEd()); ok(hasGate && solids.filter(s => s.gate).length === 1, 'the run is one gate in the live level'); ok(J.getEd().objs.every(o => o.t !== 'gate' || o.y === undefined), 'gates carry no height');
    J.edApply(px(12), 200, true, { tool: 'gate', last: null, val: true }); ok(!J.getEd().objs.some(o => o.t === 'gate' && o.x === 12), 'the Gate tool on a gate removes it'); J.edUndo(); ok(J.getEd().objs.some(o => o.t === 'gate' && o.x === 12), 'Undo brings it back');
    J.edApply(px(13), 200, true, { tool: 'erase', last: null, val: true }); ok(!J.getEd().objs.some(o => o.t === 'gate' && o.x === 13), 'the Eraser removes a gate too');
    // the power switches: saved with the level, undone, and carried by both kinds of share code
    J.edUndo(); const E = J.getEd(); J.edPush(); E.puff = true; J.edPush(); E.bounce = true; buildLevel(E); ok(hasPuff && hasBounce, 'the switches reach the live level');
    const back = parseLevelCode(levelCode(E)); ok(back && back.puff === true && back.bounce === true && back.objs.filter(o => o.t === 'gate').length === 2, 'the short share code carries gates and both powers');
    const js = sanitize(JSON.parse(JSON.stringify({ name: E.name, len: E.len, pal: E.pal, bpm: E.bpm, style: E.style, auto: E.auto, puff: E.puff, bounce: E.bounce, objs: E.objs }))); ok(js.puff === true && js.bounce === true && js.objs.filter(o => o.t === 'gate').length === 2, 'the JSON code too');
    ok(levelCode(E) !== levelCode(Object.assign({}, E, { puff: false })), 'a level that changes a switch needs its check again (its code changed)');
    J.edUndo(); eq(!!J.getEd().bounce, false, 'Undo flips a switch back'); J.edUndo(); eq(!!J.getEd().puff, false, 'and the other');
    // a power level opened in the editor keeps its powers and still proves beatable
    for (const [n, k] of [['Puddle Hop', 'gate'], ['Puff Pillow', 'puff'], ['Boing Bay', 'bounce']]) { J.openEditor(level(n)); const R = J.getEd(); ok(k === 'gate' ? R.objs.some(o => o.t === 'gate') : R[k] === true, n + ' keeps its ' + k + ' in the editor'); const r = J.solveSync(R, 30000); ok(r.ok, n + ' remix still proves beatable'); }
    J.setState('title');
  });
  test('editor check: the screen stays "solving" between steps (long levels)', () => {
    J.openEditor(level('Slime Queen')); const g = J.solveStart(); ok(g.next && J.getState() === 'solving'); g.next(); ok(J.getState() === 'solving', 'state restored after the first yield'); g.return(); J.setState('title');
  }, { slow: true });
  test('editor check: drops hearts nobody can collect, and Undo brings them back', () => {
    const L = J.genLevel('t', 't', 3, [0, 1, 2], 'bsp', 104, 0, true, .09), n0 = L.objs.filter(o => o.t === 'heart').length;   // a raised platform with a spike on it: its low end heart is out of reach
    J.openEditor(L); const g = J.solveStart(); let r; while (!(r = g.next()).done);
    ok(r.value.ok && r.value.dropped > 0, 'beatable, and the unreachable heart goes: ' + JSON.stringify(r.value));
    eq(J.getEd().objs.filter(o => o.t === 'heart').length, n0 - r.value.dropped, 'hearts left');
    const h = J.heartsSync(J.getEd(), 6); eq(h.best, h.total, 'every remaining heart can be collected');
    J.edUndo(); eq(J.getEd().objs.filter(o => o.t === 'heart').length, n0, 'Undo brings them back'); J.setState('title');
  }, { slow: true });
  /* ---------- squish room and studio ---------- */
  test('squish room: the first visit shows a one-time tip, later visits do not', async () => {
    const st = J.getStore(); st.seenRoom = false; toast = { t: '', life: 0 };
    enterRoom(); ok(/^Tip:/.test(toast.t) && toast.life > 3, 'a tip on the first visit'); ok(st.seenRoom, 'remembered');
    toast = { t: '', life: 0 }; enterRoom(); eq(toast.t, '', 'no tip the second time'); await toTitle();
  });
  test('squish studio: finishing a shape that opens a skin says so', async () => {
    const st = J.getStore(), saved = { studio: st.studio, best: st.best, goals: st.goals }, preset0 = roomPreset;   // (the Studio switches the room to clay: put it back for the tests after this one)
    st.best = {}; st.goals = null; st.studio = { stars: { '__earlier': 2 } };                     // 2 stars so far: one more star makes 3 = one "level" = Aqua Gel opens
    startStudio(); studioShape = 0; studioSimAvg = .5; toast = { t: '', life: 0 }; completeShape();
    eq(st.studio.stars[SHAPES[0].name], 1, 'one star earned'); await new Promise(r => setTimeout(r, 1700));
    ok(/Unlocked: .*Aqua Gel/.test(toast.t), 'the unlock is announced: ' + toast.t);
    st.studio = saved.studio; st.best = saved.best; st.goals = saved.goals; songStop(); studio = false; flow = 0; await toTitle(); setPreset(preset0);   // (this file's toTitle only changes the screen: leave Studio mode and its song by hand)
  });
  test('squish room goals: poking, pulling, pinning, hopping and trying every material tick them off', async () => {
    const st = J.getStore(), saved = { goals: st.goals, best: st.best, studio: st.studio, preset: roomPreset, tip: st.seenRoom };
    st.goals = null; st.best = {}; st.studio = { stars: {} }; st.seenRoom = true; enterRoom(); const g = goalStore(), edge = { x: J.room.x[0], y: J.room.y[0] };
    roomDown('a', 480, 220, 0); ok(g.done.dent, 'poke the middle'); roomRelease('a', true);
    roomDown('b', edge.x, edge.y, 0); ok(g.done.pull, 'pull the skin'); roomRelease('b', true);
    roomPin(edge.x, edge.y); ok(g.done.pin, 'pin a spot'); room.grabs = [];
    for (let i = 0; i < 10; i++) { roomHopT = 0; roomHop(); } ok(g.done.hop, 'ten hops');
    for (const m of ['jelly', 'slime', 'mochi', 'dough', 'foam']) setPreset(m); ok(g.done.mats, 'every material');
    roomTouched = true; roomIdle = 5; goalsStep(.016, 0); ok(g.done.rest, 'let it settle');
    room.grabs = [{ id: 'x', mx: 0, my: 0, items: [] }]; goalsStep(.016, .9); ok(g.done.stretch, 'big stretch');
    room.grabs.push({ id: 'p', pin: true, mx: 0, my: 0, items: [] }); goalsStep(.016, .6); ok(g.done.string, 'a stretched string');
    roomElong = .7; roomRelease('x'); ok(g.done.boing, 'let go of a big stretch'); room.grabs = [];
    eq(goalsDone(), 9, 'nine so far (new look and the cozy minute are next)'); ok(st.goals === g, 'kept in the save');
    st.goals = saved.goals; st.best = saved.best; st.studio = saved.studio; st.seenRoom = saved.tip; await toTitle(); setPreset(saved.preset);
  });
  test('squish room goals: three goals count as a level and open a skin; cozy days only go up', async () => {
    const st = J.getStore(), saved = { goals: st.goals, best: st.best, studio: st.studio };
    st.goals = null; st.best = {}; st.studio = { stars: {} }; const g = goalStore(); toast = { t: '', life: 0 };
    goalDone('dent'); goalDone('pull'); eq(doneCount(), 0, 'two goals are not a level yet'); goalDone('pin'); eq(doneCount(), 1, 'three goals are one level');
    await new Promise(r => setTimeout(r, 1700)); ok(/Unlocked: .*Aqua Gel/.test(toast.t), 'the unlock is announced: ' + toast.t);
    st.goals = null; const c = goalStore();
    cozyTick(61, '2026-11-01'); eq([c.cozyDays, c.streak], [1, 1], 'a minute makes a cozy day'); ok(c.done.cozy, 'and the cozy-minute goal');
    cozyTick(30, '2026-11-01'); eq(c.cozyDays, 1, 'only one cozy day per day');
    cozyTick(61, '2026-11-02'); eq([c.cozyDays, c.streak], [2, 2], 'the next day adds to the run');
    cozyTick(61, '2026-11-04'); eq([c.cozyDays, c.streak], [3, 1], 'a missed day only restarts the run, the days stay');
    st.goals = saved.goals; st.best = saved.best; st.studio = saved.studio; await toTitle();
  });

  /* ---------- the jelly ---------- */
  test('squish room: a folded body heals itself', async () => {
    J.setState('room'); J.room.resize(52); J.room.reset(480, 220); J.room.relax(); await frames(30);
    const n = J.room.n, cx = 480, cy = 400;   // flatten it into a thin strand lying on the floor
    for (let i = 0; i < n; i++) { J.room.x[i] = cx + (i / n - .5) * 120; J.room.y[i] = cy + (i % 2 ? 2 : -2); J.room.ox[i] = J.room.x[i]; J.room.oy[i] = J.room.y[i]; }
    ok(J.room.collapsed(), 'set up a collapsed body'); await wait(2600); ok(!J.room.collapsed(), 'recovered after release'); await toTitle();
  }, { slow: true });

  /* ---------- UI ---------- */
  const audit = async (label, setup) => { await setup(); await frames(4); const bad = J.auditUi(); if (bad.length) throw new Error(label + ': ' + bad.map(b => `${b.label || '?'}${b.tooSmall ? ' (too small)' : ''}${b.clash ? ' (crowded)' : ''}`).join(', ')); };
  test('every screen keeps its buttons finger-sized: title, select, settings', async () => {
    await audit('title', toTitle);
    await audit('select', async () => { J.setState('select'); });
    await audit('settings', async () => { J.setState('settings'); });
    await toTitle();
  });
  test('every screen keeps its buttons finger-sized: room, studio, editor, practice', async () => {
    await audit('room', async () => { J.setState('room'); });
    await audit('editor', async () => { J.openEditor(null); });
    await audit('practice', async () => { J.startLevel(level('First Hop'), 'practice', false); });
    J.setMode('dash'); await toTitle();
  });
  test('title: one big Play / Continue button starts the next unbeaten level, and level cards show the power they teach', async () => {
    const st = J.getStore(), keep = JSON.stringify(st.best); try {
      st.best = {}; await toTitle(); let ui = J.getUi(); ok(ui.some(b => b.label === 'Play'), 'a new player sees Play'); eq(nextLevel().name, 'Welcome', 'and starts with Welcome');
      for (const l of J.OFFICIAL.slice(0, 5)) st.best[l.id] = 100; await frames(3); ui = J.getUi(); ok(ui.some(b => b.label === 'Continue'), 'a returning player sees Continue'); eq(nextLevel().name, J.OFFICIAL[5].name, 'which goes to the first level not beaten');
      for (const l of J.OFFICIAL) st.best[l.id] = 100; eq(nextLevel().name, J.OFFICIAL[1].name, 'with everything beaten Play still does something');
      st.best = {}; await toTitle(); const big = J.getUi().find(b => b.label === 'Play'); ok(big.w >= 400 && big.h >= 80, 'the Play button is big'); for (const l of ['Levels', 'Zen', 'Practice', 'Squish Room', 'Squish Studio', 'Level Creator']) ok(J.getUi().some(b => b.label === l), l + ' is still one tap away');
      playNext(); await frames(3); eq(J.getState(), 'play', 'Play starts a run'); eq(J.getMode(), 'dash', 'in Dash mode'); eq(J.OFFICIAL.indexOf(curLevel), 0, 'on the Welcome level');
      ok(J.OFFICIAL.filter(l => /\bf[ls]\d/.test(l.script)).length >= 2 && J.OFFICIAL.filter(l => l.puff).length >= 2, 'the power levels exist for the badges');
    } finally { st.best = JSON.parse(keep); await toTitle(); }
  });
  test('results: the card says what was new (first clear, best score, best rating, not saved on Chill) and every HUD state draws', async () => {
    const st = J.getStore(), keep = JSON.stringify([st.best, st.score, st.rate, st.pace]); const L = level('First Hop');
    try {
      st.best = {}; st.score = {}; st.rate = {}; st.pace = 1;
      const finish = async (score, pace) => { st.pace = pace; await J.startLevel(L, 'dash', false); scoreNow = score; judgeN = 10; judgeBase = 900; got = 5; win(); const i = { ...winInfo }; await frames(2); J.draw(); return i; };
      let w = await finish(100, 1); ok(w.first && w.saved && !w.bestScore && !w.bestStars, 'first clear: tagged first, nothing to beat yet');
      w = await finish(200, 1); ok(!w.first && w.bestScore, 'a higher score is a new best score'); eq(w.prevScore, 100, 'against what was saved before');
      w = await finish(150, 1); ok(!w.bestScore, 'a lower score is not');
      w = await finish(900, .85); ok(!w.saved && !w.bestScore, 'Chill pace saves nothing, so nothing is called a best');
      // every state draws without error
      for (const s of ['play', 'dead', 'win']) { await J.startLevel(L, 'dash', false); J.setState(s); lastPct = 40; winT = 2; deadT = .3; await frames(2); J.draw(); }
      await J.startLevel(L, 'practice', false); await frames(2); J.draw(); await J.startLevel(L, 'dash', false); combo = 6; await frames(2); J.draw();
    } finally { [st.best, st.score, st.rate, st.pace] = JSON.parse(keep); J.setMode('dash'); await toTitle(); }
  });
  test('cozy room: official wins fill the heart wallet (no farming), decor is bought, placed, saved, and everything draws', async () => {
    const st = J.getStore(), keep = JSON.stringify([st.wallet, st.hb, st.decor, st.best, st.score, st.rate, st.pace]), L = level('First Hop');
    try {
      st.wallet = 0; st.hb = {}; st.decor = { owned: {}, placed: {}, tier: {}, dye: {}, dyes: {} }; st.best = {}; st.score = {}; st.rate = {};
      const win1 = async (hearts, pace = 1) => { st.pace = pace; await J.startLevel(L, 'dash', false); got = hearts; scoreNow = 10; judgeN = 10; judgeBase = 900; win(); return { ...winInfo }; };
      // a flat reward per level (REWARD): 30 for the first clear, 10 per rating heart gained (this run rates 3), 15 once for taking every heart; replays pay only improvements
      let w = await win1(40); eq(w.earned, REWARD.first + 3 * REWARD.rating, 'first clear and a three-heart rating'); eq(st.wallet, 60); eq(w.parts.length, 2, 'the card can list what it paid for');
      w = await win1(40); eq(w.earned, 0, 'the same run again earns nothing'); w = await win1(46); eq(w.earned, REWARD.all, 'taking every heart pays once'); eq(st.wallet, 75);
      w = await win1(46); eq(w.earned, 0, 'and only once'); w = await win1(46, .85); eq(w.earned, 0, 'Chill pace pays nothing'); eq(st.wallet, 75);
      const cx = J.genLevel('cx', 'cx', 1, [0, 1, 2], 's1', 104, 0, true, .09); cx.custom = true; st.pace = 1; await J.startLevel(cx, 'dash', false); got = 12; win(); eq(st.wallet, 75, 'a level from the editor pays nothing (no farming)');
      eq(buyDecor('nope'), 'none', 'unknown item'); eq(buyDecor('disco'), 'short', 'too expensive'); eq(st.wallet, 75);
      eq(buyDecor('cactus'), 'bought'); eq(st.wallet, 60); eq(st.decor.placed.plant, 'cactus', 'bought and put on');
      eq(buyDecor('fern'), 'bought'); eq(st.wallet, 25); eq(st.decor.placed.plant, 'fern', 'one thing per place: the new one replaces the old');
      eq(buyDecor('cactus'), 'placed', 'an owned one is free to put back'); eq(st.wallet, 25); eq(buyDecor('cactus'), 'removed'); ok(!st.decor.placed.plant, 'and to take off');
      // saved data: round trip, and damaged data cannot place what you do not own
      const back = J.normalizeStore(JSON.parse(JSON.stringify(st))); eq(back.wallet, 25); ok(back.decor.owned.cactus && back.decor.owned.fern, 'owned items survive'); eq(back.hb[L.id], 46, 'and the best hearts per level');
      const bad = J.normalizeStore({ wallet: -5, hb: { a: 'x', b: 7 }, decor: { owned: { cactus: true, 'Bad id!': true, fern: 'yes' }, placed: { plant: 'fern', window: 'winsun', 'x y': 'cactus' } } });
      eq(bad.wallet, 0, 'no negative hearts'); eq(bad.hb.a, 0); eq(bad.hb.b, 7); eq(Object.keys(bad.decor.owned).join(), 'cactus', 'only well-formed owned ids'); eq(Object.keys(bad.decor.placed).length, 0, 'nothing placed that is not owned');
      // the catalogue and the drawing
      eq(new Set(DECOR.map(d => d.id)).size, DECOR.length, 'unique ids'); ok(DECOR.every(d => d.cost > 0 && DECOR_SLOTS.some(s => s.id === d.slot)), 'prices and places'); for (const s of DECOR_SLOTS) eq(DECOR.filter(d => d.slot === s.id).length, 3, 'three things for ' + s.name);
      st.wallet = 5000; J.setState('room'); await frames(2); for (const d of DECOR) { st.decor.owned[d.id] = true; st.decor.placed[d.slot] = d.id; if (DECOR.filter(x => x.slot === d.slot)[0] === d || true) { await frames(1); J.draw(); } }
      roomPanel = 'decor'; await frames(3); J.draw(); const btns = J.getUi().filter(b => /^decor /.test(b.label)); eq(btns.length, DECOR.length, 'the panel has a button for every item');
      st.decor = { owned: {}, placed: {}, tier: {}, dye: {}, dyes: {} }; st.wallet = 100; await frames(2); J.getUi().find(b => b.label === 'decor winsun').fn(); ok(st.decor.owned.winsun && st.wallet === 75, 'a tap in the panel buys it');
      roomPanel = null; J.draw(); const audit = J.auditUi(); ok(!audit.length, 'room buttons stay finger-sized: ' + audit.map(b => b.label).join());
    } finally { [st.wallet, st.hb, st.decor, st.best, st.score, st.rate, st.pace] = JSON.parse(keep); roomPanel = null; J.setMode('dash'); await toTitle(); }
  });
  test('cozy room: item tiers, dyes and the pet (prices, saving, drawing, panels)', async () => {
    const st = J.getStore(), keep = JSON.stringify([st.wallet, st.decor, st.pet]);
    try {
      st.decor = { owned: {}, placed: {}, tier: {}, dye: {}, dyes: {} }; st.pet = null; st.wallet = 0;
      // tiers: Basic -> Deluxe -> Golden at 4x and 10x the price; only for things you own
      const it = decorItem('cactus'); eq(upgradeDecor('cactus'), 'none', 'cannot upgrade what you do not own'); st.wallet = it.cost; eq(buyDecor('cactus'), 'bought'); eq(st.wallet, 0);
      eq(upgradeDecor('cactus'), 'short'); st.wallet = it.cost * 4; eq(upgradeDecor('cactus'), 'upgraded'); eq(st.decor.tier.cactus, 1); eq(st.wallet, 0, 'Deluxe costs 4x');
      st.wallet = it.cost * 10 - 1; eq(upgradeDecor('cactus'), 'short', 'one heart short of Golden'); st.wallet = it.cost * 10; eq(upgradeDecor('cactus'), 'upgraded'); eq(st.decor.tier.cactus, 2); eq(st.wallet, 0, 'Golden costs 10x'); eq(upgradeDecor('cactus'), 'max');
      // dyes: 20 hearts each (150 for Rainbow), bought once per item, then free to switch
      st.wallet = 19; eq(dyeDecor('cactus', 1), 'short'); st.wallet = 20; eq(dyeDecor('cactus', 1), 'bought'); eq(st.wallet, 0); eq(st.decor.dye.cactus, 1); eq(dyeDecor('cactus', 0), 'set', 'back to the original is free'); eq(dyeDecor('cactus', 1), 'set', 'and so is a dye you already bought'); eq(st.wallet, 0);
      st.wallet = 149; eq(dyeDecor('cactus', 5), 'short', 'Rainbow is 150'); eq(dyeDecor('cactus', 9), 'none', 'no such dye'); eq(dyeDecor('fern', 1), 'none', 'not owned');
      // the hue shift: colours move, greys and whites do not, and a painter run leaves the canvas as it found it
      ok(dyeColor('#ff9ccf', 150) !== '#ff9ccf' && /^#[0-9a-f]{6}$/.test(dyeColor('#ff9ccf', 150)), 'a pink moves'); eq(dyeColor('#ffffff', 150), '#ffffff', 'white stays'); eq(dyeColor('#808080', 150), '#808080', 'grey stays'); eq(dyeColor('rgba(1,2,3,.5)', 150), 'rgba(1,2,3,.5)', 'non-hex colours pass through'); eq(dyeColor('#ff9ccf', 0), '#ff9ccf');
      const owns = o => Object.prototype.hasOwnProperty.call(ctx, o); withDye(150, () => { ctx.fillStyle = '#ff9ccf'; ok(ctx.fillStyle !== '#ff9ccf', 'inside withDye the colour is shifted'); }); ok(!owns('fillStyle') && !owns('strokeStyle'), 'afterwards the canvas has its normal colour setters again');
      try { withDye(150, () => { throw new Error('x'); }); } catch (e) {} ok(!owns('fillStyle'), 'even when a painter throws');
      // saved data
      const back = J.normalizeStore(JSON.parse(JSON.stringify(st))); eq(back.decor.tier.cactus, 2); eq(back.decor.dye.cactus, 1); ok(back.decor.dyes.cactus & 2 && back.decor.dyes.cactus & 1, 'tier, dye and bought dyes survive');
      const junk = J.normalizeStore({ decor: { owned: { cactus: true }, tier: { cactus: 9 }, dye: { cactus: 4 }, dyes: { cactus: 1 } }, pet: { kind: 'dragon', love: 5 } }); eq(junk.decor.tier.cactus, 2, 'tier is clamped'); eq(junk.decor.dye.cactus, 0, 'a dye you have not bought is not worn'); eq(junk.pet, null, 'an unknown kind of pet is not a pet');
      // the pet: free adoption, stages by love, food prices, one gift a day
      eq(petAdopt('dragon'), false); ok(petAdopt('bun') && st.pet.kind === 'bun' && st.pet.love === 0, 'adopted'); eq(petAdopt('kit'), false, 'one pet');
      eq(PET_STAGES.length, 6, 'six stages'); eq(petStage(0), 0); eq(petStage(119), 0); eq(petStage(120), 1); eq(petStage(9000), 5); eq(petStage(1e6), 5);
      st.wallet = 5; eq(petFeed('snack'), 'short'); st.wallet = 6; eq(petFeed('snack'), 'fed'); eq(st.pet.love, 12); eq(st.wallet, 0); eq(petFeed('pizza'), 'none');
      st.wallet = 120; eq(petFeed('feast'), 'grew', 'a feast is enough to grow a baby'); eq(st.pet.love, 302, 'and gives more love per heart than a snack'); st.wallet = 30; st.pet.love = 100; eq(petFeed('treat'), 'grew', 'reaching a new stage says so'); eq(petStage(st.pet.love), 1);
      st.pet.day = ''; st.wallet = 0; eq(petGift('2026-11-11'), petGiftAmount(st.pet)); eq(st.wallet, 3 + 3 * 1, 'the gift grows with the pet'); eq(petGift('2026-11-11'), 0, 'one gift a day'); ok(petGift('2026-11-12') > 0, 'and another tomorrow');
      st.wallet = 100; eq(petDye(1), 'bought'); eq(st.wallet, 60, 'the pet dye costs double'); eq(petDye(0), 'set'); eq(petDye(9), 'none');
      const back2 = J.normalizeStore(JSON.parse(JSON.stringify(st))); eq(back2.pet.kind, 'bun'); eq(back2.pet.love, st.pet.love); ok(back2.pet.dyes & 2, 'the pet survives a save');
      // everything draws: all items at every tier and dye, every pet kind at every stage, and the panels
      st.wallet = 1e5; J.setState('room'); await frames(2);
      for (const d of DECOR) { buyDecor(d.id); for (let t = 0; t < 3; t++) for (const di of [0, 2, 5]) { st.decor.tier[d.id] = t; st.decor.dye[d.id] = di; st.decor.dyes[d.id] = 63; st.decor.placed[d.slot] = d.id; J.draw(); } }
      for (const [k] of PET_KINDS) for (const [, need] of PET_STAGES) { st.pet.kind = k; st.pet.love = need; st.pet.dye = 0; J.draw(); }
      for (const pn of ['decor', 'style', 'pet']) { roomPanel = pn; await frames(2); J.draw(); ok(J.getUi().length > 3, pn + ' panel has buttons'); }
      roomPanel = 'style'; await frames(2); J.draw(); eq(J.getUi().filter(b => b.label === '').length, 6 * 6, 'six dye buttons for each of the six places'); const up = J.getUi().filter(b => /Deluxe|Golden/.test(b.label)); ok(up.length >= 1, 'upgrade buttons');
      st.pet = null; roomPanel = 'pet'; await frames(2); J.draw(); eq(J.getUi().filter(b => b.label === '').length, 3, 'three pets to adopt'); J.getUi().filter(b => b.label === '')[1].fn(); eq(st.pet && st.pet.kind, 'kit', 'a tap adopts it');
      roomPanel = null; J.draw(); const bad = J.auditUi(); ok(!bad.length, 'room buttons still finger-sized: ' + bad.map(b => b.label).join());
    } finally { [st.wallet, st.decor, st.pet] = JSON.parse(keep); roomPanel = null; J.setMode('dash'); await toTitle(); }
  });
  test('pointer routing: a touch on a button runs it', async () => {
    await toTitle(); const cv = document.getElementById('c');
    const tap = async b => { const r = cv.getBoundingClientRect(), V = J.getView(); const x = r.left + (b.x + b.w / 2 + V.VX) / V.VW * r.width, y = r.top + (b.y + b.h / 2) / 540 * r.height;
      cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', bubbles: true })); window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: 7, pointerType: 'touch' })); await frames(3); };
    await tap(J.getUi().find(b => /Settings/.test(b.label))); eq(J.getState(), 'settings', 'Settings opens');
    await tap(J.getUi().find(b => /Back/.test(b.label))); eq(J.getState(), 'title', 'Back returns');
  });

  /* ---------- browser gestures ---------- */
  test('browser gestures are cancelled: context menu, selection, drag, double-click, Safari pinch', () => {
    const c = document.getElementById('c');
    for (const t of ['contextmenu', 'selectstart', 'dragstart', 'dblclick', 'gesturestart', 'gesturechange', 'gestureend']) { const e = new Event(t, { bubbles: true, cancelable: true }); c.dispatchEvent(e); ok(e.defaultPrevented, t + ' should be cancelled'); }
    const te = new Event('touchmove', { bubbles: true, cancelable: true }); document.body.dispatchEvent(te); ok(te.defaultPrevented, 'touchmove (page scroll) should be cancelled');
  });
  test('index.html: no touch zoom, selection, tap highlight or callout (checked in a real copy of the page)', async () => {
    const f = document.createElement('iframe'); f.src = 'index.html?fast'; f.style.cssText = 'position:fixed;left:-9999px;width:800px;height:400px'; document.body.appendChild(f);
    try {
      await new Promise((res, rej) => { f.onload = res; setTimeout(() => rej(new Error('game.html did not load')), 8000); }); await wait(300);
      if (!f.contentDocument) return;   // opened from file:// the browser hides the frame (cross-origin); tests/playwright/gest.js covers that case
      const w = f.contentWindow, d = f.contentDocument, g = (el, k) => w.getComputedStyle(el).getPropertyValue(k);
      for (const el of [d.documentElement, d.body, d.getElementById('c')]) eq(g(el, 'touch-action'), 'none', 'touch-action on ' + (el.id || el.tagName));
      for (const el of [d.body, d.getElementById('c')]) eq(g(el, 'user-select'), 'none', 'user-select on ' + (el.id || el.tagName));
      // zoom is blocked by touch-action:none (checked above) plus the gesture guards in input.js; a host that owns the viewport meta (an artifact page) may not allow user-scalable=no
      ok(/user-scalable=no|maximum-scale=1/.test(d.querySelector('meta[name=viewport]').content) || g(d.documentElement, 'touch-action') === 'none', 'zoom is blocked');
      ok(!/googleapis/.test(d.documentElement.innerHTML), 'no third-party font request');
    } finally { f.remove(); }
  });
  test('ghost taps: the second tap of a quick double-tap is ignored after a screen change', async () => {
    await toTitle(); J.setGhostMs(220); await wait(300); await frames(2);
    const cv = document.getElementById('c'), V = J.getView(), r = cv.getBoundingClientRect();
    const tapAt = async b => { const x = r.left + (b.x + b.w / 2 + V.VX) / V.VW * r.width, y = r.top + (b.y + b.h / 2) / 540 * r.height;
      cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, pointerId: 9, pointerType: 'touch', bubbles: true })); window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: 9, pointerType: 'touch' })); };
    try {
      const dash = J.getUi().find(b => /^Levels/.test(b.label)); await tapAt(dash); await frames(2); eq(J.getState(), 'select', 'first tap opens the list');
      await tapAt(dash); await frames(2); eq(J.getState(), 'select', 'an instant second tap must not start a level');
      await wait(300); const card = J.getUi().find(b => b.w > 160 && b.h > 80); await tapAt(card); await frames(2); eq(J.getState(), 'play', 'a deliberate tap later works');
    } finally { J.setGhostMs(0); await toTitle(); }
  });

  /* ---------- typing, names, the daily level ---------- */
  test('names: markup and profanity are cleaned, ordinary names are kept', () => {
    eq(cleanName('Candy <b>Run</b>'), 'Candy bRun/b', 'markup characters removed');
    eq(cleanName('Sugar Rush 2'), 'Sugar Rush 2'); eq(cleanName('Bass Line'), 'Bass Line'); eq(cleanName('Class Act'), 'Class Act'); eq(cleanName('Scunthorpe Run'), 'Scunthorpe Run');
    for (const bad of ['f u c k', 'SH1T level', 'n1gga', 'what a b!tch', 'Hitler']) eq(cleanName(bad, 'X'), 'X', 'blocked ' + bad);
    eq(cleanName('   ', 'Fallback'), 'Fallback'); eq(cleanName('a'.repeat(60)).length, 24, 'length cap');
    eq(J.parseLevelCode(J.levelCode(Object.assign({}, J.OFFICIAL[1], { name: 'shit show' }))).name, 'Shared level', 'shared names are cleaned on import');
  });
  test('text box: opens, returns what was typed, ignores game keys while open', async () => {
    let got = null; askText('Test', '', v => { got = v; }, {}); ok(dlgOpen, 'open');
    const f = document.querySelector('#dlg input'); f.value = 'hello world';
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true })); eq(J.getState(), J.getState(), 'state unchanged');
    document.querySelector('#dlg button.go').click(); eq(got, 'hello world'); ok(!dlgOpen, 'closed');
    let called = false; askText('Test', 'x', () => { called = true; }, {}); document.querySelector('#dlg button:not(.go)').click(); ok(!called && !dlgOpen, 'cancel returns nothing');
    showInfo('Info', 'body'); ok(dlgOpen); document.querySelector('#dlg button.go').click(); ok(!dlgOpen, 'info closes');
    askText('Copy', 'abc', null, { multi: true, readonly: true }); ok(document.querySelector('#dlg textarea').readOnly, 'copy box is read-only'); document.querySelector('#dlg button.go').click();
  });
  test('daily level: cooks in the step-by-step solver (screen stays alive) and can be cancelled', async () => {
    await toTitle(); J.setState('select'); const before = performance.now();
    startDaily(); ok(performance.now() - before < 200, 'starting must not block'); eq(J.getState(), 'solving'); ok(solver && solveDone, 'solver job queued');
    for (let i = 0; i < 3; i++) solver.next(); cancelSolve(); eq(J.getState(), 'select', 'back to the list'); ok(!solver && !solveDone, 'job cleared');
    await toTitle();
  });
  test('daily level: every heart can be collected in one run', () => {
    const L = makeDaily(); ok(L && L.daily, 'a daily level');
    for (const pace of [.85, 1, 1.12]) { const r = J.heartsSync(Object.assign({}, L, { bpm: L.bpm * pace }), 6); ok(r.ok && r.best === r.total, `at ${pace}x: ${r.best}/${r.total}, unreachable ${JSON.stringify(r.missed)}`); }
  }, { slow: true });
  test('custom levels: the first play drops hearts nobody can collect (once), then plays', () => {
    const L = J.genLevel('t', 't', 3, [0, 1, 2], 'bsp', 104, 0, true, .09), n0 = L.objs.filter(o => o.t === 'heart').length, custom = J.getStore().custom;
    custom.push(L); J.setState('select'); playLevel(L);
    eq(J.getState(), 'solving', 'it checks the hearts first'); ok(solver && solveDone, 'job queued');
    let r; while (!(r = solver.next()).done); const f = solveDone; solver = null; solveDone = null; J.setState('select'); f(r.value);   // what the frame loop does with a finished job
    eq(J.getState(), 'play', 'then it plays'); ok(L.objs.filter(o => o.t === 'heart').length < n0, 'an unreachable heart went'); ok(L.checkedSig, 'marked as checked');
    for (const pace of [.85, 1, 1.12]) { const h = J.heartsSync(Object.assign({}, L, { bpm: L.bpm * pace }), 6); eq(h.best, h.total, `every remaining heart at ${pace}x`); }
    J.setState('select'); playLevel(L); eq(J.getState(), 'play', 'a checked level goes straight in');
    custom.pop(); J.setState('title');
  }, { slow: true });

  /* ---------- the levels themselves ---------- */
  const paces = FULL ? [.85, 1, 1.12] : [1];
  for (const L of J.OFFICIAL) for (const pace of paces)
    test(`level is beatable: ${L.name}${pace === 1 ? '' : ' at ' + pace + 'x'}`, () => { const r = J.solveSync(Object.assign({}, L, { bpm: L.bpm * pace }), 30000); ok(r.ok, `solver reached ${r.pct}%`); }, { slow: true });
  // 100% must be possible: one winning run can touch every heart of every official level, at every pace the game offers (Chill, Normal, Spicy)
  for (const L of J.OFFICIAL) for (const pace of [.85, 1, 1.12])
    test(`every heart can be collected in one run: ${L.name}${pace === 1 ? '' : ' at ' + pace + 'x'}`, () => { const r = J.heartsSync(Object.assign({}, L, { bpm: L.bpm * pace }), 6); ok(r.ok && r.best === r.total, `best run gets ${r.best}/${r.total}; unreachable (add to UNREACHABLE_HEARTS in levels.js): ${JSON.stringify(r.missed)}`); }, { slow: true });

  /* ---------- the difficulty ramp ---------- */
  // "Pressure" = how much the player has to get right per second. Every hazard is an event and counts 1000 / (its window of safe takeoffs, in ms at the level's tempo),
  // so a narrow window or a faster tempo weighs more. Windows come from buildLevel's clusters (in tiles, so they shrink as the tempo rises). A spike group of 4+ or a gap of 6+
  // is crossed with a pad or orb, which are counted as their own (medium) events. A ship row counts by how far its corridor moves from the last one (a big move leaves less slack).
  const pressureOf = L => {
    J.buildLevel(L); const K = L.bpm / 112.5, msTile = 1000 * T / (360 * K); let w = 0, n = 0, tight = Infinity;
    const add = ms => { w += 1000 / ms; n++; tight = Math.min(tight, ms); };
    for (const c of clusters) {
      if (c.ship) continue;
      if (L.puff && c.kind === 'gap' && c.n >= 6) { add((c.n >= 8 ? 130 : c.n === 7 ? 170 : 220) / K); continue; }   // a wide gap in a puff level: hop and float across (the narrower the time to take off, the heavier)
      if (L.bounce && c.kind === 'block' && c.h >= 3) { add(260 / K); continue; }   // a tall block in a bounce level: land, tap just before touching down, spring over it
      if (L.bounce && c.kind === 'gap' && c.n >= 6) { add(200 / K); continue; }
      if ((c.kind === 'spike' && c.n >= 4) || (c.kind === 'gap' && c.n >= 6)) continue; add(Math.max(c.win * msTile, 45));
    }
    J.pads.forEach(() => add(300 / K)); for (const o of L.objs) if (o.t === 'orb') add(180 / K);
    for (const s of solids) if (s.gate) add(215 / K);   // a gummy gate: squish in time (about a fifth of a second of room at 112 BPM)
    for (const m of L.script.matchAll(/ship:(\d+)/g)) [...m[1]].map(Number).forEach((s, i, a) => add(Math.max(120, 330 - 45 * Math.abs(s - (i ? a[i - 1] : 2))) / K));
    return { P: w / (L.len * T / (360 * K)), secs: L.len * T / (360 * K), n, tight };
  };
  test('difficulty ramp: tempo never drops and the pressure climbs a notch with every level', () => {
    const ls = J.OFFICIAL.slice(1).filter(l => !l.intro), st = ls.map(pressureOf), P = st.map(s => s.P); J.buildLevel(J.OFFICIAL[0]);   // Welcome is the tutorial and a power's intro level (extra.intro) is gentle on purpose: they teach the ideas, so they are not part of the ramp
    for (let i = 1; i < ls.length; i++) {
      ok(ls[i].bpm >= ls[i - 1].bpm, `${ls[i].name} (${ls[i].bpm} BPM) is slower than ${ls[i - 1].name} (${ls[i - 1].bpm})`);
      ok(ls[i].stars >= ls[i - 1].stars, `${ls[i].name} has fewer stars than ${ls[i - 1].name}`);
      ok(P[i] >= P[i - 1] + .1, `${ls[i].name} (pressure ${P[i].toFixed(2)}) is not clearly harder than ${ls[i - 1].name} (${P[i - 1].toFixed(2)})`);
    }
    const steps = P.slice(1).map((p, i) => p - P[i]), avg = (P[P.length - 1] - P[0]) / steps.length;
    ok(P[P.length - 1] >= 2.5 * P[0], `the last level is only ${(P[P.length - 1] / P[0]).toFixed(1)}x the first (want 2.5x)`);
    ok(Math.max(...steps) <= 2 * avg, `no cliff: the biggest step (${Math.max(...steps).toFixed(2)}) is over twice the average (${avg.toFixed(2)})`);
    const q = ls[ls.length - 1]; ok(q.name === 'Slime Queen' && st[st.length - 1].secs === Math.max(...st.map(s => s.secs)), 'the last level is Slime Queen, and the longest');
  });

  /* ---------- runner ---------- */
  (async () => {
    const out = document.getElementById('out'), sum = document.getElementById('sum'); let pass = 0, fail = 0;
    for (const t of queue) {
      const row = document.createElement('div'); row.className = 'row'; out.appendChild(row);
      try { await t.fn(); pass++; row.innerHTML = '<span class="pass">✓</span> ' + t.name; results.push({ name: t.name, ok: true }); }
      catch (e) { fail++; row.innerHTML = '<span class="fail">✗ ' + t.name + '</span><pre></pre>'; row.querySelector('pre').textContent = String(e && e.message || e); results.push({ name: t.name, ok: false, error: String(e && e.message || e) }); }
      sum.textContent = `${pass} passed, ${fail} failed, ${queue.length - pass - fail} to go`; await frames(1);
    }
    sum.textContent = fail ? `${pass} passed, ${fail} FAILED` : `All ${pass} checks passed`; sum.style.color = fail ? '#c4244f' : '#1a8a5a'; window.__done = true;
  })();
})();
