'use strict';
/* Jelly Dash — The Squish Room and Squish Studio.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ---------- cozy room decor ----------
   Hearts taken in official levels fill a wallet (store.wallet, see win() in game.js); the Decor panel in the Squish Room spends them on things for six places in the room,
   three choices each. One item per place; tap an owned one to put it on or take it off. Each paint() draws around (0, 0) with the room's coordinates; the panel draws a small copy. */
const dcirc = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); };
const dfill = (col, line, lw = 3) => { ctx.fillStyle = col; ctx.fill(); if (line) { ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.stroke(); } };
const dwin = sky => { ctx.fillStyle = '#fff'; rr(-50, -58, 100, 116, 16); ctx.fill(); ctx.fillStyle = sky; rr(-41, -49, 82, 98, 11); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -49); ctx.lineTo(0, 49); ctx.moveTo(-41, 0); ctx.lineTo(41, 0); ctx.stroke(); };
const dcurtains = () => { ctx.fillStyle = '#ff9ccf'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 50, -58); ctx.lineTo(s * 22, -58); ctx.quadraticCurveTo(s * 34, 0, s * 50, 30); ctx.fill(); } };
const dsag = t => 2 * t * (1 - t) * 40;   // the dip of a string hung across the room, at t along it (0..1)
const dstring = () => { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-250, 0); ctx.quadraticCurveTo(0, 40, 250, 0); ctx.stroke(); };
const dpot = col => { ctx.fillStyle = col; rr(-20, -28, 40, 28, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); };
const dface = (x, y) => { ctx.fillStyle = C.ink; dcirc(x - 7, y, 2.6); ctx.fill(); dcirc(x + 7, y, 2.6); ctx.fill(); ctx.fillStyle = 'rgba(255,120,170,.6)'; dcirc(x - 13, y + 5, 4); ctx.fill(); dcirc(x + 13, y + 5, 4); ctx.fill(); };
const DECOR_SLOTS = [
  { id: 'window', name: 'Window', x: 200, y: 170, sc: .42, ic: 4 }, { id: 'garland', name: 'Hanging', x: 480, y: RM.t + 4, sc: .15, ic: -14 }, { id: 'lamp', name: 'Lamp', x: 770, y: RM.t + 4, sc: .5, ic: -14 },
  { id: 'friend', name: 'Friend', x: 150, y: RM.b - 2, sc: .42, ic: 24 }, { id: 'rug', name: 'Rug', x: 480, y: RM.b + 12, sc: .2, ic: 10 }, { id: 'plant', name: 'Plant', x: 810, y: RM.b - 2, sc: .42, ic: 24 },
];
const DECOR = [
  { id: 'winsun', slot: 'window', name: 'Sunny', cost: 25, paint() { dwin('#bfe8ff'); ctx.fillStyle = '#ffd75e'; dcirc(14, -22, 12); ctx.fill(); ctx.fillStyle = '#fff'; dcirc(-14, 14, 10); ctx.fill(); dcirc(-2, 18, 12); ctx.fill(); dcirc(12, 14, 9); ctx.fill(); dcurtains(); } },
  { id: 'winstar', slot: 'window', name: 'Starry', cost: 55, paint() { dwin('#3a2a78'); ctx.fillStyle = '#fff3a8'; dcirc(14, -22, 12); ctx.fill(); ctx.fillStyle = '#fff'; for (const [x, y, s] of [[-22, -26, 5], [-24, 16, 4], [20, 26, 4]]) { sparklePath(x, y, s); ctx.fill(); } dcurtains(); } },
  { id: 'winrain', slot: 'window', name: 'Rainbow', cost: 90, paint() { dwin('#d9f2ff'); ['#ff7ab8', '#ffd75e', '#8fe8d4', '#8fc4ff'].forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 30, 33 - i * 7, Math.PI, 0); ctx.stroke(); }); ctx.fillStyle = '#fff'; dcirc(-30, 32, 9); ctx.fill(); dcirc(30, 32, 9); ctx.fill(); } },
  { id: 'bunting', slot: 'garland', name: 'Bunting', cost: 20, paint() { dstring(); for (let i = 0; i < 8; i++) { const t = (i + .5) / 8, x = -250 + 500 * t, y = dsag(t); ctx.fillStyle = ['#ff9ccf', '#c9a8ff', '#ffd75e', '#8fe8d4'][i % 4]; ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x + 18, y); ctx.lineTo(x, y + 38); ctx.fill(); } } },
  { id: 'lights', slot: 'garland', name: 'Fairy lights', cost: 45, paint() { dstring(); for (let i = 0; i < 12; i++) { const t = (i + .5) / 12, x = -250 + 500 * t, y = dsag(t) + 5, a = .65 + .35 * Math.sin(tg * 3 + i), col = ['#ff9ccf', '#ffe566', '#8fe8d4', '#8fc4ff'][i % 4]; ctx.globalAlpha = .22 * a; ctx.fillStyle = col; dcirc(x, y + 6, 14); ctx.fill(); ctx.globalAlpha = a; dcirc(x, y + 6, 6); dfill(col, '#fff', 2); } ctx.globalAlpha = 1; } },
  { id: 'lanterns', slot: 'garland', name: 'Lanterns', cost: 80, paint() { for (let i = 0; i < 5; i++) { const x = -200 + i * 100, y = 30 + (i % 2) * 18; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = ['#ff9ccf', '#ffd75e', '#c9a8ff', '#8fe8d4', '#ff9ccf'][i]; ctx.beginPath(); ctx.ellipse(x, y + 26, 22, 27, 0, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 26, 9, 27, 0, 0, 7); ctx.stroke(); } } },
  { id: 'starlamp', slot: 'lamp', name: 'Star lamp', cost: 35, paint() { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 46); ctx.stroke(); ctx.globalAlpha = .22 + .08 * Math.sin(tg * 2); ctx.fillStyle = '#ffe566'; dcirc(0, 68, 44); ctx.fill(); ctx.globalAlpha = 1; sparklePath(0, 68, 26); dfill('#ffe566', '#fff', 3); } },
  { id: 'moonlamp', slot: 'lamp', name: 'Moon lamp', cost: 70, paint() { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 44); ctx.stroke(); ctx.globalAlpha = .2 + .08 * Math.sin(tg * 2); ctx.fillStyle = '#fff3a8'; dcirc(0, 68, 46); ctx.fill(); ctx.globalAlpha = 1; dcirc(0, 68, 24); dfill('#fff7c8', '#fff', 3); ctx.fillStyle = '#f0e0a0'; dcirc(-8, 62, 5); ctx.fill(); dcirc(9, 74, 4); ctx.fill(); dcirc(7, 60, 3); ctx.fill(); } },
  { id: 'disco', slot: 'lamp', name: 'Disco ball', cost: 120, paint() { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 44); ctx.stroke(); dcirc(0, 66, 22); dfill('#d9d9f2', '#fff', 3); ctx.strokeStyle = 'rgba(120,120,180,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-22, 66); ctx.lineTo(22, 66); ctx.moveTo(0, 44); ctx.lineTo(0, 88); ctx.ellipse(0, 66, 11, 22, 0, 0, 7); ctx.stroke(); for (let k = 0; k < 6; k++) { const a = tg * 1.5 + k * 1.05, x = Math.cos(a) * 46, y = 66 + Math.sin(a * 1.3) * 30; ctx.fillStyle = ['#ff9ccf', '#ffe566', '#8fe8d4'][k % 3]; sparklePath(x, y, 5); ctx.fill(); } } },
  { id: 'bear', slot: 'friend', name: 'Teddy', cost: 40, paint() { ctx.fillStyle = '#c58a5b'; ctx.beginPath(); ctx.ellipse(0, -24, 22, 26, 0, 0, 7); ctx.fill(); dcirc(0, -62, 20); dfill('#c58a5b', '#fff', 3); dcirc(-15, -78, 8); dfill('#c58a5b', '#fff', 3); dcirc(15, -78, 8); dfill('#c58a5b', '#fff', 3); ctx.fillStyle = '#e8b88e'; ctx.beginPath(); ctx.ellipse(0, -22, 13, 16, 0, 0, 7); ctx.fill(); dcirc(0, -57, 8); ctx.fill(); dface(0, -64); ctx.fillStyle = C.ink; dcirc(0, -58, 2.4); ctx.fill(); } },
  { id: 'bunny', slot: 'friend', name: 'Bunny', cost: 70, paint() { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -24, 22, 26, 0, 0, 7); ctx.fill(); for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 9, -96, 7, 20, s * .12, 0, 7); dfill('#fff', '#ffd1ec', 3); ctx.fillStyle = '#ffb3d6'; ctx.beginPath(); ctx.ellipse(s * 9, -94, 3, 13, s * .12, 0, 7); ctx.fill(); } dcirc(0, -62, 20); dfill('#fff', '#ffd1ec', 3); dface(0, -64); ctx.fillStyle = '#ff9ccf'; dcirc(0, -58, 2.6); ctx.fill(); } },
  { id: 'kitty', slot: 'friend', name: 'Kitty', cost: 110, paint() { ctx.strokeStyle = '#a9a3c9'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(18, -14); ctx.quadraticCurveTo(46, -20, 38, -50); ctx.stroke(); ctx.fillStyle = '#a9a3c9'; ctx.beginPath(); ctx.ellipse(0, -24, 22, 26, 0, 0, 7); ctx.fill(); for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 20, -66); ctx.lineTo(s * 16, -88); ctx.lineTo(s * 4, -76); ctx.fill(); } dcirc(0, -62, 20); dfill('#a9a3c9', '#fff', 3); dface(0, -64); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath(); for (const s of [-1, 1]) { ctx.moveTo(s * 8, -58); ctx.lineTo(s * 24, -60); ctx.moveTo(s * 8, -56); ctx.lineTo(s * 24, -53); } ctx.stroke(); } },
  { id: 'rugpink', slot: 'rug', name: 'Pink rug', cost: 20, paint() { ctx.beginPath(); ctx.ellipse(0, 0, 170, 17, 0, 0, 7); dfill('#ff9ccf', '#fff', 4); ctx.beginPath(); ctx.ellipse(0, 0, 130, 12, 0, 0, 7); dfill('#ffc7e3'); ctx.beginPath(); ctx.ellipse(0, 0, 80, 7, 0, 0, 7); dfill('#ff9ccf'); } },
  { id: 'rugstar', slot: 'rug', name: 'Star rug', cost: 50, paint() { ctx.beginPath(); ctx.ellipse(0, 0, 170, 17, 0, 0, 7); dfill('#c9a8ff', '#fff', 4); ctx.save(); ctx.scale(1, .22); sparklePath(0, 0, 70); dfill('#fff3a8', '#fff', 4); ctx.restore(); } },
  { id: 'rugcloud', slot: 'rug', name: 'Cloud rug', cost: 90, paint() { for (const [x, y, rx, ry] of [[-80, 1, 62, 15], [80, 1, 62, 15], [0, -2, 78, 18]]) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); dfill('#d9f0ff', '#fff', 4); } ctx.beginPath(); ctx.ellipse(0, -2, 70, 12, 0, 0, 7); ctx.fillStyle = '#d9f0ff'; ctx.fill(); } },
  { id: 'cactus', slot: 'plant', name: 'Cactus', cost: 15, paint() { dpot('#ff9ccf'); ctx.fillStyle = '#6ccf9a'; rr(-11, -84, 22, 62, 11); ctx.fill(); rr(-28, -66, 14, 10, 5); ctx.fill(); rr(-28, -66, 10, 28, 5); ctx.fill(); rr(14, -58, 14, 10, 5); ctx.fill(); rr(18, -58, 10, 24, 5); ctx.fill(); ctx.fillStyle = '#ff7ab8'; dcirc(0, -86, 6); ctx.fill(); } },
  { id: 'fern', slot: 'plant', name: 'Fern', cost: 35, paint() { for (let i = 0; i < 7; i++) { ctx.save(); ctx.translate(0, -26); ctx.rotate((i - 3) * .36); ctx.fillStyle = i % 2 ? '#5fc98f' : '#7fdca6'; ctx.beginPath(); ctx.ellipse(0, -30, 7, 30, 0, 0, 7); ctx.fill(); ctx.restore(); } dpot('#c9a8ff'); } },
  { id: 'flower', slot: 'plant', name: 'Big flower', cost: 60, paint() { dpot('#ffd75e'); ctx.fillStyle = '#5fc98f'; rr(-2.5, -96, 5, 70, 2); ctx.fill(); for (let i = 0; i < 6; i++) { const a = i * 1.047 + Math.sin(tg) * .08; dcirc(Math.cos(a) * 13, -102 + Math.sin(a) * 13, 10); dfill('#ff7ab8', '#fff', 2); } dcirc(0, -102, 9); dfill('#ffe566', '#fff', 2); } },
];
const decorItem = id => DECOR.find(d => d.id === id);
// buy (when affordable) or toggle an item: 'bought' | 'placed' | 'removed' | 'short' (not enough hearts) | 'none' (no such item)
function buyDecor(id) {
  const it = decorItem(id), d = store.decor; if (!it) return 'none';
  if (!d.owned[id]) { if (store.wallet < it.cost) return 'short'; store.wallet -= it.cost; d.owned[id] = true; d.placed[it.slot] = id; persist(); return 'bought'; }
  if (d.placed[it.slot] === id) { delete d.placed[it.slot]; persist(); return 'removed'; }
  d.placed[it.slot] = id; persist(); return 'placed';
}
function drawDecor() {   // whatever is placed, on the wall and floor behind the jelly
  for (const s of DECOR_SLOTS) { const it = decorItem(store.decor.placed[s.id]); if (!it || it.slot !== s.id) continue; ctx.save(); ctx.translate(s.x, s.y); it.paint(); ctx.restore(); }
}

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
  if (!studio) goalsStep(dt, el);
}
function roomHop() {
  if (roomHopT > 0) return; roomHopT = .18; room.push(0, -760); room.kick(380, 160); sfx.jump();
  if (!studio && ++goalStore().hops >= 10) goalDone('hop');
}
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
  it.sort((a, b) => a.d - b.d); room.grabs.push({ id: 'pin' + Math.random(), pin: true, mx, my, items: it.slice(0, 5) }); sfx.poke(); buzz(10);
  if (!studio) goalDone('pin');
  return true;
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
    room.inds.push({ id, x: sx, y: sy, tx: mx, ty: my, r: 28 * kr, cx: sx, cy: sy }); sfx.poke(); buzz(8);
    if (!studio) goalDone('dent');
    return;
  }
  if (!inside && items[0].d > 64 * kr) return;
  const taken = new Set(); room.grabs.forEach(g => g.items.forEach(it => taken.add(it.i)));
  const it = items.filter(o => o.d < 64 * kr && !taken.has(o.i)).slice(0, 7).map(o => ({ i: o.i, dx: room.x[o.i] - mx, dy: room.y[o.i] - my }));
  if (!it.length) return;
  room.grabs.push({ id, mx, my, items: it }); sfx.poke(); buzz(6);
  if (!studio) goalDone('pull');
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
  if (had && !quiet) { sfx.bloop(clamp(roomElong, 0, 1.5)); buzz(10); if (!studio && roomElong > .6) goalDone('boing'); }
}
function setPreset(k) { roomPreset = k; room.prm = PRESETS[k]; room.relax(); sfx.bloop(k === 'jelly' ? 1 : k === 'mochi' || k === 'dough' || k === 'foam' ? -1 : 0); if (state === 'room' && !studio) goalMat(k); }

