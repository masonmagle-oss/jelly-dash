'use strict';
/* Jelly Dash — The main update step.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= main update ================= */
function update(dt) {
  tg += dt; shake = Math.max(0, shake - dt); toast.life -= dt;
  if (state === 'solving') return;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
  }
  const wantHum = state === 'play' && P.form === 'ship' && inp.held ? .04 : 0;
  if (wantHum !== humOn) { humOn = wantHum; setHum(wantHum); }
  syncMenuMusic(dt); ambTick();   // menus play their own songs; a run's world hums along quietly underneath
  if (state === 'room') { roomStep(dt); if (studio) studioStep(dt); return; }
  if (squelchOn) setSquelch(0, 'slime');
  if (state === 'edit') { if (edPreview) { songT += dt; songUpdate(.7); } return; }
  if (state === 'select' || state === 'settings') return;
  if (state === 'play') {
    if (mode === 'zen') {
      if (P.wx >= ghostX) ghost = Math.max(0, ghost - dt);
      cpT -= dt;
      if (cpT <= 0 && ghost <= 0 && ((P.form === 'cube' && P.grounded) || P.form === 'ship') && clearAhead()) { cps.push({ wx: P.wx, y: P.y, form: P.form }); cpT = .25; }
    }
    if (mode === 'practice' && store.autoCp !== false && P.wx >= pAutoX && P.form === 'cube' && P.grounded && clearAhead()) { practiceSave(true); pAutoX = P.wx + 14 * T; }
    { const hs = curLevel.hints; if (hs) while (hintI < hs.length && P.wx / T >= hs[hintI].x - 5) say(hs[hintI++].text, 4.2); }
    if (!store.seenOrb && orbs.length && orbs.some(o => !o.used && o.x - P.wx > 0 && o.x - P.wx < 7 * T)) { store.seenOrb = true; persist(); say('Orb! Tap while touching it for another jump', 3.5); }   // a one-time hint
    stepPlayer(dt, SPEED, !(mode === 'zen' && ghost > 0));
    softAfterCore(dt, state === 'play' ? SPEED : 0);
    if (state === 'play') {
      songT = P.wx / SPEED; songUpdate(clamp(P.wx / FINISH, 0, 1));
      const bd = 60 / curBpm, b = Math.floor(songT / bd);   // the jelly squishes on every beat
      if (b !== lastBeat) { lastBeat = b; jelly.kick(P.form === 'cube' && P.grounded ? 80 : 40, 30); }
      if (P.form === 'cube' && P.grounded && Math.random() < dt * 14)
        spawn({ x: P.wx + 4, y: P.y + P.h - Math.random() * 14, vx: -60 - Math.random() * 60, vy: -20 - Math.random() * 40, type: Math.random() < .5 ? 'star' : 'drop', size: 2.5 + Math.random() * 3, life: .5, max: .5, col: Math.random() < .5 ? '#fff' : C.blush });
      if (P.form === 'ship' && Math.random() < dt * (inp.held ? 60 : 12))
        spawn({ x: P.wx - 4, y: P.y + P.h / 2 + 3, vx: -120 - Math.random() * 120, vy: (Math.random() - .5) * 80, type: Math.random() < .6 ? 'star' : 'drop', size: 2.5 + Math.random() * 3, life: .45, max: .45, col: inp.held ? '#ffe9a0' : '#fff' });
    }
  } else if (state === 'title' || state === 'win') {
    titleT += dt; winT += dt;
    stepPlayer(dt, 0, false);
    if (P.grounded && titleT > 1.3) { titleT = 0; jumpFx(); }
    softAfterCore(dt, 0);
    if (state === 'win' && Math.random() < dt * 30)
      spawn({ x: P.wx + (Math.random() - .5) * 700, y: -10, vx: (Math.random() - .5) * 60, vy: 80 + Math.random() * 120, g: 40, type: 'conf', size: 5 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - .5) * 10, life: 4, max: 4, col: ['#ff6fb5', '#ffd1ec', '#c86bff', '#8fd8ff', '#fff3a8'][Math.floor(Math.random() * 5)] });
  } else if (state === 'dead') {
    deadT += dt;
    if (deadT > .7) restartRun();   // a precision game needs a fast retry loop
  }
}
