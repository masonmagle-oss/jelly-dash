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
let solver = null, solverPct = 0, solveDone = null;   // solveDone: what to do with the result when the solver was started for something other than the editor (the daily level)
function cancelSolve() {
  if (solver) solver.return(); solver = null;
  if (solveDone) { solveDone = null; buildLevel(OFFICIAL[0]); resetRun(); state = 'select'; say('Cancelled', 1.5); return; }
  buildLevel(edLevel); state = 'edit'; say('Check cancelled');
}
