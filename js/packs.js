'use strict';
/* Jelly Dash — Level packs: extra worlds and the levels in them, as plain data (loaded before levels.js, which turns them into official levels after the first 25).
   The first five worlds and their 25 levels are written by hand in levels.js; everything after that lives here, made with tests/gen.html (the level generator) and
   proven by the suite (tests/suite.js) before it ships: every level beatable and every heart collectable at Chill, Normal and Spicy pace.

   PACK_WORLDS: appended after the five built-in worlds (world index 5, 6, ...):  { id, name, tag, pal: [themeIdx, themeIdx, themeIdx], amb: 'meadow' | 'cloud' | 'factory' | 'night' | 'slime' }
   PACKS: one entry per level, in play order within its world:
     { id: 'p1', w: world index, n: name, st: stars (1-5), sc: script (the same patterns as the hand-written levels), bpm, sty: song style, coy: coyote seconds,
       x: { puff: true, bounce: true } (optional), drop: [[x, y], ...] (hearts no winning run can take, found by the generator) }
   Ids are saved with the player's progress: never reuse or renumber one. A world should end with its boss (its hardest level). */
const PACK_WORLDS = [];
const PACKS = [];
