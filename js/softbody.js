'use strict';
/* Jelly Dash — The soft-body physics (the jelly).
   Modules are classic scripts that share one global scope (so they can be loaded in order from index.html, in the order listed there). */

/* ================= real soft-body physics =================
   pressurised ring of verlet particles + springs + world collisions; squash/stretch/wobble are emergent. */
const CR = [0, 0, 0];
class Soft {
  constructor(n, R, cx, cy, prm) {
    this.n = n; this.R = R; this.prm = prm;
    const m = n + 1;
    this.x = new Float32Array(m); this.y = new Float32Array(m); this.ox = new Float32Array(m); this.oy = new Float32Array(m);
    this.ax = new Float32Array(m); this.ay = new Float32Array(m);
    this.edge = 2 * R * Math.sin(Math.PI / n); this.skip = 2 * R * Math.sin(2 * Math.PI / n);
    this.A0 = .5 * n * R * R * Math.sin(2 * Math.PI / n);
    // per-spring rest lengths: these creep under strain, which is what gives dough its memory (dents, stretched strings)
    this.er = new Float32Array(n).fill(this.edge); this.sr = new Float32Array(n).fill(R); this.kr = new Float32Array(n).fill(this.skip);
    this.impact = 0; this.press = 0; this.contact = 0; this.deform = 0; this.boost = 1; this.grabs = []; this.inds = [];
    this.bb = { minx: 0, maxx: 0, miny: 0, maxy: 0, cx: 0, cy: 0 };
    this.reset(cx, cy);
  }
  reset(cx, cy) {
    const { n, R } = this;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; this.x[i] = this.ox[i] = cx + Math.cos(a) * R; this.y[i] = this.oy[i] = cy + Math.sin(a) * R; }
    this.x[n] = this.ox[n] = cx; this.y[n] = this.oy[n] = cy; this.grabs = []; this.inds = []; this.relax();
  }
  relax() { this.er.fill(this.edge); this.sr.fill(this.R); this.kr.fill(this.skip); }
  // change the body's size (the Room and the Studio use different sizes); call reset() afterwards to re-place it
  resize(R) { this.R = R; this.edge = 2 * R * Math.sin(Math.PI / this.n); this.skip = 2 * R * Math.sin(2 * Math.PI / this.n); this.A0 = .5 * this.n * R * R * Math.sin(2 * Math.PI / this.n); this.relax(); }
  // plastic flow: past the yield strain a spring's rest length flows to its current length; otherwise it slowly recovers
  flowTo(rest, d, base, yld, flow, rec, dt) {
    const strain = (d - rest) / rest;
    if (Math.abs(strain) > yld) rest += (d - rest) * flow * dt;
    rest += (base - rest) * rec * dt;
    return clamp(rest, base * .35, base * 2.4);
  }
  creep(dt) {
    const { n, x, y, prm: p, R } = this;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, k = (i + 2) % n;
      const de = Math.hypot(x[j] - x[i], y[j] - y[i]), ds = Math.hypot(x[i] - x[n], y[i] - y[n]), dk = Math.hypot(x[k] - x[i], y[k] - y[i]);
      const rec = p.recover * this.boost;   // boost > 1 speeds up the return to the original shape (idle relax, "Smooth")
      this.er[i] = this.flowTo(this.er[i], de, this.edge, p.yield * 2.2, p.flow, rec, dt);
      this.sr[i] = this.flowTo(this.sr[i], ds, R, p.yield, p.flow, rec, dt);
      this.kr[i] = this.flowTo(this.kr[i], dk, this.skip, p.yield * 1.5, p.flow, rec, dt);
    }
  }
  bounds() {
    const { n, x, y, bb } = this; let a = 1e9, b = -1e9, c = 1e9, d = -1e9, sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { if (x[i] < a) a = x[i]; if (x[i] > b) b = x[i]; if (y[i] < c) c = y[i]; if (y[i] > d) d = y[i]; sx += x[i]; sy += y[i]; }
    bb.minx = a; bb.maxx = b; bb.miny = c; bb.maxy = d; bb.cx = sx / n; bb.cy = sy / n; return bb;
  }
  kick(vert, pinch, dt = STEP) {
    const { n, R, x, y, ox, oy } = this, bb = this.bounds();
    for (let i = 0; i < n; i++) { const w = (y[i] - bb.cy) / R, u = (x[i] - bb.cx) / R; oy[i] += vert * w * dt; ox[i] += pinch * u * dt; }
  }
  push(vx, vy, dt = STEP) { for (let i = 0; i <= this.n; i++) { this.ox[i] -= vx * dt; this.oy[i] -= vy * dt; } }
  soak(f) { for (let i = 0; i <= this.n; i++) { this.ox[i] = this.x[i] - (this.x[i] - this.ox[i]) * f; this.oy[i] = this.y[i] - (this.y[i] - this.oy[i]) * f; } }   // bleed off velocity (a hard landing must not keep compressing the body)
  // shape health: area vs. the round area, and the nearest / farthest skin particle from the centre (a flattened crescent has a tiny rmin)
  health() {
    const { n, x, y, R } = this; let cx = 0, cy = 0, A = 0;
    for (let i = 0; i < n; i++) { cx += x[i]; cy += y[i]; } cx /= n; cy /= n;
    let rmin = 1e9, rmax = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, d = Math.hypot(x[i] - cx, y[i] - cy); A += x[i] * y[j] - x[j] * y[i]; if (d < rmin) rmin = d; if (d > rmax) rmax = d; }
    return { ar: A * .5 / this.A0, rmin: rmin / R, rmax: rmax / R };
  }
  collapsed() { const h = this.health(); return h.ar < .5 || h.rmin < .6 || h.rmax > 1.45; }
  // ease every skin particle back onto a circle round the body's centre (f = 1 snaps) and calm it down; the escape hatch for any folded or crescent shape
  // box = optional {l, r, t, b}: the circle is first slid inside it, otherwise a body healed against a wall or the floor is pressed flat again by the very next collision
  heal(f, box) {
    const { n, R, x, y, ox, oy } = this; let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += x[i]; cy += y[i]; } cx /= n; cy /= n;
    if (box) { cx = clamp(cx, box.l + R + 2, box.r - R - 2); cy = clamp(cy, box.t + R + 2, box.b - R - 2); }
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; x[i] += (cx + Math.cos(a) * R - x[i]) * f; y[i] += (cy + Math.sin(a) * R - y[i]) * f; }
    x[n] += (cx - x[n]) * f; y[n] += (cy - y[n]) * f;
    this.soak(1 - f * .8); this.relax();
  }
  dc(i, j, rest, k) {
    const x = this.x, y = this.y, dx = x[j] - x[i], dy = y[j] - y[i], d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    const f = (d - rest) / d * .5 * k; x[i] += dx * f; y[i] += dy * f; x[j] -= dx * f; y[j] -= dy * f;
  }
  collide(resolve, dt, vel) {
    const { n, x, y, ox, oy, prm: p } = this;
    for (let i = 0; i <= n; i++) for (let k = 0; k < 2; k++) {
      if (!resolve(x[i], y[i])) break;
      const nx = CR[0], ny = CR[1], pen = CR[2], vx = x[i] - ox[i], vy = y[i] - oy[i];
      x[i] += nx * pen; y[i] += ny * pen;
      if (!vel) continue;
      const vn = vx * nx + vy * ny;
      if (vn < 0) {
        const vin = -vn / dt; if (vin > this.impact) this.impact = vin;
        const tx = vx - vn * nx, ty = vy - vn * ny;
        ox[i] = x[i] - (tx * (1 - p.mu) - p.e * vn * nx); oy[i] = y[i] - (ty * (1 - p.mu) - p.e * vn * ny);
        if (ny < -.5) this.contact++;
      }
    }
    // finger indenters (round pressers that dent the body)
    for (const d of this.inds) for (let i = 0; i <= n; i++) {
      const dx = x[i] - d.cx, dy = y[i] - d.cy, dist = Math.hypot(dx, dy);
      if (dist >= d.r || dist < 1e-4) continue;
      const nx = dx / dist, ny = dy / dist, vx = x[i] - ox[i], vy = y[i] - oy[i];
      x[i] += nx * (d.r - dist); y[i] += ny * (d.r - dist);
      if (!vel) continue;
      const vn = vx * nx + vy * ny;
      if (vn < 0) { const vin = -vn / dt; if (vin > this.press) this.press = vin; ox[i] = x[i] - (vx - vn * nx) * (1 - p.mu * .5); oy[i] = y[i] - (vy - vn * ny) * (1 - p.mu * .5); }
    }
  }
  step(dt, f) {
    const { n, x, y, ox, oy, ax, ay, prm: p } = this, dt2 = dt * dt;
    this.impact = 0; this.press = 0; this.contact = 0;
    let cx = 0, cy = 0, vx = 0, vy = 0, A = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; cx += x[i]; cy += y[i]; vx += x[i] - ox[i]; vy += y[i] - oy[i]; A += x[i] * y[j] - x[j] * y[i]; }
    cx /= n; cy /= n; vx /= n * dt; vy /= n * dt; A = Math.max(A * .5, this.A0 * .2);
    let dsum = 0; for (let i = 0; i < n; i++) dsum += Math.hypot((x[i] - ox[i]) / dt - vx, (y[i] - oy[i]) / dt - vy);
    this.deform += (dsum / n - this.deform) * .25;   // how fast the skin is moving relative to the body: drives the squelch sound
    const P = p.kp * (this.A0 / A - 1);
    ax.fill(0); ay.fill(0);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ex = x[j] - x[i], ey = y[j] - y[i], fxx = P * ey * .5, fyy = -P * ex * .5;
      ax[i] += fxx; ax[j] += fxx; ay[i] += fyy; ay[j] += fyy;
    }
    let ux = 0, uy = f.gy || 0;
    if (f.guide) { const g = f.guide; ux += g.k * (g.tx - cx) + g.c * (g.tvx - vx); uy += g.k * (g.ty - cy) + g.c * (g.tvy - vy); }
    for (let i = 0; i <= n; i++) { ax[i] += ux; ay[i] += uy; }
    for (const g of this.grabs) {   // fingers: each pulls its little cluster of skin toward the pointer (pins hold still)
      const kd = g.pin ? 2600 : 900;
      for (const it of g.items) { ax[it.i] += kd * (g.mx + it.dx - x[it.i]) - 1.4 * (x[it.i] - ox[it.i]) / dt; ay[it.i] += kd * (g.my + it.dy - y[it.i]) - 1.4 * (y[it.i] - oy[it.i]) / dt; }
    }
    for (let i = 0; i <= n; i++) {
      const vxp = (x[i] - ox[i]) * p.damp, vyp = (y[i] - oy[i]) * p.damp;
      ox[i] = x[i]; oy[i] = y[i]; x[i] += vxp + ax[i] * dt2; y[i] += vyp + ay[i] * dt2;
    }
    for (let it = 0; it < 6; it++) for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.dc(i, j, this.er[i], p.ke); this.dc(i, n, this.sr[i], p.ks); this.dc(i, (i + 2) % n, this.kr[i], p.ksk); }
    this.collide(f.resolve, dt, true);
    for (let it = 0; it < 2; it++) for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.dc(i, j, this.er[i], p.ke); this.dc(i, n, this.sr[i], p.ks); }
    if (p.form) {   // shape memory: ease every skin particle back toward its place on a circle around the body's centre, and keep it inside a sane radius band
      let ccx = 0, ccy = 0; for (let i = 0; i < n; i++) { ccx += x[i]; ccy += y[i]; } ccx /= n; ccy /= n;
      const lo = this.R * (p.minR || .6), hi = this.R * (p.maxR || 1.5), R = this.R;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, tx = ccx + Math.cos(a) * R, ty = ccy + Math.sin(a) * R;
        let dx = (tx - x[i]) * p.form, dy = (ty - y[i]) * p.form; x[i] += dx; y[i] += dy; ox[i] += dx * .6; oy[i] += dy * .6;   // most of the move is not turned into velocity
        const rx = x[i] - ccx, ry = y[i] - ccy, d = Math.hypot(rx, ry);
        if (d < lo && d > 1e-4) { const k = lo / d; x[i] = ccx + rx * k; y[i] = ccy + ry * k; } else if (d > hi) { const k = hi / d; x[i] = ccx + rx * k; y[i] = ccy + ry * k; }
      }
    }
    this.collide(f.resolve, dt, false);
    if (p.flow) this.creep(dt);
  }
}
const PRESETS = {
  jelly: { name: 'Jelly', kp: 2600, ke: .95, ks: .08, ksk: .35, damp: .9988, mu: .15, e: .5 },
  slime: { name: 'Slime', kp: 1150, ke: .9, ks: .03, ksk: .2, damp: .9945, mu: .45, e: .08 },
  mochi: { name: 'Mochi', kp: 650, ke: .85, ks: .012, ksk: .1, damp: .985, mu: .85, e: 0, flow: .8, yield: .12, recover: 1.3 },
  // NeeDoh-style dough: dents and stretches linger for a moment, then ease back to round in a second or two
  dough: { name: 'Dough', kp: 520, ke: .9, ks: .1, ksk: .12, damp: .975, mu: 1, e: 0, flow: 2.2, yield: .05, recover: 1.4 },
  // Squish Studio clay: holds whatever shape you give it (very slow recovery), so silhouettes can be kneaded and kept
  clay: { name: 'Clay', kp: 520, ke: .9, ks: .1, ksk: .12, damp: .975, mu: .8, e: 0, flow: 2.4, yield: .05, recover: .15 },
  // memory foam: crushes easily and rises back slowly (a few seconds), but does come back
  foam: { name: 'Foam', kp: 420, ke: .88, ks: .12, ksk: .16, damp: .978, mu: .9, e: 0, flow: 3.2, yield: .035, recover: .85 },
};
// the in-level jelly keeps its form: stiffer, better damped, with shape memory (form) and a hard radius band so it can never collapse or over-stretch
const GAMEBODY = { name: 'game', kp: 2600, ke: .96, ks: .12, ksk: .4, damp: .984, mu: .03, e: .1, form: .11, minR: .78, maxR: 1.32 };