/* ================= Squish Room goals =================
   Soft things to try, with no timers and no way to fail. Each ticks off once, for good (store.goals.done). Every 3 goals count as one more "level" toward
   skins and hazards, like Studio stars (doneCount in render.js). "Cozy days" counts the days you spent a minute in the room; it only ever goes up. */
const GOALS = [
  { id: 'dent', name: 'Poke it', hint: () => 'press the middle of the jelly' },
  { id: 'pull', name: 'Pull its skin', hint: () => 'drag the edge outward' },
  { id: 'stretch', name: 'Big stretch', hint: () => 'pull it way out long' },
  { id: 'boing', name: 'Boing!', hint: () => 'let go of a big stretch' },
  { id: 'pin', name: 'Pin a spot', hint: () => isTouchUi() ? 'hold still on the skin' : 'right-click the skin' },
  { id: 'string', name: 'Stretch a string', hint: () => 'pin one spot, pull another' },
  { id: 'hop', name: 'Ten hops', hint: () => 'tap Hop ten times' },
  { id: 'mats', name: 'Try every material', hint: () => 'Jelly, Slime, Mochi, Dough, Foam' },
  { id: 'skin', name: 'New look', hint: () => 'pick a different skin' },
  { id: 'rest', name: 'Let it settle', hint: () => 'squish it, then leave it alone' },
  { id: 'cozy', name: 'A cozy minute', hint: () => 'spend a minute in the room' },
];
const ROOM_MATS = ['jelly', 'slime', 'mochi', 'dough', 'foam'];
let roomTouched = false, lastGoalSave = 0;
const goalStore = () => store.goals || (store.goals = { done: {}, mats: {}, hops: 0, secs: 0, day: '', daySecs: 0, cozyDays: 0, streak: 0, lastCozy: '' });
const goalsDone = () => GOALS.filter(g => goalStore().done[g.id]).length;
const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dayBefore = k => dayKey(new Date(new Date(k + 'T12:00:00').getTime() - 864e5));
function unlockNote(before) {   // say so when the progress count just opened a skin or a hazard (the same message as finishing a level)
  const after = doneCount(), fresh = [...SKINS.filter(k => k.need > before && k.need <= after).map(k => k.name), ...HAZ.filter(h => h.need > before && h.need <= after).map(h => h.name)];
  if (fresh.length) setTimeout(() => { sfx.unlock(); say('Unlocked: ' + fresh.join(', '), 4.5); }, 1500);
}
function goalDone(id) {
  const g = goalStore(); if (g.done[id]) return;
  const before = doneCount(); g.done[id] = 1; persist();
  say('Goal: ' + GOALS.find(x => x.id === id).name + ' ✓', 3); [0, 4, 7].forEach((d, i) => playDeg(d + 3, .06, i * .09)); buzz(14);
  unlockNote(before);
}
function goalMat(k) { const g = goalStore(); g.mats[k] = 1; if (ROOM_MATS.every(m => g.mats[m])) goalDone('mats'); }
function cozyTick(dt, today = dayKey()) {   // time in the room: a cozy minute (ever) and a cozy day (a minute today)
  const g = goalStore();
  if (g.day !== today) { g.day = today; g.daySecs = 0; }
  g.secs += dt; g.daySecs += dt;
  if (g.secs >= 60) goalDone('cozy');
  if (g.daySecs >= 60 && g.lastCozy !== today) {
    g.streak = g.lastCozy === dayBefore(today) ? g.streak + 1 : 1; g.cozyDays++; g.lastCozy = today; persist();
    say(g.streak > 1 ? 'Cozy day! ' + g.streak + ' in a row' : 'Cozy day! See you tomorrow', 3.5);
  }
  if (tg - lastGoalSave > 10) { lastGoalSave = tg; persist(); }
}
function goalsStep(dt, el) {   // el: how far the body is stretched (0 = round, 1 = twice as long)
  const pulling = room.grabs.some(q => !q.pin), pinned = room.grabs.some(q => q.pin);
  if (pulling && el > .8) goalDone('stretch');
  if (pulling && pinned && el > .5) goalDone('string');
  if (room.grabs.length || room.inds.length || room.deform > 80) roomTouched = true;
  if (roomTouched && roomIdle > 4) { roomTouched = false; goalDone('rest'); }
  if (roomIdle < 15) cozyTick(dt);   // only while something is happening: an open tab left alone does not count
}

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
  initAudio(); studio = false; room.resize(ROOM_R); state = 'room'; room.reset(480, 220); roomTouched = false; goalMat(roomPreset);
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
  unlockNote(before);   // every 3 Studio stars count as a level: say so when that opens something
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
