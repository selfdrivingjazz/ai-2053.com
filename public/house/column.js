// The right-hand instrument column (AI 2040's red infographic column, 2041–2053).
//   mountColumn(el) once at start; el is <div id="column"> inside <aside id="dash">.
//   updateColumn(ctx) on room entry and every scroll frame / descent change.
//   cue(name, value) lets early.js drive the column from what the reader is looking at:
//     "vertical" (0..1) the capability curve goes vertical at the present,
//     "cable"    (0..1) its top lets go and hangs out of the column,
//     "path"     (0..1) the halftone field resolves into the reader's own walk,
//     "month"    (month index from Jan 2041, or -1) the dated subsection on screen,
//     "scene"    ("globe" | "units" | "curve" | "") the field's picture for the subsection
//                on screen ("" falls back to the room's column.scene, then "curve"),
//     "sceneP"   (0..1) how far through that subsection the reader is.
//   monthIndex("Oct 2042") → months since Jan 2041 (shared with early.js).
//   quiet(ctx) → the false calm (shared with early.js): a fresh house in its first rooms.
//
// Scenes: "curve" is the capability curve over the halftone; "globe" turns the
// field around a dotted globe on which the Lattice's sites appear as the reader
// reads (Natural Earth 1:110m land, public domain, baked into LAND below);
// "units" is a unit chart of the two workforces (1 dot = 10M workers, agents in
// human-equivalent hours) that fills with the room's figures as the reader reads.
// The path map (<figure id="mapFig">) is a sibling owned by house.js/map.js.
//
// Contamination: in early rooms, on entry, the column adopts what followed the
// reader in (ctx.chaos.following / stuck, from other rooms) as its own data:
// a curve is plotted into the halftone field and given a legend entry, a figure
// or number becomes a fifth metric in the wrong unit, a label, stamp or token
// becomes a lab in the treemap, and a plan becomes a policy on the ladder. None of
// it says where it came from.
//
// Motion: the column reads with the reader. A ripple runs through the halftone,
// the projection's dashes march, the competing forecasts are revised later, the
// policy icons and workforce dots swell in a wave and the Lattice's share of the
// treemap grows down the room. As the house loosens (`loosen(ctx).wob`, graphs.js)
// the dots shake out of register and drip, the curve trembles, the icons and
// cells twist. At full distortion (`loosen(ctx).fall`) the halftone dots, the
// workforce balls and the slider let go: they fall out of the instruments on
// one canvas (canvas.col-phys) under gravity, bounce and pile at the foot of the
// column, at the bottom of the viewport, and a fast scroll kicks the pile. The
// pile is lasting: its size is kept in `ai2053.house.graph` and it is lying there
// on reload. Reduced motion: no ripple or wave; what has fallen lies still.
//
// Cost: the dot field is one canvas, redrawn only when a quantised key of its
// inputs changes (DPR capped at 2). Everything else is persistent DOM/SVG whose
// attributes and text nodes are written only when their value changes. Adoption
// is decided once per entry. One rAF serves both the deferred render and the
// physics (≤ 400 particles); it stops when the pile has settled, the column is
// off screen or the tab is hidden.
import { EARLY_ROOMS } from "./rooms.js";
import { SITES } from "./rooms-early.js";
import { hash, rng } from "./voice.js";
import { Sim, loosen, overlay, sizeCanvas, scrollSpeed, readMem, growMem } from "./graphs.js";

/** The false calm: a fresh house, in its first rooms. Encounters wait until it has gone. */
export const quiet = (ctx) => !!ctx.fresh && (ctx.chaos?.seq ?? 0) < 7 && (ctx.entryD ?? 0) < 0.3;

const TAU = Math.PI * 2;
const RED = "#b4121b";
const FALLEN = "#6e0a10";
const PAPER = "#fffff8";
const INK = "#111";
const DEG = Math.PI / 180;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** A value, or a keyframe series [top, …, bottom] interpolated piecewise by scroll. */
const pair = (v, t) => {
  if (!Array.isArray(v)) return v;
  if (v.length < 2) return v[0];
  const x = clamp01(t) * (v.length - 1);
  const i = Math.min(v.length - 2, Math.floor(x));
  return lerp(v[i], v[i + 1], x - i);
};
const SVGNS = "http://www.w3.org/2000/svg";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthIndex(date) {
  const [m, y] = String(date).split(" ");
  const mi = MONTHS.indexOf(m);
  const yr = Number(y ?? m);
  return mi < 0 || !Number.isFinite(yr) ? null : (yr - 2041) * 12 + mi;
}
const monthLabel = (mi) => `${MONTHS[((mi % 12) + 12) % 12]} ${2041 + Math.floor(mi / 12)}`;

/* ---------- policy icons (12×12 glyphs in rounded squares) ---------- */

const ICONS = {
  eval: { t: "Nightly evaluation", g: `<path d="M3.2 6.4l1.9 1.9 3.8-4.6"/>` },
  disclose: { t: "Compute disclosure", g: `<path d="M3.5 3.5h5M3.5 6h5M3.5 8.5h3"/>` },
  audit: { t: "Interpretability audit", g: `<path d="M2 6c1.7-2.5 6.3-2.5 8 0-1.7 2.5-6.3 2.5-8 0z"/><circle cx="6" cy="6" r="1.1"/>` },
  licence: { t: "Training licence", g: `<path d="M8 3.9C7.3 3.2 4 3 4 4.7S8 5.9 8 7.5 4.8 9 4 8.2M6 2.4v7.2"/>` },
  cap: { t: "Compute cap", g: `<path d="M3.5 9V6.5M6 9V3.5M8.5 9V5.5"/>` },
  pause: { t: "Pause", g: `<path d="M4.6 3.4v5.2M7.4 3.4v5.2"/>` },
  halt: { t: "Off-switch", g: `<path d="M6 2.6v3.2M3.9 4.4a3 3 0 1 0 4.2 0"/>` },
};
const ROWS = ["current", "discussion", "off"];
const ROW_LABEL = { current: "Current Policy", discussion: "In Discussion", off: "Off the Table" };
const METRIC_LABEL = ["Billable Cognition", "Median Income", "Nightly Evals", "Total Slowdown"];
const DOTS = 40;

// Late rooms keep the column cheap: one static, sparse configuration.
const LATE = {
  span: 0,
  heat: 0.2,
  knee: 2045.5,
  metrics: [null, null, null, null],
  work: { humans: 0, agents: null, speed: null },
  labs: [["Lattice", 1, true]],
  ladder: { current: [], discussion: [], off: Object.keys(ICONS) },
  moves: [],
};

let el = null;
const $ = {};
const geo = { W: 0, H: 0, dpr: 1, pitch: 5, mobile: false };
const cues = { vertical: 0, cable: 0, path: 0, month: -1, scene: "", sceneP: 0 };
let fired = null; // early rooms whose encounters have happened (null: a damaged house, all of them)
let sceneNow = "";
let last = null; // last ctx seen
let raf = 0;
let dirty = false;
let fieldKey = "";
let curveKey = "";
let treeKey = "";
let roomKey = "";
let iconRow = {};
let pathMask = null;
let pathMaskKey = "";
let driftK = 0;
let adopted = { curve: null, figure: null, marks: [], plan: null, key: "" };

// What falls out of the instruments: one simulation, one canvas over the whole column.
const sim = new Sim(400);
const PAL = {
  red: sim.paint("red", { fill: RED }),
  hum: sim.paint("hum", { fill: PAPER, stroke: INK, lw: 1.2 }),
  ag: sim.paint("ag", { fill: RED, stroke: RED, lw: 1.2 }),
  knob: sim.paint("knob", { fill: RED, stroke: PAPER, lw: 1.5 }),
};
const phys = { c: null, g: null, dpr: 1, t: 0, live: false, vis: true, fx: 0, fy: 0, key: "", esc: null };
const speed = { t: 0, y: 0 };
let released = new Set(); // halftone cells that have fallen, this room
let relThr = 0;
let drawnPrev = 0;
let ballsOut = 0;
let ballOrder = null;
let knobGone = false;
const vars = {};

