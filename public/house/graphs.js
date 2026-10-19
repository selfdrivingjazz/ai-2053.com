// Inline graphs: scroll animation and physical disintegration (owned by HouseGraph).
// Hooks called by house.js after living.decorate: decorate(article, ctx), update(ctx), leave().
//
// The charts drawn in a room (report curves, Room 7's gallery, gen 40's walks and
// dots, Figure 52, Figure 81.1) are read as instruments: their lines draw on as they
// come up the screen and their axes and gridlines breathe with the scroll. As the
// house loosens (`loosen(ctx).wob`) points jitter and lines boil. At full distortion
// (`loosen(ctx).fall`) the points, beads of the lines, bars and dots let go as the
// reader passes the figure: the originals are hidden one by one and their copies fall
// under gravity on a canvas laid over the figure, land on the x axis and pile up; the
// ones that miss the axis fall to the foot of the figure. A fast scroll kicks the pile.
//
// Never touched: anything that is or holds an `a[data-to]` (plans living on chart
// points stay where living.js put them), Room 33's stills, Room 36's wheel, the
// crooked frame in Room 7 and the scope in Room 38.
//
// Cost: at most 6 figures per page, gated by an IntersectionObserver; one rAF for the
// whole module, running only while some visible figure has particles in motion; a
// canvas is created only for a figure that has begun to fall (DPR ≤ 2, ≤ 320
// particles). Reduced motion: lines drawn, nothing breathes; what has fallen lies
// in a still heap.
//
// Memory: localStorage `ai2053.house.graph` = { escapes, pile, figs: { room: [n…] } },
// counts only ever grow. The column (column.js) shares this module's engine and key.

export const MEM_KEY = "ai2053.house.graph";
const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const TAU = Math.PI * 2;

/** How loose the house's instruments are: `wob` loosens and jitters, `fall` lets points go. */
export function loosen(ctx) {
  if (!ctx || ctx.fresh || ctx.room === 0 || ctx.R?.outside) return { wob: 0, fall: 0 };
  const v = Math.min(4, ctx.damage?.voids || 0);
  const dd = Math.max(ctx.d || 0, (ctx.entryD || 0) * 0.96) + 0.04 * v;
  return { wob: smooth(0.18, 0.8, dd), fall: smooth(0.72, 0.95, dd) };
}

/* ---------- memory ---------- */

export function readMem(ctx) {
  try {
    const m = JSON.parse(localStorage.getItem(MEM_KEY));
    if (m && m.escapes === ctx.escapes) return { escapes: m.escapes, pile: m.pile | 0, figs: m.figs || {} };
  } catch {}
  return { escapes: ctx.escapes, pile: 0, figs: {} };
}

/** Merge counts into memory; nothing is ever lowered. */
export function growMem(ctx, pile, room, counts) {
  const m = readMem(ctx);
  let changed = false;
  if (pile > m.pile) {
    m.pile = pile;
    changed = true;
  }
  if (room != null && counts) {
    const was = m.figs[room] || [];
    const next = counts.map((c, i) => Math.max(c, was[i] || 0));
    if (next.some((c, i) => c !== (was[i] || 0))) {
      m.figs[room] = next;
      changed = true;
    }
  }
  if (!changed) return;
  try {
    localStorage.setItem(MEM_KEY, JSON.stringify(m));
  } catch {}
}

/* ---------- the engine: discs under gravity, piling ---------- */

const GRAV = 1500; // px/s²
const REST = 0.3;

export class Sim {
  constructor(cap) {
    this.cap = cap;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.r = new Float32Array(cap);
    this.k = new Uint8Array(cap); // palette index
    this.s = new Uint8Array(cap); // 0 held in place, 1 moving, 2 asleep
    this.t = new Uint16Array(cap); // frames held / frames still
    this.nx = new Int32Array(cap);
    this.n = 0;
    this.ring = 0;
    this.W = 1;
    this.H = 1;
    this.shelves = []; // [{x0, x1, y}] the axes things land on
    this.pal = [];
    this.palKey = new Map();
    this.idle = 0;
    this.rmax = 2;
    this.head = null;
  }

