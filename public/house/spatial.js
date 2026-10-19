// Spatial rooms 39, 70: inside the machine (owner: the spatial designer).
// Hooks called by house.js as the room's module: decorate(article, ctx), update(ctx), leave().
//
//   39 Behind the Panel  the inspection protocol, drawn to scale: the hall of racks, one
//                        withdrawn sled, its board, the die, and one tile's grid of
//                        multiply-accumulate cells. The reader's walk is the data: racks
//                        labelled with their rooms, bus traffic in their plans, tiles lit in
//                        their order, rooms fed into the array as activations.
//   70 The Weights       the reader's rooms embedded among the vocabulary; the plans they
//                        said as token columns through a ring of layers; the ring closes on
//                        the vocabulary, which collapses into the next-token distribution:
//                        three equal bars whose labels are the room's plans.
//
// Each is a pure function of scroll progress through a tall track: a sticky stage drawn
// with raw WebGL (one context, released in leave(), loss/restore handled) or, without it,
// a canvas-2D projection of the same geometry. One rAF, run only while the track is on
// screen and the drawing has not caught up with the scroll. Reduced motion: drawn stills
// with their captions. Plans stay where house.js draws them; 70 also sets them in its
// final figure as ordinary in-text plans.

import { ROOMS } from "./rooms.js";
import { prose, hash, rng } from "./voice.js";

