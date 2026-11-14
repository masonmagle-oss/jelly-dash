/* The difficulty "pressure" model, shared by the test suite (tests/suite.js) and the level generator (tests/gen.html). Needs the game loaded (window.__jd).
   Pressure = how much the player has to get right per second. Every hazard is an event and counts 1000 / (its window of safe takeoffs, in ms at the level's tempo),
   so a narrow window or a faster tempo weighs more. Windows come from buildLevel's clusters (in tiles, so they shrink as the tempo rises). A spike group of 4+ or a gap of 6+
   is crossed with a pad or orb, which are counted as their own (medium) events. A ship row counts by how far its corridor moves from the last one (a big move leaves less slack).
   Returns { P: pressure, secs: length in seconds, n: events, tight: the narrowest window in ms }. */
'use strict';
window.pressureOf = L => {
  const J = window.__jd; J.buildLevel(L); const K = L.bpm / 112.5, msTile = 1000 * T / (360 * K); let w = 0, n = 0, tight = Infinity;
  const add = ms => { w += 1000 / ms; n++; tight = Math.min(tight, ms); };
  for (const c of clusters) {
    if (c.ship) continue;
    if (L.puff && c.kind === 'gap' && c.n >= 6) { add((c.n >= 8 ? 130 : c.n === 7 ? 170 : 220) / K); continue; }   // a wide gap in a puff level: hop and float across (the narrower the time to take off, the heavier)
    if (L.bounce && c.kind === 'block' && c.h >= 3) { add(260 / K); continue; }   // a tall block in a bounce level: land, tap just before touching down, spring over it
    if (L.bounce && c.kind === 'gap' && c.n >= 6) { add(200 / K); continue; }
    if ((c.kind === 'spike' && c.n >= 4) || (c.kind === 'gap' && c.n >= 6)) continue; add(Math.max(c.win * msTile, 45));
  }
  J.pads.forEach(() => add(300 / K)); for (const o of L.objs) if (o.t === 'orb') add(180 / K);
  for (const s of solids) if (s.gate) add(215 / K);   // a gummy gate: squish in time (about a fifth of a second of room at 112 BPM)
  for (const m of L.script.matchAll(/ship:(\d+)/g)) [...m[1]].map(Number).forEach((s, i, a) => add(Math.max(120, 330 - 45 * Math.abs(s - (i ? a[i - 1] : 2))) / K));
  return { P: w / (L.len * T / (360 * K)), secs: L.len * T / (360 * K), n, tight };
};
