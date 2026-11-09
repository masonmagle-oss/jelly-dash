'use strict';
/* Jelly Dash — Drawing the UI: menus, sharing, settings, floor bar and pickers.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= drawing: UI ================= */
let ui = [];
function btn(label, x, y, w, h, fn, o = {}) {
  if (o.off) { ctx.save(); ctx.globalAlpha = .4; fn = () => {}; }   // disabled: drawn faint and inert
  const hov = !isTouchUi() && mouse.x > x && mouse.x < x + w && mouse.y > y && mouse.y < y + h, lift = hov ? -2 : 0;   // no hover on touch: it would stay lit after a tap
  ctx.fillStyle = o.fill || (hov ? 'rgba(255,255,255,.96)' : C.card); rr(x, y + lift, w, h, o.r || 18); ctx.fill();
  ctx.lineWidth = o.on ? 4 : 3; ctx.strokeStyle = o.on ? C.hot : (hov ? C.pink : C.blush); ctx.stroke();
  if (o.sub) { txt(label, x + w / 2, y + h * .38 + lift, o.size || 24, o.col || C.pink, null); txt(o.sub, x + w / 2, y + h * .74 + lift, o.ssize || 15, C.mauve, null); }
  else txt(label, x + w / 2, y + h / 2 + lift, o.size || 20, o.col || C.pink, null);
  if (o.off) ctx.restore();
  ui.push({ x, y, w, h, fn, label, clip: o.clip });   // label: for tests and for describing the control
}
function stars(n, x, y, sz = 9) { for (let i = 0; i < 5; i++) { ctx.fillStyle = i < n ? C.gold : 'rgba(200,160,200,.45)'; sparklePath(x + i * sz * 2.1, y, sz); ctx.fill(); } }
function bestOf(id) { return store.best[id] || 0; }

function drawTitle() {
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-VX, 0, VW, H);
  const word = 'Jelly Dash'; ctx.font = '700 70px Fredoka,"Trebuchet MS",sans-serif';
  const widths = [...word].map(ch => ctx.measureText(ch).width), total = widths.reduce((a, b) => a + b, 0);
  let x = W / 2 - total / 2;
  [...word].forEach((ch, i) => { txt(ch, x + widths[i] / 2, 78 + Math.sin(tg * 3 + i * .6) * 7, 70, i % 2 ? C.pink : '#c86bff', '#fff'); x += widths[i]; });
  txt('squishy physics platformer', W / 2, 124, 21, '#fff', C.plum);
  const items = [['Dash', store.best.o14 ? 'the classic run' : 'new here? try the Welcome level first', () => { pickFor = 'play'; mode = 'dash'; state = 'select'; }], ['Zen', 'no oopsies, just vibes', () => { pickFor = 'play'; mode = 'zen'; state = 'select'; }],
    ['Practice', 'checkpoints • learn a level at your pace', () => { pickFor = 'play'; mode = 'practice'; state = 'select'; }],
    ['Squish Room', 'poke, drag & fling the jelly', enterRoom],
    ['Squish Studio', 'knead shapes, build a song', () => startStudio()], ['Level Creator', 'build, test & share your own', () => { pickFor = 'edit'; state = 'select'; }]];
  items.forEach((m, i) => btn(m[0], W / 2 - 340 + (i % 2) * 350, 150 + Math.floor(i / 2) * 98, 330, 86, () => { initAudio(); sfx.click(); m[2](); }, { sub: m[1], size: 24, ssize: 14 }));   // two columns of big buttons: finger-sized on a phone
  btn('⚙ Settings', W - 148, 14, 132, 40, () => { sfx.click(); state = 'settings'; }, { size: 17, r: 16 });
  txt(isTouchUi() ? 'tap to choose  •  headphones recommended' : '1-6 to choose  •  M to mute  •  headphones recommended', W / 2, 516, TS.small, '#fff', C.plum);
}
let dailyL = null;
function selList() { return selTab === 0 ? OFFICIAL : store.custom; }

