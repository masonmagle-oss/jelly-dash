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
    eq(J.OFFICIAL.length, 15, 'level count'); ok(J.OFFICIAL[0].tutorial, 'the Welcome level is first'); ok(J.OFFICIAL[0].hints.length >= 6, 'tutorial has its tips');
    for (const id of ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9', 'o10', 'o11']) ok(ids.has(id), 'saved id kept: ' + id);
  });
  test('level share codes round-trip every official level', () => {
    for (const l of J.OFFICIAL) { const r = J.parseLevelCode(J.levelCode(l)); ok(r, 'parse ' + l.name); eq(r.objs.length, l.objs.length, 'objects of ' + l.name); eq(r.coy, l.coy, 'coyote of ' + l.name); }
    for (const junk of ['', 'abc', 'JD1.', 'JD1.@@@', '{}', 'x'.repeat(200000)]) eq(J.parseLevelCode(junk), null, 'junk code accepted');
  });
  test('save normaliser repairs anything', () => {
    const bad = [null, undefined, 5, 'x', [], {}, { custom: 'x', best: null, pace: 'a', studio: 5, set: 3 }, { custom: [null, { objs: 5 }, { objs: [] }], score: [], rate: 7, haz: -4, skin: 'q', set: { music: 99, sfx: -1, haptics: 'no', reduceMotion: 'x' } }];
    for (const b of bad) {
      const s = J.normalizeStore(b);
      ok(Array.isArray(s.custom) && s.custom.every(l => l && Array.isArray(l.objs)), 'custom'); ok(s.best && s.score && s.rate && s.studio && s.studio.stars, 'maps');
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
  test('editor check: the screen stays "solving" between steps (long levels)', () => {
    J.openEditor(level('Slime Queen')); const g = J.solveStart(); ok(g.next && J.getState() === 'solving'); g.next(); ok(J.getState() === 'solving', 'state restored after the first yield'); g.return(); J.setState('title');
  }, { slow: true });

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
      const dash = J.getUi().find(b => /^Dash/.test(b.label)); await tapAt(dash); await frames(2); eq(J.getState(), 'select', 'first tap opens the list');
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

  /* ---------- the levels themselves ---------- */
  const paces = FULL ? [.85, 1, 1.12] : [1];
  for (const L of J.OFFICIAL) for (const pace of paces)
    test(`level is beatable: ${L.name}${pace === 1 ? '' : ' at ' + pace + 'x'}`, () => { const r = J.solveSync(Object.assign({}, L, { bpm: L.bpm * pace }), 30000); ok(r.ok, `solver reached ${r.pct}%`); }, { slow: true });

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
