// Visual scars carried between rooms (owned by HouseScars).
// Hooks called by house.js after living.decorate: decorate(article, ctx), update(ctx), leave().
//
// Every room the reader actually spends time in leaves a visual scar that later
// rooms keep. The scar is derived from the room that was left: its grammar
// (html[data-grammar] at decorate time; report rooms have none and leave the
// column's halftone in the scene they were showing), its lasting damage, and how
// long and how far the reader read it. Later pages draw the latest SHOW scars of
// other rooms, each weaker with distance, seeded from the stored scar and the
// room it lands in, so a room looks the same on reload. Nothing explains them.
//
//   report rooms → halftone bleed (stain · globe · unit chart)   26 mirror → reversed show-through band
//   31 homepage  → the 1997 tile through a torn patch             11 tokens → blank redaction bars in the gaps
//   38 schematic → oscilloscope trace that runs as you scroll     44 number → the well's rings pressed into the paper
//   71 void      → a black edge creeping in from the margin       45 blank  → crop marks round nothing, rules erased
//   17 unfiled   → punch holes and a staple                        52 index  → thumb-index notches on the fore-edge
//   2054 after   → an afterimage of the heading                    53 centre → dusk at the foot of the page
//   33 corridor  → vanishing lines; frames come toward you         36 wheel  → a volvelle turning in the margin
//   64 registry  → ledger ruling behind the text                   81 long   → revision bars beside paragraphs
//   88 verso     → a fold crease and a dog-ear                     40 report → registration slip and a scan band
//   48 hearing   → a photocopier streak and the manila folder
//
// Layers (all aria-hidden, pointer-events: none, below the plans' z-index 6, never focusable):
//   .sc-page  first child of the article, absolute over the whole room (document-tied),
//             faint enough to sit over ink as plain alpha (no blend modes: they cost every frame);
//   .sc-view  first child of <body>, fixed to the viewport (edges, traces, frames);
//   plus text/box shadows on the room's own heading and rule (.sc-h).
// Motion is scroll-driven only (velocity, depth, offset); one rAF settles it and stops.
// Reduced motion: drawn once at the end state, never updated. Fresh readers: nothing.
//
// Memory: localStorage `ai2053.house.scars`, stamped with ctx.escapes:
//   { escapes, seeded, list: [{ r room, k kind, v variant, s seed, w weight, p depth, dm damage, n void entries, t text }] }
// newest first, one per room (a return visit strengthens it and brings it forward).
// It is written only when a room is left (plan, Back, reload) and never reset by them.

import { ROOMS } from "./rooms.js";
import { hash, rng } from "./voice.js";

const KEY = "ai2053.house.scars";
const KEEP = 7; // one more than SHOW, so the room you are in never pushes a visible scar out on reload
const SHOW = 6;
const root = document.documentElement;
const mobileMQ = matchMedia("(max-width: 860px)");
const SVG = "http://www.w3.org/2000/svg";

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const f2 = (x) => (Math.round(x * 100) / 100).toString();
const f3 = (x) => (Math.round(x * 1000) / 1000).toString();
const between = (R, a, b) => a + R() * (b - a);

const KIND = {
  mirror: "mirror", homepage: "tile", tokens: "bars", schematic: "trace", number: "well",
  void: "edge", blank: "crop", unfiled: "punch", index: "notch", after: "after", centre: "dusk",
  "deep-graph": "corridor", "deep-wheel": "wheel", "deep-registry": "ledger",
  "long-answer": "change", "long-verso": "crease", "gen-report": "slip", "gen-hearing": "streak",
};
// Only for review walks seeded by ?path= (rooms the reader never rendered): the
// grammar each room module sets for itself.
const GRAMMAR_OF = {
  26: "mirror", 31: "homepage", 11: "tokens", 38: "schematic", 44: "number", 71: "void", 45: "blank",
  17: "unfiled", 52: "index", 2054: "after", 53: "centre", 33: "deep-graph", 36: "deep-wheel",
  64: "deep-registry", 81: "long-answer", 88: "long-verso", 40: "gen-report", 48: "gen-hearing",
};
const DARK = new Set(["void"]);

/* ---------- memory ---------- */

function load(escapes) {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(KEY)); } catch { m = null; }
  const e = escapes ?? 0;
  if (!m || typeof m !== "object" || m.escapes !== e || !Array.isArray(m.list)) m = { escapes: e, seeded: null, list: [] };
  return m;
}
function store(m) {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* full or blocked: the scars are simply not kept */ }
}
function push(m, sc) {
  const old = m.list.find((x) => x.r === sc.r);
  if (old) {
    sc.s = old.s;
    sc.w = Math.max(old.w, sc.w);
    sc.p = Math.max(old.p, sc.p);
    sc.dm = Math.max(old.dm || 0, sc.dm || 0);
    if (!sc.t) sc.t = old.t;
  }
  m.list = [sc, ...m.list.filter((x) => x.r !== sc.r)].slice(0, KEEP);
}

const sentence = (text) => {
  const t = String(text || "").replace(/\^\d+/g, "").replace(/\s+/g, " ").trim();
  const all = t.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()).filter((s) => s.length > 30 && s.length < 130) ?? [];
  return (all[0] || t.slice(0, 110)).slice(0, 130);
};

