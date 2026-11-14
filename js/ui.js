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
  txt('squish  •  puff  •  dash', W / 2, 124, 22, '#fff', C.plum);
  // one big button does the obvious thing: start, or carry on with the next level you have not beaten; everything else is grouped under it
  const nx = nextLevel(), fresh = !OFFICIAL.some(l => bestOf(l.id) > 0), beaten = OFFICIAL.filter(l => bestOf(l.id) >= 100).length;
  btn(fresh ? 'Play' : 'Continue', W / 2 - 230, 146, 460, 96, () => { initAudio(); sfx.click(); playNext(); }, { sub: fresh ? 'start with the Welcome level' : 'next up: ' + nx.name, size: 38, ssize: 17, fill: 'rgba(255,255,255,.98)', on: true, r: 26 });
  const row = (y, items) => items.forEach((m, i) => btn(m[0], W / 2 - 330 + i * 230, y, 200, 74, () => { initAudio(); sfx.click(); m[2](); }, { sub: m[1], size: 21, ssize: 13 }));
  row(256, [['Levels', 'pick any • daily level', () => { pickFor = 'play'; mode = 'dash'; state = 'select'; }], ['Zen', 'no oopsies, just vibes', () => { pickFor = 'play'; mode = 'zen'; state = 'select'; }],
    ['Practice', 'learn with checkpoints', () => { pickFor = 'play'; mode = 'practice'; state = 'select'; }]]);
  txt('SQUISH AROUND', W / 2, 352, 14, '#fff', C.plum);
  row(364, [['Squish Room', 'poke, drag & fling', enterRoom], ['Squish Studio', 'knead shapes, make music', () => startStudio()], ['Level Creator', 'build & share yours', () => { pickFor = 'edit'; state = 'select'; }]]);
  txt(beaten + ' / ' + OFFICIAL.length + ' levels beaten', W / 2, 470, 18, '#fff', C.plum);
  btn('⚙ Settings', W - 148, 14, 132, 40, () => { sfx.click(); state = 'settings'; }, { size: 17, r: 16 });
  walletChip(16, 14, 96, 40);
  txt(isTouchUi() ? 'tap to choose  •  headphones recommended' : 'Enter to play  •  1-6 shortcuts  •  M to mute  •  headphones recommended', W / 2, 516, TS.small, '#fff', C.plum);
}
// the next official level the player has not beaten (the first level if they are all done, so Play always does something)
function nextLevel() { return OFFICIAL.find(l => bestOf(l.id) < 100) || OFFICIAL[1] || OFFICIAL[0]; }
function playNext() { const L = nextLevel(); pickFor = 'play'; mode = 'dash'; selWorld = L.world; selTab = 0; playLevel(L); }
let dailyL = null;
function selList() { return selTab === 0 ? OFFICIAL : store.custom; }