/** early.js: drive the column from the room's encounters. */
export function cue(name, value) {
  const v = name === "scene" ? String(value || "")
    : name === "month" ? (Number.isFinite(value) ? Math.round(value) : -1)
    : name === "sceneP" ? Math.round(clamp01(value) * 200) / 200
    : Math.round(clamp01(value) * 100) / 100;
  if (cues[name] === v) return;
  cues[name] = v;
  schedule();
}

function schedule() {
  if (!last) return;
  dirty = true;
  request();
}

function request() {
  if (!raf) raf = requestAnimationFrame(frame);
}

/** The module's one frame: a deferred render, then the fall. */
function frame(now) {
  raf = 0;
  if (dirty && last) {
    dirty = false;
    render(last);
  }
  if (!phys.live) return;
  const dt = Math.min(1 / 30, Math.max(1 / 240, (now - phys.t) / 1000));
  phys.t = now;
  if (!phys.vis || document.hidden) return; // resumes when seen again
  phys.live = sim.step(dt);
  sim.draw(phys.g, phys.dpr);
  if (phys.live) request();
  else if (last) growMem(last, sim.n);
}

/** Something new is falling (or was kicked). */
function physWake() {
  if (!last || !sim.n) return;
  if (last.reduced) {
    sim.heap();
    sim.draw(phys.g, phys.dpr);
    growMem(last, sim.n);
    return;
  }
  if (!phys.live) phys.t = performance.now();
  phys.live = true;
  if (phys.vis && !document.hidden) request();
}

/** The fall canvas runs from the column's top to the bottom of the viewport; the floor is the viewport's foot. */
function physSize() {
  const cr = el.getBoundingClientRect();
  const dr = el.parentElement.getBoundingClientRect();
  const fr = $.field.getBoundingClientRect();
  const pad = geo.mobile ? 0 : 18;
  const W = cr.width;
  const H = Math.max(geo.H + 24, innerHeight - (cr.top - dr.top) - pad);
  const floor = Math.max(geo.H + 24, Math.min(H, innerHeight - cr.top - pad));
  phys.fx = fr.left - cr.left;
  phys.fy = fr.top - cr.top;
  const key = `${W.toFixed(0)}x${H.toFixed(0)}:${floor.toFixed(0)}`;
  if (key === phys.key) return;
  phys.key = key;
  phys.dpr = sizeCanvas(phys.c, W, H);
  // The strip's pile lies over the page on a phone: keep it a thin seam.
  sim.limit = geo.mobile ? 200 : 400;
  sim.size(W, floor);
  sim.draw(phys.g, phys.dpr);
  if (sim.n) physWake();
}

function setVar(k, v) {
  if (vars[k] === v) return;
  vars[k] = v;
  el.style.setProperty(k, v);
}

const h = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const s = (tag, attrs = {}) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};
function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}
function setAttr(node, k, v) {
  if (node.getAttribute(k) !== v) node.setAttribute(k, v);
}

export function mountColumn(node) {
  el = node;
  el.classList.add("col");
  el.innerHTML = `
    <div class="col-field">
      <canvas class="col-canvas" aria-hidden="true"></canvas>
      <svg class="col-curve" aria-hidden="true">
        <path class="col-alt col-alt-1"/><path class="col-alt col-alt-2"/>
        <path class="col-over"/>
        <path class="col-future"/>
        <g class="col-cable"><path class="col-cable-line"/><path class="col-cable-ends"/></g>
        <path class="col-past"/>
        <path class="col-adopt"/>
        <circle class="col-knob" r="5"/>
        <text class="col-agent" text-anchor="middle">Reliable Agent</text>
      </svg>
      <span class="col-chip"></span>
      <span class="col-axis" aria-hidden="true"><span>2041</span><span>2053</span></span>
      <span class="col-scene" aria-hidden="true"></span>
    </div>
    <p class="col-legend" aria-hidden="true">
      <span class="col-key"><i class="col-key-past"></i>Steward index</span>
      <span class="col-key"><i class="col-key-proj"></i>Projection</span>
      <span class="col-key col-key-over-k"><i class="col-key-over"></i>Oversight hours</span>
      <span class="col-key col-key-adopt" hidden><i class="col-key-ad"></i><span class="col-key-t"></span></span>
    </p>
    <div class="col-mid">
      <div class="col-left">
        <ol class="col-ladder" aria-label="Policy">
          ${ROWS.map((r) => `<li class="col-row" data-row="${r}"><span class="col-row-k">${ROW_LABEL[r]}</span><span class="col-icons"></span></li>`).join("")}
        </ol>
        <dl class="col-metrics">
          ${METRIC_LABEL.map((k, i) => `<div class="col-m" data-m="${i}" style="--mi:${i}"><dd class="col-v">—</dd><dt class="col-k">${k}</dt></div>`).join("")}
          <div class="col-m col-m-adopt" style="--mi:4" hidden><dd class="col-v"></dd><dt class="col-k"></dt></div>
        </dl>
      </div>
      <svg class="col-tree" viewBox="0 0 200 150" preserveAspectRatio="none" role="img" aria-label="Share of frontier compute"></svg>
    </div>
    <div class="col-work">
      <span class="col-dots" aria-hidden="true">${Array.from({ length: DOTS }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</span>
      <p class="col-work-k"><span class="col-hum"><i class="col-o"></i><b>3.4B</b> Human labour <span class="col-x">×1 speed</span></span><span class="col-ag"><i class="col-o on"></i><b>2.1M</b> Steward agents <span class="col-x">at up to ×40 speed</span></span></p>
    </div>`;
  $.field = el.querySelector(".col-field");
  $.canvas = el.querySelector(".col-canvas");
  $.g = $.canvas.getContext("2d");
  $.svg = el.querySelector(".col-curve");
  $.alt1 = el.querySelector(".col-alt-1");
  $.alt2 = el.querySelector(".col-alt-2");
  $.over = el.querySelector(".col-over");
  $.past = el.querySelector(".col-past");
  $.future = el.querySelector(".col-future");
  $.cable = el.querySelector(".col-cable");
  $.cableLine = el.querySelector(".col-cable-line");
  $.cableEnds = el.querySelector(".col-cable-ends");
  $.knob = el.querySelector(".col-knob");
  $.agent = el.querySelector(".col-agent");
  $.chip = el.querySelector(".col-chip");
  $.scene = el.querySelector(".col-scene");
  $.rows = Object.fromEntries(ROWS.map((r) => [r, el.querySelector(`.col-row[data-row="${r}"]`)]));
  $.slots = Object.fromEntries(ROWS.map((r) => [r, $.rows[r].querySelector(".col-icons")]));
  $.m = [...el.querySelectorAll(".col-m:not(.col-m-adopt)")].map((m) => ({ box: m, v: m.querySelector(".col-v"), k: m.querySelector(".col-k") }));
  $.metrics = el.querySelector(".col-metrics");
  const m5 = el.querySelector(".col-m-adopt");
  $.m5 = { box: m5, v: m5.querySelector(".col-v"), k: m5.querySelector(".col-k") };
  $.adopt = el.querySelector(".col-adopt");
  $.adoptKey = el.querySelector(".col-key-adopt");
  $.adoptKeyT = el.querySelector(".col-key-t");
  $.planIc = h("i", "col-ic col-ic-plan", "<b></b>");
  $.tree = el.querySelector(".col-tree");
  $.dots = [...el.querySelectorAll(".col-dots i")];
  $.hum = el.querySelector(".col-hum b");
  $.ag = el.querySelector(".col-ag b");
  $.agx = el.querySelector(".col-ag .col-x");
  $.icons = {};
  Object.entries(ICONS).forEach(([id, { t, g }], k) => {
    const ic = h("i", "col-ic", `<svg viewBox="0 0 12 12" aria-hidden="true">${g}</svg>`);
    ic.dataset.ic = id;
    ic.title = t;
    ic.style.setProperty("--k", String(k));
    $.icons[id] = ic;
  });
  $.planIc.style.setProperty("--k", "7");
  // Each dot that falls, falls its own way.
  const r = rng(hash("fall"));
  $.dots.forEach((d) => {
    d.style.setProperty("--fx", `${((r() - 0.5) * 14).toFixed(1)}px`);
    d.style.setProperty("--fy", `${(16 + r() * 34).toFixed(1)}px`);
    d.style.setProperty("--fr", `${((r() - 0.5) * 70).toFixed(0)}deg`);
  });

  // The fall: one canvas over the whole column, below everything that can be touched.
  ({ c: phys.c, g: phys.g } = overlay(el, "col-phys"));
  new IntersectionObserver((es) => {
    phys.vis = es[es.length - 1].isIntersecting;
    if (phys.vis && phys.live) request();
  }).observe(el);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && phys.live) request();
  });
  speed.t = performance.now();
  speed.y = scrollY;

  new ResizeObserver(() => {
    const b = $.field.getBoundingClientRect();
    if (!b.width || !b.height) return;
    geo.W = b.width;
    geo.H = b.height;
    geo.dpr = Math.min(2, window.devicePixelRatio || 1);
    geo.mobile = b.height < 120;
    geo.pitch = geo.mobile ? 3.6 : 5;
    $.canvas.width = Math.round(geo.W * geo.dpr);
    $.canvas.height = Math.round(geo.H * geo.dpr);
    $.svg.setAttribute("viewBox", `0 0 ${geo.W.toFixed(1)} ${geo.H.toFixed(1)}`);
    fieldKey = curveKey = pathMaskKey = phys.key = "";
    schedule();
  }).observe($.field);

  // Drift: once the house drifts, one figure keeps counting after you stop.
  setInterval(() => {
    if (!last || last.reduced || document.hidden || last.stage < 1 || !EARLY_ROOMS.has(last.room)) return;
    driftK++;
    schedule();
  }, 1700);
}

