// Node + Playwright runner: opens tests.html in a phone-sized and a desktop-sized viewport and exits non-zero if any check fails.
//   cd <this folder> && npm i playwright && node tests/run.js [--full]
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const full = process.argv.includes('--full'); const b = await chromium.launch(); let bad = 0;
  for (const [name, vp, touch] of [['phone', { width: 874, height: 402 }, true], ['desktop', { width: 1280, height: 720 }, false]]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 3 : 1 }); const p = await ctx.newPage();
    p.on('pageerror', e => { console.log(name, 'PAGE ERROR', e.message); bad++; });
    await p.goto('file://' + path.resolve(__dirname, '..', 'tests.html') + (full ? '?full' : '')); await p.waitForFunction(() => window.__done, null, { timeout: 15 * 60 * 1000 });
    const res = await p.evaluate(() => window.__results); const fails = res.filter(r => !r.ok);
    console.log(`${name}: ${res.length - fails.length}/${res.length} passed`); for (const f of fails) { console.log('  ✗', f.name, '—', f.error); bad++; } await ctx.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