/* ---------- sharing and the daily level ---------- */
// a level becomes a short text code anyone can paste in; codes from other people are untrusted, so every field is checked and clamped on the way in
function levelCode(L) {
  const o = { n: String(L.name || 'Level').slice(0, 24), p: L.pal, l: L.len, b: L.bpm, y: L.coy || DEF_COY, s: L.style, a: L.auto ? 1 : 0, o: L.objs.map(q => [OBJ_TYPES.indexOf(q.t), q.x, q.y || 0, q.to === 'ship' ? 1 : 0]) };
  return 'JD1.' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
}
function parseLevelCode(s) {
  try {
    s = String(s || '').trim(); if (!s.startsWith('JD1.') || s.length > 120000) return null;
    const o = JSON.parse(decodeURIComponent(escape(atob(s.slice(4)))));
    if (!Array.isArray(o.o) || o.o.length > 6000) return null;
    const fin = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v)) ? clamp(v, lo, hi) : d;
    const objs = [];
    for (const q of o.o) {
      if (!Array.isArray(q)) return null;
      const t = OBJ_TYPES[q[0]]; if (!t) return null;
      const ob = { t, x: fin(q[1], 0, 2000, 0) }; if (t !== 'gap' && t !== 'portal') ob.y = Math.round(fin(q[2], 0, 6, 0)); if (t === 'heart') ob.y = fin(q[2], 0, 6, 0); if (t === 'portal') ob.to = q[3] ? 'ship' : 'cube';
      objs.push(ob);
    }
    const pal = Array.isArray(o.p) ? o.p.slice(0, 4).map(v => Math.round(fin(v, 0, TH.length - 1, 0))) : [0, 1, 2];
    return { id: 'c' + Date.now() + Math.floor(Math.random() * 1000), name: cleanName(o.n, 'Shared level'), stars: 0, pal: pal.length ? pal : [0, 1, 2], len: fin(o.l, 40, 2100, 200), objs, coy: fin(o.y, .03, .12, DEF_COY), bpm: fin(o.b, 60, 180, BASE_BPM), style: Math.round(fin(o.s, 0, SONG_N - 1, 0)), auto: !!o.a, custom: true };
  } catch (e) { return null; }
}
function copyText(t, okMsg) {
  const done = () => say(okMsg), fail = () => showCopy('Copy this code', t);   // when the clipboard is refused, show the code to select and copy by hand
  try { navigator.clipboard.writeText(t).then(done, fail); } catch (e) { fail(); }
}
function pasteLevel() {
  askText('Paste a level code', '', s => {
    const L = parseLevelCode(s);
    if (!L) { say('That code did not work'); return; }
    store.custom.push(L); persist(); selTab = 1; say('Added "' + L.name + '"');
  }, { multi: true, ok: 'Add level', hint: 'Paste here' });
}
// a new level every day: seeded from the date, rebuilt from tokens until the solver proves it can be beaten
function dailySeed() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
// The daily level is built and proven beatable by the same step-by-step solver the editor's Check uses, so the screen keeps animating and can be cancelled.
function* dailyGen() {
  const seed = dailySeed(); let a = seed;
  const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pool = ['s1', 's2', 's2', 'b21', 'b32', 'g2', 'g3', 'g4', 'stairs', 'ss212', 'ss232', 'gs32', 'gs33', 'dbl', 'pad', 'bsp', 'ship:2231', 'ship:12321', 'ship:2102'];
  const name = 'Daily ' + String(seed % 10000).replace(/^(\d\d)(\d\d)$/, '$1/$2');
  for (let tries = 0; tries < 12; tries++) {
    const bpm = 100 + Math.floor(rnd() * 5) * 4, toks = [];
    for (let i = 0; i < 14; i++) { const t = pool[Math.floor(rnd() * pool.length)]; if (t === toks[toks.length - 1]) { i--; continue; } toks.push(t); if (t.startsWith('ship:')) toks.push('rest'); }
    const pal = [Math.floor(rnd() * 6), Math.floor(rnd() * 6), Math.floor(rnd() * 6)];
    const L = genLevel('daily-' + seed, name, 3, pal, toks.join(' '), bpm, Math.floor(rnd() * SONG_N), false);
    buildLevel(L); const g = solveGen(); let r;
    try { while (!(r = g.next()).done) yield (tries + r.value) / 12; } finally { g.return(); }
    if (r.value.ok) {   // beatable: now drop any hearts no winning run could take, so today's level can be finished with all of them
      const u = unreachableHearts(L, ...QUICK_HEARTS); let q;
      try { while (!(q = u.next()).done) yield (tries + .8 + q.value * .2) / 12; } finally { u.return(); }
      dropHearts(L, q.value); L.daily = true; return L;
    }
  }
  return null;
}
function startDaily() {
  const go = L => { if (L) { dailyL = L; startLevel(L, mode, false); } else { state = 'select'; say('Could not make one today', 3); } };
  if (dailyL && dailyL.id === 'daily-' + dailySeed()) { go(dailyL); return; }
  state = 'solving'; solverPct = 0; solveDone = go; solver = dailyGen();
}
// A level that came from somewhere else (a shared code, an older save, the editor) can hold hearts nobody can collect. Before its first play, and again after
// any edit (its code no longer matches checkedSig), those hearts are dropped, at every pace; the "Checking the hearts…" screen can be cancelled.
function* trimGen(L) {
  const u = unreachableHearts(L, ...QUICK_HEARTS); let q;
  try { while (!(q = u.next()).done) yield q.value; } finally { u.return(); }
  const n = dropHearts(L, q.value); L.checkedSig = levelCode(L); persist(); return n;
}
function playLevel(L) {
  if (OFFICIAL.includes(L) || L.daily || L.checkedSig === levelCode(L) || !L.objs.some(o => o.t === 'heart')) { startLevel(L, mode, false); return; }
  state = 'solving'; solverPct = 0; solveLabel = 'Checking the hearts…';
  solveDone = n => { solveLabel = ''; if (n) say(`Removed ${n} heart${n > 1 ? 's' : ''} nobody can reach`, 3.5); startLevel(L, mode, false); };
  solver = trimGen(L);
}
function makeDaily() {   // synchronous version, for tests
  const g = dailyGen(); let r; while (!(r = g.next()).done); return r.value;
}
// the world whose levels are shown: the one the player chose, otherwise the first world with something left to beat
const worldDone = w => OFFICIAL.filter(l => l.world === w && (store.best[l.id] || 0) >= 100).length;
const worldTotal = w => OFFICIAL.filter(l => l.world === w).length;
function currentWorld() { if (selWorld >= 0) return selWorld; const i = WORLDS.findIndex((_, w) => worldDone(w) < worldTotal(w)); return i < 0 ? 0 : i; }
function drawSelect() {
  const official = selTab === 0, wi = currentWorld();
  const th = theme(.35 + Math.sin(tg * .2) * .3, official ? WORLDS[wi].pal : [0, 1, 2]);
  drawBg(tg * 25, th);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-VX, 0, VW, H);
  txt(pickFor === 'edit' ? 'Pick a level to edit' : (mode === 'zen' ? 'Zen — pick a level' : mode === 'practice' ? 'Practice — pick a level' : 'Pick a level'), W / 2, 32, 32, C.pink, '#fff');
  btn('Official', 132, 62, 140, 44, () => { selTab = 0; selPage = 0; }, { on: selTab === 0, size: 20 });
  btn('My Levels (' + store.custom.length + ')', 278, 62, 176, 44, () => { selTab = 1; selPage = 0; }, { on: selTab === 1, size: 18 });
  if (selTab === 1) btn('Paste code', 14, 62, 112, 44, () => { sfx.click(); pasteLevel(); }, { size: 15, r: 12 });
  else if (pickFor === 'play') btn('★ Daily', 14, 62, 112, 44, () => { sfx.click(); startDaily(); }, { size: 15, r: 12 });
  if (pickFor === 'play') {   // Pace rescales the tempo (and every timing window with it) without changing any layout
    txt('Pace', 492, 85, TS.small, '#fff', C.plum);
    [['Chill', .85], ['Normal', 1], ['Spicy', 1.12]].forEach(([nm, v], i) => btn(nm, 536 + i * 92, 62, 86, 44, () => { store.pace = v; persist(); sfx.click(); }, { size: 14, r: 12, on: Math.abs((store.pace || 1) - v) < .01 }));
  }
  if (official) {   // one chip per world, then a banner for the chosen one
    WORLDS.forEach((w, i) => btn((i + 1) + '  ' + w.name, 14 + i * 187, 116, 181, 50, () => { selWorld = i; sfx.tap(); }, { size: 15, r: 15, on: i === wi, sub: worldDone(i) + ' / ' + worldTotal(i) + ' beaten', ssize: 13 }));
    txt('World ' + (wi + 1) + ' · ' + WORLDS[wi].name, 24, 186, 28, '#fff', C.plum, 'left'); txt(WORLDS[wi].tag, 24 + 8, 214, TS.small, '#fff', C.plum, 'left');
  }
  const list = (official ? selList().filter(l => l.world === wi) : selList().slice()), cards = [];
  if (pickFor === 'edit' && selTab === 1) cards.push({ nw: true });
  if (pickFor === 'edit' && selTab === 1 && edLevel && edDirty) cards.push({ cont: true });
  list.forEach(l => cards.push({ l }));
  const per = official ? 99 : 15, pages = Math.max(1, Math.ceil(cards.length / per)); selPage = clamp(selPage, 0, pages - 1);
  const show = cards.slice(selPage * per, selPage * per + per);
  show.forEach((c, i) => {
    const col = official ? i % 4 : i % 5, row = official ? Math.floor(i / 4) : Math.floor(i / 5), x = official ? 20 + col * 233 : 20 + col * 185, y = official ? 236 + row * 116 : 128 + row * 112, w = official ? 217 : 175, h = official ? 104 : 98;
    if (c.nw) { btn('+ New level', x, y, w, h, () => { sfx.click(); openEditor(null); }, { size: 22, fill: 'rgba(255,240,250,.9)' }); return; }
    if (c.cont) { btn('Continue draft', x, y, w, h, () => { sfx.click(); buildLevel(edLevel); state = 'edit'; }, { sub: edLevel.name, size: 21 }); return; }
    const L = c.l, idx = OFFICIAL.indexOf(L);
    btn('', x, y, w, h, () => {
      sfx.click();
      if (pickFor === 'edit') openEditor(L); else playLevel(L);
    }, { r: 22 });
    txt((idx >= 0 && !L.tutorial ? (OFFICIAL.filter(q => !q.tutorial).indexOf(L) + 1) + '. ' : '') + L.name, x + w / 2, y + 26, L.name.length > (official ? 15 : 11) ? 17 : 20, C.pink, null);
    if (L.stars) stars(L.stars, x + w / 2 - 70, y + 52, 8); else txt('custom', x + w / 2 - 40, y + 52, 15, C.mauve, null);
    txt('♪ ' + Math.round((L.bpm || BASE_BPM) * (pickFor === 'play' ? (store.pace || 1) : 1)), x + w - 18, y + 52, 14, C.mauve, null, 'right');
    const b = bestOf(L.id); ctx.fillStyle = 'rgba(200,160,220,.4)'; rr(x + 20, y + 72, w - 100, 10, 5); ctx.fill();
    if (b > 0) { ctx.fillStyle = b >= 100 ? C.gold : '#ff7ab8'; rr(x + 20, y + 72, Math.max(10, (w - 100) * b / 100), 10, 5); ctx.fill(); }
    if (L.tutorial && !bestOf(L.id)) { ctx.fillStyle = C.gold; rr(x + w - 92, y - 9, 86, 22, 11); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); txt('START HERE', x + w - 49, y + 3, TS.min, '#fff', null); }
    const rt = store.rate[L.id] || 0;   // rhythm rating: up to 3 hearts for timing accuracy
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < rt ? C.hot : 'rgba(200,160,220,.5)'; heartPath(x + w - 62 + i * 19, y + 77, 7); ctx.fill(); }
    if (L.custom && pickFor !== 'edit') {
      ui.pop(); ui.push({ x, y, w: w - 34, h, fn: () => { sfx.click(); playLevel(L); } });
    }
    if (L.custom) {
      btn('⧉', x + 4, y + 4, 36, 24, () => { sfx.click(); copyText(levelCode(L), 'Level code copied'); }, { size: 14, r: 10 });
      const armed = delArm === L.id;
      btn(armed ? 'sure?' : '✕', x + w - 40, y + 4, 36, 24, () => { if (armed) { store.custom = store.custom.filter(q => q.id !== L.id); persist(); delArm = null; } else delArm = L.id; }, { size: armed ? 11 : 14, col: '#e03070', r: 10 });
    }
  });
  if (!cards.length) txt('No levels yet — make one in the Level Creator!', W / 2, 270, 24, '#fff', C.plum);
  if (pages > 1) { btn('◀', W / 2 - 80, 478, 50, 36, () => { selPage = Math.max(0, selPage - 1); }, { size: 18, off: selPage === 0 }); btn('▶', W / 2 + 30, 478, 50, 36, () => { selPage = Math.min(pages - 1, selPage + 1); }, { size: 18, off: selPage === pages - 1 }); txt(`${selPage + 1}/${pages}`, W / 2, 496, 16, '#fff', C.plum); }
  btn('Back', 24, 478, 110, 40, () => { sfx.back(); toTitle(); }, { size: 18 });
}
/* ================= settings =================
   Volume sliders, comfort options, and the save backup. Sliders are ui entries with a `slider` field; the settings screen routes drags to them. */
