'use strict';
/* Jelly Dash — The frame loop and debug hooks.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= loop ================= */
let last = performance.now(), acc = 0, govT = 0, govN = 0;
// leaving the app (or a call, or a lock screen) pauses the audio and lets go of every finger
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { release(null); if (AC && AC.state === 'running') AC.suspend(); }
  else { last = performance.now(); govT = 0; govN = 0; if (AC && !muted) AC.resume(); }
});
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; acc += dt; menuArm = Math.max(0, menuArm - dt); resetArm = Math.max(0, resetArm - dt);
  // frame-time governor: if a phone cannot hold ~50 fps at this render size, draw smaller (the physics is unaffected)
  govT += dt; govN++; if (govT >= 2) { const avg = govT / govN; if (avg > .021 && renderQ > .55 && document.visibilityState === 'visible') { renderQ = Math.max(.55, renderQ - .15); fit(); } govT = 0; govN = 0; }
  if (state === 'solving' && solver) {
    const t0 = performance.now();
    while (performance.now() - t0 < 14) {
      const r = solver.next();
      if (r.done && solveDone) { const f = solveDone; solver = null; solveDone = null; state = 'select'; f(r.value); break; }
      if (r.done) {
        solver = null; buildLevel(edLevel); state = 'edit';
        const v = r.value; say(v.ok ? '✓ Beatable! There is a way through.' + tightNote() : `✗ Couldn't find a way through (got to ${v.pct}%)`, 5); break;
      }
      solverPct = r.value;
    }
  } else while (acc >= STEP) { snapPrev(); update(STEP); acc -= STEP; }
  noteUiChange(performance.now());
  alphaR = acc / STEP; frameAcc = acc; frameNowWall = now;
  withInterp(draw); requestAnimationFrame(frame);
}
buildLevel(OFFICIAL[0]);
resetRun();
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.search.includes('debug') && !window.JD_TEST) navigator.serviceWorker.register('sw.js').catch(() => { });   // offline + installable when hosted at its own address

if (location.search.includes('debug') || window.JD_TEST) window.__jd = { TUNES, WORLD_TUNE, renderSongOffline, renderSfxOffline, playHit, SFX_TRIM, SFX_TARGET, SFX_HF_CEIL, UI_SFX, STYLES, VOICES, KITS, AMB, WORLDS, SONG_N, MENU_STYLE, styleCfg, menuWanted, sfx, HAZ, SKINS, setGhostMs: v => { ghostMs = v; }, normalizeStore, heartsSync, solveStart: () => solveGen_start(), setEdLevel: L => { edLevel = L; }, edPush, getView: () => ({ VX, VW }), getStore: () => store, getEd: () => edLevel, getEdScroll: () => edScroll, edUndo, edRedo, orbs, hitUi, getPcp: () => pcp, practiceSave, practiceUndo, getMode: () => mode, setMode: v => { mode = v; }, mouse, auditUi, getUi: () => ui, minHitUnits, getState: () => state, setState: v => { state = v; }, SQ_, makeDaily, levelCode, parseLevelCode, update, draw, jelly, room, P, OFFICIAL, genLevel, buildLevel, solveSync, startLevel, press, inp, parts, stepPlayer, STEP, resetRun, openEditor, edApply: (...a) => { edPaint = a[3] || { tool: edTool, last: null, val: true }; edApply(a[0], a[1], a[2]); }, get ed() { return edLevel; }, setTool: t => { edTool = t; }, get state() { return state; }, setState: s => { state = s; }, get store() { return store; }, get FINISH() { return FINISH; }, sanitize, portals, solids, spikes, gaps, pads, hearts, setSim: v => { simming = v; }, startStudio, studioStep, studioScore, SHAPES, prepShape, get studioState() { return { studioShape, studioSim, studioHold, studioCel, flow, studioFree, studioBestRot }; }, setStudioShape: i => { studioShape = i; prepShape(SHAPES[i]); studioHold = 0; studioArmed = false; }, STYLES, roomDown, roomMove, roomRelease, setPreset, SKINS, skinOpen, PRESETS, initAudio, get AC() { return AC; }, get song() { return song; }, get songT() { return songT; }, get combo() { return combo; }, clusters, get scoreNow() { return scoreNow; }, get judged() { return judged; }, get judgeN() { return judgeN; }, gameNow, get K() { return K; }, get SPEED() { return SPEED; }, get ghost() { return ghost; }, get cps() { return cps; } };