  /** A palette entry: { fill, stroke, lw, sq } (square particles are drawn as squares, collide as discs). */
  paint(key, spec) {
    let i = this.palKey.get(key);
    if (i == null) {
      i = this.pal.length;
      this.pal.push(spec);
      this.palKey.set(key, i);
    }
    return i;
  }

  size(W, H) {
    if (W === this.W && H === this.H) return;
    this.W = Math.max(1, W);
    this.H = Math.max(1, H);
    this.head = null;
    this.wake();
  }

  add(x, y, r, k, hold = 0, vx = 0, vy = 0) {
    let i;
    const lim = Math.min(this.cap, this.limit || this.cap);
    if (this.n < lim) i = this.n++;
    else {
      // Full: the oldest makes way, and the pile shifts to fill the gap.
      i = this.ring % lim;
      this.ring = (i + 1) % lim;
      this.wake();
    }
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.r[i] = r;
    this.k[i] = k;
    this.s[i] = hold > 0 ? 0 : 1;
    this.t[i] = hold;
    if (r > this.rmax) {
      this.rmax = r;
      this.head = null;
    }
    this.idle = 0;
    return i;
  }

  clear() {
    this.n = 0;
    this.ring = 0;
  }

  wake() {
    for (let i = 0; i < this.n; i++) if (this.s[i] === 2) {
      this.s[i] = 1;
      this.t[i] = 0;
    }
    this.idle = 0;
  }

  /** A shove from the reader's scroll: v in px/ms, signed. A flick throws the pile; a slow read barely stirs it. */
  kick(v, rnd = Math.random) {
    const a = Math.min(1, (Math.abs(v) - 0.6) / 5);
    const now = performance.now();
    if (a <= 0 || !this.n || now - (this.kt || 0) < 110) return false;
    this.kt = now;
    for (let i = 0; i < this.n; i++) {
      if (this.s[i] === 0) continue;
      this.s[i] = 1;
      this.t[i] = 0;
      this.vy[i] -= (120 + 1000 * a) * (0.3 + 0.7 * rnd());
      this.vx[i] += (rnd() - 0.5) * 520 * a + Math.sign(v) * 60 * a;
    }
    this.idle = 0;
    return true;
  }

  floorOf(x, y0, r) {
    let f = this.H;
    // A shelf holds what has its centre above it, so a heap pressing down cannot push through.
    for (const sh of this.shelves) if (x >= sh.x0 && x <= sh.x1 && y0 < sh.y && sh.y < f) f = sh.y;
    return f;
  }