let dragSlider = null, resetArm = 0;
function sliderTo(mx) { const sl = dragSlider, v = Math.round(clamp((mx - sl.x0) / (sl.x1 - sl.x0), 0, 1) * 20) / 20; if (v !== sl.last) { sl.last = v; sfx.tick(v); } sl.set(v); }   // a tick on every step
function slider(label, x, y, val, set) {
  const x0 = x + 160, x1 = x + 400, my = y + 22;
  txt(label, x, my, TS.label, C.pink, null, 'left');
  ctx.fillStyle = 'rgba(200,160,220,.45)'; rr(x0, my - 7, x1 - x0, 14, 7); ctx.fill();
  const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#ff9ccf'); g.addColorStop(1, '#c86bff');
  ctx.fillStyle = g; rr(x0, my - 7, Math.max(14, (x1 - x0) * val), 14, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * val, my, 15, 0, 7); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = C.hot; ctx.stroke();
  txt(Math.round(val * 100) + '%', x1 + 14, my, TS.small, C.mauve, null, 'left');
  ui.push({ x: x0 - 16, y, w: x1 - x0 + 32, h: 44, label: 'slider ' + label, slider: { x0, x1, set }, fn() {} });
}
function exportSave() { copyText('JDS1.' + btoa(unescape(encodeURIComponent(JSON.stringify(store)))), 'Save code copied — keep it somewhere safe'); }
function importSave() {
  askText('Paste a save code', '', t => {
    try {
      t = String(t).trim(); if (!t.startsWith('JDS1.') || t.length > 4000000) throw new Error('not a save code');
      const n = normalizeStore(JSON.parse(decodeURIComponent(escape(atob(t.slice(5))))));
      for (const k of Object.keys(store)) delete store[k]; Object.assign(store, n); persist();
      tumble = SET().tumble; applyVolumes(); say('Save restored', 2.5);
    } catch (e) { say('That code did not work', 2.5); }
  }, { multi: true, ok: 'Restore', hint: 'Paste here' });
}
function resetProgress() {
  if (resetArm <= 0) { resetArm = 3; say('Tap again to reset your progress (levels you made are kept)', 3); return; }
  resetArm = 0; store.best = {}; store.score = {}; store.rate = {}; store.studio = { stars: {} }; store.skin = 0; store.haz = 0; store.seenOrb = false; store.seenStudio = false; store.seenRoom = false; persist(); say('Progress reset', 2.5);
}
function drawSettings() {
  drawBg(tg * 25, theme(.45, [0, 1, 2]));
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-VX, 0, VW, H);
  txt('Settings', W / 2, 44, 38, C.pink, '#fff');
  const S = SET(), cw = 420, y0 = 100, step = 58, rm = S.reduceMotion;
  txt('Sound & comfort', 40, y0 - 6, TS.body, C.plum, '#fff', 'left');
  slider('Music', 40, y0 + 14, S.music, v => { S.music = v; applyVolumes(); });
  slider('Effects', 40, y0 + 14 + step, S.sfx, v => { S.sfx = v; applyVolumes(); });
  const tg2 = (label, i, on, fn) => btn(label + ': ' + (on ? 'on' : 'off'), 40, y0 + 14 + step * (2 + i), cw, 46, () => { fn(); persist(); sfx.toggle(!on); }, { size: 19, on });
  tg2('Vibration', 0, S.haptics, () => { S.haptics = !S.haptics; if (S.haptics) buzz(20); });
  btn('Reduce motion: ' + (rm === null ? 'auto' : rm ? 'on' : 'off'), 40, y0 + 14 + step * 3, cw, 46, () => { S.reduceMotion = rm === null ? true : rm ? false : null; persist(); sfx.click(); }, { size: 19, on: rm === true });
  tg2('Spin in the air', 2, S.tumble, () => { S.tumble = !S.tumble; tumble = S.tumble; });
  tg2('Jump guides', 3, store.guides !== false, () => { store.guides = store.guides === false; });
  txt('Your save', 520, y0 - 6, TS.body, C.plum, '#fff', 'left');
  btn('Copy save code', 520, y0 + 14, 400, 46, () => { sfx.click(); exportSave(); }, { size: 19 });
  btn('Restore from code', 520, y0 + 14 + step, 400, 46, () => { sfx.click(); importSave(); }, { size: 19 });
  btn(resetArm > 0 ? 'Tap again to confirm' : 'Reset progress', 520, y0 + 14 + step * 2, 400, 46, resetProgress, { size: 19, col: C.hot, on: resetArm > 0 });
  txt('Progress and your own levels live in this browser.', 520, y0 + 14 + step * 3 + 8, TS.small, C.mauve, null, 'left');
  txt('Copy a save code now and then to keep a backup.', 520, y0 + 14 + step * 3 + 32, TS.small, C.mauve, null, 'left');
  btn('How to play', 520, y0 + 14 + step * 4, 400, 46, () => { sfx.panel(true); showInfo('How to play', HOW_TO); }, { size: 19 });
  btn('Privacy', 520, y0 + 14 + step * 5, 400, 46, () => { sfx.panel(true); showInfo('Privacy', PRIVACY); }, { size: 19 });
  btn('‹ Back', 24, 478, 120, 44, () => { sfx.back(); toTitle(); }, { size: 20 });
}
const HOW_TO = [
  'Tap anywhere (or press Space) to jump. The jelly runs by itself; you only choose when to hop.',
  'Land your jump on the beat for PERFECT. Little footprints on the ground show the best spot to take off.',
  'In the ship, press and hold to rise and let go to sink. Pads bounce you high, and orbs give one more jump in mid-air.',
  'Dash is the classic run. Zen forgives mistakes. Practice lets you drop checkpoints.',
  'Squish Room and Squish Studio have no way to lose: poke, drag and knead the jelly.',
  'In a run, the ☰ button (top right) leaves the level; tap it twice.',
].join('\n\n');
const PRIVACY = [
  'Jelly Dash keeps everything on your own device. Your progress, settings and the levels you make are saved in this browser\'s storage and go nowhere else.',
  'There are no accounts, no ads, no analytics and no tracking. The game sends nothing about you to anyone, and its font and sounds are built in.',
  'Level and save codes are plain text that you copy and paste yourself. Only share them with people you choose.',
  'To erase everything, use Reset progress in Settings, or clear this site\'s data in your browser.',
  'The website or app store you got the game from may have its own privacy policy.',
].join('\n\n');
function drawEditor() {
  const th = theme(0, edLevel.pal), sc = edScroll * T;
  drawBg(sc * .6, th);
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(-VX, CEIL, VW, GY - CEIL);
  // grid
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1;
  ctx.beginPath();
  const c0 = Math.floor(edScroll - VX / T);
  for (let c = c0; c <= edScroll + (W + VX) / T + 1; c++) { const x = c * T - sc; ctx.moveTo(x, CEIL); ctx.lineTo(x, GY); }
  for (let r = 0; r <= 7; r++) { ctx.moveTo(0, CEIL + r * T); ctx.lineTo(W, CEIL + r * T); }
  ctx.stroke();
  // beat grid: 4 tiles = 1 beat (bold), 16 tiles = 1 bar (pink, numbered)
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let c = c0; c <= edScroll + (W + VX) / T + 1; c++) if (c % 4 === 0 && c % 16 !== 0) { const x = c * T - sc; ctx.moveTo(x, CEIL); ctx.lineTo(x, GY); }
  ctx.stroke();
  ctx.strokeStyle = '#ff7ab8'; ctx.lineWidth = 3; ctx.beginPath();
  for (let c = c0; c <= edScroll + (W + VX) / T + 1; c++) if (c % 16 === 0) { const x = c * T - sc; ctx.moveTo(x, CEIL - 6); ctx.lineTo(x, GY); }
  ctx.stroke();
  for (let c = c0; c <= edScroll + (W + VX) / T + 1; c++) if (c % 16 === 0) txt('bar ' + (c / 16 + 1), c * T - sc + 4, CEIL - 12, 13, '#fff', C.plum, 'left');
  // ship-section hint band
  drawWorld(sc, th);
  // safe-start zone + level end shading
  ctx.fillStyle = 'rgba(120,200,160,.2)'; ctx.fillRect(-sc, CEIL, 6 * T, GY - CEIL);
  txt('start', -sc + 3 * T, CEIL + 16, 14, '#fff', '#5fb99a');
  // hover cell
  const col = Math.floor((mouse.x + sc) / T), row = 6 - Math.floor((mouse.y - CEIL) / T);
  if (mouse.y > CEIL && mouse.y < GY + 20 && mouse.x > 0 && col >= 0 && col < edLevel.len && !ui.some(b => mouse.x > b.x && mouse.x < b.x + b.w && mouse.y > b.y && mouse.y < b.y + b.h)) {
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.strokeStyle = C.hot; ctx.lineWidth = 2;
    if (['gap', 'ship', 'cube'].includes(edTool)) { rr(col * T - sc, CEIL, T, GY - CEIL + 14, 6); } else if (row >= 0 && row <= 6) rr(col * T - sc, CEIL + (6 - row) * T, T, T, 8); else ctx.beginPath();
    ctx.fill(); ctx.stroke();
  }
  // top strip
  ctx.fillStyle = 'rgba(255,255,255,.7)'; rr(10, 8, 440, 44, 16); ctx.fill();
  txt(edLevel.name + (edDirty ? ' *' : ''), 24, 24, 20, C.pink, null, 'left');
  txt(`${edLevel.len} tiles  •  ${edLevel.objs.length} objects`, 24, 43, 13, C.mauve, null, 'left');
  txt(isTouchUi() ? 'drag = place  •  two fingers or Pan = scroll  •  Undo' : 'click/drag = place  •  right-click = erase  •  ← → / wheel = scroll  •  Ctrl+Z undo  •  0-9 tools', W - 14, 24, TS.small, '#fff', C.plum, 'right');
  btn('◀', 6, 230, 34, 54, () => { edScroll = Math.max(0, edScroll - 6); }, { size: 16, r: 12 });
  btn('▶', W - 40, 230, 34, 54, () => { edScroll = Math.min(Math.max(0, edLevel.len - 20), edScroll + 6); }, { size: 16, r: 12 });
  // bottom bar
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-VX, 430, VW, 110);
  // two big rows (tools, main actions) and a "More" card for everything else, so every button is finger-sized
  const live = ui; if (edMore) ui = [];
  TOOLS.forEach((t, i) => btn((isTouchUi() ? '' : ((i + 1) % 10) + ' ') + t[1], 6 + i * 95, 430, 91, 44, () => { edTool = t[0]; sfx.click(); }, { size: 14, r: 15, on: edTool === t[0], col: t[0] === 'ship' ? C.hot : t[0] === 'cube' ? '#1fa88c' : C.pink }));
  const main = [['↶ Undo', edUndo], ['↷ Redo', edRedo], ['Test', () => { saveTemp(); startLevel(edLevel, 'dash', true); }], ['Check', () => { solver = solveGen_start(); }], ['Save', saveEd], ['More ▸', () => { edMore = true; sfx.panel(true); }]];
  main.forEach((a, i) => btn(a[0], 6 + i * 159, 482, 153, 50, () => { if (i > 1) sfx.click(); a[1](); }, { size: 19, r: 17, off: (i === 0 && !edHist.length) || (i === 1 && !edFuture.length) }));
  ui = live;
  if (edMore) drawEditorMore();
}
let edMore = false;   // the editor's "More" card is open
function drawEditorMore() {
  const bpmSet = d => { edPush(); edLevel.bpm = clamp(Math.round((edLevel.bpm || 110) + d), 70, 160); edDirty = true; if (edPreview) songStart(edLevel, songT); };
  const lenSet = d => { edPush(); edLevel.len = clamp(edLevel.len + d, 24, 400); edRebuild(); };
  const close = () => { edMore = false; sfx.panel(false); };
  ctx.fillStyle = C.dim; ctx.fillRect(-VX, 0, VW, H); ui.push({ x: 0, y: 0, w: W, h: H, bg: true, fn: close });
  const pw = 760, ph = 372, px = (W - pw) / 2, py = (H - ph) / 2;
  ctx.fillStyle = 'rgba(255,255,255,.96)'; rr(px, py, pw, ph, 26); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.blush; ctx.stroke();
  ui.push({ x: px, y: py, w: pw, h: ph, bg: true, fn() {} });
  txt('More', W / 2, py + 34, TS.title, C.pink, null);
  const items = [
    ['Name', edName], ['Theme', () => { edPush(); const i = PALS.findIndex(p => p.join() === edLevel.pal.join()); edLevel.pal = PALS[(i + 1) % PALS.length].slice(); edDirty = true; }], ['Share', edShare], ['Import', edImport],
    ['New level', () => { edMore = false; openEditor(null); }], ['Length −', () => lenSet(-5)], ['Length +', () => lenSet(5)], ['Leave editor', () => { edMore = false; toTitle(); }],
    ['BPM −', () => bpmSet(-2)], [Math.round(edLevel.bpm || 110) + ' BPM', () => {}], ['BPM +', () => bpmSet(2)], ['♪ ' + STYLES[edLevel.style | 0].name, () => { edPush(); edLevel.style = nextStyle(edLevel.style); edDirty = true; if (edPreview) songStart(edLevel, songT); }],
    [edPreview ? '■ Stop music' : '▶ Play music', () => { initAudio(); edPreview = !edPreview; if (edPreview) songStart(edLevel, 0); else songStop(); }], [edLevel.auto === false ? 'Tap each hop' : 'Hold to hop', () => { edPush(); edLevel.auto = edLevel.auto === false; edDirty = true; }], [edLevel.len + ' tiles', () => {}], ['Done', close]];
  items.forEach((it, i) => btn(it[0], px + 24 + (i % 4) * 182, py + 60 + Math.floor(i / 4) * 62, 170, 50, () => { if (it[0] !== 'Done') sfx.click(); it[1](); }, { size: 17, r: 16, on: (it[0] === 'Hold to hop' || it[0] === 'Tap each hop') ? edLevel.auto === false : (it[0] === '■ Stop music') }));
}
function saveTemp() { /* keep working copy as the draft; nothing to do besides rebuild */ buildLevel(edLevel); }
function solveGen_start() { buildLevel(edLevel); state = 'solving'; solverPct = 0; return checkGen(); }
function drawSolving() {
  if (solveDone) { drawBg(tg * 25, theme(.45 + Math.sin(tg * .3) * .3, [0, 1, 2])); } else drawEditor();   // the daily level is cooked from the menu, not the editor
  ctx.fillStyle = 'rgba(60,20,70,.55)'; ctx.fillRect(-VX, 0, VW, H);
  txt(solveDone ? (solveLabel || 'Cooking today\'s level…') : 'Checking if it can be beaten…', W / 2, 220, 34, '#fff', C.plum);
  ctx.fillStyle = 'rgba(255,255,255,.7)'; rr(W / 2 - 220, 260, 440, 22, 11); ctx.fill();
  ctx.fillStyle = C.pink; rr(W / 2 - 220, 260, Math.max(22, 440 * solverPct), 22, 11); ctx.fill();
  btn('Cancel', W / 2 - 70, 312, 140, 46, cancelSolve, { size: 20 });
}

