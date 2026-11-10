'use strict';
/* Jelly Dash — Touch rules, game state, run flow and practice mode.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= touch rules =================
   The numbers every screen shares. A new screen should use these instead of inventing its own:
   - MIN_HIT_CSS: the smallest comfortable touch target in CSS px (44 = Apple's guideline). Buttons keep their look but their HIT area grows to this size on touch.
   - HOLD_MS / HOLD_SLOP: a finger held still this long (and not moving more than SLOP stage units) is a long-press. */
const TOUCH = { MIN_HIT_CSS: 44, HOLD_MS: 420, HOLD_SLOP: 14 };
let pointerKind = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ? 'touch' : 'mouse';   // type of the last pointer used: picks hint wording and hit forgiveness
const isTouchUi = () => pointerKind !== 'mouse';
const cssPerUnit = () => Math.max(.2, cv.offsetWidth / VW);   // how many CSS px one stage unit is on this screen right now
const minHitUnits = () => clamp(TOUCH.MIN_HIT_CSS / cssPerUnit(), 0, 90);
// long-press detector (pointerId -> pending hold). One implementation for every screen that wants "hold to ..."
const holds = new Map();
function holdStart(id, x, y, onFire) { holdCancel(id); holds.set(id, { x, y, t0: performance.now(), timer: setTimeout(() => { holds.delete(id); onFire(); }, TOUCH.HOLD_MS) }); }
function holdMove(id, x, y) { const h = holds.get(id); if (h && Math.hypot(x - h.x, y - h.y) > TOUCH.HOLD_SLOP) holdCancel(id); }
function holdCancel(id) { if (id == null) { holds.forEach(h => clearTimeout(h.timer)); holds.clear(); return; } const h = holds.get(id); if (h) { clearTimeout(h.timer); holds.delete(id); } }
function drawHolds() {   // a ring that fills while a long-press is charging, so the player can see it coming
  const now = performance.now();
  for (const h of holds.values()) {
    const f = clamp((now - h.t0) / TOUCH.HOLD_MS, 0, 1); if (f < .2) continue;
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(h.x, h.y, 30, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = C.hot; ctx.beginPath(); ctx.arc(h.x, h.y, 30, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
  }
}

/* ================= state ================= */
let state = 'title', mode = 'dash', attempts = 1, deadT = 0, winT = 0, shake = 0, tg = 0, titleT = 0, got = 0, lastPct = 0;
let ghost = 0, ghostX = 0, cpT = 0, lastSq = 0, cps = [], testing = false, humOn = 0, toast = { t: '', life: 0 };
const inp = { held: false, buf: 0, pt: -1, flat: false };   // flat: the Squish button / key is held (the squish power, see setFlat)   // pt: game-time of the last press, so a mid-frame input can be back-dated
let frameAcc = 0, frameNowWall = 0;
const gameNow = () => P.wx / SPEED + frameAcc + (performance.now() - frameNowWall) / 1000;   // simulated time + the part of the frame not simulated yet
const mouse = { x: -1, y: -1, down: false };
let menuArm = 0;   // > 0 for two seconds after the first tap on the in-run menu button
const P = { wx: 0, y: GY - CUBE_H, vy: 0, w: 36, h: CUBE_H, grounded: true, coy: 0, form: 'cube', ledgeX: null, ledgeY: 0, flat: false, puff: PUFF_T, puffing: false };
const parts = [];
const OS_REDUCE = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const reduceMotion = () => SET().reduceMotion === null ? OS_REDUCE : SET().reduceMotion;   // shake, spin and most particles are skipped when on
function spawn(o) { if (simming) return; if (o.type !== 'txt' && reduceMotion() && Math.random() < .65) return; parts.push(Object.assign({ life: 1, max: 1, g: 0, vx: 0, vy: 0, size: 4, rot: 0, vr: 0, type: 'drop', col: '#fff' }, o)); }
const jelly = new Soft(24, 23, 0, 0, GAMEBODY);
// visual squash/stretch springs and the tumble in the air (drawn as a transform on top of the soft body, never affects the hitbox)
const SQ_ = { s: 0, v: 0, rot: 0, rv: 0, was: true, lastVy: 0, k: 0, kv: 0, pv: 0, pt: 0, pf: 0 };   // pf: how puffed up the jelly looks (0..1, eases in and out)   // k, kv: the sideways wobble (a lean that rings back and forth after a landing or a takeoff); pv, pt: a takeoff stretch waiting its turn (it follows the landing squat by a few frames)
let landEvt = 0;   // the fall speed of a landing (or a pad hit) that the squash spring has not been told about yet; the jelly squashes even when a held jump launches it again in the same step
const stretchKick = v => { SQ_.pv += v; if (SQ_.pt <= 0) SQ_.pt = .07; };
// how hard the squash spring is struck on landing, from the fall speed at the pace-neutral scale (vn = speed / K, so a level's tempo does not change how big a jump looks): a small drop is a nudge, a normal hop a clear squish, a pad or a long fall flattens the jelly to about half its height
const landSquashV = vn => 1.6 + Math.pow(clamp(vn / 1250, 0, 1), 1.6) * 10;
let tumble = SET().tumble;
const ROOM_R = 52, STUDIO_R = 72;   // body radius in the Room, and in the Studio where it is the whole canvas (bigger = easier to grip and knead with a finger)
const room = new Soft(36, ROOM_R, 480, 250, PRESETS.slime);
const roomScale = () => room.R / 46;   // touch radii below were tuned at R = 46
let roomPreset = 'slime', roomHopT = 0, roomElong = 0, roomIdle = 0;
// render interpolation: physics runs at a fixed 120 Hz, drawing blends the last two steps so any refresh rate looks even
const prev = { wx: 0, y: 0, jx: new Float32Array(25), jy: new Float32Array(25), rx: new Float32Array(37), ry: new Float32Array(37) };
const INT = { jx: new Float32Array(25), jy: new Float32Array(25), rx: new Float32Array(37), ry: new Float32Array(37) };
let alphaR = 1;
function snapPrev() { prev.wx = P.wx; prev.y = P.y; prev.jx.set(jelly.x); prev.jy.set(jelly.y); prev.rx.set(room.x); prev.ry.set(room.y); }
function withInterp(fn) {
  const a = clamp(alphaR, 0, 1), wx = P.wx, y = P.y, jx = jelly.x, jy = jelly.y, rx = room.x, ry = room.y;
  P.wx = lerp(prev.wx, wx, a); P.y = lerp(prev.y, y, a);
  for (let i = 0; i < INT.jx.length; i++) { INT.jx[i] = lerp(prev.jx[i], jx[i], a); INT.jy[i] = lerp(prev.jy[i], jy[i], a); }
  for (let i = 0; i < INT.rx.length; i++) { INT.rx[i] = lerp(prev.rx[i], rx[i], a); INT.ry[i] = lerp(prev.ry[i], ry[i], a); }
  jelly.x = INT.jx; jelly.y = INT.jy; room.x = INT.rx; room.y = INT.ry;
  try { fn(); } finally { P.wx = wx; P.y = y; jelly.x = jx; jelly.y = jy; room.x = rx; room.y = ry; }
}
const placeJelly = () => jelly.reset(P.wx + P.w / 2, P.form === 'ship' ? P.y + P.h / 2 - 9 : P.y + P.h - 17);
const say = (t, life = 2.5) => { toast = { t, life }; };

/* ================= game flow ================= */
function resetRun() {
  P.wx = 0; P.form = 'cube'; P.flat = false; P.puff = PUFF_T; P.puffing = false; P.h = CUBE_H; P.y = GY - P.h; P.vy = 0; P.grounded = true; P.coy = 0; P.ledgeX = null;
  SQ_.s = SQ_.v = SQ_.rot = SQ_.rv = SQ_.k = SQ_.kv = SQ_.pv = SQ_.pt = SQ_.pf = 0; SQ_.was = true; SQ_.lastVy = 0; landEvt = 0;
  got = 0; hearts.forEach(h => h.got = false); orbs.forEach(o => { o.used = false; }); pads.forEach(p => { p.sq = 0; p.cool = 0; });
  inp.buf = 0; inp.pt = -1; shake = 0; ghost = 0; cps = []; pcp = []; hintI = 0; pAutoX = 12 * T; cpT = 0; combo = 0; tuneI = 0; lastBeat = -1; placeJelly(); snapPrev();
  clusters.forEach(c => { c.done = false; }); scoreNow = 0; judgeBase = 0; judgeN = 0; judged = { PERFECT: 0, GREAT: 0, GOOD: 0, OK: 0 };
}
function pct() { return Math.floor(clamp(P.wx / FINISH, 0, 1) * 100); }
let lastWorld = -1;   // the world the player is currently in, so entering a new one gets an intro
function startLevel(L, m, test) {
  initAudio(); edPreview = false; buildLevel(L, true); mode = m; testing = !!test; resetRun(); attempts = 1; state = 'play'; inp.buf = .12; songStart(L, 0);
  curTune = tuneFor(L); tuneI = 0; tuneAnnounced = false;
  const w = WORLDS[L.world]; ambStart(w ? w.amb : null);
  if (w && L.world !== lastWorld && !test) { say('World ' + (L.world + 1) + ' · ' + w.name, 3.2); sfx.intro(); } else if (!test) sfx.start();
  lastWorld = w ? L.world : -1;
}
function restartRun() { resetRun(); attempts++; state = 'play'; songStart(curLevel, 0); }
function leaveRun() {
  setSqueak(200, 0); setHum(0); humOn = 0; room.grabs = []; room.inds = []; songStop(); ambStop(); edPreview = false;
  if (testing) { testing = false; buildLevel(edLevel); resetRun(); state = 'edit'; return; }
  buildLevel(curLevel); resetRun(); state = 'select'; titleT = 0;
}
function toTitle() { lastWorld = -1; ambStop(); roomPanel = null; holdCancel(); setSqueak(200, 0); setSquelch(0, 'slime'); setHum(0); humOn = 0; room.grabs = []; room.inds = []; room.boost = 1; songStop(); studio = false; flow = 0; if (roomPreset === 'clay') { roomPreset = 'slime'; room.prm = PRESETS.slime; room.relax(); } edPreview = false; testing = false; buildLevel(OFFICIAL[0]); resetRun(); state = 'title'; titleT = 0; }
// Zen checkpoints: a spot with a short hazard-free stretch around it (so respawning there is never unfair)
function clearAhead() {
  const a = P.wx - 40, b = P.wx + 140;
  for (const s of spikes) if (s.x > a && s.x < b) return false;
  for (const g of gaps) if (g[1] > a && g[0] < b) return false;
  for (const s of solids) if (!s.ground && (!s.ceil || s.gate) && s.x1 > a && s.x0 < b) return false;
  for (const p of pads) if (p.x > a && p.x < b) return false;
  for (const o of orbs) if (o.x > a && o.x < b) return false;
  for (const p of portals) if (p.x > a - 60 && p.x < b) return false;
  return true;
}
function zenRespawn() {
  const dx = P.wx; let c = null;
  for (let i = cps.length - 1; i >= 0; i--) if (cps[i].wx <= dx - 100) { c = cps[i]; break; }
  if (!c) c = cps[0] || { wx: 0, y: GY - CUBE_H, form: 'cube' };
  P.wx = c.wx; P.form = c.form || 'cube'; P.flat = false; P.puff = PUFF_T; P.puffing = false; P.h = P.form === 'ship' ? SHIP_H : CUBE_H; P.y = c.y; P.vy = 0; P.grounded = P.form === 'cube';
  // protected until you have carried on past the place you died, so a respawn can never loop on the same obstacle
  ghost = .45; ghostX = dx + 170; inp.buf = 0; placeJelly();
  cps = cps.filter(q => q.wx <= c.wx); sfx.bloop(0); snapPrev(); combo = 0; tuneI = 0; songStart(curLevel, P.wx / SPEED);   // music rewinds with you, staying on the grid
  for (let i = 0; i < 12; i++) spawn({ x: P.wx + P.w / 2, y: P.y + P.h / 2, vx: (Math.random() - .5) * 240, vy: -Math.random() * 240, g: 200, type: 'star', size: 4, life: .8, max: .8, col: '#fff' });
}
/* ---------- practice mode ----------
   Checkpoints are full snapshots of the run (position, velocity, hearts, orbs, pads), placed by hand (◆ / Z) or automatically about once a bar on a safe spot.
   Dying puts you back on the latest one with real collisions (unlike Zen there is no protection); ✕ / X removes the latest. Nothing here is saved to best/stars. */
let pcp = [], pAutoX = 0, hintI = 0;   // hintI: the next tip a level will show
function practiceSnap() {
  return { wx: P.wx, y: P.y, vy: P.vy, grounded: P.grounded, coy: P.coy, form: P.form, h: P.h, ledgeX: P.ledgeX, ledgeY: P.ledgeY, got,
    hearts: hearts.map(h => h.got), orbs: orbs.map(o => o.used), pads: pads.map(q => q.cool) };
}
function practiceSave(auto) {
  if (mode !== 'practice' || state !== 'play') return;
  pcp.push(practiceSnap()); if (pcp.length > 300) pcp.shift();
  if (!auto) { sfx.checkpoint(); say('Checkpoint ◆ ' + pcp.length, 1.2); ripple(P.wx + P.w / 2, P.y + P.h, .6); }
}
function practiceUndo() {
  if (mode !== 'practice') return;
  if (!pcp.length) { say('No checkpoints yet', 1.2); return; }
  pcp.pop(); sfx.checkpointUndo(); say(pcp.length ? 'Checkpoint removed' : 'All checkpoints removed', 1.2);
}
function practiceRespawn() {
  const c = pcp[pcp.length - 1], bb = jelly.bounds(), keep = pcp;
  for (let i = 0; i < 12; i++) spawn({ x: bb.cx, y: bb.cy, vx: (Math.random() - .5) * 300, vy: -Math.random() * 260, g: 900, size: 3 + Math.random() * 5, life: .6, max: .6, col: i % 2 ? C.blush : curHaz().col[i % 4] });
  attempts++; sfx.bloop(0);
  if (!c) { resetRun(); state = 'play'; songStart(curLevel, 0); return; }
  Object.assign(P, { wx: c.wx, y: c.y, vy: c.vy, grounded: c.grounded, coy: c.coy, form: c.form, h: c.h, ledgeX: c.ledgeX, ledgeY: c.ledgeY });
  hearts.forEach((h, i) => { h.got = c.hearts[i]; }); orbs.forEach((o, i) => { o.used = c.orbs[i]; }); pads.forEach((q, i) => { q.cool = c.pads[i]; q.sq = 0; }); got = c.got;
  SQ_.s = SQ_.v = SQ_.rot = SQ_.rv = 0; inp.buf = 0; inp.pt = -1; shake = 0; combo = 0; ghost = 0; pcp = keep; tuneI = 0;
  clusters.forEach(q => { q.done = q.end * T <= P.wx; });
  hintI = curLevel.hints ? curLevel.hints.findIndex(h => h.x - 5 > P.wx / T) : 0; if (hintI < 0) hintI = curLevel.hints.length;
  placeJelly(); snapPrev(); songStart(curLevel, P.wx / SPEED);   // the music rewinds with you, staying on the grid
}
function die() {
  if (state !== 'play') return;
  if (simming) { state = 'dead'; return; }
  if (mode === 'zen') { zenRespawn(); return; }
  if (mode === 'practice') { practiceRespawn(); return; }
  state = 'dead'; deadT = 0; shake = reduceMotion() ? 0 : .4; playHit(curHaz()); lastPct = pct(); setHum(0); humOn = 0; songStop(); combo = 0; tuneI = 0;
  if (!testing && lastPct > (store.best[curLevel.id] || 0)) { if (mode === 'dash' && (store.best[curLevel.id] || 0) > 0) { say('New best: ' + lastPct + '%', 2.4); setTimeout(() => sfx.newBest(), 380); } store.best[curLevel.id] = lastPct; persist(); }
  const bb = jelly.bounds(), hzCol = curHaz().col;
  for (let i = 0; i < 34; i++) {
    const a = Math.random() * 6.28, sp = 120 + Math.random() * 340;
    spawn({ x: bb.cx, y: bb.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 200, g: 1800, size: 4 + Math.random() * 8, life: .9 + Math.random() * .4, max: 1.2, col: ['#ff8fc7', C.blush, '#ff5fa8', '#ffd1ec'][i % 4] });
  }
  for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28, sp = 100 + Math.random() * 300; spawn({ x: bb.cx, y: bb.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 160, g: 1500, size: 2.5 + Math.random() * 4, life: .8 + Math.random() * .4, max: 1.1, col: hzCol[i % 4] }); }   // bits of the hazard itself
}
// the win jingle plays the level's own song voice and key, then one bell per heart earned
function winJingle() {
  const c = styleCfg(curLevel.style), voice = VOICES[c.lead.voice] || VOICES.tri;
  if (!(winStars === 3 && tuneFanfare(c))) [0, 2, 4, 5, 7, 9].forEach((d, i) => voice(mf(degMidi(c, d)), 1.3, .06, i * .12, 'sfx'));
  for (let i = 0; i < winStars; i++) setTimeout(() => sfx.star(i), 900 + i * 220);
}
function win() {
  if (simming) { state = 'win'; return; }
  state = 'win'; winT = 0; setHum(0); humOn = 0; songStop(); ambStop();
  const acc = judgeN ? judgeBase / (100 * judgeN) : 1; winStars = acc >= .8 ? 3 : acc >= .6 ? 2 : 1;   // rhythm rating from timing accuracy
  winJingle();
  if (!testing && mode === 'dash') {
    const before = doneCount();
    if ((store.best[curLevel.id] || 0) < 100) store.best[curLevel.id] = 100;
    if ((store.pace || 1) >= 1) {   // scores and hearts are for Normal pace and up; Chill is for learning a level
      if (scoreNow > (store.score[curLevel.id] || 0)) store.score[curLevel.id] = scoreNow;
      if (winStars > (store.rate[curLevel.id] || 0)) store.rate[curLevel.id] = winStars;
    }
    persist();
    const after = doneCount(), fresh = [...SKINS.filter(k => k.need > before && k.need <= after).map(k => k.name), ...HAZ.filter(h => h.need > before && h.need <= after).map(h => h.name)];
    if (fresh.length) setTimeout(() => { sfx.unlock(); say('Unlocked: ' + fresh.join(', '), 4.5); }, 1500);
  }
}
function press() {
  initAudio();
  if (state === 'dead' && deadT > .2) restartRun();
  else if (state === 'win' && winT > 1.2) leaveRun();
  inp.held = true; inp.buf = .12; inp.pt = state === 'play' ? gameNow() : -1;
}
// Rhythm judging: each jump that goes for a hazard is rated by how close its PRESS was to the music's 8th-note grid.
const GRADES = { PERFECT: [100, C.hot], GREAT: [60, '#b45cf0'], GOOD: [30, '#3d9be0'], OK: [10, '#9a8aa8'] };
function judgeJump(tp) {
  const pc = (P.wx + P.w / 2) / T; let c = null;
  for (const q of clusters) if (!q.ship && !q.done && q.end > pc + .2 && q.a - pc < 5.6) { c = q; break; }   // the nearest hazard still ahead
  if (!c) return;
  c.done = true;
  const eighth = 60 / curBpm / 2, ph = ((tp % eighth) + eighth) % eighth, e = Math.min(ph, eighth - ph) * 1000, side = ph < eighth / 2 ? 'late' : 'early';
  const g = e <= 35 ? 'PERFECT' : e <= 70 ? 'GREAT' : e <= 110 ? 'GOOD' : 'OK';
  judged[g]++; judgeN++; judgeBase += GRADES[g][0];
  if (g === 'PERFECT' || g === 'GREAT') combo++; else if (g === 'OK') combo = 0;
  scoreNow += Math.round(GRADES[g][0] * (1 + Math.min(combo, 10) * .1));
  spawn({ type: 'txt', text: g === 'PERFECT' ? g : g + ' • ' + side, x: P.wx + P.w / 2, y: P.y - 26, vy: -70, life: .95, max: .95, size: g === 'PERFECT' ? 26 : 21, col: GRADES[g][1] });
  if (g === 'PERFECT' || g === 'GREAT') tuneNote(g);
  if (g === 'PERFECT') { spawn({ type: 'ring', x: P.wx + P.w / 2, y: P.y + P.h, size: 70, life: .5, max: .5 }); buzz(6); }
}
function jumpFx() {
  // an input that arrived mid-frame is back-dated: the arc starts at the real press time, not at the next physics step
  const pressed = inp.buf > 0, hasT = pressed && inp.pt >= 0, tNow = P.wx / SPEED, lag = hasT ? tNow - inp.pt : 0, tPress = hasT ? inp.pt : tNow;
  const scramble = !P.grounded && P.ledgeX != null && P.wx + P.w / 2 > P.ledgeX + 3;   // took off from past the ledge, on coyote time
  if (P.flat) setFlat(false);   // a jump stands the jelly up first
  P.vy = -JUMP; P.grounded = false; P.coy = 0; inp.buf = 0; inp.pt = -1;
  if (lag > 0 && lag < .035) { P.y += P.vy * lag + .5 * G * lag * lag; P.vy += G * lag; }
  if (simming) return;
  jelly.kick(230, 80); stretchKick(5.2);   // takeoff: stretch tall
  if (scramble) {   // the grace made visible: the jelly pushes off its own sticky strand
    sfx.stick(); jelly.kick(120, 160); stretchKick(2);
    for (let i = 0; i < 7; i++) spawn({ x: P.ledgeX, y: P.ledgeY - 2, vx: (Math.random() - .3) * 140, vy: -Math.random() * 120, g: 260, type: 'star', size: 3 + Math.random() * 3, life: .45, max: .45, col: '#fff' });
  }
  if (state === 'play' && pressed) judgeJump(tPress);   // only real presses are judged; auto-repeat hops from holding are neutral
  sfx.jump();
  for (let i = 0; i < 5; i++) spawn({ x: P.wx + P.w / 2, y: P.y + P.h, vx: (Math.random() - .5) * 160, vy: Math.random() * 60, g: 300, type: 'star', size: 4 + Math.random() * 3, life: .5, max: .5, col: '#fff' });
}
// Jump orbs: touch one and press (a tap just before touching counts too) for one more full jump, from wherever you are. Each orb works once per attempt.
const ORB_REACH = { x: 27, y: 31 };
function orbBoost(o) {
  o.used = true; P.vy = -JUMP; P.grounded = false; P.coy = 0; inp.buf = 0; inp.pt = -1;
  if (simming) return;
  jelly.kick(260, 90); stretchKick(6); sfx.orb(); ripple(o.x, o.y, 1);
  for (let i = 0; i < 10; i++) spawn({ x: o.x, y: o.y, vx: (Math.random() - .5) * 280, vy: (Math.random() - .5) * 280, g: 120, type: 'star', size: 3 + Math.random() * 4, life: .55, max: .55, col: i % 2 ? '#fff' : '#ffd75e' });
}
function ripple(x, y, power) { spawn({ type: 'ring', x, y, size: 30 + power * 50, life: .6, max: .6 }); }

function formAt(cx) { let f = 'cube'; for (const p of portals) { if (p.x <= cx) f = p.to; else break; } return f; }
function switchForm(f) {
  P.flat = false; const cy = P.y + P.h / 2; P.form = f; P.h = f === 'ship' ? SHIP_H : CUBE_H; P.y = cy - P.h / 2; P.grounded = false; P.coy = 0;
  if (f === 'ship') P.vy *= .5;
  if (simming) return;
  const pt = portals.find(p => p.to === f && Math.abs(p.x - (P.wx + P.w / 2)) < 60);
  spawn({ type: 'ring', x: pt ? pt.x : P.wx, y: P.y + P.h / 2, size: 90, life: .8, max: .8 });
  for (let i = 0; i < 14; i++) spawn({ x: P.wx + P.w / 2, y: P.y + P.h / 2, vx: (Math.random() - .5) * 360, vy: (Math.random() - .5) * 360, type: 'star', size: 4 + Math.random() * 3, life: .7, max: .7, col: f === 'ship' ? '#ff9ccf' : '#8fe8d4' });
  sfx.portal(); jelly.heal(.5); jelly.kick(200, 120);
}

/* ---------- the squish power ----------
   Hold Squish (S / Down / Shift, or the on-screen button) on the ground and the jelly flattens to FLAT_H: it slips under a gummy gate (GATE_GAP above the floor)
   and keeps the same speed. A flat jelly stays flat while it is still under a gate (it cannot stand up into one); it stands the moment it is clear. In the air it
   is always standing, and a jump stands it up first. Spikes still hurt a flat jelly (flattening is for gates, not a dodge). The squash is also drawn, see softAfterCore. */
function standClear() { const L = P.wx + 3, R = P.wx + P.w - 3, top = P.y + P.h - CUBE_H; for (const s of solids) if (s.gate && R > s.x0 && L < s.x1 && top < s.bot) return false; return true; }
function setFlat(f) {
  if (P.flat === f) return; const b = P.y + P.h; P.flat = f; P.h = f ? FLAT_H : CUBE_H; P.y = b - P.h;
  if (simming) return; if (f) { sfx.squish(520, 'jelly'); buzz(8); SQ_.v -= 3; } else { sfx.bloop(1); SQ_.v += 3; }
}
function moveCube(dt, speed, lethal) {
  if (hasGate) { const want = inp.flat && P.grounded; if (want && !P.flat) setFlat(true); else if (!want && P.flat && standClear()) setFlat(false); }
  const pb0 = P.y + P.h;
  P.wx += speed * dt;
  const L = P.wx + 3, R = P.wx + P.w - 3;
  if (lethal) for (const s of solids) if (R > s.x0 && L < s.x1 && pb0 > s.top + 14 && P.y < s.bot) { die(); return false; }
  const prevB = P.y + P.h, wasG = P.grounded;
  // the puff power: falling in the air with Squish held (in a level built for it) inflates the jelly; it sinks slowly until its puff runs out (it refills on the ground)
  const gl = hasPuff && inp.flat && !P.grounded && P.vy > 0 && P.puff > 0; P.puffing = gl;
  if (gl) { P.puff -= dt * K; const cap = PUFF_V * K; P.vy = P.vy > cap ? Math.max(cap, P.vy - 2600 * K * K * dt) : Math.min(P.vy + G * PUFF_G * dt, cap); }
  else P.vy = Math.min(P.vy + G * dt, VCAP);
  const impactVy = P.vy;
  P.y += P.vy * dt; P.grounded = false;
  for (const s of solids) {
    if (R > s.x0 && L < s.x1 && P.vy >= 0 && prevB <= s.top + 14 && P.y + P.h >= s.top) { P.y = s.top - P.h; P.vy = 0; P.grounded = true; P.ledgeX = s.x1; P.ledgeY = s.top; break; }   // remember where the support ends: the sticky strand hangs from it
  }
  if (P.grounded && !wasG && !simming) landEvt = Math.max(landEvt, impactVy);   // (the squash spring reads this)
  if (P.grounded && !wasG && impactVy > 220 && !simming && state === 'play') sfx.land(impactVy);   // a soft thump on landing
  // Zen protection: solid ground bridges any gap until you are clear of where you last fell
  if (!P.grounded && mode === 'zen' && ghost > 0 && P.vy >= 0 && P.y + P.h >= GY && prevB <= GY + 14) { P.y = GY - P.h; P.vy = 0; P.grounded = true; }
  if (P.grounded) { P.coy = COY; P.puff = PUFF_T; } else P.coy -= dt;
  inp.buf -= dt;
  if (state === 'play' && (inp.buf > 0 || (autoHold && inp.held)) && (P.grounded || P.coy > 0) && (!P.flat || standClear())) jumpFx();   // jumping stays on while Zen's ghost protection is active (a flat jelly under a gate cannot jump: there is no room)
  if (state === 'play' && P.y > H + 60) { die(); return false; }
  return true;
}
function moveShip(dt, speed, lethal) {
  P.wx += speed * dt;
  const L = P.wx + 3, R = P.wx + P.w - 3;
  P.vy = clamp(P.vy + (inp.held ? -SHIP_UP : SHIP_DN) * dt, -SHIP_VU, SHIP_VD);
  const pT = P.y, pB = P.y + P.h; P.y += P.vy * dt; P.grounded = false;
  for (const s of solids) {
    if (R <= s.x0 || L >= s.x1 || P.y + P.h <= s.top || P.y >= s.bot) continue;
    if (pB <= s.top + 10 && P.vy >= 0) { P.y = s.top - P.h; P.vy = 0; P.grounded = true; }
    else if (pT >= s.bot - 10 && P.vy <= 0) { P.y = s.bot; P.vy = 0; }
    else if (lethal) { die(); return false; }
  }
  return true;
}
let HB = { x: 13, h: 30 }; const HB_DEF = HB;   // the active hazard's hitbox: inset from each side and height above the base (the default is what every level is verified against)
function stepPlayer(dt, speed, lethal) {
  const f = formAt(P.wx + P.w / 2 + speed * dt); if (f !== P.form) switchForm(f);
  if (!(P.form === 'ship' ? moveShip(dt, speed, lethal) : moveCube(dt, speed, lethal))) return;
  if (P.form === 'cube' && orbs.length) {   // (before the lethal check: a Zen respawn can still use orbs)
    const ox = P.wx + P.w / 2, oy = P.y + P.h / 2;
    for (const o of orbs) {
      if (o.used || o.x > P.wx + 120 || o.x < P.wx - 80) continue;
      if (Math.abs(ox - o.x) < ORB_REACH.x && Math.abs(oy - o.y) < ORB_REACH.y && (inp.buf > 0 || (autoHold && inp.held))) { orbBoost(o); break; }
    }
  }
  if (!lethal) return;
  const L = P.wx + 3, R = P.wx + P.w - 3, cx = P.wx + P.w / 2, cy = P.y + P.h / 2;
  for (const s of spikes) {
    if (s.x > P.wx + 200 || s.x < P.wx - 100) continue;
    const x0 = s.x + HB.x, x1 = s.x + T - HB.x, y0 = s.base - HB.h;
    if (L + 3 < x1 && R - 3 > x0 && P.y + 5 < s.base && P.y + P.h - 2 > y0) { die(); return; }
  }
  for (const pd of pads) {
    pd.cool -= dt; pd.sq *= Math.pow(.02, dt);
    if (P.form === 'cube' && pd.cool <= 0 && R > pd.x + 4 && L < pd.x + T - 4 && P.vy >= 0 && P.y + P.h >= pd.base - 12 && P.y + P.h <= pd.base + 14) {
      const fall = P.vy; pd.cool = .3; pd.sq = 1; P.vy = -PAD; P.grounded = false; P.coy = 0;
      if (simming) continue;
      landEvt = Math.max(landEvt, fall); jelly.kick(300, 110); stretchKick(7.2); sfx.pad();
      for (let i = 0; i < 12; i++) spawn({ x: pd.x + T / 2, y: pd.base - 6, vx: (Math.random() - .5) * 280, vy: -Math.random() * 300, g: 700, type: 'heart', size: 4 + Math.random() * 4, life: .7, max: .7, col: '#ff7ab8' });
    }
  }
  for (const h of hearts) {
    if (h.got || Math.abs(h.x - cx) > 40) continue;
    if (Math.hypot(h.x - cx, h.y - cy) < 40) {
      h.got = true; got++;
      if (simming) continue;
      sfx.heart();
      for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; spawn({ x: h.x, y: h.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, type: 'star', size: 5, life: .45, max: .45, col: '#fff' }); }
    }
  }
  if (P.wx >= FINISH) win();
}

