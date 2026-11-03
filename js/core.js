'use strict';
/* Jelly Dash — Design tokens, constants, canvas fitting and small helpers.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= design tokens =================
   One place for the look. New UI should take its colours and text sizes from here; the sprite/theme palettes (TH, SKINS, HAZ) stay as data. */
const C = {
  pink: '#ff5fb0',   // main accent: titles, labels, button text
  hot: '#ff3d8b',    // selected / active / hearts
  plum: '#d6489a',   // outline behind white text, so it reads on any background
  mauve: '#b85aa0',  // secondary text
  blush: '#ffb3dc',  // button and card outlines
  ink: '#4a1d5c',    // text inside the jelly's face and on light cards
  gold: '#ffc933',   // stars, orbs, rewards
  mint: '#5fe3b8',   // checkpoints and "good" states
  dim: 'rgba(60,20,70,.5)',   // the backdrop behind every modal and result screen
  card: 'rgba(255,255,255,.78)',
};
const TS = { min: 13, small: 15, body: 18, label: 20, title: 26, hero: 64 };   // text sizes: nothing on screen is drawn below TS.min

/* ================= constants & helpers ================= */
const W = 960, H = 540, T = 48, GY = 420, PX = 220;
// The game is laid out on a fixed 960x540 STAGE. On a wider screen the canvas grows sideways: VX extra units show on each side (VW = W + 2 VX is the canvas width),
// the stage stays centred, every menu keeps its layout, and the world/backgrounds simply draw further out.
let VX = 0, VW = W; const VMAX = 1300;
const STEP = 1 / 120, CEIL = 84, SHIP_H = 26, CUBE_H = 34, BASE_BPM = 112.5, TPB = 4;   // TPB: tiles per beat, so one tile = a 16th note
// Tempo-scaled physics: a level's BPM sets its scroll speed, and all vertical motion is time-scaled by the same factor,
// so jump arcs cover exactly the same number of tiles at every tempo (layouts stay beatable at any BPM).
let K = 1, SPEED = 360, G = 3200, JUMP = 900, PAD = 1240, SHIP_UP = 3000, SHIP_DN = 2400, SHIP_VU = 520, SHIP_VD = 620, VCAP = 1250, autoHold = true, curBpm = BASE_BPM;   // curBpm: the tempo the current run is actually at (level BPM x the Pace setting)   // autoHold: holding jump re-hops on landing (easy levels); off = every hop needs its own tap
// Coyote time: seconds after running off a ledge during which a jump still works. It is level data (L.coy): the easy levels are strict, the ones with
// wide gaps need more (a 5-tile gap cannot be crossed without taking off from past the edge). Every value is proven by the solver; custom levels default to DEF_COY.
const DEF_COY = .09; let COY = DEF_COY;
function applyTempo(bpm) {
  K = (bpm || BASE_BPM) / BASE_BPM; SPEED = 360 * K; G = 3200 * K * K; JUMP = 900 * K; PAD = 1240 * K;
  SHIP_UP = 3000 * K * K; SHIP_DN = 2400 * K * K; SHIP_VU = 520 * K; SHIP_VD = 620 * K; VCAP = 1250 * K;
}
const cv = document.getElementById('c'); let ctx = cv.getContext('2d');

// Fit the 960x540 stage to the screen inside the safe area. Held upright (portrait) the stage is turned on its side so a phone with rotation
// locked still plays full size; pmap() undoes the turn for touches. renderQ is lowered by the frame-time governor on slow phones.
let portrait = false, renderQ = 1;
const sa = document.getElementById('sa');
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
function fit() {
  const R = sa.getBoundingClientRect(); portrait = R.height > R.width * 1.1;
  const aw = portrait ? R.height : R.width, ah = portrait ? R.width : R.height;
  VW = clampN(Math.round(H * aw / ah), W, VMAX); VX = (VW - W) / 2;   // as wide as the screen allows, never narrower than the stage
  const s = Math.min(aw / VW, ah / H), dpr = Math.min(devicePixelRatio || 1, 2) * renderQ, cw = VW * s, ch = H * s;
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  cv.style.left = (R.left + R.width / 2 - cw / 2) + 'px'; cv.style.top = (R.top + R.height / 2 - ch / 2) + 'px';
  cv.style.transform = portrait ? 'rotate(90deg)' : '';
  cv.width = Math.max(240, Math.min(1920, Math.round(cw * dpr))); cv.height = Math.round(cv.width * H / VW);
}
// iPhone Safari can report the old size for a moment after a turn, so refit on every signal and again a few times while it settles.
let fitTimers = [];
function refit() { fit(); fitTimers.forEach(clearTimeout); fitTimers = [100, 300, 700, 1500].map(ms => setTimeout(fit, ms)); }
addEventListener('resize', refit); addEventListener('orientationchange', refit); addEventListener('pageshow', refit);
if (window.visualViewport) visualViewport.addEventListener('resize', refit);
if (window.ResizeObserver) new ResizeObserver(fit).observe(sa);
let lastBox = '';   // safety net for browsers that skip the events above: refit whenever the safe area's size changes
setInterval(() => { const R = sa.getBoundingClientRect(), k = Math.round(R.width) + 'x' + Math.round(R.height); if (k !== lastBox) { lastBox = k; fit(); } }, 400);
fit();

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; };
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function heartPath(x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y + s);
  ctx.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.6, y - s * 1.15, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.15, x + s * 1.5, y - s * 0.1, x, y + s);
  ctx.closePath();
}
function sparklePath(x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.closePath();
}
function circle(x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
function txt(s, x, y, size, fill, stroke, align = 'center') {
  size = Math.max(size, TS.min);
  ctx.font = `700 ${size}px Fredoka,'Trebuchet MS',sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (stroke) { ctx.lineWidth = size * 0.22; ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
