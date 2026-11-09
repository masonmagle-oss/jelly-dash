'use strict';
/* Jelly Dash — Drawing the world.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= drawing: world ================= */
// Pre-rendered sprites for the gradient-heavy pieces; rebuilt only when the (quantised) theme changes.
const SPR = { key: '' };
let BP = 0;   // beat pulse (1 on the beat, decaying to 0), computed once per frame
function mkSprite(name, w, h, sc, paint) {
  let c = SPR[name]; if (c && (c.width !== w * sc || c.height !== h * sc)) c = SPR[name] = null;   // a different size (the stage got wider): start a fresh canvas
  if (!c) { c = SPR[name] = document.createElement('canvas'); c.width = w * sc; c.height = h * sc; }
  const g = c.getContext('2d'), old = ctx; g.setTransform(sc, 0, 0, sc, 0, 0); g.clearRect(0, 0, w, h); ctx = g;
  try { paint(); } finally { ctx = old; }
}
function ensureSprites(th) {
  const key = th.top + th.bot + th.acc + th.acc2 + '|' + (curHaz().id) + '|' + VW; HB = curHaz().hb; if (SPR.key === key) return; SPR.key = key;
  mkSprite('sky', VW + 60, H + 60, 1, () => { ctx.translate(30 + VX, 30); paintSky(th); });
  mkSprite('tile', T, T, 2, () => paintTile(0, 0, th));
  mkSprite('spike', T, 56, 2, () => curHaz().paint(0, th));
  mkSprite('ground', 288, H - GY + 40, 2, () => { ctx.translate(0, -GY); paintGround({ x0: 0, x1: 288 }, 0, th); });
  mkSprite('ceil', 288, CEIL + 30, 2, () => { ctx.translate(0, 30); paintCeil({ x0: 0, x1: 288, bot: CEIL }, 0, th); });
}
function paintSky(th) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.top); g.addColorStop(1, th.bot);
  ctx.fillStyle = g; ctx.fillRect(-30 - VX, -30, VW + 60, H + 60);
  const sg = ctx.createRadialGradient(740, 120, 10, 740, 120, 170);
  sg.addColorStop(0, 'rgba(255,255,255,.95)'); sg.addColorStop(.35, 'rgba(255,255,255,.35)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg; ctx.fillRect(500, 0, 460, 330);
}
function drawBg(scroll, th) {
  ensureSprites(th); ctx.drawImage(SPR.sky, -30 - VX, -30, VW + 60, H + 60);
  if (BP > .02) { ctx.fillStyle = 'rgba(255,255,255,' + (.1 * BP).toFixed(3) + ')'; ctx.fillRect(-30 - VX, -30, VW + 60, H + 60); }   // the whole world breathes on the beat
  ctx.fillStyle = '#fff'; ctx.globalAlpha = .7;
  for (const c of clouds) {
    const span = 1400 + 2 * VX, x = (((c.x - scroll * c.p) % span) + span) % span - 200 - VX;
    ctx.beginPath(); circle(x, c.y, 22 * c.s); circle(x + 24 * c.s, c.y - 12 * c.s, 28 * c.s); circle(x + 54 * c.s, c.y, 22 * c.s); circle(x + 28 * c.s, c.y + 6 * c.s, 24 * c.s); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const hills = (par, base, amp, f, col, a) => {
    ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-10 - VX, H);
    for (let x = -10 - VX; x <= W + 10 + VX; x += 16) { const wx = x + scroll * par; ctx.lineTo(x, base + Math.sin(wx * f) * amp + Math.sin(wx * f * 2.3 + 1) * amp * .4); }
    ctx.lineTo(W + 10 + VX, H); ctx.fill(); ctx.globalAlpha = 1;
  };
  hills(.25, 350, 28, .0042, th.hill2, .75); hills(.5, 385, 22, .0065, th.hill, .9);
  for (const f of floaters) {
    const span = 1400 + 2 * VX, x = (((f.x - scroll * .45) % span) + span) % span - 200 - VX, y = f.y + Math.sin(tg * 1.4 + f.ph) * 8;
    ctx.globalAlpha = .55; ctx.fillStyle = f.k === 'h' ? '#fff' : '#fff7b8';
    if (f.k === 'h') heartPath(x, y, f.s); else sparklePath(x, y, f.s * 1.3);
    ctx.fill(); ctx.globalAlpha = 1;
  }
}
function drawGround(s, scroll) {
  const x0 = Math.max(s.x0 - scroll, -30 - VX), x1 = Math.min(s.x1 - scroll, W + 30 + VX);
  if (x1 <= x0) return;
  ctx.save(); ctx.beginPath(); ctx.rect(x0, GY, x1 - x0, H - GY + 40); ctx.clip();
  for (let sx = Math.floor((x0 + scroll) / 288) * 288; sx < x1 + scroll; sx += 288) ctx.drawImage(SPR.ground, sx - scroll, GY, 289, H - GY + 40);
  ctx.restore();
}
function paintGround(s, scroll, th) {
  const x0 = Math.max(s.x0 - scroll, -30 - VX), x1 = Math.min(s.x1 - scroll, W + 30 + VX);
  if (x1 <= x0) return;
  const g = ctx.createLinearGradient(0, GY, 0, H); g.addColorStop(0, th.acc); g.addColorStop(1, th.acc2);
  ctx.fillStyle = g; ctx.fillRect(x0, GY, x1 - x0, H - GY + 40);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath();
  for (let wx = Math.floor((x0 + scroll) / T) * T; wx < x1 + scroll; wx += T) {
    const k = Math.round(wx / T), px = wx - scroll + T / 2;
    circle(px, GY + 46, 8); circle(px + (k % 2 ? T / 2 : -T / 2), GY + 84, 8);
  }
  ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(x0, GY, x1 - x0, 12); ctx.beginPath();
  for (let wx = Math.floor((x0 + scroll) / 24) * 24; wx < x1 + scroll; wx += 24) { const k = Math.round(wx / 24); circle(wx - scroll + 12, GY + 11, 9 + (k % 3) * 2.2); }
  ctx.fill();
}
function drawCeil(s, scroll) {
  const x0 = Math.max(s.x0 - scroll, -30 - VX), x1 = Math.min(s.x1 - scroll, W + 30 + VX);
  if (x1 <= x0) return;
  ctx.save(); ctx.beginPath(); ctx.rect(x0, -30, x1 - x0, s.bot + 30); ctx.clip();
  for (let sx = Math.floor((x0 + scroll) / 288) * 288; sx < x1 + scroll; sx += 288) ctx.drawImage(SPR.ceil, sx - scroll, -30, 289, CEIL + 30);
  ctx.restore();
}
function paintCeil(s, scroll, th) {
  const x0 = Math.max(s.x0 - scroll, -30 - VX), x1 = Math.min(s.x1 - scroll, W + 30 + VX);
  if (x1 <= x0) return;
  const g = ctx.createLinearGradient(0, -20, 0, s.bot); g.addColorStop(0, th.acc2); g.addColorStop(1, th.acc);
  ctx.fillStyle = g; ctx.fillRect(x0, -30, x1 - x0, s.bot + 30);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath();
  for (let wx = Math.floor((x0 + scroll) / T) * T; wx < x1 + scroll; wx += T) { const px = wx - scroll + T / 2; circle(px, s.bot - 44, 8); circle(px + T / 2, s.bot - 82, 8); }
  ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(x0, s.bot - 12, x1 - x0, 12); ctx.beginPath();
  for (let wx = Math.floor((x0 + scroll) / 24) * 24; wx < x1 + scroll; wx += 24) { const k = Math.round(wx / 24); circle(wx - scroll + 12, s.bot - 1, 9 + (k % 3) * 2.2); }
  ctx.fill();
}
function drawBlock(s, scroll) {
  const x0 = s.x0 - scroll; if (x0 > W + 60 + VX || s.x1 - scroll < -60 - VX) return;
  const w = Math.round((s.x1 - s.x0) / T);
  for (let tx = 0; tx < w; tx++) { const x = x0 + tx * T; if (x < -T - VX || x > W + VX) continue; for (let ty = 0; ty < s.h; ty++) ctx.drawImage(SPR.tile, x, s.top + ty * T, T, T); }
}
function paintTile(x, y, th) {
  {
    const g = ctx.createLinearGradient(x, y, x, y + T); g.addColorStop(0, '#fff'); g.addColorStop(.12, th.acc); g.addColorStop(1, th.acc2);
    ctx.fillStyle = g; rr(x + 1.5, y + 1.5, T - 3, T - 3, 11); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); rr(x + 1.5, y + 1.5, T - 3, T - 3, 11); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x - 4, y + T - 6); ctx.lineTo(x + T - 6, y - 4); ctx.moveTo(x + 12, y + T + 6); ctx.lineTo(x + T + 6, y + 12); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.8)'; heartPath(x + T / 2, y + T / 2 + 1, 6); ctx.fill();
  }
}
// A gooey strand from the ledge to the jelly while coyote time is running: it thins and fades as the grace runs out, so a late jump reads as intended
function drawStrand(scroll, bb) {
  const k = clamp(P.coy / COY, 0, 1), sk = curSkin(), ex = P.ledgeX - scroll, ey = P.ledgeY, fx = bb.cx - scroll - 4, fy = bb.maxy - 7;
  const mx = (ex + fx) / 2, my = Math.max(ey, fy) + 4 + Math.hypot(fx - ex, fy - ey) * .22 * (1 - k * .5);
  ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = .55 + .45 * k;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 6 + 8 * k; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.quadraticCurveTo(mx, my, fx, fy); ctx.stroke();   // white outline, like everything sticky in this world
  ctx.strokeStyle = sk.g[2]; ctx.lineWidth = 3 + 6 * k; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.quadraticCurveTo(mx, my, fx, fy); ctx.stroke();
  ctx.fillStyle = sk.g[2]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(ex, ey - 1, 6 + 4 * k, 3.4 + 2 * k, 0, 0, 7); ctx.fill(); ctx.stroke();   // the blob that clings to the ledge
  ctx.restore();
}
function drawCheckpoint(c, scroll) {   // a mint diamond where you will come back
  const x = c.wx + P.w / 2 - scroll; if (x < -30 - VX || x > W + 30 + VX) return;
  const y = c.y + c.h / 2 + Math.sin(tg * 3 + c.wx * .01) * 3;
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = 'rgba(95,227,184,.9)'; rr(-9, -9, 18, 18, 4); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
  ctx.fillStyle = 'rgba(95,227,184,.25)'; ctx.beginPath(); ctx.arc(x, y, 18 + BP * 4, 0, 7); ctx.fill();
}
function drawOrb(o, scroll) {
  const x = o.x - scroll; if (x < -50 - VX || x > W + 50 + VX) return;
  const y = o.y + Math.sin(tg * 3 + o.x * .02) * 3, p = 1 + BP * .12, r = 15 * p;
  ctx.save(); if (o.used) ctx.globalAlpha = .3;
  ctx.fillStyle = 'rgba(255,224,120,.32)'; ctx.beginPath(); ctx.arc(x, y, r + 11, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(x - 4, y - 5, 2, x, y, r + 2); g.addColorStop(0, '#fffbe0'); g.addColorStop(.55, '#ffd75e'); g.addColorStop(1, '#ff9f3d');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.setLineDash([5, 6]); ctx.lineDashOffset = -tg * 22; ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(x, y, r + 8, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(x - 5, y - 6, 4, 2.4, -.6, 0, 7); ctx.fill();
  ctx.restore();
}
function drawSpike(s, scroll) {
  const x = s.x - scroll; if (x < -60 - VX || x > W + 60 + VX) return;
  const a = curHaz().idle(tg + s.x * .013, BP);   // each hazard idles in its own way (looks only; the hitbox never moves)
  if (a) { const py = s.base - (a.py || 0), cx = x + T / 2; ctx.save(); ctx.translate(cx, py); ctx.rotate(a.rot || 0); ctx.scale(a.sx || 1, a.sy || 1); ctx.translate(-cx, -py); ctx.drawImage(SPR.spike, x, s.base - 52, T, 56); ctx.restore(); }
  else ctx.drawImage(SPR.spike, x, s.base - 52, T, 56);
  ctx.fillStyle = '#fff'; sparklePath(x + T / 2, s.base - 52 + Math.sin(tg * 4 + s.x) * 2, 6 + BP * 4); ctx.fill();
}
function paintGumdrop(x, th) {
  const s = { base: 52 };
  // a sugar-dusted gumdrop: soft rounded dome, same footprint and height as the old spike so every level plays the same
  const g = ctx.createLinearGradient(x, s.base - 46, x, s.base); g.addColorStop(0, '#fff0fa'); g.addColorStop(.5, th.acc2); g.addColorStop(1, th.acc);
  ctx.beginPath(); ctx.moveTo(x + 3, s.base);
  ctx.bezierCurveTo(x + 5, s.base - 30, x + T / 2 - 11, s.base - 46, x + T / 2, s.base - 46);
  ctx.bezierCurveTo(x + T / 2 + 11, s.base - 46, x + T - 5, s.base - 30, x + T - 3, s.base); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.85)';   // sugar crystals
  for (const [u, v] of [[.32, 14], [.62, 20], [.45, 30], [.74, 34], [.26, 38]]) { ctx.beginPath(); ctx.arc(x + u * T, s.base - v, 1.6, 0, 7); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.lineCap = 'round';   // glossy highlight
  ctx.beginPath(); ctx.moveTo(x + 14, s.base - 12); ctx.quadraticCurveTo(x + 15, s.base - 28, x + 21, s.base - 36); ctx.stroke();
}

// ---- hazard looks: every one keeps the same footprint and hitbox (about 22 px wide, 30 px tall at the middle), so levels play identically ----
function paintTaffy(x, th) {
  const B = 52, g = ctx.createLinearGradient(x, B - 22, x, B); g.addColorStop(0, C.blush); g.addColorStop(1, C.pink);
  const hump = () => { ctx.beginPath(); ctx.moveTo(x + 2, B); ctx.bezierCurveTo(x + 2, B - 13, x + 10, B - 22, x + T / 2, B - 22); ctx.bezierCurveTo(x + T - 10, B - 22, x + T - 2, B - 13, x + T - 2, B); ctx.closePath(); };
  hump(); ctx.fillStyle = g; ctx.fill();
  ctx.save(); hump(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (let i = -2; i < 7; i++) { ctx.beginPath(); ctx.moveTo(x + i * 10, B); ctx.lineTo(x + i * 10 + 5, B); ctx.lineTo(x + i * 10 + 19, B - 26); ctx.lineTo(x + i * 10 + 14, B - 26); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  hump(); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 11, B - 8); ctx.quadraticCurveTo(x + 12, B - 15, x + 19, B - 18); ctx.stroke();
}
function paintPeppermint(x, th) {
  const cx = x + T / 2, cy = 52 - 20, r = 19;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip(); ctx.fillStyle = '#ff5f9e';
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r * 1.4, a, a + Math.PI / 6); ctx.quadraticCurveTo(cx + Math.cos(a + .3) * r * .7, cy + Math.sin(a + .3) * r * .7, cx, cy); ctx.fill(); }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.lineWidth = 3.4; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r - 1.7, 0, 7); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,95,158,.55)'; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, r - 6, Math.PI * 1.05, Math.PI * 1.4); ctx.stroke();
}
function paintCloud(x, th) {
  const B = 52, puffs = [[x + 14, B - 13, 12], [x + 24, B - 22, 15], [x + 35, B - 13, 12.5]];
  const shape = fn => { for (const [px, py, pr] of puffs) { ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); fn(); } rr(x + 3, B - 14, T - 6, 14, 7); fn(); };
  ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(196,160,236,.95)'; shape(() => ctx.stroke());
  const g = ctx.createLinearGradient(x, B - 38, x, B); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ece0ff'); ctx.fillStyle = g; shape(() => ctx.fill());
  ctx.strokeStyle = '#8a6aa8'; ctx.lineWidth = 2; ctx.lineCap = 'round';   // a sleepy little face
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(x + T / 2 + sg * 7, B - 17, 3.2, .15 * Math.PI, .85 * Math.PI); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(x + T / 2, B - 13, 2.6, .1 * Math.PI, .9 * Math.PI); ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,180,.4)'; for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + T / 2 + sg * 13, B - 12, 3.4, 2.2, 0, 0, 7); ctx.fill(); }
}
function paintSlime(x, th) {
  const B = 52, mound = () => { ctx.beginPath(); ctx.moveTo(x + 1, B); ctx.quadraticCurveTo(x + 5, B - 26, x + 17, B - 27); ctx.quadraticCurveTo(x + 24, B - 40, x + 31, B - 27); ctx.quadraticCurveTo(x + 43, B - 26, x + T - 1, B); ctx.closePath(); };
  const g = ctx.createLinearGradient(x, B - 38, x, B); g.addColorStop(0, '#d9ffe6'); g.addColorStop(.5, '#6fe8a8'); g.addColorStop(1, '#2fc77f');
  mound(); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; ctx.fillStyle = 'rgba(255,255,255,.35)';
  for (const [u, v, r] of [[.3, 12, 3.4], [.62, 9, 2.4], [.5, 22, 2.8], [.76, 18, 1.8]]) { ctx.beginPath(); ctx.arc(x + u * T, B - v, r, 0, 7); ctx.fill(); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 12, B - 15); ctx.quadraticCurveTo(x + 13, B - 24, x + 19, B - 28); ctx.stroke();
}
// selectable, unlockable hazards (same rule as the jelly skins: beat official levels)
// (v5) each also has its own idle motion, its own bump sound (soft, never harsh) and its own burst colours
const HAZ = [
  { id: 'gumdrop', name: 'Gumdrop', need: 0, paint: paintGumdrop, hb: HB_DEF, col: ['#c86bff', '#ffb3f0', '#ff8fd8', '#fff'],
    idle: (t, bp) => ({ sy: 1 + .06 * bp, sx: 1 - .03 * bp }),
    hit: () => { tone(260, .28, { to: 120, vol: .08 }); tone(560, .2, { to: 300, vol: .05, type: 'triangle' }); noiseHit({ f0: 900, f1: 300, q: 3, d: .22, vol: .12 }); tone(mf(79), .5, { vol: .03, at: .05 }); } },
  { id: 'taffy', name: 'Taffy Hill', need: 1, paint: paintTaffy, hb: { x: 19, h: 12 }, note: 'forgiving', info: '~20% wider jump window', col: ['#ff8fc7', '#fff', C.blush, '#ff5fa8'],
    idle: t => ({ rot: Math.sin(t * 2.2) * .06, sx: 1 + .05 * Math.sin(t * 3.1), sy: 1 - .04 * Math.sin(t * 3.1) }),
    hit: () => { tone(520, .5, { to: 140, vol: .09, type: 'triangle' }); tone(140, .35, { to: 300, vol: .06, at: .25 }); noiseHit({ f0: 1200, f1: 500, q: 2, d: .3, vol: .07 }); } },
  { id: 'mint', name: 'Peppermint', need: 2, paint: paintPeppermint, hb: HB_DEF, col: ['#ff5f9e', '#fff', '#ff8fb8', '#ffe0ee'],
    idle: t => ({ rot: t * .9, py: 20 }),
    hit: () => { for (let i = 0; i < 4; i++) noiseHit({ f0: 4200, f1: 2600, q: 2, d: .035, vol: .06, at: i * .035 }); tone(mf(88), .6, { vol: .05, att: .003 }); tone(mf(95), .45, { vol: .03, att: .003, at: .06 }); } },
  { id: 'cloud', name: 'Sleepy Puff', need: 4, paint: paintCloud, hb: HB_DEF, col: ['#ffffff', '#e8dcff', '#d6c4ff', '#ffe0f2'],
    idle: t => ({ sy: 1 + .045 * Math.sin(t * 2.4), sx: 1 - .025 * Math.sin(t * 2.4) }),
    hit: () => { noiseHit({ f0: 700, f1: 250, q: .7, d: .45, vol: .09 }); tone(330, .5, { to: 220, vol: .05, type: 'triangle', att: .05 }); tone(mf(72), 1, { vol: .025, att: .08, at: .05 }); } },
  { id: 'slime', name: 'Slime Patch', need: 6, paint: paintSlime, hb: HB_DEF, col: ['#6fe8a8', '#d9ffe6', '#2fc77f', '#fff'],
    idle: (t, bp) => { const y = 1 + .08 * Math.sin(t * 4) + .05 * bp; return { sy: y, sx: 1 / Math.sqrt(y) }; },
    hit: () => { noiseHit({ f0: 800, f1: 180, q: 2.4, d: .35, vol: .16 }); tone(130, .3, { to: 55, vol: .06 }); tone(300, .22, { to: 120, vol: .06, type: 'triangle' }); noiseHit({ f0: 1600, f1: 700, q: 3, d: .1, vol: .06, at: .12 }); } },
];
const hazOpen = i => doneCount() >= HAZ[i].need;
const curHaz = () => { const i = store.haz | 0; return HAZ[i] && hazOpen(i) ? HAZ[i] : HAZ[0]; };
function drawPad(p, scroll) {
  const x = p.x - scroll; if (x < -60 - VX || x > W + 60 + VX) return;
  const sq = 1 - p.sq * .35, h = 22 * sq + p.sq * 10, B = p.base;
  const g = ctx.createLinearGradient(0, B - h, 0, B); g.addColorStop(0, '#ffd1ec'); g.addColorStop(1, '#ff4fa3');
  ctx.beginPath(); ctx.moveTo(x + 2, B); ctx.bezierCurveTo(x + 4, B - h * 1.5, x + T - 4, B - h * 1.5, x + T - 2, B); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(x + 17, B - h * .8, 6, 3, -.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; heartPath(x + T / 2, B - h - 14 - Math.sin(tg * 6) * 3, 5); ctx.fill();
}
function drawHeart(h, scroll) {
  const x = h.x - scroll; if (x < -30 - VX || x > W + 30 + VX) return;
  const y = h.y + Math.sin(tg * 3 + h.x * .01) * 4, pulse = 1 + Math.sin(tg * 6 + h.x) * .05 + BP * .16;
  ctx.fillStyle = 'rgba(255,255,255,.55)'; heartPath(x, y, 17 * pulse); ctx.fill();
  ctx.fillStyle = C.hot; heartPath(x, y, 13 * pulse); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(x - 5, y - 5, 3.2, 2, -.6, 0, 7); ctx.fill();
}
function drawPortal(p, scroll) {
  const x = p.x - scroll; if (x < -60 - VX || x > W + 60 + VX) return;
  const ship = p.to === 'ship', c1 = ship ? C.pink : '#4fd1b8', c2 = ship ? '#ffd1ec' : '#d8fff4', cy = (CEIL + GY) / 2, ry = (GY - CEIL) / 2 + 6;
  const g = ctx.createRadialGradient(x, cy, 10, x, cy, ry); g.addColorStop(0, ship ? 'rgba(255,95,176,.0)' : 'rgba(79,209,184,0)'); g.addColorStop(1, ship ? 'rgba(255,95,176,.35)' : 'rgba(79,209,184,.35)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, cy, 30, ry, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 3; i++) { ctx.strokeStyle = i === 0 ? '#fff' : (i === 1 ? c1 : c2); ctx.lineWidth = i === 0 ? 5 : 3; ctx.beginPath(); ctx.ellipse(x, cy, 16 + Math.sin(tg * 3 + i * 2) * 3 + i * 3, ry - i * 4, 0, 0, 7); ctx.stroke(); }
  for (let i = 0; i < 6; i++) { const a = tg * 1.6 + i * 1.05; ctx.fillStyle = '#fff'; sparklePath(x + Math.cos(a) * 20, cy + Math.sin(a) * (ry - 6), 4 + Math.sin(a * 3) * 1.5); ctx.fill(); }
  ctx.fillStyle = c1; rr(x - 22, cy - ry - 22, 44, 22, 11); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  txt(ship ? 'SHIP' : 'CUBE', x, cy - ry - 11, 13, '#fff', null);
}
function drawFinish(scroll, th) {
  const x = FINISH - scroll; if (x < -300 - VX || x > W + 100 + VX) return;
  for (const px of [x, x + 140]) {
    const g = ctx.createLinearGradient(px, 0, px + 14, 0); g.addColorStop(0, '#fff'); g.addColorStop(1, th.acc);
    ctx.fillStyle = g; rr(px - 7, GY - 240, 14, 240, 7); ctx.fill();
    ctx.fillStyle = C.hot; heartPath(px, GY - 252, 14); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
  const bg = ctx.createLinearGradient(x, 0, x + 140, 0); bg.addColorStop(0, th.acc); bg.addColorStop(1, th.acc2);
  ctx.fillStyle = bg; rr(x - 6, GY - 215, 152, 58, 16); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  txt('FINISH', x + 70, GY - 185, 28, '#fff', C.plum);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = '#fff'; sparklePath(x + 70 + Math.cos(tg * 1.5 + i) * 110, GY - 190 + Math.sin(tg * 2 + i * 2) * 60, 5 + Math.sin(tg * 5 + i) * 2); ctx.fill(); }
}
function drawParts(scroll) {
  for (const p of parts) {
    const x = p.x - scroll, a = clamp(p.life / p.max * 1.6, 0, 1);
    ctx.globalAlpha = a; ctx.fillStyle = p.col;
    if (p.type === 'drop') { ctx.beginPath(); ctx.arc(x, p.y, p.size * (.5 + a * .5), 0, 7); ctx.fill(); }
    else if (p.type === 'star') { sparklePath(x, p.y, p.size * 1.4); ctx.fill(); }
    else if (p.type === 'heart') { heartPath(x, p.y, p.size); ctx.fill(); }
    else if (p.type === 'ring') {
      const u = 1 - p.life / p.max, r = lerp(6, p.size, 1 - Math.pow(1 - u, 2));
      ctx.globalAlpha = (1 - u) * .7; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * (1 - u) + .5;
      ctx.beginPath(); ctx.ellipse(x, p.y, r, r * (p.size > 80 ? 1 : .22), 0, 0, 7); ctx.stroke();
    } else if (p.type === 'txt') {
      ctx.globalAlpha = a; ctx.font = `700 ${p.size}px Fredoka,'Trebuchet MS',sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.strokeText(p.text, x, p.y); ctx.fillStyle = p.col; ctx.fillText(p.text, x, p.y);
    } else { ctx.save(); ctx.translate(x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
}
function drawWorld(scroll, th, withFinish = true) {
  for (const s of solids) { if (s.x1 - scroll < -60 - VX || s.x0 - scroll > W + 60 + VX) continue; if (s.ground) drawGround(s, scroll, th); else if (s.ceil) drawCeil(s, scroll, th); else drawBlock(s, scroll, th); }
  for (const p of pads) drawPad(p, scroll);
  for (const o of orbs) drawOrb(o, scroll);
  if (mode === 'practice' && (state === 'play' || state === 'dead')) for (const c of pcp) drawCheckpoint(c, scroll);
  for (const s of spikes) drawSpike(s, scroll, th);
  for (const h of hearts) if (!h.got) drawHeart(h, scroll);
  for (const p of portals) drawPortal(p, scroll);
  if (store.guides !== false && (state === 'play' || state === 'dead' || state === 'title')) {   // "jump here" footprints at each hazard's ideal takeoff: they sit on the beat
    for (const c of clusters) {
      if (c.ship || c.done) continue;
      const x = c.ideal * T - scroll; if (x < PX - 10 || x > W + 30 + VX) continue;
      const near = clamp(1 - (x - PX) / 420, 0, 1);
      ctx.save(); ctx.globalAlpha = .45 + .35 * near; ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, GY + 9, 17 + BP * 4, 5 + BP * 1.5, 0, 0, 7); ctx.stroke();
      ctx.strokeStyle = C.hot; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(x, GY + 9, 17 + BP * 4, 5 + BP * 1.5, 0, 0, 7); ctx.stroke();
      ctx.restore();
    }
  }
  if (withFinish) drawFinish(scroll, th);
}

// ship hull + glass dome around the jelly
function drawShipBack(scroll) {
  const cx = P.wx + P.w / 2 - scroll, cy = P.y + P.h / 2, tilt = clamp(P.vy / 1100, -.5, .5) * .6;
  ctx.save(); ctx.translate(cx, cy + 3); ctx.rotate(tilt);
  if (inp.held && state === 'play') {
    const f = 10 + Math.random() * 8;
    ctx.fillStyle = 'rgba(255,236,150,.95)'; ctx.beginPath(); ctx.moveTo(-28, -4); ctx.quadraticCurveTo(-28 - f, -3, -28 - f * 1.9, 0); ctx.quadraticCurveTo(-28 - f, 3, -28, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,120,190,.9)'; ctx.beginPath(); ctx.moveTo(-28, -2); ctx.quadraticCurveTo(-28 - f * .6, -1, -28 - f, 0); ctx.quadraticCurveTo(-28 - f * .6, 1, -28, 2); ctx.fill();
  }
  ctx.fillStyle = '#ff7ab8'; heartPath(-26, -10, 7); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  const g = ctx.createLinearGradient(0, -9, 0, 10); g.addColorStop(0, '#fff'); g.addColorStop(.3, '#ffc2e4'); g.addColorStop(1, '#ff5fa8');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 34, 10, 0, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = '#fff3a8'; ctx.beginPath(); for (let i = -2; i <= 2; i++) circle(i * 11, 2.5, 2.3); ctx.fill();
  ctx.restore();
}
function drawShipFront(scroll) {
  const cx = P.wx + P.w / 2 - scroll, cy = P.y + P.h / 2, tilt = clamp(P.vy / 1100, -.5, .5) * .6;
  ctx.save(); ctx.translate(cx, cy + 1); ctx.rotate(tilt);
  ctx.beginPath(); ctx.moveTo(-26, -4); ctx.ellipse(0, -4, 26, 28, 0, Math.PI, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, -4, 20, Math.PI * 1.1, Math.PI * 1.35); ctx.stroke();
  ctx.restore();
}

// glossy translucent soft body drawn straight from the simulated particles
const BUB = [[-.4, .28, 3], [.34, .32, 2.2], [.08, .58, 1.6], [-.12, -.12, 1.4], [.46, -.02, 1.8], [-.5, -.2, 2], [.2, -.3, 1.2], [-.1, .7, 1.8], [.55, .35, 1.4]];
const _gr = rng(21), GL = Array.from({ length: 18 }, () => { const a = _gr() * 6.283, r = Math.sqrt(_gr()) * .85; return [Math.cos(a) * r, Math.sin(a) * r, _gr()]; });
// collectible skins: the first two are free, the rest unlock as you clear official levels
const SKINS = [
  { name: 'Strawberry', g: ['#ffd9ef', '#ff9acb', '#ff5fa8'], rim: '#e8479f', bub: 5, glit: 0, need: 0 },
  { name: 'Glitter Pop', g: ['#ffe6f7', '#ffb0e0', '#ff7fc4'], rim: '#e0509f', bub: 3, glit: 1, gcol: '#fff2a8', need: 0 },
  { name: 'Aqua Gel', g: ['#e3fcff', '#8fe3f5', '#4fc3e8'], rim: '#2a9cc4', bub: 9, glit: 0, need: 1 },
  { name: 'Mint Mochi', g: ['#e9fff4', '#9ff0c8', '#4fd6a0'], rim: '#26a77a', bub: 4, glit: .5, gcol: '#ffffff', need: 3 },
  { name: 'Lilac Dream', g: ['#f3e8ff', '#cba8ff', '#9a6bff'], rim: '#7a45d6', bub: 5, glit: 1, gcol: '#ffd6f5', need: 5 },
  { name: 'Galaxy', g: ['#c8b5ff', '#8465f0', '#4b30b8'], rim: '#a98bff', bub: 2, glit: 1.6, gcol: '#ffffff', need: 8 },
];
// skins unlock by beating official levels; every 3 Studio stars or Squish Room goals counts as one more level
const doneCount = () => OFFICIAL.filter(l => !l.tutorial && (store.best[l.id] || 0) >= 100).length + Math.floor((Object.values(store.studio.stars).reduce((a, b) => a + b, 0) + goalsDone()) / 3);
const skinOpen = i => doneCount() >= SKINS[i].need;
const curSkin = () => { const i = store.skin | 0; return SKINS[i] && skinOpen(i) ? SKINS[i] : SKINS[0]; };
function drawSoft(s, scroll, o = {}) {
  const { n, x, y, R } = s, bb = s.bounds(), w = bb.maxx - bb.minx, h = bb.maxy - bb.miny, k = R / 23, sk = o.skin || curSkin();
  const pt = i => [x[i] - scroll, y[i]];
  const m = Math.max(1, Math.round(n / 12));
  let rx = 0, ry = 0, lx = 0, ly = 0;
  for (let q = -m; q <= m; q++) { const a = (q + n) % n, b = (Math.round(n / 2) + q + n) % n; rx += x[a]; ry += y[a]; lx += x[b]; ly += y[b]; }
  const th = clamp(Math.atan2(ry - ly, rx - lx), -.7, .7), cx = bb.cx - scroll, cy = bb.cy;
  ctx.save();
  ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
  // squash/stretch about the feet applies to everything; the spin (tumble in the air) applies to the body only, so the face stays upright
  const squash = () => { if (o.sy) { ctx.translate(cx, bb.maxy); ctx.scale(o.sx, o.sy); ctx.translate(-cx, -bb.maxy); } };
  const spin = () => { if (o.rot) { ctx.translate(cx, bb.cy); ctx.rotate(o.rot); ctx.translate(-cx, -bb.cy); } };
  const gnd = o.ground, gdist = gnd - bb.maxy;
  if (gdist < 260) { ctx.fillStyle = `rgba(120,30,90,${.22 * clamp(1 - gdist / 260, 0, 1)})`; ctx.beginPath(); ctx.ellipse(cx, gnd + 4, w * .55, 5 + 2 * k, 0, 0, 7); ctx.fill(); }
  ctx.save(); spin(); squash();
  const path = () => {
    ctx.beginPath(); const p0 = pt(n - 1), p1 = pt(0); ctx.moveTo((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
    for (let i = 0; i < n; i++) { const p = pt(i), q = pt((i + 1) % n); ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(0, bb.miny, 0, bb.maxy); g.addColorStop(0, sk.g[0]); g.addColorStop(.5, sk.g[1]); g.addColorStop(1, sk.g[2]);
  path(); ctx.fillStyle = g; ctx.fill();
  ctx.save(); path(); ctx.clip();
  const sub = ctx.createRadialGradient(cx, bb.maxy, 2, cx, bb.maxy, Math.max(w, h) * .7); sub.addColorStop(0, 'rgba(255,255,255,.4)'); sub.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sub; ctx.fillRect(bb.minx - scroll - 10, bb.miny - 10, w + 20, h + 20);
  const gl = ctx.createRadialGradient(cx - w * .2, bb.miny + h * .25, 1, cx - w * .2, bb.miny + h * .25, w * .45); gl.addColorStop(0, 'rgba(255,255,255,.6)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(bb.minx - scroll - 10, bb.miny - 10, w + 20, h + 20);
  ctx.strokeStyle = 'rgba(190,40,120,.25)'; ctx.lineWidth = 6 * k; path(); ctx.stroke();
  ctx.restore();
  path(); ctx.lineWidth = 3.4; ctx.lineJoin = 'round'; ctx.strokeStyle = sk.rim; ctx.stroke();
  const ct = Math.cos(th), st = Math.sin(th);
  if (sk.glit) {   // glitter flecks that twinkle inside the gel
    const cnt = Math.round(GL.length * clamp(sk.glit / 1.6, .3, 1));
    for (let gi = 0; gi < cnt; gi++) {
      const [u, v, ph] = GL[gi], bx = u * w * .42, by = v * h * .4, px = cx + bx * ct - by * st, py = cy + bx * st + by * ct, tw = .5 + .5 * Math.sin(tg * 3 + ph * 6.28);
      ctx.save(); ctx.globalAlpha *= .35 + .65 * tw; ctx.fillStyle = gi % 3 === 0 ? sk.gcol : '#fff'; sparklePath(px, py, (1.4 + tw * 2.4) * k); ctx.fill(); ctx.restore();
    }
  }
  for (const [u, v, r] of BUB.slice(0, sk.bub)) {
    const bx = u * w * .42 + Math.sin(tg * 1.3 + u * 9) * 1.5, by = v * h * .36 + Math.cos(tg * 1.1 + v * 7) * 1.5;
    const px = cx + bx * ct - by * st, py = cy + bx * st + by * ct;
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(px, py, r * k, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(px - r * k * .3, py - r * k * .3, r * k * .28, 0, 7); ctx.fill();
  }
  ctx.save(); ctx.translate(cx - w * .26 * ct, cy - h * .3); ctx.rotate(th - .6);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(0, 0, w * .13, h * .06, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(w * .17, h * .1, 1.8 * k, 0, 7); ctx.fill(); ctx.restore();
  ctx.restore(); ctx.save(); squash();   // face: squashed with the body but never rotated
  const sxF = clamp(w / (2 * R * .98), .55, 1.5) * k, syF = clamp(h / (2 * R * .86), .55, 1.5) * k, dark = C.ink;
  ctx.save(); ctx.translate(cx, cy + h * .02); ctx.rotate(th); ctx.scale(sxF, syF);
  const blink = (tg % 3.4) < .13 ? .1 : 1, squint = o.squint || (h / w < .62);
  for (const sg of [-1, 1]) {
    const ex = sg * 9.5, ey = -2;
    if (o.happy || squint) { ctx.strokeStyle = dark; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); if (squint && !o.happy) { ctx.moveTo(ex - sg * 4, ey - 3); ctx.lineTo(ex + sg * 3, ey); ctx.lineTo(ex - sg * 4, ey + 3); } else ctx.arc(ex, ey + 3, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    else {
      ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(ex, ey, 4.8, 6.5 * blink, 0, 0, 7); ctx.fill();
      if (blink > .5) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex - 1.5, ey - 2.5, 1.9, 0, 7); ctx.arc(ex + 1.6, ey + 2, 1, 0, 7); ctx.fill(); }
    }
    ctx.fillStyle = 'rgba(255,50,140,.45)'; ctx.beginPath(); ctx.ellipse(sg * 16, 6, 4.4, 2.8, 0, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.lineCap = 'round';
  if (o.open) { ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(0, 7, 2.8, 3.4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#ff7ab0'; ctx.beginPath(); ctx.ellipse(0, 8.6, 1.7, 1.3, 0, 0, 7); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(0, 3.5, o.happy ? 5 : 3.6, .12 * Math.PI, .88 * Math.PI); ctx.stroke(); }
  ctx.restore();
  ctx.save(); spin(); squash();   // the bow rides on the spinning body
  const bi = Math.round(n * 310 / 360) % n, bp = pt(bi), dx = bp[0] - cx, dy = bp[1] - cy, dl = Math.hypot(dx, dy) || 1;
  ctx.save(); ctx.translate(bp[0] + dx / dl, bp[1] + dy / dl); ctx.rotate(th - .35 + Math.atan2(dy, dx) * .15 + .5);
  ctx.scale(k, k); ctx.fillStyle = '#ff2d8f'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sg * 8, 0, 8.5, 5.6, sg * .35, 0, 7); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#d61a75'; ctx.beginPath(); ctx.arc(0, 0, 3.8, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); circle(-9, -1, 1.2); circle(9, -1, 1.2); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.restore();
}