  /** Advance dt seconds. Returns true while anything is still moving or waiting to let go. */
  step(dt) {
    const n = this.n;
    if (!n) return false;
    const { x, y, vx, vy, r, s, t } = this;
    const W = this.W;
    const sub = 2;
    const h = dt / sub;
    let live = 0;
    for (let i = 0; i < n; i++) {
      if (s[i] === 0) {
        live++;
        if (t[i] > 0) t[i]--;
        if (!t[i]) s[i] = 1;
      }
    }
    const cell = Math.max(4, this.rmax * 2);
    const gw = Math.ceil(W / cell) + 1;
    const gh = Math.ceil(this.H / cell) + 1;
    if (!this.head || this.head.length !== gw * gh) this.head = new Int32Array(gw * gh);
    const head = this.head;
    const nxt = this.nx;
    const sup = new Uint8Array(n);
    for (let pass = 0; pass < sub; pass++) {
      // Integrate.
      for (let i = 0; i < n; i++) {
        if (s[i] !== 1) continue;
        const y0 = y[i];
        vy[i] += GRAV * h;
        vx[i] *= 0.998;
        x[i] += vx[i] * h;
        y[i] += vy[i] * h;
        const ri = r[i];
        if (x[i] < ri) {
          x[i] = ri;
          vx[i] = Math.abs(vx[i]) * 0.4;
        } else if (x[i] > W - ri) {
          x[i] = W - ri;
          vx[i] = -Math.abs(vx[i]) * 0.4;
        }
        if (y[i] < -this.H) {
          y[i] = -this.H;
          vy[i] = Math.max(0, vy[i]);
        }
        const f = this.floorOf(x[i], y0, ri);
        if (y[i] + ri > f) {
          y[i] = f - ri;
          if (vy[i] > 0) vy[i] = vy[i] > 90 ? -vy[i] * REST : 0;
          vx[i] *= 0.86;
          sup[i] = 1;
        }
      }
      // Collide (uniform grid; asleep discs are immovable until struck hard).
      head.fill(-1);
      for (let i = 0; i < n; i++) {
        if (s[i] === 0) continue;
        const cx = Math.min(gw - 1, Math.max(0, Math.floor(x[i] / cell)));
        const cy = Math.min(gh - 1, Math.max(0, Math.floor(y[i] / cell)));
        const c = cy * gw + cx;
        nxt[i] = head[c];
        head[c] = i;
      }
      for (let i = 0; i < n; i++) {
        if (s[i] !== 1) continue;
        const cx = Math.min(gw - 1, Math.max(0, Math.floor(x[i] / cell)));
        const cy = Math.min(gh - 1, Math.max(0, Math.floor(y[i] / cell)));
        for (let oy = -1; oy <= 1; oy++) {
          const yy = cy + oy;
          if (yy < 0 || yy >= gh) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const xx = cx + ox;
            if (xx < 0 || xx >= gw) continue;
            for (let j = head[yy * gw + xx]; j >= 0; j = nxt[j]) {
              if (j === i || (s[j] === 1 && j < i)) continue;
              let dx = x[j] - x[i];
              let dy = y[j] - y[i];
              const rr = r[i] + r[j];
              const d2 = dx * dx + dy * dy;
              if (d2 >= rr * rr) continue;
              let d = Math.sqrt(d2);
              if (d < 1e-4) {
                dx = 0.01 * (i % 2 ? 1 : -1);
                dy = -1;
                d = 1;
              }
              const nxn = dx / d;
              const nyn = dy / d;
              const over = rr - d;
              const rel = (vx[j] - vx[i]) * nxn + (vy[j] - vy[i]) * nyn;
              if (s[j] === 2) {
                if (rel < -260) {
                  s[j] = 1;
                  t[j] = 0;
                } else {
                  x[i] -= nxn * over;
                  y[i] -= nyn * over;
                  if (rel < 0) {
                    const J = (1 + REST) * rel;
                    vx[i] += J * nxn;
                    vy[i] += J * nyn;
                  }
                  if (nyn > 0.35) sup[i] = 1;
                  continue;
                }
              }
              x[i] -= nxn * over * 0.5;
              y[i] -= nyn * over * 0.5;
              x[j] += nxn * over * 0.5;
              y[j] += nyn * over * 0.5;
              if (rel < 0) {
                const J = ((1 + REST) * rel) / 2;
                vx[i] += J * nxn;
                vy[i] += J * nyn;
                vx[j] -= J * nxn;
                vy[j] -= J * nyn;
              }
              // A disc balanced exactly on another never stays: columns topple into heaps.
              if (Math.abs(nxn) < 0.2) {
                const nudge = ((((i * 7919) ^ (j * 104729)) % 97) / 97 - 0.5) * 36;
                if (nyn > 0) vx[i] += nudge;
                else vx[j] += nudge;
              }
              if (nyn > 0.35) sup[i] = 1;
              else if (nyn < -0.35) sup[j] = 1;
            }
          }
        }
      }
    }
    // Sleep what has come to rest on something.
    this.idle++;
    for (let i = 0; i < n; i++) {
      if (s[i] !== 1) continue;
      const v2 = vx[i] * vx[i] + vy[i] * vy[i];
      if (sup[i] && v2 < 30 * 30) t[i]++;
      else t[i] = 0;
      if (t[i] > 18 || this.idle > 720) {
        s[i] = 2;
        vx[i] = vy[i] = 0;
        t[i] = 0;
      } else live++;
    }
    return live > 0;
  }

  /** Settle everything at once, without motion: a sandpile on the floors (reduced motion, memory). */
  heap() {
    const n = this.n;
    if (!n) return;
    let rs = 0;
    for (let i = 0; i < n; i++) rs += this.r[i];
    const ra = rs / n;
    const w = ra * 2;
    const nb = Math.max(1, Math.ceil(this.W / w));
    const levels = new Map();
    const lv = (f, b) => levels.get(`${f}:${b}`) || 0;
    for (let i = 0; i < n; i++) {
      if (this.s[i] === 2) continue;
      const f = this.floorOf(this.x[i], this.y[i], this.r[i]);
      let b = Math.min(nb - 1, Math.max(0, Math.floor(this.x[i] / w)));
      const same = (bb) => bb >= 0 && bb < nb && this.floorOf((bb + 0.5) * w, this.y[i], this.r[i]) === f;
      for (let k = 0; k < 40; k++) {
        const here = lv(f, b);
        const L = same(b - 1) ? lv(f, b - 1) : Infinity;
        const R = same(b + 1) ? lv(f, b + 1) : Infinity;
        if (L + 1 < here && L <= R) b--;
        else if (R + 1 < here) b++;
        else break;
      }
      const row = lv(f, b);
      levels.set(`${f}:${b}`, row + 1);
      const ri = this.r[i];
      this.x[i] = Math.min(this.W - ri, Math.max(ri, (b + 0.5) * w + (row % 2 ? ra * 0.5 : 0)));
      this.y[i] = f - ri - row * ra * 1.72;
      this.vx[i] = this.vy[i] = 0;
      this.s[i] = 2;
      this.t[i] = 0;
    }
  }

  draw(g, dpr) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { x, y, r, k } = this;
    for (let p = 0; p < this.pal.length; p++) {
      const P = this.pal[p];
      let any = false;
      g.beginPath();
      for (let i = 0; i < this.n; i++) {
        if (k[i] !== p) continue;
        any = true;
        if (P.sq) {
          const q = r[i] * 0.8; // a brick sits inside its disc, so heaped bricks barely overlap
          g.rect(x[i] - q, y[i] - q, q * 2, q * 2);
        }
        else {
          g.moveTo(x[i] + r[i], y[i]);
          g.arc(x[i], y[i], r[i], 0, TAU);
        }
      }
      if (!any) continue;
      g.globalAlpha = P.a ?? 1;
      if (P.fill && P.fill !== "none") {
        g.fillStyle = P.fill;
        g.fill();
      }
      if (P.stroke && P.stroke !== "none" && P.lw > 0) {
        g.lineWidth = P.lw;
        g.strokeStyle = P.stroke;
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  }
}

