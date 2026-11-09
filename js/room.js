'use strict';
/* Jelly Dash — The Squish Room and Squish Studio.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ---------- squish room ---------- */
let lastPress = 0;
function roomStep(dt) {
  roomHopT -= dt;
  for (const d of room.inds) {   // a fingertip glides from the skin toward the pointer; its round pad sits outside the body along that ray
    const dist = Math.hypot(d.tx - d.x, d.ty - d.y), k = dist > 1e-3 ? Math.min(1, 900 * dt / dist) : 1;
    d.x += (d.tx - d.x) * k; d.y += (d.ty - d.y) * k;
    const b0 = room.bounds(); let ux = d.x - b0.cx, uy = d.y - b0.cy; const L = Math.hypot(ux, uy);
    if (L < 1e-3) { ux = 0; uy = -1; } else { ux /= L; uy /= L; }
    d.cx = d.x + ux * d.r; d.cy = d.y + uy * d.r;
  }
  if (!studio) room.boost = (room.grabs.some(g => !g.pin) || room.inds.length) ? .3 : 1;   // the dent sets while your finger is on it, then eases back once you let go
  // the Studio is weightless: the dough floats, tethered very gently to the middle, so a sculpted shape stays sculpted
  room.step(dt, studio ? { gy: 0, guide: { tx: 480, ty: 262, tvx: 0, tvy: 0, k: 6, c: 3.2 }, resolve: resolveRoom } : { gy: 1900, resolve: resolveRoom });
  const kind = roomPreset;
  // a body that is let go of while folded over or flattened to a crescent unfolds itself (sculpting in the Studio is exempt: it keeps whatever you made)
  if (!studio) { roomIdle = (room.grabs.length || room.inds.length) ? 0 : roomIdle + dt; if (roomIdle > .5 && room.collapsed()) room.heal(roomIdle > 1.3 ? 1 : .12, RM); }   // eases it open first; if it is tangled (a skin point inside out) it simply snaps back round
  if (room.impact > 120 && tg - lastSq > .07) {
    lastSq = tg; sfx.squish(room.impact * .8, kind); if (room.impact > 450) buzz(14);
    const bb = room.bounds(); if (room.contact) ripple(bb.cx, RM.b, clamp(room.impact / 1100, 0, 1));
  }
  if (room.press > 90 && tg - lastPress > .09) { lastPress = tg; sfx.squish(room.press * .6, kind); buzz(8); }
  setSquelch(room.deform, kind);
  const bb = room.bounds(), el = Math.max(bb.maxx - bb.minx, bb.maxy - bb.miny) / (2 * room.R) - 1;
  if (room.grabs.some(g => !g.pin)) setSqueak(260 + clamp(el, 0, 1.2) * 340, clamp(Math.abs(el - roomElong) / dt * .012 + el * .012, 0, .07)); else setSqueak(260, 0);
  roomElong = el;
}
function roomHop() { if (roomHopT > 0) return; roomHopT = .18; room.push(0, -760); room.kick(380, 160); sfx.jump(); }
function pointInBody(mx, my) {
  let c = false; const n = room.n, x = room.x, y = room.y;
  for (let i = 0, j = n - 1; i < n; j = i++) if ((y[i] > my) !== (y[j] > my) && mx < (x[j] - x[i]) * (my - y[i]) / (y[j] - y[i]) + x[i]) c = !c;
  return c;
}
// pin (or un-pin) a spot so you can stretch strings. Right-click on a mouse, long-press on touch. Returns whether anything changed.
function roomPin(mx, my) {
  const ex = room.grabs.findIndex(g => g.pin && Math.hypot(g.mx - mx, g.my - my) < 36 * roomScale());
  if (ex >= 0) { room.grabs.splice(ex, 1); sfx.bloop(-1); buzz(10); return true; }
  const it = [];
  for (let i = 0; i < room.n; i++) { const d = Math.hypot(room.x[i] - mx, room.y[i] - my); if (d < 80 * roomScale()) it.push({ i, d, dx: room.x[i] - mx, dy: room.y[i] - my }); }
  if (!it.length) return false;
  it.sort((a, b) => a.d - b.d); room.grabs.push({ id: 'pin' + Math.random(), pin: true, mx, my, items: it.slice(0, 5) }); sfx.poke(); buzz(10); return true;
}
// press in the middle = a finger that dents it; press near the skin = grab and pull; right-click = pin a spot so you can stretch strings
function roomDown(id, mx, my, button) {
  if (studio && button !== 2) touchNote(mx);
  const items = [];
  for (let i = 0; i < room.n; i++) items.push({ i, d: Math.hypot(room.x[i] - mx, room.y[i] - my) });
  items.sort((a, b) => a.d - b.d);
  const inside = pointInBody(mx, my);
  if (button === 2) { roomPin(mx, my); return; }
  const kr = roomScale();
  if (inside && items[0].d > 24 * kr) {
    const sx = room.x[items[0].i], sy = room.y[items[0].i];   // the finger first touches the skin, then presses in toward the pointer
    room.inds.push({ id, x: sx, y: sy, tx: mx, ty: my, r: 28 * kr, cx: sx, cy: sy }); sfx.poke(); buzz(8); return;
  }
  if (!inside && items[0].d > 64 * kr) return;
  const taken = new Set(); room.grabs.forEach(g => g.items.forEach(it => taken.add(it.i)));
  const it = items.filter(o => o.d < 64 * kr && !taken.has(o.i)).slice(0, 7).map(o => ({ i: o.i, dx: room.x[o.i] - mx, dy: room.y[o.i] - my }));
  if (!it.length) return;
  room.grabs.push({ id, mx, my, items: it }); sfx.poke(); buzz(6);
}
function roomMove(id, mx, my) {
  mx = clamp(mx, RM.l, RM.r); my = clamp(my, RM.t, RM.b);
  for (const g of room.grabs) if (g.id === id) { g.mx = mx; g.my = my; }
  for (const d of room.inds) if (d.id === id) { d.tx = mx; d.ty = my; }
}
function roomRelease(id, quiet) {
  const had = room.grabs.some(g => !g.pin && (id == null || g.id === id));
  room.grabs = room.grabs.filter(g => g.pin || !(id == null || g.id === id));
  room.inds = room.inds.filter(d => !(id == null || d.id === id));
  if (had && !quiet) { sfx.bloop(clamp(roomElong, 0, 1.5)); buzz(10); }
}
function setPreset(k) { roomPreset = k; room.prm = PRESETS[k]; room.relax(); sfx.bloop(k === 'jelly' ? 1 : k === 'mochi' || k === 'dough' || k === 'foam' ? -1 : 0); }

