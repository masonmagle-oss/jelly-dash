'use strict';
/* Jelly Dash — The level editor.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= level editor ================= */
const TOOLS = [['block', 'Block'], ['spike', 'Hazard'], ['pad', 'Pad'], ['heart', 'Heart'], ['gap', 'Gap'], ['ship', 'Ship'], ['cube', 'Cube'], ['orb', 'Orb'], ['gate', 'Gate'], ['pan', 'Pan'], ['erase', 'Eraser']];   // keys 1-9 and 0 pick the first ten
// a one-line tip for each tool, shown under the top strip while it is picked (drawEditor); edPowerNote adds which powers the level has switched on
const TOOL_TIPS = {
  block: 'Block: build floors, steps and walls to hop over.', spike: 'Hazard: touching it restarts. Leave a landing tile after it.', pad: 'Pad: a spring that launches the jelly high.',
  heart: 'Heart: put them on the path so the level can be cleared 100%.', gap: 'Gap: drag over columns. A wide gap needs Puff (More ▸).', ship: 'Ship: a flying section starts here. Place Cube to end it.',
  cube: 'Cube: back to hopping after a Ship section.', orb: 'Orb: tap on it for one more jump in mid-air.', gate: 'Gate: hold Squish to slip under. Leave 2+ floor tiles after it.',
  pan: 'Pan: drag to scroll the level.', erase: 'Eraser: tap an object to remove it.',
};
const edPowerNote = L => [L.puff ? 'Puff on: hold Squish in the air to float' : '', L.bounce ? 'Bounce on: tap just before landing to spring higher' : ''].filter(Boolean).join('  •  ');
const COLUMN_TOOLS =['gap', 'ship', 'cube', 'gate'];   // tools that act on a whole column, not one cell
let edPreview = false, edLevel = null, edScroll = 0, edTool = 'block', edPaint = null, edDirty = false, selTab = 0, selPage = 0, selWorld = -1, pickFor = 'play', delArm = null;
const clone = o => JSON.parse(JSON.stringify(o));
function sanitize(o) {
  if (!o || !Array.isArray(o.objs)) return null;
  const objs = [];
  for (const q of o.objs.slice(0, 4000)) {
    if (!q || !OBJ_TYPES.includes(q.t) || typeof q.x !== 'number') continue;
    const r = { t: q.t, x: clamp(+q.x, 0, 600) };
    if (q.t === 'block' || q.t === 'spike' || q.t === 'pad' || q.t === 'heart' || q.t === 'orb') r.y = clamp(+q.y || 0, 0, 6);
    if (q.t === 'portal') r.to = q.to === 'ship' ? 'ship' : 'cube';
    objs.push(r);
  }
  const maxX = objs.reduce((m, q) => Math.max(m, q.x), 0);
  return { id: null, name: cleanName(o.name, 'Imported'), stars: 0, custom: true, len: clamp(Math.floor(+o.len || maxX + 8), 24, 400), pal: Array.isArray(o.pal) && o.pal.length >= 2 && o.pal.every(i => i >= 0 && i < TH.length) ? o.pal.slice(0, 4) : [0, 1, 2], objs, coy: clamp(+o.coy || DEF_COY, .03, .12), bpm: clamp(Math.round(+o.bpm) || 110, 70, 160), style: styleIndex(o.style), auto: o.auto !== false, puff: o.puff === true, bounce: o.bounce === true };
}
function openEditor(L) {
  if (!L) L = { id: null, name: 'My Level', stars: 0, custom: true, len: 64, pal: [0, 1, 2], objs: [], bpm: 110, style: 0, auto: true, puff: false, bounce: false };
  else { L = clone(L); if (!L.custom) { L.id = null; L.custom = true; L.name = L.name + ' remix'; L.stars = 0; } }
  edLevel = L; edScroll = 0; edTool = 'block'; edDirty = false; edHist = []; edFuture = []; edMore = false; buildLevel(edLevel); state = 'edit';
}
function edRebuild() { buildLevel(edLevel); edDirty = true; }
// Undo/redo: snapshots of everything the editor can change. Call edPush() just BEFORE a change.
let edHist = [], edFuture = [];
const edState = () => JSON.stringify({ objs: edLevel.objs, len: edLevel.len, pal: edLevel.pal, bpm: edLevel.bpm, style: edLevel.style, auto: edLevel.auto, puff: !!edLevel.puff, bounce: !!edLevel.bounce });
function edPush() { edHist.push(edState()); if (edHist.length > 60) edHist.shift(); edFuture.length = 0; }
function edRestore(str) { Object.assign(edLevel, JSON.parse(str)); edRebuild(); }
function edStep(from, to, none) {
  const cur = edState(); while (from.length && from[from.length - 1] === cur) from.pop();   // skip gestures that changed nothing
  if (!from.length) { say(none, 1.2); return; }
  to.push(cur); edRestore(from.pop()); sfx.click();
}
const edUndo = () => edStep(edHist, edFuture, 'Nothing to undo'), edRedo = () => edStep(edFuture, edHist, 'Nothing to redo');
function saveEd() {
  if (!edLevel.id) { edLevel.id = 'c' + Date.now(); store.custom.push(clone(edLevel)); }
  else { const i = store.custom.findIndex(l => l.id === edLevel.id); if (i >= 0) store.custom[i] = clone(edLevel); else store.custom.push(clone(edLevel)); }
  persist(); edDirty = false; say('Saved to My Levels');
}
function edApply(mx, my, first) {
  if (first) edPush();
  const col = Math.floor((mx + edScroll * T) / T), row = 6 - Math.floor((my - CEIL) / T), P0 = edPaint;
  if (col < 0 || col >= edLevel.len) return;
  const key = col + ',' + row + (COLUMN_TOOLS.includes(P0.tool) ? 'c' : '');
  if (!first && P0.last === key) return; P0.last = key;
  const o = edLevel.objs, cellT = ['block', 'spike', 'pad', 'heart', 'orb'], inRows = row >= 0 && row <= 6;
  const at = q => cellT.includes(q.t) && Math.floor(q.x) === col && Math.floor(q.y) === row;
  if (P0.tool === 'gap') {
    const has = o.some(q => q.t === 'gap' && q.x === col);
    if (first) P0.val = !has;
    edLevel.objs = o.filter(q => !(q.t === 'gap' && q.x === col)); if (P0.val && col >= 8) edLevel.objs.push({ t: 'gap', x: col });
  } else if (P0.tool === 'gate') {   // a gummy gate: a whole column from the ceiling down to a squish-sized gap above the floor (see GATE_GAP); drag to paint a run of them
    const has = o.some(q => q.t === 'gate' && q.x === col);
    if (first) P0.val = !has;
    edLevel.objs = o.filter(q => !(q.t === 'gate' && q.x === col)); if (P0.val && col >= 10) edLevel.objs.push({ t: 'gate', x: col });
  } else if (P0.tool === 'ship' || P0.tool === 'cube') {
    if (!first) return;
    const had = o.find(q => q.t === 'portal' && q.x === col);
    edLevel.objs = o.filter(q => !(q.t === 'portal' && q.x === col));
    if (!(had && had.to === P0.tool)) edLevel.objs.push({ t: 'portal', x: col, to: P0.tool });
  } else if (P0.tool === 'erase') {
    if (!inRows) { edLevel.objs = o.filter(q => !((q.t === 'gap' || q.t === 'gate') && q.x === col)); }
    else {   // a cell object first, then a portal in the column, then a gate
      const n = o.filter(q => !at(q)); if (n.length !== o.length) edLevel.objs = n;
      else { const m = o.filter(q => !(q.t === 'portal' && q.x === col)); edLevel.objs = m.length !== o.length ? m : o.filter(q => !(q.t === 'gate' && q.x === col)); }
    }
  } else if (inRows) {
    if (col < 6 && P0.tool !== 'heart') return;
    edLevel.objs = o.filter(q => !at(q)); edLevel.objs.push({ t: P0.tool, x: col, y: row });
  } else return;
  edRebuild();
}
function edShare() {
  const json = JSON.stringify({ name: edLevel.name, len: edLevel.len, pal: edLevel.pal, bpm: edLevel.bpm, style: edLevel.style, auto: edLevel.auto, puff: !!edLevel.puff, bounce: !!edLevel.bounce, objs: edLevel.objs });
  try { navigator.clipboard.writeText(json).then(() => say('Level code copied to clipboard'), () => showCopy('Copy this level code', json)); }
  catch (e) { showCopy('Copy this level code', json); }
}
// accepts both kinds of code: the short "JD1." share code and the editor's JSON
function edImport() {
  askText('Paste a level code', '', s => {
    s = String(s || '').trim(); if (!s) { say('Import cancelled'); return; }
    try { const L = s.startsWith('JD1.') ? parseLevelCode(s) : sanitize(JSON.parse(s)); if (!L) throw 0; L.id = null; openEditor(L); edLevel.custom = true; edLevel.id = null; say('Imported: ' + L.name); } catch (e) { say('That code did not look right'); }
  }, { multi: true, ok: 'Import', hint: 'Paste here' });
}
function edName() { askText('Level name', edLevel.name, s => { edLevel.name = cleanName(s, edLevel.name); edDirty = true; }, { max: 24, hint: 'Name your level' }); }
