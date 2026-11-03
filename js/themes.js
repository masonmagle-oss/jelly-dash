'use strict';
/* Jelly Dash — Colour themes for the world.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= themes ================= */
const TH = [
  { top: '#ffe3f1', bot: '#d8c2ff', acc: '#ff8fc7', acc2: '#c86bff', hill: '#f6b8e0', hill2: '#e7a6ff' },  // bubblegum
  { top: '#cdeeff', bot: '#ffd0ea', acc: '#a98bff', acc2: C.pink, hill: '#b8e1ff', hill2: '#d6c4ff' },  // sky
  { top: '#fff0c4', bot: '#ffbfd6', acc: '#ff9a7a', acc2: '#ff4f9a', hill: '#ffd9a8', hill2: '#ffb0c8' },  // peach
  { top: '#d9fff0', bot: '#c9d8ff', acc: '#5fd3b0', acc2: '#7a8cff', hill: '#bdf0dc', hill2: '#c6d2ff' },  // mint
  { top: '#e8d6ff', bot: '#ffc0e0', acc: '#b07cff', acc2: '#ff62b8', hill: '#d5bcff', hill2: '#ffb6dc' },  // lavender
  { top: '#ffd3c4', bot: '#c7a0ff', acc: '#ff7aa8', acc2: '#9a5bff', hill: '#ffc0b0', hill2: '#c9a8ff' },  // sunset
  { top: '#9d8be8', bot: '#f3a6d8', acc: '#8a6cff', acc2: '#ff6fb5', hill: '#7b66c4', hill2: '#b07fe0' },  // twilight (Night Garden)
  { top: '#d2fbdc', bot: '#a6ecda', acc: '#3fd68a', acc2: '#7a8cff', hill: '#a6efc6', hill2: '#b9e3ff' },  // slime (Slime Palace)
];
const PALS = [[0, 1, 2], [3, 4, 5], [4, 1, 0], [2, 5, 3], [1, 3, 4], [5, 0, 3], [6, 4, 5], [7, 3, 1]];
function theme(p, pal) {
  p = Math.round(clamp(p, 0, 1) * 100) / 100;   // quantised so the sprite caches stay valid between colour steps
  const k = clamp(p, 0, .9999) * (pal.length - 1), i = Math.floor(k);
  let u = k - i; u = u * u * (3 - 2 * u);
  const a = TH[pal[i]], b = TH[pal[i + 1]], o = {};
  for (const key in a) o[key] = mix(a[key], b[key], u);
  return o;
}
