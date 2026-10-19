// Scroll rooms 16, 18, 19, 21 (owner: the scroll-rooms designer).
// Hooks called by house.js as the room's module: decorate(article, ctx), update(ctx), leave().
// They wrap early.js, so the rooms' report blocks, plan names, notes and column behave as in
// every report room, and then add the room's set piece where its report has `{ list: { cls: "sx-mount" } }`.
//
// A set piece is a sticky figure with the room's dated steps read beneath it in ordinary flow.
// The figure's state is a number (a month, a zoom, a row) interpolated between the steps
// whose middles cross the reading line, so the chart and the paragraph being read agree.
// The column's date chip follows the figure while it is read, and the report's dated
// subsections (`when`) elsewhere. They escalate:
//   16 · Mar 2044 · The Scorecard     the 2041 forecast scored: a cursor scrubs 2041→2047, each
//                                     forecast ring gets its observed dot, the correction goes vertical.
//                                     Loud: the dots arrive a little before the cursor does.
//   18 · Jan 2045 · The Fourth Rebase the index rebased while you read: the axis keeps zooming out
//                                     (old 100s fall to the floor), time keeps zooming in toward
//                                     09:00 on the 14th, and the curve never leaves the corner.
//                                     Loud: the plan the reader came in by slides down to the floor.
//   19 · Nov 2046 · In Advance        vertical scroll moves sideways through the archive's months,
//                                     past the present into folders already filed; under them the
//                                     two question lines cross. Loud: their labels stop following
//                                     them, and a folder holds the reader's visit.
//   21 · Jun 2047 · The Schedule      the day's sheet runs past a red rule as you read; items about
//                                     the report are done as they are read. Loud: those rows run
//                                     ahead, carry the reader's clock, and (damaged) name who.
//
// Fresh / quiet: the same set pieces, sober. Reduced motion: no sticky figure and no tween;
// static figures at chosen states (18: three, the others: their end state), then the steps.
// Keyboard paging: while a figure is stuck, html gets scroll-padding-top equal to its height,
// so Space/PageDown never page text out from under it.
//
// Cost: one rAF for the module, run only while the figure is on screen (IntersectionObserver)
// and the shown state is easing toward the scroll's; it stops when settled. Geometry is cached
// (re-measured on resize and on the room's ResizeObserver). Static SVG is built once per width;
// frames only write transforms, a few attributes and changed text nodes.
//
// Memory: localStorage `ai2053.house.scroll` = { escapes, reached: { room: times the end of its
// figure was reached } }. It only grows; 18 gets one nine nearer its rebase each time.
import * as early from "./early.js";
import { cue, quiet, monthIndex } from "./column.js";
import { DIST } from "./rooms.js";
import { prose, hash } from "./voice.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const attr = (s) => esc(s).replace(/'/g, "&#39;");
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mLabel = (m) => {
  const r = Math.round(m);
  return `${MON[((r % 12) + 12) % 12]} ${2041 + Math.floor(r / 12)}`;
};
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Write an attribute, style or text only when it changes. */
function setA(el, k, v) {
  const c = (el._sx ||= {});
  if (c[k] === v) return;
  c[k] = v;
  el.setAttribute(k, v);
}
function setT(el, v) {
  if (el._sxt === v) return;
  el._sxt = v;
  el.textContent = v;
}
function setS(el, k, v) {
  const c = (el._sxs ||= {});
  if (c[k] === v) return;
  c[k] = v;
  el.style.setProperty(k, v);
}
const fragAttrs = (kind, id, text, data) =>
  ` data-frag="${kind}" data-frag-id="${attr(id)}" data-frag-text="${attr(clip(text, 138))}"${data ? ` data-frag-data='${attr(JSON.stringify(data))}'` : ""}`;
let uid = 0;

/* ---------- memory ---------- */

const MEM_KEY = "ai2053.house.scroll";
function memory(ctx) {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(MEM_KEY)); } catch { m = null; }
  if (!m || m.escapes !== ctx.escapes) m = { escapes: ctx.escapes, reached: {} };
  m.reached ||= {};
  return m;
}
function remember(m) {
  try { localStorage.setItem(MEM_KEY, JSON.stringify(m)); } catch { /* storage unavailable */ }
}

/** The words on the plan that brought the reader into this room, if a plan did. */
function cameBy(ctx) {
  const log = ctx.walk?.log ?? [];
  for (let i = log.length - 1; i >= 0; i--) {
    const s = log[i];
    if (s.room === ctx.room && s.via === "door" && s.say) return clip(String(s.say), 64);
    if (s.room === ctx.room) break;
  }
  return null;
}
const fill = (t, vars) => t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const fits = (t, vars) => [...t.matchAll(/\{(\w+)\}/g)].every(([, k]) => vars[k] != null);

/* ======================================================================= */
/* the engine                                                              */
/* ======================================================================= */

let cur = null;

export function decorate(article, ctx) {
  early.decorate(article, ctx);
  const make = SETS[ctx.room];
  const mount = article.querySelector(".report > ol.sx-mount");
  if (!make || !mount || !ctx.R.track) {
    mount?.remove();
    return;
  }
  cur = run(article, ctx, mount, make);
}

export function update(ctx) {
  early.update(ctx);
  cur?.update(ctx);
}

export function leave() {
  cur?.leave();
  cur = null;
  early.leave();
}

