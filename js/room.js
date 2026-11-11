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
  // four more places that open up as the room is expanded (EXPANSIONS below; `exp` is the expansion that unlocks it)
  { id: 'frame', name: 'Picture', x: 640, y: 170, sc: .42, ic: 4, exp: 1 }, { id: 'pouf', name: 'Seat', x: 600, y: RM.b - 2, sc: .45, ic: 24, exp: 1 },
  { id: 'shelf', name: 'Shelf', x: 345, y: 140, sc: .4, ic: -8, exp: 2 }, { id: 'nook', name: 'Nook', x: 725, y: RM.b - 2, sc: .32, ic: 24, exp: 2 },
];
const dframe = bg => { ctx.fillStyle = '#fff'; rr(-48, -54, 96, 108, 12); ctx.fill(); ctx.fillStyle = bg; rr(-40, -46, 80, 92, 8); ctx.fill(); };
const dshelf = () => { ctx.fillStyle = '#fff'; rr(-70, 0, 140, 9, 4); ctx.fill(); ctx.fillStyle = '#e8d2f4'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 50, 9); ctx.lineTo(s * 50, 24); ctx.lineTo(s * 36, 9); ctx.fill(); } };
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
  { id: 'frheart', slot: 'frame', name: 'Heart', cost: 60, paint() { dframe('#ffe3f2'); heartPath(0, 2, 24); ctx.fillStyle = '#ff7ab8'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); } },
  { id: 'frrain', slot: 'frame', name: 'Rainbow', cost: 110, paint() { dframe('#e9f6ff'); ['#ff7ab8', '#ffd75e', '#8fe8d4', '#8fc4ff'].forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 20, 27 - i * 6.5, Math.PI, 0); ctx.stroke(); }); } },
  { id: 'frstar', slot: 'frame', name: 'Star map', cost: 190, paint() { dframe('#2f2468'); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-24, 22); ctx.lineTo(-8, -6); ctx.lineTo(10, 10); ctx.lineTo(24, -26); ctx.stroke(); ctx.fillStyle = '#fff3a8'; for (const [x, y, s] of [[-24, 22, 5], [-8, -6, 6], [10, 10, 5], [24, -26, 7], [-20, -30, 4]]) { sparklePath(x, y, s); ctx.fill(); } } },
  { id: 'pfpink', slot: 'pouf', name: 'Pouf', cost: 50, paint() { rr(-32, -32, 64, 32, 15); dfill('#ff9ccf', '#fff', 3); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, -22); ctx.quadraticCurveTo(0, -16, 18, -22); ctx.stroke(); } },
  { id: 'pfstar', slot: 'pouf', name: 'Star cushion', cost: 100, paint() { ctx.beginPath(); ctx.ellipse(0, -10, 36, 12, 0, 0, 7); dfill('#c9a8ff', '#fff', 3); sparklePath(0, -24, 22); dfill('#ffe566', '#fff', 3); } },
  { id: 'pfbean', slot: 'pouf', name: 'Bean bag', cost: 200, paint() { ctx.beginPath(); ctx.moveTo(-34, 0); ctx.quadraticCurveTo(-44, -30, -14, -42); ctx.quadraticCurveTo(14, -52, 32, -30); ctx.quadraticCurveTo(44, -8, 34, 0); ctx.closePath(); dfill('#8fe8d4', '#fff', 3); dface(0, -22); } },
  { id: 'shbooks', slot: 'shelf', name: 'Books', cost: 90, paint() { dshelf(); [['#ff9ccf', 14, 34], ['#c9a8ff', 12, 40], ['#ffd75e', 14, 30], ['#8fe8d4', 12, 38]].reduce((x, [c, w, h]) => { ctx.fillStyle = c; rr(x, -h, w, h, 3); ctx.fill(); return x + w + 2; }, -34); ctx.fillStyle = '#ff7ab8'; heartPath(46, -12, 9); ctx.fill(); } },
  { id: 'shplants', slot: 'shelf', name: 'Plants', cost: 180, paint() { dshelf(); for (const [x, c] of [[-40, '#ff9ccf'], [0, '#c9a8ff'], [40, '#ffd75e']]) { ctx.fillStyle = '#6ccf9a'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(x + i * 7, -22, 4, 13, i * .5, 0, 7); ctx.fill(); } ctx.fillStyle = c; rr(x - 11, -14, 22, 14, 5); ctx.fill(); } } },
  { id: 'shtreasure', slot: 'shelf', name: 'Treasures', cost: 300, paint() { dshelf(); ctx.fillStyle = 'rgba(200,235,255,.8)'; rr(-52, -36, 28, 36, 8); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.fillStyle = '#ffe566'; sparklePath(-38, -18, 9); ctx.fill(); dcirc(6, -14, 14); dfill('#c58a5b', '#fff', 2); dcirc(6, -33, 9); dfill('#c58a5b', '#fff', 2); dcirc(46, -12, 12); dfill('#ffb3d6', '#fff', 2); } },
  { id: 'nktent', slot: 'nook', name: 'Tent', cost: 150, paint() { ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(0, -92); ctx.lineTo(70, 0); ctx.closePath(); dfill('#ff9ccf', '#fff', 4); ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(0, -46); ctx.lineTo(22, 0); ctx.closePath(); dfill('#8a3a7a'); ctx.fillStyle = '#ffd75e'; ctx.beginPath(); ctx.moveTo(0, -92); ctx.lineTo(0, -116); ctx.lineTo(18, -108); ctx.lineTo(0, -102); ctx.fill(); } },
  { id: 'nkcloud', slot: 'nook', name: 'Cloud bed', cost: 300, paint() { for (const [x, y, rx, ry] of [[-34, -14, 30, 16], [34, -14, 30, 16], [0, -22, 42, 22]]) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); dfill('#fff', '#d9f0ff', 3); } ctx.beginPath(); ctx.ellipse(0, -22, 36, 17, 0, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); rr(-30, -46, 34, 20, 10); dfill('#ffc7e3', '#fff', 3); } },
  { id: 'nkcastle', slot: 'nook', name: 'Castle', cost: 500, paint() { ctx.fillStyle = '#e8d2f4'; rr(-46, -62, 92, 62, 6); ctx.fill(); for (const x of [-60, 60]) { rr(x - 16, -86, 32, 86, 6); dfill('#c9a8ff', '#fff', 3); ctx.beginPath(); ctx.moveTo(x - 20, -86); ctx.lineTo(x, -112); ctx.lineTo(x + 20, -86); ctx.closePath(); dfill('#ff9ccf', '#fff', 3); } ctx.fillStyle = '#8a3a7a'; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-16, -26); ctx.quadraticCurveTo(0, -44, 16, -26); ctx.lineTo(16, 0); ctx.fill(); ctx.fillStyle = '#ffd75e'; for (const x of [-30, 0, 30]) { ctx.fillRect(x - 5, -72, 10, 10); } } },
];
const decorItem = id => DECOR.find(d => d.id === id);
const slotOpen = s => !s.exp || store.room.size >= s.exp;   // places beyond the first six open as the room is expanded
// buy (when affordable) or toggle an item: 'bought' | 'placed' | 'removed' | 'short' (not enough hearts) | 'locked' (that place is not unlocked yet) | 'none' (no such item)
function buyDecor(id) {
  const it = decorItem(id), d = store.decor; if (!it) return 'none';
  if (!slotOpen(DECOR_SLOTS.find(s => s.id === it.slot))) return 'locked';
  if (!d.owned[id]) { if (store.wallet < it.cost) return 'short'; store.wallet -= it.cost; d.owned[id] = true; d.tier[id] = 0; d.dye[id] = 0; d.dyes[id] = 1; d.placed[it.slot] = id; persist(); return 'bought'; }
  if (d.placed[it.slot] === id) { delete d.placed[it.slot]; persist(); return 'removed'; }
  d.placed[it.slot] = id; persist(); return 'placed';
}
/* Tiers and dyes are how the same 18 things keep being worth saving for. Every item can be upgraded Basic -> Deluxe (sparkles) -> Golden (a warm glow and more sparkles), at 4x and 10x its price;
   and recoloured: four hue dyes (20 hearts each), and Rainbow (150), which cycles. A dye is bought once per item and can then be switched freely. */
