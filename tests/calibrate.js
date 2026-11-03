const { chromium } = require('playwright'); const path = require('path'); const { db, highPeak } = require('./dsp.js');
const SITE = path.resolve(__dirname, '..');
// Measures every effect's peak at trim 1 and prints the SFX_TRIM table that lands each one on its target (SFX_TARGET in js/audio.js).
//   cd <site folder> && npm i playwright && node tests/calibrate.js   -> paste the printed table over SFX_TRIM in js/audio.js
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + path.join(SITE, 'game.html') + '?debug&fast'); await p.waitForTimeout(500);
  await p.evaluate(() => { for (const k of Object.keys(window.__jd.SFX_TRIM)) delete window.__jd.SFX_TRIM[k]; });   // measure at trim 1
  const TARGET = await p.evaluate(() => window.__jd.SFX_TARGET);
  const names = await p.evaluate(() => Object.keys(window.__jd.sfx).concat(window.__jd.HAZ.map(h => 'hit:' + h.id)));
  const args = { squish: [600, 'jelly'], bloop: [0], toggle: [true], panel: [true], tick: [.5], star: [1], combo: [3], land: [600] };
  const out = {};
  for (const k of names) {
    if (TARGET[k] === null || TARGET[k] === undefined) { console.log('skip', k); continue; }
    const reps = await p.evaluate(async ([k, args]) => { const J = window.__jd, res = [];
      for (let rep = 0; rep < 5; rep++) { const buf = await J.renderSfxOffline(() => { if (k.startsWith('hit:')) J.playHit(J.HAZ.find(h => h.id === k.slice(4))); else J.sfx[k](...(args[k] || [])); }, 2.5, 22050); res.push([Array.from(buf.getChannelData(0)), Array.from(buf.getChannelData(1)), buf.sampleRate]); }
      return res; }, [k, args]);
    let pk = 0, hf = 0; for (const [l, r, sr] of reps) { for (let i = 0; i < l.length; i++) pk = Math.max(pk, Math.abs(l[i]), Math.abs(r[i])); hf = Math.max(hf, highPeak(l, sr), highPeak(r, sr)); }
    const CEIL = await p.evaluate(() => window.__jd.SFX_HF_CEIL), tp = Math.pow(10, (TARGET[k] - db(pk)) / 20), th = Math.pow(10, (CEIL - db(hf + 1e-9)) / 20);
    out[k] = +Math.min(tp, th).toFixed(2); console.log(k.padEnd(16), 'peak', db(pk).toFixed(1), 'above 2k', db(hf + 1e-9).toFixed(1), '→ trim', out[k], th < tp ? '(capped by brightness)' : '');
  }
  console.log('\nconst SFX_TRIM = ' + JSON.stringify(out) + ';'); await b.close();
})();