/** A canvas laid over `host`, never in the way. */
export function overlay(host, cls) {
  const c = document.createElement("canvas");
  c.className = cls;
  c.setAttribute("aria-hidden", "true");
  host.append(c);
  return { c, g: c.getContext("2d") };
}

export function sizeCanvas(c, W, H) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(W * dpr));
  const h = Math.max(1, Math.round(H * dpr));
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  c.style.width = `${W}px`;
  c.style.height = `${H}px`;
  return dpr;
}

/** A shared reading of the reader's scroll speed, px/ms (signed), for kicks. */
export function scrollSpeed(state) {
  const now = performance.now();
  const y = scrollY;
  const dt = now - state.t;
  const v = dt > 0 && dt < 160 ? (y - state.y) / dt : 0;
  state.t = now;
  state.y = y;
  return v;
}

/* ---------- the inline figures ---------- */

const KINDS = [
  { sel: "figure.fig", lines: "polyline.fig-ln", axis: ".fig-ax", grid: ".fig-grid", draw: true },
  { sel: "figure.g:not(.g-crooked):not(.g-loan)", lines: "path.g-ln", axis: ".g-ax", draw: true },
  { sel: "figure.g40-fig", pts: ".g40-n-obs > circle, .g40-n-alt > circle", axis: ".g40-ax", grid: ".g40-grid" },
  { sel: "figure.ix-fig", pts: ".ix-pt", axis: ".ix-axis", grid: ".ix-yt > line", section: ".ix-graph" },
  { sel: "figure.l-fig", bars: "svg > rect, svg > .l-fig-now", axis: ".l-fig-ax" },
  { sel: "figure.g40-dots", dots: ".g40-dr-d > i" },
];
const ALL = KINDS.map((k) => k.sel).join(",");
const MAX_FIGS = 6;
const CAP = 320;