// practice buttons live on the ground strip below the track, so they never steal a jump tap
function practiceHud() {
  if (state !== 'play' && state !== 'dead') return;
  const clip = { x0: 0, y0: GY + 28, x1: W, y1: H }, auto = store.autoCp !== false;
  btn('◆ Place', 22, 468, 126, 44, () => practiceSave(false), { size: 18, clip });
  btn('✕ Undo', 156, 468, 112, 44, practiceUndo, { size: 18, clip });
  btn('Auto ' + (auto ? 'on' : 'off'), 276, 468, 112, 44, () => { store.autoCp = !auto; persist(); sfx.click(); say(store.autoCp ? 'Auto checkpoints on' : 'Auto checkpoints off', 1.2); }, { size: 17, clip, on: auto });
  txt('◆ ' + pcp.length, 412, 491, 22, '#fff', C.plum, 'left');
}
function hud() {
  if (['title', 'room', 'select', 'edit', 'solving'].includes(state)) return;
  const prog = clamp(P.wx / FINISH, 0, 1), bx = W / 2 - 200, by = 20, bw = 400, bh = 14;
  ctx.fillStyle = 'rgba(255,255,255,.6)'; rr(bx, by, bw, bh, 7); ctx.fill();
  const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#ff9ccf'); g.addColorStop(1, '#c86bff');
  ctx.fillStyle = g; rr(bx, by, Math.max(bh, bw * prog), bh, 7); ctx.fill();
  ctx.fillStyle = C.hot; heartPath(bx + bw * prog, by + 7, 10); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  txt(Math.floor(prog * 100) + '%', W / 2, 52, 20, '#fff', C.plum);
  ctx.fillStyle = C.hot; heartPath(34, 32, 12); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  txt(`${got}/${hearts.length}`, 54, 33, 22, '#fff', C.plum, 'left');
  txt(curLevel.name + '  ♪ ' + Math.round(curBpm), 24, 64, 18, '#fff', C.plum, 'left');
  txt('Score ' + scoreNow + (combo >= 2 ? '   x' + (1 + Math.min(combo, 10) * .1).toFixed(1) + ' combo' : ''), W / 2, 80, 18, '#fff', C.plum);
  if (mode === 'dash') { txt('Attempt ' + attempts, W - 84, 33, 20, '#fff', C.plum, 'right'); const b = bestOf(curLevel.id); if (b && !testing) txt('Best ' + b + '%', W - 84, 58, 16, '#fff', C.plum, 'right'); }
  else if (mode === 'practice') { txt('Practice', W - 84, 33, 20, '#fff', C.plum, 'right'); txt('attempt ' + attempts + ' • not saved', W - 84, 58, 16, '#fff', C.plum, 'right'); practiceHud(); }
  else txt('Zen mode', W - 84, 33, 20, '#fff', C.plum, 'right');
  if (testing) txt('TEST • ☰ = back to editor', W - 84, 58, 15, '#fff', C.plum, 'right');
  // menu button (tap twice to leave a run)
  ctx.fillStyle = menuArm > 0 ? 'rgba(255,95,176,.95)' : 'rgba(255,255,255,.7)'; rr(W - 72, 10, 52, 40, 14); ctx.fill();
  ctx.strokeStyle = menuArm > 0 ? '#fff' : '#ff8fc7'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = menuArm > 0 ? '#fff' : C.pink; for (let i = 0; i < 3; i++) { rr(W - 60, 19 + i * 9, 28, 4, 2); ctx.fill(); }
}
function overlays() {
  if (state === 'dead') {
    // the dim eases in and out and stays light, so repeated retries never flash the whole screen (it used to snap from dark back to bright on every restart)
    const fa = clamp(deadT * 4, 0, 1) * clamp((.7 - deadT) * 6, 0, 1);
    ctx.globalAlpha = fa * .45; ctx.fillStyle = C.dim; ctx.fillRect(-VX, 0, VW, H); ctx.globalAlpha = fa;
    txt('Oopsie!', W / 2, 190, 70, C.pink, '#fff'); txt(lastPct + '%  •  tap to retry', W / 2, 250, 26, '#fff', C.plum);
    ctx.globalAlpha = 1;
  } else if (state === 'win') {
    ctx.globalAlpha = clamp(winT * 2, 0, 1); ctx.fillStyle = C.dim; ctx.fillRect(-VX, 0, VW, H);
    txt('Level Complete!', W / 2, 160, 66, C.pink, '#fff');
    txt(`${got}/${hearts.length} hearts` + (mode === 'dash' ? `  •  ${attempts} attempt${attempts > 1 ? 's' : ''}` : mode === 'practice' ? '  •  practice (not saved)' : ''), W / 2, 222, 26, '#fff', C.plum);
    const tacc = judgeN ? Math.round(judgeBase / judgeN) : 100;
    txt(`Score ${scoreNow}   •   Timing ${tacc}%`, W / 2, 262, 28, C.pink, '#fff');
    txt(`Perfect ${judged.PERFECT}   Great ${judged.GREAT}   Good ${judged.GOOD}   Ok ${judged.OK}`, W / 2, 298, 20, '#fff', C.plum);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < winStars ? C.hot : 'rgba(255,255,255,.55)'; heartPath(W / 2 - 52 + i * 52, 340, 17); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    if (winT > 1.2) txt(testing ? 'tap to return to the editor' : 'tap to continue', W / 2, 390, 22, '#fff', C.plum);
    ctx.globalAlpha = 1;
  }
  if (toast.life > 0) {
    ctx.globalAlpha = clamp(toast.life * 2, 0, 1); ctx.fillStyle = 'rgba(80,20,90,.8)'; ctx.font = '700 20px Fredoka,sans-serif';
    // toasts live under the HUD, clear of every result screen and the floor controls (Studio's Flow card runs down to y 132, so there they sit just below it)
    const tw = ctx.measureText(toast.t).width + 40, ty = state === 'room' && studio ? 142 : 100;
    rr(W / 2 - tw / 2, ty, tw, 38, 19); ctx.fill(); txt(toast.t, W / 2, ty + 19, 20, '#fff', null); ctx.globalAlpha = 1;
  }
}
function drawStudioGhost() {   // dashed silhouette that follows the dough, rotated to the orientation that fits best
  if (studioFree || studioCel > 0) return;
  const sh = SHAPES[studioShape]; if (!sh.polys) return;
  const q = sh.polys[studioBestRot] || sh.polys[0], s = studioScale, ok = studioSim >= .84;
  ctx.save(); ctx.translate(studioCx, studioCy); ctx.lineJoin = 'round';
  ctx.fillStyle = ok ? 'rgba(255,201,51,.16)' : 'rgba(176,79,224,.07)';
  ctx.beginPath(); for (let i = 0; i < q.length; i += 2) { if (i) ctx.lineTo(q[i] * s, q[i + 1] * s); else ctx.moveTo(q[0] * s, q[1] * s); }
  ctx.closePath(); ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();   // white halo so the outline reads on the pale room and on the pink dough
  ctx.setLineDash([10, 7]); ctx.lineDashOffset = -tg * 14; ctx.lineWidth = 3.4; ctx.strokeStyle = ok ? '#f0a000' : '#a73ad8'; ctx.stroke();
  ctx.restore();
}
// the Studio's own floor buttons, as [label, width, action, options]; floorBar() lays them out next to the shared ones
function studioControls() {
  return [
    ['■ ' + PRESETS[roomPreset].name, 132, () => { const o = ['clay', 'foam', 'mochi']; setPreset(o[(o.indexOf(roomPreset) + 1) % o.length]); }, { size: 14 }],
    ['Skip ▶', 100, nextShape, { size: 14 }],
    [studioFree ? 'Shapes' : 'Free knead', 112, () => { studioFree = !studioFree; studioHold = 0; studioArmed = false; sfx.click(); }, { size: 14, on: studioFree }],
    ['♪ ' + STYLES[studioStyle].name, 140, () => { studioStyle = nextStyle(studioStyle); studioSong(songT); sfx.click(); }, { size: 13 }],
    ['Smooth', 76, () => { smoothT = 1.6; studioHold = 0; sfx.bloop(0); }, { size: 14 }],   // wipe the dough back to a round ball
  ];
}
function drawStudioUI() {
  const sh = SHAPES[studioShape], starRow = (n, x, y, sz, gap) => { for (let i = 0; i < 3; i++) { ctx.fillStyle = i < n ? C.gold : 'rgba(200,160,200,.45)'; sparklePath(x + i * gap, y, sz); ctx.fill(); } };
  // goal card
  ctx.fillStyle = C.card; rr(84, 70, 262, 74, 18); ctx.fill();
  if (studioFree) { txt('Free knead', 100, 92, 22, C.pink, null, 'left'); txt('no goal — just play', 100, 120, 14, C.mauve, null, 'left'); }
  else {
    txt(sh.name, 100, 90, 22, C.pink, null, 'left'); starRow(store.studio.stars[sh.name] || 0, 112, 118, 9, 24);
    ctx.fillStyle = 'rgba(200,160,220,.4)'; rr(190, 108, 140, 10, 5); ctx.fill();
    ctx.fillStyle = studioSim >= .84 ? C.gold : '#ff7ab8'; rr(190, 108, Math.max(10, 140 * studioSim), 10, 5); ctx.fill();
    txt(Math.round(studioSim * 100) + '%', 332, 90, 17, C.mauve, null, 'right');
    if (studioHold > 0) { ctx.fillStyle = 'rgba(255,201,51,.9)'; rr(100, 130, Math.max(6, 232 * clamp(studioHold / 1.4, 0, 1)), 6, 3); ctx.fill(); }
  }
  // flow card: kneading raises it, and each layer of the song joins as it passes its mark
  ctx.fillStyle = C.card; rr(614, 70, 262, 62, 18); ctx.fill();
  txt('Flow', 630, 88, 17, C.pink, null, 'left');
  ctx.fillStyle = 'rgba(200,160,220,.4)'; rr(684, 80, 176, 12, 6); ctx.fill();
  const fg = ctx.createLinearGradient(684, 0, 860, 0); fg.addColorStop(0, '#ff9ccf'); fg.addColorStop(1, '#c86bff');
  ctx.fillStyle = fg; rr(684, 80, Math.max(12, 176 * flow), 12, 6); ctx.fill();
  [['hats', .12], ['kick', .25], ['bass', .3], ['snare', .4], ['melody', .5]].forEach(([n, th], i) => {
    const lit = flow > th, px = 684 + 176 * th;
    ctx.fillStyle = lit ? C.hot : 'rgba(180,140,190,.6)'; ctx.beginPath(); ctx.arc(px, 96, 3, 0, 7); ctx.fill();
    txt(n, 630 + i * 48, 116, 11, lit ? C.plum : '#b8a0c4', null, 'left');
  });
  if (studioCel > 0) {
    ctx.globalAlpha = clamp(studioCel * 2, 0, 1);
    txt(['Nice!', 'Great!', 'Perfect!'][studioStars - 1], W / 2, 196, 64, C.pink, '#fff'); starRow(studioStars, W / 2 - 44, 252, 14, 44);
    ctx.globalAlpha = 1;
  }
}
function drawRoom() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fff0f8'); g.addColorStop(1, '#e6d8ff');
  ctx.fillStyle = '#f6c6e3'; ctx.fillRect(-30 - VX, -30, VW + 60, H + 60);
  ctx.fillStyle = g; rr(RM.l - 14, RM.t - 14, RM.r - RM.l + 28, RM.b - RM.t + 28, 34); ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
  const vg = ctx.createRadialGradient(W / 2, 250, 120, W / 2, 250, 520); vg.addColorStop(0, 'rgba(255,255,255,.55)'); vg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = vg; ctx.fillRect(RM.l, RM.t, RM.r - RM.l, RM.b - RM.t);
  for (const f of floaters) {
    const x = RM.l + (((f.x + tg * (6 + f.s)) % 800) + 800) % 800, y = RM.t + 20 + ((f.y * 1.1 + Math.sin(tg + f.ph) * 10) % 360);
    ctx.globalAlpha = .55; ctx.fillStyle = f.k === 'h' ? '#fff' : '#fff7b8'; if (f.k === 'h') heartPath(x, y, f.s); else sparklePath(x, y, f.s * 1.3); ctx.fill(); ctx.globalAlpha = 1;
  }
  const fg = ctx.createLinearGradient(0, RM.b, 0, RM.b + 60); fg.addColorStop(0, '#ff9ccf'); fg.addColorStop(1, '#c86bff');
  ctx.fillStyle = fg; rr(RM.l - 14, RM.b, RM.r - RM.l + 28, 88, 20); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(RM.l - 8, RM.b, RM.r - RM.l + 16, 7);
  if (studio && flow > .05) { ctx.fillStyle = 'rgba(255,190,235,' + (.16 * BP * flow).toFixed(3) + ')'; ctx.fillRect(RM.l, RM.t, RM.r - RM.l, RM.b - RM.t); }   // the room pulses with the beat as you build the song
  drawParts(0);
  const pulling = room.grabs.some(g => !g.pin);
  drawSoft(room, 0, { ground: RM.b, open: pulling || room.inds.length > 0, squint: pulling && roomElong > .35 });
  if (studio) drawStudioGhost();
  for (const d of room.inds) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(d.cx, d.cy, d.r, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke(); }
  for (const g of room.grabs) { ctx.fillStyle = g.pin ? C.hot : 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(g.mx, g.my, g.pin ? 8 : 6, 0, 7); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); }
  const liveUi = ui; if (roomPanel) ui = [];   // while a picker is open the floor is dimmed and cannot be pressed
  if (studio) drawStudioUI();
  floorBar();
  ui = liveUi;
  txt(studio ? 'Squish Studio' : PRESETS[roomPreset].name, W / 2, 28, 24, '#fff', C.plum);
  txt(studio ? (isTouchUi() ? 'knead the dough to match the dotted outline  •  hold = pin' : 'knead the dough to match the dotted outline  •  drag = pull  •  press = dent  •  right-click = pin') : isTouchUi() ? 'drag = pull  •  press = dent  •  hold = pin' : 'press inside = dent  •  drag the skin = pull  •  right-click = pin  •  space = hop  •  R reset  •  Esc menu', W / 2, 520, TS.small, '#fff', C.plum);
  drawHolds();
  if (roomPanel) drawPicker();
}

