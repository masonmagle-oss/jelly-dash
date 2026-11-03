# Jelly Dash

A beat-synced, squishy rhythm platformer. You are a jelly: tap to jump in time with the music, squash on landings, stretch on takeoffs, and don't hit the spikes. Five worlds, twelve songs, a level editor, share codes and a daily level. Works on desktop and phones (portrait play rotates the stage sideways).

Plain HTML, canvas and JavaScript. No build step, no dependencies, no network requests: the font is embedded and every sound is synthesised. Nothing leaves the player's device.

## Play it

Open `index.html` through any static web server (a service worker and ES-free classic scripts need `http://`, not `file://`):

```bash
python -m http.server 8765
```

then visit <http://localhost:8765/>.

## Publish it (GitHub Pages)

1. Push this folder to a **public** repository.
2. Repository **Settings → Pages → Build and deployment**: source *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. After a minute the game is live at `https://<your-name>.github.io/<repo-name>/`.
4. On a phone: Android Chrome menu → *Install app*; iPhone Safari Share → *Add to Home Screen*.

After changing any file, bump `CACHE` in `sw.js` (for example `jelly-dash-v3`) so installed copies pick up the update.

## Tests

Open `tests.html` in a browser (served over http) for the 55 in-page checks, or add `?full` to prove every level at every pace. For a command-line run:

```bash
npm i playwright
node tests/run.js
```

More in [tests/README.md](tests/README.md).

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | page, styles, embedded font |
| `js/*.js` | the game, loaded in order: core, save, dom, themes, levels, audio, music, softbody, game, room, solver, editor, update, render, ui, input, main |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | install and offline support |
| `tests.html`, `tests/` | automated checks |
| `STORE-NOTES.md` | data facts, age-rating answers, photosensitivity numbers, steps for the app stores |

## Status

Never yet played on a real phone, and the music and sound effects have not been listened to. Those are the first things to check.
