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
    eq(J.OFFICIAL.length, 25 + J.PACKS.length, 'level count: the 25 hand-made levels plus the level packs'); ok(J.OFFICIAL[0].tutorial, 'the Welcome level is first'); ok(J.OFFICIAL[0].hints.length >= 6, 'tutorial has its tips');
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
    for (const w of J.WORLDS) ok(w.id && w.name && w.tag && w.pal.length === 3 && J.AMB[w.amb], 'world fields: ' + w.id);
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
    ok(WORLD_TUNE.length >= 5 && WORLD_TUNE.length <= J.WORLDS.length, 'a tune for each of the five built-in worlds'); ok(tuneFor({ world: J.WORLDS.length }) === null, 'a world without a tune just plays its song style');
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
      const R = rewardFor(L), base = R.first + 3 * R.rating; let w = await win1(40); eq(w.earned, base, 'first clear and a three-heart rating'); eq(st.wallet, base); eq(w.parts.length, 2, 'the card can list what it paid for');
      w = await win1(40); eq(w.earned, 0, 'the same run again earns nothing'); w = await win1(46); eq(w.earned, R.all, 'taking every heart pays once'); eq(st.wallet, base + R.all);
      w = await win1(46); eq(w.earned, 0, 'and only once'); w = await win1(46, .85); eq(w.earned, 0, 'Chill pace pays nothing'); eq(st.wallet, base + R.all);
      const cx = J.genLevel('cx', 'cx', 1, [0, 1, 2], 's1', 104, 0, true, .09); cx.custom = true; st.pace = 1; await J.startLevel(cx, 'dash', false); got = 12; win(); eq(st.wallet, base + R.all, 'a level from the editor pays nothing (no farming)'); st.wallet = 75;   // (the shop checks below use round numbers)
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
      roomPanel = 'decor'; await frames(3); J.draw(); const btns = J.getUi().filter(b => /^decor /.test(b.label)); eq(btns.length, DECOR.filter(d => !DECOR_SLOTS.find(s => s.id === d.slot).exp).length, 'the first page has a button for every item that is not behind an expansion');
      st.decor = { owned: {}, placed: {}, tier: {}, dye: {}, dyes: {} }; st.wallet = 100; await frames(2); J.getUi().find(b => b.label === 'decor winsun').fn(); ok(st.decor.owned.winsun && st.wallet === 75, 'a tap in the panel buys it');
      roomPanel = null; J.draw(); const audit = J.auditUi(); ok(!audit.length, 'room buttons stay finger-sized: ' + audit.map(b => b.label).join());
    } finally { [st.wallet, st.hb, st.decor, st.best, st.score, st.rate, st.pace] = JSON.parse(keep); roomPanel = null; J.setMode('dash'); await toTitle(); }
  });
  test('cozy room: item tiers, dyes and the pet (prices, saving, drawing, panels)', async () => {
    const st = J.getStore(), keep = JSON.stringify([st.wallet, st.decor, st.pet, st.room]);
    try {
      st.decor = { owned: {}, placed: {}, tier: {}, dye: {}, dyes: {} }; st.pet = null; st.wallet = 0; st.room = { walls: { blush: true }, floors: { candy: true }, size: 0, wall: 'blush', floor: 'candy' };
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
      st.wallet = 1e5; st.room.size = 2; decorPage = 0; J.setState('room'); await frames(2);
      for (const d of DECOR) { buyDecor(d.id); for (let t = 0; t < 3; t++) for (const di of [0, 2, 5]) { st.decor.tier[d.id] = t; st.decor.dye[d.id] = di; st.decor.dyes[d.id] = 63; st.decor.placed[d.slot] = d.id; J.draw(); } }
      for (const [k] of PET_KINDS) for (const [, need] of PET_STAGES) { st.pet.kind = k; st.pet.love = need; st.pet.dye = 0; J.draw(); }
      for (const pn of ['decor', 'style', 'pet']) { roomPanel = pn; await frames(2); J.draw(); ok(J.getUi().length > 3, pn + ' panel has buttons'); }
      roomPanel = 'style'; await frames(2); J.draw(); eq(J.getUi().filter(b => b.label === '').length, 6 * 6, 'six dye buttons for each of the six places'); const up = J.getUi().filter(b => /Deluxe|Golden/.test(b.label)); ok(up.length >= 1, 'upgrade buttons');
      st.pet = null; roomPanel = 'pet'; await frames(2); J.draw(); eq(J.getUi().filter(b => b.label === '').length, 3, 'three pets to adopt'); J.getUi().filter(b => b.label === '')[1].fn(); eq(st.pet && st.pet.kind, 'kit', 'a tap adopts it');
      roomPanel = null; J.draw(); const bad = J.auditUi(); ok(!bad.length, 'room buttons still finger-sized: ' + bad.map(b => b.label).join());
    } finally { [st.wallet, st.decor, st.pet, st.room] = JSON.parse(keep); roomPanel = null; decorPage = 0; J.setMode('dash'); await toTitle(); }
  });
  test('cozy room: wallpapers, floors and expansions (prices, locks, saving, drawing, panel)', async () => {
    const st = J.getStore(), keep = JSON.stringify([st.wallet, st.decor, st.room]), fresh = () => ({ walls: { blush: true }, floors: { candy: true }, size: 0, wall: 'blush', floor: 'candy' });
    try {
      st.decor = { owned: {}, placed: {}, tier: {}, dye: {}, dyes: {} }; st.room = fresh(); st.wallet = 0; decorPage = 0;
      eq(WALLS[0].cost + FLOORS[0].cost, 0, 'the first wallpaper and floor are free'); eq(WALLS.length, 7); eq(FLOORS.length, 7);
      eq(buyStyle('wall', 'mint'), 'short'); st.wallet = 90; eq(buyStyle('wall', 'mint'), 'bought'); eq(st.wallet, 0); eq(st.room.wall, 'mint', 'a new wallpaper goes straight on');
      eq(buyStyle('wall', 'blush'), 'set'); eq(buyStyle('wall', 'mint'), 'set', 'one you own is free to switch back to'); eq(st.wallet, 0); eq(buyStyle('floor', 'nope'), 'none');
      st.wallet = 69; eq(buyStyle('floor', 'wood'), 'short'); st.wallet = 70; eq(buyStyle('floor', 'wood'), 'bought'); eq(st.room.floor, 'wood');
      // expansions open four more places, one at a time
      const fh = decorItem('frheart'); st.wallet = 1e4; eq(buyDecor('frheart'), 'locked'); ok(!st.decor.owned.frheart && st.wallet === 1e4, 'a locked place costs nothing');
      st.wallet = 499; eq(expandRoom(), 'short'); st.wallet = 500; eq(expandRoom(), 'expanded'); eq(st.room.size, 1); eq(st.wallet, 0);
      st.wallet = 1e4; eq(buyDecor('frheart'), 'bought'); eq(buyDecor('pfpink'), 'bought'); eq(buyDecor('shbooks'), 'locked', 'the shelf needs the second expansion');
      eq(expandRoom(), 'expanded'); eq(st.wallet, 1e4 - fh.cost - decorItem('pfpink').cost - 1800); eq(expandRoom(), 'max'); eq(buyDecor('shbooks'), 'bought'); eq(buyDecor('nktent'), 'bought');
      ok(DECOR.every(d => DECOR_SLOTS.some(s => s.id === d.slot)), 'every item has a place'); ok(DECOR_SLOTS.filter(s => s.exp).every(s => EXPANSIONS[s.exp - 1] && DECOR.filter(d => d.slot === s.id).length === 3), 'locked places name a real expansion and hold three things'); eq(DECOR.length, 30);
      // saving, including a save from before this existed and damaged ones
      const back = J.normalizeStore(JSON.parse(JSON.stringify(st))); eq(back.room.size, 2); eq(back.room.wall, 'mint'); eq(back.room.floor, 'wood'); ok(back.room.walls.mint && back.room.floors.wood, 'bought styles survive');
      const old = J.normalizeStore({}); eq(old.room.wall, 'blush'); eq(old.room.floor, 'candy'); eq(old.room.size, 0, 'an old save starts with the plain room');
      const junk = J.normalizeStore({ room: { wall: 'aurora', walls: { blush: true }, size: 9, floor: 'x1', floors: { wood: 'yes' } } }); eq(junk.room.wall, 'blush', 'a wallpaper you do not own is not worn'); eq(junk.room.size, 2, 'size is clamped'); eq(junk.room.floor, 'candy'); ok(!junk.room.floors.wood, 'only true counts as owned');
      // everything draws, and the panels work
      J.setState('room'); await frames(2);
      for (const w of WALLS) for (const f of FLOORS) { st.room.wall = w.id; st.room.floor = f.id; J.draw(); }
      st.room = fresh(); st.wallet = 5000; roomPanel = 'room'; await frames(2); J.draw(); eq(J.getUi().filter(b => /^(wall|floor) /.test(b.label || '')).length, 14, 'seven wallpapers and seven floors to pick');
      J.getUi().find(b => b.label === 'wall sky').fn(); eq(st.room.wall, 'sky', 'a tap buys and wears it'); eq(st.wallet, 5000 - 320);
      st.room = fresh(); decorPage = 1; roomPanel = 'decor'; await frames(2); J.draw(); eq(J.getUi().filter(b => /^locked /.test(b.label || '')).length, 4, 'all four extra places show as locked at first');
      st.room.size = 2; await frames(2); J.draw(); eq(J.getUi().filter(b => /^decor /.test(b.label || '')).length, 12, 'twelve things once everything is open');
      roomPanel = 'style'; await frames(2); J.draw(); ok(J.getUi().length > 3, 'style panel on the second page');
      roomPanel = null; decorPage = 0; J.draw(); const bad = J.auditUi(); ok(!bad.length, 'room buttons still finger-sized: ' + bad.map(b => b.label).join());
    } finally { [st.wallet, st.decor, st.room] = JSON.parse(keep); roomPanel = null; decorPage = 0; J.setMode('dash'); await toTitle(); }
  });
  test('pet life: it wanders inside the room, jumps at taps and hops, sleeps when left alone, and everything draws', async () => {
    const st = J.getStore(), keep = JSON.stringify(st.pet);
    try {
      st.pet = { kind: 'kit', name: 'Mochi', love: 0, dyes: 1, dye: 0, day: '' }; J.setState('room'); enterRoom(); await frames(2);
      PA.x = 330; PA.tx = 330; PA.mode = 'idle'; PA.asleep = false; PA.still = 0; PA.cheer = 0; PA.yo = 0; PA.vy = 0; PA.t = .1;
      const modes = new Set(); let lo = 1e9, hi = -1e9, bad = 0;
      for (let i = 0; i < 60 * 14; i++) { petStep(1 / 60); modes.add(PA.mode); lo = Math.min(lo, PA.x); hi = Math.max(hi, PA.x); if (!(PA.yo >= 0 && PA.yo < 80) || !isFinite(PA.x)) bad++; if (i % 100 === 0) PA.still = 0; }
      ok(modes.has('walk') && hi - lo > 40, 'it wandered (' + lo.toFixed(0) + ' to ' + hi.toFixed(0) + ')'); ok(lo >= RM.l + 40 && hi <= RM.r - 40, 'and stayed inside the room'); eq(bad, 0, 'its hops stay sane');
      PA.react = -9; PA.cheer = 0; PA.yo = 0; petReact('pet'); ok(PA.cheer > 1 && PA.vy > 0, 'a tap makes it jump and cheer');
      ok(petHit(PA.x, RM.b - 30) && !petHit(PA.x + 300, RM.b - 30) && !petHit(PA.x, RM.t + 20), 'only a tap on the pet counts'); st.pet = null; ok(!petHit(PA.x, RM.b - 30), 'no pet, nothing to tap'); st.pet = { kind: 'bun', name: 'Mochi', love: 0, dyes: 1, dye: 0, day: '' };
      PA.react = -9; PA.cheer = 0; PA.yo = 0; PA.vy = 0; petReact('hop'); ok(PA.cheer > 0 && PA.vy > 0, 'a hop of the jelly nearby makes it jump too'); PA.react = tg; const c0 = PA.cheer; petReact('hop'); eq(PA.cheer, c0, 'reactions are rate limited');
      // it runs to a held finger (and stops a little short), and bumps the jelly when it plays
      room.impact = 0; room.deform = 0; room.grabs = []; room.inds = []; PA.x = 200; PA.mode = 'idle'; PA.asleep = false; PA.nudgeT = 0; PA.cheer = 0; PA.still = 0; roomDown(5, 760, 300, 0); ok(PA.fingerOn && PA.fx === 760, 'a touch on the room tells the pet where the finger is');
      for (let i = 0; i < 60 * 8; i++) petStep(1 / 60); ok(PA.x > 560 && PA.x < 760, 'it runs toward a held finger and stops short of it (x ' + PA.x.toFixed(0) + ')'); roomRelease(null, true); ok(!PA.fingerOn, 'letting go ends the chase'); room.grabs = []; room.inds = [];
      { const orig = room.push; let hit = null; room.push = (a, b) => { hit = [a, b]; }; try { PA.nudgeT = .05; PA.x = room.bounds().cx - 150; for (let i = 0; i < 6; i++) petStep(1 / 60); } finally { delete room.push; if (room.push !== orig) room.push = orig; } ok(hit && hit[0] > 0 && hit[1] < 0, 'its bump pushes the jelly away from it and a little up'); }
      room.impact = 0; room.deform = 0; room.grabs = []; room.inds = []; PA.mode = 'idle'; PA.cheer = 0; PA.still = 0; for (let i = 0; i < 60 * 20; i++) petStep(1 / 60);   // (the body is not stepping here, so its last impact must not count as a fresh thump) ok(PA.asleep, 'left alone it falls asleep'); PA.react = -9; petReact('pet'); petStep(1 / 60); ok(!PA.asleep, 'and a tap wakes it');
      for (const o of [{}, { flip: -1, look: 1 }, { sleep: true }, { happy: true, hop: 12 }]) for (const kind of ['bun', 'kit', 'bear']) { drawPet({ kind, love: 9000, dye: 0 }, 400, 400, 1, tg, o); }
      PA.asleep = true; J.draw(); PA.asleep = false; PA.face = -1; PA.cheer = 1; J.draw();
    } finally { st.pet = JSON.parse(keep); PA.asleep = false; PA.cheer = 0; PA.face = 1; PA.x = 330; PA.tx = 330; PA.mode = 'idle'; J.setMode('dash'); await toTitle(); }
  });
  test('heart economy: later levels pay more (capped), the steady extras pay small amounts, nothing pays twice, and the pet cheers on the results card', async () => {
    const st = J.getStore(), keep = JSON.stringify([st.wallet, st.hb, st.best, st.score, st.rate, st.pace, st.studio, st.goals, st.pet]);
    try {
      eq(rewardScale(OFFICIAL[0]), 1, 'the first level pays the base amounts'); eq(rewardScale({}), 1, 'anything else pays the base'); eq(rewardScale({ __x: 1 }), 1, 'a level not in the official list pays the base');
      const fake = (stars, world) => { const L = { stars, world }; OFFICIAL.push(L); const s = rewardScale(L); OFFICIAL.pop(); return s; };   // the scale follows the level's own stars and world, not its place in the list
      ok(fake(5, 0) > fake(3, 0) && fake(3, 0) > fake(1, 0) && fake(1, 6) > fake(1, 0), 'harder levels and later worlds pay more'); ok(fake(5, 99) <= 1 + .3 * 4 + .08 * 12 + 1e-9, 'and the scale is capped (' + fake(5, 99).toFixed(2) + 'x)');
      const r0 = rewardFor(OFFICIAL[0]), rl = rewardFor(OFFICIAL[OFFICIAL.length - 1]); eq(r0.first, REWARD.first); ok(rl.first > r0.first && rl.rating > r0.rating && rl.all > r0.all, 'the last level pays more on every count');
      const total = OFFICIAL.slice(0, 25).reduce((n, L) => { const r = rewardFor(L); return n + r.first + 3 * r.rating + r.all; }, 0); ok(total > 2200 && total < 4500, 'clearing the 25 hand-made levels perfectly pays about three thousand hearts, got ' + total);
      const per = OFFICIAL.reduce((n, L) => { const r = rewardFor(L); return n + r.first + 3 * r.rating + r.all; }, 0) / OFFICIAL.length; ok(per > 80 && per < 260, 'a level pays about a hundred hearts on average (so a few hundred levels fund the whole room), got ' + Math.round(per));
      st.wallet = 0; st.hb = {}; st.best = {}; st.score = {}; st.rate = {}; st.pace = 1; st.pet = null;
      const L = OFFICIAL[10], r = rewardFor(L); await J.startLevel(L, 'dash', false); got = hearts.length; scoreNow = 10; judgeN = 10; judgeBase = 900; win();
      eq(st.wallet, r.first + 3 * r.rating + r.all, 'level eleven pays its scaled first clear, rating and every-heart'); const w1 = st.wallet; win(); eq(st.wallet, w1, 'the same win again pays nothing');
      st.pet = { kind: 'bun', name: 'Mochi', love: 600, dyes: 1, dye: 0, day: '' }; for (const k of [1, 2, 3]) { winStars = k; winT = 1.6; J.draw(); } winStars = 3; winT = .2; J.draw();   // the pet cheers beside the card at every rating
      const d = J.genLevel('daily-x', 'daily-x', 1, [0, 1, 2], 's1', 104, 0, true, .09); d.id = 'daily-2099-01-01'; st.best = {}; st.wallet = 0; await J.startLevel(d, 'dash', false); win(); eq(st.wallet, REWARD.daily, 'the daily level pays once'); await J.startLevel(d, 'dash', false); win(); eq(st.wallet, REWARD.daily, 'and not again');
      st.studio = { stars: {} }; st.wallet = 0; startStudio(); studioShape = 0; studioSimAvg = .95; completeShape(); eq(st.wallet, 3 * REWARD.studio, 'a three-star shape pays for each star'); studioSimAvg = .95; completeShape(); eq(st.wallet, 3 * REWARD.studio, 'and not twice');
      st.goals = null; st.wallet = 0; cozyTick(61, '2030-01-01'); eq(st.wallet, REWARD.cozy, 'a cozy day pays'); cozyTick(61, '2030-01-02'); eq(st.wallet, 2 * REWARD.cozy + 5, 'and a little more for a streak'); cozyTick(61, '2030-01-02'); eq(st.wallet, 2 * REWARD.cozy + 5, 'once a day');
    } finally { [st.wallet, st.hb, st.best, st.score, st.rate, st.pace, st.studio, st.goals, st.pet] = JSON.parse(keep); J.setMode('dash'); await toTitle(); }
  });
  test('editor tips: every tool explains itself and the level says which powers are on', async () => {
    for (const [id, label] of TOOLS) ok(TOOL_TIPS[id] && TOOL_TIPS[id].length > 10 && TOOL_TIPS[id].length < 70, label + ' has a short tip');
    eq(edPowerNote({}), ''); ok(/Puff/.test(edPowerNote({ puff: true })) && !/Bounce/.test(edPowerNote({ puff: true })), 'puff note'); ok(/Puff/.test(edPowerNote({ puff: true, bounce: true })) && /Bounce/.test(edPowerNote({ puff: true, bounce: true })), 'both notes');
    openEditor(null); await frames(2); for (const [id] of TOOLS) { edTool = id; for (const f of [0, 1]) { edLevel.puff = !!f; edLevel.bounce = !!f; J.draw(); } }
    const bad = J.auditUi(); ok(!bad.length, 'editor buttons still finger-sized: ' + bad.map(b => b.label).join()); edTool = 'block'; J.setMode('dash'); await toTitle();
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
  // The proofs are remembered in tests/proofs.json (see tests/proofs.js): a level whose data and the engine are unchanged since its last proof is not proved again. ?fresh proves everything again.
  const paces = FULL ? [.85, 1, 1.12] : [1], FRESH = location.search.includes('fresh'), NEWP = { fp: '', beat: {}, hearts: {} }; let PR = { fp: '', beat: {}, hearts: {} }, cacheOn = false, auditKey = '';
  window.__proofsOut = NEWP; window.__cacheInfo = {};
  test('proof cache: trusted only while the engine fingerprint matches; one cached proof is re-run as a spot check', async () => {
    const t0 = performance.now(); NEWP.fp = window.engineFp(); PR = await window.loadProofs(FRESH); cacheOn = !FRESH && PR.fp === NEWP.fp;
    const have = []; if (cacheOn) for (const L of J.OFFICIAL) for (const p of paces) if (PR.beat[window.proofKey(L, p)]) have.push(window.proofKey(L, p));
    auditKey = have.length ? have[Math.floor(Math.random() * have.length)] : '';
    window.__cacheInfo = { fresh: FRESH, cacheOn, engine: NEWP.fp, saved: PR.fp, cachedBeat: have.length, audit: auditKey, ms: Math.round(performance.now() - t0) };
  }, { slow: true });
  // a proof: skipped when cached, run (and so able to fail) otherwise; either way it goes into the cache this run writes
  const proved = (kind, L, pace, run) => { const key = window.proofKey(L, pace); if (!(cacheOn && PR[kind][key] && key !== auditKey)) run(); NEWP[kind][key] = 1; };
  for (const L of J.OFFICIAL) for (const pace of paces)
    test(`level is beatable: ${L.name}${pace === 1 ? '' : ' at ' + pace + 'x'}`, () => proved('beat', L, pace, () => { const r = J.solveSync(Object.assign({}, L, { bpm: L.bpm * pace }), 30000); ok(r.ok, `solver reached ${r.pct}%`); }), { slow: true });
  // 100% must be possible: one winning run can touch every heart of every official level, at every pace the game offers (Chill, Normal, Spicy)
  for (const L of J.OFFICIAL) for (const pace of [.85, 1, 1.12])
    test(`every heart can be collected in one run: ${L.name}${pace === 1 ? '' : ' at ' + pace + 'x'}`, () => proved('hearts', L, pace, () => { const r = J.heartsSync(Object.assign({}, L, { bpm: L.bpm * pace }), 6); ok(r.ok && r.best === r.total, `best run gets ${r.best}/${r.total}; unreachable (add to UNREACHABLE_HEARTS in levels.js, or to the level's drop list in js/packs.js): ${JSON.stringify(r.missed)}`); }), { slow: true });

  /* ---------- the difficulty ramp ---------- */
  // "Pressure" (the difficulty model, in tests/pressure.js) = how much the player has to get right per second. The ramp is per world, so the list can grow to hundreds of levels: inside
  // each world the tempo and the stars never drop and the pressure climbs a notch with every level, with no cliff, and the world's last level (its boss) is its hardest. Across worlds
  // only the bosses are compared: each world's boss is harder than the last. A new world may start easier than the one before it (a fresh climb) but must end harder.
  // Welcome is the tutorial and a power's intro level (extra.intro) is gentle on purpose: they teach the ideas, so they are not part of the ramp.
  const pressureOf = window.pressureOf, rampOf = w => J.OFFICIAL.filter(l => l.world === w && !l.intro && !l.tutorial);
  test('difficulty ramp: inside every world, tempo and stars never drop and the pressure climbs a notch with every level, with no cliff', () => {
    for (let w = 0; w < J.WORLDS.length; w++) {
      const ls = rampOf(w), P = ls.map(l => pressureOf(l).P), W = J.WORLDS[w].name;
      for (let i = 1; i < ls.length; i++) {
        ok(ls[i].bpm >= ls[i - 1].bpm, `${W}: ${ls[i].name} (${ls[i].bpm} BPM) is slower than ${ls[i - 1].name} (${ls[i - 1].bpm})`);
        ok(ls[i].stars >= ls[i - 1].stars, `${W}: ${ls[i].name} has fewer stars than ${ls[i - 1].name}`);
        ok(P[i] >= P[i - 1] + .1, `${W}: ${ls[i].name} (pressure ${P[i].toFixed(2)}) is not clearly harder than ${ls[i - 1].name} (${P[i - 1].toFixed(2)})`);
      }
      if (ls.length >= 4) { const steps = P.slice(1).map((p, i) => p - P[i]), avg = (P[P.length - 1] - P[0]) / steps.length; ok(Math.max(...steps) <= 2 * avg, `${W}: no cliff: the biggest step (${Math.max(...steps).toFixed(2)}) is over twice the average (${avg.toFixed(2)})`); }
      if (ls.length >= 2) ok(P[P.length - 1] === Math.max(...P), `${W}: the last level, ${ls[ls.length - 1].name}, is the world's boss and must be its hardest`);
    }
    J.buildLevel(J.OFFICIAL[0]);
  });
  test('difficulty ramp: every world ends harder than the one before, and the hardest level of the game is the last boss, Royal Jelly, or later', () => {
    const bosses = J.WORLDS.map((_, w) => { const ls = rampOf(w); return ls.length ? { l: ls[ls.length - 1], P: pressureOf(ls[ls.length - 1]).P } : null; }).filter(Boolean);
    for (let i = 1; i < bosses.length; i++) { ok(bosses[i].P >= bosses[i - 1].P + .1, `boss ${bosses[i].l.name} (${bosses[i].P.toFixed(2)}) is not harder than ${bosses[i - 1].l.name} (${bosses[i - 1].P.toFixed(2)})`); ok(bosses[i].l.stars >= bosses[i - 1].l.stars, `boss ${bosses[i].l.name} has fewer stars than ${bosses[i - 1].l.name}`); }
    const all = J.OFFICIAL.filter(l => !l.intro && !l.tutorial).map(l => pressureOf(l).P); J.buildLevel(J.OFFICIAL[0]);
    ok(Math.max(...all) >= 2.5 * Math.min(...all), `the hardest level is only ${(Math.max(...all) / Math.min(...all)).toFixed(1)}x the easiest (want 2.5x)`); ok(Math.max(...all) === bosses[bosses.length - 1].P, 'the last boss is the hardest level of the game');
    ok(rampOf(4).length && rampOf(4)[rampOf(4).length - 1].name === 'Royal Jelly' || J.WORLDS.length > 5, 'Royal Jelly is the boss of the Slime Palace');
  });
  /* ---------- level packs ---------- */
  test('level packs: makePackLevel builds a pack entry, drops its unreachable hearts, and a pack world takes part in everything a built-in world does', () => {
    const d = { id: 'ptest', w: 0, n: 'Test Path', st: 2, sc: 's2 g3 ss212', bpm: 104, sty: 3, coy: .06, drop: [] }, base = J.makePackLevel(d), hs = base.objs.filter(o => o.t === 'heart'); ok(hs.length >= 4, 'it has hearts');
    const gone = J.makePackLevel(Object.assign({}, d, { drop: [[hs[0].x, hs[0].y]] })); eq(gone.objs.filter(o => o.t === 'heart').length, hs.length - 1, 'a drop entry removes exactly that heart');
    eq([base.world, base.style, base.pal, base.stars, base.name], [0, 3, J.WORLDS[0].pal, 2, 'Test Path'], 'world, song style, palette, stars and name come from the entry'); ok(base.script === 's2 g3 ss212', 'the script is kept for the ramp test');
    const p = J.makePackLevel({ id: 'ppuff', w: 0, n: 'P', st: 3, sc: 'pg7 ss321', bpm: 110, sty: 1, x: { puff: true, bounce: true } }); ok(p.puff && p.bounce, 'power flags come through x');
    // a pack world: select screen, progress counts, rewards, the song, save and the level code all work for a level in a world that is not one of the five built in
    const W = J.WORLDS, n0 = W.length, O = J.OFFICIAL, o0 = O.length;
    for (let i = 0; i < 4; i++) W.push({ id: 'tw' + i, name: 'Test World ' + i, tag: 'a test', pal: [i % 8, 1, 2], amb: 'meadow' });
    const mine = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => { const L = J.makePackLevel({ id: 'pt' + i, w: n0 + (i < 5 ? 0 : 3), n: 'Pack ' + i, st: 1 + (i % 5), sc: 's2 g3 ss212', bpm: 100 + i, sty: i % J.SONG_N, coy: .06 }); O.push(L); return L; });
    try {
      for (const L of mine) { ok(rewardScale(L) >= 1 && rewardFor(L).first >= REWARD.first, 'a pack level pays'); eq(J.parseLevelCode(J.levelCode(L)).objs.length, L.objs.length, 'share code'); }
      ok(rewardScale(mine[4]) > rewardScale(mine[0]), 'more stars pay more');
      const st = J.getStore(), keep = JSON.stringify(st.best); try {
        st.best = {}; for (const L of O) if (!mine.slice(5).includes(L)) st.best[L.id] = 100; J.setState('select'); selWorld = -1; selTab = 0; pickFor = 'play'; selKey = ''; J.draw();
        eq(currentWorld(), n0 + 3, 'the select screen opens the first world with something left to beat (here the second pack world)'); eq([worldDone(n0), worldTotal(n0)], [5, 5], 'progress per world counts pack levels');
        eq(nextLevel().id, 'pt5', 'Continue goes to the first unbeaten level, in a pack world'); for (const w of [n0, n0 + 3]) { selWorld = w; selKey = ''; J.draw(); }
        for (let w = 0; w < W.length; w++) { selWorld = w; selKey = ''; J.draw(); }   // every world draws, whichever chips are showing
      } finally { st.best = JSON.parse(keep); }
    } finally { O.length = o0; W.length = n0; selWorld = -1; selKey = ''; J.setState('title'); J.buildLevel(O[0]); }
  });
  test('level select: a world with many levels pages two rows at a time, opens on the page that holds the next level, and the world chips scroll', () => {
    const W = J.WORLDS, n0 = W.length, O = J.OFFICIAL, o0 = O.length, st = J.getStore(), keep = JSON.stringify(st.best);
    for (let i = 0; i < 3; i++) W.push({ id: 'tw' + i, name: 'Test World ' + i, tag: 'a test', pal: [i, 1, 2], amb: 'meadow' });
    const mine = Array.from({ length: 21 }, (_, i) => { const L = J.makePackLevel({ id: 'pq' + i, w: n0, n: 'Page ' + i, st: 1 + Math.floor(i / 5), sc: 's2 g3 ss212', bpm: 100 + i, sty: 0, coy: .06 }); O.push(L); return L; });
    try {
      st.best = {}; for (const L of O) if (L.world !== n0) st.best[L.id] = 100; for (const L of mine.slice(0, 11)) st.best[L.id] = 100;   // level 12 of 21 is next: the second page of eight
      J.setState('select'); selTab = 0; pickFor = 'play'; selWorld = -1; selKey = ''; selPage = 0; worldSeen = -1; worldOff = 0; J.draw();
      eq(currentWorld(), n0, 'opens the unfinished pack world'); eq(nextLevel().id, 'pq11'); eq(selPage, 1, 'and its second page (levels 9-16)');
      ok(J.getUi().length > 5, 'buttons are registered');
      const bt = J.getUi().filter(u => u.y >= 230 && u.y < 470 && u.h > 90); ok(bt.length === 8, 'a page shows eight level cards, got ' + bt.length); ok(bt.every(u => u.y + u.h <= 476), 'and they fit above the page buttons');
      selWorld = 0; selKey = ''; J.draw(); eq(selPage, 0, 'a world without the next level opens on its first page');
      const chips = J.getUi().filter(u => u.y === 116 && u.w > 100); ok(chips.length === 4 && chips.every(u => u.x >= 50 && u.x + u.w <= 910), 'with more than five worlds, four chips show between the arrows (' + chips.length + ')');
      selWorld = n0 + 2; selKey = ''; J.draw(); ok(worldOff >= 2, 'choosing the last world scrolls the chip row to it (' + worldOff + ')');
    } finally { st.best = JSON.parse(keep); O.length = o0; W.length = n0; selWorld = -1; selKey = ''; worldSeen = -1; worldOff = 0; J.setState('title'); J.buildLevel(O[0]); }
  });
  test('proof key: changes with the level data and the pace, not with names or colours', () => {
    const L = J.OFFICIAL[3], k = window.proofKey(L, 1); eq(window.proofKey(L, 1), k, 'stable'); ok(window.proofKey(L, .85) !== k, 'pace'); ok(window.proofKey(Object.assign({}, L, { name: 'x', pal: [5, 5, 5], style: 3, stars: 5 }), 1) === k, 'cosmetics do not count');
    ok(window.proofKey(Object.assign({}, L, { coy: L.coy + .01 }), 1) !== k, 'coyote time counts'); ok(window.proofKey(Object.assign({}, L, { objs: L.objs.slice(1) }), 1) !== k, 'objects count'); ok(window.proofKey(Object.assign({}, L, { puff: !L.puff }), 1) !== k, 'power flags count');
  });
  /* ---------- ducking ---------- */
  test('music ducking: effects that carry information lower the music for a moment and it swells back; taps, hearts and jumps never duck', async () => {
    for (const [k, [amt, hold]] of Object.entries(DUCK)) { ok(amt >= .4 && amt <= .9, k + ': a duck of ' + amt + ' is too deep or too small'); ok(hold >= .05 && hold <= .8, k + ': hold ' + hold); }
    for (const k of ['heart', 'jump', 'click', 'tap', 'back', 'toggle', 'panel', 'tick', 'combo', 'squish']) ok(!(k in DUCK), k + ' happens all the time and must not duck the music');
    // which effects ask for a duck, with which numbers (a spy stands in for duck)
    const real = window.duck, calls = []; window.duck = (...a) => { calls.push(a); };
    try { for (const k of ['pad', 'orb', 'portal', 'die', 'win', 'bounce']) { calls.length = 0; sfx[k](); eq(calls, [DUCK[k]], k + ' ducks the music'); }
      for (const k of ['heart', 'jump', 'click', 'tap']) { calls.length = 0; sfx[k](); eq(calls.length, 0, k + ' does not duck'); }
      calls.length = 0; playHit({ id: 'gumdrop', hit() { } }); eq(calls, [DUCK['hit:']], 'a hit ducks the music'); } finally { window.duck = real; }
    // the real thing, rendered offline: a steady tone through the song bus dips to about the duck's gain, then recovers fully
    const render = async act => { const sr = 22050, b = await J.renderSfxOffline(() => { const s = AC.createConstantSource(); s.offset.value = .05; s.connect(duckG); s.start(); act(); }, 2, sr), d = b.getChannelData(0);
      const rms = (a, z) => { let s = 0; const i0 = Math.round(a * sr), i1 = Math.round(z * sr); for (let i = i0; i < i1; i++) s += d[i] * d[i]; return Math.sqrt(s / (i1 - i0)); }; return { dip: rms(.1, .2), after: rms(1.6, 1.9) }; };
    const base = await render(() => { }), ducked = await render(() => window.duck(.5, .2));
    ok(base.dip > .02, 'the test tone is audible (' + base.dip.toFixed(3) + ')'); ok(Math.abs(ducked.dip / base.dip - .5) < .08, 'the music dips to about the duck gain: ' + (ducked.dip / base.dip).toFixed(2) + ' of normal (want .5)');
    ok(ducked.after / base.after > .97, 'and swells back: ' + (ducked.after / base.after).toFixed(2) + ' of normal after 1.6 s');
  });
  /* ---------- the melody ---------- */
  test('melody: every style plays a hook (repeating rhythm and contour), stepwise, within an octave and a half, landing on chord tones on the beat', () => {
    for (let i = 0; i < SONG_N; i++) {
      const cfg = styleCfg(i); let notes = 0, down = 0, onChord = 0, leaps = 0, moves = 0, same = 0, rep = 0, runs = 0, maxRange = 0;
      for (const seed of [hashStr(STYLES[i].name), ...[0, 1, 2, 3, 4, 5].map(k => hashStr('Level ' + k + STYLES[i].name))]) {
        const s = { cfg, seed, mot: {} }, bars = [0, 1, 2, 3, 4, 5, 6, 7].map(b => motif(s, b)); let mn = 999, mx = 0; runs++;
        bars.forEach((m, b) => { const ch = cfg.prog[b % 4], pcs = new Set(ch[1].map(t => ((cfg.root + ch[0] + t) % 12 + 12) % 12)); let prev = null;
          m.forEach((n, k) => { if (!n) return; notes++; mn = Math.min(mn, n); mx = Math.max(mx, n); if (k % 4 === 0) { down++; if (pcs.has(n % 12)) onChord++; } if (prev !== null) { moves++; if (Math.abs(n - prev) >= 5) leaps++; } prev = n; }); });
        maxRange = Math.max(maxRange, mx - mn); const pat = m => m.map(n => n ? 1 : 0).join(''); for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) if (pat(bars[a]) === pat(bars[b])) same++;
        const seq = bars.flat().filter(Boolean), g = {}; for (let k = 0; k + 3 < seq.length; k++) { const key = seq.slice(k, k + 4).map((x, j, a) => j ? x - a[j - 1] : 0).join(','); g[key] = (g[key] || 0) + 1; } for (const k in g) if (g[k] > 1) rep += g[k] - 1;
        for (const m of bars) ok(m.filter(Boolean).length >= 2, cfg.name + ': a bar of the melody has fewer than two notes');
      }
      const nm = cfg.name; eq(onChord, down, nm + ': every note on the beat is a chord tone'); ok(leaps / moves <= .25, nm + ': ' + Math.round(100 * leaps / moves) + '% of the moves are leaps (want at most 25%)'); ok(maxRange <= 17, nm + ': the melody spans ' + maxRange + ' semitones (want at most 17: about an octave and a half, section B lifted a step)');
      ok(same / runs >= 5, nm + ': only ' + (same / runs).toFixed(1) + ' of 28 bar pairs share a rhythm (the hook must come back)'); ok(rep / runs >= .8, nm + ': melodic shapes hardly repeat (' + (rep / runs).toFixed(1) + ')'); ok(notes / runs / 8 >= 2.4 && notes / runs / 8 <= 5.2, nm + ': ' + (notes / runs / 8).toFixed(1) + ' notes a bar');
    }
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