/** A ?path= review walk: the rooms on it scar the house as if they had been read. */
function seedFrom(m, ctx) {
  const log = ctx.walk.log.map((s) => s.room).slice(0, -1);
  for (const n of log) {
    if (!ROOMS[n] || n === 0) continue;
    const g = GRAMMAR_OF[n] || "";
    const prose = (ROOMS[n].prose || []).find((p) => typeof p === "string");
    push(m, {
      r: n, k: KIND[g] || "halftone", v: ROOMS[n].column?.scene || "curve", s: hash(`scar:${n}`) >>> 0,
      w: 0.78, p: 0.7, dm: ctx.damage.rooms?.[n] ?? 0.5, n: ctx.damage.voidRooms?.[71] || 0,
      t: g === "mirror" ? sentence(prose) : "",
    });
  }
  m.seeded = ctx.walk.started || "seeded";
}

/* ---------- the room being read ---------- */

let here = null; // what the current room will leave behind
let V = null; // the scars drawn in the current room

function spent() {
  return here ? here.spent + (here.t0 != null ? performance.now() - here.t0 : 0) : 0;
}

function commit() {
  if (!here) return;
  const sec = spent() / 1000;
  const max = root.scrollHeight - innerHeight;
  const depth = max > 8 ? here.maxP : 1;
  // Passing through leaves nothing; reading does.
  if (sec < 3 && !(depth >= 0.3 && sec >= 1.2)) return;
  const k = KIND[here.grammar] || "halftone";
  let v = "";
  if (k === "halftone") {
    const col = document.getElementById("column");
    v = col?.classList.contains("scene-globe") ? "globe" : col?.classList.contains("scene-units") ? "units" : "curve";
  }
  const dm = here.damage.rooms?.[here.room] ?? 0;
  const m = load(here.escapes);
  push(m, {
    r: here.room, k, v, s: hash(`scar:${here.room}:${here.seq}`) >>> 0,
    w: f3(clamp01((0.34 + 0.42 * smooth(3, 40, sec) + 0.24 * depth) * (0.78 + 0.22 * dm))) * 1,
    p: f3(depth) * 1, dm: f3(dm) * 1, n: here.damage.voidRooms?.[71] || 0, t: here.text,
  });
  store(m);
}

document.addEventListener("visibilitychange", () => {
  if (!here) return;
  if (document.hidden) {
    if (here.t0 != null) here.spent += performance.now() - here.t0;
    here.t0 = null;
  } else if (here.t0 == null) here.t0 = performance.now();
});
addEventListener("pagehide", () => {
  commit();
  if (here) { here.spent = 0; here.t0 = performance.now(); }
});

/* ---------- hooks ---------- */

export function decorate(article, ctx) {
  const m = load(ctx.escapes);
  if (ctx.walk?.seeded && ctx.walk.log.length > 1 && m.seeded !== (ctx.walk.started || "seeded")) {
    seedFrom(m, ctx);
    store(m);
  }
  const grammar = root.dataset.grammar || "";
  here = {
    room: ctx.room, grammar, seq: ctx.chaos?.seq ?? 0, escapes: ctx.escapes, damage: ctx.damage,
    t0: document.hidden ? null : performance.now(), spent: 0, maxP: ctx.scrollP || 0,
    text: grammar === "mirror" ? sentence(article.querySelector(".prose")?.textContent) : "",
  };
  if (ctx.fresh) return;
  const list = m.list.filter((s) => s.r !== ctx.room && s.k).slice(0, SHOW);
  if (!list.length) return;
  // Strength comes from stored state only (never this visit's scroll), so a reload draws the same page.
  const gain = clamp01(0.6 + 0.06 * Math.min(4, ctx.damage.voids || 0) + 0.025 * list.length);
  V = { article, room: ctx.room, list, gain, dark: DARK.has(grammar), reduced: ctx.reduced, p: ctx.scrollP || 0, y: scrollY, v: 0, raf: 0, ro: null, aw: 0, t0: performance.now() };
  build(V);
  V.ro = new ResizeObserver(() => {
    if (!V) return;
    const A = article.getBoundingClientRect();
    // Rebuild when the width changes, or while the room is still settling just after entry
    // (fonts, plates); after that a growing room keeps its scars where they were drawn.
    const settling = performance.now() - V.t0 < 2500 && Math.abs(Math.max(innerHeight, A.height) - V.H) > V.H * 0.02;
    if (Math.round(A.width) !== V.aw || settling) { teardown(V); build(V); } else measure(V);
  });
  V.ro.observe(article);
}

export function update(ctx) {
  if (here && ctx.room === here.room) here.maxP = Math.max(here.maxP, ctx.scrollP || 0);
  if (!V || V.reduced) return;
  V.p = ctx.scrollP || 0;
  const y = scrollY;
  const dy = y - V.y;
  V.y = y;
  V.v += (Math.max(-1, Math.min(1, dy / 70)) - V.v) * 0.45;
  paint(V);
  if (!V.raf) V.raf = requestAnimationFrame(tick);
}

export function leave() {
  commit();
  here = null;
  if (!V) return;
  cancelAnimationFrame(V.raf);
  V.ro?.disconnect();
  teardown(V);
  V = null;
}