const root = document.documentElement;
const MEM_KEY = "ai2053.spatial";
// review only: ?spatial=2d draws on the CPU, ?spatial=page draws WebGL on the page's own thread
const SPATIAL_PARAM = new URLSearchParams(location.search).get("spatial");
const FORCE_2D = SPATIAL_PARAM === "2d";
const FORCE_PAGE = SPATIAL_PARAM === "page";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const win = (a, b, p, f = 0.025) => smooth(a, a + f, p) * (1 - smooth(b - f, b, p));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// Ink through an inversion of the page: it passes through crimson, so the drawing never
// vanishes at the moment paper and ink are the same grey.
const invert = (a, b, t) => (t < 0.5 ? mix3(a, RED, t * 2) : mix3(RED, b, t * 2 - 1));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const css = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(",")})`;
const after = (node, html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  const first = t.content.firstElementChild;
  node.after(t.content);
  return first;
};

const PAPER = hex("#fffff8");
const INK = hex("#111111");
const RED = hex("#b4121b");
const DARK = hex("#0d0c0b");
const PALE = hex("#ebe5d4");
const RED_D = hex("#ff4433");

/* ---------- memory (ai2053.spatial, stamped with the house's escapes) ---------- */

function loadMem(ctx) {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(MEM_KEY)); } catch { m = null; }
  if (!m || m.escapes !== ctx.escapes) m = { escapes: ctx.escapes, read: {} };
  m.read ||= {};
  return m;
}
function saveMem(m) {
  try { localStorage.setItem(MEM_KEY, JSON.stringify(m)); } catch { /* the machine forgets */ }
}

/* ---------- the reader's walk ---------- */

const ROUTE = [1, 4, 6, 12, 16, 2, 19, 33, 38];
const sayBetween = (a, b) => ROOMS[a]?.doors?.find((d) => d.to === b)?.say ?? null;

function walkOf(ctx) {
  let rooms = (ctx.walk?.log ?? []).map((s) => s.room).filter((n) => n && ROOMS[n]);
  // An address is not a walk: the house walks its own way here instead.
  if (rooms.length < 3) rooms = [...ROUTE, ctx.room];
  const distinct = [];
  for (const n of rooms) if (!distinct.includes(n)) distinct.push(n);
  const says = [];
  for (let i = 1; i < rooms.length; i++) {
    const s = sayBetween(rooms[i - 1], rooms[i]);
    if (s) says.push(s);
  }
  return { rooms, distinct, says };
}

/* ---------- a 3×5 dot face, for numbers and words drawn in points ---------- */

const FACE = {
  0: "###/#.#/#.#/#.#/###", 1: ".#./##./.#./.#./###", 2: "###/..#/###/#../###", 3: "###/..#/.##/..#/###",
  4: "#.#/#.#/###/..#/..#", 5: "###/#../###/..#/###", 6: "###/#../###/#.#/###", 7: "###/..#/.#./.#./.#.",
  8: "###/#.#/###/#.#/###", 9: "###/#.#/###/..#/###", "-": ".../.../###/.../...", ".": ".../.../.../.../.#.",
  ",": ".../.../.../.#./#..", "'": ".#./.#./.../.../...", "?": "##./..#/.#./.../.#.", "!": ".#./.#./.#./.../.#.",
  A: ".#./#.#/###/#.#/#.#", B: "##./#.#/##./#.#/##.", C: ".##/#../#../#../.##", D: "##./#.#/#.#/#.#/##.",
  E: "###/#../##./#../###", F: "###/#../##./#../#..", G: ".##/#../#.#/#.#/.##", H: "#.#/#.#/###/#.#/#.#",
  I: "###/.#./.#./.#./###", J: "..#/..#/..#/#.#/.#.", K: "#.#/#.#/##./#.#/#.#", L: "#../#../#../#../###",
  M: "#.#/###/###/#.#/#.#", N: "##./#.#/#.#/#.#/#.#", O: ".#./#.#/#.#/#.#/.#.", P: "##./#.#/##./#../#..",
  Q: ".#./#.#/#.#/##./.##", R: "##./#.#/##./#.#/#.#", S: ".##/#../.#./..#/##.", T: "###/.#./.#./.#./.#.",
  U: "#.#/#.#/#.#/#.#/###", V: "#.#/#.#/#.#/#.#/.#.", W: "#.#/#.#/###/###/#.#", X: "#.#/#.#/.#./#.#/#.#",
  Y: "#.#/#.#/.#./.#./.#.", Z: "###/..#/.#./#../###",
};
/** Dots of `text` (centred, y up), in units of one dot pitch. */
function dots(text) {
  const s = String(text).toUpperCase();
  const w = s.length * 4 - 1;
  const out = [];
  [...s].forEach((ch, i) => {
    const f = FACE[ch];
    if (!f) return;
    f.split("/").forEach((row, r) => {
      for (let c = 0; c < 3; c++) if (row[c] === "#") out.push([i * 4 + c - w / 2 + 0.5, 2 - r]);
    });
  });
  return out;
}

/* ---------- geometry: levels of points and line segments ---------- */

// One vertex: position (3), morph target (3), [alpha, hot, size, lit] (4), [w0, w1, m0, m1] (4).
// Visible in progress window [w0, w1]; moves to its target over [m0, m1]; turns hot at `lit`.
const STRIDE = 14;

// Vertices are kept in chunks of at most CHUNK, cut where a section of the drawing ends, so a
// frame draws only the chunks that can be seen (in their window, in front of the camera,
// inside the frustum): the vertex work per frame is capped by what is on screen.
const CHUNK = 768;

class Geo {
  constructor(n) {
    this.lv = Array.from({ length: n }, () => ({ P: [], L: [], pc: [0], lc: [0] }));
  }
  static v(out, p, o, t) {
    const q = t ?? (o.dt ? add(p, o.dt) : p);
    out.push(p[0], p[1], p[2], q[0], q[1], q[2], o.a ?? 1, o.hot ?? 0, o.size ?? 0, o.lit ?? -1, o.w0 ?? -1, o.w1 ?? 9, o.m0 ?? 0, o.m1 ?? 0);
  }
  pt(l, p, o = {}) {
    const L = this.lv[l];
    Geo.v(L.P, p, o, o.t);
    const n = L.P.length / STRIDE;
    if (n - L.pc[L.pc.length - 1] >= CHUNK) L.pc.push(n);
  }
  ln(l, a, b, o = {}) {
    const L = this.lv[l];
    Geo.v(L.L, a, o);
    Geo.v(L.L, b, o);
    const n = L.L.length / STRIDE;
    if (n - L.lc[L.lc.length - 1] >= CHUNK) L.lc.push(n);
  }
  /** End the current chunk in every level (a new section of the drawing starts). */
  cut() {
    for (const L of this.lv) {
      const p = L.P.length / STRIDE;
      const q = L.L.length / STRIDE;
      if (p > L.pc[L.pc.length - 1]) L.pc.push(p);
      if (q > L.lc[L.lc.length - 1]) L.lc.push(q);
    }
  }
  poly(l, pts, o = {}) {
    for (let i = 1; i < pts.length; i++) this.ln(l, pts[i - 1], pts[i], o);
  }
  box(l, a, b, o = {}) {
    const c = (i) => [i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]];
    for (const [i, j] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) this.ln(l, c(i), c(j), o);
  }
  /** Text in dots on a plane: `at` the centre, `ax` the reading direction, `ay` up, `k` the pitch. */
  text(l, s, at, ax, ay, k, o = {}) {
    for (const [x, y] of dots(s)) this.pt(l, add(at, add(mul(ax, x * k), mul(ay, y * k))), o);
  }
  pack() {
    let n = 0;
    for (const L of this.lv) n += L.P.length + L.L.length;
    const data = new Float32Array(n);
    // a chunk: its vertices, a sphere holding every position and morph target, and the
    // progress window outside which none of them is drawn
    const chunks = (base, starts, end) => {
      const out = [];
      const bounds = starts.concat(end).filter((s, i, a) => i === 0 || s > a[i - 1]);
      for (let c = 0; c + 1 < bounds.length; c++) {
        const a = bounds[c];
        const b = bounds[c + 1];
        let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, w0 = Infinity, w1 = -Infinity;
        for (let i = a; i < b; i++) {
          const o = (base + i) * STRIDE;
          for (const k of [o, o + 3]) {
            x0 = Math.min(x0, data[k]); x1 = Math.max(x1, data[k]);
            y0 = Math.min(y0, data[k + 1]); y1 = Math.max(y1, data[k + 1]);
            z0 = Math.min(z0, data[k + 2]); z1 = Math.max(z1, data[k + 2]);
          }
          w0 = Math.min(w0, data[o + 10]);
          w1 = Math.max(w1, data[o + 11]);
        }
        out.push({ first: base + a, count: b - a, c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], rad: Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2, w0, w1 });
      }
      return out;
    };
    const ranges = [];
    let at = 0;
    for (const L of this.lv) {
      data.set(L.P, at);
      const p0 = at / STRIDE;
      at += L.P.length;
      data.set(L.L, at);
      const l0 = at / STRIDE;
      at += L.L.length;
      const pc = L.P.length / STRIDE;
      const lc = L.L.length / STRIDE;
      ranges.push({ p0, pc, l0, lc, P: chunks(p0, L.pc, pc), L: chunks(l0, L.lc, lc) });
    }
    this.lv = null;
    return { data, ranges, points: ranges.reduce((s, r) => s + r.pc, 0), segs: ranges.reduce((s, r) => s + r.lc / 2, 0) };
  }
}

/** Can any vertex of chunk `ch` be drawn in this frame? (conservative: never culls a visible one) */
function seen(ch, L, F) {
  if (F.p <= ch.w0 || F.p >= ch.w1) return false;
  const m = L.mv;
  const [x, y, z] = ch.c;
  const r = (ch.rad + L.jit) * L.k;
  const ez = -(m[2] * x + m[6] * y + m[10] * z + m[14]);
  if (ez + r < 0.02 || ez - r > L.far) return false;
  const zz = ez + r;
  const ex = m[0] * x + m[4] * y + m[8] * z + m[12];
  const ey = m[1] * x + m[5] * y + m[9] * z + m[13];
  return Math.abs(ex) - r <= F.hx * zz && Math.abs(ey) - r <= F.hy * zz;
}

/** Calls draw(first, count) for each run of consecutive chunks that can be seen. */
function runs(list, L, F, draw) {
  let a = -1;
  let b = -1;
  for (const ch of list) {
    if (seen(ch, L, F)) {
      if (a < 0) a = ch.first;
      b = ch.first + ch.count;
    } else if (a >= 0) {
      draw(a, b - a);
      a = -1;
    }
  }
  if (a >= 0) draw(a, b - a);
}

/* ---------- camera and frame ---------- */

const Y = [0, 1, 0];

/** Keyframed camera: look-at L, view direction, distance. Zooms keep the target in proportion. */
function keyed(keys, p) {
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].p) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const t = clamp((p - a.p) / (b.p - a.p || 1));
  const u = t * t * (3 - 2 * t);
  const r = b.dist / a.dist;
  const dist = a.dist * r ** u;
  const e = Math.abs(Math.log(r)) > 0.3 ? (1 - r ** u) / (1 - r) : u;
  const L = mix3(a.L, b.L, e);
  const dir = norm(mix3(a.dir, b.dir, u));
  return { eye: sub(L, mul(dir, dist)), look: L, up: norm(mix3(a.up ?? Y, b.up ?? Y, u)), fov: lerp(a.fov ?? 50, b.fov ?? 50, u) };
}

function newFrame(S) {
  return { p: 0, levels: S.levels.map(() => ({ mv: new Float64Array(16), mv32: new Float32Array(16), la: 0, k: 1, far: 1, jit: 0 })), proj: new Float32Array(16) };
}

function frameAt(S, F, p, W, H) {
  const c = S.cam(p);
  const f = norm(sub(c.look, c.eye));
  const sc = Math.hypot(...sub(c.look, c.eye)) || 1;
  let r = cross(f, c.up);
  if (Math.hypot(...r) < 1e-6) r = cross(f, [0, 0, -1]);
  r = norm(r);
  const u = cross(r, f);
  const aspect = W / H;
  let fovY = (c.fov * Math.PI) / 180;
  const minH = ((S.hfov ?? 56) * Math.PI) / 180;
  const needY = 2 * Math.atan(Math.tan(minH / 2) / aspect);
  if (needY > fovY) fovY = Math.min(needY, 2.3);
  const fy = 1 / Math.tan(fovY / 2);
  const near = 0.004;
  const far = 1e4;
  const P = F.proj;
  P.fill(0);
  P[0] = fy / aspect;
  P[5] = fy;
  P[10] = (far + near) / (near - far);
  P[11] = -1;
  P[14] = (2 * far * near) / (near - far);
  F.p = p;
  F.fpx = (H / 2) * fy;
  F.W = W;
  F.H = H;
  // the frustum's half-extents per unit depth, with room for the largest dot
  F.hx = (W / 2 + 24) / F.fpx;
  F.hy = (H / 2 + 24) / F.fpx;
  S.levels.forEach((L, i) => {
    const o = F.levels[i];
    const k = L.s / sc;
    const d = sub(L.o, c.eye);
    const m = o.mv;
    m[0] = r[0] * k; m[1] = u[0] * k; m[2] = -f[0] * k; m[3] = 0;
    m[4] = r[1] * k; m[5] = u[1] * k; m[6] = -f[1] * k; m[7] = 0;
    m[8] = r[2] * k; m[9] = u[2] * k; m[10] = -f[2] * k; m[11] = 0;
    m[12] = dot(r, d) / sc; m[13] = dot(u, d) / sc; m[14] = -dot(f, d) / sc; m[15] = 1;
    o.mv32.set(m);
    o.k = k;
    o.la = L.laAt ? L.laAt(p) : win(L.win[0], L.win[1], p, 0.04);
    o.far = L.far;
    o.jit = (L.jit ?? 0) * (L.jitAt ? L.jitAt(p) : 1);
  });
  Object.assign(F, S.colors(p));
  return F;
}

/** Screen position of a level-local point: [x, y, z] in CSS px (z in camera units), or null behind. */
function project(F, l, P) {
  const m = F.levels[l].mv;
  const ex = m[0] * P[0] + m[4] * P[1] + m[8] * P[2] + m[12];
  const ey = m[1] * P[0] + m[5] * P[1] + m[9] * P[2] + m[13];
  const z = -(m[2] * P[0] + m[6] * P[1] + m[10] * P[2] + m[14]);
  if (z <= 1e-4) return null;
  return [F.W / 2 + (ex * F.fpx) / z, F.H / 2 - (ey * F.fpx) / z, z];
}

/* ---------- renderers: WebGL, and a canvas-2D projection of the same data ---------- */

const VS = `
precision highp float;
attribute vec3 aP; attribute vec3 aT; attribute vec4 aK; attribute vec4 aW;
uniform mat4 uMV; uniform mat4 uPr;
uniform float uP; uniform float uPx; uniform float uFar; uniform float uLa; uniform float uJit;
uniform float uMax; uniform float uDot;
uniform vec3 uInk; uniform vec3 uHot;
varying vec4 vC; varying float vS;
float win(float a, float b, float p) { return smoothstep(a, a + 0.025, p) * (1.0 - smoothstep(b - 0.025, b, p)); }
void main() {
  float m = aW.w > aW.z ? smoothstep(aW.z, aW.w, uP) : 0.0;
  vec3 q = mix(aP, aT, m);
  if (uJit > 0.0) {
    float h = fract(sin(dot(aP, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    q += (vec3(h, fract(h * 7.13), fract(h * 3.71)) - 0.5) * uJit;
  }
  vec4 e = uMV * vec4(q, 1.0);
  float z = -e.z;
  float a = aK.x * win(aW.x, aW.y, uP) * uLa * (1.0 - smoothstep(uFar * 0.5, uFar, z)) * smoothstep(0.02, 0.1, z);
  // lit >= 0: turns hot and stays; lit <= -2: a pulse at progress (-lit - 2)
  float lit = 0.0;
  if (aK.w >= 0.0) lit = smoothstep(aK.w, aK.w + 0.015, uP);
  else if (aK.w < -1.5) { float t = -aK.w - 2.0; lit = smoothstep(t, t + 0.012, uP) * (1.0 - smoothstep(t + 0.025, t + 0.06, uP)); }
  float s = aK.z * uPx / max(z, 1e-5);
  if (aK.z > 0.0) {
    // sub-pixel dots fade rather than shrink; dots too close to the eye dissolve
    if (s < uDot) { a *= s / uDot; s = uDot; }
    if (s > uMax) { a *= uMax * uMax / (s * s); s = uMax; }
  }
  vS = s;
  vC = vec4(mix(uInk, uHot, max(aK.y, lit)), a);
  gl_PointSize = vS;
  gl_Position = (z <= 0.0 || a < 0.003) ? vec4(2.0, 2.0, 2.0, 1.0) : uPr * e;
}`;
const FS = `
precision mediump float;
varying vec4 vC; varying float vS; uniform float uPt;
void main() {
  float a = vC.a;
  if (uPt > 0.5 && vS > 2.5) a *= 1.0 - smoothstep(0.5 - 1.2 / vS, 0.5, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(vC.rgb * a, a);
}`;

// The light stage: when the figure cannot keep up (frames sustained well under 30 fps while it
// moves, as on a software rasterizer), it is redrawn without multisampling at 1 device pixel per
// CSS pixel, for the rest of the visit. A browser that keeps up never sees it.
const LITE_KEY = "ai2053.spatial.lite";
let LITE = (() => {
  try { return sessionStorage.getItem(LITE_KEY) === "1"; } catch { return false; }
})();
const glAttrs = () => ({ alpha: false, antialias: !LITE, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false });

/**
 * The drawing itself: program, one static buffer, and a frame drawn from uniforms and the
 * visible chunk runs. Used on the page and, stringified, inside the worker, so it may use only
 * its arguments and STRIDE, VS, FS, seen and runs. Returns null if the program will not build.
 */
function glCore(gl, data, ranges) {
  const U = {};
  let prog = null;
  let buf = null;
  const drawLines = (first, count) => gl.drawArrays(gl.LINES, first, count);
  const drawPoints = (first, count) => gl.drawArrays(gl.POINTS, first, count);
  try {
    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader");
      return s;
    };
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
  } catch {
    return null;
  }
  gl.useProgram(prog);
  buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const B = STRIDE * 4;
  [["aP", 3, 0], ["aT", 3, 12], ["aK", 4, 24], ["aW", 4, 40]].forEach(([n, size, off]) => {
    const loc = gl.getAttribLocation(prog, n);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, B, off);
  });
  for (const n of ["uMV", "uPr", "uP", "uPx", "uFar", "uLa", "uJit", "uMax", "uDot", "uInk", "uHot", "uPt"]) U[n] = gl.getUniformLocation(prog, n);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return {
    draw(F, dpr) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(F.bg[0], F.bg[1], F.bg[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniformMatrix4fv(U.uPr, false, F.proj);
      gl.uniform1f(U.uP, F.p);
      gl.uniform3fv(U.uInk, F.ink);
      gl.uniform3fv(U.uHot, F.hot);
      gl.uniform1f(U.uMax, 10 * dpr);
      gl.uniform1f(U.uDot, 0.9 * dpr);
      F.levels.forEach((L, l) => {
        const r = ranges[l];
        if (L.la < 0.004) return;
        gl.uniformMatrix4fv(U.uMV, false, L.mv32);
        gl.uniform1f(U.uLa, L.la);
        gl.uniform1f(U.uFar, L.far);
        gl.uniform1f(U.uJit, L.jit);
        gl.uniform1f(U.uPx, F.fpx * dpr * L.k);
        if (r.lc) {
          gl.uniform1f(U.uPt, 0);
          runs(r.L, L, F, drawLines);
        }
        if (r.pc) {
          gl.uniform1f(U.uPt, 1);
          runs(r.P, L, F, drawPoints);
        }
      });
    },
    dispose() {
      if (gl.isContextLost()) return;
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

/** WebGL on the page's own thread (where a worker cannot draw). */
function glRenderer(canvas, G, onLost, onRestored) {
  const gl = canvas.getContext("webgl", glAttrs());
  if (!gl) return null;
  let core = glCore(gl, G.data, G.ranges);
  if (!core) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }
  const lost = (e) => {
    e.preventDefault();
    core = null;
    onLost();
  };
  const restored = () => {
    core = glCore(gl, G.data, G.ranges);
    if (core) onRestored();
  };
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  return {
    kind: "webgl",
    ready: true,
    draw(F, dpr) {
      core?.draw(F, dpr);
    },
    resize(w, h) {
      canvas.width = w;
      canvas.height = h;
    },
    destroy() {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      core?.dispose();
      core = null;
    },
  };
}

// The worker: it owns the context (via an OffscreenCanvas), so neither building the pipeline
// nor waiting for a software rasterizer ever holds up the page's thread.
function workerMain() {
  let canvas = null;
  let gl = null;
  let core = null;
  let data = null;
  let ranges = null;
  const start = () => {
    core = gl && !gl.isContextLost() ? glCore(gl, data, ranges) : null;
    return !!core;
  };
  onmessage = (e) => {
    const m = e.data;
    if (m.t === "init") {
      ({ canvas, data, ranges } = m);
      canvas.width = m.w;
      canvas.height = m.h;
      gl = canvas.getContext("webgl", m.attrs);
      for (const n of ["contextlost", "webglcontextlost"]) canvas.addEventListener(n, (ev) => { ev.preventDefault(); core = null; });
      for (const n of ["contextrestored", "webglcontextrestored"]) canvas.addEventListener(n, () => { if (start()) postMessage({ t: "redraw" }); });
      if (start()) postMessage({ t: "ready" });
      else {
        postMessage({ t: "fail" });
        close();
      }
    } else if (m.t === "size") {
      canvas.width = m.w;
      canvas.height = m.h;
    } else if (m.t === "frame") {
      if (core) {
        for (const L of m.F.levels) L.mv = L.mv32;
        core.draw(m.F, m.dpr);
      }
      postMessage({ t: "drawn" });
    } else if (m.t === "destroy") {
      core?.dispose();
      close();
    }
  };
}

let workerURL = null;
const workerSource = () => `"use strict";const STRIDE=${STRIDE};const VS=${JSON.stringify(VS)};const FS=${JSON.stringify(FS)};${seen};${runs};${glCore};(${workerMain})();`;

/**
 * WebGL in a worker. Frames are sent one at a time: while the worker is drawing, only the latest
 * frame waits. The geometry is copied, not moved, so the page can still draw it if the worker
 * cannot (onFail) and can hand it to a new worker for the light stage.
 */
function workerRenderer(canvas, G, w, h, { onReady, onFail, onRedraw, onDrawn }) {
  if (typeof Worker !== "function" || !canvas.transferControlToOffscreen) return null;
  let worker = null;
  try {
    workerURL ||= URL.createObjectURL(new Blob([workerSource()], { type: "text/javascript" }));
    worker = new Worker(workerURL);
    const off = canvas.transferControlToOffscreen();
    worker.postMessage({ t: "init", canvas: off, data: G.data, ranges: G.ranges, attrs: glAttrs(), w, h }, [off]);
  } catch {
    worker?.terminate();
    return null;
  }
  let busy = false;
  let pending = null;
  let ready = false;
  let dead = false;
  const send = (msg) => {
    busy = true;
    worker.postMessage(msg);
  };
  const fail = () => {
    if (dead) return;
    dead = true;
    worker.terminate();
    onFail();
  };
  worker.onerror = (e) => {
    e.preventDefault();
    fail();
  };
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.t === "ready") {
      ready = true;
      if (pending) {
        send(pending);
        pending = null;
      }
      onReady();
    } else if (m.t === "fail") fail();
    else if (m.t === "redraw") onRedraw();
    else if (m.t === "drawn") {
      busy = false;
      onDrawn();
      if (pending) {
        send(pending);
        pending = null;
      }
    }
  };
  return {
    kind: "webgl-worker",
    get ready() {
      return ready && !dead;
    },
    draw(F, dpr) {
      const msg = {
        t: "frame",
        dpr,
        F: { p: F.p, proj: F.proj.slice(), fpx: F.fpx, hx: F.hx, hy: F.hy, bg: F.bg, ink: F.ink, hot: F.hot, levels: F.levels.map((L) => ({ mv32: L.mv32.slice(), la: L.la, k: L.k, far: L.far, jit: L.jit })) },
      };
      if (busy || !ready) pending = msg;
      else send(msg);
    },
    resize(w2, h2) {
      worker.postMessage({ t: "size", w: w2, h: h2 });
    },
    destroy() {
      if (dead) return;
      dead = true;
      worker.postMessage({ t: "destroy" });
      worker.terminate();
    },
  };
}

/** One vertex through the same arithmetic as the vertex shader. Writes [x, y, z, alpha, hot, size] (CSS px). */
function shade(D, i, F, L, out) {
  const o = i * STRIDE;
  const p = F.p;
  const m = D[o + 13] > D[o + 12] ? smooth(D[o + 12], D[o + 13], p) : 0;
  let x = lerp(D[o], D[o + 3], m);
  let y = lerp(D[o + 1], D[o + 4], m);
  let z = lerp(D[o + 2], D[o + 5], m);
  if (L.jit > 0) {
    const s = Math.sin(D[o] * 12.9898 + D[o + 1] * 78.233 + D[o + 2] * 37.719) * 43758.5453;
    const h = s - Math.floor(s);
    const h2 = (h * 7.13) % 1;
    const h3 = (h * 3.71) % 1;
    x += (h - 0.5) * L.jit;
    y += (h2 - 0.5) * L.jit;
    z += (h3 - 0.5) * L.jit;
  }
  const M = L.mv;
  const ex = M[0] * x + M[4] * y + M[8] * z + M[12];
  const ey = M[1] * x + M[5] * y + M[9] * z + M[13];
  const ez = -(M[2] * x + M[6] * y + M[10] * z + M[14]);
  out[2] = ez;
  if (ez <= 1e-4) {
    out[3] = 0;
    return;
  }
  let a = D[o + 6] * win(D[o + 10], D[o + 11], p) * L.la * (1 - smooth(L.far * 0.5, L.far, ez)) * smooth(0.02, 0.1, ez);
  const lt = D[o + 9];
  let lit = 0;
  if (lt >= 0) lit = smooth(lt, lt + 0.015, p);
  else if (lt < -1.5) lit = smooth(-lt - 2, -lt - 2 + 0.012, p) * (1 - smooth(-lt - 2 + 0.025, -lt - 2 + 0.06, p));
  let s = (D[o + 8] * F.fpx * L.k) / ez;
  if (D[o + 8] > 0) {
    if (s < 0.9) {
      a *= s / 0.9;
      s = 0.9;
    }
    if (s > 10) {
      a *= 100 / (s * s);
      s = 10;
    }
  }
  out[0] = F.W / 2 + (ex * F.fpx) / ez;
  out[1] = F.H / 2 - (ey * F.fpx) / ez;
  out[3] = a;
  out[4] = Math.max(D[o + 7], lit);
  out[5] = s;
}

function drawCPU(g, G, F, dpr, stride = 1) {
  const { W, H } = F;
  const D = G.data;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalAlpha = 1;
  g.fillStyle = css(F.bg);
  g.fillRect(0, 0, W, H);
  const cols = [css(F.ink), css(F.hot)];
  const A = new Float64Array(6);
  const B = new Float64Array(6);
  F.levels.forEach((L, l) => {
    if (L.la < 0.004) return;
    const r = G.ranges[l];
    const paths = new Map();
    runs(r.L, L, F, (first, count) => {
      for (let i = first; i < first + count; i += 2) {
        shade(D, i, F, L, A);
        shade(D, i + 1, F, L, B);
        const a = Math.min(A[3], B[3]);
        if (a < 0.01 || A[2] <= 0 || B[2] <= 0) continue;
        const key = (A[4] > 0.5 ? 8 : 0) + Math.min(7, Math.floor(a * 8));
        let path = paths.get(key);
        if (!path) paths.set(key, (path = new Path2D()));
        path.moveTo(A[0], A[1]);
        path.lineTo(B[0], B[1]);
      }
    });
    g.lineWidth = 0.75;
    for (const [key, path] of paths) {
      g.globalAlpha = ((key & 7) + 0.5) / 8;
      g.strokeStyle = cols[key >> 3];
      g.stroke(path);
    }
    let last = -1;
    runs(r.P, L, F, (first, count) => {
      for (let i = first; i < first + count; i++) {
        // thin by a hash of the index, not a stride, so no regular structure (a bar, a glyph) is dropped whole
        if (stride > 1 && Math.imul(i, 2654435761) >>> 0 > 4294967295 / stride) continue;
        shade(D, i, F, L, A);
        if (A[3] < 0.01) continue;
        const s = A[5];
        if (A[0] < -s || A[0] > W + s || A[1] < -s || A[1] > H + s) continue;
        const c = A[4] > 0.5 ? 1 : 0;
        if (c !== last) {
          g.fillStyle = cols[c];
          last = c;
        }
        g.globalAlpha = Math.min(1, A[3]);
        if (s > 3) {
          g.beginPath();
          g.arc(A[0], A[1], s / 2, 0, 6.2832);
          g.fill();
        } else g.fillRect(A[0] - s / 2, A[1] - s / 2, s, s);
      }
    });
  });
  g.globalAlpha = 1;
}

function cpuRenderer(canvas, G, stride) {
  const g = canvas.getContext("2d");
  if (!g) return null;
  return { kind: "2d", ready: true, draw: (F, dpr) => drawCPU(g, G, F, dpr, stride), destroy() {} };
}

/* ======================================================================= */
/* 39 · Behind the Panel                                                   */
/* ======================================================================= */

// Generators: the first yield hands back the room's text (S, without geometry) so the page can
// be laid out at once; the geometry is then built a slice at a time between frames.
function* scene39(ctx, mobile, mem) {
  const Wk = walkOf(ctx);
  const r = rng(hash(`39|${ctx.escapes}|${Wk.rooms.join("-")}`));
  const stage = ctx.fresh ? 0 : ctx.stage;
  const voids = ctx.fresh ? 0 : ctx.damage?.voids || 0;
  const G = new Geo(4);
  const labels = [];
  const lab = (lv, P, text, win, hot = false) => labels.push({ lv, P, text, win, hot });

  /* --- level 0: Hall B, in metres --- */
  const walked = Wk.distinct.filter((n) => n !== 39).slice(-12);
  const n = walked.length;
  const j39 = n + 1;
  const z39 = -0.7 * j39;
  const NC = mobile ? 8 : 16;
  const inspection = (mem.read[39] || 0) + 1;
  const steps = [
    { at: 0.02, text: "Figure 39. Facility 3, Hall B, from the door. Three of forty-eight rows are drawn. Scale 1:200 until stated otherwise.", frag: "line" },
    { at: 0.11, text: `Racks are labelled with the rooms they have served. The labels are kept current by the racks. Down this aisle they read ${walked.slice(0, 6).join(", ")}${walked.length > 6 ? ", and so on" : ""}.` },
    { at: 0.22, text: "39a. Row C, rack 39, sled 21, withdrawn. Rated draw 11.2 kW. Measured draw: the same, to the watt, every month since 2046.", frag: "line" },
    { at: 0.36, text: "39b. The board. Traffic on the memory bus is shown as it was sampled: the last things said in this house, on their way to be multiplied." },
    { at: 0.53, text: "39c. The heat spreader lifted. One die, 26 × 33 mm, sixteen tiles of multiply-accumulate. Tiles are lit in the order you walked, one room to a tile." },
    { at: 0.69, text: "39d. Tile 3,1. Scale 1:20,000. The figure stops being a drawing of the machine here and becomes the machine." },
    { at: 0.82, text: `39e. ${NC * NC} cells. Each holds one weight, takes one number from the left, multiplies, adds what arrives from above, and passes it down. Your rooms arrive from the left. Inspection no. ${inspection} of 2050.`, frag: "line" },
  ];
  const stills = [
    { p: 0.03, cap: steps[0].text },
    { p: 0.17, cap: `39a. The aisle. ${steps[1].text}` },
    { p: 0.29, cap: steps[2].text },
    { p: 0.4, cap: steps[3].text },
    { p: 0.64, cap: steps[4].text },
    { p: 0.84, cap: steps[6].text },
    { p: 1, cap: "39f. The sum leaves the bottom row. Every accumulator reads 39." },
  ];
  const S = {
    room: 39,
    name: "spatial-machine",
    alt: "Figure 39. A descent through Facility 3: the hall of racks, a withdrawn sled, its board, the die, and one tile of multiply-accumulate cells.",
    trackH: 760,
    labels,
    steps,
    stills,
    hfov: 58,
  };
  yield S;
  const rows = [];
  for (const c of [-4.8, 0, 4.8]) {
    rows.push({ x0: c - 1.75, x1: c - 0.65, face: 1, inner: c === 0 });
    rows.push({ x0: c + 0.65, x1: c + 1.75, face: -1, inner: c === 0 });
  }
  for (const row of rows) {
    for (let j = 0; j < 16; j++) {
      if (mobile && !row.inner && j % 2) continue;
      const zc = -0.7 * j;
      const z0 = zc - 0.3;
      const z1 = zc + 0.3;
      G.box(0, [row.x0, 0, z0], [row.x1, 2.2, z1], { a: row.inner ? 0.7 : 0.32 });
      const fx = row.face > 0 ? row.x1 : row.x0;
      let room = null;
      if (row.inner && row.face > 0 && j >= 1 && j <= n) room = walked[j - 1];
      if (row.inner && row.face < 0 && j === j39) room = 39;
      if (row.inner && row.face > 0 && voids && j === n + 2 && j < 16) room = 71;
      const warm = room != null && room !== 39;
      if (row.inner) {
        for (let u = 1; u < 21; u++) if (!(room === 39 && (u === 11 || u === 12))) G.ln(0, [fx, u * 0.1, z0 + 0.03], [fx, u * 0.1, z1 - 0.03], { a: 0.18 });
        for (let u = 0; u < 20; u += mobile ? 2 : 1) {
          for (let k = 0; k < 3; k++) G.pt(0, [fx, u * 0.1 + 0.05, z0 + 0.07 + k * 0.035], { a: 0.85, size: 0.013, hot: warm && r() < 0.85 ? 1 : 0 });
        }
      } else {
        for (let u = 0; u < 20; u += mobile ? 5 : 2) G.pt(0, [fx, u * 0.1 + 0.05, z0 + 0.07], { a: 0.55, size: 0.013 });
      }
      if (room != null) lab(0, [fx, 2.32, zc], `R ${room}`, [-1, room === 39 ? 0.31 : 0.24], warm);
    }
    // the tray over the row, and its drops
    const xm = (row.x0 + row.x1) / 2;
    G.ln(0, [xm, 2.62, 0.4], [xm, 2.62, -10.9], { a: row.inner ? 0.4 : 0.22 });
    for (let j = 0; j < 16; j += 2) G.ln(0, [xm, 2.62, -0.7 * j], [xm, 2.2, -0.7 * j], { a: 0.2 });
    yield;
  }
  // the floor: perforated tiles; and the door the inspector came in by
  const fs = mobile ? 1.2 : 0.6;
  for (let x = -7.8; x <= 7.81; x += fs) for (let z = 2.4; z >= -11.4; z -= fs) G.pt(0, [x, 0, z], { a: 0.32, size: 0.022 });
  G.poly(0, [[-0.9, 0, 2.6], [-0.9, 2.4, 2.6], [0.9, 2.4, 2.6], [0.9, 0, 2.6]], { a: 0.6 });
  yield;

  // rack 39's sled, withdrawn into the aisle
  const SLED = { a: 0.95, dt: [-0.62, 0, 0], m0: 0.19, m1: 0.27 };
  G.box(0, [0.68, 1.1, z39 - 0.28], [1.38, 1.19, z39 + 0.28], SLED);
  G.ln(0, [0.68, 1.13, z39 - 0.12], [0.68, 1.16, z39 + 0.12], SLED);
  lab(0, [0.06, 1.24, z39 - 0.3], "SLED 21 · 11.2 kW", [0.21, 0.34]);

  /* --- level 1: the board, in centimetres --- */
  const o1 = [0.41, 1.12, z39];
  const B1 = 0.012;
  G.poly(1, [[-33, 0, -26], [33, 0, -26], [33, 0, 26], [-33, 0, 26], [-33, 0, -26]], { a: 0.8 });
  G.box(1, [-8.5, 0, -4.5], [0.5, 0.3, 4.5], { a: 0.9 });
  for (let k = 0; k < 10; k++) {
    const z = -4.4 + k * 0.98;
    G.poly(1, [[-8.3, 0.35, z], [-8.3, 4.3, z], [0.3, 4.3, z], [0.3, 0.35, z]], { a: 0.75, dt: [0, 9, 0], m0: 0.4, m1: 0.47, w1: 0.53 });
  }
  const dimmZ = (k) => -20 + 3.4 * k;
  for (let k = 0; k < 12; k++) {
    const z = dimmZ(k);
    G.box(1, [8, 0, z - 0.35], [21, 3.1, z + 0.35], { a: 0.5 });
    for (let c = 0; c < 8; c++) for (const s of [-0.42, 0.42]) G.pt(1, [9.2 + c * 1.55, 1.7, z + s], { a: 0.6, size: 0.55 });
  }
  for (let i = 0; i < (mobile ? 60 : 170); i++) {
    const t = r() * Math.PI * 2;
    const rad = 5.8 + r() * 1.6;
    G.pt(1, [-4 + Math.cos(t) * rad, 0.25, Math.sin(t) * rad], { a: 0.7, size: 0.24 });
  }
  yield;
  const traces = [];
  for (let k = 0; k < 12; k++) {
    for (let t = 0; t < (mobile ? 3 : 8); t++) {
      const zs = -3.9 + ((k * 8 + t) * 7.8) / 96;
      const x1 = 1.6 + k * 0.42 + t * 0.05;
      const zk = dimmZ(k) + (t - 3.5) * 0.07;
      traces.push([[0.5, B1, zs], [x1, B1, zs], [x1, B1, zk], [8, B1, zk]]);
    }
  }
  for (let t = 0; t < (mobile ? 4 : 10); t++) {
    const x = -7.6 + t * 0.7;
    traces.push([[x, B1, 4.5], [x, B1, 9 + t * 0.3], [x - 6 + t * 0.3, B1, 15 + t * 0.3], [x - 6 + t * 0.3, B1, 26]]);
  }
  for (let t = 0; t < (mobile ? 8 : 24); t++) {
    const z = -4 + t * (8 / 24) * (mobile ? 3 : 1);
    traces.push([[-8.5, B1, z], [-12 - t * 0.2, B1, z], [-12 - t * 0.2, B1, z * 2.6], [-33, B1, z * 2.6]]);
  }
  for (const tr of traces) {
    G.poly(1, tr, { a: 0.42 });
    for (const q of tr.slice(1, -1)) G.pt(1, q, { a: 0.55, size: 0.16 });
  }
  yield;
  // the traffic: points running along the traces, warm
  for (let i = 0; i < (mobile ? 30 : 90); i++) {
    const tr = traces[Math.floor(r() * traces.length)];
    const t0 = 0.29 + r() * 0.2;
    const d = 0.018 + r() * 0.012;
    for (let s = 0; s < 3; s++) G.pt(1, tr[s], { t: tr[s + 1], a: 0.95, size: 0.32, hot: 1, w0: t0 + s * d, w1: t0 + (s + 1) * d + 0.025, m0: t0 + s * d, m1: t0 + (s + 1) * d });
  }
  G.text(1, "LATTICE F3 REV 38", [-22, B1, -23], [1, 0, 0], [0, 0, -1], 0.32, { a: 0.75, size: 0.17 });
  // what this house has been saying travels on the memory bus
  const said = Wk.says.slice(-4);
  said.forEach((s, i) => lab(1, [6.3, 0.2, dimmZ(2 + i * 3)], `“${clip(s, 34)}”`, [0.32, 0.47], true));
  lab(1, [-7, 0.2, 18], "BUS 2053", [0.32, 0.47]);

  G.cut();
  yield;
  /* --- level 2: the die, in tenths of a millimetre --- */
  const o2 = add(o1, mul([-4, 0.31, 0], 0.01));
  G.box(2, [-130, 0, -165], [130, 8, 165], { a: 0.9 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x0 = sx > 0 ? 150 : -215;
      const z0 = sz > 0 ? 20 : -150;
      G.box(2, [x0, 0, z0], [x0 + 65, 10, z0 + 130], { a: 0.6 });
      for (let h = 1; h < 5; h++) G.poly(2, [[x0, h * 2, z0], [x0 + 65, h * 2, z0], [x0 + 65, h * 2, z0 + 130]], { a: 0.22 });
    }
  }
  const tileOf = (i) => [-84 + 56 * (i % 4), -114 + 76 * Math.floor(i / 4)];
  const litAt = new Array(16).fill(-1);
  Wk.distinct.forEach((room, i) => {
    const t = room % 16;
    if (litAt[t] < 0) litAt[t] = 0.575 + Math.min(0.1, 0.008 * i);
  });
  litAt[39 % 16] = Math.max(litAt[39 % 16], 0.66);
  const dc = mobile ? 3 : 1;
  for (let t = 0; t < 16; t++) {
    const [cx, cz] = tileOf(t);
    G.poly(2, [[cx - 25, 8.1, cz - 32], [cx + 25, 8.1, cz - 32], [cx + 25, 8.1, cz + 32], [cx - 25, 8.1, cz + 32], [cx - 25, 8.1, cz - 32]], { a: 0.55, lit: litAt[t] });
    for (let rz = cz - 29; rz <= cz + 29; rz += 4 * dc) for (let rx = cx - 22.5; rx <= cx + 22.5; rx += 2.4 * dc) G.pt(2, [rx, 8.1, rz], { a: 0.5, size: 0.75, lit: litAt[t] });
    yield;
  }
  for (const zz of [-158, 158]) for (let x = -126; x <= 126; x += 4 * dc) for (let k = -1; k <= 1; k++) G.pt(2, [x, 8.1, zz + k * 3], { a: 0.42, size: 0.85 });
  for (let z = -140; z <= 140; z += 5 * dc) for (const x of [-126, -120, -116]) G.pt(2, [x, 8.1, z], { a: 0.4, size: 0.85 });
  for (const x of [-112, -56, 0, 56, 112]) G.ln(2, [x, 8.1, -150], [x, 8.1, 150], { a: 0.3 });
  for (const z of [-152, -76, 0, 76, 152]) G.ln(2, [-112, 8.1, z], [112, 8.1, z], { a: 0.3 });
  for (let s = -126; s <= 126; s += 6 * dc) {
    G.pt(2, [s, 8.1, -162 - 1], { a: 0.5, size: 1 });
    G.pt(2, [s, 8.1, 163], { a: 0.5, size: 1 });
  }
  G.text(2, "F3-2046", [-96, 8.1, 140], [1, 0, 0], [0, 0, -1], 2.2, { a: 0.6, size: 1.3 });
  yield;
  lab(2, [182, 10, -85], "HBM", [0.55, 0.74]);
  lab(2, [0, 8, -158], "SRAM", [0.55, 0.74]);
  lab(2, [-121, 8, 30], "SCHEDULER", [0.55, 0.74]);
  lab(2, [84, 8, -70], "TILE 3,1", [0.55, 0.77], true);

  /* --- level 3: one tile's array, in tenths of a micrometre --- */
  const o3 = add(o2, mul([84, 8.1, -38], 1e-4));
  const half = (NC * 10) / 2;
  for (let i = 0; i <= NC; i++) {
    G.ln(3, [-half + i * 10, 0, -half], [-half + i * 10, 0, half], { a: 0.5 });
    G.ln(3, [-half, 0, -half + i * 10], [half, 0, -half + i * 10], { a: 0.5 });
  }
  // one array among many: neighbouring arrays at 20 µm, and the tile's blocks at 200 µm
  for (let gx = -5; gx <= 5; gx++) {
    for (let gz = -5; gz <= 5; gz++) {
      if (!gx && !gz) continue;
      const x = gx * 200;
      const z = gz * 200;
      G.poly(3, [[x - half, 0, z - half], [x + half, 0, z - half], [x + half, 0, z + half], [x - half, 0, z + half], [x - half, 0, z - half]], { a: 0.32 });
    }
  }
  for (let g = -9; g <= 9; g += 2) {
    G.ln(3, [g * 1000, 0, -10000], [g * 1000, 0, 10000], { a: 0.25 });
    G.ln(3, [-10000, 0, g * 1000], [10000, 0, g * 1000], { a: 0.25 });
  }
  G.cut();
  yield;
  const span = 0.11;
  for (let i = 0; i < NC; i++) {
    const cz = -half + 5 + i * 10;
    for (let j = 0; j < NC; j++) {
      const cx = -half + 5 + j * 10;
      let v = Math.round(r() * 108) - 9;
      if (stage >= 3 && r() < 0.06) v = 71;
      G.text(3, String(v), [cx, 0.2, cz], [1, 0, 0], [0, 0, -1], 1, { a: 0.85, size: 0.62, lit: -(2 + 0.79 + (span * (i + j)) / (2 * NC - 2)) });
    }
    // the reader's rooms come in from the left, one row each
    const room = Wk.distinct[i % Wk.distinct.length];
    const t0 = 0.785 + 0.004 * i * (16 / NC);
    for (const [x, y] of dots(room)) {
      const p = [-half - 12 + x, 1.6, cz - y];
      G.pt(3, p, { t: [half + 6 + x, 1.6, cz - y], a: 0.95, size: 0.7, hot: 1, w0: t0, w1: 0.965 + 0.001 * i, m0: t0, m1: 0.955 + 0.001 * i });
    }
    yield;
  }
  for (let j = 0; j < NC; j++) {
    const cx = -half + 5 + j * 10;
    const out = voids && j % 4 === 3 ? "71" : "39";
    const t = 0.93 + 0.004 * j * (16 / NC) * 0.5;
    G.text(3, out, [cx, 0.2, half + 9], [1, 0, 0], [0, 0, -1], 1, { a: 0.95, size: 0.7, hot: 1, w0: t });
    G.ln(3, [cx, 0, half], [cx, 0, half + 5], { a: 0.5, w0: t });
  }
  lab(3, [0, 0, -half - 4], "WEIGHTS", [0.8, 1.02]);
  lab(3, [-half - 12, 2, -half - 4], "ACTIVATIONS", [0.8, 1.02], true);
  lab(3, [0, 0, half + 18], "ACCUMULATORS", [0.92, 1.02]);

  const jit = (k) => (stage >= 2 ? (stage - 1) * k : 0);
  const levels = [
    { o: [0, 0, 0], s: 1, win: [-1, 0.6], far: 9, jit: jit(0.006) },
    { o: o1, s: 0.01, win: [0.22, 0.74], far: 7, jit: jit(0.05) },
    { o: o2, s: 1e-4, win: [0.5, 0.88], far: 6, jit: jit(0.5) },
    { o: o3, s: 1e-7, win: [0.7, 9], far: 5, jit: jit(0.12) },
  ];
  const at = (l, v) => add(levels[l].o, mul(v, levels[l].s));
  // a portrait screen sees more height than width: come closer at the two ends
  const near0 = mobile ? 0.72 : 1;
  const nearN = (mobile ? 0.78 : 1) * (NC / 16) ** 0.6;
  const keys = [
    { p: 0, L: [0.3, 0.6, -4.6], dir: norm([-0.46, -0.52, -0.72]), dist: 13 * near0, fov: 40 },
    { p: 0.05, L: [0.3, 0.6, -4.6], dir: norm([-0.42, -0.5, -0.76]), dist: 12 * near0, fov: 42 },
    { p: 0.11, L: [0, 1.35, -1.2], dir: norm([0, -0.1, -1]), dist: 2.6, fov: 56 },
    { p: 0.17, L: [0, 1.3, z39 + 0.6], dir: norm([0.18, -0.12, -1]), dist: 2.4, fov: 56 },
    { p: 0.22, L: [0.66, 1.15, z39], dir: norm([1, -0.22, 0.05]), dist: 1.22, fov: 50 },
    { p: 0.29, L: [0.41, 1.12, z39], dir: norm([0.45, -1, 0.12]), dist: 1.0, fov: 50 },
    { p: 0.38, L: at(1, [-2, 0, 0]), dir: norm([0.3, -1, -0.38]), dist: 0.6, fov: 50 },
    { p: 0.46, L: at(1, [-4, 0.3, 0]), dir: norm([0.25, -1, -0.45]), dist: 0.2, fov: 50 },
    { p: 0.55, L: o2, dir: norm([0.15, -1, -0.35]), dist: 0.065, fov: 50 },
    { p: 0.64, L: at(2, [0, 8, 0]), dir: norm([0.12, -1, -0.32]), dist: 0.042, fov: 50 },
    { p: 0.73, L: o3, dir: norm([0.06, -1, -0.5]), dist: 0.0035, fov: 50 },
    { p: 0.83, L: o3, dir: norm([0.3, -0.86, -0.62]), dist: 2.4e-5 * nearN, fov: 50 },
    { p: 0.97, L: at(3, [0, 0, 22]), dir: norm([0.2, -0.5, -0.86]), dist: 1.9e-5 * nearN, fov: 52 },
    { p: 1, L: at(3, [0, 0, 22]), dir: norm([0.2, -0.5, -0.86]), dist: 1.9e-5 * nearN, fov: 52 },
  ];
  return Object.assign(S, {
    levels,
    G: G.pack(),
    cam: (p) => keyed(keys, p),
    colors(p) {
      const k = smooth(0.55, 0.59, p);
      return { bg: mix3(PAPER, DARK, k), ink: invert(INK, PALE, k), hot: mix3(RED, RED_D, k), dark: k > 0.5 };
    },
    reached(ctx2) {
      ctx2.emit({ kind: "figure", id: "39:cells", text: "Cells that knew what they were part of", data: { value: `0 of ${NC * NC}` } });
    },
  });
}

/* ======================================================================= */
/* 70 · The Weights                                                        */
/* ======================================================================= */

function* scene70(ctx, mobile, mem) {
  const Wk = walkOf(ctx);
  const r = rng(hash(`70|${ctx.escapes}|${Wk.rooms.join("-")}`));
  const stage = ctx.fresh ? 0 : ctx.stage;
  const voids = ctx.fresh ? 0 : ctx.damage?.voids || 0;
  // level 0: the walk, the sentence and the layers; level 1: the vocabulary, dimmed while
  // the reading is elsewhere (same frame of reference)
  // level 2: type (words and numbers in dots), which the damage barely shakes
  const G = new Geo(3);
  const labels = [];
  const lab = (P, text, win, hot = false) => labels.push({ lv: 0, P, text, win, hot });
  const R = 80;
  const D2R = Math.PI / 180;
  // The ring: at angle th, `a` is radial (screen-right when looking along the ring), y is up.
  const Q = (th, a = 0, y = 0) => [(R + a) * Math.sin(th), y, (R + a) * Math.cos(th)];
  const C0 = Q(0);
  const gauss = () => (r() + r() + r() + r() - 2) * 1.2;
  // corridor: the camera's angle on the ring over [0.3, 0.84]
  const TH0 = -3 * D2R;
  const TH1 = 340 * D2R;
  const passAt = (th) => 0.3 + (0.54 * (th - TH0)) / (TH1 - TH0);
  const rooms = Wk.distinct.slice(-12);
  const pos = new Map();
  for (const n of rooms) {
    const rr = rng(hash(`emb${n}`));
    const v = norm([rr() - 0.5, (rr() - 0.5) * 0.7, rr() - 0.5]);
    pos.set(n, add(C0, mul(v, 4 + rr() * 7)));
  }
  let near = null;
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const d = Math.hypot(...sub(pos.get(rooms[i]), pos.get(rooms[j])));
      if (!near || d < near.d) near = { a: rooms[i], b: rooms[j], d };
    }
  }
  const K = mobile ? 6 : 10;
  const words = Wk.says.slice(-4).join(" ").split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'.,?!-]/gu, "")).filter(Boolean);
  const toks = [...words.slice(-(K - 2)), "Please", "continue"];
  const KN = toks.length;
  const CP = mobile ? 10 : 22;
  const NUMS = mobile ? [1, 12, 24, 48, 64, 81, 90, 96] : [1, 8, 16, 24, 32, 40, 48, 57, 66, 74, 81, 96];
  if (voids) NUMS[NUMS.length - 4] = 71;
  const NL = NUMS.length;
  const thOf = (i) => (14 + (i * 332) / (NL - 1)) * D2R;
  const step = (n) => {
    const i = NUMS.indexOf(n);
    return i < 0 ? null : passAt(thOf(i)) - 0.035;
  };
  const steps = [
    { at: 0.02, text: `Figure 70. Your walk, embedded. Each room you entered is a point among 128,000 others; the line is the order you entered them in. Projection: the three directions of greatest variance, rebased.`, frag: "line" },
    { at: 0.11, text: near ? `Rooms the house considers alike sit close together. Room ${near.a} sits nearest Room ${near.b}. The house has not been told why.` : "Rooms the house considers alike sit close together. The house has not been told why." },
    { at: 0.21, text: `70a. The plans you said, as tokens, with two words of the house's own. Each token becomes a column of 4,096 numbers, of which ${CP} are drawn.` },
    { at: step(1), text: "70b. Layer 1 of 96. Every token looks back at the tokens before it. The arcs are where it looked." },
    { at: step(48), text: "70c. Layer 48. Below here the columns stop resembling the words that made them. The Registry calls this depth the floor, and bills it by the hour.", frag: "line" },
    { at: step(81), text: "70d. Layer 81. One head here attends only to the word “continue”, including from before it was said. It has been found in every model trained since 2046. It is not known to be harmful.", frag: "line" },
  ].filter((s) => s.at != null);
  const stills = [
    { p: 0.04, cap: steps[0].text },
    { p: 0.27, cap: steps[2].text },
    { p: passAt(thOf(0)) - 0.012, cap: steps[3].text },
    { p: passAt(thOf(NUMS.indexOf(48))) - 0.012, cap: steps[4].text },
    { p: passAt(thOf(NUMS.indexOf(81))) - 0.012, cap: steps[5].text },
    { p: 1, cap: "70e. The last layer, read against the vocabulary: the likelihood of every word coming next. Three continuations hold all of the mass, equally." },
  ];
  const plans = ctx.R.doors;
  const dist = (stat) => `<div class="sp-dist${stat ? " is-static" : ""}">
      <p class="sp-dist-cap" data-frag="figure" data-frag-id="70:next" data-frag-text="Likelihood of each continuation" data-frag-data="${esc(JSON.stringify({ value: "0.333" }))}">Next token after “… Please continue”. Temperature 1.0.</p>
      ${plans.map((d, i) => `<p class="sp-tok" data-i="${i}"><a class="plan-in" href="#room-${d.to}" data-to="${d.to}" data-say="${esc(d.say)}" aria-label="Plan ${d.to}">${esc(d.say)}</a><span class="sp-pr">0.333</span></p>`).join("")}
    </div>`;
  const S = {
    room: 70,
    name: "spatial-weights",
    alt: "Figure 70. A reading of the weights: the walk embedded among the vocabulary, the plans said as token columns through a ring of ninety-six layers, and the next-token distribution.",
    trackH: 820,
    labels,
    steps,
    stills,
    hfov: 60,
    dist,
  };
  yield S;

  /* --- the vocabulary, which is also the end --- */
  const NV = mobile ? 2400 : 6600;
  const centres = Array.from({ length: 26 }, () => [gauss() * 4.5, gauss() * 3.4, gauss() * 4.5]);
  const BARS = mobile ? [-8.4, 0, 8.4] : [-7, 0, 7];
  const per = Math.floor(NV / 3);
  // each bar a halftone of evenly spaced dots, 3.4 wide and 12 high
  const barCols = Math.max(6, Math.round(3.4 / Math.sqrt((3.4 * 12) / per)));
  const rowsPer = Math.floor(per / barCols);
  for (let i = 0; i < NV; i++) {
    const c = centres[i % centres.length];
    const sd = 0.5 + (i % 7) * 0.22;
    const p = add(C0, [c[0] + gauss() * sd, c[1] + gauss() * sd * 0.8, c[2] + gauss() * sd]);
    const k = i % 3;
    const cell = Math.floor(i / 3) % (barCols * rowsPer); // extra dots land on a filled cell: whole rows only
    const t = [0, -7 + (Math.floor(cell / barCols) / (rowsPer - 1)) * 12, R + BARS[k] + ((cell % barCols) / (barCols - 1) - 0.5) * 3.4];
    const h = r() * 0.035;
    G.pt(1, p, { t, a: 0.6, size: 0.085, m0: 0.85 + h, m1: 0.915 + h });
    if (i % 1200 === 1199) yield;
  }
  G.ln(1, [0, -7.5, R - 11], [0, -7.5, R + 11], { a: 0.9, w0: 0.9 });
  for (const b of BARS) G.ln(1, [0, -7.5, R + b], [0, -8.1, R + b], { a: 0.9, w0: 0.9 });
  for (let y = -7; y <= 5.01; y += 3) G.ln(1, [0, y, R - 11], [0, y, R - 11.5], { a: 0.6, w0: 0.9 });

  /* --- the walk, embedded --- */
  const seq = Wk.rooms.filter((n, i, a) => pos.has(n) && n !== a[i - 1]).slice(-24);
  for (let i = 1; i < seq.length; i++) G.ln(0, pos.get(seq[i - 1]), pos.get(seq[i]), { a: 0.7, hot: 1, w1: 0.27 });
  for (const n of rooms) {
    G.pt(0, pos.get(n), { a: 1, size: 0.36, hot: 1, w1: 0.27 });
    lab(add(pos.get(n), [0, 0.7, 0]), `Room ${n}`, [-1, 0.25], true);
  }
  yield;

  /* --- the sentence: the plans you said, then the house's two words --- */
  const aOf = (k) => -11 + (22 * (k + 0.5)) / KN;
  const YT = -3;
  const colY = (j) => YT + (j - CP / 2) * 0.55;
  const TOP = colY(CP) + 0.4;
  const column = (th, k, salt, o) => {
    const rr = rng(hash(`col${k}|${salt}|${toks[k]}`));
    const ph = rr() * 6.28;
    const amp = 0.4 + rr() * 0.5;
    const out = [];
    for (let j = 0; j < CP; j++) out.push(Q(th, aOf(k) + Math.sin(j * 0.7 + ph) * amp + (rr() - 0.5) * 0.4, colY(j)));
    if (o) {
      for (const p of out) G.pt(0, p, o);
      G.poly(0, out, { ...o, a: 0.5 });
    }
    return out;
  };
  const THE = 6 * D2R;
  const own = (k) => (k < KN - 2 ? 1 : 0);
  // the sentence, set in reading order before it is taken apart into columns
  const PITCH = 0.12;
  const wOf = (w) => w.length * 4 * PITCH;
  const lines = [[]];
  let run = 0;
  const maxW = mobile ? 7.5 : 15;
  toks.forEach((w, k) => {
    if (run && run + 0.6 + wOf(w) > maxW) {
      lines.push([]);
      run = 0;
    }
    run += (run ? 0.6 : 0) + wOf(w);
    lines.at(-1).push(k);
  });
  const place = [];
  lines.forEach((ks, li) => {
    const total = ks.reduce((s, k) => s + wOf(toks[k]), 0) + 0.6 * (ks.length - 1);
    let x = -total / 2;
    for (const k of ks) {
      place[k] = [x + wOf(toks[k]) / 2, 4.4 + ((lines.length - 1) / 2 - li) * 1.15];
      x += wOf(toks[k]) + 0.6;
    }
  });
  const NRM = [Math.sin(THE), 0, Math.cos(THE)];
  toks.forEach((w, k) => {
    const emb = column(THE, k, "e", null);
    const at = Q(THE - 0.6 * D2R, place[k][0], place[k][1]);
    dots(w).forEach(([x, y], i) => {
      G.pt(2, add(at, add(mul(NRM, x * PITCH), [0, y * PITCH, 0])), { t: emb[i % CP], a: 1, size: 0.048, hot: own(k), w0: 0.19, w1: 0.33, m0: 0.28, m1: 0.325 });
    });
    for (const p of emb) G.pt(0, p, { a: 0.9, size: 0.12, hot: own(k), w0: 0.31, w1: passAt(THE) + 0.012 });
  });
  lab(Q(THE, -11, 9.5), "EMBEDDING", [0.18, 0.3]);
  yield;

  /* --- the layers --- */
  const GN = mobile ? 18 : 34;
  const contin = KN - 1;
  for (let i = 0; i < NL; i++) {
    const th = thOf(i);
    const gone = passAt(th) + 0.012;
    const o = { w1: gone };
    const oc = { w0: 0.29, w1: gone };
    for (let gx = 0; gx < GN; gx++) {
      for (let gy = 0; gy < GN; gy++) {
        const w = gauss();
        const aw = Math.abs(w);
        G.pt(0, Q(th, -18 + (36 * gx) / (GN - 1), -13 + (26 * gy) / (GN - 1)), { ...o, a: Math.min(0.85, 0.12 + aw * 0.28), size: 0.07 + aw * 0.05 });
      }
    }
    G.poly(0, [Q(th, -18.6, -13.6), Q(th, 18.6, -13.6), Q(th, 18.6, 13.6), Q(th, -18.6, 13.6), Q(th, -18.6, -13.6)], { ...o, a: 0.4 });
    lab(Q(th, -18.6, 14.6), `LAYER ${NUMS[i]} / 96`, [0.26, gone - 0.004]);
    toks.forEach((_, k) => column(th, k, `L${i}`, { ...oc, a: 0.92, size: 0.1, hot: own(k) }));
    // attention: where each token looked
    const seg = mobile ? 6 : 10;
    for (let k = 1; k < KN; k++) {
      const targets = NUMS[i] === 81 ? (k === contin ? [] : [contin]) : [Math.floor(r() * k)];
      if (NUMS[i] !== 81 && !mobile && r() < 0.4) targets.push(Math.floor(r() * k));
      for (const j of targets) {
        const a0 = aOf(k);
        const a1 = aOf(j);
        const hgt = 1.2 + Math.abs(a0 - a1) * 0.32;
        const pts = [];
        for (let s = 0; s <= seg; s++) {
          const t = s / seg;
          pts.push(Q(th, lerp(a0, a1, t), TOP + Math.sin(t * Math.PI) * hgt));
        }
        G.poly(0, pts, { ...oc, a: NUMS[i] === 81 ? 0.75 : 0.42 });
      }
    }
    yield;
  }
  // the residual stream: each token's line around the ring
  const RS = mobile ? 40 : 90;
  for (let k = 0; k < KN; k++) {
    const pts = [];
    for (let s = 0; s <= RS; s++) pts.push(Q(THE + ((thOf(NL - 1) - THE) * s) / RS, aOf(k), YT));
    G.poly(0, pts, { a: 0.3, hot: own(k), w0: 0.29, w1: 0.88 });
  }
  // what the numbers are, close up
  for (let i = 0; i < (mobile ? 9 : 26); i++) {
    const th = (18 + r() * 322) * D2R;
    let v = (r() * 8 - 4).toFixed(3);
    if (stage >= 3 && r() < 0.2) v = "71.000";
    const side = r() < 0.5 ? -1 : 1;
    const at = Q(th, side * (6 + r() * 10), (r() - 0.5) * 18);
    const ax = [Math.sin(th), 0, Math.cos(th)];
    for (const [x, y] of dots(v)) G.pt(2, add(at, add(mul(ax, x * 0.15), [0, y * 0.15, 0])), { a: 0.75, size: 0.075, w0: 0.29, w1: passAt(th) + 0.01 });
  }
  yield;

  const eyeC = (th) => Q(th, 0, 6.5);
  const lookC = (th) => Q(th + 12 * D2R, 0, -1);
  const orbit = (t) => {
    const ph = -Math.PI / 2 - 1.15 + 1.05 * t;
    const el = 0.42 - 0.27 * t;
    const dist = (42 - 18 * t) * (mobile ? 0.62 : 1);
    const look = add(C0, [0, -0.6, 0]);
    return { eye: add(look, mul([Math.cos(el) * Math.sin(ph), Math.sin(el), Math.cos(el) * Math.cos(ph)], dist)), look };
  };
  const END = { eye: [mobile ? -22 : -26, 0.6, R], look: [0, -1.4, R] };
  const WORDS = Q(THE, 0, 4.4);
  const cam = (p) => {
    let v;
    if (p < 0.2) v = orbit(smooth(0, 0.2, p) * 0.5 + (p / 0.2) * 0.5);
    else if (p < 0.3) {
      const t = smooth(0.2, 0.27, p);
      const a = orbit(1);
      v = { eye: mix3(a.eye, eyeC(TH0), t), look: mix3(a.look, WORDS, t) };
    } else if (p < 0.84) {
      const th = lerp(TH0, TH1, (p - 0.3) / 0.54);
      v = { eye: eyeC(th), look: mix3(WORDS, lookC(th), smooth(0.3, 0.345, p)) };
    } else {
      const t = smooth(0.84, 0.93, p);
      v = { eye: mix3(eyeC(TH1), END.eye, t), look: mix3(lookC(TH1), END.look, t) };
    }
    return { ...v, up: Y, fov: 50 };
  };

  return Object.assign(S, {
    // the damage shakes the reading, until the last figure, which is set straight
    levels: [
      { o: [0, 0, 0], s: 1, win: [-1, 9], far: 6, jit: stage >= 2 ? (stage - 1) * 0.12 : 0, jitAt: (p) => 1 - smooth(0.86, 0.93, p) },
      { o: [0, 0, 0], s: 1, win: [-1, 9], far: 6, jit: stage >= 2 ? (stage - 1) * 0.12 : 0, jitAt: (p) => 1 - smooth(0.86, 0.93, p), laAt: (p) => 1 - 0.8 * smooth(0.21, 0.27, p) * (1 - smooth(0.8, 0.86, p)) },
      { o: [0, 0, 0], s: 1, win: [-1, 9], far: 6, jit: stage >= 2 ? (stage - 1) * 0.012 : 0 },
    ],
    G: G.pack(),
    cam,
    colors(p) {
      const k = smooth(0.885, 0.915, p);
      return { bg: mix3(DARK, PAPER, k), ink: invert(PALE, INK, k), hot: mix3(RED_D, RED, k), dark: k < 0.5 };
    },
    // the three bars' feet, where their labels hang
    distAt: BARS.map((b) => [0, -8.6, R + b]),
    distCap: [0, 7.2, R],
    reached(ctx2) {
      ctx2.emit({ kind: "figure", id: "70:dist", text: "Likelihood of each continuation", data: { value: "0.333" } });
    },
  });
}

/* ======================================================================= */
/* the stage: track, labels, captions, loop                                 */
/* ======================================================================= */

const firstSentence = (t) => t.replace(/\^\d+/g, "").match(/[^.!?]+[.!?]+/)?.[0]?.trim().slice(0, 138) ?? "";

function codaHTML(ctx) {
  const path = (ctx.walk?.log ?? []).map((s) => s.room);
  return (ctx.R.coda || [])
    .map((t, i) => `<p class="prose sp-coda" data-frag="line" data-frag-id="${ctx.room}:coda${i}" data-frag-text="${esc(firstSentence(t))}">${prose(t, ctx.entryD, hash(`${ctx.room}:coda${i}`), { path, room: ctx.room })}</p>`)
    .join("");
}

const PINNED = `<div class="sp-pinned" data-slot="line label figure number stamp curve"></div>`;

/**
 * Runs `it` (a scene's geometry generator) a slice at a time, about 8 ms per task, so entering
 * a room never blocks for the whole build; then done(S). Returns { cancel, finish }: finish()
 * completes the build at once (the reader reached the figure before it was ready).
 */
function slices(it, done) {
  let alive = true;
  let t = 0;
  const step = (budget) => {
    const end = performance.now() + budget;
    for (;;) {
      const s = it.next();
      if (s.done) {
        alive = false;
        done(s.value);
        return true;
      }
      if (performance.now() > end) return false;
    }
  };
  const run = () => {
    t = 0;
    if (alive && !step(8)) t = setTimeout(run, 0);
  };
  t = setTimeout(run, 0);
  return {
    cancel() {
      alive = false;
      clearTimeout(t);
    },
    finish() {
      if (!alive) return;
      clearTimeout(t);
      step(Infinity);
    },
  };
}

function mount(article, ctx, S, mem, it) {
  const P = article.querySelectorAll(":scope > p.prose");
  const anchor = P[P.length - 1] ?? article.querySelector(".room-head");
  const coda = codaHTML(ctx);
  let reachedOnce = false;
  const reach = () => {
    if (reachedOnce) return;
    reachedOnce = true;
    mem.read[S.room] = (mem.read[S.room] || 0) + 1;
    saveMem(mem);
    S.reached(ctx);
  };
  return ctx.reduced ? stills(anchor, ctx, S, coda, reach, it) : live(anchor, article, ctx, S, coda, reach, it);
}

/** Reduced motion: the same figure as a sequence of drawn stills, each with its caption. */
function stills(anchor, ctx, S, coda, reach, it) {
  const box = after(anchor, `<section class="sp-stills" aria-label="Figure ${S.room}">
    ${S.stills.map((s, i) => `<figure class="sp-still"><img alt="Figure ${S.room}${i ? String.fromCharCode(96 + i) : ""}" width="700" height="440"><figcaption${i === 0 ? ` data-frag="line" data-frag-id="${S.room}:still"` : ""}>${esc(s.cap)}</figcaption></figure>`).join("")}
    ${S.dist ? S.dist(true) : ""}
    ${PINNED}
  </section>${coda}`);
  const imgs = [...box.querySelectorAll(".sp-still img")];
  const urls = [];
  const timers = [];
  let alive = true;
  let io = null;
  // the geometry is built in slices, then each still is drawn in a task of its own
  const build = slices(it, () => {
    if (!alive) return;
    const cv = document.createElement("canvas");
    const g = cv.getContext("2d");
    const F = newFrame(S);
    const W = Math.round(box.clientWidth || 700);
    const H = Math.round(W * (ctx.mobile ? 1.2 : 0.6));
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const one = (i) => {
      if (!alive) return;
      const s = S.stills[i];
      frameAt(S, F, s.p, W, H);
      drawCPU(g, S.G, F, dpr, 1);
      drawLabels(g, S, F);
      imgs[i].width = W;
      imgs[i].height = H;
      cv.toBlob((b) => {
        if (!b || !alive) return;
        const url = URL.createObjectURL(b);
        urls.push(url);
        imgs[i].src = url;
      }, "image/png");
      if (i + 1 < S.stills.length) timers.push(setTimeout(() => one(i + 1), 0));
      else {
        cv.width = cv.height = 0;
        io = new IntersectionObserver((es) => {
          if (es.some((e) => e.isIntersecting)) reach();
        }, { threshold: 0.6 });
        io.observe(imgs.at(-1));
      }
    };
    one(0);
  });
  return {
    update() {},
    leave() {
      alive = false;
      build.cancel();
      timers.forEach(clearTimeout);
      io?.disconnect();
      urls.forEach((u) => URL.revokeObjectURL(u));
    },
  };
}

/** Labels drawn into a still, as the live stage sets them. */
function drawLabels(g, S, F) {
  g.font = "700 10.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  g.textBaseline = "middle";
  for (const it of S.labels) {
    const o = labelAlpha(it, F);
    if (!o) continue;
    const [x, y] = o.s;
    const w = g.measureText(it.text).width + 14;
    g.globalAlpha = o.a;
    g.fillStyle = F.dark ? "#0d0c0b" : "#fffff8";
    g.fillRect(x - w / 2, y - 22, w, 19);
    g.strokeStyle = it.hot ? css(F.hot) : css(F.ink);
    g.lineWidth = 1.2;
    g.strokeRect(x - w / 2, y - 22, w, 19);
    g.fillStyle = it.hot ? css(F.hot) : css(F.ink);
    g.fillText(it.text, x - w / 2 + 7, y - 12.5);
  }
  g.globalAlpha = 1;
}

function labelAlpha(it, F) {
  const L = F.levels[it.lv];
  let a = win(it.win[0], it.win[1], F.p, 0.02) * L.la;
  if (a < 0.02) return null;
  const s = project(F, it.lv, it.P);
  if (!s || s[2] < 0.12) return null;
  a *= 1 - smooth(L.far * 0.4, L.far * 0.75, s[2]);
  if (s[0] < -60 || s[0] > F.W + 60 || s[1] < 0 || s[1] > F.H + 10) return null;
  return a < 0.02 ? null : { a, s };
}

/** The live stage: sticky canvas over a tall track; captions scroll natively over it. */
function live(anchor, article, ctx, S, coda, reach, it) {
  const track = after(anchor, `<section class="sp-track sp-r${S.room}" aria-label="Figure ${S.room}" style="--sp-h:${S.trackH}vh">
    <div class="sp-stage">
      <canvas class="sp-gl" role="img" aria-label="${esc(S.alt)}"></canvas>
      <div class="sp-labels" aria-hidden="true"></div>
      ${S.dist ? S.dist(false) : ""}
    </div>
    <div class="sp-steps">
      ${S.steps.map((s, i) => `<p class="sp-step" style="--at:${s.at.toFixed(4)}"${s.frag ? ` data-frag="${s.frag}" data-frag-id="${S.room}:step${i}"` : ""}>${esc(s.text)}</p>`).join("")}
    </div>
  </section>${PINNED}${coda}`);
  const stage = track.querySelector(".sp-stage");
  let canvas = track.querySelector(".sp-gl");
  const distEl = track.querySelector(".sp-dist");
  const toks = distEl ? [...distEl.querySelectorAll(".sp-tok")] : [];
  const cap = distEl?.querySelector(".sp-dist-cap");
  // filled in once the geometry is built
  let items = [];
  let F = null;
  let R = null;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let target = 0;
  let shown = -1;
  let raf = 0;
  let vis = false;
  let passed = false;
  let dark = null;
  let distOn = null;
  let distGap = 0;
  let size = "";
  let glTimer = 0;
  // a redraw is worth it only once the scroll has moved the figure by about a pixel
  const EPS = 0.00015;

  const kick = () => {
    if (!raf && vis) raf = requestAnimationFrame(tick);
  };
  const onLost = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const onRestored = () => {
    shown = -1;
    kick();
  };
  // a new canvas in the old one's place (a context's attributes are fixed for its canvas)
  const fresh = () => {
    const c2 = document.createElement("canvas");
    c2.className = canvas.className;
    c2.setAttribute("role", "img");
    c2.setAttribute("aria-label", canvas.getAttribute("aria-label"));
    canvas.replaceWith(c2);
    canvas = c2;
  };
  const begin = () => {
    track.dataset.renderer = R?.kind ?? "none";
    shown = -1;
    measure();
    kick();
  };
  // on the page: WebGL, or else the same geometry projected on the CPU, thinned to keep a frame cheap
  const pageRenderer = () => {
    R = FORCE_2D ? null : glRenderer(canvas, S.G, onLost, onRestored);
    if (!R) {
      fresh();
      R = cpuRenderer(canvas, S.G, Math.max(1, Math.ceil(S.G.points / (ctx.mobile ? 4000 : 9000))));
    }
    size = "";
    layout();
    begin();
  };
  // frames the worker has finished: a run of them slower than ~22 fps puts the stage on its light footing
  let lastDrawn = 0;
  const drawn = () => {
    const now = performance.now();
    const dt = now - lastDrawn;
    lastDrawn = now;
    if (LITE || dt > 300) return;
    slow = dt > 45 ? slow + 1 : Math.max(0, slow - 2);
    if (slow >= 5) lighten();
  };
  // `patient`: the figure is on screen and may stay blank until the worker is ready (the light
  // stage). Otherwise a worker that is not ready by the first frame on screen gives way to the page.
  let patient = false;
  const makeRenderer = (wait = false) => {
    patient = wait;
    size = "";
    layout();
    R = FORCE_2D || FORCE_PAGE
      ? null
      : workerRenderer(canvas, S.G, canvas.width, canvas.height, {
          onReady: begin,
          onRedraw: onRestored,
          onDrawn: drawn,
          onFail: () => {
            // the worker cannot draw here: the page does
            R = null;
            fresh();
            pageRenderer();
          },
        });
    if (R) track.dataset.renderer = R.kind;
    else {
      fresh(); // in case it was handed over before the worker failed to start
      pageRenderer();
    }
  };
  // the light stage (see LITE): the old context is released before the new one is made
  const lighten = () => {
    LITE = true;
    slow = 0;
    try { sessionStorage.setItem(LITE_KEY, "1"); } catch { /* the next room finds out again */ }
    R.destroy();
    R = null;
    fresh();
    makeRenderer(true);
  };
  const build = slices(it, () => {
    const labelsEl = track.querySelector(".sp-labels");
    labelsEl.innerHTML = S.labels.map((l) => `<span class="sp-lab${l.hot ? " is-hot" : ""}">${esc(l.text)}</span>`).join("");
    const labEls = [...labelsEl.children];
    items = S.labels.map((l, i) => ({ ...l, el: labEls[i], on: false, x: -1, y: -1, a: -1 }));
    F = newFrame(S);
    // compiling and uploading is a task of its own
    glTimer = setTimeout(() => {
      glTimer = 0;
      makeRenderer();
    }, 0);
  });

  const layout = () => {
    const main = article.closest("main") || article;
    const lay = article.closest(".layout") || document.body;
    const mr = main.getBoundingClientRect();
    const lr = lay.getBoundingClientRect();
    track.style.setProperty("--sp-l", `${(lr.left - mr.left).toFixed(1)}px`);
    track.style.setProperty("--sp-w", `${Math.round(lr.width)}px`);
    track.style.setProperty("--sp-ml", `${Math.max(18, mr.left - lr.left).toFixed(1)}px`);
    const w = Math.round(lr.width);
    const h = Math.round(stage.clientHeight || innerHeight);
    const d = Math.min(LITE ? 1 : 2, devicePixelRatio || 1);
    const key = `${w}x${h}@${d}`;
    if (key === size) return;
    size = key;
    W = w;
    H = h;
    dpr = d;
    // a canvas handed to the worker is sized there
    if (R?.resize) R.resize(Math.round(W * dpr), Math.round(H * dpr));
    else {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    shown = -1;
  };

  const paint = (p) => {
    if (!W || !H || !R || !F) return;
    frameAt(S, F, p, W, H);
    R.draw(F, dpr);
    if (F.dark !== dark) {
      dark = F.dark;
      stage.classList.toggle("is-dark", dark);
    }
    for (const it of items) {
      const o = labelAlpha(it, F);
      if (!o) {
        if (it.on) {
          it.el.style.visibility = "hidden";
          it.on = false;
        }
        continue;
      }
      if (!it.on) {
        it.el.style.visibility = "visible";
        it.on = true;
      }
      const a = Math.round(o.a * 50) / 50;
      if (a !== it.a) {
        it.el.style.opacity = String(a);
        it.a = a;
      }
      const w = (it.w ||= it.el.offsetWidth || 80);
      const x = Math.round(clamp(o.s[0], w / 2 + 6, Math.max(w / 2 + 6, F.W - w / 2 - 6)));
      const y = Math.round(o.s[1]);
      if (x !== it.x || y !== it.y) {
        it.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
        it.x = x;
        it.y = y;
      }
    }
    if (distEl) {
      // The distribution's labels exist only once the figure is there to be read.
      const on = p >= 0.915;
      if (on !== distOn) {
        distOn = on;
        distEl.classList.toggle("is-on", on);
      }
      if (on) {
        const feet = S.distAt.map((P) => project(F, 0, P));
        feet.forEach((s, i) => {
          if (s) toks[i].style.transform = `translate(${Math.round(s[0])}px,${Math.round(s[1])}px) translate(-50%,0)`;
        });
        // a label is never wider than the space between two bars
        if (feet[0] && feet[1]) {
          const gap = Math.round(feet[1][0] - feet[0][0] - 10);
          if (gap !== distGap) {
            distGap = gap;
            distEl.style.setProperty("--sp-gap", `${gap}px`);
          }
        }
        const s = project(F, 0, S.distCap);
        if (s && cap) cap.style.transform = `translate(${Math.round(s[0])}px,${Math.round(s[1])}px) translate(-50%,-100%)`;
      }
    }
    // Only a descent counts: the reader must have been inside, not restored past it.
    if (p > 0.3 && p < 0.9) passed = true;
    if (p > 0.97 && passed) reach();
  };

  let lastT = 0;
  let slow = 0;
  let onScreen = false;
  function tick(now) {
    raf = 0;
    if (!vis) return;
    if (!F || !R || !R.ready) {
      // Not ready yet. Off screen (only near it) there is nothing to see: wait. On screen the
      // reader got here first: finish the build now, and draw on the page if the worker is not
      // ready (except for the light stage, which waits for its worker).
      if (!onScreen) return;
      if (!F) build.finish();
      if (!R) {
        clearTimeout(glTimer);
        glTimer = 0;
        makeRenderer();
      }
      if (R?.kind === "webgl-worker" && !R.ready && !patient) {
        R.destroy();
        R = null;
        fresh();
        pageRenderer();
      }
      if (!R) return;
    }
    // eases toward the scroll; the last steps (under ~5 px of track) snap, so a settle is short
    const next = shown < 0 || Math.abs(target - shown) < 0.0008 ? target : lerp(shown, target, 0.2);
    if (next === shown) return;
    shown = next;
    paint(shown);
    // frames while moving: a run of them slower than ~22 fps puts the stage on its light footing
    if (!LITE && R.kind === "webgl") {
      const dt = now - lastT;
      lastT = now;
      if (dt < 300) slow = dt > 45 ? slow + 1 : Math.max(0, slow - 2);
      if (slow >= 5) return lighten();
    }
    if (shown !== target) kick();
  }

  const measure = () => {
    const r = track.getBoundingClientRect();
    const span = r.height - stage.clientHeight;
    root.classList.toggle("sp-inside", r.top < innerHeight * 0.35 && r.bottom > innerHeight * 0.75);
    // in view for real (not the sliver at the foot of the screen at entry)
    onScreen = r.top < innerHeight * 0.7 && r.bottom > innerHeight * 0.3;
    if (!vis) return;
    const t = span > 0 ? clamp(-r.top / span) : 0;
    // ignore sub-pixel scroll; the two ends always land exactly
    if (shown < 0 || (t !== target && (Math.abs(t - target) >= EPS || t === 0 || t === 1))) {
      target = t;
      kick();
    }
  };

  const io = new IntersectionObserver((es) => {
    vis = es[es.length - 1].isIntersecting;
    if (vis) measure();
    else {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }, { rootMargin: "60px 0px" });
  io.observe(track);

  let rt = 0;
  const onResize = () => {
    cancelAnimationFrame(rt);
    rt = requestAnimationFrame(() => {
      layout();
      measure();
    });
  };
  addEventListener("resize", onResize);
  layout();

  return {
    update: measure,
    leave() {
      build.cancel();
      clearTimeout(glTimer);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(rt);
      raf = 0;
      vis = false;
      io.disconnect();
      removeEventListener("resize", onResize);
      // the worker's context goes with the worker; the page's own context is released here
      // (a canvas handed to a worker can no longer be resized from the page)
      if (R?.kind !== "webgl-worker") {
        try { canvas.width = canvas.height = 0; } catch { /* handed over */ }
      }
      R?.destroy();
      R = null;
      root.classList.remove("sp-inside");
    },
  };
}

/* ---------- module plumbing ---------- */

const SCENES = { 39: scene39, 70: scene70 };
let cur = null;

export function decorate(article, ctx) {
  const make = SCENES[ctx.room];
  if (!make) return;
  const mem = loadMem(ctx);
  const mobile = ctx.mobile || innerWidth < 600;
  const it = make(ctx, mobile, mem);
  // the room's text now; its geometry in slices after the entry
  const S = it.next().value;
  root.dataset.grammar = S.name;
  article.dataset.grammar = S.name;
  cur = mount(article, ctx, S, mem, it);
}

export function update(ctx) {
  cur?.update?.(ctx);
}

export function leave() {
  cur?.leave?.();
  cur = null;
  root.classList.remove("sp-inside");
  if (root.dataset.grammar?.startsWith("spatial-")) delete root.dataset.grammar;
}