const TIERS = ['Basic', 'Deluxe', 'Golden'], TIER_MULT = [1, 4, 10];
const DYES = [{ name: 'Original', hue: 0, cost: 0 }, { name: 'Mint', hue: 150, cost: 20 }, { name: 'Sky', hue: 200, cost: 20 }, { name: 'Grape', hue: 265, cost: 20 }, { name: 'Cherry', hue: 335, cost: 20 }, { name: 'Rainbow', hue: -1, cost: 150 }];
const tierCost = (it, tier) => it.cost * TIER_MULT[tier];   // the price of getting `it` to `tier` (1 or 2)
function upgradeDecor(id) {   // 'upgraded' | 'short' | 'max' | 'none' (not owned)
  const it = decorItem(id), d = store.decor; if (!it || !d.owned[id]) return 'none';
  const t = d.tier[id] | 0; if (t >= 2) return 'max'; const c = tierCost(it, t + 1); if (store.wallet < c) return 'short';
  store.wallet -= c; d.tier[id] = t + 1; persist(); return 'upgraded';
}
function dyeDecor(id, idx) {   // buy (when needed) and put on dye number idx: 'bought' | 'set' | 'short' | 'none'
  const d = store.decor; if (!decorItem(id) || !d.owned[id] || !(idx >= 0 && idx < DYES.length)) return 'none';
  if (!(d.dyes[id] >> idx & 1)) { if (store.wallet < DYES[idx].cost) return 'short'; store.wallet -= DYES[idx].cost; d.dyes[id] |= 1 << idx; d.dye[id] = idx; persist(); return 'bought'; }
  d.dye[id] = idx; persist(); return 'set';
}
// recolouring without a canvas filter (iPad Safari has none): while a painter runs, every colour it sets is hue-shifted; greys, whites and the dark ink keep their colour
const dyeCache = new Map();
function dyeColor(v, hue) {
  if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v) || hue === 0) return v;
  const key = v + '|' + Math.round(hue / 2); let out = dyeCache.get(key); if (out) return out;
  const r = parseInt(v.slice(1, 3), 16) / 255, g = parseInt(v.slice(3, 5), 16) / 255, b = parseInt(v.slice(5, 7), 16) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn;
  if (dl < .1 || l < .25 || l > .93) out = v;
  else {
    const s = dl / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; h = ((h * 60 + hue) % 360 + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, k = Math.floor(h / 60), rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k % 6];
    out = '#' + rgb.map(q => Math.round((q + m) * 255).toString(16).padStart(2, '0')).join('');
  }
  dyeCache.set(key, out); return out;
}
function withDye(hue, fn) {
  if (hue === 0) { fn(); return; }
  const proto = Object.getPrototypeOf(ctx), fd = Object.getOwnPropertyDescriptor(proto, 'fillStyle'), sd = Object.getOwnPropertyDescriptor(proto, 'strokeStyle');
  Object.defineProperty(ctx, 'fillStyle', { configurable: true, get() { return fd.get.call(ctx); }, set(v) { fd.set.call(ctx, dyeColor(v, hue)); } });
  Object.defineProperty(ctx, 'strokeStyle', { configurable: true, get() { return sd.get.call(ctx); }, set(v) { sd.set.call(ctx, dyeColor(v, hue)); } });
  try { fn(); } finally { delete ctx.fillStyle; delete ctx.strokeStyle; }
}
const dyeHue = idx => DYES[idx].hue < 0 ? (tg * 60) % 360 : DYES[idx].hue;
// where each place's sparkles drift (around the item's own origin), for the Deluxe and Golden looks
const DECOR_FX = { window: [0, 0, 56, 62], garland: [0, 34, 250, 22], lamp: [0, 66, 42, 32], friend: [0, -52, 30, 52], rug: [0, 0, 170, 14], plant: [0, -52, 28, 52], frame: [0, 0, 48, 52], pouf: [0, -18, 34, 20], shelf: [0, -14, 66, 28], nook: [0, -44, 62, 48] };
function drawTierFx(slot, tier, n0) {
  const [fx, fy, rx, ry] = DECOR_FX[slot];
  if (tier >= 2) { const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, Math.max(rx, ry) * 1.15); g.addColorStop(0, 'rgba(255,225,120,.34)'); g.addColorStop(1, 'rgba(255,225,120,0)'); ctx.save(); ctx.translate(fx, fy); ctx.scale(1, ry / Math.max(rx, ry)); ctx.translate(-fx, -fy); ctx.fillStyle = g; ctx.fillRect(fx - rx * 1.2, fy - rx * 1.2, rx * 2.4, rx * 2.4); ctx.restore(); }
}
function drawTierSparkles(slot, tier) {
  const [fx, fy, rx, ry] = DECOR_FX[slot], n = tier >= 2 ? 9 : 5;
  for (let i = 0; i < n; i++) { const a = i * 2.399 + .7, tw = .5 + .5 * Math.sin(tg * 2.4 + i * 1.9), x = fx + Math.cos(a) * rx * (.4 + .6 * ((i * .37) % 1)), y = fy + Math.sin(a) * ry * (.4 + .6 * ((i * .61) % 1)); ctx.globalAlpha = tw; ctx.fillStyle = tier >= 2 ? '#ffe566' : '#fff'; sparklePath(x, y, 3 + 4 * tw); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function paintDecor(it, tier, dye) {   // one item as it looks with its tier and dye, around the current origin (the room and the panels both use this)
  if (tier >= 2) drawTierFx(it.slot, tier);
  withDye(dyeHue(dye | 0), () => it.paint());
  if (tier >= 1) drawTierSparkles(it.slot, tier);
}
function drawDecor() {   // whatever is placed, on the wall and floor behind the jelly
  const d = store.decor;
  for (const s of DECOR_SLOTS) { const it = decorItem(d.placed[s.id]); if (!it || it.slot !== s.id || !slotOpen(s)) continue; ctx.save(); ctx.translate(s.x, s.y); paintDecor(it, d.tier[it.id] | 0, d.dye[it.id] | 0); ctx.restore(); }
}

/* ---------- the room itself: wallpapers, floors and expansions ----------
   The biggest hearts sinks. Seven wallpapers and seven floors (the first of each is free and everyone starts with it) and two expansions that open four more places for decor.
   store.room = { wall, floor, walls: {owned}, floors: {owned}, size }. paintWall / paintFloor fill any rectangle, so the room and the panel's swatches share them. */
const WALLS = [
  { id: 'blush', name: 'Blush', cost: 0, g: ['#fff0f8', '#e6d8ff'], out: '#f6c6e3', pat: 'none', vig: .55 },
  { id: 'mint', name: 'Mint dots', cost: 90, g: ['#f0fff8', '#cdeedd'], out: '#a8e6c8', pat: 'dots', vig: .45 },
  { id: 'lilac', name: 'Lilac stripes', cost: 180, g: ['#f5eeff', '#d9c8ff'], out: '#c4a8f0', pat: 'stripes', vig: .4 },
  { id: 'sky', name: 'Sky', cost: 320, g: ['#eef8ff', '#c4e4ff'], out: '#8fc4f0', pat: 'clouds', vig: .4 },
  { id: 'peach', name: 'Peach hearts', cost: 520, g: ['#fff4ea', '#ffd9c4'], out: '#f5b08f', pat: 'hearts', vig: .4 },
  { id: 'midnight', name: 'Midnight', cost: 800, g: ['#3a2a78', '#1f1648'], out: '#6b4fb0', pat: 'stars', vig: 0 },
  { id: 'aurora', name: 'Aurora', cost: 1400, g: ['#1f2a5c', '#2c1a5a'], out: '#5a6fd0', pat: 'aurora', vig: 0 },
];
const FLOORS = [
  { id: 'candy', name: 'Candy', cost: 0, g: ['#ff9ccf', '#c86bff'], pat: 'none' },
  { id: 'wood', name: 'Wood', cost: 70, g: ['#e0a878', '#b87a4c'], pat: 'planks' },
  { id: 'checker', name: 'Checkers', cost: 150, g: ['#ffffff', '#ffe0f0'], pat: 'checker' },
  { id: 'cloud', name: 'Clouds', cost: 280, g: ['#d9f0ff', '#a8d8ff'], pat: 'clouds' },
  { id: 'meadow', name: 'Meadow', cost: 450, g: ['#8fe0a0', '#4fbf7a'], pat: 'meadow' },
  { id: 'sprinkle', name: 'Sprinkles', cost: 700, g: ['#ffe3b8', '#ffbe9a'], pat: 'sprinkles' },
  { id: 'galaxy', name: 'Galaxy', cost: 1200, g: ['#4a2e8a', '#1f1456'], pat: 'stars' },
];
const EXPANSIONS = [{ name: 'Roomy', cost: 500, note: 'a picture and a seat' }, { name: 'Grand', cost: 1800, note: 'a shelf and a nook' }];
const wallOf = () => WALLS.find(w => w.id === store.room.wall) || WALLS[0], floorOf = () => FLOORS.find(f => f.id === store.room.floor) || FLOORS[0];
function buyStyle(kind, id) {   // kind 'wall' | 'floor': 'bought' | 'set' | 'short' | 'none'
  const list = kind === 'wall' ? WALLS : FLOORS, own = kind === 'wall' ? store.room.walls : store.room.floors, it = list.find(x => x.id === id); if (!it) return 'none';
  if (!own[id]) { if (store.wallet < it.cost) return 'short'; store.wallet -= it.cost; own[id] = true; store.room[kind] = id; persist(); return 'bought'; }
  store.room[kind] = id; persist(); return 'set';
}
function expandRoom() {   // 'expanded' | 'short' | 'max'
  const n = store.room.size; if (n >= EXPANSIONS.length) return 'max'; const e = EXPANSIONS[n]; if (store.wallet < e.cost) return 'short';
  store.wallet -= e.cost; store.room.size = n + 1; persist(); return 'expanded';
}
const twinkles = (x, y, w, h, n, col, k) => { ctx.fillStyle = col; for (let i = 0; i < n; i++) { const tw = .35 + .65 * (.5 + .5 * Math.sin(tg * 2 + i * 1.7)); ctx.globalAlpha = tw; sparklePath(x + ((i * 137.5) % 100) / 100 * w, y + ((i * 61.8 + 13) % 100) / 100 * h, (2.5 + (i % 3) * 1.4) * k + 1); ctx.fill(); } ctx.globalAlpha = 1; };
function paintWall(wl, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, wl.g[0]); g.addColorStop(1, wl.g[1]); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const k = w / 820, p = wl.pat, s = 44 * k; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (p === 'dots') { ctx.fillStyle = 'rgba(255,255,255,.75)'; for (let j = 0; j * s < h + s; j++) for (let i = 0; i * s < w + s; i++) { dcirc(x + (i + (j & 1) * .5) * s, y + j * s, 5 * k + 1); ctx.fill(); } }
  else if (p === 'stripes') { ctx.fillStyle = 'rgba(255,255,255,.42)'; for (let i = 0; i * 62 * k < w; i++) ctx.fillRect(x + i * 62 * k, y, 30 * k, h); }
  else if (p === 'clouds') { ctx.fillStyle = 'rgba(255,255,255,.7)'; [[.16, .2], [.52, .1], [.84, .26], [.34, .5], [.72, .55]].forEach(([fx, fy], i) => { const cx = x + w * fx + Math.sin(tg * .4 + i) * 8 * k, cy = y + h * fy; for (const [dx, dy, r] of [[-22, 4, 14], [0, -4, 19], [22, 4, 14]]) { ctx.beginPath(); ctx.ellipse(cx + dx * k * 1.4, cy + dy * k * 1.4, r * k * 1.6 + 1, r * k * 1.2 + 1, 0, 0, 7); ctx.fill(); } }); }
  else if (p === 'hearts') { ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let j = 0; j * 66 * k < h + s; j++) for (let i = 0; i * 66 * k < w + s; i++) { heartPath(x + (i + (j & 1) * .5) * 66 * k, y + j * 58 * k + 10 * k, 7 * k + 1); ctx.fill(); } }
  else if (p === 'stars') twinkles(x, y, w, h, 36, '#fff3c8', k);
  else if (p === 'aurora') { ['#7affd4', '#8fa8ff', '#ff9ccf'].forEach((c, i) => { ctx.globalAlpha = .3; ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x + w * (.2 + .3 * i + .08 * Math.sin(tg * .5 + i * 2)), y + h * (.34 + .05 * Math.sin(tg * .7 + i)), w * .36, h * .17, -.25 + i * .25, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1; twinkles(x, y, w, h, 18, '#ffffff', k); }
  ctx.restore();
}
function paintFloor(fl, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, fl.g[0]); g.addColorStop(1, fl.g[1]); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const k = w / 820, p = fl.pat; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (p === 'planks') { ctx.strokeStyle = 'rgba(110,60,30,.38)'; ctx.lineWidth = 2; ctx.beginPath(); for (let r = 1; r < 3; r++) { ctx.moveTo(x, y + h * r / 3); ctx.lineTo(x + w, y + h * r / 3); } for (let r = 0; r < 3; r++) for (let i = 0; i * 110 * k < w; i++) { const sx = x + (i * 110 + r * 47) * k; ctx.moveTo(sx, y + h * r / 3); ctx.lineTo(sx, y + h * (r + 1) / 3); } ctx.stroke(); }
  else if (p === 'checker') { ctx.fillStyle = 'rgba(255,140,200,.4)'; const s = Math.max(8, 40 * k); for (let j = 0; j * s < h; j++) for (let i = 0; i * s < w; i++) if ((i + j) & 1) ctx.fillRect(x + i * s, y + j * s, s, s); }
  else if (p === 'clouds') { ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(x + w * (.08 + i * .17) + Math.sin(tg * .5 + i) * 6 * k, y + h * (.3 + (i % 2) * .38), 50 * k + 2, 12 * k + 2, 0, 0, 7); ctx.fill(); } }
  else if (p === 'meadow') { ctx.fillStyle = '#3fae6a'; for (let i = 0; i * 17 * k < w; i++) { const bx = x + i * 17 * k, by = y + (((i * 37) % 10) / 10) * h * .8 + 8 * k; ctx.beginPath(); ctx.moveTo(bx - 4 * k, by + 12 * k); ctx.lineTo(bx, by - 4 * k); ctx.lineTo(bx + 4 * k, by + 12 * k); ctx.fill(); } for (let i = 0; i < 9; i++) { dcirc(x + w * (.06 + i * .11), y + h * (.25 + ((i * 3) % 4) * .17), 4 * k + 1.5); ctx.fillStyle = i % 2 ? '#ffe566' : '#ff9ccf'; ctx.fill(); } }
  else if (p === 'sprinkles') { ctx.lineCap = 'round'; ctx.lineWidth = 4 * k + 1.5; for (let i = 0; i < 46; i++) { const sx = x + ((i * 71) % 100) / 100 * w, sy = y + ((i * 37 + 11) % 100) / 100 * h, a = i * 1.3; ctx.strokeStyle = ['#ff7ab8', '#8fc4ff', '#ffd75e', '#8fe8d4', '#c9a8ff'][i % 5]; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * 8 * k, sy + Math.sin(a) * 8 * k); ctx.stroke(); } }
  else if (p === 'stars') twinkles(x, y, w, h, 30, '#fff3c8', k);
  ctx.restore();
}