// The only loop: after the reader stops scrolling, slips settle back. It stops itself.
function tick() {
  if (!V) return;
  V.raf = 0;
  V.v *= 0.84;
  if (Math.abs(V.v) < 0.008) V.v = 0;
  paint(V);
  if (V.v) V.raf = requestAnimationFrame(tick);
}

/* ---------- drawing ---------- */

function el(tag, cls, parent, style) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (style) for (const [k, val] of Object.entries(style)) k.startsWith("--") ? e.style.setProperty(k, val) : (e.style[k] = val);
  parent?.append(e);
  return e;
}
function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, val] of Object.entries(attrs || {})) e.setAttribute(k, val);
  parent?.append(e);
  return e;
}

function geometry(V) {
  const A = V.article.getBoundingClientRect();
  const dash = document.getElementById("dash")?.getBoundingClientRect();
  V.mobile = mobileMQ.matches;
  V.aw = Math.round(A.width);
  V.H = Math.max(innerHeight, Math.round(A.height)); // positions are fixed at entry: a room that grows does not drag its scars
  V.ml = Math.max(0, Math.round(A.left));
  V.mr = Math.max(0, Math.round(innerWidth - A.right));
  V.gap = !V.mobile && dash && dash.left > A.right ? Math.round(dash.left - A.right) : V.mr;
  V.X0 = V.ml; // the text's left edge inside .sc-page
  V.X1 = V.ml + V.aw; // its right edge
}

function build(V) {
  geometry(V);
  V.page = el("div", "sc-page", null, { "--sc-ml": `${V.ml}px`, "--sc-mr": `${V.mr}px` });
  V.view = el("div", "sc-view");
  V.page.setAttribute("aria-hidden", "true");
  V.view.setAttribute("aria-hidden", "true");
  V.head = V.article.querySelector(".room-head");
  V.h1 = [];
  V.rule = [];
  V.moving = [];
  V.vars = []; // the few elements whose CSS reads --sc-v / --sc-p (never a whole layer)
  V.measured = [];
  V.classes = [];
  if (V.dark) { V.page.classList.add("sc-dark"); V.view.classList.add("sc-dark"); }
  V.list.forEach((s, i) => {
    const a = clamp01(V.gain * (s.w || 0.5) * (1 - 0.12 * i));
    const R = rng(hash(`${s.s}:${V.room}:${i}`));
    const reach = 0.3 + 0.7 * clamp01(s.p ?? 0.6);
    const y = (lo = 0.02) => `${Math.round(V.H * between(R, lo, Math.max(lo + 0.04, reach - 0.02)))}px`;
    DRAW[s.k]?.(V, s, a, R, y);
  });
  if (V.h1.length || V.rule.length) {
    V.classes.push("sc-h");
    V.head?.style.setProperty("--sc-h1", V.h1.join(", ") || "none");
    V.head?.style.setProperty("--sc-rule", V.rule.join(", ") || "none");
    if (V.head) V.vars.push(V.head);
  }
  V.article.classList.add(...V.classes);
  V.article.prepend(V.page);
  if (V.view.childElementCount) document.body.prepend(V.view);
  measure(V);
  if (V.reduced) { V.p = 1; V.v = 0; V.y = 0; }
  V.lastV = V.lastP = V.lastY = V.lastMV = undefined; // fresh elements: write everything once
  paint(V);
}

function teardown(V) {
  V.page?.remove();
  V.view?.remove();
  V.article.classList.remove(...(V.classes || []));
  if (V.head) for (const p of ["--sc-h1", "--sc-rule", "--sc-v", "--sc-p"]) V.head.style.removeProperty(p);
  for (const p of ["--sc-e1", "--sc-e2"]) V.article.style.removeProperty(p);
}

function paint(V) {
  const v = f2(V.v);
  const p = f2(V.p);
  if (v !== V.lastV || p !== V.lastP) {
    V.lastV = v;
    V.lastP = p;
    for (const t of V.vars) {
      if (!t) continue;
      t.style.setProperty("--sc-v", v);
      t.style.setProperty("--sc-p", p);
    }
  }
  if (V.y !== V.lastY || v !== V.lastMV) {
    V.lastY = V.y;
    V.lastMV = v;
    for (const fn of V.moving) fn(V);
  }
}

function measure(V) {
  if (!V.measured.length) return;
  const A = V.article.getBoundingClientRect();
  const boxes = V.measured.map((m) => m.targets.map((t) => (t?.isConnected ? t.getBoundingClientRect() : null)));
  V.measured.forEach((m, i) => m.place(boxes[i], A));
}

// The room's paragraphs, wherever its module has put them (report rooms nest them in sections).
const proseOf = (V) => [...V.article.querySelectorAll(".prose")].filter((p) => !p.closest(".cf, a, .sc-page"));

/* ---------- the scars ---------- */

