'use strict';
/* Jelly Dash — The beam-search solver that proves levels can be beaten.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= beam-search solver =================
   Tries every hold/release pattern (in 4-frame slices) and keeps a diverse beam of surviving states.
   Used both to verify the official levels and for the editor's "Verify" button. */
function* solveGen() {
  simming = true; const hbSave = HB; HB = HB_DEF;   // verification always uses the strictest hitbox, so a verified level works with every hazard
  const sv = { state, mode, ghost, P: { ...P }, held: inp.held, buf: inp.buf };
  try {
    mode = 'dash'; ghost = 0;
    Object.assign(P, { wx: 0, form: 'cube', h: CUBE_H, y: GY - CUBE_H, vy: 0, grounded: true, coy: COY });
    pads.forEach(p => { p.cool = 0; p.sq = 0; }); orbs.forEach(o => { o.used = false; });
    const snap = () => ({ P: { ...P }, pc: pads.map(p => p.cool), oc: orbs.map(o => o.used), h: inp.held });
    const rest = s => { Object.assign(P, s.P); pads.forEach((p, i) => { p.cool = s.pc[i]; }); orbs.forEach((o, i) => { o.used = s.oc[i]; }); };
    let layer = [snap()], maxwx = 0; const CAP = 320, sizes = [];
    // how many distinct states survive at each moment = how much freedom the player has there; the minimum is the level's tightest spot
    const report = ok => { let mn = 1e9, at = 0; for (const [n, w] of sizes) if (w > FINISH * .04 && n < mn) { mn = n; at = w / FINISH; } return { ok, pct: ok ? 100 : Math.floor(maxwx / FINISH * 100), tightest: mn === 1e9 ? 0 : mn, tightestAtPct: Math.round(at * 100), sizes }; };
    for (let it = 0; layer.length && it < 60000; it++) {
      const next = new Map();
      for (const s of layer) for (let hold = 0; hold < 2; hold++) {
        rest(s); inp.held = !!hold; inp.buf = (!autoHold && hold && !s.h) ? .12 : 0; inp.pt = -1; state = 'play'; let dead = false;   // tap levels: a press = the rising edge of "hold"
        for (let k = 0; k < 4; k++) { stepPlayer(STEP, SPEED, true); if (state === 'win') return report(true); if (state !== 'play') { dead = true; break; } }
        if (dead) continue;
        let spent = 0; for (const o of orbs) if (o.used) spent++;
        const key = P.form + Math.round(P.y / 5) + ':' + Math.round(P.vy / 50) + (P.grounded ? 'g' : 'a') + (!autoHold ? (hold ? 'h' : 'n') : '') + (spent ? 'o' + spent : '');
        if (!next.has(key)) next.set(key, snap());
      }
      layer = [...next.values()]; sizes.push([layer.length, layer.length ? layer[0].P.wx : 0]);
      if (layer.length > CAP) { layer.sort((a, b) => a.P.y - b.P.y || a.P.vy - b.P.vy); const st = layer.length / CAP; layer = Array.from({ length: CAP }, (_, i) => layer[Math.floor(i * st)]); }
      for (const s of layer) if (s.P.wx > maxwx) maxwx = s.P.wx;
      if (it % 8 === 0) { state = 'solving'; yield maxwx / FINISH; }   // the steps above leave state at 'play': put the screen back before handing control to the frame loop, or the check never shows and the editor starts running the level
    }
    return report(false);
  } finally { HB = hbSave; simming = false; state = sv.state; mode = sv.mode; ghost = sv.ghost; Object.assign(P, sv.P); inp.held = sv.held; inp.buf = sv.buf; }
}
// the narrowest takeoff window among the simple hazards (spike groups, gaps, blocks) in the current level, in ms at its tempo
function tightNote() {
  let best = null; for (const c of clusters) if (!c.ship && (!best || c.win < best.win)) best = c;
  if (!best) return '';
  const ms = Math.round(best.win / (SPEED / T) * 1000);
  return `  Tightest jump window: ${ms} ms (${best.kind}${best.n > 1 ? ' x' + best.n : ''}).`;
}
function solveSync(L, ms = 20000) {
  buildLevel(L); const g = solveGen(), t0 = performance.now(); let r;
  while (!(r = g.next()).done) if (performance.now() - t0 > ms) { g.return(); return { ok: false, timeout: true }; }
  return r.value;
}
// The most hearts one winning run can collect. Same search as solveGen, but every state also carries the set of hearts it has touched; per physics state it
// keeps up to `keep` records with different sets (a record is dropped when another one already has all of its hearts). The result is a lower bound, so
// best === total proves every heart can be had in one run. `missed` lists the hearts the best run leaves behind, in level units: move or remove those.
function* heartsGen(keep = 6, cap = Infinity) {   // runs on the level that buildLevel() last built; yields progress (0..1) like solveGen. `cap` limits the states kept per step (as solveGen does) to trade accuracy for speed: a capped search can only miss hearts, never claim one it did not collect
  simming = true; const hbSave = HB; HB = HB_DEF;
  const sv = { state, mode, ghost, P: { ...P }, held: inp.held, buf: inp.buf };
  try {
    mode = 'dash'; ghost = 0;
    Object.assign(P, { wx: 0, form: 'cube', h: CUBE_H, y: GY - CUBE_H, vy: 0, grounded: true, coy: COY });
    pads.forEach(p => { p.cool = 0; p.sq = 0; }); orbs.forEach(o => { o.used = false; });
    const NW = Math.ceil(hearts.length / 32) || 1;
    const pop = m => { let c = 0; for (let i = 0; i < NW; i++) { let v = m[i]; while (v) { v &= v - 1; c++; } } return c; };
    const subset = (a, b) => { for (let i = 0; i < NW; i++) if ((a[i] & ~b[i]) !== 0) return false; return true; };   // every heart of a is also in b
    const snap = () => ({ P: { ...P }, pc: pads.map(p => p.cool), oc: orbs.map(o => o.used), h: inp.held });
    const rest = s => { Object.assign(P, s.P); pads.forEach((p, i) => { p.cool = s.pc[i]; }); orbs.forEach((o, i) => { o.used = s.oc[i]; }); };
    let layer = [{ s: snap(), m: new Int32Array(NW), c: 0 }], best = null, won = false, maxwx = 0;
    for (let it = 0; layer.length && it < 60000 && !won; it++) {
      const next = new Map();
      for (const r of layer) for (let hold = 0; hold < 2; hold++) {
        rest(r.s); inp.held = !!hold; inp.buf = (!autoHold && hold && !r.s.h) ? .12 : 0; inp.pt = -1; state = 'play'; let dead = false;
        hearts.forEach(h => { h.got = false; });
        for (let k = 0; k < 4; k++) { stepPlayer(STEP, SPEED, true); if (state === 'win') break; if (state !== 'play') { dead = true; break; } }
        if (dead) continue;
        const m = Int32Array.from(r.m); hearts.forEach((h, i) => { if (h.got) m[i >> 5] |= 1 << (i & 31); });
        const c = pop(m);
        if (state === 'win') { won = true; if (!best || c > best.c) best = { c, m }; continue; }
        let spent = 0; for (const o of orbs) if (o.used) spent++;
        const key = P.form + Math.round(P.y / 5) + ':' + Math.round(P.vy / 50) + (P.grounded ? 'g' : 'a') + (!autoHold ? (hold ? 'h' : 'n') : '') + (spent ? 'o' + spent : '');
        const arr = next.get(key) || []; next.set(key, arr);
        if (arr.some(q => subset(m, q.m))) continue;
        const kept = arr.filter(q => !subset(q.m, m)); kept.push({ s: snap(), m, c });
        if (kept.length > keep) { kept.sort((a, b) => b.c - a.c); kept.length = keep; }
        next.set(key, kept);
      }
      layer = []; for (const arr of next.values()) for (const q of arr) { layer.push(q); if (q.s.P.wx > maxwx) maxwx = q.s.P.wx; }
      if (layer.length > cap) { layer.sort((a, b) => a.s.P.y - b.s.P.y || a.s.P.vy - b.s.P.vy); const st = layer.length / cap; layer = Array.from({ length: cap }, (_, i) => layer[Math.floor(i * st)]); }
      if (it % 8 === 0) { state = 'solving'; yield maxwx / FINISH; }   // as in solveGen: put the screen back before handing control to the frame loop
    }
    if (!best) return { ok: false, total: hearts.length, best: 0, missed: [] };
    const missed = []; hearts.forEach((h, i) => { if (!(best.m[i >> 5] & (1 << (i & 31)))) missed.push({ x: Math.round((h.x / T - .5) * 1000) / 1000, y: Math.round(((GY - h.y) / T - .5) * 1000) / 1000 }); });
    return { ok: true, total: hearts.length, best: best.c, missed };
  } finally { HB = hbSave; simming = false; state = sv.state; mode = sv.mode; ghost = sv.ghost; Object.assign(P, sv.P); inp.held = sv.held; inp.buf = sv.buf; hearts.forEach(h => { h.got = false; }); }
}
function heartsSync(L, keep = 6) {   // synchronous version, for tests
  buildLevel(L); const g = heartsGen(keep); let r; while (!(r = g.next()).done); return r.value;
}
// The hearts of L that no winning run can collect together with the rest, at Normal and at Spicy pace (the paces that keep hearts); [{x, y}] in level units.
// Yields progress (0..1). Removing the union leaves every other heart collectable at both paces: hearts never change the physics.
function* unreachableHearts(L, keep = 6, cap = Infinity) {
  const paces = [1, 1.12], bad = [];
  for (let k = 0; k < paces.length; k++) {
    buildLevel(Object.assign({}, L, { bpm: (L.bpm || BASE_BPM) * paces[k] }));
    const g = heartsGen(keep, cap); let r;
    try { while (!(r = g.next()).done) yield (k + r.value) / paces.length; } finally { g.return(); }
    if (r.value.ok) for (const m of r.value.missed) if (!bad.some(b => b.x === m.x && b.y === m.y)) bad.push(m);
  }
  return bad;
}
// Settings for levels made at run time (the daily level, the editor's Check): 3 records per state and at most 200 states per step, about 5x faster than the
// full search on levels with a ship section (3 s instead of 18 s here) and the same answer in every case tried. The official levels use the full search.
const QUICK_HEARTS = [3, 200];
function dropHearts(L, bad) {   // removes those hearts from L.objs; returns how many went
  const n = L.objs.length;
  if (bad.length) L.objs = L.objs.filter(o => o.t !== 'heart' || !bad.some(m => Math.abs(o.x - m.x) < .002 && Math.abs(o.y - m.y) < .002));
  return n - L.objs.length;
}
// The editor's Check: proves the level can be beaten, then drops the hearts nobody can collect in a winning run (one Undo brings them back).
function* checkGen() {
  const g = solveGen(); let r;
  try { while (!(r = g.next()).done) yield r.value * .5; } finally { g.return(); }
  if (!r.value.ok) return r.value;
  const u = unreachableHearts(edLevel, ...QUICK_HEARTS); let q;
  try { while (!(q = u.next()).done) yield .5 + q.value * .5; } finally { u.return(); }
  let dropped = 0; if (q.value.length) { edPush(); dropped = dropHearts(edLevel, q.value); if (dropped) edDirty = true; }
  return Object.assign({}, r.value, { dropped });
}
let solver = null, solverPct = 0, solveDone = null;   // solveDone: what to do with the result when the solver was started for something other than the editor (the daily level)
function cancelSolve() {
  if (solver) solver.return(); solver = null;
  if (solveDone) { solveDone = null; buildLevel(OFFICIAL[0]); resetRun(); state = 'select'; say('Cancelled', 1.5); return; }
  buildLevel(edLevel); state = 'edit'; say('Check cancelled');
}