/* ---------- the room's floor bar and pickers ---------- */
let roomPanel = null;   // null | 'skins' | 'hazards': which picker is open
const roomReset = () => { room.reset(480, studio ? 262 : 220); holdCancel(); sfx.bloop(0); };
// lays out [label, width, action, options] items left to right; the shared system buttons sit at the right edge, so every screen has the same escape hatches
function floorBar() {
  const y = 464, h = 38, gap = 6, ctrl = { size: 14 }, clip = { x0: 0, y0: RM.b + 3, x1: W, y1: H };   // clip: touch growth may not climb into the play area
  const left = [['‹ Back', 78, () => { sfx.back(); toTitle(); }, ctrl]];
  if (studio) left.push(...studioControls());
  else ['jelly', 'slime', 'mochi', 'dough', 'foam'].forEach((m, i) => left.push([(isTouchUi() ? '' : (i + 1) + ' ') + PRESETS[m].name, 88, () => setPreset(m), { size: 14, on: roomPreset === m }]));
  const right = [['Skins', 84, () => { roomPanel = 'skins'; sfx.panel(true); }, ctrl]];
  if (!studio) right.push(['Hazards', 96, () => { roomPanel = 'hazards'; sfx.panel(true); }, ctrl]);
  right.push(['Hop', 64, () => { initAudio(); roomHop(); }, ctrl], ['Reset', 76, roomReset, ctrl]);
  let x = 10; for (const [label, w, fn, o] of left) { btn(label, x, y, w, h, fn, Object.assign({ r: 15, clip }, o)); x += w + gap; }
  x = W - 10 - right.reduce((n, it) => n + it[1] + gap, -gap); for (const [label, w, fn, o] of right) { btn(label, x, y, w, h, fn, Object.assign({ r: 15, clip }, o)); x += w + gap; }
}
// a big, finger-sized chooser for jelly skins and hazard looks (locked ones say what unlocks them)
function drawPicker() {
  const isSk = roomPanel === 'skins', items = isSk ? SKINS : HAZ, cols = isSk ? 3 : 5, cw = 128, ch = 136, rows = Math.ceil(items.length / cols);
  const pw = cols * cw + 40, ph = rows * ch + 134, px = (W - pw) / 2, py = (H - ph) / 2 - 6, close = () => { roomPanel = null; sfx.panel(false); };
  ctx.fillStyle = C.dim; ctx.fillRect(-VX, 0, VW, H); ui.push({ x: 0, y: 0, w: W, h: H, bg: true, fn: close });
  ctx.fillStyle = 'rgba(255,255,255,.96)'; rr(px, py, pw, ph, 26); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.blush; ctx.stroke();
  ui.push({ x: px, y: py, w: pw, h: ph, bg: true, fn: () => {} });   // taps on the card itself do nothing (they must not fall through to the backdrop)
  txt(isSk ? 'Jelly skins' : 'Hazards', W / 2, py + 34, 26, C.pink, null);
  items.forEach((it, i) => {
    const cx = px + 20 + (i % cols) * cw + cw / 2, top = py + 62 + Math.floor(i / cols) * ch, cy = top + 50;
    const open = isSk ? skinOpen(i) : hazOpen(i), on = open && (isSk ? (store.skin | 0) === i : curHaz() === it);
    ctx.fillStyle = on ? 'rgba(255,214,236,.9)' : 'rgba(245,235,250,.8)'; rr(cx - cw / 2 + 4, top, cw - 8, ch - 12, 18); ctx.fill();
    if (on) { ctx.lineWidth = 4; ctx.strokeStyle = C.hot; ctx.stroke(); }
    ctx.save(); if (!open) ctx.globalAlpha = .45;
    if (isSk) {
      const g = ctx.createLinearGradient(0, cy - 30, 0, cy + 30); g.addColorStop(0, it.g[0]); g.addColorStop(.5, it.g[1]); g.addColorStop(1, it.g[2]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, 7); ctx.fill(); ctx.lineWidth = 3.4; ctx.strokeStyle = it.rim; ctx.stroke();
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(cx - 9, cy - 2, 3.6, 5, 0, 0, 7); ctx.ellipse(cx + 9, cy - 2, 3.6, 5, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy + 4, 5, .15 * Math.PI, .85 * Math.PI); ctx.stroke();
    } else { if (!SPR['hzi' + i]) mkSprite('hzi' + i, T, 56, 2, () => it.paint(0, TH[0])); ctx.drawImage(SPR['hzi' + i], cx - 31, cy - 38, 62, 72.3); }
    ctx.restore();
    txt(it.name, cx, top + 92, 15, open ? '#b03a82' : '#9a86a8', null);
    const sub = !open ? `beat ${it.need} level${it.need > 1 ? 's' : ''}` : (it.note || '');
    if (sub) txt(sub, cx, top + 112, 12, C.mauve, null);
    ui.push({ x: cx - cw / 2 + 4, y: top, w: cw - 8, h: ch - 12, fn: () => { if (open) { if (isSk) store.skin = i; else store.haz = i; persist(); roomPanel = null; sfx.click(); } else { sfx.error(); say(`Beat ${it.need} level${it.need > 1 ? 's' : ''} to unlock ${it.name}`); } } });
  });
  btn('Done', W / 2 - 62, py + ph - 66, 124, 48, close, { size: 20 });
}