let figs = [];
let io = null;
let ro = null;
let raf = 0;
let lastT = 0;
let cur = null;
let room = null;
let article = null;
let scanAt = 0;
let defs = null;
const speed = { t: 0, y: 0 };

const forbidden = (el) => !!(el.closest("a, .cf") || el.querySelector?.("a[data-to]"));
const hashStr = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boilDefs(art) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "gr-defs");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.innerHTML = `<filter id="gr-boil" filterUnits="userSpaceOnUse" x="-60" y="-60" width="1600" height="1200"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="1" seed="1"/><feDisplacementMap in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  art.append(svg);
  return { svg, turb: svg.querySelector("feTurbulence"), disp: svg.querySelector("feDisplacementMap"), key: "" };
}

function build(el, i, ctx) {
  const K = KINDS.find((k) => el.matches(k.sel));
  const svg = el.querySelector("svg");
  const F = {
    el, K, i, svg, vis: false, sim: null, canvas: null, g: null, dpr: 1, W: 0, H: 0,
    lines: [], items: [], released: 0, prior: 0, drawT: ctx.reduced || !K.draw ? 1 : -1,
    axes: K.axis ? [...el.querySelectorAll(K.axis)] : [], live: false, sizedKey: "",
    sec: K.section ? el.closest(K.section) : null,
  };
  el.classList.add("gr");
  if (!ctx.reduced) el.classList.add("gr-on");
  for (const a of F.axes) a.classList.add("gr-ax");
  if (K.grid) el.querySelectorAll(K.grid).forEach((g, k) => {
    g.classList.add("gr-grid");
    g.style.setProperty("--k", String(k));
  });
  // Lines: each is a string of beads that can come away.
  if (K.lines) {
    [...el.querySelectorAll(K.lines)].slice(0, 6).forEach((ln) => {
      if (forbidden(ln)) return;
      const L = ln.getTotalLength?.() || 0;
      if (!L) return;
      const ctm = ln.getScreenCTM();
      const scale = ctm ? Math.hypot(ctm.a, ctm.b) : 1;
      const ns = getComputedStyle(ln).vectorEffect === "non-scaling-stroke";
      const B = Math.max(8, Math.min(48, Math.round((L * scale) / 9)));
      const line = { el: ln, L, unit: ns ? scale : 1, B, gone: new Uint8Array(B), key: "" };
      F.lines.push(line);
      ln.classList.add("gr-ln");
      for (let b = 0; b < B; b++) F.items.push({ type: "bead", line, b });
    });
  }
  if (K.pts) el.querySelectorAll(K.pts).forEach((p, k) => {
    if (forbidden(p)) return;
    p.classList.add("gr-pt");
    p.style.setProperty("--k", String(k));
    F.items.push({ type: "pt", el: p });
  });
  if (K.bars) el.querySelectorAll(K.bars).forEach((b) => {
    if (!forbidden(b)) F.items.push({ type: "bar", el: b });
  });
  if (K.dots) el.querySelectorAll(K.dots).forEach((d) => {
    if (!forbidden(d)) F.items.push({ type: "dot", el: d });
  });
  // The order in which things let go: fixed for this figure in this room.
  const r = rng(hashStr(`gr${ctx.room}:${i}:${F.items.length}`));
  for (let k = F.items.length - 1; k > 0; k--) {
    const j = Math.floor(r() * (k + 1));
    [F.items[k], F.items[j]] = [F.items[j], F.items[k]];
  }
  F.rnd = r;
  return F;
}

export function decorate(art, ctx) {
  leave();
  article = art;
  room = ctx.room;
  cur = ctx;
  speed.t = performance.now();
  io = new IntersectionObserver((es) => {
    let seen = false;
    for (const e of es) {
      const F = figs.find((f) => f.el === e.target);
      if (!F) continue;
      F.vis = e.isIntersecting;
      if (F.vis) seen = true;
      if (F.vis && F.live) wakeLoop();
    }
    // A figure that came into view without a scroll event (a jump, a resize) is brought up to date.
    if (seen && cur) update(cur);
  }, { rootMargin: "120px 0px" });
  ro = new ResizeObserver(() => {
    for (const F of figs) F.sizedKey = "";
  });
  scan(ctx);
  // Set the figures' first state now, so nothing is redrawn under the reader on the first scroll.
  update(ctx);
}

function scan(ctx) {
  scanAt = performance.now();
  if (!article || figs.length >= MAX_FIGS) return;
  const found = [...article.querySelectorAll(ALL)].filter((el) => !figs.some((f) => f.el === el) && !el.closest(".cf, a, [hidden]") && !el.parentElement.closest(".gr"));
  if (!found.length) return;
  if (!defs) defs = boilDefs(article);
  const mem = readMem(ctx).figs[ctx.room] || [];
  for (const el of found) {
    if (figs.length >= MAX_FIGS) break;
    const F = build(el, figs.length, ctx);
    if (!F.items.length && !F.axes.length) continue;
    F.prior = Math.min(F.items.length, mem[F.i] || 0);
    figs.push(F);
    const r = el.getBoundingClientRect();
    F.vis = r.bottom > -120 && r.top < innerHeight + 120 && r.width > 0;
    io.observe(el);
    ro.observe(el);
  }
}

/* --- per-figure geometry --- */

function measure(F) {
  const b = F.el.getBoundingClientRect();
  const key = `${Math.round(b.width)}x${Math.round(b.height)}`;
  if (key === F.sizedKey && F.sim) return b;
  F.sizedKey = key;
  if (!F.sim) return b;
  F.W = b.width;
  F.H = b.height;
  F.dpr = sizeCanvas(F.canvas, F.W, F.H);
  F.sim.size(F.W, F.H);
  // The x axis is a shelf: what falls inside its span lands on it.
  F.sim.shelves = [];
  let best = null;
  for (const a of F.axes) {
    const r = a.getBoundingClientRect();
    if (!best || r.width > best.width) best = r;
  }
  if (best && best.width > 20) F.sim.shelves.push({ x0: best.left - b.left, x1: best.right - b.left, y: best.bottom - b.top - 0.5 });
  return b;
}

function ensureSim(F) {
  if (F.sim) return;
  if (getComputedStyle(F.el).position === "static") F.el.classList.add("gr-host");
  const { c, g } = overlay(F.el, "gr-fall");
  F.canvas = c;
  F.g = g;
  F.sim = new Sim(CAP);
  F.sizedKey = "";
  measure(F);
}

/** Bring one item away from its figure and into the fall. */
function release(F, it, fr, hold) {
  const S = F.sim;
  const r = F.rnd;
  const v0 = () => [(r() - 0.5) * 50, -r() * 70];
  if (it.type === "bead") {
    const { line, b } = it;
    const ln = line.el;
    const p = ln.getPointAtLength(((b + 0.5) / line.B) * line.L);
    const m = ln.getScreenCTM();
    if (!m) return;
    const q = p.matrixTransform(m);
    const cs = getComputedStyle(ln);
    const lw = parseFloat(cs.strokeWidth) || 2;
    const scale = Math.hypot(m.a, m.b);
    const rad = Math.max(1.4, Math.min(4.5, (line.unit !== 1 ? lw : lw * scale) * 0.75 + 0.5));
    const k = S.paint(`b${cs.stroke}${cs.opacity}`, { fill: cs.stroke, a: +cs.opacity });
    S.add(q.x - fr.left, q.y - fr.top, rad, k, hold, ...v0());
    line.gone[b] = 1;
    line.key = "";
    return;
  }
  const el = it.el;
  const rb = el.getBoundingClientRect();
  if (!rb.width && !rb.height) return;
  const cs = getComputedStyle(el);
  if (it.type === "pt") {
    const lw = parseFloat(cs.strokeWidth) || 0;
    const k = S.paint(`p${cs.fill}${cs.stroke}`, { fill: cs.fill, stroke: cs.stroke, lw: cs.stroke !== "none" ? lw * 1.1 : 0 });
    S.add(rb.left + rb.width / 2 - fr.left, rb.top + rb.height / 2 - fr.top, Math.max(2, rb.width / 2), k, hold, ...v0());
  } else if (it.type === "dot") {
    const k = S.paint(`d${cs.backgroundColor}${cs.borderTopColor}`, { fill: cs.backgroundColor, stroke: cs.borderTopColor, lw: parseFloat(cs.borderTopWidth) || 0 });
    S.add(rb.left + rb.width / 2 - fr.left, rb.top + rb.height / 2 - fr.top, Math.max(2, rb.width / 2), k, hold, ...v0());
  } else if (it.type === "bar") {
    // A bar comes apart into bricks that fill it (at most 60 to a bar).
    const k = S.paint(`r${cs.fill}`, { fill: cs.fill, sq: true });
    const side = Math.max(4, Math.min(40, Math.sqrt((rb.width * rb.height) / 60)));
    const cols = Math.max(1, Math.round(rb.width / side));
    const rows = Math.max(1, Math.min(Math.floor(60 / cols), Math.round(rb.height / side)));
    const bw = rb.width / cols;
    const bh = rb.height / rows;
    const rad = Math.max(1.5, (Math.min(bw, bh) / 2) * 1.08);
    for (let row = 0; row < rows; row++) {
      for (let c = 0; c < cols; c++) S.add(rb.left + (c + 0.5) * bw - fr.left, rb.bottom - fr.top - (row + 0.5) * bh, rad, k, hold + row * 2, ...v0());
    }
  }
  el.classList.add("gr-gone");
}

/** The line, drawn up to t and with gaps where its beads have gone. */
function dash(line, t) {
  const g = line.gone;
  let key = t.toFixed(3);
  for (let b = 0; b < g.length; b++) key += g[b];
  if (key === line.key) return;
  line.key = key;
  const L = line.L;
  const end = t * L;
  const any = g.includes(1);
  if (t >= 1 && !any) {
    line.el.style.strokeDasharray = "";
    line.el.style.strokeDashoffset = "";
    return;
  }
  const w = L / line.B;
  const out = [];
  let pos = 0; // where the pattern has reached
  let a = 0;
  const flush = (x0, x1) => {
    if (x1 <= x0) return;
    out.push(x0 - pos, x1 - x0);
    pos = x1;
  };
  for (let b = 0; b < line.B; b++) {
    const s0 = b * w;
    if (s0 >= end) break;
    if (g[b]) {
      flush(a, Math.min(s0, end));
      a = (b + 1) * w;
    }
  }
  flush(a, end);
  // Dash lists start with a dash: lead with a zero-length dash.
  const u = line.unit;
  const arr = ["0"];
  for (const v of out) arr.push((v * u).toFixed(2));
  arr.push(((L + 10) * u * 2).toFixed(0));
  line.el.style.strokeDasharray = arr.join(" ");
  line.el.style.strokeDashoffset = "0";
}

/* --- the loop --- */

function wakeLoop() {
  if (raf || !cur || cur.reduced) return;
  lastT = performance.now();
  raf = requestAnimationFrame(loop);
}

function loop(now) {
  raf = 0;
  const dt = Math.min(1 / 30, Math.max(1 / 240, (now - lastT) / 1000));
  lastT = now;
  let more = false;
  for (const F of figs) {
    if (!F.sim || !F.live) continue;
    if (!F.vis) continue; // off screen: frozen where it is, resumes when seen
    F.live = F.sim.step(dt);
    F.sim.draw(F.g, F.dpr);
    if (F.live) more = true;
    else remember();
  }
  if (more && !document.hidden) raf = requestAnimationFrame(loop);
}

function remember() {
  if (!cur) return;
  growMem(cur, 0, room, figs.map((F) => F.released));
}

export function update(ctx) {
  if (!article || ctx.room !== room) return;
  cur = ctx;
  const now = performance.now();
  if (now - scanAt > 1200 && figs.length < MAX_FIGS) scan(ctx);
  if (!figs.length) return;
  const { wob, fall } = loosen(ctx);
  const v = scrollSpeed(speed);
  const vh = innerHeight;
  const still = ctx.reduced;
  const ph = ctx.scrollP * TAU * 3;
  // The line boil: one shared filter, its noise reseeded as the reader scrolls.
  if (defs) {
    const sc = still ? (wob > 0.3 ? 1.6 * wob : 0) : wob > 0.15 ? 0.6 + 4.2 * wob * wob : 0;
    const seed = still ? 1 : 1 + Math.floor(ctx.scrollP * (8 + 60 * wob));
    const key = `${sc.toFixed(2)}|${seed}`;
    if (key !== defs.key) {
      defs.key = key;
      defs.disp.setAttribute("scale", sc.toFixed(2));
      defs.turb.setAttribute("seed", String(seed));
    }
  }
  for (const F of figs) {
    if (!F.vis) continue;
    const b = F.el.getBoundingClientRect();
    // Draw-on: the curve is drawn as the figure comes up the page, once.
    if (F.drawT < 1) {
      const t = Math.round(smooth(vh * 0.98, vh * 0.42, b.top) * 200) / 200;
      if (t > F.drawT) F.drawT = t;
    }
    // Breathing axes and drifting grid, points jittering with the house's looseness.
    if (!still) {
      const amp = 0.012 + 0.05 * wob;
      F.el.style.setProperty("--gr-b", (amp * Math.sin(ph * 0.8 + F.i)).toFixed(4));
      F.el.style.setProperty("--gr-g", ((1.2 + 5 * wob) * Math.sin(ph + F.i * 1.7)).toFixed(2));
      F.el.style.setProperty("--gr-ph", (ph * 2.2).toFixed(3));
      F.el.style.setProperty("--gr-j", (0.5 + 4.5 * wob * wob).toFixed(2));
    }
    F.el.classList.toggle("gr-boil", wob > (still ? 0.3 : 0.15));
    // Letting go: at full distortion, as the reader passes the figure.
    if (F.items.length && (fall > 0 || F.prior > F.released)) {
      let P;
      if (F.sec) {
        const sr = F.sec.getBoundingClientRect();
        P = smooth(0.7, 1, clamp01(-sr.top / Math.max(1, sr.height - vh)));
      } else P = clamp01((innerHeight * 0.45 - b.top) / (b.height * 0.5 + vh * 0.25));
      const want = Math.max(F.prior, Math.min(F.items.length, Math.round(F.items.length * (still ? fall : fall * P))));
      if (want > F.released) {
        ensureSim(F);
        const fr = measure(F);
        const instant = still || F.released < F.prior;
        while (F.released < want) {
          release(F, F.items[F.released], fr, instant ? 0 : 2 + Math.floor(F.rnd() * 26));
          F.released++;
        }
        if (instant) {
          F.sim.heap();
          F.sim.draw(F.g, F.dpr);
          remember();
        } else F.live = true;
        if (still) remember();
      }
    }
    for (const line of F.lines) dash(line, F.drawT);
    if (F.sim) {
      measure(F);
      if (!still && F.sim.kick(v, F.rnd)) F.live = true;
      if (F.live) wakeLoop();
    }
  }
}

export function leave() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (figs.some((F) => F.released) && cur) remember();
  io?.disconnect();
  ro?.disconnect();
  io = ro = null;
  for (const F of figs) {
    F.canvas?.remove();
    F.el.classList.remove("gr-host");
  }
  figs = [];
  defs = null;
  article = null;
  room = null;
}
