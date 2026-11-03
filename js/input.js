'use strict';
/* Jelly Dash — Keyboard, pointer and touch input.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= input ================= */
const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW', 'Enter'];
function pmap(e) {
  const r = cv.getBoundingClientRect();
  if (portrait) { const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), cw = cv.offsetWidth, ch = cv.offsetHeight; return [(dy + cw / 2) / cw * VW - VX, (ch / 2 - dx) / ch * H]; }   // undo the quarter turn
  return [(e.clientX - r.left) / r.width * VW - VX, (e.clientY - r.top) / r.height * H];
}
// Hit-testing for every canvas button. A button registered with btn()/ui.push() is {x, y, w, h, fn, bg?, clip?}.
// - a point strictly inside a button always wins (the topmost one);
// - on touch, buttons smaller than the minimum touch size also catch near-misses: the hit area grows to minHitUnits(), nearest centre wins.
//   `clip` ({x0, y0, x1, y1}) fences that growth in (the floor bar must not grow up into the play area; the growth moves to the free side instead);
// - `bg` entries (a modal's dimmed backdrop and its card) only catch what nothing else wants.
function hitRect(b, need) {
  const gx = Math.max(0, need - b.w), gy = Math.max(0, need - b.h);
  let x0 = b.x - gx / 2, x1 = b.x + b.w + gx / 2, y0 = b.y - gy / 2, y1 = b.y + b.h + gy / 2;
  const c = b.clip; if (c) {
    if (x0 < c.x0) { x1 += c.x0 - x0; x0 = c.x0; } if (x1 > c.x1) { x0 -= x1 - c.x1; x1 = c.x1; }
    if (y0 < c.y0) { y1 += c.y0 - y0; y0 = c.y0; } if (y1 > c.y1) { y0 -= y1 - c.y1; y1 = c.y1; }
    x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x + b.w); y0 = Math.min(y0, b.y); y1 = Math.max(y1, b.y + b.h);
  }
  return { x0, y0, x1, y1 };
}
function hitUi() {
  const fat = isTouchUi() ? minHitUnits() : 0, mx = mouse.x, my = mouse.y;
  let strict = null, near = null, nd = 1e9, bg = null;
  for (let i = ui.length - 1; i >= 0; i--) {
    const b = ui[i], inside = mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
    if (b.bg) { if (inside && !bg) bg = b; continue; }
    if (inside) { if (!strict) strict = b; continue; }
    if (!fat) continue;
    const r = hitRect(b, fat);
    if (mx >= r.x0 && mx <= r.x1 && my >= r.y0 && my <= r.y1) { const d = Math.hypot(mx - (b.x + b.w / 2), my - (b.y + b.h / 2)); if (d < nd) { nd = d; near = b; } }
  }
  return strict || near || bg;
}
// design check, exposed under ?debug: every button's touch area must reach the minimum size without running into a neighbour's
function auditUi() {
  const need = minHitUnits(), bad = [];
  for (const b of ui) {
    if (b.bg) continue;
    const r = hitRect(b, need), tooSmall = r.x1 - r.x0 < need * .98 || r.y1 - r.y0 < need * .98;
    const clash = ui.some(o => o !== b && !o.bg && o.x < r.x1 && o.x + o.w > r.x0 && o.y < r.y1 && o.y + o.h > r.y0);
    if (tooSmall || (clash && (b.w < need || b.h < need))) bad.push({ label: b.label, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), tooSmall, clash });
  }
  return bad;
}
addEventListener('keydown', e => {
  if (dlgOpen) return;   // typing in the text box: the game must not see the keys (or swallow Space)
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();   // the page must never scroll
  if (e.code === 'KeyH' && (state === 'play' || state === 'dead')) { let i = store.haz | 0; for (let k = 1; k <= HAZ.length; k++) { const j = (i + k) % HAZ.length; if (hazOpen(j)) { i = j; break; } } store.haz = i; persist(); say('Hazards: ' + HAZ[i].name + (HAZ[i].note ? ' (' + HAZ[i].note + (HAZ[i].info ? ': ' + HAZ[i].info : '') + ')' : '')); return; }
  if (mode === 'practice' && state === 'play' && (e.code === 'KeyZ' || e.code === 'KeyX')) { if (e.code === 'KeyZ') practiceSave(false); else practiceUndo(); return; }
  if (e.code === 'KeyT' && (state === 'play' || state === 'dead')) { tumble = !tumble; SET().tumble = tumble; persist(); say(tumble ? 'Spin on' : 'Spin off'); return; }
  if (e.code === 'KeyG' && (state === 'play' || state === 'dead')) { store.guides = store.guides === false; persist(); say(store.guides ? 'Jump guides on' : 'Jump guides off'); return; }
  if (e.code === 'KeyM' && state !== 'edit') { muted = !muted; if (master) master.gain.value = muted ? 0 : .9; return; }
  if (state === 'title') {
    initAudio();
    if (e.code === 'Digit1' || e.code === 'Enter') { pickFor = 'play'; mode = 'dash'; state = 'select'; } else if (e.code === 'Digit2') { pickFor = 'play'; mode = 'zen'; state = 'select'; }
    else if (e.code === 'Digit3') { pickFor = 'play'; mode = 'practice'; state = 'select'; }
    else if (e.code === 'Digit4') enterRoom(); else if (e.code === 'Digit5') startStudio(); else if (e.code === 'Digit6') { pickFor = 'edit'; state = 'select'; }
    return;
  }
  if (state === 'solving') { if (e.code === 'Escape') cancelSolve(); return; }   // (also cancels the daily level's cooking)
  if (state === 'select' || state === 'settings' || state === 'jukebox') { if (e.code === 'Escape') toTitle(); return; }
  if (state === 'edit') {
    if (e.code === 'Escape') { if (edMore) edMore = false; else toTitle(); return; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') edScroll = Math.min(Math.max(0, edLevel.len - 20), edScroll + 1);
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') edScroll = Math.max(0, edScroll - 1);
    else if (/^Digit[0-9]$/.test(e.code)) edTool = TOOLS[(+e.code.slice(5) + 9) % 10][0];
    else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) edRedo(); else edUndo(); }
    else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); edRedo(); }
    return;
  }
  if (e.code === 'Escape') { if (state === 'room') { if (roomPanel) roomPanel = null; else toTitle(); } else leaveRun(); return; }
  if (state === 'room') {
    if (JUMP_KEYS.includes(e.code)) { e.preventDefault(); initAudio(); roomHop(); }
    else if (e.code === 'Digit1') setPreset('jelly'); else if (e.code === 'Digit2') setPreset('slime'); else if (e.code === 'Digit3') setPreset('mochi');
    else if (e.code === 'Digit4') setPreset('dough'); else if (e.code === 'Digit5') setPreset('foam');
    else if (e.code === 'KeyR') roomReset();
    return;
  }
  if (JUMP_KEYS.includes(e.code)) { e.preventDefault(); if (!e.repeat) press(); }
  else if (e.code === 'KeyR' && (state === 'play' || state === 'dead')) restartRun();
});
addEventListener('keyup', e => { if (JUMP_KEYS.includes(e.code)) inp.held = false; });
/* ---------- browser gestures the game must never trigger ----------
   Pinch / double-tap zoom, text selection, image dragging and the long-press menu would all steal touches from play. CSS (touch-action, user-select,
   touch-callout, see index.html) does most of it; these cover Safari's gesture events and older browsers. The page never scrolls, so touchmove is always cancelled. */
