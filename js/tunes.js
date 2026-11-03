'use strict';
/* Jelly Dash — Tunes: public-domain melodies that the player plays by landing jumps on the beat.
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there).

   Each world has one tune. A PERFECT or GREAT jump sounds the next note of it, in the key and voice of the song that is playing; a GOOD or OK jump
   holds it back, so a clean run is a tune you can recognise and a messy one is a few stray notes. At a combo of 8 an octave joins each note, at 16 a fifth.
   `notes` are semitones above the tune's tonic (tonic = 0). Only public-domain compositions belong here (composer died long ago, or the tune is traditional):
   adding a tune = adding an entry and pointing a world at it in WORLD_TUNE. tests/suite.js checks the shape. */
const TUNES = [
  { id: 'ode', name: 'Ode to Joy', by: 'Beethoven, 1824', minor: false, notes: [4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 4, 2, 2, 4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 2, 0, 0, 2, 2, 4, 0, 2, 4, 5, 4, 0, 2, 4, 5, 4, 2, 0, 2, -5, 4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 2, 0, 0] },
  { id: 'lullaby', name: "Brahms' Lullaby", by: 'Brahms, 1868', minor: false, notes: [4, 4, 7, 4, 4, 7, 4, 7, 12, 11, 9, 9, 7, 2, 4, 5, 2, 2, 4, 5, 2, 5, 11, 9, 7, 12, 4, 4, 7, 4, 4, 7, 4, 7, 12, 11, 9, 9, 7, 2, 5, 11, 9, 7, 12] },
  { id: 'turkish', name: 'Turkish March', by: 'Mozart, 1783', minor: true, notes: [2, 0, -1, 0, 3, 5, 3, 2, 3, 7, 8, 7, 6, 7, 14, 12, 11, 12, 14, 12, 11, 12, 15, 2, 0, -1, 0, 3, 5, 3, 2, 3, 7, 8, 7, 6, 7, 14, 12, 11, 12, 15, 12, 7, 12] },
  { id: 'elise', name: 'Für Elise', by: 'Beethoven, 1810', minor: true, notes: [7, 6, 7, 6, 7, 2, 5, 3, 0, -9, -5, 0, 2, -5, -1, 2, 3, -5, 7, 6, 7, 6, 7, 2, 5, 3, 0, -9, -5, 0, 2, -5, 3, 2, 0] },
  { id: 'mountain', name: 'In the Hall of the Mountain King', by: 'Grieg, 1875', minor: true, notes: [0, 2, 3, 5, 7, 3, 7, 6, 2, 6, 5, 1, 5, 0, 2, 3, 5, 7, 3, 7, 12, 10, 7, 3, 7, 10, 7, 12, 0, 2, 3, 5, 7, 3, 7, 12, 10, 7, 3, 7, 12] },
];
const WORLD_TUNE = [0, 1, 2, 3, 4];   // WORLDS index -> TUNES index
let curTune = null, tuneI = 0, tuneAnnounced = false;
const tuneFor = L => (L && L.world != null && TUNES[WORLD_TUNE[L.world]]) || null;   // custom levels have no world, so no tune
const median = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
// The MIDI note for step i of a tune over a song style: matched to its major / minor feel and moved to the octave where the melody sits comfortably.
function tuneMidi(t, c, i) {
  const songMinor = c.scale.includes(3) && !c.scale.includes(4), shift = t.minor === songMinor ? 0 : t.minor ? -3 : 3, pc = c.root + shift;
  return pc + 12 * Math.round((70 - (pc + median(t.notes))) / 12) + t.notes[i % t.notes.length];
}
// Sounds the next note. grade: 'PERFECT' | 'GREAT'. Returns true when the tune just came round to its start (a full pass).
function tuneNote(grade, cfg) {
  const t = curTune, c = cfg || (song && song.cfg); if (!t || !c || simming) return false;
  const m = tuneMidi(t, c, tuneI), voice = VOICES[c.lead.voice] || VOICES.tri, v = grade === 'PERFECT' ? .1 : .075;
  voice(mf(m), .8, v, 0, 'song');
  if (combo >= 8) VOICES.bell(mf(m + 12), .6, v * .22, 0, 'song', .3);
  if (combo >= 16) VOICES.bell(mf(m + 7), .6, v * .16, 0, 'song', -.3);
  if (!tuneAnnounced) { tuneAnnounced = true; say('♪ ' + t.name, 2.5); }
  tuneI++; const done = tuneI >= t.notes.length; if (done) tuneI = 0;
  if (done) { say('♪ ' + t.name + ' — complete!', 3); [0, 4, 7, 12].forEach((d, k) => VOICES.bell(mf(m + 12 + d), .9, .05, .08 * k, 'song')); }
  return done;
}
// The victory fanfare for a three-star run: the opening of the world's tune.
function tuneFanfare(cfg) {
  const t = curTune; if (!t || !cfg) return false;
  const voice = VOICES[cfg.lead.voice] || VOICES.tri;
  for (let i = 0; i < 12; i++) voice(mf(tuneMidi(t, cfg, i)), .6, .06, i * .15, 'sfx');
  return true;
}