/* ---------- sharing and the daily level ---------- */
// a level becomes a short text code anyone can paste in; codes from other people are untrusted, so every field is checked and clamped on the way in
function levelCode(L) {
  const o = { n: String(L.name || 'Level').slice(0, 24), p: L.pal, l: L.len, b: L.bpm, y: L.coy || DEF_COY, s: L.style, a: L.auto ? 1 : 0, f: (L.puff ? 1 : 0) | (L.bounce ? 2 : 0), o: L.objs.map(q => [OBJ_TYPES.indexOf(q.t), q.x, q.y || 0, q.to === 'ship' ? 1 : 0]) };
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
      const ob = { t, x: fin(q[1], 0, 2000, 0) }; if (t !== 'gap' && t !== 'portal' && t !== 'gate') ob.y = Math.round(fin(q[2], 0, 6, 0)); if (t === 'heart') ob.y = fin(q[2], 0, 6, 0); if (t === 'portal') ob.to = q[3] ? 'ship' : 'cube';
      objs.push(ob);
    }
    const pal = Array.isArray(o.p) ? o.p.slice(0, 4).map(v => Math.round(fin(v, 0, TH.length - 1, 0))) : [0, 1, 2];
    return { id: 'c' + Date.now() + Math.floor(Math.random() * 1000), name: cleanName(o.n, 'Shared level'), stars: 0, pal: pal.length ? pal : [0, 1, 2], len: fin(o.l, 40, 2100, 200), objs, coy: fin(o.y, .03, .12, DEF_COY), bpm: fin(o.b, 60, 180, BASE_BPM), style: Math.round(fin(o.s, 0, SONG_N - 1, 0)), auto: !!o.a, puff: !!(o.f & 1), bounce: !!(o.f & 2), custom: true };
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
  if (official) {   // one chip per world (a row of 4 with arrows once there are more than 5 worlds), then a banner for the chosen one
    const many = WORLDS.length > 5, vis = many ? 4 : WORLDS.length, sp = many ? 213 : 187, x0 = many ? 56 : 14;
    if (wi !== worldSeen) { worldSeen = wi; if (wi < worldOff) worldOff = wi; else if (wi >= worldOff + vis) worldOff = wi - vis + 1; }   // a newly chosen world scrolls into view (the arrows can still move the row away from it)
    worldOff = clamp(worldOff, 0, Math.max(0, WORLDS.length - vis));
    if (many) { btn('◀', 14, 116, 36, 50, () => { worldOff = Math.max(0, worldOff - 1); sfx.tap(); }, { size: 18, r: 15, off: worldOff === 0 }); btn('▶', 910, 116, 36, 50, () => { worldOff = Math.min(WORLDS.length - vis, worldOff + 1); sfx.tap(); }, { size: 18, r: 15, off: worldOff >= WORLDS.length - vis }); }
    WORLDS.forEach((w, i) => { if (i >= worldOff && i < worldOff + vis) btn((i + 1) + '  ' + w.name, x0 + (i - worldOff) * sp, 116, sp - 6, 50, () => { selWorld = i; sfx.tap(); }, { size: 15, r: 15, on: i === wi, sub: worldDone(i) + ' / ' + worldTotal(i) + ' beaten', ssize: 13 }); });
    txt('World ' + (wi + 1) + ' · ' + WORLDS[wi].name, 24, 186, 28, '#fff', C.plum, 'left'); txt(WORLDS[wi].tag, 24 + 8, 214, TS.small, '#fff', C.plum, 'left');
  }
  const list = (official ? selList().filter(l => l.world === wi) : selList().slice()), cards = [];
  if (pickFor === 'edit' && selTab === 1) cards.push({ nw: true });
  if (pickFor === 'edit' && selTab === 1 && edLevel && edDirty) cards.push({ cont: true });
  list.forEach(l => cards.push({ l }));
  const per = official ? 8 : 15, pages = Math.max(1, Math.ceil(cards.length / per));   // official: two rows of four per page, so a world can hold any number of levels
  if (selKey !== selTab + ':' + wi) { selKey = selTab + ':' + wi; const at = official && pickFor === 'play' ? list.indexOf(nextLevel()) : -1; selPage = at >= 0 ? Math.floor(at / per) : 0; }   // opening a world lands on the page that has the level Continue would start
  selPage = clamp(selPage, 0, pages - 1);
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
    else if (official && pickFor === 'play' && L === nextLevel()) {   // the level Continue would start: a pulsing outline and a tag
      ctx.save(); ctx.globalAlpha = .55 + .35 * Math.sin(tg * 5); ctx.lineWidth = 4; ctx.strokeStyle = C.gold; rr(x - 3, y - 3, w + 6, h + 6, 25); ctx.stroke(); ctx.restore();
      ctx.fillStyle = C.gold; rr(x + w - 82, y - 9, 76, 22, 11); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); txt('NEXT UP', x + w - 44, y + 3, TS.min, '#fff', null);
    }
    if (official) {   // power badges: which new move a level asks for
      let bx = x + 10; for (const [name, col] of [['SQUISH', '#c86bff'], ['PUFF', '#4aa8ff'], ['BOUNCE', '#ff8a3d']]) {
        if (name === 'SQUISH' ? !/\bf[ls]\d/.test(L.script || '') : name === 'PUFF' ? !L.puff : !L.bounce) continue;
        const bw = name.length * 8 + 18; ctx.fillStyle = col; rr(bx, y - 9, bw, 22, 11); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); txt(name, bx + bw / 2, y + 3, TS.min, '#fff', null); bx += bw + 6;
      }
    }
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
  resetArm = 0; store.best = {}; store.score = {}; store.rate = {}; store.studio = { stars: {} }; store.skin = 0; store.haz = 0; store.seenOrb = false; store.seenStudio = false; store.seenRoom = false; store.goals = null; store.wallet = 0; store.hb = {}; store.decor = { owned: {}, placed: {}, tier: {}, dye: {}, dyes: {} }; store.pet = null; store.room = { walls: { blush: true }, floors: { candy: true }, size: 0, wall: 'blush', floor: 'candy' }; persist(); say('Progress reset', 2.5);
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
    if (COLUMN_TOOLS.includes(edTool)) { rr(col * T - sc, CEIL, T, GY - CEIL + 14, 6); } else if (row >= 0 && row <= 6) rr(col * T - sc, CEIL + (6 - row) * T, T, T, 8); else ctx.beginPath();
    ctx.fill(); ctx.stroke();
  }
  // top strip
  ctx.fillStyle = 'rgba(255,255,255,.7)'; rr(10, 8, 440, 44, 16); ctx.fill();
  txt(edLevel.name + (edDirty ? ' *' : ''), 24, 24, 20, C.pink, null, 'left');
  txt(`${edLevel.len} tiles  •  ${edLevel.objs.length} objects`, 24, 43, 13, C.mauve, null, 'left');
  txt(isTouchUi() ? 'drag = place  •  two fingers or Pan = scroll  •  Undo' : 'click/drag = place  •  right-click = erase  •  ← → / wheel = scroll  •  Ctrl+Z undo  •  0-9 tools', W - 14, 24, TS.small, '#fff', C.plum, 'right');
  { const note = edPowerNote(edLevel), tip = TOOL_TIPS[edTool] || '', h = note ? 50 : 28;   // what the picked tool does (and which powers this level has switched on)
    ctx.fillStyle = 'rgba(255,255,255,.7)'; rr(10, 58, note ? 560 : 440, h, 14); ctx.fill(); txt(tip, 24, 72, 13, C.plum, null, 'left'); if (note) txt(note, 24, 92, 12, C.mauve, null, 'left'); }
  btn('◀', 6, 230, 34, 54, () => { edScroll = Math.max(0, edScroll - 6); }, { size: 16, r: 12 });
  btn('▶', W - 40, 230, 34, 54, () => { edScroll = Math.min(Math.max(0, edLevel.len - 20), edScroll + 6); }, { size: 16, r: 12 });
  // bottom bar
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-VX, 430, VW, 110);
  // two big rows (tools, main actions) and a "More" card for everything else, so every button is finger-sized
  const live = ui; if (edMore) ui = [];
  { const tw = Math.floor((W - 12) / TOOLS.length);   // the tools share the row evenly, however many there are
    TOOLS.forEach((t, i) => btn((isTouchUi() || i > 9 ? '' : ((i + 1) % 10) + ' ') + t[1], 6 + i * tw, 430, tw - 4, 44, () => { edTool = t[0]; sfx.click(); }, { size: 13, r: 15, on: edTool === t[0], col: t[0] === 'ship' ? C.hot : t[0] === 'cube' ? '#1fa88c' : t[0] === 'gate' ? '#a04ad8' : C.pink })); }
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
    [edPreview ? '■ Stop music' : '▶ Play music', () => { initAudio(); edPreview = !edPreview; if (edPreview) songStart(edLevel, 0); else songStop(); }], [edLevel.auto === false ? 'Tap each hop' : 'Hold to hop', () => { edPush(); edLevel.auto = edLevel.auto === false; edDirty = true; }], // the powers a level allows (gummy gates always work; they need the Gate tool): Puff = hold Squish in the air to float, Bounce = tap just before landing to spring higher
    ['Puff: ' + (edLevel.puff ? 'on' : 'off'), () => { edPush(); edLevel.puff = !edLevel.puff; edRebuild(); }, !!edLevel.puff], ['Bounce: ' + (edLevel.bounce ? 'on' : 'off'), () => { edPush(); edLevel.bounce = !edLevel.bounce; edRebuild(); }, !!edLevel.bounce],
    [edLevel.len + ' tiles', () => {}], null, null, ['Done', close]];
  items.forEach((it, i) => it && btn(it[0], px + 24 + (i % 4) * 182, py + 60 + Math.floor(i / 4) * 62, 170, 50, () => { if (it[0] !== 'Done') sfx.click(); it[1](); }, { size: 17, r: 16, on: it[2] !== undefined ? it[2] : (it[0] === 'Hold to hop' || it[0] === 'Tap each hop') ? edLevel.auto === false : (it[0] === '■ Stop music') }));
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
// the bounce cue: while the jelly falls toward something to land on, in a level with the bounce, a ring closes in on the landing spot and turns gold for the last BOUNCE_WINDOW seconds, when a tap springs it up high
const BOUNCE_WINDOW = .12;   // the jump buffer (inp.buf): a tap this close to landing is remembered and fires on the landing
function landingIn() {   // seconds until the falling jelly touches down, and where; null when nothing is below it
  const feet = P.y + P.h, cx = P.wx + P.w / 2; let top = Infinity;
  for (const s of solids) if (!s.ceil && cx > s.x0 && cx < s.x1 && s.top >= feet - 2 && s.top < top) top = s.top;
  if (top === Infinity || P.vy <= 0) return null;
  const d = top - feet; return { t: (-P.vy + Math.sqrt(P.vy * P.vy + 2 * G * d)) / G, top };
}
function bounceRing(scroll, bb) {
  if (!hasBounce || state !== 'play' || P.form !== 'cube' || P.grounded) return;
  const L = landingIn(); if (!L) return;
  const ok = L.t <= BOUNCE_WINDOW, rx = 22 + clamp(L.t, 0, .6) * 170, x = bb.cx - scroll;
  ctx.save(); ctx.lineWidth = ok ? 5 : 3; ctx.strokeStyle = ok ? C.gold : 'rgba(255,255,255,.85)'; ctx.globalAlpha = ok ? 1 : .8;
  ctx.beginPath(); ctx.ellipse(x, L.top + 2, rx, rx * .22, 0, 0, 7); ctx.stroke(); if (ok) { ctx.fillStyle = 'rgba(255,215,94,.4)'; ctx.fill(); } ctx.restore();
}
const SQB = { x: W - 176, y: 440, w: 152, h: 78 };   // the on-screen Squish button (levels with gummy gates): hold it with one thumb, tap anywhere else to jump with the other
function squishButton() {
  const on = inp.flat, b = SQB, g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  g.addColorStop(0, on ? '#ff5fb0' : '#ffffff'); g.addColorStop(1, on ? '#c86bff' : '#ffd1ec');
  ctx.save(); ctx.globalAlpha = .94; ctx.fillStyle = g; rr(b.x, b.y + (on ? 5 : 0), b.w, b.h - (on ? 5 : 0), 24); ctx.fill();
  ctx.strokeStyle = on ? '#fff' : '#ff8fc7'; ctx.lineWidth = 4; ctx.stroke(); ctx.globalAlpha = 1;
  txt('SQUISH', b.x + b.w / 2, b.y + 32 + (on ? 5 : 0), 28, on ? '#fff' : C.pink, on ? C.plum : '#fff');
  const how = hasGate && hasPuff ? 'ground: flat · air: float' : hasPuff ? 'hold in air: float' : isTouchUi() ? 'hold to flatten' : 'hold S / ↓ / Shift';
  txt(how, b.x + b.w / 2, b.y + (hasPuff ? 53 : 58) + (on ? 5 : 0), hasPuff ? 13 : 15, on ? '#fff' : C.plum);
  if (hasPuff) { const my = b.y + b.h - 14 + (on ? 3 : 0); ctx.fillStyle = 'rgba(120,30,90,.25)'; rr(b.x + 20, my, b.w - 40, 6, 3); ctx.fill(); ctx.fillStyle = on ? '#fff' : C.pink; rr(b.x + 20, my, Math.max(6, (b.w - 40) * clamp(P.puff / PUFF_T, 0, 1)), 6, 3); ctx.fill(); }   // the puff meter: how much float is left this hop
  ctx.restore();
}
function hud() {
  if (['title', 'room', 'select', 'edit', 'solving'].includes(state)) return;
  if (hasSqueeze && (state === 'play' || state === 'dead')) squishButton();
  const prog = clamp(P.wx / FINISH, 0, 1), bx = W / 2 - 200, by = 20, bw = 400, bh = 14;
  ctx.fillStyle = 'rgba(255,255,255,.6)'; rr(bx, by, bw, bh, 7); ctx.fill();
  const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#ff9ccf'); g.addColorStop(1, '#c86bff');
  ctx.fillStyle = g; rr(bx, by, Math.max(bh, bw * prog), bh, 7); ctx.fill();
  ctx.fillStyle = C.hot; heartPath(bx + bw * prog, by + 7, 10); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  // three soft pills, each with one job: hearts (left), progress + score (centre, under the bar), attempt + best (right, beside the menu)
  const pill = (x, y, w, h, fill) => { ctx.fillStyle = fill || 'rgba(255,255,255,.58)'; rr(x, y, w, h, h / 2); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke(); };
  pill(14, 12, 116, 40); ctx.fillStyle = C.hot; heartPath(38, 32, 12); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  txt(`${got}/${hearts.length}`, 58, 33, 22, C.plum, null, 'left');
  txt(curLevel.name + '  ♪ ' + Math.round(curBpm), 22, 70, 17, '#fff', C.plum, 'left');
  pill(W / 2 - 124, 42, 248, 36); txt(Math.floor(prog * 100) + '%', W / 2 - 76, 61, 21, C.pink, '#fff'); txt('Score ' + scoreNow, W / 2 + 36, 61, 17, C.plum, null);
  if (combo >= 2) { const pop = 1 + .08 * Math.sin(tg * 14); ctx.save(); ctx.translate(W / 2 - 192, 60); ctx.scale(pop, pop); pill(-58, -16, 116, 32, 'rgba(255,95,176,.92)'); txt('x' + (1 + Math.min(combo, 10) * .1).toFixed(1) + ' combo', 0, 1, 16, '#fff', null); ctx.restore(); }   // beside the score pill, clear of the tips that appear under it
  const rp = (a, b) => { pill(W - 268, 12, 186, 40); txt(a, W - 175, 27, 18, C.plum, null); txt(b, W - 175, 44, 13, C.mauve, null); };
  if (testing) rp('TEST', '☰ = back to editor');
  else if (mode === 'dash') { const b = bestOf(curLevel.id); rp('Attempt ' + attempts, b ? 'Best ' + b + '%' : 'first try!'); }
  else if (mode === 'practice') { rp('Practice', 'attempt ' + attempts + ' • not saved'); practiceHud(); }
  else rp('Zen mode', 'no oopsies');
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
    // how far you got, against your best: a bar with a marker, so every try shows whether it was progress
    const best = Math.max(bestOf(curLevel.id), lastPct), isBest = mode === 'dash' && !testing && lastPct >= best && lastPct > 0, bx = W / 2 - 190, by = 232, bw = 380;
    txt('Oopsie!', W / 2, 180, 64, C.pink, '#fff');
    ctx.fillStyle = 'rgba(255,255,255,.7)'; rr(bx, by, bw, 22, 11); ctx.fill();
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#ff9ccf'); g.addColorStop(1, '#c86bff'); ctx.fillStyle = g; rr(bx, by, Math.max(22, bw * lastPct / 100), 22, 11); ctx.fill();
    if (!testing && best > lastPct) { ctx.fillStyle = C.gold; rr(bx + bw * best / 100 - 3, by - 6, 6, 34, 3); ctx.fill(); txt('best ' + best + '%', bx + bw * best / 100, by + 46, 15, '#fff', C.plum); }
    txt(lastPct + '%', bx + Math.max(0, bw * lastPct / 100 - 24), by - 20, 26, '#fff', C.plum, 'left');
    if (isBest) txt('NEW BEST!', W / 2, by + 52, 24, C.gold, '#fff');
    txt('tap to retry', W / 2, by + 92, 22, '#fff', C.plum);
    ctx.globalAlpha = 1;
  } else if (state === 'win') {
    ctx.globalAlpha = clamp(winT * 2, 0, 1); ctx.fillStyle = C.dim; ctx.fillRect(-VX, 0, VW, H);
    const cx = W / 2, cy0 = 142, cw = 500, ch = 360, ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3), back = t => { t = clamp(t, 0, 1); const c = 1.8; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
    ctx.save(); ctx.translate(cx, cy0 + ch / 2); const pop = .92 + .08 * back(winT * 2.2); ctx.scale(pop, pop); ctx.translate(-cx, -(cy0 + ch / 2));   // the card pops in
    ctx.fillStyle = 'rgba(255,255,255,.95)'; rr(cx - cw / 2, cy0, cw, ch, 32); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.blush; ctx.stroke();
    txt('Level Complete!', cx, cy0 + 40, 42, C.pink, '#fff');
    txt(curLevel.name + (mode === 'dash' && !testing ? '  ·  ' + attempts + ' attempt' + (attempts > 1 ? 's' : '') : mode === 'practice' ? '  ·  practice (not saved)' : ''), cx, cy0 + 76, 19, C.mauve, null);
    const tags = []; if (winInfo.first) tags.push(['FIRST CLEAR', C.gold]); if (winInfo.bestScore) tags.push(['NEW BEST SCORE', '#ff5fb0']); if (winInfo.bestStars) tags.push(['BEST RATING', '#b45cf0']);
    { let tw = tags.map(([s]) => s.length * 9 + 24), tot = tw.reduce((a, b) => a + b + 8, -8), x = cx - tot / 2; tags.forEach(([s, col], i) => { const a = ease((winT - .3 - i * .12) / .3); ctx.globalAlpha *= a; ctx.fillStyle = col; rr(x, cy0 + 94 + (1 - a) * 8, tw[i], 24, 12); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); txt(s, x + tw[i] / 2, cy0 + 107 + (1 - a) * 8, 13, '#fff', null); x += tw[i] + 8; ctx.globalAlpha = clamp(winT * 2, 0, 1); }); }
    for (let i = 0; i < 3; i++) {   // the rhythm rating: one heart per star, popping in one after another as the bells ring
      const earned = i < winStars, s = earned ? Math.max(.001, back((winT - .5 - i * .22) / .3)) : 1;
      ctx.save(); ctx.translate(cx - 70 + i * 70, cy0 + 168); ctx.scale(s, s); ctx.fillStyle = earned ? C.hot : 'rgba(200,160,220,.4)'; heartPath(0, 0, 27); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
    }
    const tacc = judgeN ? Math.round(judgeBase / judgeN) : 100, cu = ease((winT - .35) / .9);   // numbers count up
    [['HEARTS', Math.round(got * cu) + '/' + hearts.length], ['SCORE', String(Math.round(scoreNow * cu))], ['TIMING', Math.round(tacc * cu) + '%']].forEach(([lab, val], i) => {
      const x = cx - 224 + i * 154; ctx.fillStyle = 'rgba(255,238,248,.95)'; rr(x, cy0 + 214, 140, 76, 18); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.blush; ctx.stroke();
      txt(lab, x + 70, cy0 + 236, 13, C.mauve, null); txt(val, x + 70, cy0 + 266, 30, C.pink, null);
    });
    { const gr = [['Perfect', judged.PERFECT, 'PERFECT'], ['Great', judged.GREAT, 'GREAT'], ['Good', judged.GOOD, 'GOOD'], ['Ok', judged.OK, 'OK']];   // timing breakdown, in the colours the jump judge uses in the run
      gr.forEach(([nm, n, k], i) => { const x = cx - 220 + i * 111; ctx.fillStyle = GRADES[k][1]; ctx.beginPath(); ctx.arc(x + 8, cy0 + 314, 7, 0, 7); ctx.fill(); txt(nm + ' ' + n, x + 20, cy0 + 315, 15, C.plum, null, 'left'); }); }
    if (winInfo.earned > 0) { const a = ease((winT - 1.1) / .4); ctx.globalAlpha *= a; txt('♥ +' + winInfo.earned + ' for your room  (' + winInfo.parts.join(', ') + ')', cx, cy0 + 338, 14, C.hot, null); ctx.globalAlpha = clamp(winT * 2, 0, 1); }
    else if (!winInfo.saved && mode === 'dash' && !testing) txt('Chill pace: score and hearts are not saved', cx, cy0 + 338, 13, C.mauve, null);
    ctx.restore();
    if (store.pet && !testing && winT > .5) {   // your pet cheers beside the card: a little bob for one heart, hops for two, and jumping with hearts for three
      const a = clamp((winT - .5) * 3, 0, 1), s3 = winStars >= 3, px = 138, py = cy0 + ch - 8, hop = s3 ? Math.abs(Math.sin(tg * 5)) * 30 : winStars === 2 ? Math.max(0, Math.sin(tg * 3)) * 14 : Math.max(0, Math.sin(tg * 2.2)) * 4;
      ctx.globalAlpha = a; drawPet(store.pet, px, py, 1.15, tg, { flip: 1, hop, look: 1, happy: winStars >= 2 });
      if (s3) for (let k = 0; k < 3; k++) { const ph = (tg * .8 + k / 3) % 1; ctx.globalAlpha = a * (1 - ph); ctx.fillStyle = C.hot; heartPath(px + (k - 1) * 20 + Math.sin(ph * 6 + k) * 6, py - 120 - ph * 70, 8); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    if (winT > 1.2) { ctx.globalAlpha = .6 + .4 * Math.sin(tg * 4); txt(testing ? 'tap to return to the editor' : 'tap to continue', cx, cy0 + ch + 24, 22, '#fff', C.plum); }
    ctx.globalAlpha = 1;
  }
  if (toast.life > 0 && roomPanel !== 'goals') {   // (not over the goals card: its first row sits where toasts do)
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
  const wl = studio ? WALLS[0] : wallOf(), fl = studio ? FLOORS[0] : floorOf();   // the Studio keeps the plain pink room
  ctx.fillStyle = wl.out; ctx.fillRect(-30 - VX, -30, VW + 60, H + 60);
  rr(RM.l - 14, RM.t - 14, RM.r - RM.l + 28, RM.b - RM.t + 28, 34); ctx.save(); ctx.clip(); paintWall(wl, RM.l - 14, RM.t - 14, RM.r - RM.l + 28, RM.b - RM.t + 28); ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
  if (wl.vig) { const vg = ctx.createRadialGradient(W / 2, 250, 120, W / 2, 250, 520); vg.addColorStop(0, `rgba(255,255,255,${wl.vig})`); vg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = vg; ctx.fillRect(RM.l, RM.t, RM.r - RM.l, RM.b - RM.t); }
  for (const f of floaters) {
    const x = RM.l + (((f.x + tg * (6 + f.s)) % 800) + 800) % 800, y = RM.t + 20 + ((f.y * 1.1 + Math.sin(tg + f.ph) * 10) % 360);
    ctx.globalAlpha = .55; ctx.fillStyle = f.k === 'h' ? '#fff' : '#fff7b8'; if (f.k === 'h') heartPath(x, y, f.s); else sparklePath(x, y, f.s * 1.3); ctx.fill(); ctx.globalAlpha = 1;
  }
  rr(RM.l - 14, RM.b, RM.r - RM.l + 28, 88, 20); ctx.save(); ctx.clip(); paintFloor(fl, RM.l - 14, RM.b, RM.r - RM.l + 28, 88); ctx.restore();
  ctx.fillStyle = '#fff'; ctx.fillRect(RM.l - 8, RM.b, RM.r - RM.l + 16, 7);
  if (studio && flow > .05) { ctx.fillStyle = 'rgba(255,190,235,' + (.16 * BP * flow).toFixed(3) + ')'; ctx.fillRect(RM.l, RM.t, RM.r - RM.l, RM.b - RM.t); }   // the room pulses with the beat as you build the song
  if (!studio) { drawDecor();
    if (store.pet) { const ph = petHopY(); drawPet(store.pet, PA.x, RM.b - 3, .95, tg, { flip: PA.face, hop: PA.asleep ? 0 : (PA.mode === 'idle' && !PA.yo ? Math.max(0, Math.sin(tg * 2.2)) * 3 : ph), look: PA.look, sleep: PA.asleep, happy: PA.cheer > 0 });   // the pet wanders the room (petStep); a heart floats over it while it has a gift for you
      if (PA.asleep) for (let i = 0; i < 2; i++) { const k = (tg * .5 + i * .5) % 1; ctx.globalAlpha = 1 - k; txt('z', PA.x + 22 + k * 14, RM.b - 96 - k * 30, 14 + i * 4, '#fff', C.plum); ctx.globalAlpha = 1; }
      if (store.pet.day !== dayKey()) { const by = RM.b - 118 - ph + Math.sin(tg * 3) * 5; ctx.fillStyle = C.hot; heartPath(PA.x, by, 11); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); } } }
  drawParts(0);
  const pulling = room.grabs.some(g => !g.pin);
  drawSoft(room, 0, { ground: RM.b, open: pulling || room.inds.length > 0, squint: pulling && roomElong > .35 });
  if (studio) drawStudioGhost();
  for (const d of room.inds) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(d.cx, d.cy, d.r, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke(); }
  for (const g of room.grabs) { ctx.fillStyle = g.pin ? C.hot : 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(g.mx, g.my, g.pin ? 8 : 6, 0, 7); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); }
  const liveUi = ui; if (roomPanel) ui = [];   // while a picker is open the floor is dimmed and cannot be pressed
  if (studio) drawStudioUI();
  floorBar();
  if (!studio) { btn('★ ' + goalsDone() + '/' + GOALS.length, RM.l + 8, RM.t + 8, 116, 42, () => { roomPanel = 'goals'; sfx.panel(true); }, { size: 16, r: 14 });   // the goals card (drawGoals)
    walletChip(RM.l + 132, RM.t + 8); }
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
  else ['jelly', 'slime', 'mochi', 'dough', 'foam'].forEach((m, i) => left.push([(isTouchUi() ? '' : (i + 1) + ' ') + PRESETS[m].name, 66, () => setPreset(m), { size: 14, on: roomPreset === m }]));
  const right = [['Skins', studio ? 84 : 70, () => { roomPanel = 'skins'; sfx.panel(true); }, ctrl]];
  if (!studio) right.push(['Hazards', 74, () => { roomPanel = 'hazards'; sfx.panel(true); }, ctrl], ['Room', 62, () => { roomPanel = 'room'; sfx.panel(true); }, ctrl], ['Decor', 66, () => { roomPanel = 'decor'; sfx.panel(true); }, ctrl], ['Pet', 58, () => { roomPanel = 'pet'; sfx.panel(true); }, { size: 14, on: !!store.pet && store.pet.day !== dayKey() }]);   // (lit while the pet has a gift waiting)
  right.push(['Hop', studio ? 64 : 54, () => { initAudio(); roomHop(); }, ctrl], ['Reset', studio ? 76 : 64, roomReset, ctrl]);
  let x = 10; for (const [label, w, fn, o] of left) { btn(label, x, y, w, h, fn, Object.assign({ r: 15, clip }, o)); x += w + gap; }
  x = W - 10 - right.reduce((n, it) => n + it[1] + gap, -gap); for (const [label, w, fn, o] of right) { btn(label, x, y, w, h, fn, Object.assign({ r: 15, clip }, o)); x += w + gap; }
}
// the Squish Room goals: a checklist with no pressure, and the cozy-days count
function drawGoals() {
  const g = goalStore(), cols = 2, cw = 300, rh = 42, rows = Math.ceil(GOALS.length / cols), pw = cols * cw + 40, ph = 62 + rows * rh + 76 + 66, px = (W - pw) / 2, py = (H - ph) / 2 - 6;
  const close = () => { roomPanel = null; sfx.panel(false); };
  ctx.fillStyle = C.dim; ctx.fillRect(-VX, 0, VW, H); ui.push({ x: 0, y: 0, w: W, h: H, bg: true, fn: close });
  ctx.fillStyle = 'rgba(255,255,255,.96)'; rr(px, py, pw, ph, 26); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.blush; ctx.stroke();
  ui.push({ x: px, y: py, w: pw, h: ph, bg: true, fn: () => {} });   // taps on the card itself do nothing
  txt('Squish goals', W / 2, py + 34, 26, C.pink, null);
  GOALS.forEach((it, i) => {
    const x = px + 20 + (i % cols) * cw, y = py + 62 + Math.floor(i / cols) * rh, done = !!g.done[it.id], mid = y + (rh - 6) / 2;
    ctx.fillStyle = done ? 'rgba(255,214,236,.9)' : 'rgba(245,235,250,.8)'; rr(x + 4, y, cw - 8, rh - 6, 14); ctx.fill();
    ctx.fillStyle = done ? C.hot : 'rgba(200,160,220,.45)'; ctx.beginPath(); ctx.arc(x + 26, mid, 11, 0, 7); ctx.fill();
    if (done) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 20, mid); ctx.lineTo(x + 25, mid + 5); ctx.lineTo(x + 33, mid - 5); ctx.stroke(); }
    txt(it.name, x + 46, y + 11, 16, done ? '#b03a82' : C.plum, null, 'left'); txt(it.hint(), x + 46, y + 27, 12, C.mauve, null, 'left');
  });
  const fy = py + 62 + rows * rh + 14;
  txt('Cozy days: ' + g.cozyDays + (g.streak > 1 ? '  •  ' + g.streak + ' in a row' : ''), W / 2, fy, 20, C.pink, null);
  txt(goalsDone() + ' of ' + GOALS.length + ' goals  •  every 3 count as a level toward new skins', W / 2, fy + 28, 14, C.mauve, null);
  btn('Done', W / 2 - 62, py + ph - 66, 124, 48, close, { size: 20 });
}
// a big, finger-sized chooser for jelly skins and hazard looks (locked ones say what unlocks them)
// the heart wallet: a small pill with the hearts you can spend in the Squish Room
function walletChip(x, y, w = 96, h = 42) {
  ctx.fillStyle = 'rgba(255,255,255,.72)'; rr(x, y, w, h, h / 2); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.blush; ctx.stroke();
  ctx.fillStyle = C.hot; heartPath(x + 24, y + h / 2, 11); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  txt(String(store.wallet), x + 42, y + h / 2 + 1, 20, C.plum, null, 'left');
}
// the Decor panel: six places, three things each; tap to buy (hearts), put on, or take off
function drawDecorPanel() {
  const cols = 3, cw = 288, ch = 168, pw = cols * cw + 40, ph = 2 * ch + 150, px = (W - pw) / 2, py = Math.max(6, (H - ph) / 2 - 6), close = () => { roomPanel = null; sfx.panel(false); };
  ctx.fillStyle = C.dim; ctx.fillRect(-VX, 0, VW, H); ui.push({ x: 0, y: 0, w: W, h: H, bg: true, fn: close });
  ctx.fillStyle = 'rgba(255,255,255,.96)'; rr(px, py, pw, ph, 26); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.blush; ctx.stroke();
  ui.push({ x: px, y: py, w: pw, h: ph, bg: true, fn: () => {} });
  txt(decorPage ? 'More places' : 'Decorate your room', W / 2, py + 34, 26, C.pink, null); walletChip(px + pw - 130, py + 12);
  DECOR_SLOTS.filter(s => !!s.exp === !!decorPage).forEach((s, k) => {
    const cx0 = px + 20 + (k % cols) * cw, cy0 = py + 58 + Math.floor(k / cols) * ch;
    ctx.fillStyle = 'rgba(245,235,250,.8)'; rr(cx0 + 4, cy0, cw - 8, ch - 8, 18); ctx.fill(); txt(s.name, cx0 + cw / 2, cy0 + 17, 16, C.plum, null);
    if (!slotOpen(s)) {   // not unlocked yet: says what opens it, and a tap goes to the Room panel
      const e = EXPANSIONS[s.exp - 1]; txt('Locked', cx0 + cw / 2, cy0 + 70, 22, '#9a86a8', null); txt('the ' + e.name + ' expansion opens this', cx0 + cw / 2, cy0 + 98, 14, C.mauve, null);
      ui.push({ x: cx0 + 4, y: cy0, w: cw - 8, h: ch - 8, label: 'locked ' + s.id, fn: () => { roomPanel = 'room'; sfx.click(); say('Expand your room to open ' + s.name.toLowerCase() + 's'); } }); return;
    }
    DECOR.filter(d => d.slot === s.id).forEach((it, i) => {
      const bx = cx0 + 14 + i * 90, by = cy0 + 32, bw = 84, bh = ch - 8 - 38, owned = !!store.decor.owned[it.id], on = store.decor.placed[s.id] === it.id, afford = store.wallet >= it.cost;
      ctx.fillStyle = on ? 'rgba(255,214,236,.95)' : '#fff'; rr(bx, by, bw, bh, 16); ctx.fill(); ctx.lineWidth = on ? 4 : 2.5; ctx.strokeStyle = on ? C.hot : C.blush; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(bx + 2, by + 2, bw - 4, 66); ctx.clip(); ctx.translate(bx + bw / 2, by + 36 + s.ic); ctx.scale(s.sc, s.sc); if (!owned && !afford) ctx.globalAlpha = .55; paintDecor(it, owned ? store.decor.tier[it.id] | 0 : 0, owned ? store.decor.dye[it.id] | 0 : 0); ctx.restore();
      txt(it.name + (owned && store.decor.tier[it.id] ? ' ' + '★'.repeat(store.decor.tier[it.id]) : ''), bx + bw / 2, by + 80, 12, owned ? '#b03a82' : C.plum, null);
      txt(owned ? (on ? 'on ✓' : 'owned') : '♥ ' + it.cost, bx + bw / 2, by + 100, 13, owned ? C.mauve : (afford ? C.hot : '#9a86a8'), null);
      ui.push({ x: bx, y: by, w: bw, h: bh, label: 'decor ' + it.id, fn: () => {
        const r = buyDecor(it.id);
        if (r === 'short') { sfx.error(); say(`${it.cost - store.wallet} more hearts for the ${it.name.toLowerCase()}`); } else if (r === 'bought') { sfx.unlock(); say('New: ' + it.name + '!'); } else sfx.click();
      } });
    });
  });
  btn('Style ▸', W / 2 - 296, py + ph - 66, 130, 48, () => { roomPanel = 'style'; sfx.click(); }, { size: 19 });
  btn(decorPage ? '‹ Basics' : 'More ▸', W / 2 - 150, py + ph - 66, 130, 48, () => { decorPage = decorPage ? 0 : 1; sfx.click(); }, { size: 19 });
  btn('Done', W / 2 - 2, py + ph - 66, 124, 48, close, { size: 20 });
  btn('Room ▸', W / 2 + 140, py + ph - 66, 130, 48, () => { roomPanel = 'room'; sfx.click(); }, { size: 19 });
}
let decorPage = 0;   // the Decor and Style panels show the first six places, or the four the expansions open
const slotsOnPage = () => DECOR_SLOTS.filter(s => !!s.exp === !!decorPage);
// swatch colour of dye idx: the pink most of the decor is made of, shifted
const dyeSwatch = idx => dyeColor('#ff7ab8', dyeHue(idx));
// the Style panel: upgrade and recolour what is placed in the room (tiers and dyes, see room.js)
function drawStylePanel() {
  const pw = 880, rowH = 56, ph = 6 * rowH + 140, px = (W - pw) / 2, py = Math.max(6, (H - ph) / 2 - 6), close = () => { roomPanel = null; sfx.panel(false); }, d = store.decor;
  ctx.fillStyle = C.dim; ctx.fillRect(-VX, 0, VW, H); ui.push({ x: 0, y: 0, w: W, h: H, bg: true, fn: close });
  ctx.fillStyle = 'rgba(255,255,255,.96)'; rr(px, py, pw, ph, 26); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.blush; ctx.stroke();
  ui.push({ x: px, y: py, w: pw, h: ph, bg: true, fn: () => {} });
  txt('Style your things', W / 2, py + 34, 26, C.pink, null); walletChip(px + pw - 130, py + 12);
  slotsOnPage().forEach((s, k) => {
    const y = py + 58 + k * rowH, it = slotOpen(s) ? decorItem(d.placed[s.id]) : null, t = it ? d.tier[it.id] | 0 : 0, mid = y + (rowH - 8) / 2;
    ctx.fillStyle = 'rgba(245,235,250,.8)'; rr(px + 16, y, pw - 32, rowH - 8, 16); ctx.fill();
    if (!it) { txt(s.name + (slotOpen(s) ? ': nothing placed yet' : ': locked (expand your room)'), px + 34, mid, 15, '#9a86a8', null, 'left'); return; }
    ctx.save(); ctx.beginPath(); ctx.rect(px + 22, y + 2, 52, rowH - 12); ctx.clip(); ctx.translate(px + 48, mid + s.ic * .55); ctx.scale(s.sc * .62, s.sc * .62); paintDecor(it, t, d.dye[it.id] | 0); ctx.restore();
    txt(it.name, px + 84, mid - 9, 15, '#b03a82', null, 'left'); txt(TIERS[t] + (t ? ' ' + '★'.repeat(t) : ''), px + 84, mid + 10, 12, C.mauve, null, 'left');
    const next = t < 2 ? tierCost(it, t + 1) : 0;
    btn(t < 2 ? TIERS[t + 1] + '  ♥ ' + next : 'Golden ✓', px + 230, y + 2, 150, rowH - 12, () => {
      const r = upgradeDecor(it.id); if (r === 'upgraded') { sfx.unlock(); say(it.name + ' is now ' + TIERS[d.tier[it.id]] + '!'); } else if (r === 'short') { sfx.error(); say(`${next - store.wallet} more hearts to upgrade the ${it.name.toLowerCase()}`); } else sfx.click();
    }, { size: 15, r: 14, off: t >= 2, on: false });
    DYES.forEach((dy, i) => {
      const bx = px + 400 + i * 74, owned = !!(d.dyes[it.id] >> i & 1), cur = (d.dye[it.id] | 0) === i;
      btn('', bx, y + 2, 68, rowH - 12, () => { const r = dyeDecor(it.id, i); if (r === 'bought') { sfx.unlock(); say(dy.name + ' for the ' + it.name.toLowerCase()); } else if (r === 'short') { sfx.error(); say(`${dy.cost - store.wallet} more hearts for ${dy.name}`); } else sfx.click(); }, { r: 14, on: cur });
      ctx.fillStyle = dyeSwatch(i); dcirc(bx + 20, mid, 11); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      txt(owned ? '' : '♥' + dy.cost, bx + 48, mid + 1, 12, owned ? C.mauve : C.hot, null);
    });
  });
  btn('‹ Shop', W / 2 - 296, py + ph - 66, 130, 48, () => { roomPanel = 'decor'; sfx.click(); }, { size: 19 });
  btn(decorPage ? '‹ Basics' : 'More ▸', W / 2 - 150, py + ph - 66, 130, 48, () => { decorPage = decorPage ? 0 : 1; sfx.click(); }, { size: 19 });
  btn('Done', W / 2 - 2, py + ph - 66, 124, 48, close, { size: 20 });
}
// the Room panel: wallpapers, floors and expansions, the big heart sinks (room.js)
function drawRoomPanel() {
  const pw = 880, ph = 508, px = (W - pw) / 2, py = Math.max(6, (H - ph) / 2 - 6), close = () => { roomPanel = null; sfx.panel(false); }, r = store.room;
  ctx.fillStyle = C.dim; ctx.fillRect(-VX, 0, VW, H); ui.push({ x: 0, y: 0, w: W, h: H, bg: true, fn: close });
  ctx.fillStyle = 'rgba(255,255,255,.96)'; rr(px, py, pw, ph, 26); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.blush; ctx.stroke();
  ui.push({ x: px, y: py, w: pw, h: ph, bg: true, fn: () => {} });
  txt('Your room', W / 2, py + 34, 26, C.pink, null); walletChip(px + pw - 130, py + 12);
  const row = (label, list, own, cur, kind, paint, y0) => {
    txt(label, px + 28, y0 + 6, 16, C.plum, null, 'left');
    list.forEach((it, i) => {
      const bx = px + 22 + i * 120, by = y0 + 20, bw = 114, bh = 96, has = !!own[it.id], on = cur === it.id, afford = store.wallet >= it.cost;
      ctx.fillStyle = on ? 'rgba(255,214,236,.95)' : '#fff'; rr(bx, by, bw, bh, 14); ctx.fill(); ctx.lineWidth = on ? 4 : 2.5; ctx.strokeStyle = on ? C.hot : C.blush; ctx.stroke();
      ctx.save(); rr(bx + 6, by + 6, bw - 12, 46, 9); ctx.clip(); if (!has && !afford) ctx.globalAlpha = .6; paint(it, bx + 6, by + 6, bw - 12, 46); ctx.restore();
      txt(it.name, bx + bw / 2, by + 66, 13, has ? '#b03a82' : C.plum, null); txt(has ? (on ? 'on ✓' : 'owned') : '♥ ' + it.cost, bx + bw / 2, by + 84, 13, has ? C.mauve : (afford ? C.hot : '#9a86a8'), null);
      ui.push({ x: bx, y: by, w: bw, h: bh, label: kind + ' ' + it.id, fn: () => { const res = buyStyle(kind, it.id); if (res === 'short') { sfx.error(); say(`${it.cost - store.wallet} more hearts for ${it.name}`); } else if (res === 'bought') { sfx.unlock(); say(it.name + ' is yours!'); } else sfx.click(); } });
    });
  };
  row('Wallpaper', WALLS, r.walls, r.wall, 'wall', (w, x, y, ww, hh) => paintWall(w, x, y, ww * 1.8, hh * 1.8), py + 52);
  row('Floor', FLOORS, r.floors, r.floor, 'floor', (f, x, y, ww, hh) => paintFloor(f, x, y, ww * 1.8, hh * 1.8), py + 176);
  txt('Expand your room', px + 28, py + 306, 16, C.plum, null, 'left');
  EXPANSIONS.forEach((e, i) => {
    const bx = px + 22 + i * 428, by = py + 322, bw = 410, bh = 84, bought = r.size > i, next = r.size === i, afford = store.wallet >= e.cost;
    ctx.fillStyle = bought ? 'rgba(255,214,236,.95)' : '#fff'; rr(bx, by, bw, bh, 16); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = bought ? C.hot : C.blush; ctx.stroke();
    txt(e.name, bx + 20, by + 28, 22, bought ? '#b03a82' : C.plum, null, 'left'); txt('opens ' + e.note, bx + 20, by + 56, 14, C.mauve, null, 'left');
    if (bought) txt('open ✓', bx + bw - 24, by + 42, 18, C.mauve, null, 'right');
    else { btn(next ? '♥ ' + e.cost : 'after ' + EXPANSIONS[i - 1].name, bx + bw - 150, by + 16, 134, 52, () => { const res = expandRoom(); if (res === 'short') { sfx.error(); say(`${e.cost - store.wallet} more hearts for ${e.name}`); } else if (res === 'expanded') { sfx.unlock(); say('Your room is ' + e.name + ' now!', 4); decorPage = 1; } }, { size: 18, r: 16, off: !next, on: next && afford }); }
  });
  btn('‹ Decor', W / 2 - 150, py + ph - 66, 130, 48, () => { roomPanel = 'decor'; sfx.click(); }, { size: 19 });
  btn('Done', W / 2 - 2, py + ph - 66, 124, 48, close, { size: 20 });
}
// the Pet panel: adopt, feed, rename, recolour and collect the daily gift
function drawPetPanel() {
  const pw = 780, ph = 490, px = (W - pw) / 2, py = Math.max(6, (H - ph) / 2 - 6), close = () => { roomPanel = null; sfx.panel(false); }, p = store.pet;
  ctx.fillStyle = C.dim; ctx.fillRect(-VX, 0, VW, H); ui.push({ x: 0, y: 0, w: W, h: H, bg: true, fn: close });
  ctx.fillStyle = 'rgba(255,255,255,.96)'; rr(px, py, pw, ph, 26); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.blush; ctx.stroke();
  ui.push({ x: px, y: py, w: pw, h: ph, bg: true, fn: () => {} });
  if (!p) {   // choose a friend (free)
    txt('Adopt a friend', W / 2, py + 40, 28, C.pink, null); txt('It is free. Feed it hearts and it grows up, and finds hearts for you every day.', W / 2, py + 76, 15, C.mauve, null);
    PET_KINDS.forEach(([kind, name], i) => {
      const bx = px + 40 + i * 236, by = py + 110, bw = 220, bh = 260;
      btn('', bx, by, bw, bh, () => { if (petAdopt(kind)) { sfx.unlock(); say('Say hi to ' + store.pet.name + '!'); } }, { r: 22 });
      ctx.save(); drawPet({ kind, love: 0, dye: 0 }, bx + bw / 2, by + 170, 1.7); ctx.restore(); txt(name, bx + bw / 2, by + 214, 22, C.pink, null); txt('adopt', bx + bw / 2, by + 238, 14, C.mauve, null);
    });
    btn('Done', W / 2 - 62, py + ph - 66, 124, 48, close, { size: 20 }); return;
  }
  const st = petStage(p.love), next = PET_STAGES[st + 1], lo = PET_STAGES[st][1], cx0 = px + 40 + 120;
  txt(PET_KINDS.find(k => k[0] === p.kind)[1], px + 40 + 120, py + 40, 16, C.mauve, null); walletChip(px + pw - 130, py + 14);
  ctx.fillStyle = 'rgba(245,235,250,.8)'; rr(px + 30, py + 60, 250, 300, 24); ctx.fill(); drawPet(p, cx0, py + 320, 2);
  const rx = px + 310, rw = 440;
  txt(p.name, rx, py + 92, 30, C.pink, null, 'left'); btn('Rename', rx + rw - 110, py + 70, 110, 44, () => { sfx.click(); askText('Name your friend', p.name, s => { p.name = cleanName(s, p.name).slice(0, 12); persist(); }, { max: 12, hint: 'A name' }); }, { size: 16, r: 14 });
  txt(PET_STAGES[st][0] + '  ·  stage ' + (st + 1) + ' of ' + PET_STAGES.length, rx, py + 134, 18, C.plum, null, 'left');
  ctx.fillStyle = 'rgba(200,160,220,.4)'; rr(rx, py + 152, rw, 18, 9); ctx.fill();
  const frac = next ? clamp((p.love - lo) / (next[1] - lo), 0, 1) : 1; ctx.fillStyle = '#ff7ab8'; rr(rx, py + 152, Math.max(18, rw * frac), 18, 9); ctx.fill();
  txt(next ? `${p.love} / ${next[1]} love  ·  next: ${next[0]}` : `${p.love} love  ·  fully grown!`, rx, py + 184, 14, C.mauve, null, 'left');
  PET_FOOD.forEach((f, i) => btn(f.name, rx + i * 150, py + 206, 140, 78, () => {
    const r = petFeed(f.id); if (r === 'short') { sfx.error(); say(`${f.cost - store.wallet} more hearts for a ${f.name.toLowerCase()}`); } else if (r === 'grew') { sfx.petMunch(); sfx.unlock(); say(p.name + ' grew into a ' + PET_STAGES[petStage(p.love)][0] + '!', 4); PA.cheer = 1.5; PA.asleep = false; } else { sfx.petMunch(); PA.cheer = .8; PA.asleep = false; }
  }, { size: 20, sub: '♥ ' + f.cost + '  ·  +' + f.love + ' love', ssize: 14, r: 18, off: false }));
  const gift = p.day !== dayKey(), amt = petGiftAmount(p);
  btn(gift ? `${p.name} found ${amt} hearts today!  Collect` : `Come back tomorrow for more hearts`, rx, py + 300, rw, 54, () => { const n = petGift(); if (n) { sfx.unlock(); say('+' + n + ' hearts from ' + p.name); } else sfx.click(); }, { size: 17, r: 18, on: gift, off: !gift });
  txt('Colour', rx, py + 384, 15, C.plum, null, 'left');
  DYES.forEach((dy, i) => {
    const bx = rx + 62 + i * 62, owned = !!(p.dyes >> i & 1), cost = dy.cost * 2;
    btn('', bx, py + 366, 58, 44, () => { const r = petDye(i); if (r === 'bought') { sfx.unlock(); say(dy.name + ' for ' + p.name); } else if (r === 'short') { sfx.error(); say(`${cost - store.wallet} more hearts for ${dy.name}`); } else sfx.click(); }, { r: 14, on: (p.dye | 0) === i });
    ctx.fillStyle = dyeSwatch(i); dcirc(bx + 18, py + 388, 10); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); if (!owned) txt('♥' + cost, bx + 44, py + 389, 11, C.hot, null);
  });
  btn('Done', W / 2 - 62, py + ph - 66, 124, 48, close, { size: 20 });
}
function drawPicker() {
  if (roomPanel === 'goals') { drawGoals(); return; }
  if (roomPanel === 'decor') { drawDecorPanel(); return; }
  if (roomPanel === 'room') { drawRoomPanel(); return; }
  if (roomPanel === 'style') { drawStylePanel(); return; }
  if (roomPanel === 'pet') { drawPetPanel(); return; }
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
    ui.push({ x: cx - cw / 2 + 4, y: top, w: cw - 8, h: ch - 12, fn: () => { if (open) { if (isSk) { if ((store.skin | 0) !== i) goalDone('skin'); store.skin = i; } else store.haz = i; persist(); roomPanel = null; sfx.click(); } else { sfx.error(); say(`Beat ${it.need} level${it.need > 1 ? 's' : ''} to unlock ${it.name}`); } } });
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
    bounceRing(scroll, bb0);
    drawSoft(jelly, scroll, { rot: ship ? 0 : q.rot, sx: ship ? 1 : sx * (1 + .2 * q.pf), sy: ship ? 1 : sy * (1 + .2 * q.pf), sk: ship || reduceMotion() ? 0 : q.k, ground: GY, alpha: ghost > 0 ? .45 + .2 * Math.sin(tg * 20) : 1, happy: state === 'win', open: (!P.grounded && P.vy < -100 && !ship) || (ship && inp.held) });
    if (ship) drawShipFront(scroll);
  }
  ctx.restore();
  hud();
  if (state === 'title') drawTitle();
  overlays();
}
