'use strict';
/* Tiny dependency-free DSP used by the audio checks (browser and node): FFT, spectrum bands, onset/beat strength, stereo width. */
// tiny DSP helpers (no dependencies)
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < len / 2; j++) { const a = i + j, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } } }
function spectra(x, sr, N = 2048, hop = 1024) {   // magnitude frames
  const win = new Float64Array(N); for (let i = 0; i < N; i++) win[i] = .5 - .5 * Math.cos(2 * Math.PI * i / N); const frames = [];
  for (let s = 0; s + N <= x.length; s += hop) { const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = x[s + i] * win[i]; fft(re, im); const m = new Float64Array(N / 2); for (let i = 0; i < N / 2; i++) m[i] = Math.hypot(re[i], im[i]); frames.push(m); }
  return frames;
}
const db = v => 20 * Math.log10(Math.max(v, 1e-12));
function analyse(L, R, sr, bpm) {
  const n = L.length; let sum = 0, pk = 0, sumR = 0, sumLR = 0, sumL2 = 0, sumR2 = 0, dc = 0, maxJump = 0, nan = 0;
  for (let i = 0; i < n; i++) { const a = L[i], b = R[i]; if (!Number.isFinite(a)) nan++; sum += a * a; if (Math.abs(a) > pk) pk = Math.abs(a); sumLR += a * b; sumL2 += a * a; sumR2 += b * b; dc += a; if (i) maxJump = Math.max(maxJump, Math.abs(a - L[i - 1])); }
  const rms = Math.sqrt(sum / n), corr = sumLR / Math.sqrt(sumL2 * sumR2 + 1e-18);
  // stereo width above 500 Hz (where width is audible): one-pole high-pass, then the correlation of what is left
  let hl = 0, hr = 0, pl = 0, pr = 0, xl = 0, xr = 0, xlr = 0; const aHP = Math.exp(-2 * Math.PI * 500 / sr);
  for (let i = 0; i < n; i++) { const yl = aHP * (hl + L[i] - pl), yr = aHP * (hr + R[i] - pr); pl = L[i]; pr = R[i]; hl = yl; hr = yr; xl += yl * yl; xr += yr * yr; xlr += yl * yr; }
  const corrHi = xlr / Math.sqrt(xl * xr + 1e-18);
  const mono = new Float64Array(n); for (let i = 0; i < n; i++) mono[i] = (L[i] + R[i]) / 2;
  const F = spectra(mono, sr), N = 2048, bin = f => Math.round(f / (sr / N));
  const bands = [['sub<90', 20, 90], ['bass90-250', 90, 250], ['lowmid250-800', 250, 800], ['mid.8-2.5k', 800, 2500], ['pres2.5-6k', 2500, 6000], ['air6k+', 6000, sr / 2 - 100]];
  const e = bands.map(() => 0); let cen = 0, cenW = 0;
  for (const m of F) for (let b = 0; b < bands.length; b++) for (let k = bin(bands[b][1]); k < bin(bands[b][2]); k++) e[b] += m[k] * m[k];
  for (const m of F) for (let k = 2; k < m.length; k++) { cen += k * (sr / N) * m[k]; cenW += m[k]; }
  const tot = e.reduce((a, b) => a + b, 0) + 1e-18, bandPct = Object.fromEntries(bands.map((b, i) => [b[0], +(100 * e[i] / tot).toFixed(1)]));
  // onsets: spectral flux
  const flux = []; for (let i = 1; i < F.length; i++) { let f = 0; for (let k = 0; k < F[i].length; k++) { const d = F[i][k] - F[i - 1][k]; if (d > 0) f += d; } flux.push(f); }
  const mean = flux.reduce((a, b) => a + b, 0) / flux.length, sd = Math.sqrt(flux.reduce((a, b) => a + (b - mean) ** 2, 0) / flux.length); let onsets = 0; for (let i = 1; i < flux.length - 1; i++) if (flux[i] > mean + .8 * sd && flux[i] >= flux[i - 1] && flux[i] > flux[i + 1]) onsets++;
  const fr = sr / 1024, beat = 60 / bpm; const ac = lag => { let s = 0; for (let i = 0; i + lag < flux.length; i++) s += (flux[i] - mean) * (flux[i + lag] - mean); return s; };
  const ac0 = ac(0) + 1e-18, sc = (period) => { const l = period * fr; const lo = Math.floor(l), t = l - lo; return ((1 - t) * ac(lo) + t * ac(lo + 1)) / ac0; };
  // chroma (100-1500 Hz) → how much energy sits in each pitch class
  const chroma = new Float64Array(12); for (const m of F) for (let k = bin(100); k < bin(1500); k++) { const f = k * sr / N, pc = ((Math.round(12 * Math.log2(f / 440)) + 69) % 12 + 12) % 12; chroma[pc] += m[k] * m[k]; }
  const ct = chroma.reduce((a, b) => a + b, 0) + 1e-18;
  return { rmsDb: +db(rms).toFixed(1), peakDb: +db(pk).toFixed(1), crest: +(db(pk) - db(rms)).toFixed(1), stereoCorr: +corr.toFixed(2), corrHi: +corrHi.toFixed(2), dc: +(dc / n).toExponential(1), maxJump: +maxJump.toFixed(3), nan, centroid: Math.round(cen / cenW), bandPct,
    onsetsPerSec: +(onsets / (n / sr)).toFixed(1), beatAC: +sc(beat).toFixed(2), sixteenthAC: +sc(beat / 4).toFixed(2), barAC: +sc(beat * 4).toFixed(2), chroma: Array.from(chroma, v => +(100 * v / ct).toFixed(1)) };
}

// Peak of the part of a signal above f0 Hz (whole-buffer FFT, bins below f0 zeroed, inverse FFT). Used to cap how harsh an effect can be.
function highPeak(x, sr, f0 = 2000) {
  let n = 1; while (n < x.length) n <<= 1; const re = new Float64Array(n), im = new Float64Array(n); for (let i = 0; i < x.length; i++) re[i] = x[i];
  fft(re, im); const k0 = Math.ceil(f0 / sr * n); for (let k = 0; k < n; k++) { const kk = k <= n / 2 ? k : n - k; if (kk < k0) { re[k] = 0; im[k] = 0; } }
  fft(im, re); let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(re[i]) / n); return m;   // (swapping re/im makes the forward FFT an inverse)
}
if (typeof module !== 'undefined') module.exports = { highPeak, analyse, spectra, fft, db }; if (typeof window !== 'undefined') window.DSP = { highPeak, analyse, spectra, fft, db };