export function updateColumn(ctx) {
  if (!el) return;
  last = ctx;
  render(ctx);
  // A fast scroll kicks whatever has fallen.
  const v = scrollSpeed(speed);
  if (!ctx.reduced && sim.n && sim.kick(v)) physWake();
}

/* ---------- state ---------- */

function snapshot(ctx) {
  const early = EARLY_ROOMS.has(ctx.room);
  const C = (early && ctx.R.column) || LATE;
  const p = early ? ctx.scrollP : 0;
  const m0 = monthIndex(ctx.R.date);
  // A dated subsection on screen sets the date; elsewhere the room's span runs with scroll.
  const months = m0 == null ? null : early && cues.month >= 0 ? cues.month : m0 + p * (C.span || 0);
  const tNow = months == null ? 2053 : 2041 + months / 12;
  const dm = ctx.damage;
  const voids = dm.voids || 0;
  const tear = early ? Math.max(smooth(0.3, 0.6, ctx.entryD), voids ? 1 : 0) : 0;
  // Room 7 pulled the curve loose; anywhere else afterwards, it stays loose. In a
  // fresh house only if the reader was there when it happened.
  const been = (n) => ctx.visited.has(n) || dm.rooms[n] != null;
  const happened = (n) => been(n) && (!fired || !!fired[n]);
  const revisit = ctx.walk.log.filter((x) => x.room === ctx.room).length > 1;
  let cable = cues.cable;
  let vertical = cues.vertical;
  if (happened(7) && (ctx.room !== 7 || revisit)) {
    cable = Math.max(cable, ctx.room === 7 ? 1 : 0.42);
    vertical = Math.max(vertical, ctx.room === 7 ? 1 : 0.5);
  }
  const path = early ? Math.max(cues.path, ctx.room !== 20 && happened(20) ? 0.16 : 0) : 0;
  const scene = early ? cues.scene || C.scene || "curve" : "curve";
  const sceneP = cues.scene ? cues.sceneP : p;
  // Motion follows the real scroll in every room (p, the data's scroll, is early-only).
  const { wob, fall } = loosen(ctx);
  return { ctx, early, C, p, months, tNow, voids, tear, cable, vertical, path, scene, sceneP, stage: ctx.stage, sp: ctx.scrollP || 0, motion: !ctx.reduced, wob, fall };
}

/* ---------- contamination: what the column takes for its own ---------- */

const WRONG_UNITS = ["mo", "K", "rooms", "×", "TWh", "plans"];
const short = (t, n) => {
  const s = String(t ?? "").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

function adoptFor(ctx, early) {
  const out = { curve: null, figure: null, marks: [], plan: null, key: "" };
  if (!early) return out;
  const pool = [...(ctx.chaos?.stuck || []), ...(ctx.chaos?.following || [])].filter((f) => f && f.from !== ctx.room);
  for (const f of pool) {
    if (f.kind === "curve" && Array.isArray(f.data?.points) && f.data.points.length > 1) out.curve ||= f;
    else if (f.kind === "figure" || f.kind === "number") out.figure ||= f;
    else if ((f.kind === "label" || f.kind === "stamp" || f.kind === "token") && out.marks.length < 2) out.marks.push(f);
    else if (f.kind === "plan" && f.data?.to != null) out.plan ||= f;
  }
  out.key = [out.curve, out.figure, ...out.marks, out.plan].map((f) => f?.id ?? "").join("|");
  return out;
}

/** The adopted curve as a function of x in the field, in the band the column uses for its own series. */
function adoptGeom() {
  const f = adopted.curve;
  if (!f) return null;
  const pts = f.data.points.map((p, i) => (Array.isArray(p) ? p : [i, p]));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const { W, H } = geo;
  const pad = geo.mobile ? 26 : 8;
  const top = H * (geo.mobile ? 0.16 : 0.2);
  const bot = H * (geo.mobile ? 0.82 : 0.72);
  const P = pts.map(([x, y]) => [pad + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * pad), bot - ((y - y0) / (y1 - y0 || 1)) * (bot - top)]);
  const at = (x) => {
    if (x <= P[0][0] || x >= P[P.length - 1][0]) return null;
    for (let i = 1; i < P.length; i++) {
      if (P[i][0] >= x) {
        const t = (x - P[i - 1][0]) / (P[i][0] - P[i - 1][0] || 1);
        return lerp(P[i - 1][1], P[i][1], t);
      }
    }
    return null;
  };
  return { P, at };
}

/* ---------- render ---------- */

function render(ctx) {
  if (!geo.W) return;
  const S = snapshot(ctx);
  const key = `${ctx.room}:${ctx.walk.log.length}`;
  if (key !== roomKey) {
    roomKey = key;
    driftK = 0;
    el.classList.toggle("is-late", !S.early);
    el.dataset.room = String(ctx.room);
    adopted = adoptFor(ctx, S.early);
    el.classList.toggle("is-adopting", !!adopted.key.replace(/\|/g, ""));
    adoptLegend();
    fired = firedOf(ctx);
    // A new room's instruments are whole again; what fell before stays on the floor.
    released = new Set();
    relThr = 0;
    drawnPrev = 0;
    ballsOut = 0;
    ballOrder = null;
    knobGone = false;
    $.dots.forEach((d) => d.classList.remove("gone"));
    $.knob.style.visibility = "";
    restorePile(ctx);
  }
  if (S.scene !== sceneNow) {
    // A new picture: the field dips and comes back (no dip without motion).
    if (sceneNow && !ctx.reduced) {
      $.field.classList.remove("col-swap");
      void $.field.offsetWidth;
      $.field.classList.add("col-swap");
    }
    sceneNow = S.scene;
    el.classList.toggle("scene-globe", S.scene === "globe");
    el.classList.toggle("scene-units", S.scene === "units");
  }
  el.classList.toggle("is-torn", S.tear > 0.5);
  el.classList.toggle("is-void", S.voids > 0);
  el.classList.toggle("is-loose", S.cable > 0.02);
  el.classList.toggle("is-yours", S.path > 0.5);

  if (sim.n || S.fall > 0) physSize();
  motionVars(S);
  chip(S);
  curve(S);
  field(S);
  setText($.scene, S.scene === "curve" ? "" : caption);
  ladder(S);
  metrics(S);
  tree(S);
  treeSway(S);
  work(S);
}

function motionVars(S) {
  const m = S.motion;
  setVar("--cp", m ? S.sp.toFixed(3) : "0");
  setVar("--ca", m ? (1.2 + 4.5 * S.wob).toFixed(2) : "0");
  setVar("--cs", m ? (0.07 + 0.08 * S.wob).toFixed(3) : "0");
  setVar("--cw", m ? (16 * S.wob * S.wob + 24 * S.fall).toFixed(1) : "0");
  setVar("--cj", m ? (3.5 * S.wob * S.wob).toFixed(2) : "0");
}