function run(article, ctx, mount, make) {
  const R = ctx.R;
  const T = R.track;
  const room = ctx.room;
  const calm = quiet(ctx);
  const mem = memory(ctx);
  const say = cameBy(ctx);
  const env = { ctx, room, T, calm, loud: !calm, heat: clamp(ctx.entryD), damaged: ctx.damage.voids > 0 || ctx.entryD >= 0.5, say, mem };
  const set = make(env);
  const vars = { say, ...(set.vars || {}) };
  const steps = T.steps.filter((s) => !s.if || (s.if === "loud" ? !calm : calm));
  const vals = steps.map((s) => set.val(s));
  const v0 = vals[0];
  const vEnd = vals[vals.length - 1];
  const reduced = ctx.reduced;

  const stepHTML = steps.map((s, i) => {
    const text = fill(!calm && s.loud && fits(s.loud, vars) ? s.loud : s.t, vars);
    const dv = clamp(ctx.entryD + Math.min(0.12, 0.012 * (i + 2)));
    const first = text.replace(/\^\d+/g, "").match(/^[^.!?]+[.!?]+/)?.[0] ?? "";
    const frag = i % 3 === 1 && first.length > 24 ? fragAttrs("line", `${room}:x${i}`, first.trim()) : "";
    return `<li class="sx-step"><p class="sx-k">${esc(s.k)}</p><p class="sx-t"${frag}>${prose(text, dv, hash(`${room}:x${i}`), { path: [], room })}</p></li>`;
  }).join("");

  const stills = reduced ? set.stills ?? [vEnd] : [null];
  const insts = stills.map((v, i) => set.inst({ still: reduced, at: v, first: i === 0 }));
  const cap = (i) => `<figcaption class="sx-cap"><span class="rt-n">${esc(T.n)}${reduced && stills.length > 1 ? String.fromCharCode(97 + i) : ""}</span> ${esc(T.cap)}${i === 0 ? `<span class="sx-slot" data-slot="label figure number stamp"></span>` : ""}</figcaption>`;
  const sec = document.createElement("section");
  sec.className = `sx-track sx-r${room}${reduced ? " sx-static" : ""}${calm ? "" : " sx-loud"}`;
  sec.setAttribute("aria-label", `${T.n}. ${T.cap}`);
  sec.innerHTML = `${insts.map((it, i) => `<figure class="sx-stage">${cap(i)}${it.html}</figure>`).join("")}<ol class="sx-steps">${stepHTML}</ol>`;
  mount.replaceWith(sec);
  const stages = [...sec.querySelectorAll(".sx-stage")];
  insts.forEach((it, i) => it.bind(stages[i]));
  const stage = stages[0];
  const stepEls = [...sec.querySelectorAll(".sx-step")];

  // The report's dated subsections drive the column's chip outside the figure.
  const hb = (R.report || []).filter((b) => b.h);
  const heads = [...article.querySelectorAll(".report > h2.sec")].map((el, i) => ({
    el, top: 0, mi: hb[i]?.when ? monthIndex(hb[i].when) : null, scene: hb[i]?.scene || "",
  }));

  const geo = { W: 0, vh: 0, scTop: -1, top: 0, bottom: 0, stageH: 0, read: 0, mids: [] };
  const root = document.documentElement;
  const padWas = root.style.scrollPaddingTop;
  let padOn = false;
  let measured = false;
  let visible = true;
  let target = v0;
  let shown = null;
  let raf = 0;
  let last = ctx;
  let entered = false;
  let ended = false;
  let alive = true;
  const eps = Math.max(1e-4, Math.abs(vEnd - v0) * 0.0004);

  const measure = () => {
    measured = true;
    const y = scrollY;
    const vh = innerHeight;
    const dash = document.getElementById("dash");
    const mobile = !!last.mobile;
    const scTop = !reduced && mobile && dash && getComputedStyle(dash).position === "sticky" ? Math.round(dash.getBoundingClientRect().height) : 0;
    if (scTop !== geo.scTop) {
      geo.scTop = scTop;
      sec.style.setProperty("--sx-top", `${scTop}px`);
    }
    const W = Math.round(stage.clientWidth);
    if (W && (W !== geo.W || vh !== geo.vh)) {
      geo.W = W;
      geo.vh = vh;
      insts.forEach((it, i) => {
        it.layout(W, vh);
        if (reduced) it.paint(stills[i]);
      });
      shown = null;
    }
    const r = sec.getBoundingClientRect();
    geo.top = r.top + y;
    geo.bottom = r.bottom + y;
    geo.stageH = reduced ? 0 : stage.offsetHeight;
    geo.mids = stepEls.map((el) => {
      const b = el.getBoundingClientRect();
      return b.top + y + Math.min(b.height, vh * 0.3) / 2;
    });
    for (const h of heads) h.top = h.el.getBoundingClientRect().top + y;
    geo.read = reduced ? vh * 0.5 : scTop + geo.stageH + (vh - scTop - geo.stageH) * 0.42;
  };

  const valueAt = (p) => {
    const M = geo.mids;
    if (!M.length || p <= M[0]) return vals[0];
    for (let i = 0; i < M.length - 1; i++) {
      if (p < M[i + 1]) return lerp(vals[i], vals[i + 1], smooth(0.1, 0.9, (p - M[i]) / (M[i + 1] - M[i] || 1)));
    }
    return vEnd;
  };

  const tick = () => {
    raf = 0;
    if (!alive) return;
    const next = shown == null || Math.abs(target - shown) < eps ? target : lerp(shown, target, 0.2);
    if (next === shown) return;
    shown = next;
    insts[0].paint(shown);
    if (shown !== target && visible && !document.hidden) raf = requestAnimationFrame(tick);
  };

  const upd = (c) => {
    if (!alive) return;
    last = c;
    if (!measured) measure();
    const y = scrollY;
    const vh = innerHeight;
    const p = y + geo.read;
    target = valueAt(p);

    // the column's date chip: the figure's month while it is read, else the dated subsection
    const inside = p >= geo.top && p <= geo.bottom;
    let mi = -1;
    let scene = "";
    let sceneP = 0;
    if (inside && set.month) mi = set.month(target);
    else {
      const line = y + vh * 0.42;
      for (let i = 0; i < heads.length; i++) {
        if (heads[i].top > line) break;
        if (heads[i].mi != null) mi = heads[i].mi;
        scene = heads[i].scene;
        const end = heads[i + 1]?.top ?? geo.bottom;
        sceneP = end > heads[i].top ? (line - heads[i].top) / (end - heads[i].top) : 1;
      }
    }
    cue("month", mi);
    cue("scene", scene);
    if (scene) cue("sceneP", sceneP);

    // keyboard paging: never page text out from under the stuck figure. Armed a screen early,
    // so the press that brings the figure to the top does not carry text under it either.
    if (!reduced) {
      const armed = y >= geo.top - geo.scTop - vh * 0.9 && y <= geo.bottom - geo.stageH - geo.scTop;
      if (armed !== padOn) {
        padOn = armed;
        root.style.scrollPaddingTop = armed ? `${geo.scTop + geo.stageH}px` : padWas;
      }
    }

    // the end of the figure is an event (only for a reader who read toward it)
    if (target < vEnd - Math.abs(vEnd - v0) * 0.2) entered = true;
    if (!ended && entered && Math.abs(vEnd - target) <= eps * 4) {
      ended = true;
      mem.reached[room] = (mem.reached[room] || 0) + 1;
      remember(mem);
      const f = set.end?.();
      if (f) c.emit?.(f);
    }

    if (reduced || !visible) return;
    if (target !== shown && !raf) raf = requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver((es) => {
    for (const e of es) visible = e.isIntersecting;
    if (visible) upd(last);
  }, { rootMargin: "120px 0px" });
  io.observe(sec);
  const ro = new ResizeObserver(() => {
    measured = false;
    if (alive) upd(last);
  });
  ro.observe(article);
  // ET Book can arrive after the first layout; measure again once it has
  document.fonts?.ready.then(() => {
    if (!alive) return;
    measured = false;
    upd(last);
  });

  return {
    update: upd,
    leave() {
      alive = false;
      cancelAnimationFrame(raf);
      raf = 0;
      io.disconnect();
      ro.disconnect();
      if (padOn) root.style.scrollPaddingTop = padWas;
      cue("month", -1);
      cue("scene", "");
    },
  };
}

/* ======================================================================= */
/* 16 · The Scorecard                                                      */
/* ======================================================================= */

// Rows in the order they came true. f: forecast month, o: observed month (null: not yet).
const L16 = [
  ["Tests > 15,000", "Oct 2043", "Aug 2042"],
  ["Income < $57K", "May 2045", "Oct 2042"],
  ["10M instances", "Dec 2044", "Dec 2042"],
  ["Billable > 50%", "Aug 2044", "Jan 2043"],
  ["Oversight < 1 h", "Jan 2046", "Sep 2043"],
  ["Writes successor", "May 2047", "Jan 2044"],
  ["Suite C ≠ 50%", "Jan 2045", null],
].map(([k, f, o]) => ({ k, f: monthIndex(f), o: o ? monthIndex(o) : null }));
const TODAY16 = monthIndex("Mar 2044");
const END16 = monthIndex("Dec 2047");
const LOG16 = 1.7; // decades of index on the panel
const idx16 = (m, K) => Math.log10(Math.pow(Math.max(1e-4, 1 - m / K), -2));

function scorecard(env) {
  const N = env.ctx.walk.log.filter((s) => s.via === "door").length;
  const fc = DIST[16] ?? 4;
  return {
    val: (s) => monthIndex(s.at),
    month: (v) => clamp(Math.round(v), 0, END16),
    end: () => ({ kind: "curve", id: "16:observed", text: "Observed, against the forecast of 2041", data: { points: [0, 0.08, 0.18, 0.3, 0.45, 0.61] } }),
    inst(opt) {
      const id = `sx16-${++uid}`;
      const plans = env.loud ? `<div><dt>Plans to this page</dt><dd>${fc} forecast · ${N} observed</dd></div>` : "";
      const legend = `<p class="sx-legend"><span class="sx-lg sx-lg-o">Observed</span><span class="sx-lg sx-lg-f">Forecast, Jan 2041</span><span class="sx-lg sx-lg-c">Corrected</span><span class="sx-lg sx-lg-r">Forecast date</span><span class="sx-lg sx-lg-d">Observed date</span></p>`;
      const html = `${legend}<svg class="sx-svg" role="img" aria-label="Seven forecast lines of January 2041 against the dates they were observed; six came true early and one is not yet observed."></svg>
        <dl class="sx-read"${opt.first ? fragAttrs("figure", "16:scored", "Forecast lines come true early", { value: "6 of 7" }) : ""}>
          <div><dt>Scored</dt><dd data-r="n">0 of 7</dd></div><div><dt>Early</dt><dd data-r="e">0</dd></div><div><dt>Late</dt><dd>0</dd></div><div><dt>Median score</dt><dd data-r="m">—</dd></div>${plans}
        </dl>`;
      let svg, g = null;
      const el = {};
      return {
        html,
        bind(fig) {
          svg = fig.querySelector("svg");
          el.n = fig.querySelector('[data-r="n"]');
          el.e = fig.querySelector('[data-r="e"]');
          el.m = fig.querySelector('[data-r="m"]');
        },
        layout(W, vh) {
          const mob = W < 560;
          const lw = mob ? 84 : 132;
          const x0 = lw, x1 = W - (mob ? 8 : 14);
          const short = !mob && vh < 820;
          const cT = 30, cB = cT + (mob ? 84 : Math.round(clamp(vh * 0.14, 76, 128)));
          const rowH = mob ? 17 : short ? 16 : 20;
          const rT = cB + 20;
          const aY = rT + L16.length * rowH + 4;
          const H = aY + 20;
          const X = (m) => x0 + (m / END16) * (x1 - x0);
          const Y = (lg) => cB - (clamp(lg, 0, LOG16) / LOG16) * (cB - cT);
          const line = (from, to, K, step = 0.5) => {
            let d = "";
            for (let m = from; m <= to + 1e-6; m += step) {
              const lg = idx16(m, K);
              d += `${d ? "L" : "M"}${f1(X(m))} ${f1(Y(lg))}`;
              if (lg > LOG16) break;
            }
            return d;
          };
          const years = [];
          for (let y = 0; y <= 6; y++) {
            const x = f1(X(y * 12));
            years.push(`<path class="sx-grid" d="M${x} ${cT - 6}V${aY}"/><text class="sx-tx" x="${x}" y="${aY + 13}" text-anchor="middle">${2041 + y}</text>`);
          }
          const ylab = [0, 1].map((k) => `<path class="sx-grid sx-grid-h" d="M${x0} ${f1(Y(k))}H${x1}"/><text class="sx-tx" x="${x0 - 5}" y="${f1(Y(k) + 3)}" text-anchor="end">${["×1", "×10"][k]}</text>`).join("");
          const rows = L16.map((r, i) => {
            const y = f1(rT + i * rowH + rowH / 2);
            const xf = f1(X(r.f));
            const xo = r.o != null ? f1(X(r.o)) : xf;
            const tail = r.o != null
              ? `<path class="sx16-conn" d="M${xo} ${y}H${xo}"/><circle class="sx16-dot" opacity="0" cx="${xo}" cy="${y}" r="${mob ? 3.4 : 4}"/><text class="sx16-score" opacity="0" x="${f1(X(r.f) + 8)}" y="${f1(Number(y) + 3.2)}">${r.f - r.o > 0 ? "−" : "+"}${Math.abs(r.f - r.o)}</text>`
              : `<text class="sx16-score sx16-open" opacity="0" x="${f1(X(r.f) + 8)}" y="${f1(Number(y) + 3.2)}">not yet</text>`;
            return `<g class="sx16-row"><text class="sx16-k" x="0" y="${f1(Number(y) + 3.2)}">${esc(r.k)}</text><path class="sx16-base" d="M${x0} ${y}H${x1}"/><circle class="sx16-ring" cx="${xf}" cy="${y}" r="${mob ? 3.6 : 4.4}"/>${tail}</g>`;
          }).join("");
          svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
          svg.setAttribute("width", String(W));
          svg.setAttribute("height", String(H));
          svg.innerHTML = `
            <defs><clipPath id="${id}o"><rect x="${x0 - 2}" y="0" width="0" height="${H}"/></clipPath><clipPath id="${id}c"><rect x="${f1(X(TODAY16))}" y="0" width="0" height="${H}"/></clipPath></defs>
            ${years.join("")}${ylab}
            <text class="sx-tx sx-tx-k" x="0" y="${cT + 4}">Steward index</text>
            <text class="sx-tx sx-tx-k" x="0" y="${rT - 3}">Forecast lines</text>
            <path class="sx-ax" d="M${x0} ${cT - 6}V${cB}H${x1}"/>
            <path class="sx16-f" d="${line(0, END16, 101, 1)}"/>
            <path class="sx16-c" opacity="0" clip-path="url(#${id}c)" d="${line(TODAY16, END16, 75, 0.25)}"/>
            <path class="sx16-o" clip-path="url(#${id}o)" d="${line(0, TODAY16, 75)}"/>
            <g class="sx16-today"><path d="M${f1(X(TODAY16))} ${cT - 6}V${aY}"/><text x="${f1(X(TODAY16) + 4)}" y="${cT - 9}">Scorecard</text></g>
            ${rows}
            <path class="sx-ax" d="M${x0} ${aY}H${x1}"/>
            <g class="sx16-cur"><path d="M0 ${cT - 8}V${aY}"/><rect x="-31" y="2" width="62" height="18" rx="4"/><text x="0" y="15" text-anchor="middle">Jan 2041</text></g>`;
          g = {
            X, x0, x1,
            clipO: svg.querySelector(`#${id}o rect`),
            clipC: svg.querySelector(`#${id}c rect`),
            corr: svg.querySelector(".sx16-c"),
            cur: svg.querySelector(".sx16-cur"),
            chip: svg.querySelector(".sx16-cur text"),
            chipR: svg.querySelector(".sx16-cur rect"),
            rows: [...svg.querySelectorAll(".sx16-row")].map((n, i) => ({
              r: L16[i], y: f1(rT + i * rowH + rowH / 2), dot: n.querySelector(".sx16-dot"), conn: n.querySelector(".sx16-conn"), score: n.querySelector(".sx16-score"),
            })),
            n: -1,
          };
        },
        paint(v) {
          if (!g) return;
          const lead = env.loud ? 1.2 + 4 * env.heat : 0;
          const vo = v + lead;
          const { X } = g;
          setA(g.clipO, "width", f1(Math.max(0, X(Math.min(vo, TODAY16)) - g.x0 + 2)));
          setA(g.clipC, "width", f1(Math.max(0, X(v) - X(TODAY16))));
          setA(g.corr, "opacity", f1(smooth(58, 74, v)));
          const cx = X(clamp(v, 0, END16));
          setA(g.cur, "transform", `translate(${f1(cx)} 0)`);
          const shift = clamp(cx - 31, g.x0 - 30, g.x1 - 62) - (cx - 31);
          setA(g.chipR, "x", f1(-31 + shift));
          setA(g.chip, "x", f1(shift));
          setT(g.chip, mLabel(clamp(v, 0, END16)));
          let n = 0;
          const scores = [];
          for (const row of g.rows) {
            const { r } = row;
            if (r.o == null) {
              setA(row.score, "opacity", f1(smooth(r.f, r.f + 2, v)));
              continue;
            }
            const t = smooth(r.o, r.o + 2.5, vo);
            setA(row.dot, "opacity", f1(smooth(r.o - 0.6, r.o, vo)));
            setA(row.conn, "d", `M${f1(X(r.o))} ${row.y}H${f1(lerp(X(r.o), X(r.f), t))}`);
            setA(row.score, "opacity", f1(smooth(r.o + 1.6, r.o + 3, vo)));
            if (t > 0.5) {
              n++;
              scores.push(r.o - r.f);
            }
          }
          if (n !== g.n) {
            g.n = n;
            setT(el.n, `${n} of ${L16.length}`);
            setT(el.e, String(n));
            scores.sort((a, b) => a - b);
            const med = n ? (n % 2 ? scores[(n - 1) / 2] : (scores[n / 2 - 1] + scores[n / 2]) / 2) : null;
            setT(el.m, med == null ? "—" : `−${Math.abs(Math.round(med))} mo`);
          }
        },
      };
    },
  };
}

/* ======================================================================= */
/* 18 · The Fourth Rebase                                                  */
/* ======================================================================= */

// Time is UTC throughout, so every reader sees the same clock on the chart.
const T18 = Date.UTC(2045, 0, 14, 9);
const U0 = T18 - Date.UTC(2041, 0, 1);
const RAT = 40; // the window always spans 40× in time-remaining, so the curve is the same shape
const DAY = 864e5, HOUR = 36e5, MIN = 6e4;
const MONTH = 30.44 * DAY;
const uL = (v) => U0 * 10 ** -v;
const p2 = (n) => String(n).padStart(2, "0");
const utc = (t) => new Date(t);
const hm = (d) => `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
const hms = (d) => `${hm(d)}:${p2(d.getUTCSeconds())}`;
const day = (d) => `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
/** Seconds before 09:00:00, written as the last minute's seconds: 59.9…, never rounded up to 60. */
function secs(u, dec) {
  const s = 60 - u / 1000;
  const k = 10 ** dec;
  return (Math.floor(s * k) / k).toFixed(dec).padStart(dec ? 3 + dec : 2, "0");
}
/** The latest figure's time, as precisely as the window needs. */
function edge(u) {
  if (u >= 2 * DAY) {
    const d = utc(T18 - u);
    return `${day(d)} ${d.getUTCFullYear()}`;
  }
  if (u >= MIN) return `14 Jan 2045, ${hms(utc(Math.floor((T18 - u) / 1000) * 1000))}`;
  const dec = clamp(Math.ceil(-Math.log10(u / 1000)) + 1, 1, 7);
  return `14 Jan 2045, 08:59:${secs(u, dec)}`;
}
const TSTEPS = [
  [12 * MONTH, "y", 12], [6 * MONTH, "m", 6], [3 * MONTH, "m", 3], [MONTH, "m", 1],
  [7 * DAY, "d"], [2 * DAY, "d"], [DAY, "d"], [12 * HOUR, "h"], [6 * HOUR, "h"], [3 * HOUR, "h"], [HOUR, "h"],
  [30 * MIN, "h"], [15 * MIN, "h"], [10 * MIN, "h"], [5 * MIN, "h"], [2 * MIN, "h"], [MIN, "h"],
  [30e3, "s"], [15e3, "s"], [10e3, "s"], [5e3, "s"], [2e3, "s"], [1e3, "s"],
];
for (let e = 2; e >= -5; e--) for (const k of [5, 2, 1]) TSTEPS.push([k * 10 ** e, "f"]);

/** Tick times (as time-remaining u) and labels for the window [ur, ul]. */
function ticks(ur, ul, want) {
  const span = ul - ur;
  const st = TSTEPS.find(([s]) => span / s >= want) ?? TSTEPS[TSTEPS.length - 1];
  const [step, kind, months] = st;
  const out = [];
  if (kind === "y" || kind === "m") {
    const a = utc(T18 - ul);
    let y = a.getUTCFullYear(), m = a.getUTCMonth() + 1;
    while (out.length < 9) {
      if (m > 11) { y += Math.floor(m / 12); m %= 12; }
      if (m % months === 0) {
        const t = Date.UTC(y, m, 1);
        const u = T18 - t;
        if (u < ur) break;
        out.push([u, kind === "y" ? String(y) : `${MON[m]} ’${String(y).slice(2)}`]);
      }
      m++;
    }
    return out;
  }
  const dec = kind === "f" ? Math.max(0, Math.ceil(-Math.log10(step / 1000) - 1e-9)) : 0;
  for (let n = Math.ceil(ur / step); n * step <= ul && out.length < 9; n++) {
    const u = n * step;
    if (u <= 0) continue;
    const d = utc(T18 - u);
    out.push([u, kind === "d" ? day(d) : kind === "h" ? hm(d) : kind === "s" ? hms(d) : secs(u, dec)]);
  }
  return out;
}
const EV18 = [
  [Date.UTC(2044, 2, 15), "Scorecard"],
  [Date.UTC(2044, 5, 1), "Rebase 3"],
  [Date.UTC(2044, 9, 9), "STEWARD-9 certified"],
  [Date.UTC(2045, 0, 7, 9), "Rebase announced"],
  [Date.UTC(2045, 0, 14, 8), "Last printed figure"],
  [Date.UTC(2045, 0, 14, 8, 58), "Printers off"],
  [T18 - 4000, "Read aloud: 100"],
  [T18 - 0.4, "Read aloud: 100"],
];
const sup = (n) => String(n).replace(/\d|-/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"["0123456789".indexOf(c)] ?? "⁻");

function rebase(env) {
  const nines = "9".repeat(3 + Math.min(6, env.mem.reached[18] || 0));
  const evs = EV18.map(([t, k]) => ({ u: T18 - t, k }));
  // the plan the reader came in by, 30 ms before 09:00: it reaches the chart at the last step and slides to the floor
  if (env.loud && env.say) evs.push({ u: 30, k: `“${env.say}”`, red: true });
  return {
    vars: { nearly: `08:59:59.${nines}` },
    val: (s) => s.v,
    month: (v) => {
      const d = utc(T18 - uL(v) / RAT);
      return (d.getUTCFullYear() - 2041) * 12 + d.getUTCMonth();
    },
    stills: [0, 3, 9],
    end: () => ({ kind: "figure", id: "18:fourth", text: "The fourth rebase, scheduled for 09:00", data: { value: `08:59:59.${nines}` } }),
    inst(opt) {
      const html = `<p class="sx18-hd"><span class="sx18-now chip"${opt.first ? fragAttrs("label", "18:edge", "The latest figure, a little short of 09:00") : ""}>8 Dec 2044</span><span class="sx18-base">100 = 2041 × <b class="sx18-mag">4 × 10¹</b></span></p>
        <svg class="sx-svg" role="img" aria-label="The capability index, latest = 100, redrawn as the week of the fourth rebase runs out. The curve is the same shape at every scale; only the dates change."></svg>
        <p class="sx18-fl"></p>`;
      let svg, now, mag, fl, g = null;
      return {
        html,
        bind(fig) {
          svg = fig.querySelector("svg");
          now = fig.querySelector(".sx18-now");
          fl = fig.querySelector(".sx18-fl");
          mag = fig.querySelector(".sx18-mag");
        },
        layout(W, vh) {
          const mob = W < 560;
          const H = mob ? 288 : Math.round(clamp(vh * 0.36, 236, 360));
          const L = mob ? 30 : 40, Rr = W - (mob ? 10 : 16), Tp = 18, B = H - 30;
          const X = (s) => L + s * (Rr - L);
          const Y = (val) => B - (val / 100) * (B - Tp);
          let curve = "";
          for (let i = 0; i <= 120; i++) {
            const s = 1 - (1 - i / 120) ** 2;
            curve += `${i ? "L" : "M"}${f1(X(s))} ${f1(Y(100 / (RAT - (RAT - 1) * s)))}`;
          }
          const grid = [0, 25, 50, 75, 100].map((v) => `<path class="sx-grid sx-grid-h" d="M${L} ${f1(Y(v))}H${Rr}"/><text class="sx-tx" x="${L - 5}" y="${f1(Y(v) + 3)}" text-anchor="end">${v}</text>`).join("");
          const mr = mob ? 24 : 32;
          const mx = L + mr + (mob ? 8 : 14), my = B - mr - 40;
          let mini = "";
          for (let i = 0; i <= 24; i++) {
            const m = (i / 24) * 38;
            mini += `${i ? "L" : "M"}${f1(mx - mr * 0.75 + (i / 24) * mr * 1.5)} ${f1(my + mr * 0.5 - (idx16(m, 75) / 0.7) * mr * 0.95)}`;
          }
          svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
          svg.setAttribute("width", String(W));
          svg.setAttribute("height", String(H));
          svg.innerHTML = `
            <defs><clipPath id="sx18c${++uid}"><rect x="${L}" y="${Tp - 2}" width="${Rr - L + 1}" height="${B - Tp + 30}"/></clipPath></defs>
            ${grid}
            <g clip-path="url(#sx18c${uid})">
              ${Array.from({ length: 8 }, () => `<g class="sx18-tk"><path d="M0 ${Tp}V${B + 4}"/><text x="0" y="${B + 16}" text-anchor="middle"></text></g>`).join("")}
              ${Array.from({ length: 6 }, () => `<g class="sx18-st"><path d="M${L} 0H${Rr}"/><text x="${f1(L + 2 * mr + (mob ? 18 : 26))}" y="-3"></text></g>`).join("")}
            </g>
            <path class="sx-ax" d="M${L} ${Tp - 6}V${B}H${Rr}"/>
            <path class="sx18-floor" d="M${L} ${B}H${Rr}"/>
            <path class="sx18-ln" d="${curve}"/>
            ${evs.map((e, i) => `<g class="sx18-ev${e.red ? " sx18-ev-r" : ""}"><circle r="3.2"/><text y="${i % 2 ? 14 : -7}">${esc(e.k)}</text></g>`).join("")}
            <g class="sx18-glass" aria-hidden="true">
              <path class="sx18-chain" d="M${mx} ${my - mr}V${Tp + 2}"/>
              <circle cx="${mx}" cy="${my}" r="${mr}"/>
              <path class="sx18-mini" d="${mini}"/>
              <text x="${mx}" y="${my + mr + 13}" text-anchor="middle">2041–2044</text>
            </g>`;
          g = {
            X, Y, B, L, Rr, W, mob,
            tk: [...svg.querySelectorAll(".sx18-tk")].map((n) => ({ n, t: n.querySelector("text") })),
            st: [...svg.querySelectorAll(".sx18-st")].map((n) => ({ n, t: n.querySelector("text") })),
            ev: [...svg.querySelectorAll(".sx18-ev")].map((n, i) => ({ n, t: n.querySelector("text"), e: evs[i] })),
          };
        },
        paint(v) {
          if (!g) return;
          const ul = uL(v), ur = ul / RAT, span = ul - ur;
          const S = (u) => (ul - u) / span;
          const tk = ticks(ur, ul, g.mob ? 3 : 4);
          g.tk.forEach((p, i) => {
            const t = tk[i];
            if (!t) return setA(p.n, "visibility", "hidden");
            setA(p.n, "visibility", "visible");
            setA(p.n, "transform", `translate(${f1(g.X(S(t[0])))} 0)`);
            setT(p.t, t[1]);
          });
          // every earlier 100 falls toward the floor, a decade at a time
          const top = Math.floor(v + 1e-9);
          g.st.forEach((p, j) => {
            const k = top - j;
            if (k < 0) return setA(p.n, "visibility", "hidden");
            const val = 100 * 10 ** (k - v);
            const y = Math.min(g.B - 1.5 - j * 1.5, g.Y(val));
            setA(p.n, "visibility", "visible");
            setA(p.n, "transform", `translate(0 ${f1(y)})`);
            setA(p.n, "opacity", f1(val > 3 ? 1 : 0.35 + 0.2 * val));
            setT(p.t, val > 6 ? `100 at ${edge(uL(k) / RAT)}` : "");
          });
          g.ev.forEach((p) => {
            const u = p.e.u;
            if (u < ur || u > ul) return setA(p.n, "display", "none");
            const s = S(u);
            const x = g.X(s), y = g.Y((100 * ur) / u);
            setA(p.n, "display", "inline");
            setA(p.n, "transform", `translate(${f1(x)} ${f1(y)})`);
            const right = x > g.W * 0.62;
            setA(p.t, "text-anchor", right ? "end" : "start");
            setA(p.t, "x", right ? "-6" : "6");
            // a label that has reached the floor is not read any more; its dot stays
            setA(p.t, "visibility", y > g.B - 16 && !p.e.red ? "hidden" : "visible");
          });
          setT(fl, `On the floor: everything before ${edge(ul)}`);
          setT(now, edge(ur));
          const e = Math.floor(v + Math.log10(RAT) + 1e-9);
          const mant = (RAT * 10 ** v) / 10 ** e;
          setT(mag, `${mant.toFixed(1)} × 10${sup(e)}`);
        },
      };
    },
  };
}

/* ======================================================================= */
/* 19 · In Advance                                                         */
/* ======================================================================= */

const M0 = monthIndex("Jan 2046");
const M1 = monthIndex("Dec 2053");
const COUNT = monthIndex("Nov 2046");
const CROSS = monthIndex("Oct 2046");
const qOf = (m) => (m <= CROSS ? 4.1 + (1.1 * (m - 48)) / (CROSS - 48) : 5.2 * Math.exp(-(m - CROSS) / 30));
const qBy = (m) => (m <= CROSS ? 0.9 + 4.3 * Math.max(0, (m - 48) / (CROSS - 48)) ** 1.6 : 5.2 + 0.32 * (m - CROSS));
const QMAX = 12;

function advance(env) {
  const folders = env.T.folders.map(([m, t]) => ({ m, t: m === COUNT && env.loud && env.say ? "The count; a visit" : t }));
  return {
    val: (s) => monthIndex(s.at),
    month: (v) => Math.round(v),
    end: () => ({ kind: "stamp", id: "19:stamp", text: "Filed 2 Nov 2046" }),
    inst(opt) {
      const still = opt.still;
      const filed = (m) => (m >= COUNT ? "Filed 2 Nov 2046" : `Filed ${mLabel(m)}`);
      const folderHTML = folders.map((f) => `<div class="sx19-f${f.m > COUNT ? " sx19-ahead" : ""}${f.m === COUNT ? " sx19-now" : ""}" data-m="${f.m}"><b>${mLabel(f.m)}</b><i>${esc(f.t)}</i><s${opt.first && f.m === COUNT + 1 ? fragAttrs("stamp", "19:filed", filed(f.m)) : ""}>${filed(f.m)}</s></div>`).join("");
      const html = still
        ? `<div class="sx19-grid">${folderHTML}</div><svg class="sx-svg sx19-svg" role="img" aria-label="Questions per day asked of and by the models, January 2046 to 2053; the lines cross in October 2046."></svg>`
        : `<div class="sx19-view">
            <div class="sx19-pan"><svg class="sx19-svg" aria-hidden="true"></svg>${folderHTML}</div>
            <div class="sx19-mark" aria-hidden="true"><span class="chip">Nov 2046</span></div>
            <span class="sx19-lab sx19-lab-of" aria-hidden="true">Asked of the models</span>
            <span class="sx19-lab sx19-lab-by" aria-hidden="true">Asked by the models</span>
          </div>
          <p class="sr">Folders for each month from January 2046 to 2053, filed on 2 November 2046 from the count onward, with the two question lines below them.</p>`;
      let fig, svg, view, pan, chip, labOf, labBy, g = null;
      return {
        html,
        bind(f) {
          fig = f;
          svg = f.querySelector(".sx19-svg");
          view = f.querySelector(".sx19-view");
          pan = f.querySelector(".sx19-pan");
          chip = f.querySelector(".sx19-mark .chip");
          labOf = f.querySelector(".sx19-lab-of");
          labBy = f.querySelector(".sx19-lab-by");
        },
        layout(W, vh) {
          const mob = W < 560;
          const n = M1 - M0 + 1;
          const MW = still ? W / n : mob ? 74 : 88;
          const FH = mob ? 112 : 122;
          const fT = 30;
          const aY = still ? 8 : fT + FH + 12;
          const cT = aY + 24, cB = cT + (mob ? 90 : vh < 820 ? 84 : 110);
          const H = cB + (still ? 22 : 14);
          const Wt = n * MW;
          const X = (m) => (m - M0 + 0.5) * MW;
          const Y = (q) => cB - (Math.min(q, QMAX * 1.2) / QMAX) * (cB - cT);
          const line = (fn) => {
            let d = "";
            for (let m = M0; m <= M1; m += 0.5) d += `${d ? "L" : "M"}${f1(X(m))} ${f1(Y(fn(m)))}`;
            return d;
          };
          let tk = "";
          for (let m = M0; m <= M1; m++) {
            const jan = m % 12 === 0;
            if (still && !jan) continue;
            tk += `<path class="sx-grid${jan ? "" : " sx19-mt"}" d="M${f1(X(m) - MW / 2)} ${jan ? cT - 6 : aY}V${jan ? cB : aY + 5}"/>`;
            if (jan) tk += `<text class="sx-tx" x="${f1(X(m) - MW / 2 + 4)}" y="${aY + 15}">${2041 + m / 12}</text>`;
          }
          const yl = [0, 5, 10].map((q) => `<path class="sx-grid sx-grid-h" d="M0 ${f1(Y(q))}H${f1(Wt)}"/>`).join("");
          const ends = still ? `<text class="sx19-end" x="${f1(X(M0) + 4)}" y="${f1(Y(qOf(M0)) - 6)}">Asked of the models</text><text class="sx19-end sx19-end-by" x="${f1(X(M0) + 4)}" y="${f1(Y(qBy(M0)) + 13)}">Asked by the models</text>` : "";
          svg.setAttribute("viewBox", still ? `0 0 ${f1(Wt)} ${cB + 22}` : `0 0 ${f1(Wt)} ${H}`);
          svg.setAttribute("width", f1(Wt));
          svg.setAttribute("height", String(still ? cB + 22 : H));
          svg.innerHTML = `
            <defs><clipPath id="sx19c${++uid}"><rect x="0" y="${cT - 4}" width="${f1(Wt)}" height="${cB - cT + 8}"/></clipPath></defs>
            ${yl}${tk}
            <path class="sx-ax" d="M0 ${aY}H${f1(Wt)}"/>
            <path class="sx-ax" d="M0 ${cB}H${f1(Wt)}"/>
            <g clip-path="url(#sx19c${uid})"><path class="sx19-of" d="${line(qOf)}"/><path class="sx19-by" d="${line(qBy)}"/></g>
            <g class="sx19-count"><path d="M${f1(X(COUNT))} ${still ? cT - 10 : fT - 4}V${cB}"/><text x="${f1(X(COUNT) + 4)}" y="${cB + 12}">The count, 2 Nov 2046</text></g>
            ${ends}
            <text class="sx-tx" x="${f1(Wt - 4)}" y="${cT + 4}" text-anchor="end">bn questions / day</text>`;
          if (still) {
            svg.style.width = "100%";
            svg.style.height = "auto";
            g = { still };
            return;
          }
          const fm = new Map();
          for (const el of fig.querySelectorAll(".sx19-f")) {
            const m = Number(el.dataset.m);
            fm.set(m, el);
            el.classList.remove("sx19-here");
            el.style.left = `${f1(X(m) - MW / 2 + 4)}px`;
            el.style.width = `${f1(MW - 8)}px`;
            el.style.top = `${fT}px`;
            el.style.height = `${FH}px`;
          }
          pan.style.width = `${f1(Wt)}px`;
          view.style.height = `${H}px`;
          g = { W, MW, X, Y, half: W / 2, fm, here: null };
        },
        paint(v) {
          if (!g || g.still) return;
          setS(pan, "transform", `translate3d(${f1(g.half - g.X(v))}px,0,0)`);
          setT(chip, mLabel(v));
          // the folder under the present is the one lifted off the table
          const here = g.fm.get(Math.round(v)) ?? null;
          if (here !== g.here) {
            g.here?.classList.remove("sx19-here");
            here?.classList.add("sx19-here");
            g.here = here;
          }
          const yo = g.Y(qOf(v)), yb = g.Y(qBy(v));
          // Loud: after the crossing the labels keep their places (the upper is still "asked of")
          // and the lines trade under them.
          let lo = yo, lb = yb;
          if (env.loud && v > CROSS) {
            lo = Math.min(yo, yb);
            lb = Math.max(yo, yb);
          }
          const gap = 15;
          if (Math.abs(lo - lb) < gap) {
            const mid = (lo + lb) / 2;
            const s = lo <= lb ? -1 : 1;
            lo = mid + (s * gap) / 2;
            lb = mid - (s * gap) / 2;
          }
          setS(labOf, "transform", `translate(${f1(g.half + 8)}px,${f1(lo - 9)}px)`);
          setS(labBy, "transform", `translate(${f1(g.half + 8)}px,${f1(lb - 9)}px)`);
        },
      };
    },
  };
}

/* ======================================================================= */
/* 21 · The Schedule                                                       */
/* ======================================================================= */

const toSec = (t) => {
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};
const fromSec = (x) => {
  const s = Math.floor(x);
  return `${p2(Math.floor(s / 3600))}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`;
};
const clock = () => {
  const d = new Date();
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
};

function schedule(env) {
  const vars = { say: env.say };
  const rows = env.T.rows
    .filter((r) => r[2] !== "walk" || (env.loud && env.say))
    .map(([t, item, kind = "world", s = null]) => ({ t, sec: toSec(t), item: fill(item, vars), kind, s }));
  const lastS = Math.max(...rows.map((r) => r.s ?? -1));
  const open = rows.findIndex((r) => r.s === lastS);
  const at = (s) => rows.findIndex((r) => r.s === s);
  return {
    // a step rests the present on the boundary just below its row (done); the last on the open row's top edge
    val: (step) => (step.row === lastS ? open + 0.02 : at(step.row) + 0.94),
    month: () => monthIndex("Jun 2047"),
    end: () => ({ kind: "line", id: "21:next", text: "13:26:00 · A plan is taken. · Scheduled" }),
    inst(opt) {
      const still = opt.still;
      const li = rows.map((r, i) => {
        const read = r.kind === "read";
        const time = read && env.loud && !still ? "··:··:··" : r.t;
        const who = i === open ? `<span class="sx21-blank"></span>` : "—";
        const done = still && i < open;
        return `<li class="sx21-r sx21-${r.kind}${done ? " done" : ""}${i === open ? " sx21-open" : ""}"><span class="sx21-t">${time}</span><span class="sx21-i"${i === open && opt.first ? fragAttrs("line", "21:open", "A plan is taken. Scheduled.") : ""}>${esc(r.item)}</span><span class="sx21-w">${who}</span><span class="sx21-s">${done ? "DONE" : "SCHEDULED"}</span></li>`;
      }).join("");
      const html = `<div class="sx21-board">
          <p class="sx21-h"><b>The Schedule</b><span>Sheet 2047-165 · 14 June 2047</span>${still ? "" : `<span class="sx21-nowh" aria-hidden="true">now <b class="sx21-nt">00:00:00</b></span>`}<span class="chip">posted 00:00:00</span></p>
          <p class="sx21-cols" aria-hidden="true"><span>Time</span><span>Item</span><span>Who</span><span>Status</span></p>
          <div class="sx21-view"><ol class="sx21-rows">${li}</ol>${still ? "" : `<div class="sx21-now" aria-hidden="true"></div>`}</div>
        </div>`;
      let view, list, nt, els, g = null;
      let doneN = 0;
      return {
        html,
        bind(f) {
          view = f.querySelector(".sx21-view");
          list = f.querySelector(".sx21-rows");
          nt = f.querySelector(".sx21-nt");
          els = [...f.querySelectorAll(".sx21-r")].map((n) => ({ n, t: n.querySelector(".sx21-t"), w: n.querySelector(".sx21-w"), s: n.querySelector(".sx21-s") }));
        },
        layout(W, vh) {
          const mob = W < 560;
          const rh = mob ? 46 : 31;
          const vis = mob ? 6 : clamp(Math.floor((vh * 0.36) / rh), 6, 10);
          view.style.setProperty("--rh", `${rh}px`);
          if (still) return void (g = { still });
          view.style.height = `${vis * rh}px`;
          g = { rh, nowY: (mob ? 2.5 : Math.floor(vis / 2) + 0.5) * rh };
          view.style.setProperty("--now", `${g.nowY}px`);
        },
        paint(v) {
          if (!g || g.still) return;
          setS(list, "transform", `translate3d(0,${f1(g.nowY - v * g.rh)}px,0)`);
          // Done is for good: what has happened stays done when the reader scrolls back.
          let n = doneN;
          while (n < open) {
            const r = rows[n];
            const lead = env.loud && r.kind === "read" ? 0.42 : 0;
            if (v > n + 0.5 - lead) n++;
            else break;
          }
          for (; doneN < n; doneN++) {
            const e = els[doneN];
            e.n.classList.add("done");
            setT(e.s, "DONE");
            if (env.loud && rows[doneN].kind === "read") {
              setT(e.t, clock());
              if (env.damaged) setT(e.w, "you");
            }
          }
          const i = clamp(Math.floor(v - 0.5), 0, rows.length - 2);
          const k = clamp(v - 0.5 - i, 0, 1);
          const live = env.loud && rows[i].kind === "read" && rows[i + 1].kind === "read";
          setT(nt, live ? clock() : fromSec(lerp(rows[i].sec, rows[i + 1].sec, k)));
        },
      };
    },
  };
}

const SETS = { 16: scorecard, 18: rebase, 19: advance, 21: schedule };
