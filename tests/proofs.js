/* Proof cache for the level proofs (tests/suite.js).
   Proving a level beatable and every heart collectable takes the solver seconds to minutes per level and pace, and the suite does it for every official level. With hundreds of levels that
   would take hours on every run, so a proof is remembered in tests/proofs.json under a key made of the level's own data (its objects, tempo, coyote time and power flags, at that pace)
   and a fingerprint of the engine. The cache is trusted only while BOTH still match:
     - change one level, and only that level is proved again;
     - change anything that changes how a run plays out (physics, solver, level building), and the engine fingerprint changes, so every level is proved again.
   The fingerprint is behavioural: it solves six small levels that between them use every mechanic (cube, ship, orbs, gates, puff, bounce) and hashes the solver's step-by-step traces and
   heart counts, plus the source text of the solver. Add ?fresh to the test page to ignore the cache. Every run also re-proves one random cached level, as a spot check.
   After a run, window.__proofsOut holds the new cache: save it as tests/proofs.json. Needs the game loaded (window.__jd). */
'use strict';
(() => {
  const hash = s => {   // cyrb53: a fast 53-bit string hash, plenty to tell levels apart
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  };
  const SKIP = new Set(['pal', 'style', 'hints', 'name', 'world', 'stars', 'script', 'id', 'checkedSig', 'daily', 'custom']);   // fields that never change how a run plays
  window.proofKey = (L, pace) => L.id + '@' + pace + '#' + hash(JSON.stringify(Object.assign({}, L, { bpm: Math.round(L.bpm * pace * 1000) / 1000 }), (k, v) => SKIP.has(k) ? undefined : v));
  window.engineFp = () => {
    const J = window.__jd; let s = solveGen.toString() + heartsGen.toString() + buildLevel.toString() + stepPlayer.toString();
    for (const n of ['Welcome', 'Puddle Hop', 'Puff Pillow', 'Boing Bay', 'Orb Orchard', 'Little Ship']) {
      const L = J.OFFICIAL.find(l => l.name === n), r = J.solveSync(L, 120000), h = J.heartsSync(L, 6);
      s += '|' + n + ':' + r.ok + JSON.stringify(r.sizes) + ':' + h.best + '/' + h.total;
    }
    return hash(s);
  };
  // load tests/proofs.json -> { fp, beat: {key: 1}, hearts: {key: 1} }; anything missing, unreadable or from another engine is an empty cache
  window.loadProofs = async fresh => {
    const empty = { fp: '', beat: {}, hearts: {} }; if (fresh) return empty;
    try { const r = await fetch('tests/proofs.json', { cache: 'no-store' }); if (!r.ok) return empty; const p = await r.json(); return p && p.beat && p.hearts ? p : empty; } catch (e) { return empty; }
  };
})();
