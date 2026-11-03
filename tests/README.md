# Jelly Dash — tests

Two layers, both running the real game code:

1. **`tests.html`** — open it in any browser. It runs the checks in `tests/suite.js` (level data, share codes, save repair, orbs, practice mode,
   coyote time, editor undo/redo, browser-gesture and ghost-tap guards, the solver on every official level, finger-size audits of every screen, pointer routing) and shows a green/red list.
   Add `?full` to also prove every level at Chill and Spicy pace. Results are on `window.__results`.
2. **`node tests/run.js [--full]`** — opens `tests.html` in a phone-sized and a desktop-sized viewport with Playwright and exits non-zero on any failure
   (`npm i playwright` first).

`tests/playwright/*.js` are older end-to-end scripts (touch flows, long-press, Studio, editor gestures, wide screen, collapse stress). Run them from this
folder, e.g. `node tests/playwright/tch.js`. They write screenshots into the current directory.

## Adding a check
Add `test('name', () => { ... })` in `tests/suite.js`; throw (or use `ok` / `eq`) to fail. Keep checks independent of each other; the `__jd` object
(see `js/main.js`) exposes the internals tests need, only when the page is opened with `?debug` or from `tests.html`.

## Layout of the code
`js/*.js` are classic scripts sharing one global scope, loaded in the order listed in `index.html`:
core → save → themes → levels → audio → music → softbody → game → room → solver → editor → update → render → ui → input → main.

## Audio checks
`tests.html` renders every song and effect offline and measures them with `tests/dsp.js` (FFT, band energy, stereo width, beat strength):
songs must be audible, within a loudness band, bright enough for a phone speaker (spectral centroid, energy above 2.5 kHz, little below 90 Hz), have a clear pulse and
stereo width; every effect must have an entry in `SFX_TARGET` (js/audio.js) and land within 3 dB of it; menu effects must be dry. After changing any effect run
`node tests/calibrate.js` and paste the table it prints over `SFX_TRIM`.