const DRAW = {
  /** Report rooms: the column's halftone soaks through to the next pages. */
  halftone(V, s, a, R, y) {
    const n = 1 + (R() < 0.15 + 0.45 * (s.dm || 0) ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const size = Math.round((V.mobile ? 140 : 210) * between(R, 0.75, 1.2));
      const right = R() < 0.62;
      const cx = right ? (V.mobile ? V.X1 + 10 : V.X1 + V.gap * between(R, 0.3, 0.8)) : V.X0 - (V.mobile ? 6 : V.ml * between(R, 0.1, 0.6));
      const c = halftone(size, s.v || "curve", R, s.dm || 0);
      el("div", "sc-ht", V.page, { left: `${Math.round(cx - size / 2)}px`, top: y(0.04), width: `${size}px`, height: `${size}px`, marginTop: `${-size / 2}px`, opacity: f3(Math.min(0.62, 0.16 + a * 0.46)) }).append(c);
    }
  },

  /** 26: the page you left shows through, reversed, as if from the back of the sheet. */
  mirror(V, s, a, R, y) {
    const text = s.t || "The corpus was written by the corpus.";
    const bands = 1 + (R() < 0.3 + 0.5 * (s.dm || 0) ? 1 : 0);
    for (let i = 0; i < bands; i++) {
      const b = el("div", "sc-mirror", V.page, { left: `${V.X0 - 12}px`, width: `${V.aw + 24}px`, top: y(0.08), "--a": f3(a), "--k": f2(between(R, -1, 1)) });
      el("span", i % 2 ? "sc-mirror-t sc-flip-y" : "sc-mirror-t", b).textContent = `${text} ${text}`;
    }
  },

  /** 31: torn patches where the 1997 wallpaper is under the paper. */
  tile(V, s, a, R, y) {
    const n = 1 + (R() < 0.45 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const size = Math.round((V.mobile ? 84 : 160) * between(R, 0.8, 1.3));
      const left = i === 0 || R() < 0.5;
      const x = left ? V.X0 - size * between(R, 0.5, 0.7) : V.X1 + (V.mobile ? -size * 0.35 : V.gap * 0.5 - size * 0.5);
      const pts = [];
      const k = 15;
      for (let j = 0; j < k; j++) {
        const t = (j / k) * Math.PI * 2;
        const r = 0.5 * between(R, 0.62, 1);
        pts.push(`${f2(50 + 100 * r * Math.cos(t))}% ${f2(50 + 100 * r * Math.sin(t) * 0.86)}%`);
      }
      const w = el("div", "sc-tile", V.page, { left: `${Math.round(x)}px`, top: y(0.03), width: `${size}px`, height: `${size}px`, opacity: f3(Math.min(1, 0.35 + a * 0.75)) });
      el("div", "sc-tile-in", w, { clipPath: `polygon(${pts.join(",")})`, backgroundPosition: `${Math.round(R() * 84)}px ${Math.round(R() * 84)}px` });
    }
  },

  /** 11: the redactions stay behind as bars over nothing, in the gaps between paragraphs. */
  bars(V, s, a, R) {
    const P = proseOf(V);
    const reach = 0.3 + 0.7 * clamp01(s.p ?? 0.6);
    const gaps = P.filter((p, i) => i < Math.ceil(P.length * reach) && p.nextElementSibling);
    const pick = gaps.filter(() => R() < 0.6).slice(0, 2 + Math.round(3 * a));
    const alpha = f3(Math.min(0.95, 0.72 + a * 0.25));
    const h = V.mobile ? 9 : 11;
    if (!pick.length) {
      // A room with no gaps keeps them beside its heading instead.
      if (!V.head) return;
      for (let i = 0; i < 3; i++) {
        const bar = el("i", "sc-bar", V.page, { "--a": alpha });
        const w = V.mobile ? between(R, 6, 12) : between(R, 22, 48);
        const off = i * (V.mobile ? 13 : 16);
        V.measured.push({ targets: [V.head], place: ([b], A) => { if (!b) return; Object.assign(bar.style, { top: `${Math.round(b.top - A.top + 14 + off)}px`, left: `${Math.round(V.X0 - w - (V.mobile ? 3 : 10))}px`, width: `${Math.round(w)}px` }); } });
      }
      return;
    }
    for (const p of pick) {
      const frac = between(R, 0.22, 0.66);
      const indent = R() < 0.3 ? between(R, 0.05, 0.2) : 0;
      const bar = el("i", "sc-bar", V.page, { "--a": alpha });
      V.measured.push({
        targets: [p, p.nextElementSibling],
        place: ([b, n], A) => {
          const gap = b && n ? n.top - b.bottom : 0;
          if (gap < h + 6) { bar.style.display = "none"; return; }
          Object.assign(bar.style, { display: "", top: `${Math.round(b.bottom - A.top + (gap - h) / 2)}px`, height: `${h}px`, left: `${Math.round(V.X0 + V.aw * indent)}px`, width: `${Math.round(V.aw * frac)}px` });
        },
      });
    }
  },

  /** 38: the oscilloscope's trace runs across later pages, sweeping as you scroll. */
  trace(V, s, a, R) {
    const P = 1100;
    const H = V.mobile ? 70 : 96;
    const w = el("div", "sc-trace", V.view, { top: `${f2(between(R, 26, 72))}vh`, height: `${H}px`, "--a": f3(a) });
    const svg = svgEl("svg", { width: P * 2, height: H, viewBox: `0 0 ${P * 2} ${H}` }, w);
    const d = tracePath(R, P, H);
    svgEl("path", { d, class: "sc-trace-glow" }, svg);
    svgEl("path", { d, class: "sc-trace-line" }, svg);
    let ticks = "";
    for (let x = 0; x <= P * 2; x += 55) ticks += `M${x} ${H / 2 - 3}v6`;
    svgEl("path", { d: ticks, class: "sc-trace-tick" }, svg);
    const speed = between(R, 0.5, 0.9);
    const off = R() * P;
    V.moving.push((V) => { svg.style.transform = `translate3d(${-((off + (V.reduced ? 0 : V.y * speed)) % P).toFixed(1)}px,0,0)`; });
  },

  /** 44: the well's rings, pressed into the paper and narrowing as you go down. */
  well(V, s, a, R, y) {
    const size = V.mobile ? 300 : 560;
    const left = R() < 0.55;
    const x = left ? V.X0 - size * between(R, 0.66, 0.78) : V.X1 + (V.mobile ? -size * 0.25 : V.gap - size * 0.3);
    const w = el("div", "sc-well", V.page, { left: `${Math.round(x)}px`, top: y(0.02), width: `${size}px`, height: `${size}px`, marginTop: `${-size / 3}px`, "--a": f3(a) });
    const svg = svgEl("svg", { viewBox: "-100 -100 200 200", width: size, height: size }, w);
    V.vars.push(svg);
    const g = svgEl("g", {}, svg);
    for (let k = 0; k < 10; k++) {
      const r = 98 * Math.pow(0.8, k);
      svgEl("circle", { r: f2(r), "stroke-width": f2(k % 3 ? 0.6 : 1.2), "stroke-opacity": f2(0.35 + 0.065 * k) }, g);
    }
    svgEl("circle", { r: 2.4, class: "sc-well-coin" }, g);
  },

  /** 71: the void's black edge comes in from the margin, further the further you read. */
  edge(V, s, a, R) {
    const right = V.mobile && R() < 0.4;
    const room = right ? V.mr : V.ml;
    const W = Math.max(5, Math.min(V.mobile ? 13 : 96, room - 6));
    const base = 0.3 + 0.1 * Math.min(5, s.n || 1);
    const w = el("div", `sc-edge${right ? " sc-edge-r" : ""}`, V.view, { width: `${W}px`, "--b": f3(Math.min(0.85, base)), "--c": f3(1 - Math.min(0.85, base)), opacity: f3(Math.min(1, 0.75 + a * 0.4)) });
    V.vars.push(w);
    const svg = svgEl("svg", { viewBox: `0 0 100 1000`, preserveAspectRatio: "none", width: "100%", height: "100%" }, w);
    let d = "M0 0";
    let yy = 0;
    while (yy < 1000) {
      d += ` L${f2(between(R, 45, 100))} ${f2(yy)}`;
      yy += between(R, 6, 28);
    }
    d += " L0 1000 Z";
    svgEl("path", { d, class: "sc-edge-fill" }, svg);
    for (let i = 0; i < 7; i++) svgEl("rect", { x: f2(between(R, 60, 140)), y: f2(R() * 1000), width: f2(between(R, 4, 12)), height: f2(between(R, 2, 5)), class: "sc-edge-fill" }, svg);
  },

  /** 45: printer's crop marks around an empty place, and the rules go missing. */
  crop(V, s, a, R, y) {
    const w = Math.round(V.mobile ? V.aw * 0.6 : between(R, 220, 380));
    const h = Math.round(w * between(R, 0.45, 0.8));
    const x = V.mobile ? V.X0 + V.aw * 0.2 : V.X0 + between(R, 0.15, 0.55) * (V.aw - w);
    el("div", "sc-crop", V.page, { left: `${Math.round(x)}px`, top: y(0.06), width: `${w}px`, height: `${h}px`, "--a": f3(a) });
    const e1 = between(R, 10, 40);
    V.article.style.setProperty("--sc-e1", `${f2(e1)}%`);
    V.article.style.setProperty("--sc-e2", `${f2(e1 + between(R, 18, 44))}%`);
    V.classes.push("sc-erase");
  },

  /** 17: it was filed once: punch holes down the margin and a staple at the corner. */
  punch(V, s, a, R) {
    const r = V.mobile ? 5.5 : 9;
    const cx = V.mobile ? Math.max(r + 1, V.ml / 2) : V.ml * 0.48;
    const step = V.mobile ? 260 : 330;
    const top0 = between(R, 90, 160);
    const reach = 0.3 + 0.7 * clamp01(s.p ?? 0.6);
    const alpha = f3(Math.min(1, 0.4 + a * 0.6));
    for (let i = 0; i < 2; i++) el("i", "sc-hole", V.page, { left: `${Math.round(cx - r)}px`, top: `${Math.round(top0 + i * step)}px`, width: `${r * 2}px`, height: `${r * 2}px`, "--a": alpha });
    // a second sheet's holes lower down
    el("i", "sc-hole", V.page, { left: `${Math.round(cx - r + between(R, -2, 2))}px`, top: `${Math.round(V.H * between(R, 0.35, Math.max(0.4, reach)))}px`, width: `${r * 2}px`, height: `${r * 2}px`, "--a": alpha });
    el("i", "sc-staple", V.page, { left: `${Math.round(V.X0 - (V.mobile ? 10 : 26))}px`, top: `${Math.round(between(R, 18, 34))}px`, "--a": alpha, rotate: `${f2(between(R, -38, -22))}deg` });
  },

  /** 52: thumb-index notches cut into the fore-edge, stepping down the page. */
  notch(V, s, a, R, y) {
    const n = 3 + Math.round(2 * a);
    const h = V.mobile ? 34 : 46;
    const wN = V.mobile ? 9 : 18;
    const x = V.mobile ? V.X1 + V.mr - wN : V.X1 + Math.max(4, Math.min(30, V.gap - wN - 16));
    const start = between(R, 4, 14);
    const stepPct = between(R, 2.2, 5.5) * (0.4 + 0.6 * clamp01(s.p ?? 0.6));
    const alpha = f3(Math.min(0.9, 0.35 + a * 0.55));
    for (let i = 0; i < n; i++) el("i", "sc-notch", V.page, { left: `${Math.round(x)}px`, top: `${Math.round((V.H * (start + i * stepPct)) / 100)}px`, width: `${wN + 6}px`, height: `${h}px`, "--a": alpha });
  },

  /** 2054: an afterimage of the heading, lagging when you move. */
  after(V, s, a, R) {
    const dx = between(R, 8, 18) * (R() < 0.5 ? -1 : 1);
    const dy = between(R, 5, 12);
    V.h1.push(`calc(${f2(dx)}px + var(--sc-v) * 10px) calc(${f2(dy)}px + var(--sc-v) * 26px) 7px rgba(0, 150, 168, ${f3(0.16 + a * 0.24)})`);
    V.rule.push(`${f2(dx * 0.6)}px ${f2(dy + 4)}px 3px rgba(0, 150, 168, ${f3(0.1 + a * 0.2)})`);
    const size = V.mobile ? 220 : 420;
    el("div", "sc-glow", V.page, { left: `${Math.round(V.X0 + between(R, 0, 0.5) * V.aw)}px`, top: `${Math.round(between(R, 20, 120))}px`, width: `${size}px`, height: `${Math.round(size * 0.55)}px`, "--a": f3(a) });
  },

  /** 53: night gathers at the foot of later pages as you scroll toward it. */
  dusk(V, s, a) {
    V.vars.push(el("div", "sc-dusk", V.view, { "--a": f3(a) }));
  },

  /** 33: the corridor's vanishing lines; door frames come toward you as you scroll. */
  corridor(V, s, a, R) {
    const vx = between(R, 34, 66);
    const vy = between(R, 30, 52);
    const w = el("div", "sc-corr", V.view, { "--a": f3(a) });
    const svg = svgEl("svg", { viewBox: "0 0 100 100", preserveAspectRatio: "none", width: "100%", height: "100%" }, w);
    let rays = "";
    for (const [x, yy] of [[0, 0], [100, 0], [0, 100], [100, 100], [0, between(R, 30, 70)], [100, between(R, 30, 70)], [between(R, 20, 80), 100], [between(R, 20, 80), 0]]) rays += `M${f2(x)} ${f2(yy)}L${f2(vx)} ${f2(vy)}`;
    svgEl("path", { d: rays, class: "sc-corr-ray" }, svg);
    // Frames are plain boxes scaled about the vanishing point on the compositor (no SVG repaint per frame).
    const frames = [0, 1, 2, 3].map(() => el("i", "sc-corr-frame", w, { transformOrigin: `${f2(vx)}% ${f2(vy)}%` }));
    const off = R();
    V.moving.push((V) => {
      const ph = off + (V.reduced ? 0.35 : V.y / 1400);
      frames.forEach((fr, k) => {
        const t = (((ph + k / frames.length) % 1) + 1) % 1;
        fr.style.transform = `scale(${f3(0.06 + 0.94 * t * t)})`;
        fr.style.opacity = f3(Math.sin(Math.PI * t));
      });
    });
  },

  /** 36: a volvelle half outside the page, turning as you read. */
  wheel(V, s, a, R) {
    const size = Math.round(Math.min(V.mobile ? 330 : 680, Math.min(innerWidth, innerHeight) * 0.9));
    const left = !V.mobile || R() < 0.6;
    const w = el("div", `sc-wheel${left ? "" : " sc-wheel-r"}`, V.view, { width: `${size}px`, height: `${size}px`, top: `${f2(between(R, 8, 52))}vh`, "--a": f3(a), "--off": `${Math.round(-size * (V.mobile ? 0.7 : 0.62))}px` });
    const svg = svgEl("svg", { viewBox: "-100 -100 200 200", width: "100%", height: "100%" }, w);
    const g = svgEl("g", {}, svg);
    svg.classList.add("sc-wheel-svg");
    for (const r of [98, 80, 62, 44]) svgEl("circle", { r, class: "sc-wheel-ring" }, g);
    let ticks = "";
    for (let i = 0; i < 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      const r0 = i % 4 ? 93 : 86;
      ticks += `M${f2(98 * Math.cos(t))} ${f2(98 * Math.sin(t))}L${f2(r0 * Math.cos(t))} ${f2(r0 * Math.sin(t))}`;
    }
    for (let i = 0; i < 18; i++) {
      const t = (i / 18) * Math.PI * 2;
      ticks += `M${f2(80 * Math.cos(t))} ${f2(80 * Math.sin(t))}L${f2(44 * Math.cos(t))} ${f2(44 * Math.sin(t))}`;
    }
    svgEl("path", { d: ticks, class: "sc-wheel-ring" }, g);
    "BCDEFGHIKBCDEFGHIK".split("").forEach((ch, i) => {
      const t = ((i + 0.5) / 18) * Math.PI * 2;
      const tx = svgEl("text", { x: f2(71 * Math.cos(t)), y: f2(71 * Math.sin(t) + 3), class: "sc-wheel-l" }, g);
      tx.textContent = ch;
    });
    const speed = between(R, 0.02, 0.045) * (R() < 0.5 ? -1 : 1);
    const off = R() * 360;
    V.moving.push((V) => { svg.style.transform = `rotate(${f2(off + (V.reduced ? 0 : V.y * speed))}deg)`; });
  },

  /** 64: the registry's ledger ruling shows behind a stretch of the text. */
  ledger(V, s, a, R, y) {
    el("div", "sc-ledger", V.page, { left: `${V.X0 - (V.mobile ? 12 : 30)}px`, width: `${V.aw + (V.mobile ? 24 : 30 + Math.min(V.gap, 40))}px`, top: y(0.04), height: `${Math.round((V.H * between(R, 16, 34)) / 100)}px`, "--a": f3(a), "--m": `${V.mobile ? 6 : 18}px`, backgroundPositionY: `${Math.round(R() * 30)}px` });
  },

  /** 81: revision bars down the margin beside the paragraphs that were redrafted. */
  change(V, s, a, R) {
    const P = proseOf(V);
    const reach = 0.3 + 0.7 * clamp01(s.p ?? 0.6);
    const pick = P.filter((p, i) => i < Math.ceil(P.length * reach) && R() < 0.5).slice(0, 9);
    const alpha = f3(Math.min(0.9, 0.4 + a * 0.55));
    const off = V.mobile ? 9 : 18;
    for (const p of pick) {
      const dbl = R() < 0.3;
      const bar = el("i", `sc-cb${dbl ? " sc-cb-2" : ""}`, V.page, { "--a": alpha });
      const t0 = R() < 0.4 ? between(R, 0, 0.4) : 0;
      const t1 = R() < 0.4 ? between(R, 0.6, 1) : 1;
      V.measured.push({
        targets: [p],
        place: ([b], A) => {
          if (!b) return;
          Object.assign(bar.style, { top: `${Math.round(b.top - A.top + b.height * t0)}px`, height: `${Math.max(12, Math.round(b.height * (t1 - t0)))}px`, left: `${V.X0 - off}px` });
        },
      });
    }
  },

  /** 88: the page was folded: a crease across it and a corner turned down. */
  crease(V, s, a, R, y) {
    const n = 1 + (R() < 0.35 + 0.4 * (s.dm || 0) ? 1 : 0);
    for (let i = 0; i < n; i++) el("div", "sc-crease", V.page, { top: y(0.12), rotate: `${f2(between(R, -1.6, 1.6))}deg`, "--a": f3(a) });
    const ear = V.mobile ? 26 : 44;
    el("div", "sc-ear", V.page, { left: `${Math.max(0, V.X0 - ear - (V.mobile ? -6 : 8))}px`, top: `${Math.round(between(R, 8, 40))}px`, width: `${ear}px`, height: `${ear}px`, "--a": f3(a) });
  },

  /** 40: printed out of register; a scan band that only shows while the page moves. */
  slip(V, s, a, R) {
    const dx = between(R, 1.2, 2.6) * (R() < 0.5 ? -1 : 1);
    V.h1.push(`calc(${f2(dx)}px + var(--sc-v) * 7px) calc(${f2(between(R, -0.8, 0.8))}px) 0 rgba(180, 18, 27, ${f3(0.28 + a * 0.3)})`);
    V.h1.push(`calc(${f2(-dx * 0.7)}px - var(--sc-v) * 4px) 0 0 rgba(0, 140, 170, ${f3(0.16 + a * 0.2)})`);
    V.rule.push(`calc(${f2(dx * 2)}px + var(--sc-v) * 12px) 3px 0 rgba(180, 18, 27, ${f3(0.25 + a * 0.35)})`);
    const band = el("div", "sc-scan", V.view, { height: `${Math.round(between(R, 40, 90))}px`, "--a": f3(a) });
    const off = R() * innerHeight;
    V.moving.push((V) => {
      const H = innerHeight + 120;
      const t = (((off + (V.reduced ? 0 : V.y * 1.6)) % H) + H) % H - 60;
      band.style.transform = `translate3d(0,${t.toFixed(0)}px,0)`;
      band.style.opacity = f3(V.reduced ? 0.45 : 0.18 + 0.82 * Math.min(1, Math.abs(V.v) * 1.6));
    });
  },

  /** 48: a dirty copier drum leaves a streak; the manila folder shows at the edge. */
  streak(V, s, a, R) {
    const inMargin = R() < 0.55;
    const x = inMargin ? between(R, 0.15, 0.75) * Math.max(4, V.ml - 6) : V.ml + between(R, 0.1, 0.9) * V.aw;
    el("div", "sc-streak", V.view, { left: `${Math.round(x)}px`, width: `${Math.round(between(R, 3, 8))}px`, "--a": f3(a * (inMargin ? 1 : 0.6)), backgroundPositionY: `${Math.round(R() * 200)}px` });
    el("div", "sc-manila", V.page, { width: `${V.mobile ? 7 : 14}px`, "--a": f3(a) });
  },
};