/* ================= Squish Studio =================
   Knead the dough into silhouettes (a ghost outline follows the dough). The shape score casts rays from the dough's
   centroid and compares their lengths with the target's, trying every rotation for shapes that allow it.
   Kneading fills a "flow" meter that layers the song in; fingers dragged across the dough play notes on the 16th grid. */
const RAYS = 36;
let studio = false, studioShape = 0, studioFree = false, studioHold = 0, studioSim = 0, studioSimAvg = 0, studioArmed = false, studioCel = 0, studioStars = 0;
let studioBestRot = 0, studioCx = 480, studioCy = 300, studioScale = 80, studioFrame = 0, studioStyle = 0, flow = 0, lastStudioStep = -1;
function rayDist(poly, ox, oy, dx, dy) {
  let best = Infinity; const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ax = poly[2 * i] - ox, ay = poly[2 * i + 1] - oy, ex = poly[2 * j] - poly[2 * i], ey = poly[2 * j + 1] - poly[2 * i + 1];
    const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue;
    const t = (ax * ey - ay * ex) / den, u = (ax * dy - ay * dx) / den;
    if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6 && t < best) best = t;   // tolerance: a ray through a vertex must not slip between two edges
  }
  return best === Infinity ? 0 : best;
}
function polyArea(p) { let a = 0; const n = p.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; } return a / 2; }
function polyCentroid(p) {
  let cx = 0, cy = 0, a = 0; const n = p.length / 2;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, c = p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; a += c; cx += (p[2 * i] + p[2 * j]) * c; cy += (p[2 * i + 1] + p[2 * j + 1]) * c; }
  a *= .5; return a ? [cx / (6 * a), cy / (6 * a)] : [0, 0];
}
const polyFromRadial = (f, n = 72) => { const p = []; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2, r = f(t); p.push(Math.cos(t) * r, Math.sin(t) * r); } return p; };
const ellipsePolar = (a, b) => t => a * b / Math.hypot(b * Math.cos(t), a * Math.sin(t));
const regPoly = (k, inner) => { const p = []; for (let i = 0; i < k * (inner ? 2 : 1); i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / (k * (inner ? 2 : 1)), r = inner && i % 2 ? inner : 1; p.push(Math.cos(a) * r, Math.sin(a) * r); } return p; };
const SHAPES = [
  { name: 'Round Bun', rot: true, poly: polyFromRadial(() => 1) },
  { name: 'Pancake', rot: true, poly: polyFromRadial(ellipsePolar(1.6, .62)) },
  { name: 'Heart', rot: false, poly: (() => { const p = []; for (let i = 0; i < 72; i++) { const t = i / 72 * Math.PI * 2; p.push(16 * Math.pow(Math.sin(t), 3), -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))); } return p; })() },
  { name: 'Star', rot: true, poly: regPoly(5, .5) },
  { name: 'Flower', rot: true, poly: polyFromRadial(t => 1 + .3 * Math.cos(6 * t)) },
  { name: 'Log', rot: true, poly: polyFromRadial(ellipsePolar(2.4, .42)) },
  { name: 'Teardrop', rot: false, poly: polyFromRadial(t => .8 + .8 * Math.pow(Math.max(0, Math.cos(t + Math.PI / 2)), 3)) },
  { name: 'Triangle', rot: true, poly: regPoly(3) },
  { name: 'Peanut', rot: true, poly: polyFromRadial(t => 1 + .42 * Math.cos(2 * t)) },
];
function prepShape(sh) {   // unit-area, centroid-centred copies of the silhouette at every allowed rotation, plus their ray profiles
  if (sh.polys) return;
  const s = 1 / Math.sqrt(Math.abs(polyArea(sh.poly))), [mx, my] = polyCentroid(sh.poly), base = [];
  for (let i = 0; i < sh.poly.length; i += 2) base.push((sh.poly[i] - mx) * s, (sh.poly[i + 1] - my) * s);
  const rots = sh.rot ? 18 : 1; sh.polys = []; sh.profiles = [];
  for (let r = 0; r < rots; r++) {
    const a = r / rots * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), q = [];
    for (let i = 0; i < base.length; i += 2) q.push(base[i] * ca - base[i + 1] * sa, base[i] * sa + base[i + 1] * ca);
    const prof = new Float32Array(RAYS); for (let k = 0; k < RAYS; k++) { const t = k / RAYS * Math.PI * 2; prof[k] = rayDist(q, 0, 0, Math.cos(t), Math.sin(t)); }
    sh.polys.push(q); sh.profiles.push(prof);
  }
}
function studioScore() {
  const sh = SHAPES[studioShape]; prepShape(sh);
  const pts = []; for (let i = 0; i < room.n; i++) pts.push(room.x[i], room.y[i]);
  const A = Math.abs(polyArea(pts)); if (A < 100) return 0;
  const [cx, cy] = polyCentroid(pts), s = Math.sqrt(A), r0 = s * .5642, ds = new Float32Array(RAYS);
  for (let k = 0; k < RAYS; k++) { const t = k / RAYS * Math.PI * 2; ds[k] = rayDist(pts, cx, cy, Math.cos(t), Math.sin(t)); }
  let best = 1e9, bi = 0;
  for (let r = 0; r < sh.profiles.length; r++) { const P = sh.profiles[r]; let e = 0; for (let k = 0; k < RAYS; k++) e += Math.abs(ds[k] - s * P[k]); if (e < best) { best = e; bi = r; } }
  studioBestRot = bi; studioCx = cx; studioCy = cy; studioScale = s;
  return clamp(1 - (best / RAYS / r0) * 2.6, 0, 1);
}
const degFromX = x => Math.floor(clamp((x - RM.l) / (RM.r - RM.l), 0, .999) * 10);
function playDeg(deg, vol, at = 0) {
  if (!AC || simming || !song) return;
  const m = degMidi(song.cfg, clamp(deg, 0, 14));
  tone(mf(m), .9, { type: 'triangle', vol, att: .004, at, bus: 'song', lp: 2400 }); tone(mf(m + 12), .5, { vol: vol * .3, att: .004, at, bus: 'song' });
}
function touchNote(mx) {   // a touch plays the note under your finger (low on the left, high on the right), snapped to the grid when close
  if (!song) return;
  const six = 60 / song.bpm / 4, d0 = Math.ceil(songT / six - 1e-6) * six - songT;
  playDeg(degFromX(mx), .08, d0 < .06 ? d0 : 0);
}
function studioSong(atT) { songStart({ id: 'studio', name: 'studio', style: studioStyle, bpm: STYLES[studioStyle].bpm, studio: true }, atT); }
function enterRoom() {
  initAudio(); studio = false; room.resize(ROOM_R); state = 'room'; room.reset(480, 220);
  if (!store.seenRoom) { store.seenRoom = true; persist(); say(isTouchUi() ? 'Tip: press to dent it, drag the skin to pull, hold still to pin' : 'Tip: click to dent it, drag the skin to pull, right-click to pin', 5); }   // a one-time hint, like the Studio's
}
function startStudio() {
  initAudio(); studio = true; state = 'room'; room.resize(STUDIO_R); room.reset(480, 262); setPreset('clay');
  studioShape = 0; studioFree = false; studioHold = 0; studioArmed = false; studioCel = 0; flow = 0; lastStudioStep = -1; studioSim = 0;
  prepShape(SHAPES[0]); studioSong(0); studioSim = studioScore();
  if (!store.seenStudio) { store.seenStudio = true; persist(); say('Tip: hold a finger on the dough to pin it, then pull with another finger', 5); }
}
function nextShape() { studioShape = (studioShape + 1) % SHAPES.length; studioHold = 0; studioSim = 0; studioArmed = false; studioCel = 0; prepShape(SHAPES[studioShape]); sfx.click(); }
function completeShape() {
  const sh = SHAPES[studioShape], stars = studioSimAvg >= .93 ? 3 : studioSimAvg >= .88 ? 2 : 1;
  studioStars = stars; studioCel = 2.2; studioHold = 0; studioArmed = false;
  const before = doneCount();
  if (stars > (store.studio.stars[sh.name] || 0)) { store.studio.stars[sh.name] = stars; persist(); }
  const after = doneCount(), fresh = [...SKINS.filter(k => k.need > before && k.need <= after).map(k => k.name), ...HAZ.filter(h => h.need > before && h.need <= after).map(h => h.name)];   // every 3 Studio stars count as a level: say so when that opens something
  if (fresh.length) setTimeout(() => { sfx.unlock(); say('Unlocked: ' + fresh.join(', '), 4.5); }, 1500);
  [0, 2, 4, 7, 9, 12].forEach((d, i) => playDeg(d + 3, .07, i * .1)); buzz(30);
  for (let i = 0; i < 44; i++) spawn({ x: studioCx + (Math.random() - .5) * 300, y: studioCy - 140, vx: (Math.random() - .5) * 120, vy: 40 + Math.random() * 120, g: 60, type: 'conf', size: 5 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - .5) * 10, life: 3, max: 3, col: ['#ff6fb5', '#ffd1ec', '#c86bff', '#8fd8ff', '#fff3a8'][i % 5] });
}
let studioIdle = 0, smoothT = 0;
function studioStep(dt) {
  songT += dt;
  const hands = room.grabs.some(g => !g.pin) || room.inds.length > 0;
  // memory only lasts while you are working it: hands on = it holds the shape, hands off for a while (or "Smooth") = it relaxes back to round
  studioIdle = hands ? 0 : studioIdle + dt; if (smoothT > 0) smoothT -= dt;
  room.boost = smoothT > 0 ? 16 : studioCel > 0 ? 5 : hands ? .5 : studioHold > 0 ? 1 : studioIdle > 2.5 ? 3.5 : 1;
  flow = clamp(flow + (clamp(room.deform / 260, 0, 1) * (hands ? 1 : .35) * .7 - .1) * dt, 0, 1);
  if (song) {
    songUpdate(flow);
    const six = 60 / song.bpm / 4, st = Math.floor(songT / six);
    if (st !== lastStudioStep) {
      lastStudioStep = st;
      const g = room.grabs.find(q => !q.pin) || room.inds[0];
      if (g && room.deform > 70) playDeg(degFromX(g.mx != null ? g.mx : g.x), .05 + .05 * flow);   // dragging across the dough plays an arpeggio on the grid
      if (st % 4 === 0 && flow > .3) room.kick(40 + 90 * flow, 30);                                   // the dough bounces to the beat
    }
  }
  if (flow > .2 && Math.random() < dt * 24 * flow) { const i = Math.floor(Math.random() * room.n); spawn({ x: room.x[i], y: room.y[i], vx: (Math.random() - .5) * 60, vy: -30 - Math.random() * 60, type: 'star', size: 3 + Math.random() * 3, life: .7, max: .7, col: Math.random() < .5 ? '#fff' : '#ffe08a' }); }
  if (studioCel > 0) { studioCel -= dt; if (studioCel <= 0) nextShape(); return; }
  if (studioFree) { studioSim = 0; return; }
  if (++studioFrame % 6 === 0) studioSim = studioScore();
  if (studioSim < .7) studioArmed = true;
  if (studioArmed && studioSim >= .84) { if (studioHold === 0) studioSimAvg = studioSim; studioHold += dt; studioSimAvg += (studioSim - studioSimAvg) * .08; if (studioHold >= 1.4) completeShape(); }
  else studioHold = Math.max(0, studioHold - dt * 1.5);
}
