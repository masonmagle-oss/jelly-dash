'use strict';
/* Jelly Dash — Saved data: normalising, loading and persisting.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= persistence ================= */
const SAVE_KEY = 'jellydash-v2', SAVE_VERSION = 4;   // bump SAVE_VERSION and add a step in normalizeStore whenever the shape of `store` changes
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
