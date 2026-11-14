/* The level generator for tests/gen.html. Builds candidate levels for a world from a spec, keeps the ones whose difficulty is on target and that the solver can beat at every pace,
   removes the hearts nobody can collect, and prints entries to paste into js/packs.js. The suite (tests/suite.js) proves every shipped level again, so this is a filter, not the authority.
   Spec (JSON):
     w           world index the levels belong to (0-4 are the built-in worlds; 5 and up come from PACK_WORLDS in js/packs.js)
     idStart     first id number (ids are 'p' + number and are saved with progress: never reuse one)
     count       how many levels to make for this world; levels climb from the first target to the last (the last is the world's boss)
     bpm [a, b]  tempo of the first and last level      P [a, b]  target pressure of the first and last level (the model in tests/pressure.js; the hand-made levels run 2.1 to 6.4)
     tiles [a, b]   allowed length in tiles (proof time grows faster than length: keep the boss short and dense)
     powers      any of: squish, puff, bounce, ship, orbs      styles   song style indexes to pick from      names   level names, in order      seed   any number
     tries       candidates to try per level (default 400)      tol   how far from the target pressure a level may land (default .12) */
'use strict';
(() => {
  const J = window.__jd, $ = id => document.getElementById(id), log = s => { const e = $('log'); e.textContent += s + '\n'; e.scrollTop = 1e9; };
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  // the pattern vocabulary: [token, difficulty 0..1, needs]. Difficulty is how tight the pattern is; a level picks mostly patterns near its own difficulty.
  const VOCAB = [
    ['s1', .02], ['s2', .08], ['g2', .05], ['g3', .1], ['b21', .05], ['b32', .1], ['stairs', .15], ['bsp', .15], ['rest', 0], ['dbl', .35],
    ['pad', .45], ['padh', .35], ['g4', .4], ['ss212', .45], ['ss232', .5], ['gs32', .5], ['gs33', .45], ['gs31', .6], ['s3', .6],
    ['ss321', .75], ['ss331', .8], ['ss121', .85], ['g5', .8], ['gs22', .7],
    ['fl2', .3, 'squish'], ['fl3', .4, 'squish'], ['fs22', .5, 'squish'], ['fs23', .55, 'squish'], ['fs32', .6, 'squish'], ['fs33', .7, 'squish'],
    ['pg6', .55, 'puff'], ['pg7', .7, 'puff'], ['pg8', .85, 'puff'], ['pp63', .65, 'puff'], ['pp73', .8, 'puff'],
    ['b33', .5, 'bounce'], ['b34', .7, 'bounce'], ['b44', .85, 'bounce'],
    ['og5', .4, 'orbs'], ['og6', .5, 'orbs'], ['og7', .65, 'orbs'], ['os5', .4, 'orbs'], ['os6', .5, 'orbs'],
  ];
  const shipRows = (r, n) => { let s = 2, out = ''; for (let i = 0; i < n; i++) { s = Math.max(0, Math.min(4, s + Math.floor(r() * 5) - 2)); out += s; } return 'ship:' + out; };
  const pick = (r, list, t, jit) => {   // weighted: patterns near the difficulty t (plus a little jitter) are most likely
    const c = Math.max(0, Math.min(1, t + (r() - .5) * jit)); let tot = 0; const w = list.map(v => { const x = Math.exp(-Math.pow(v[1] - c, 2) / .035); tot += x; return x; });
    let q = r() * tot; for (let i = 0; i < list.length; i++) { q -= w[i]; if (q <= 0) return list[i]; } return list[list.length - 1];
  };
  const candidate = (spec, r, t, i) => {
    const has = p => spec.powers.includes(p), list = VOCAB.filter(v => !v[2] || has(v[2])), nseg = 8 + Math.floor(r() * 9), toks = []; let ships = 0;
    for (let k = 0; k < nseg; k++) {
      let tok;
      if (has('ship') && ships < 2 && k > 2 && k < nseg - 2 && toks[toks.length - 1] && !toks[toks.length - 1].startsWith('ship') && r() < .12) { tok = shipRows(r, 4 + Math.floor(r() * 4)); ships++; }
      else { const v = pick(r, list, t, .3); tok = v[0]; if (toks.length >= 2 && toks[toks.length - 1] === tok && toks[toks.length - 2] === tok) continue; }
      toks.push(tok);
    }
    for (const p of ['puff', 'bounce', 'squish']) if (has(p)) { const re = p === 'puff' ? /^p[gp]/ : p === 'bounce' ? /^b(33|34|44)/ : /^f[ls]/; if (toks.filter(x => re.test(x)).length < 2) return null; }   // a level that offers a power uses it
    const x = {}; if (has('puff')) x.puff = true; if (has('bounce')) x.bounce = true;
    const bpm = Math.round(spec.bpm[0] + (spec.bpm[1] - spec.bpm[0]) * t), coy = Math.round((.05 + .01 * Math.min(4, Math.round(t * 4))) * 100) / 100;
    return { script: toks.join(' '), bpm, coy, x };
  };
  const starsOf = P => Math.max(1, Math.min(5, 1 + Math.floor((P - 1.8) / 1.1)));
  const drive = async g => { let r, t0 = performance.now(); while (!(r = g.next()).done) { if (performance.now() - t0 > 40) { await new Promise(res => setTimeout(res, 0)); t0 = performance.now(); if (window.__genStop) { g.return(); throw new Error('stopped'); } } } return r.value; };
  const beatAt = async (L, pace) => { J.buildLevel(Object.assign({}, L, { bpm: L.bpm * pace })); return (await drive(solveGen())).ok; };
  window.runGen = async spec => {
    const out = [], r = rng(spec.seed || 1); window.__genStop = false; spec.tries = spec.tries || 400;
    for (let i = 0; i < spec.count; i++) {
      const t = spec.count === 1 ? 1 : i / (spec.count - 1), target = spec.P[0] + (spec.P[1] - spec.P[0]) * t, id = 'p' + (spec.idStart + i), name = spec.names[i] || 'Level ' + id; let best = null;
      log(`${name}: target pressure ${target.toFixed(2)}, ${Math.round(spec.bpm[0] + (spec.bpm[1] - spec.bpm[0]) * t)} BPM`);
      const tol = spec.tol || .12, st = { noPower: 0, len: 0, pressure: 0, unbeatable: 0, lo: 99, hi: 0 }; let tc = Math.min(1, .15 + t * .8);   // tc: the difficulty the patterns are drawn near; it steers toward the target
      for (let k = 0; k < spec.tries && !best; k++) {
        const c = candidate(spec, r, tc, i); if (!c) { st.noPower++; continue; }
        const L = J.genLevel(id, name, 1, [0, 1, 2], c.script, c.bpm, 0, true, c.coy, Object.keys(c.x).length ? c.x : null), pr = window.pressureOf(L);
        st.lo = Math.min(st.lo, pr.P); st.hi = Math.max(st.hi, pr.P);
        if (pr.P < target - tol) tc = Math.min(1, tc + .02); else if (pr.P > target + tol) tc = Math.max(0, tc - .02);
        if (L.len < spec.tiles[0] || L.len > spec.tiles[1]) { st.len++; continue; }
        if (Math.abs(pr.P - target) > tol) { st.pressure++; continue; }
        if (!(await beatAt(L, 1)) || !(await beatAt(L, .85)) || !(await beatAt(L, 1.12))) { st.unbeatable++; continue; }   // the cheap screen first (pace 1), then the other two
        best = { c, L, pr };
      }
      if (!best) { log(`  no candidate found in ${spec.tries} tries: ${st.noPower} without enough power patterns, ${st.len} outside ${spec.tiles[0]}-${spec.tiles[1]} tiles, ${st.pressure} off the pressure target, ${st.unbeatable} not beatable at every pace; pressure seen ${st.lo.toFixed(2)}-${st.hi.toFixed(2)} (want ${(target - tol).toFixed(2)}-${(target + tol).toFixed(2)}). Widen P, tiles, tol or tries.`); break; }
      log(`  found: ${best.L.len} tiles, pressure ${best.pr.P.toFixed(2)}; finding hearts nobody can collect...`);
      let lastPct = -1; const gh = unreachableHearts(best.L, 6), bad = await (async () => { let q; while (!(q = gh.next()).done) { const p = Math.floor(q.value * 20) * 5; if (p !== lastPct) { lastPct = p; log(`  hearts ${p}%`); } await new Promise(res => setTimeout(res, 0)); if (window.__genStop) { gh.return(); throw new Error('stopped'); } } return q.value; })();
      const entry = { id, w: spec.w, n: name, st: starsOf(best.pr.P), sc: best.c.script, bpm: best.c.bpm, sty: spec.styles[Math.floor(r() * spec.styles.length)], coy: best.c.coy };
      if (Object.keys(best.c.x).length) entry.x = best.c.x; if (bad.length) entry.drop = bad.map(b => [b.x, b.y]);
      out.push(entry); log(`  done: ${entry.st} stars, ${bad.length} heart(s) dropped`); $('out').value = out.map(e => JSON.stringify(e)).join(',\n') + ',\n';
    }
    log('finished'); window.__genDone = true; return out;
  };
  $('go').onclick = () => { try { const spec = JSON.parse($('spec').value); window.__genDone = false; window.runGen(spec).catch(e => log('stopped: ' + e.message)); } catch (e) { log('bad spec: ' + e.message); } };
  $('stop').onclick = () => { window.__genStop = true; };
})();