/* ---------- the pet ----------
   A companion that lives in the Squish Room. It is adopted once (free; three kinds) and fed with hearts: snacks, treats and feasts give love, and love grows it through six stages (new looks:
   a bow, a scarf, a crown, wings, a halo). It never gets sick or hungry; it just keeps growing. Once a day it finds a few hearts for you. */
const PET_KINDS = [['bun', 'Bunny'], ['kit', 'Kitty'], ['bear', 'Bear']];
const PET_STAGES = [['Baby', 0], ['Kid', 120], ['Teen', 500], ['Grown', 1600], ['Royal', 4000], ['Legend', 9000]];   // [name, love needed]
const PET_FOOD = [{ id: 'snack', name: 'Snack', cost: 6, love: 12 }, { id: 'treat', name: 'Treat', cost: 30, love: 66 }, { id: 'feast', name: 'Feast', cost: 120, love: 290 }];
const petStage = love => { let s = 0; PET_STAGES.forEach((p, i) => { if (love >= p[1]) s = i; }); return s; };
const petGiftAmount = pet => 3 + 3 * petStage(pet.love);
function petAdopt(kind) { if (store.pet || !PET_KINDS.some(k => k[0] === kind)) return false; store.pet = { kind, name: 'Mochi', love: 0, dyes: 1, dye: 0, day: '' }; persist(); return true; }
function petFeed(foodId) {   // 'fed' | 'grew' (reached a new stage) | 'short' | 'none'
  const f = PET_FOOD.find(x => x.id === foodId), p = store.pet; if (!f || !p) return 'none'; if (store.wallet < f.cost) return 'short';
  const before = petStage(p.love); store.wallet -= f.cost; p.love += f.love; persist(); return petStage(p.love) > before ? 'grew' : 'fed';
}
function petGift(day = dayKey()) { const p = store.pet; if (!p || p.day === day) return 0; const n = petGiftAmount(p); p.day = day; store.wallet += n; persist(); return n; }   // hearts found today, or 0 if already taken
function petDye(idx) {
  const p = store.pet; if (!p || !(idx >= 0 && idx < DYES.length)) return 'none'; const cost = DYES[idx].cost * 2;
  if (!(p.dyes >> idx & 1)) { if (store.wallet < cost) return 'short'; store.wallet -= cost; p.dyes |= 1 << idx; p.dye = idx; persist(); return 'bought'; }
  p.dye = idx; persist(); return 'set';
}
// draws a pet with its feet at (x, y): scale grows with its stage; `t` drives the bobbing and blinking
// o (the pet living in the room, see PA): flip (+1 / -1 facing), hop (height above the floor), look (-1..1, where its eyes point), sleep, happy
function drawPet(p, x, y, sc = 1, t = tg, o = {}) {
  const st = petStage(p.love), s = sc * (.78 + st * .1), hop = o.hop != null ? o.hop : Math.max(0, Math.sin(t * 2.2)) * 6 * s, fl = o.flip || 1, lk = (o.look || 0) * 2.2 * fl;
  ctx.save(); ctx.translate(x, y - hop); ctx.scale(s * fl, s * (1 + (o.sleep ? .02 : .04) * Math.sin(t * (o.sleep ? 1.6 : 4.4))));
  withDye(dyeHue(p.dye | 0), () => {
    const body = '#ffc4de', dark = '#ff9ccf';
    if (st >= 4) { ctx.globalAlpha = .2 + .08 * Math.sin(t * 2); ctx.fillStyle = '#ffe566'; dcirc(0, -34, 46); ctx.fill(); ctx.globalAlpha = 1; }
    if (st >= 3) { ctx.fillStyle = '#fff'; for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sg * 24, -32, 9, 18, sg * .7 + Math.sin(t * 5) * .08 * sg, 0, 7); ctx.fill(); } }   // wings
    if (p.kind === 'kit') { ctx.strokeStyle = dark; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(18, -10); ctx.quadraticCurveTo(40, -14, 34, -40); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, -20, 22, 20, 0, 0, 7); dfill(body, '#fff', 3);
    if (p.kind === 'bun') for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sg * 10, -66, 7, 17, sg * .15, 0, 7); dfill(body, '#fff', 3); ctx.fillStyle = '#ffb3d6'; ctx.beginPath(); ctx.ellipse(sg * 10, -64, 3, 11, sg * .15, 0, 7); ctx.fill(); }
    else if (p.kind === 'kit') for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sg * 20, -50); ctx.lineTo(sg * 18, -70); ctx.lineTo(sg * 5, -57); dfill(body, '#fff', 3); }
    else for (const sg of [-1, 1]) { dcirc(sg * 17, -58, 8); dfill(body, '#fff', 3); }
    dcirc(0, -40, 18); dfill(body, '#fff', 3); ctx.fillStyle = C.ink; const blink = o.sleep ? .5 : o.happy ? 1.3 : Math.sin(t * 1.3) > .97 ? .5 : 3; ctx.beginPath(); ctx.ellipse(-6.5 + lk, -41, 2.6, blink, 0, 0, 7); ctx.ellipse(6.5 + lk, -41, 2.6, blink, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,120,170,.6)'; dcirc(-12, -36, 3.6); ctx.fill(); dcirc(12, -36, 3.6); ctx.fill(); ctx.fillStyle = C.ink;
    if (o.happy) { ctx.beginPath(); ctx.arc(0, -36, 4, 0, Math.PI); ctx.fillStyle = '#b03a5a'; ctx.fill(); }   // a happy open mouth
    else { ctx.beginPath(); ctx.arc(0, -36, 3, .2 * Math.PI, .8 * Math.PI); ctx.lineWidth = 1.6; ctx.strokeStyle = C.ink; ctx.stroke(); }
    if (st >= 1) { ctx.fillStyle = '#ff5fb0'; ctx.beginPath(); ctx.moveTo(10, -54); ctx.lineTo(24, -62); ctx.lineTo(24, -46); ctx.fill(); ctx.beginPath(); ctx.moveTo(10, -54); ctx.lineTo(-4, -62); ctx.lineTo(-4, -46); ctx.fill(); dcirc(10, -54, 4); ctx.fill(); }   // bow
    if (st >= 2) { ctx.fillStyle = '#c9a8ff'; rr(-17, -27, 34, 8, 4); ctx.fill(); rr(8, -26, 8, 16, 3); ctx.fill(); }   // scarf
    if (st >= 3) { ctx.fillStyle = '#ffd75e'; ctx.beginPath(); ctx.moveTo(-14, -56); ctx.lineTo(-14, -70); ctx.lineTo(-7, -62); ctx.lineTo(0, -74); ctx.lineTo(7, -62); ctx.lineTo(14, -70); ctx.lineTo(14, -56); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }   // crown
    if (st >= 5) { ctx.strokeStyle = '#ffe566'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -82, 15, 4.5, 0, 0, 7); ctx.stroke(); }   // halo
  });
  ctx.restore();
}