function softAfterCore(dt, spd) {
  if (state === 'dead') return;
  const ship = P.form === 'ship';
  jelly.step(dt, {
    gy: ship ? (inp.held && state === 'play' ? -SHIP_UP : SHIP_DN) : (P.grounded ? G * .4 : G), resolve: ghost > 0 ? noCollide : resolveWorld,   // a ghosted (Zen) jelly drifts through blocks instead of being squeezed by them
    // in the ship the jelly's centre is kept far enough from the ceiling and floor that it is never squeezed against them
    guide: { tx: P.wx + P.w / 2, ty: ship ? clamp(P.y + P.h / 2 - 9, CEIL + 25, GY - 23) : P.y + P.h - 17, tvx: spd, tvy: P.vy, k: 650, c: 34 },
  });
  if (jelly.collapsed()) jelly.heal(.3);   // hard guarantee: a folded / flattened-crescent body is pulled back to round within a few frames
  // squash & stretch spring, and a full tumble in the air that lands upright with a wobble
  {
    const q = SQ_;
    if (ship || state !== 'play') { q.s *= .9; q.v *= .9; q.k *= .9; q.kv *= .9; q.pf *= .9; q.rot += (0 - q.rot) * .2; q.rv = 0; q.was = P.grounded; q.pv = q.pt = 0; landEvt = 0; }
    else {
      if (landEvt / K > 220) { const lv = landSquashV(landEvt / K); q.v -= lv; jelly.kick(lv * 40, -lv * 22); q.kv += (q.kv > 0 ? -1 : 1) * lv * .9; }   // landing: squash by how far it fell, so a big jump (a pad, an orb, a long drop) flattens it much more than a hop; the skin splats sideways and jiggles
      landEvt = 0;
      { const was = q.pf > .5; q.pf += ((P.puffing ? 1 : 0) - q.pf) * Math.min(1, dt * 14); if (!was && q.pf > .5 && P.puffing) { sfx.bloop(1); buzz(6); q.v += 2; } }   // puffing up: a round "bloop", and the squash spring gives a little wobble
      if (q.pt > 0 && (q.pt -= dt) <= 0) { q.v += q.pv; q.pv = 0; }   // the takeoff stretch comes a beat after the squat
      q.was = P.grounded; q.lastVy = P.vy;
      q.kv += (-3600 * q.k - 7 * q.kv) * dt; q.k = clamp(q.k + q.kv * dt, -.3, .3);   // the lean rings at about 9 Hz and fades in a third of a second
      q.v += (-380 * (q.s - (P.flat ? -.46 : 0)) - 11 * q.v) * dt; q.s = clamp(q.s + q.v * dt, -.5, .34);   // (a flat jelly holds the squash: about half its height, so it fits the gate gap)   // a springier spring (less damping): it bounces back past round a few times
      if (!P.grounded && tumble && !reduceMotion()) { q.rot += Math.PI * G / JUMP * dt; q.rv = 0; }
      else { q.rot -= Math.round(q.rot / (Math.PI * 2)) * Math.PI * 2; q.rv += (-300 * q.rot - 18 * q.rv) * dt; q.rot += q.rv * dt; if (Math.abs(q.rot) < 1e-3 && Math.abs(q.rv) < .01) q.rot = q.rv = 0; }   // whole turns are forgotten on landing; what is left wobbles back to upright
    }
  }
  if (jelly.impact > 380) jelly.soak(clamp(1 - (jelly.impact - 300) / 1100, .3, .72));   // the harder the landing, the more of the skin's remaining speed is bled off
  if (jelly.impact > 150 && tg - lastSq > .09) {
    lastSq = tg; sfx.squish(jelly.impact);
    const bb = jelly.bb; ripple(bb.cx, bb.maxy + 2, clamp(jelly.impact / 1100, 0, 1));
    for (let i = 0; i < 4; i++) spawn({ x: bb.cx, y: bb.maxy - 2, vx: (Math.random() - .5) * 200, vy: -Math.random() * 120 * (jelly.impact / 900), g: 700, size: 2.5 + Math.random() * 2.5, life: .4, max: .4, col: C.blush });
  }
}