const noCollide = () => false;
function resolveWorld(x, y) {
  for (const s of solids) {
    if (x <= s.x0 || x >= s.x1 || y <= s.top || y >= s.bot) continue;
    const up = y - s.top, dn = s.bot - y, l = x - s.x0, r = s.x1 - x, m = Math.min(up, dn, l, r);
    if (m === up) { CR[0] = 0; CR[1] = -1; CR[2] = up; } else if (m === dn) { CR[0] = 0; CR[1] = 1; CR[2] = dn; } else if (m === l) { CR[0] = -1; CR[1] = 0; CR[2] = l; } else { CR[0] = 1; CR[1] = 0; CR[2] = r; }
    return true;
  }
  return false;
}
const RM = { l: 70, r: 890, t: 56, b: 452 };
function resolveRoom(x, y) {
  if (y > RM.b) { CR[0] = 0; CR[1] = -1; CR[2] = y - RM.b; return true; }
  if (x < RM.l) { CR[0] = 1; CR[1] = 0; CR[2] = RM.l - x; return true; }
  if (x > RM.r) { CR[0] = -1; CR[1] = 0; CR[2] = x - RM.r; return true; }
  if (y < RM.t) { CR[0] = 0; CR[1] = 1; CR[2] = RM.t - y; return true; }
  return false;
}