/* ---------- the pet in the room ----------
   It wanders (in little hops, often toward the jelly), looks at the jelly, jumps when you squish or hop it nearby, cheers when you tap it, and curls up asleep when nothing
   has happened for a while. PA is only its position and mood; nothing here is saved. */
const PA = { x: 330, tx: 330, face: 1, walk: 0, yo: 0, vy: 0, mode: 'idle', t: 2, cheer: 0, look: 0, asleep: false, hopSnd: 0, react: 0, still: 0 };
const petScale = () => .95 * (.78 + petStage(store.pet.love) * .1);
function petJump(v = 300) { if (PA.yo < 4) PA.vy = v; PA.asleep = false; PA.still = 0; }
function petHearts(n = 3) { if (simming) return; for (let i = 0; i < n; i++) spawn({ x: PA.x + (Math.random() - .5) * 26, y: RM.b - 60 * petScale() * 1.5, vx: (Math.random() - .5) * 70, vy: -70 - Math.random() * 60, g: 60, type: 'heart', size: 5 + Math.random() * 3, life: .9, max: .9, col: '#ff7ab8' }); }
function petReact(kind) {   // 'hop' (the jelly hopped), 'thump' (it landed hard nearby), 'pet' (a tap)
  if (!store.pet || studio || tg - PA.react < .5) return; PA.react = tg;
  if (kind === 'pet') { PA.cheer = 1.4; petJump(330); sfx.petHappy(); petHearts(4); buzz(8); PA.mode = 'idle'; PA.t = 2; return; }
  if (kind === 'hop') { PA.cheer = .9; petJump(260); sfx.petHop(); return; }
  PA.cheer = .5; petJump(200); sfx.petHop();
}
function petHit(mx, my) { if (!store.pet || studio) return false; const s = petScale(); return Math.abs(mx - PA.x) < 34 * s * 1.2 && my > RM.b - 100 * s - PA.yo && my < RM.b + 8; }
function petStep(dt) {
  if (!store.pet || studio) return;
  const bb = room.bounds(), jx = (bb.minx + bb.maxx) / 2, near = Math.abs(jx - PA.x) < 190;
  PA.look = clamp((jx - PA.x) / 220, -1, 1); PA.cheer = Math.max(0, PA.cheer - dt);
  // hop physics (vertical)
  if (PA.yo > 0 || PA.vy > 0) { PA.vy -= 1500 * dt; PA.yo += PA.vy * dt; if (PA.yo <= 0) { PA.yo = 0; PA.vy = 0; } }
  const busy = room.grabs.length || room.inds.length || room.deform > 80;
  PA.still = busy ? 0 : PA.still + dt;
  if (room.impact > 520 && near) petReact('thump');
  if (PA.asleep) { if (PA.still < 2 || PA.cheer > 0) { PA.asleep = false; PA.mode = 'idle'; PA.t = 1.2; } return; }
  if (PA.still > 16 && PA.mode !== 'walk' && !PA.cheer) { PA.asleep = true; return; }
  if (PA.mode === 'walk') {
    const dx = PA.tx - PA.x, sp = 70 + 8 * petStage(store.pet.love);
    if (Math.abs(dx) < 4) { PA.mode = 'idle'; PA.t = 2 + Math.random() * 4; PA.walk = 0; }
    else { PA.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt); PA.face = dx > 0 ? 1 : -1; PA.walk += dt * 7; if (PA.yo < 1) { const h = Math.abs(Math.sin(PA.walk)) * 9; PA.yo = Math.max(PA.yo, 0); PA.walkHop = h; } if (Math.sin(PA.walk) < 0 && Math.sin(PA.walk - dt * 7) >= 0 && tg - PA.hopSnd > .6) { PA.hopSnd = tg; sfx.petHop(); } }
    return;
  }
  PA.walkHop = 0; PA.t -= dt;
  if (PA.t <= 0) {
    PA.t = 2.5 + Math.random() * 4; const r = Math.random();
    if (r < .62) { PA.tx = clamp(r < .3 ? jx + (Math.random() - .5) * 260 : RM.l + 70 + Math.random() * (RM.r - RM.l - 140), RM.l + 50, RM.r - 50); if (Math.abs(PA.tx - PA.x) > 40) PA.mode = 'walk'; }
    else if (r < .8) { petJump(240); if (Math.random() < .5) sfx.petHop(); }
    else PA.face = -PA.face;
  }
}
const petHopY = () => PA.yo + (PA.mode === 'walk' ? (PA.walkHop || 0) : 0);

/* ---------- squish room ---------- */
let lastPress = 0;
function roomStep(dt) {
  roomHopT -= dt; petStep(dt);
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
  if (roomHopT > 0) return; roomHopT = .18; room.push(0, -760); room.kick(380, 160); sfx.jump(); if (Math.abs(room.bounds().cx - PA.x) < 260) petReact('hop');
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
  if (button !== 2 && petHit(mx, my) && !pointInBody(mx, my)) { petReact('pet'); return; }   // a tap on the pet pets it
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