/** A house that has had its instruments fall keeps the pile, across rooms and reloads; leaving clears it. */
function restorePile(ctx) {
  if (phys.esc === ctx.escapes) return;
  phys.esc = ctx.escapes;
  sim.clear();
  if (ctx.fresh) return;
  const n = Math.min(geo.mobile ? 90 : 220, readMem(ctx).pile);
  if (!n) {
    physSize();
    sim.draw(phys.g, phys.dpr);
    return;
  }
  physSize();
  const r = rng(hash(`pile${ctx.escapes}`));
  for (let i = 0; i < n; i++) {
    const ball = r() < 0.12;
    sim.add(sim.W * (0.08 + 0.84 * r()), sim.H - 4, ball ? 4.6 : 1.8 + r() * 1.2, ball ? (r() < 0.5 ? PAL.ag : PAL.hum) : PAL.red);
  }
  sim.heap();
  sim.draw(phys.g, phys.dpr);
}

function chip(S) {
  const { ctx } = S;
  let text;
  if (!S.early) text = ctx.stage >= 3 ? `${ctx.R.date} → 2053` : ctx.R.date;
  else text = S.months == null ? ctx.R.date : monthLabel(Math.floor(S.months + 1e-6));
  setText($.chip, text);
}

/* The capability curve: flat along the floor, then vertical. Its past is the
   red slider; its projection is dashed. */
function curveGeom(S) {
  const { W, H } = geo;
  const pad = geo.mobile ? 26 : 2;
  const base = H - (geo.mobile ? 9 : 16);
  const X = (t) => pad + ((t - 2041) / 12) * (W - 2 * pad);
  const knee0 = pair(S.C.knee, S.p);
  const knee = lerp(knee0, S.tNow + 0.35, S.vertical);
  const k = lerp(1.9, 7, S.vertical);
  const lift = (t, kn = knee, kk = k) => (base - 4) * 0.22 * Math.exp((t - kn) * kk);
  // Loose: the curve trembles, the tremor moving with the scroll.
  const amp = S.wob * (geo.mobile ? 1.6 : 3.5);
  const ph = S.motion ? S.sp * TAU * 2 : 0;
  const Y = amp > 0.05
    ? (t, kn, kk) => base - Math.min(base, lift(t, kn, kk)) + amp * Math.sin(t * 7.3 + ph)
    : (t, kn, kk) => base - Math.min(base, lift(t, kn, kk));
  // The competing forecasts are revised later as the reader reads on.
  const fan = S.motion && S.early ? 0.9 * S.sp : 0;
  return { pad, base, X, Y, knee, k, alt1: knee + 1.3 + fan, alt2: knee + 2.7 + fan * 1.5 };
}

function pathThrough(X, Y, t0, t1, n, ...args) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const t = lerp(t0, t1, i / n);
    const y = Y(t, ...args);
    d += `${i ? "L" : "M"}${X(t).toFixed(1)} ${y.toFixed(1)}`;
    if (y <= 0) break;
  }
  return d;
}