/* ---------- halftone (static canvas, drawn once) ---------- */

function halftone(size, scene, R, heat) {
  const c = document.createElement("canvas");
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = c.height = Math.round(size * dpr);
  c.style.width = c.style.height = `${size}px`;
  const g = c.getContext("2d");
  g.scale(dpr, dpr);
  const S = size;
  const crimson = "rgb(180,18,27)";
  if (scene === "units") {
    // the unit chart: rings are people, filled dots are the other workforce
    const u = S > 200 ? 11 : 8;
    const rr = u * 0.3;
    for (let y = u / 2; y < S; y += u) {
      for (let x = u / 2; x < S; x += u) {
        if (R() < 0.12) continue;
        g.beginPath();
        g.arc(x, y, rr, 0, Math.PI * 2);
        if (R() < 0.18 + 0.3 * heat) { g.fillStyle = crimson; g.fill(); } else { g.strokeStyle = "rgba(17,17,17,0.75)"; g.lineWidth = 0.9; g.stroke(); }
      }
    }
  } else {
    const pitch = S > 200 ? 6 : 5;
    const blobs = [0, 1, 2].map(() => ({ x: S * between(R, 0.3, 0.7), y: S * between(R, 0.3, 0.7), s: S * between(R, 0.16, 0.3) }));
    const gx = S / 2, gy = S / 2, gr = S * 0.36;
    const L = [-0.55, -0.5, 0.67];
    g.fillStyle = crimson;
    for (let y = pitch / 2; y < S; y += pitch) {
      for (let x = pitch / 2; x < S; x += pitch) {
        let D;
        if (scene === "globe") {
          const nx = (x - gx) / gr, ny = (y - gy) / gr, q = nx * nx + ny * ny;
          if (q >= 1) continue;
          const nz = Math.sqrt(1 - q);
          D = 0.12 + 0.88 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        } else {
          D = 0;
          for (const b of blobs) D += Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (2 * b.s * b.s));
          D = D * (0.58 + 0.25 * heat) - 0.16 + (R() - 0.5) * 0.14;
        }
        if (D <= 0.04) continue;
        g.beginPath();
        g.arc(x, y, pitch * 0.55 * Math.sqrt(Math.min(1, D)), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.strokeStyle = crimson;
    if (scene === "globe") {
      g.globalAlpha = 0.55;
      g.lineWidth = 0.8;
      for (const k of [0.35, 0.7]) { g.beginPath(); g.ellipse(gx, gy, gr * k, gr, 0, 0, Math.PI * 2); g.stroke(); }
      for (const k of [-0.5, 0, 0.5]) { g.beginPath(); g.ellipse(gx, gy + gr * k, gr * Math.sqrt(1 - k * k), gr * 0.12, 0, 0, Math.PI * 2); g.stroke(); }
      g.globalAlpha = 1;
    } else {
      // the capability curve, still running through the stain
      g.lineWidth = 1.6;
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const x = S * (0.08 + 0.84 * t);
        const y = S * (0.82 - 0.7 * Math.pow(t, 2.6));
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
  }
  // soak: the stain fades out at its edges
  g.globalCompositeOperation = "destination-in";
  const fade = g.createRadialGradient(S / 2, S / 2, S * 0.12, S / 2, S / 2, S / 2);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(0.7, "rgba(0,0,0,0.75)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = fade;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = "source-over";
  return c;
}

/** A trace that loops every P px: quiet runs, bursts and sharp strokes (CH1 reading a walk). */
function tracePath(R, P, H) {
  const mid = H / 2;
  const pts = [[0, mid]];
  let x = 0;
  while (x < P - 60) {
    const k = R();
    if (k < 0.42) {
      const len = between(R, 40, 140);
      for (let j = 8; j <= len; j += 8) pts.push([x + j, mid + (R() - 0.5) * 2.2]);
      x += len;
    } else if (k < 0.8) {
      const cyc = 2 + Math.floor(R() * 4);
      const wl = between(R, 9, 22);
      const amp = between(R, 0.15, 0.42) * H;
      const L = cyc * wl;
      for (let j = 2; j <= L; j += 2) pts.push([x + j, mid - Math.sin((j / wl) * Math.PI * 2) * amp * Math.sin((Math.PI * j) / L)]);
      x += L;
    } else {
      const w = between(R, 5, 12);
      const h = (R() - 0.5) * H * 0.8;
      pts.push([x + 1, mid - h], [x + w, mid - h], [x + w + 1, mid]);
      x += w + 6;
    }
  }
  pts.push([P, mid]);
  const one = (o) => pts.map(([px, py], i) => `${i ? "L" : "M"}${f2(px + o)} ${f2(py)}`).join("");
  return one(0) + one(P).replace(/^M/, "L");
}