function draw() {
  ctx.setTransform(cv.width / VW, 0, 0, cv.height / H, VX * cv.width / VW, 0);
  BP = beatPulse();
  const prevUi = ui; ui = [];
  if (state === 'room') { ctx.save(); drawRoom(); ctx.restore(); overlays(); return; }
  if (state === 'select') { drawSelect(); overlays(); return; }
  if (state === 'settings') { drawSettings(); overlays(); return; }
  if (state === 'edit') { ui = prevUi; ui = []; drawEditor(); overlays(); return; }
  if (state === 'solving') { drawSolving(); return; }
  const scroll = P.wx - (state === 'title' ? 64 : PX), th = theme(clamp(P.wx / FINISH, 0, 1), curLevel.pal);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * shake * 20, (Math.random() - .5) * shake * 20);
  drawBg(scroll, th); drawWorld(scroll, th);
  drawParts(scroll);
  if (state !== 'dead') {
    const ship = P.form === 'ship';
    if (ship) drawShipBack(scroll);
    const bb0 = jelly.bounds(), q = SQ_, px = bb0.cx - scroll, sy = 1 + q.s, sx = 1 / Math.sqrt(sy);
    if (!ship && !P.grounded && P.coy > 0 && P.ledgeX != null && bb0.cx > P.ledgeX + 3) drawStrand(scroll, bb0);
    drawSoft(jelly, scroll, { rot: ship ? 0 : q.rot, sx: ship ? 1 : sx, sy: ship ? 1 : sy, ground: GY, alpha: ghost > 0 ? .45 + .2 * Math.sin(tg * 20) : 1, happy: state === 'win', open: (!P.grounded && P.vy < -100 && !ship) || (ship && inp.held) });
    if (ship) drawShipFront(scroll);
  }
  ctx.restore();
  hud();
  if (state === 'title') drawTitle();
  overlays();
}