for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, e => e.preventDefault(), { passive: false });
for (const t of ['contextmenu', 'selectstart', 'dragstart', 'dblclick']) document.addEventListener(t, e => { if (!inDlg(e)) e.preventDefault(); });   // the text box keeps its paste / select menus
document.addEventListener('touchmove', e => { if (!inDlg(e)) e.preventDefault(); }, { passive: false });
// Ghost taps: a quick double-tap lands its second tap on whatever the first one opened (Dash -> a level card sits under the same spot). So presses are ignored
// for a moment after the screen, a picker or the editor's More card changes. (Never during a run: taps there mean "jump".)
let ghostMs = (location.search.includes('fast') || window.JD_TEST) ? 0 : 220, uiSig = '', uiLockAt = 0;
function noteUiChange(now) { const sig = state + '|' + roomPanel + '|' + edMore; if (sig !== uiSig) { uiSig = sig; uiLockAt = now; } }
const ghostTap = () => ghostMs > 0 && state !== 'play' && state !== 'dead' && state !== 'win' && performance.now() - uiLockAt < ghostMs;
// Pointer input is routed by screen. A screen supplies { down(e), move(e) }; hit-testing, capture and touch rules are shared, so adding a screen
// means describing it here rather than growing an if-chain. Screens with no entry (a run in progress, game over, win) take a tap as "jump".
// live pointers (stage x), so the editor can tell a two-finger scroll from a draw
const touchPtrs = new Map(); let edPan = null, panMid = null;
const pressUi = () => { const b = hitUi(); if (b) b.fn(); };
const SCREENS = {
  title: { down: pressUi }, select: { down: pressUi }, jukebox: { down: pressUi }, solving: { down: pressUi },
  settings: {
    down() { const b = hitUi(); if (!b) return; if (b.slider) { dragSlider = b.slider; sliderTo(mouse.x); } else b.fn(); },
    move() { if (dragSlider) sliderTo(mouse.x); },
  },
  edit: {
    down(e) {
      const b = hitUi(); if (b) { b.fn(); return; }
      if (touchPtrs.size >= 2) { if (edPaint) { const prev = edHist.pop(); if (prev) edRestore(prev); edPaint = null; } edPan = null; return; }   // a second finger means "scroll": undo what the first one just placed
      if (edTool === 'pan' && e.button !== 2) { edPan = { x: mouse.x, s: edScroll }; return; }
      if (mouse.y > CEIL - 8 && mouse.y < 428) { edPaint = { tool: e.button === 2 ? 'erase' : edTool, last: null, val: true }; edApply(mouse.x, mouse.y, true); }
    },
    move() {
      const maxS = Math.max(0, edLevel.len - 20);
      if (touchPtrs.size >= 2) {   // two fingers drag the level sideways
        const [a, b2] = [...touchPtrs.values()], mid = (a.x + b2.x) / 2;
        if (panMid != null) edScroll = clamp(edScroll - (mid - panMid) / T, 0, maxS);
        panMid = mid; edPaint = null; return;
      }
      panMid = null;
      if (edPan && mouse.down) { edScroll = clamp(edPan.s + (edPan.x - mouse.x) / T, 0, maxS); return; }
      if (edPaint && mouse.down && mouse.y > CEIL - 8 && mouse.y < 428) edApply(mouse.x, mouse.y, false);
    },
  },
  room: {
    down(e) {
      const b = hitUi(); if (b) { b.fn(); return; }
      if (roomPanel) return;
      const id = e.pointerId, x = mouse.x, y = mouse.y;
      roomDown(id, x, y, e.button);
      if (e.pointerType !== 'mouse' && e.button !== 2) holdStart(id, x, y, () => { if (roomPin(x, y)) roomRelease(id, true); });   // touch has no right-click: hold still to pin
    },
    move(e) { roomMove(e.pointerId, mouse.x, mouse.y); holdMove(e.pointerId, mouse.x, mouse.y); },
  },
};
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); initAudio(); pointerKind = e.pointerType || 'mouse'; [mouse.x, mouse.y] = pmap(e); mouse.down = true;
  if (ghostTap()) { mouse.down = false; return; }
  if ((state === 'play' || state === 'dead') && mouse.y < 56 && mouse.x > W - 84) {   // in a run the top-right corner is a menu button, never a jump (tap twice, so a stray touch cannot end a run)
    sfx.click(); if (menuArm > 0) { menuArm = 0; leaveRun(); } else { menuArm = 2; say('Tap ☰ again to leave', 2); } return;
  }
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  touchPtrs.set(e.pointerId, { x: mouse.x });
  if (mode === 'practice' && (state === 'play' || state === 'dead')) { const b = hitUi(); if (b) { b.fn(); return; } }   // the practice buttons
  const sc = SCREENS[state]; if (sc) sc.down(e); else press();
});
addEventListener('pointermove', e => {
  [mouse.x, mouse.y] = pmap(e); { const tp = touchPtrs.get(e.pointerId); if (tp) tp.x = mouse.x; }
  const sc = SCREENS[state]; if (sc && sc.move) sc.move(e);
  cv.style.cursor = (state === 'title' || state === 'select' || state === 'edit' || state === 'jukebox') ? (hitUi() ? 'pointer' : 'default') : state === 'room' ? (hitUi() ? 'pointer' : (room.grabs.length || room.inds.length ? 'grabbing' : 'grab')) : 'default';
});
addEventListener('wheel', e => { if (state === 'edit') edScroll = clamp(edScroll + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / T / 2, 0, Math.max(0, edLevel.len - 20)); }, { passive: true });
function release(e) {
  const id = e && e.pointerId != null ? e.pointerId : null;
  if (dragSlider) { dragSlider = null; persist(); }
  inp.held = false; mouse.down = false; edPaint = null; edPan = null; holdCancel(id);
  if (id == null) touchPtrs.clear(); else touchPtrs.delete(id); if (touchPtrs.size < 2) panMid = null;
  if (state === 'room') roomRelease(id);
}
addEventListener('pointerup', release); addEventListener('pointercancel', release); addEventListener('blur', release);
