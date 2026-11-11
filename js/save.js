'use strict';
/* Jelly Dash — Saved data: normalising, loading and persisting.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= persistence ================= */
const SAVE_KEY = 'jellydash-v2', SAVE_VERSION = 7;   // bump SAVE_VERSION and add a step in normalizeStore whenever the shape of `store` changes
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d) => Number.isFinite(+v) && v !== null && v !== '' ? +v : d;
const DEFAULT_SET = { music: .8, sfx: .9, haptics: true, reduceMotion: null, tumble: true };   // reduceMotion: null = follow the device's setting
// Turns anything (an old save, a damaged one, a pasted backup) into a valid store. Every field is checked; nothing is trusted.
function normalizeStore(raw) {
  const r = isObj(raw) ? raw : {}, st = Object.assign({ custom: [], best: {}, skin: 0, score: {}, rate: {}, guides: true, pace: 1, haz: 0, autoCp: true }, r);
  st.custom = Array.isArray(r.custom) ? r.custom.filter(l => isObj(l) && Array.isArray(l.objs)) : [];
  for (const k of ['best', 'score', 'rate']) if (!isObj(st[k])) st[k] = {};
  st.studio = isObj(r.studio) ? r.studio : {}; st.studio.stars = isObj(st.studio.stars) ? st.studio.stars : {};
  const gl = isObj(r.goals) ? r.goals : {}, cnt = (v, d = 0) => Math.max(0, Math.floor(num(v, d))), txtOf = v => typeof v === 'string' && v.length <= 12 ? v : '';   // the Squish Room goals (room.js)
  st.goals = { done: isObj(gl.done) ? gl.done : {}, mats: isObj(gl.mats) ? gl.mats : {}, hops: cnt(gl.hops), secs: Math.max(0, num(gl.secs, 0)), day: txtOf(gl.day), daySecs: Math.max(0, num(gl.daySecs, 0)), cozyDays: cnt(gl.cozyDays), streak: cnt(gl.streak), lastCozy: txtOf(gl.lastCozy) };
  // the cozy room: the heart wallet, the most hearts taken in each level (so replays pay only for new ones), and the decor bought and placed (room.js DECOR)
  const idOf = v => typeof v === 'string' && /^[a-z0-9]{1,16}$/.test(v), dr = isObj(r.decor) ? r.decor : {};
  st.wallet = Math.min(1e6, cnt(r.wallet)); st.hb = {}; if (isObj(r.hb)) for (const k of Object.keys(r.hb).slice(0, 400)) st.hb[k] = Math.min(9999, cnt(r.hb[k]));
  st.decor = { owned: {}, placed: {}, tier: {}, dye: {}, dyes: {} }; if (isObj(dr.owned)) for (const k of Object.keys(dr.owned).slice(0, 80)) if (idOf(k) && dr.owned[k] === true) st.decor.owned[k] = true;
  if (isObj(dr.placed)) for (const k of Object.keys(dr.placed).slice(0, 20)) if (idOf(k) && idOf(dr.placed[k]) && st.decor.owned[dr.placed[k]]) st.decor.placed[k] = dr.placed[k];   // only things you own can be placed
  for (const k of Object.keys(st.decor.owned)) {   // upgrades and dyes only exist for owned things: tier 0..2 (Basic, Deluxe, Golden), dye 0..5 (the current one) and a bit mask of the dyes bought (bit 0, the original colour, is always there)
    st.decor.tier[k] = clamp(cnt(isObj(dr.tier) ? dr.tier[k] : 0), 0, 2); st.decor.dyes[k] = (cnt(isObj(dr.dyes) ? dr.dyes[k] : 0) & 63) | 1; const d = cnt(isObj(dr.dye) ? dr.dye[k] : 0);
    st.decor.dye[k] = d <= 5 && (st.decor.dyes[k] >> d & 1) ? d : 0;
  }
  // the room itself (room.js WALLS, FLOORS, EXPANSIONS): wallpaper and floor chosen and owned, and how many expansions (0..2) were bought
  const rm = isObj(r.room) ? r.room : {}, ownedIds = (o, base) => { const out = { [base]: true }; if (isObj(o)) for (const k of Object.keys(o).slice(0, 30)) if (idOf(k) && o[k] === true) out[k] = true; return out; };
  st.room = { walls: ownedIds(rm.walls, 'blush'), floors: ownedIds(rm.floors, 'candy'), size: clamp(cnt(rm.size), 0, 2) };
  st.room.wall = idOf(rm.wall) && st.room.walls[rm.wall] ? rm.wall : 'blush'; st.room.floor = idOf(rm.floor) && st.room.floors[rm.floor] ? rm.floor : 'candy';
  // the pet: null until adopted; love (food eaten) sets how grown up it is; the gift is a once-a-day heart find
  const pt = isObj(r.pet) ? r.pet : null;
  st.pet = pt && ['bun', 'kit', 'bear'].includes(pt.kind) ? { kind: pt.kind, name: typeof pt.name === 'string' && pt.name.length ? pt.name.replace(/[<>&"`]/g, '').slice(0, 12) : 'Mochi', love: Math.min(1e6, cnt(pt.love)), dyes: (cnt(pt.dyes) & 63) | 1, day: txtOf(pt.day) } : null;
  if (st.pet) { const d = cnt(pt.dye); st.pet.dye = d <= 5 && (st.pet.dyes >> d & 1) ? d : 0; }
  st.pace = num(st.pace, 1) > 0 ? num(st.pace, 1) : 1; st.haz = Math.max(0, Math.floor(num(st.haz, 0))); st.skin = Math.max(0, Math.floor(num(st.skin, 0)));
  const sv = isObj(r.set) ? r.set : {}; st.set = Object.assign({}, DEFAULT_SET, sv);
  st.set.music = clamp(num(sv.music, DEFAULT_SET.music), 0, 1); st.set.sfx = clamp(num(sv.sfx, DEFAULT_SET.sfx), 0, 1);
  st.set.haptics = sv.haptics !== false; st.set.tumble = sv.tumble !== false; st.set.reduceMotion = sv.reduceMotion === true ? true : sv.reduceMotion === false ? false : null;
  st.v = SAVE_VERSION; return st;
}
// Names that come from other people (shared level codes, imports) or from the keyboard are cleaned before they are shown: markup characters out, length capped,
// and a name that contains common profanity or a slur (after undoing look-alike digits and symbols) becomes a plain placeholder.
const NAME_WORDS = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'nazi', 'rape', 'rapist', 'slut', 'whore', 'fag', 'faggot', 'nigger', 'nigga', 'retard', 'porn', 'penis', 'vagina', 'anal', 'kkk', 'hitler', 'cum', 'tits', 'boob', 'boobs', 'sex', 'suicide', 'kill', 'kys'];
const NAME_STEMS = ['fuck', 'shit', 'nigg', 'bitch', 'whore', 'faggot', 'rapist', 'hitler'];   // matched inside run-together text; short words are matched whole, so "Scunthorpe" and "Class" survive
function nameBad(s) {
  const leet = String(s).toLowerCase().replace(/[@4]/g, 'a').replace(/[3]/g, 'e').replace(/[1!|]/g, 'i').replace(/[0]/g, 'o').replace(/[$5]/g, 's').replace(/[7+]/g, 't');
  const words = leet.split(/[^a-z]+/).filter(Boolean), squashed = leet.replace(/[^a-z]/g, '');
  return words.some(w => NAME_WORDS.includes(w)) || NAME_STEMS.some(w => squashed.includes(w));
}
function cleanName(s, fallback = 'My Level') {
  s = String(s == null ? '' : s).replace(/[<>&"`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return !s || nameBad(s) ? fallback : s;
}
let store; try { store = normalizeStore(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch (e) { store = normalizeStore(null); }
const SET = () => store.set;
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(store)); } catch (e) {} };