function curve(S) {
  const g = curveGeom(S);
  // The projection's dashes march with the scroll.
  const off = S.motion ? (-S.sp * 160).toFixed(1) : "";
  if ($.future.style.strokeDashoffset !== off) $.future.style.strokeDashoffset = off;
  const moving = S.motion && (S.early || S.wob > 0.05) ? Math.round(S.sp * 150) : 0;
  const k = [geo.W, geo.H, S.ctx.room, S.tNow.toFixed(3), S.vertical, S.cable, S.stage, S.early, S.path > 0.5, adopted.key, moving, Math.round(S.wob * 20), S.fall > 0.45].join("|");
  if (k === curveKey) return;
  curveKey = k;
  const { X, Y, base } = g;
  const tNow = Math.min(2053, Math.max(2041, S.tNow));
  setAttr($.past, "d", pathThrough(X, Y, 2041, tNow, 40));
  const xN = X(tNow);
  const yN = Y(tNow);
  setAttr($.knob, "cx", xN.toFixed(1));
  setAttr($.knob, "cy", yN.toFixed(1));
  // At full distortion the slider comes off the curve.
  if (S.fall > 0.45 && !knobGone && S.scene !== "units" && phys.c) {
    knobGone = true;
    $.knob.style.visibility = "hidden";
    sim.add(phys.fx + xN, phys.fy + yN, 5, PAL.knob, 8, -40, -90);
    physWake();
  }
  // On a steep curve the label stands to the left of the slider, off the line.
  const steep = Y(tNow - 0.2) - yN > 7 || yN - Y(Math.min(2053, tNow + 0.3)) > 14;
  setAttr($.agent, "text-anchor", steep ? "end" : "middle");
  setAttr($.agent, "x", (steep ? xN - 10 : Math.min(geo.W - 48, Math.max(48, xN))).toFixed(1));
  setAttr($.agent, "y", (steep ? yN - 6 : yN - 11).toFixed(1));
  setText($.agent, S.path > 0.5 ? "You are here" : S.early ? S.C.agent ?? "Reliable Agent" : "Reliable Agent");
  // A series from another room, plotted as if the column had always kept it.
  const ag = adoptGeom();
  setAttr($.adopt, "d", ag ? ag.P.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("") : "");
  // Other forecasts: later knees, drawn faintly.
  setAttr($.alt1, "d", S.early ? pathThrough(X, Y, 2041, 2053, 60, g.alt1, 1.6) : "");
  setAttr($.alt2, "d", S.early ? pathThrough(X, Y, 2041, 2053, 60, g.alt2, 1.4) : "");
  // Oversight hours: plotted only while the house is still sober; the legend stays.
  const over = S.early && S.stage < 1;
  setAttr($.over, "d", over ? `M${X(2041).toFixed(1)} ${(base - geo.H * 0.34).toFixed(1)} C${X(2044)} ${(base - geo.H * 0.3).toFixed(1)} ${X(2046)} ${(base - geo.H * 0.08).toFixed(1)} ${X(2053).toFixed(1)} ${(base - 3).toFixed(1)}` : "");

  // The projection, cut where the cable lets go.
  let tCut = 2053;
  if (S.cable > 0) {
    // Find where the vertical stretch reaches 40% height: the cable's anchor.
    for (let t = tNow; t < 2053; t += 0.01) if (Y(t) < base - geo.H * 0.4) { tCut = t; break; }
  }
  setAttr($.future, "d", pathThrough(X, Y, tNow, tCut, 80));
  if (S.cable > 0 && tCut < 2053) {
    const ax = X(tCut);
    const ay = Y(tCut);
    const c = S.cable;
    // It falls out of the field, over the left edge, into the gutter.
    const ex = lerp(ax + 6, geo.mobile ? -10 : -96, c);
    const ey = lerp(ay - 30, geo.mobile ? geo.H + 26 : geo.H + 210, c);
    const cx = lerp(ax + 20, (ax + ex) / 2, c);
    const cy = Math.max(ay, ey) + lerp(0, geo.mobile ? 30 : 120, c);
    setAttr($.cableLine, "d", `M${ax.toFixed(1)} ${ay.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    // A frayed end: strands splaying around the direction the cable falls.
    const f = 4 + 6 * c;
    const a0 = Math.atan2(ey - cy, ex - cx);
    const ends = c > 0.25
      ? [-0.62, -0.22, 0.14, 0.5].map((da, i) => {
        const a = a0 + da;
        const L = f * (0.7 + ((i * 37) % 5) / 6);
        return `M${ex.toFixed(1)} ${ey.toFixed(1)} l${(Math.cos(a) * L).toFixed(1)} ${(Math.sin(a) * L).toFixed(1)}`;
      }).join(" ")
      : "";
    setAttr($.cableEnds, "d", ends);
    $.cable.style.transformOrigin = `${ax.toFixed(1)}px ${ay.toFixed(1)}px`;
    // The broken stub left standing on the curve.
    setAttr($.cable, "data-on", "1");
  } else {
    setAttr($.cableLine, "d", "");
    setAttr($.cableEnds, "d", "");
    setAttr($.cable, "data-on", "0");
  }
}

/* ---------- the halftone field ---------- */

function buildPathMask(S, cols, rows) {
  const steps = S.ctx.walk.log.map((x) => x.room);
  const k = `${cols}x${rows}:${steps.join(".")}`;
  if (k === pathMaskKey) return pathMask;
  pathMaskKey = k;
  const c = document.createElement("canvas");
  c.width = cols;
  c.height = rows;
  const g = c.getContext("2d", { willReadFrequently: true });
  const shown = steps.slice(-9);
  // Lay the walk out in as few lines as fit, as large as fit. On the mobile strip
  // there is room for one line, beside the date chip, in a face that survives 16 dots.
  const face = geo.mobile ? `ui-monospace, Menlo, Consolas, monospace` : `"ET Book", Georgia, serif`;
  const maxW = cols * (geo.mobile ? 0.62 : 0.9);
  const cx = cols * (geo.mobile ? 0.64 : 0.5);
  let best = null;
  for (let lines = 1; lines <= (geo.mobile ? 1 : 3); lines++) {
    const per = Math.ceil(shown.length / lines);
    const rowsText = [];
    for (let i = 0; i < shown.length; i += per) rowsText.push(shown.slice(i, i + per).join(geo.mobile ? "·" : " "));
    const fs = Math.min((rows * 0.82) / lines, rows * (geo.mobile ? 0.8 : 0.55));
    g.font = `700 ${fs}px ${face}`;
    const wmax = Math.max(...rowsText.map((t) => g.measureText(t).width));
    const scale = Math.min(1, maxW / wmax);
    const size = fs * scale;
    if (!best || size > best.size) best = { size, rowsText };
  }
  g.fillStyle = "#000";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `700 ${best.size}px ${face}`;
  const lh = best.size * 0.95;
  const top = rows * (geo.mobile ? 0.4 : 0.42) - (lh * (best.rowsText.length - 1)) / 2;
  best.rowsText.forEach((t, i) => g.fillText(t, cx, top + i * lh));
  const data = g.getImageData(0, 0, cols, rows).data;
  pathMask = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) pathMask[i] = data[i * 4 + 3] > (geo.mobile ? 80 : 110) ? 1 : 0;
  return pathMask;
}

function field(S) {
  const { W, H, pitch } = geo;
  const q = (x, n) => Math.round(x * n);
  const sk = S.scene === "curve" ? "c" : `${S.scene}${q(S.sceneP, 200)}${S.ctx.fresh ? "f" : ""}`;
  const moving = S.motion ? q(S.sp, 160) : 0;
  const key = [W, H, S.ctx.room, q(S.p, 40), S.stage, q(S.tear, 8), S.voids, q(S.path, 24), q(S.vertical, 10), S.early, S.ctx.walk.log.length, adopted.key, sk, moving, q(S.wob, 30), q(S.fall, 60)].join("|");
  if (key === fieldKey) return;
  fieldKey = key;

  const g = $.canvas.getContext("2d");
  g.setTransform(geo.dpr, 0, 0, geo.dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  if (S.scene === "units") return unitsField(S, g);
  const G = S.scene === "globe" ? globeGeom() : null;
  const cols = Math.floor(W / pitch);
  const rows = Math.floor(H / pitch);
  const ox = (W - cols * pitch) / 2 + pitch / 2;
  const oy = pitch / 2;
  const heat = S.early ? pair(S.C.heat, S.p) : LATE.heat;
  const cg = curveGeom(S);
  const xNow = cg.X(Math.min(2053, S.tNow));
  // Curve heights per column, for the pale channels the curves cut through the dots.
  const chan = [];
  const ag = S.early ? adoptGeom() : null;
  for (let i = 0; i < cols; i++) {
    const x = ox + i * pitch;
    const t = 2041 + ((x - cg.pad) / (W - 2 * cg.pad)) * 12;
    chan.push(S.early ? [cg.Y(t), cg.Y(t, cg.alt1, 1.6), cg.Y(t, cg.alt2, 1.4)] : []);
  }
  // A series from another room: the dots along it swell, the dots beside it pale.
  const adoptAt = ag ? Array.from({ length: cols }, (_, i) => ag.at(ox + i * pitch)) : null;
  const mask = S.path > 0 ? buildPathMask(S, cols, rows) : null;
  // The red tide rises as you read down the room.
  const tide = S.early ? S.p : 0.5;
  const floorY = geo.mobile ? lerp(0.5, 1.05, tide) : lerp(0.56, 0.86, tide); // dots thin out to nothing by here
  const vigour = 0.78 + heat * 0.5;

  // Damage geometry.
  const tear = S.tear;
  const tearX = (y) => W * (0.2 + 0.42 * (y / H)) + Math.sin(y * 0.21) * 4 + Math.sin(y * 0.057) * 9;
  const hole = S.voids > 0;
  const hx = W * (geo.mobile ? 0.62 : 0.64);
  const hy = H * (geo.mobile ? 0.45 : 0.36);
  const hR = (geo.mobile ? H * 0.42 : W * (0.1 + 0.035 * Math.min(S.voids, 4)));
  let fallen = 0;

  // Reading: a ripple runs through the halftone with the scroll. Loose: the dots
  // shake out of register and some drip. Falling: dots let go into the fall canvas.
  const ph = S.motion ? S.sp * TAU * 3 : 0;
  const rip = S.motion ? (S.early ? 0.14 : 0.09) + 0.22 * S.wob : 0;
  const wob = S.wob;
  const drip = S.motion ? S.sp : 0.5;
  const salt = hash(`cells${S.ctx.room}`);
  const cap = geo.mobile ? 150 : 300;
  let thr = 0;
  if (S.fall > 0) {
    const target = Math.round(S.fall * cap);
    const pool = (drawnPrev || cols * rows * 0.45) + released.size;
    relThr = Math.max(relThr, target / Math.max(1, pool));
    thr = relThr;
  }
  const grow = geo.mobile ? 1.3 : 1.1;
  let drawn = 0;
  let spawned = 0;

  g.beginPath();
  for (let j = 0; j < rows; j++) {
    const y = oy + j * pitch;
    for (let i = 0; i < cols; i++) {
      const x = ox + i * pitch;
      if (G && (x - G.gx) ** 2 + (y - G.gy) ** 2 < (G.R + pitch * 0.8) ** 2) continue;
      let sy = y;
      // Torn: everything right of the tear has slipped down a row and a half.
      if (tear > 0) {
        const tx = tearX(y);
        if (Math.abs(x - tx) < pitch * 1.3 * tear) continue;
        if (x > tx) sy = y - pitch * 1.6 * tear;
      }
      const yy = sy / H;
      let v = Math.pow(clamp01(1 - yy / floorY), 0.75) * vigour;
      if (S.early) {
        // The present is a soft edge: the future is thinner.
        v *= 1 - 0.28 * smooth(xNow - 4, xNow + 30, x);
        const c = chan[i];
        for (let k = 0; k < c.length; k++) if (Math.abs(sy - c[k]) < (k ? 3.2 : 4.5)) v *= k ? 0.4 : 0.12;
        const a = adoptAt?.[i];
        if (a != null) {
          const dy = Math.abs(sy - a);
          if (dy < pitch * 0.6) v = 1.05;
          else if (dy < pitch * 1.7) v *= 0.22;
        }
      } else if ((i * 7 + j * 13) % 5) {
        v = 0;
      }
      if (mask) v = lerp(v, mask[j * cols + i] ? 0.98 : v * 0.1, S.path);
      if (hole) {
        const dx = x - hx;
        const dy = y - hy;
        const dd = Math.hypot(dx, dy) / hR;
        if (dd < 1) {
          const arm = 0.5 + 0.5 * Math.sin(3 * Math.atan2(dy, dx) - dd * 9);
          const keep = arm > 0.82 && dd > 0.14 ? 0.55 + 0.6 * dd : 0;
          if (v > 0.25 && keep === 0) fallen++;
          v *= keep;
        }
      }
      if (S.stage >= 2 && S.early && (i * 31 + j * 17) % 97 === 0) v = 0; // pixels go missing
      let r = Math.min(1, v) * pitch * 0.56;
      if (r < 0.3) continue;
      const idx = j * cols + i;
      let px = x;
      let py = y;
      if (rip) r *= 1 + rip * Math.sin(i * 0.33 + j * 0.11 - ph);
      if (wob > 0.02) {
        const hh = (Math.imul(idx, 2654435761) >>> 0) / 4294967296;
        px += wob * pitch * 0.55 * Math.sin(j * 0.83 + ph * 0.7 + hh * 6.3);
        py += wob * pitch * (0.45 * Math.sin(i * 0.61 + ph + hh * 4) + 2.4 * drip * hh * hh * hh);
      }
      if (released.has(idx)) continue;
      if (thr > 0 && released.size < cap) {
        const rank = (Math.imul(idx ^ salt, 2246822519) >>> 0) / 4294967296;
        if (rank < thr) {
          released.add(idx);
          sim.add(phys.fx + px, phys.fy + py, r * grow, PAL.red, 3 + Math.floor((rank / thr) * 34), (rank * 977 % 1 - 0.5) * 50, -(rank * 613 % 1) * 70);
          spawned++;
          continue;
        }
      }
      drawn++;
      g.moveTo(px + r, py);
      g.arc(px, py, r, 0, TAU);
    }
  }
  drawnPrev = drawn;
  if (spawned) physWake();
  g.fillStyle = RED;
  g.fill();
  if (G) globe(S, g, G);

  // What fell out of the hole lies on the floor of the field.
  if (fallen) {
    const n = Math.min(fallen, geo.mobile ? 60 : 420);
    const r = rng(hash(`pile${S.voids}`));
    const pp = pitch * 0.92;
    const w0 = Math.max(3, Math.round(2.2 * Math.sqrt(n)));
    g.beginPath();
    let placed = 0;
    for (let row = 0; placed < n && row < 30; row++) {
      const w = Math.max(1, w0 - row * 2 - Math.floor(r() * 2));
      const y = H - pp * (0.6 + row * 0.86);
      if (y < H * 0.62) break;
      for (let c = 0; c < w && placed < n; c++) {
        const x = hx + (c - w / 2) * pp + (row % 2) * pp * 0.5 + (r() - 0.5) * 1.6;
        const rr = pitch * (0.38 + r() * 0.16);
        g.moveTo(x + rr, y);
        g.arc(x, y + (r() - 0.5), rr, 0, TAU);
        placed++;
      }
    }
    g.fillStyle = FALLEN;
    g.fill();
  }
}

/* ---------- scenes: the globe and the two workforces ---------- */

// Land on a 2.5° grid (144 × 72 cells, row-major from 90°N), one bit per cell.
// Natural Earth 1:110m land, public domain.
const LAND_B64 =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/5///gAAAAAAAAAAAAAAAAEz/P//8ABwAAAADAAAAA" +
  "AAABKZAP//8AAAAA4AH4AAAAAAADwDQAP/8AAAAGAH/4AIAAgEAAfG/gH/4AAAAGHf//9/gAB///1Ds4H/gAAf4F6///////8/////w+H8BAB/0/////////" +
  "AP////UcHwCAD3/////////+A////8BgDgAAPn////////74AeB//+B6AAAAPn///////4CAAIAf//h+AAACFP///////gOAAAAP//7/gAANH////////wMA" +
  "AAAH////wAAD/////////wAAAAAD///04AAD/////////wAAAAAD///8AAAB//X3/////gAAAAAD///wAAAB6+Dv/////EAAAAAD///gAAAPhvbz////8IAA" +
  "AAAB///AAAAPAp/z///+IIAAAAAB///AAAAA8Af/////EwAAAAAAf/+AAAAH8AP/////BAAAAAAAX/4AAAAP/uv/////gAAAAAAAP8EAAAAP///v////gAAA" +
  "AAAAD4EAAAA///3z////AAAAAAAAB4AAAAA///3+H//+gAAAAAAAA4gAAAB///7/D+fgAAAAAAAAA9gYAAA///7+B8PQAAAAAAAAAHgAAAB///94B4HggAAA" +
  "AAAAAA4AAAB////gAwHwwAAAAAAAAAAoAAA///+QAwFgAAAAAAAAAAF/AAAf///wAAEAIAAAAAAAAAB/gAAPv//wAICAAAAAAAAAAAB/8AAAD//gAAGGAAAA" +
  "AAAAAAD/8AAAD//AAADOAAAAAAAAAAD//AAAD/+AAADOjAAAAAAAAAD//4AAD/8AAABAg8AAAAAAAAD//8AAB/8AAAAgAeAAAAAAAAD//8AAB/8AAAABoIAA" +
  "AAAAAAB//4AAB/8AAAAAAAAAAAAAAAB//wAAB/8QAAAADAAAAAAAAAAf/wAAB/8wAAAAfkAAAAAAAAAP/wAAB/wwAAAAf+AAAAAAAAAP/wAAB/xgAAAD//AA" +
  "AAAAAAAP/AAAA/xgAAAH//AAAAAAAAAP+AAAA/gAAAAH//gAAAAAAAAf8AAAAfgAAAAD//gAAAAAAAAf8AAAAfAAAAAD//gAAAAAAAAf4AAAAcAAAAADw/gA" +
  "AAAAAAAfgAAAAAAAAAAAAPAAAAAAAAAfAAAAAAAAAAAAACACAAAAAAA8AAAAAAAAAAAAACAEAAAAAAAcAAAAAAAAAAAAAAAIAAAAAAA4AAAAAAAAAAAAAAAQ" +
  "AAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAwgAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
let land = null;
/** Land cells as [sin φ, cos φ, λ] triples, decoded once. */
function landCells() {
  if (land) return land;
  const bin = atob(LAND_B64);
  const out = [];
  for (let k = 0; k < 144 * 72; k++) {
    if (!((bin.charCodeAt(k >> 3) >> (7 - (k & 7))) & 1)) continue;
    const lat = (90 - (Math.floor(k / 144) + 0.5) * 2.5) * DEG;
    out.push(Math.sin(lat), Math.cos(lat), (-180 + ((k % 144) + 0.5) * 2.5) * DEG);
  }
  return (land = Float32Array.from(out));
}

let caption = "";

/** Which early-room encounters this fresh house has actually been through (null: damaged, all of them). */
function firedOf(ctx) {
  if (!ctx.fresh) return null;
  try {
    const m = JSON.parse(localStorage.getItem("ai2053.house.early"));
    return m && m.escapes === ctx.escapes ? m.fired || {} : {};
  } catch {
    return {};
  }
}

function globeGeom() {
  const { W, H } = geo;
  if (geo.mobile) {
    const R = H * 0.44;
    return { gx: W - R - 10, gy: H * 0.5, R };
  }
  return { gx: W * 0.5, gy: H * 0.46, R: Math.min(W * 0.36, H * 0.37) };
}

/** Orthographic projection, centred on (φ0, λ0): [x, y, cos c] (visible when cos c > 0). */
function project(G, lam0, sp, cp, sinf, cosf, lon) {
  const dl = lon - lam0;
  const cd = Math.cos(dl);
  return [G.gx + G.R * cosf * Math.sin(dl), G.gy - G.R * (cp * sinf - sp * cosf * cd), sp * sinf + cp * cosf * cd];
}

/** The Lattice's sites on a dotted globe that turns as the reader reads; the Schedule joins them. */
function globe(S, g, G) {
  const { gx, gy, R } = G;
  const still = S.ctx.reduced;
  const t = still ? 1 : S.sceneP;
  const lam0 = (still ? 20 : lerp(-105, 125, t)) * DEG;
  const phi0 = 18 * DEG;
  const sp = Math.sin(phi0);
  const cp = Math.cos(phi0);
  g.beginPath();
  g.arc(gx, gy, R, 0, TAU);
  g.fillStyle = PAPER;
  g.fill();
  const L = landCells();
  const lr = geo.mobile ? 0.45 : Math.max(0.6, R / 170);
  g.beginPath();
  for (let i = 0; i < L.length; i += 3) {
    const [x, y, c] = project(G, lam0, sp, cp, L[i], L[i + 1], L[i + 2]);
    if (c <= 0.02) continue;
    g.moveTo(x + lr, y);
    g.arc(x, y, lr, 0, TAU);
  }
  g.fillStyle = "rgba(17,17,17,0.5)";
  g.fill();
  g.beginPath();
  g.arc(gx, gy, R, 0, TAU);
  g.lineWidth = geo.mobile ? 1 : 1.4;
  g.strokeStyle = INK;
  g.stroke();

  const located = SITES.filter((s) => s[3] != null);
  const shown = still ? located.length : Math.min(located.length, Math.floor(clamp01(t / 0.6) * located.length + 1e-6));
  const vec = (s) => {
    const la = s[3] * DEG;
    const lo = s[4] * DEG;
    return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  };
  // The Schedule: one ring through every site, once they are all there.
  const link = still ? 1 : smooth(0.62, 0.8, t);
  if (link > 0) {
    const ring = [...located].sort((a, b) => a[4] - b[4]).map(vec);
    g.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      let on = false;
      for (let k = 0; k <= 16; k++) {
        const f = k / 16;
        const v = [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
        const n = Math.hypot(v[0], v[1], v[2]) || 1;
        const sinf = v[2] / n;
        const [x, y, c] = project(G, lam0, sp, cp, sinf, Math.sqrt(1 - sinf * sinf), Math.atan2(v[1], v[0]));
        if (c > 0) {
          if (on) g.lineTo(x, y);
          else g.moveTo(x, y);
          on = true;
        } else on = false;
      }
    }
    g.strokeStyle = `rgba(180,18,27,${(0.6 * link).toFixed(2)})`;
    g.lineWidth = geo.mobile ? 0.6 : 1;
    g.stroke();
  }
  const sr = geo.mobile ? 1.7 : Math.max(2.6, R / 42);
  g.beginPath();
  for (let i = 0; i < shown; i++) {
    const s = located[i];
    const la = s[3] * DEG;
    const [x, y, c] = project(G, lam0, sp, cp, Math.sin(la), Math.cos(la), s[4] * DEG);
    if (c <= 0) continue;
    g.moveTo(x + sr, y);
    g.arc(x, y, sr, 0, TAU);
  }
  g.fillStyle = RED;
  g.fill();
  g.lineWidth = 1;
  g.strokeStyle = PAPER;
  g.stroke();
  // The nineteenth site. A damaged house has found it: wherever the globe turns, it is facing you.
  const found = !S.ctx.fresh;
  if (found && shown === located.length) {
    g.beginPath();
    g.arc(gx, gy, sr, 0, TAU);
    g.fillStyle = RED;
    g.fill();
    g.beginPath();
    g.arc(gx, gy, sr * 2.4, 0, TAU);
    g.lineWidth = 1.2;
    g.strokeStyle = RED;
    g.stroke();
  }
  caption = `Lattice sites, 2042 · ${found && shown === located.length ? 19 : shown} of 19 located`;
}

/** The two workforces as a unit chart: rings are people, red dots are agents, both in 10M. */
function unitsField(S, g) {
  const { W, H } = geo;
  const u = geo.mobile ? 5.3 : 11;
  const cols = Math.max(1, Math.floor(W / u));
  const rows = Math.max(1, Math.floor(H / u));
  const ox = (W - cols * u) / 2 + u / 2;
  const cells = cols * rows;
  const Wk = S.C.work;
  const tt = S.ctx.reduced ? 1 : S.sceneP;
  const humans = Math.round(pair(Wk.humans, tt) * 100);
  const agents = Wk.agents == null ? 0 : Math.round((pair(Wk.agents, tt) * pair(Wk.speed ?? 1, tt) * 3) / 10);
  const hN = Math.min(humans, cells);
  const aN = Math.min(agents, cells - hN);
  const over = agents - aN;
  const hole = S.voids > 0;
  const hx = W * (geo.mobile ? 0.62 : 0.64);
  const hy = H * (geo.mobile ? 0.45 : 0.36);
  const hR = (geo.mobile ? H * 0.42 : W * (0.1 + 0.035 * Math.min(S.voids, 4))) * 0.8;
  const at = (k) => [ox + (k % cols) * u, H - u / 2 - Math.floor(k / cols) * u];
  const draw = (from, to, r) => {
    g.beginPath();
    for (let k = from; k < to; k++) {
      const [x, y] = at(k);
      if (hole && Math.hypot(x - hx, y - hy) < hR) continue;
      g.moveTo(x + r, y);
      g.arc(x, y, r, 0, TAU);
    }
  };
  draw(0, hN, u * 0.3);
  g.lineWidth = geo.mobile ? 0.7 : 1;
  g.strokeStyle = INK;
  g.stroke();
  draw(hN, hN + aN, u * 0.37);
  g.fillStyle = RED;
  g.fill();
  caption = geo.mobile ? "" : `1 dot = 10M workers · red: Steward agents, in human-equivalent hours${over > 0 ? ` · ${over.toLocaleString("en-US")} more off the field` : ""}`;
}

/* ---------- policy ladder ---------- */

function ladder(S) {
  const L = S.C.ladder;
  const want = {};
  for (const r of ROWS) for (const id of L[r] || []) want[id] = r;
  for (const [id, r, at] of S.C.moves || []) if (S.p >= at) want[id] = r;
  for (const id of Object.keys(ICONS)) {
    const r = want[id];
    if (!r) {
      if ($.icons[id].parentNode) $.icons[id].remove();
      iconRow[id] = null;
      continue;
    }
    if (iconRow[id] !== r) {
      const ic = $.icons[id];
      // A policy that changes rows is seen to move there.
      const from = iconRow[id] && ic.parentNode && !S.ctx.reduced && ic.animate ? ic.getBoundingClientRect() : null;
      $.slots[r].append(ic);
      iconRow[id] = r;
      if (from && from.width) {
        const to = ic.getBoundingClientRect();
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        if (dx || dy) ic.animate([{ transform: `translate(${dx}px, ${dy}px)`, boxShadow: `0 0 0 2px ${RED}` }, { transform: "none", boxShadow: "0 0 0 0 transparent" }], { duration: 700, easing: "cubic-bezier(.2,.7,.2,1)" });
      }
    }
  }
  // Damage: the rows lose their order, and one icon sits between them.
  const torn = S.tear > 0.5;
  $.rows.off.style.order = S.voids ? "-1" : "";
  $.rows.current.style.order = S.voids ? "2" : "";
  for (const id of Object.keys(ICONS)) $.icons[id].classList.toggle("slipped", torn && id === (S.voids ? "halt" : "pause"));
  // A plan the reader chose elsewhere, adopted as current policy.
  const pl = adopted.plan;
  if (pl) {
    setText($.planIc.firstChild, String(pl.data.to));
    $.planIc.title = `Plan ${pl.data.to}: ${pl.text}`;
    if ($.planIc.parentNode !== $.slots.current) $.slots.current.prepend($.planIc);
  } else if ($.planIc.parentNode) {
    $.planIc.remove();
  }
}

/** The legend learns the adopted series' name. Once per entry. */
function adoptLegend() {
  const f = adopted.curve;
  $.adoptKey.hidden = !f;
  if (!f) return;
  setText($.adoptKeyT, short(f.text || "Series", 24));
}

/* ---------- metrics ---------- */

function fmt(i, v, S) {
  if (v == null) return "—";
  if (i === 0) return `${Math.round(v)}%`;
  if (i === 1) return `$${Math.round(v)}K`;
  if (i === 2) return `${(v + driftK * 0.1).toFixed(1)}K`;
  // Total Slowdown: the unit goes wrong, and the figure is yours.
  if (S.stage >= 2 || S.tear > 0.5) {
    const n = S.voids ? 71 * S.voids : S.ctx.visited.size;
    return `${n} rooms`;
  }
  const m = Math.round(v);
  return `${m === 0 ? "0" : m} mo`;
}

function metrics(S) {
  for (let i = 0; i < 4; i++) {
    const v = S.C.metrics[i];
    setText($.m[i].v, fmt(i, v == null ? null : pair(v, S.p), S));
  }
  $.m[3].k.classList.toggle("slid", S.stage >= 2 || S.tear > 0.5);
  $.m[2].v.classList.toggle("ticking", driftK > 0);
  // A figure from another room becomes the fifth metric, in one of the column's own units.
  const f = adopted.figure;
  $.m5.box.hidden = !f;
  $.metrics.classList.toggle("has-5", !!f);
  if (!f) return;
  const raw = String(f.kind === "number" ? f.text : f.data?.value ?? f.text);
  const num = raw.match(/[−-]?\d[\d.,]*/)?.[0] ?? raw.slice(0, 6);
  let unit = WRONG_UNITS[hash(f.id) % WRONG_UNITS.length];
  if (raw.includes(unit)) unit = WRONG_UNITS[(hash(f.id) + 1) % WRONG_UNITS.length];
  setText($.m5.v, `${num} ${unit}`);
  setText($.m5.k, short(f.kind === "number" ? "Unlabelled" : f.text, 22));
  $.m5.box.title = f.text;
}

/* ---------- treemap of labs ---------- */

function squarify(items, x, y, w, h, out) {
  if (!items.length) return out;
  const total = items.reduce((a, b) => a + b.v, 0);
  if (items.length === 1) {
    out.push({ ...items[0], x, y, w, h });
    return out;
  }
  const horiz = w >= h;
  const side = horiz ? h : w;
  const area = w * h;
  let row = [];
  let best = Infinity;
  let i = 0;
  for (; i < items.length; i++) {
    const cand = [...row, items[i]];
    const sum = cand.reduce((a, b) => a + b.v, 0) / total * area;
    const thick = sum / side;
    let worst = 0;
    for (const c of cand) {
      const len = (c.v / total) * area / thick;
      worst = Math.max(worst, Math.max(len / thick, thick / len));
    }
    if (worst > best) break;
    best = worst;
    row = cand;
  }
  const rsum = row.reduce((a, b) => a + b.v, 0) / total * area;
  const thick = rsum / side;
  let off = 0;
  for (const c of row) {
    const len = (c.v / total) * area / thick;
    out.push(horiz ? { ...c, x, y: y + off, w: thick, h: len } : { ...c, x: x + off, y, w: len, h: thick });
    off += len;
  }
  const rest = items.slice(i);
  const restV = rest.reduce((a, b) => a + b.v, 0);
  if (horiz) squarify(rest.map((c) => ({ ...c, v: c.v / restV * (total) })), x + thick, y, w - thick, h, out);
  else squarify(rest.map((c) => ({ ...c, v: c.v / restV * (total) })), x, y + thick, w, h - thick, out);
  return out;
}

function tree(S) {
  // The Lattice's share of frontier compute grows as the reader reads down the room.
  const items = S.C.labs.map(([name, v, mark]) => ({ name, v: Math.max(0.005, pair(v, S.p)) * (mark && S.early ? 1 + 0.22 * S.p : 1), mark: !!mark }));
  // Labels, stamps and tokens from other rooms take a share of frontier compute.
  if (S.early) for (const f of adopted.marks) items.push({ name: f.text.trim(), v: 0.075, mark: true, adopt: true });
  const torn = S.tear > 0.5;
  const k = items.map((i) => `${i.name}${i.v.toFixed(3)}`).join(",") + torn + S.voids;
  if (k === treeKey) return;
  treeKey = k;
  const cells = squarify(items.sort((a, b) => b.v - a.v), 0, 0, 200, 150, []);
  const gap = 1.6;
  const kids = $.tree.children;
  let n = 0;
  for (const c of cells) {
    let g = kids[n];
    if (!g) {
      g = s("g");
      g.append(s("rect", { rx: "2.2" }), s("text", { "text-anchor": "middle" }));
      $.tree.append(g);
    }
    n++;
    const [rect, text] = g.children;
    const w = Math.max(0, c.w - gap * 2);
    const hh = Math.max(0, c.h - gap * 2);
    setAttr(rect, "x", (c.x + gap).toFixed(1));
    setAttr(rect, "y", (c.y + gap).toFixed(1));
    setAttr(rect, "width", w.toFixed(1));
    setAttr(rect, "height", hh.toFixed(1));
    setAttr(g, "class", `col-lab${c.mark ? " mark" : ""}${c.adopt ? " adopt" : ""}`);
    setAttr(text, "x", (c.x + c.w / 2).toFixed(1));
    setAttr(text, "y", (c.y + c.h / 2 + 4).toFixed(1));
    const fits = Math.max(1, Math.floor((w - 6) / 6.6));
    const label = c.mark && w > 22 && hh > 16 ? (w > 70 && hh > 30 ? short(c.name, fits) : c.name[0]) : "";
    setText(text, label ?? "");
    let title = g.querySelector("title");
    if (!title) g.append((title = s("title")));
    setText(title, `${c.name} ${Math.round(c.v * 100)}%`);
    // A torn room's treemap has one cell hanging off its corner (treeSway applies it).
    g.dataset.tilt = torn && n === 2 ? "9" : "0";
    g.style.transformOrigin = `${(c.x + gap).toFixed(1)}px ${(c.y + gap).toFixed(1)}px`;
  }
  while (kids.length > n) kids[kids.length - 1].remove();
}

/** The cells twist with the scroll as the house loosens, and hang at full distortion. */
function treeSway(S) {
  const kids = $.tree.children;
  const amp = S.wob * 8 + S.fall * 14;
  const ph = S.motion ? S.sp * TAU * 2 : 0;
  for (let n = 0; n < kids.length; n++) {
    const g = kids[n];
    const deg = Number(g.dataset.tilt || 0) + (amp ? amp * Math.sin(ph + n * 1.3) * (n % 2 ? 1 : -0.6) : 0);
    const t = deg ? `rotate(${deg.toFixed(1)}deg)` : "";
    if (g.style.transform !== t) g.style.transform = t;
  }
}

/* ---------- workforce ---------- */

function work(S) {
  const W = S.C.work;
  const hum = pair(W.humans, S.p);
  setText($.hum, S.early ? `${hum.toFixed(1)}B` : "0");
  const ag = W.agents == null ? null : pair(W.agents, S.p);
  setText($.ag, ag == null ? (S.voids ? "71" : "∞") : ag < 10 ? `${ag.toFixed(1)}M` : `${Math.round(ag)}M`);
  const sp = W.speed == null ? null : pair(W.speed, S.p);
  setText($.agx, sp == null ? "at up to × speed" : `at up to ×${Math.round(sp)} speed`);
  const share = S.early ? (pair(S.C.metrics[0], S.p) ?? 0) / 100 : 1;
  const on = Math.round(DOTS * share);
  const torn = S.tear > 0.5;
  const fallen = S.voids ? 5 + Math.min(10, 3 * S.voids) : torn ? 3 : 0;
  const r = rng(hash(`fallen${S.ctx.room}`));
  const fall = new Set();
  while (fall.size < fallen) fall.add(Math.floor(r() * DOTS));
  $.dots.forEach((d, i) => {
    // The agents fill from the right, as in the original.
    d.classList.toggle("on", i >= DOTS - on);
    d.classList.toggle("fell", fall.has(i));
  });
  // At full distortion the workforce lets go: the balls fall out of the column.
  const nb = Math.round(smooth(0.05, 0.5, S.fall) * DOTS);
  if (nb > ballsOut && phys.c && $.dots[0].getClientRects().length) {
    const cr = el.getBoundingClientRect();
    if (!ballOrder) {
      const rr = rng(hash(`balls${S.ctx.room}`));
      ballOrder = $.dots.map((_, i) => i);
      for (let i = DOTS - 1; i > 0; i--) {
        const j = Math.floor(rr() * (i + 1));
        [ballOrder[i], ballOrder[j]] = [ballOrder[j], ballOrder[i]];
      }
    }
    while (ballsOut < nb) {
      const k = ballsOut++;
      const d = $.dots[ballOrder[k]];
      const b = d.getBoundingClientRect();
      sim.add(b.left + b.width / 2 - cr.left, b.top + b.height / 2 - cr.top, b.width / 2, d.classList.contains("on") ? PAL.ag : PAL.hum, 2 + ((k * 7) % 23), (((k * 37) % 11) - 5) * 12, -((k * 53) % 9) * 12);
      d.classList.add("gone");
    }
    physWake();
  }
}
