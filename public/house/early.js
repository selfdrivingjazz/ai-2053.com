// Early rooms (2041–2047): the AI-2040 report register.
// Hooks called by house.js for rooms in EARLY (see rooms-early.js):
//   decorate(article, ctx) once after the room is rendered,
//   update(ctx) on every scroll frame / descent change (cached geometry only),
//   leave() before the next room replaces this one.
// Room 1 renders an empty <header id="front">; decorate fills the masthead.
//
// Each room's `report` (dated subsections, KEY METRICS, tables, boxes, charts,
// widgets) is rendered after its lede. Dated subsections drive the column's date
// chip, and its picture (`scene`), while they are on screen.
//
// The false calm (column.js `quiet`): a fresh house, in its first rooms, reads as
// a sober report. Every encounter below waits until the calm has gone; a damaged
// house is never quiet again and keeps every scar.
//
// Encounters (driven by real reader state; static under reduced motion):
//   Room 3  Appendix A: entries open, cite their sources (some of them plans),
//           show excerpts of the rooms they cite, and, once the calm has gone,
//           correct themselves on reading and file what followed the reader in.
//   Room 7  the gallery: the column's capability curve goes vertical as you reach
//           the crooked chart, then lets go and hangs out of the column.
//   Room 8  Schedule R-7: the reader's own walk, filed as related-party
//           transactions; the last row is the one in progress, and its note
//           names the room they came from, what they said, and the time.
//   Room 12 Appendix C: a 400-page transcript, paged; a louder house prints the
//           pages the quiet one withholds.
//   Room 14 the verso: the report's imprint set small at its foot (in a louder house it
//           is "this printing, today"), and a thing from a room the reader has not
//           reached yet. It follows them out (ctx.emit, from that room) and is
//           waiting, marked "14", when they get there.
//   Room 15 KEY METRICS: the ledger's four figures turn into your walk.
//   Room 20 the plan wall: the column's halftone field resolves into your route;
//           the Schedule lists you at the minute you came in.
//   Room 29 the review's later sections know how often the reader has been in
//           the void, and after two passes it starts again, smaller.
//
// Memory: localStorage `ai2053.house.early`
//   { escapes, foretold, told, r14, readers, ax: {entry: revisions}, fired: {room: 1} }.
// It is kept under the house's `escapes` count and reset only when that changes.
import { ROOMS, ROOM_COUNT, plansOf } from "./rooms.js";
import { PLAN_NAMES, FORETOLD, SITES, OPERATORS, APPENDIX, APPENDIX_INDEX, TRANSCRIPT } from "./rooms-early.js";
import { cue, monthIndex, quiet } from "./column.js";
import { prose, hash, rng } from "./voice.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const attr = (s) => esc(s).replace(/'/g, "&#39;");
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const times = (n) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const hhmm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

let enc = null; // the room's scroll encounter: { kind, el, top, h, max }
let secs = []; // dated subsections: { el, mi, scene, top }
let reportEnd = 0;
let io = null;
let ro = null;
let onResize = null;
let measured = false;
let raf = 0;
let mem = null; // this room's memory, for encounters that write to it
let tr = null; // Room 12's transcript state

/* ---------- memory ---------- */

const MEM_KEY = "ai2053.house.early";

function memory(ctx) {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(MEM_KEY)); } catch { /* unreadable: start clean */ }
  if (!m || typeof m !== "object" || m.escapes !== ctx.escapes) m = { escapes: ctx.escapes, foretold: null, told: [], r14: 0 };
  m.told ||= [];
  m.ax ||= {};
  m.fired ||= {};
  return m;
}
function remember(m) {
  try { localStorage.setItem(MEM_KEY, JSON.stringify(m)); } catch { /* storage unavailable */ }
}
const been = (ctx, n) => ctx.visited.has(n) || ctx.damage.rooms[n] != null;

/* ---------- markup helpers ---------- */

// Inline syntax for authored strings: `^n` footnote.
function rich(s) {
  return esc(s).replace(/\^(\d+)/g, (_, n) => `<sup class="fn"><a href="#note-${n}" aria-label="note ${n}">${n}</a></sup>`);
}

function fragAttrs(kind, id, text, data) {
  return ` data-frag="${kind}" data-frag-id="${attr(id)}" data-frag-text="${attr(text)}"${data ? ` data-frag-data='${attr(JSON.stringify(data))}'` : ""}`;
}

const planSlot = (ps) => (ps ? ` data-plan-slot="${ps}"` : "");

function cellHTML(c) {
  if (c == null || c === "") return "";
  if (typeof c === "string") return rich(c);
  if (!c.f) return `<span${planSlot(c.ps)}>${rich(c.t)}</span>`;
  const data = c.f === "figure" ? { value: c.v ?? c.t } : undefined;
  return `<span class="fr"${fragAttrs(c.f, c.id, c.l ?? c.t, data)}${planSlot(c.ps)}>${rich(c.t)}</span>`;
}

function sentenceOf(t, seed) {
  const all = t.replace(/\^\d+/g, "").match(/[^.!?]+[.!?]+[”"]?/g)?.map((s) => s.trim()).filter((s) => s.length > 24 && s.length < 140) ?? [];
  return all.length ? all[seed % all.length] : "";
}

/** A plan surface for one of this room's own plans; anything else stays text. */
function planIn(ctx, to, html, cls = "") {
  const p = plansOf(ctx.room).find((x) => x.to === to);
  if (!p) return html;
  return `<a class="plan-in${cls ? ` ${cls}` : ""}" href="#room-${to}" data-to="${to}" data-say="${attr(p.say)}" aria-label="Plan ${to}">${html}</a>`;
}

/* ---------- masthead (Room 1) ---------- */

const AUTHORS = "Waymo Shorter, Maxwell Tokens, Arthur Basil, Benson Spoons, Satoshi Guapomoto, jmill, STEWARD-7";

const PILLS = [
  ["What is the house?", "A record of the years 2041 to 2053, kept in the only form that would hold them. It was commissioned as an archive. It is now mostly corridors."],
  ["Why did we build it?", "Because every evaluation passed, and we wanted to be somewhere that would notice if one didn't."],
  ["Timelines?", "Our median for an Autonomous Researcher was 2049 when we began. It is now 2044. We have revised it five times. Each revision was earlier, and so far each has been right."],
];

function frontHTML(ctx) {
  const more = ctx.damage.voids ? ", and seventy-one others" : ctx.prior ? ", and one visitor" : "";
  return `<p class="front-k">AI 2053</p>
    <p class="front-t">The House of 2053</p>
    <p class="byline">${AUTHORS.split(", ").map((n) => `<span class="nb">${n}</span>`).join(", ")}${more}</p>
    ${ctx.prior ? `<p class="front-again">Second printing</p>` : ""}
    <p class="front-lede">By 2041, every frontier model was evaluated every night, and every evaluation passed. We built the house to keep the record.</p>
    <p class="front-lede">It is our best account of the twelve years that followed. We have walked it many times. We always come out in the same place.</p>
    <div class="pills" role="group" aria-label="Questions">
      ${PILLS.map(([q], i) => `<button type="button" class="pill" data-pill="${i}" aria-expanded="false" aria-controls="pill-panel">${q}</button>`).join("")}
    </div>
    <div class="pill-panel" id="pill-panel" role="region" aria-live="polite" hidden><p></p></div>`;
}

function onPill(btn, article, ctx) {
  const panel = article.querySelector("#pill-panel");
  const open = btn.getAttribute("aria-expanded") === "true";
  article.querySelectorAll(".pill[data-pill]").forEach((b) => b.setAttribute("aria-expanded", "false"));
  if (open) {
    panel.hidden = true;
    return;
  }
  btn.setAttribute("aria-expanded", "true");
  const i = Number(btn.dataset.pill);
  let t = PILLS[i][1];
  if (i === 1 && !quiet(ctx)) t += " The house has noticed several things since. It has not told us which.";
  panel.querySelector("p").textContent = t;
  panel.hidden = false;
}

/* ---------- report blocks ---------- */

function keymHTML(k, room) {
  const cells = k.cells.map(([v, label, kind = "figure", id], i) => {
    const f = kind === "number" ? fragAttrs("number", id ?? `${room}:k${i}`, v) : fragAttrs(kind, id ?? `${room}:k${i}`, label, { value: v });
    return `<div class="keym-c"><dt>${esc(label)}</dt><dd${f}>${esc(v)}</dd></div>`;
  }).join("");
  return `<figure class="keym">
    <figcaption class="keym-h"><span class="keym-k">Key Metrics</span><span class="chip">${esc(k.date)}</span></figcaption>
    <dl class="keym-g">${cells}${k.slot ? `<div class="keym-c keym-slot" data-slot="${k.slot}"></div>` : ""}</dl>
    <p class="keym-src"><span${planSlot(k.ps)}>${esc(k.src)}</span></p>
  </figure>`;
}

function tableHTML(t) {
  const cols = t.head.length;
  const head = `<thead><tr>${t.head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>`;
  const rows = t.rows.map((r, ri) => `<tr${t.rowCls?.[ri] ? ` class="${t.rowCls[ri]}"` : ""}>${r.map((c, i) => (i ? `<td>${cellHTML(c)}</td>` : `<th scope="row">${cellHTML(c)}</th>`)).join("")}</tr>`).join("");
  const slot = t.slot ? `<tr class="rt-slot"><th scope="row">${esc(t.slot[0])}</th><td colspan="${cols - 1}" data-slot="${t.slot[1]}"><span class="rt-empty">${esc(t.slot[2] ?? "Reserved.")}</span></td></tr>` : "";
  const foot = t.foot ? `<tfoot><tr>${t.foot.map((c) => `<td>${cellHTML(c)}</td>`).join("")}</tr></tfoot>` : "";
  const cap = t.cap || t.n ? `<figcaption>${t.n ? `<span class="rt-n">${esc(t.n)}</span> ` : ""}${esc(t.cap)}</figcaption>` : "";
  return `<figure class="rt${t.cls ? ` rt-${t.cls}` : ""}">${cap}<div class="rt-w"><table>${head}<tbody>${rows}${slot}</tbody>${foot}</table></div></figure>`;
}

function curveHTML(c) {
  const W = 320, H = 150, L = 34, B = 128, T = 10, R = 312;
  const pts = c.points;
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const X = (i) => L + (i / (pts.length - 1)) * (R - L);
  const Y = (v) => B - ((v - lo) / (hi - lo || 1)) * (B - T);
  const line = (dy) => pts.map((v, i) => `${X(i).toFixed(1)},${(Y(v) + dy).toFixed(1)}`).join(" ");
  const n = c.lines || 1;
  const polys = Array.from({ length: n }, (_, i) => `<polyline class="fig-ln${i ? " fig-ln-k" : ""}" style="--k:${i}" points="${line(i ? (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.7 : 0)}"/>`).join("");
  const grid = [0.25, 0.5, 0.75].map((f) => `<path class="fig-grid" d="M${L} ${(B - f * (B - T)).toFixed(1)} H${R}"/>`).join("");
  const short = c.cap.split(/[.,]/)[0].slice(0, 90);
  return `<figure class="fig"${fragAttrs("curve", c.id, short, { points: pts })}>
    <svg viewBox="0 0 ${W} ${H + 12}" role="img" aria-label="${attr(c.cap)}">
      ${grid}
      <path class="fig-ax" d="M${L} ${T - 4} V${B} H${R + 4}"/>
      ${polys}
      <text class="fig-t" x="${L - 6}" y="${B + 3}" text-anchor="end">${esc(c.y[0])}</text>
      <text class="fig-t" x="${L - 6}" y="${T + 4}" text-anchor="end">${esc(c.y[1])}</text>
      <text class="fig-t" x="${L}" y="${B + 18}">${esc(c.x[0])}</text>
      <text class="fig-t" x="${R}" y="${B + 18}" text-anchor="end">${esc(c.x[1])}</text>
    </svg>
    <figcaption><span class="rt-n">${esc(c.n)}</span> ${esc(c.cap)}</figcaption>
  </figure>`;
}

/**
 * Horizontal bars: { n, cap, rows: [[label, value, shown?] | [label, a, b]], legend?: [a, b],
 * max, unit, hl (row carried as a figure), id, src }. Two legend entries draw paired bars.
 */
function barsHTML(b) {
  const two = b.legend?.length === 2;
  const max = b.max ?? Math.max(...b.rows.flatMap((r) => (two ? [r[1], r[2]] : [r[1]])));
  const u = b.unit ?? "";
  const pct = (v) => `${Math.max(0.6, (100 * v) / max).toFixed(1)}%`;
  const hl = b.hl ?? 0;
  const rows = b.rows.map((r, i) => {
    const shown = two ? `${r[1]}${u} · ${r[2]}${u}` : r[2] ?? `${r[1]}${u}`;
    const f = b.id && i === hl ? fragAttrs("figure", b.id, `${b.cap.split(/[.,(]/)[0].trim()}: ${r[0]}`, { value: two ? `${r[2]}${u}` : shown }) : "";
    return `<li class="rb-r${i === hl && b.mark ? " rb-hl" : ""}"><span class="rb-l">${rich(r[0])}</span><span class="rb-t">${two ? `<i class="rb-b rb-a" style="--w:${pct(r[1])}"></i><i class="rb-b rb-z" style="--w:${pct(r[2])}"></i>` : `<i class="rb-b" style="--w:${pct(r[1])}"></i>`}</span><span class="rb-v"${f}>${esc(shown)}</span></li>`;
  }).join("");
  const legend = two ? `<p class="rb-k"><span class="rb-sw rb-a"></span>${esc(b.legend[0])}<span class="rb-sw rb-z"></span>${esc(b.legend[1])}</p>` : "";
  return `<figure class="rb${two ? " rb-two" : ""}">
    <figcaption><span class="rt-n">${esc(b.n)}</span> ${esc(b.cap)}</figcaption>
    ${legend}<ol class="rb-l0" role="list">${rows}</ol>
    ${b.src ? `<p class="fig-src">${rich(b.src)}</p>` : ""}
  </figure>`;
}

/**
 * A dated line chart with several series and a projection, after AI 2027's forecasts.
 * { n, cap, x: [x0, x1], xt: [ticks], y: [lo, hi], yt: [[v, label]], log?, now?: [x, label],
 *   series: [{ name, pts: [[x, y]], proj?: [[x, y]], k? (0 accent, 1 ink, 2 grey) }], id, src }
 */
function linesHTML(c) {
  const W = 320, H = 170, L = 38, R = 304, T = 16, B = 138;
  const [x0, x1] = c.x;
  const tf = (v) => (c.log ? Math.log10(v) : v);
  const [lo, hi] = c.y.map(tf);
  const X = (x) => L + ((x - x0) / (x1 - x0)) * (R - L);
  const Y = (y) => B - ((tf(y) - lo) / (hi - lo)) * (B - T);
  const pts = (a) => a.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" ");
  const grid = (c.yt || []).map(([v]) => `<path class="fig-grid" d="M${L} ${Y(v).toFixed(1)} H${R}"/>`).join("");
  const ylab = (c.yt || []).map(([v, t]) => `<text class="fig-t" x="${L - 5}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${esc(t)}</text>`).join("");
  const xlab = (c.xt || [x0, x1]).map((x) => `<text class="fig-t" x="${X(x).toFixed(1)}" y="${B + 14}" text-anchor="middle">${esc(String(x))}</text>`).join("");
  const now = c.now ? `<path class="fig-now" d="M${X(c.now[0]).toFixed(1)} ${T - 6} V${B}"/><text class="fig-t fig-nowt" x="${(X(c.now[0]) - 3).toFixed(1)}" y="${T - 7}" text-anchor="end">${esc(c.now[1])}</text>` : "";
  const lines = c.series.map((s) => {
    const k = s.k ?? 0;
    const proj = s.proj ? `<polyline class="fig-ln fig-s${k} fig-pj" points="${pts([s.pts.at(-1), ...s.proj])}"/>` : "";
    const end = (s.proj ?? s.pts).at(-1);
    const tag = s.tag ? `<text class="fig-t fig-tag fig-tag${k}" x="${(X(end[0]) - 3).toFixed(1)}" y="${(Y(end[1]) - 5).toFixed(1)}" text-anchor="end">${esc(s.tag)}</text>` : "";
    return `<polyline class="fig-ln fig-s${k}" points="${pts(s.pts)}"/>${proj}${tag}`;
  }).join("");
  const first = c.series[0];
  const fpts = [...first.pts, ...(first.proj || [])].map(([, y]) => y);
  const legend = c.series.length > 1 || c.series.some((s) => s.proj)
    ? `<p class="fig-key">${c.series.map((s) => `<span class="fig-kk"><i class="fig-sw fig-s${s.k ?? 0}"></i>${esc(s.name)}</span>`).join("")}${c.series.some((s) => s.proj) ? `<span class="fig-kk"><i class="fig-sw fig-pj"></i>Projection</span>` : ""}</p>`
    : "";
  return `<figure class="fig fig-lines"${fragAttrs("curve", c.id, c.cap.split(/[.,(]/)[0].slice(0, 90), { points: fpts })}>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${attr(c.cap)}">
      ${grid}
      <path class="fig-ax" d="M${L} ${T - 4} V${B} H${R + 4}"/>
      ${now}${lines}${ylab}${xlab}
    </svg>
    ${legend}
    <figcaption><span class="rt-n">${esc(c.n)}</span> ${esc(c.cap)}</figcaption>
    ${c.src ? `<p class="fig-src">${rich(c.src)}</p>` : ""}
  </figure>`;
}

/**
 * Forecast distributions for the arrival of milestones (split normals through the
 * 10th, 50th and 90th percentiles). { n, cap, x: [x0, x1], xt, series: [{ name, lo, med, hi, k }], id, src }
 */
function distHTML(c) {
  const W = 320, H = 150, L = 12, R = 308, T = 12, B = 118;
  const [x0, x1] = c.x;
  const X = (x) => L + ((x - x0) / (x1 - x0)) * (R - L);
  const dens = (s, x) => {
    const sd = (x < s.med ? s.med - s.lo : s.hi - s.med) / 1.2816;
    return Math.exp(-((x - s.med) ** 2) / (2 * sd * sd)) * (2 / (((s.med - s.lo) + (s.hi - s.med)) / 1.2816 * Math.sqrt(2 * Math.PI)));
  };
  const top = Math.max(...c.series.map((s) => dens(s, s.med)));
  const Y = (d) => B - (d / top) * (B - T);
  const N = 64;
  const yr = (v) => (Number.isInteger(v) ? String(v) : `mid\u2011${Math.floor(v)}`);
  const body = c.series.map((s) => {
    const k = s.k ?? 0;
    const xs = Array.from({ length: N + 1 }, (_, i) => x0 + ((x1 - x0) * i) / N);
    const p = xs.map((x) => `${X(x).toFixed(1)},${Y(dens(s, x)).toFixed(1)}`).join(" ");
    const mx = X(s.med).toFixed(1);
    return `<path class="fig-area fig-a${k}" d="M${X(x0).toFixed(1)} ${B} L${p.replace(/ /g, " L")} L${X(x1).toFixed(1)} ${B} Z"/>
      <polyline class="fig-ln fig-s${k}" points="${p}"/>
      <path class="fig-med fig-m${k}" d="M${mx} ${Y(dens(s, s.med)).toFixed(1)} V${B}"/>
      <text class="fig-t fig-tag fig-tag${k}" x="${mx}" y="${(Y(dens(s, s.med)) - 4).toFixed(1)}" text-anchor="middle">${esc(s.tag ?? yr(s.med))}</text>`;
  }).join("");
  const xlab = (c.xt || [x0, x1]).map((x) => `<text class="fig-t" x="${X(x).toFixed(1)}" y="${B + 14}" text-anchor="middle">${x}</text>`).join("");
  const s0 = c.series[0];
  const rows = c.series.map((s) => [s.name, yr(s.lo), yr(s.med), yr(s.hi)]);
  return `<figure class="fig fig-dist"${fragAttrs("curve", c.id, c.cap.split(/[.,(]/)[0].slice(0, 90), { points: Array.from({ length: 12 }, (_, i) => Math.round(100 * dens(s0, x0 + ((x1 - x0) * i) / 11) / top)) })}>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${attr(c.cap)}">
      <path class="fig-ax" d="M${L} ${B} H${R}"/>
      ${body}${xlab}
    </svg>
    <p class="fig-key">${c.series.map((s) => `<span class="fig-kk"><i class="fig-sw fig-s${s.k ?? 0}"></i>${esc(s.name)}</span>`).join("")}</p>
    <figcaption><span class="rt-n">${esc(c.n)}</span> ${esc(c.cap)}</figcaption>
    ${tableHTML({ n: "", cap: "", cls: "dt", head: ["Milestone", "10th pct.", "Median", "90th pct."], rows })}
    ${c.src ? `<p class="fig-src">${rich(c.src)}</p>` : ""}
  </figure>`;
}

function fill(text, ctx) {
  if (!text.includes("{")) return text;
  const vr = ctx.damage.voidRooms || {};
  const list = Object.entries(vr).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).map(([n, c]) => `Plan ${n} ${times(c)}`);
  const vlist = list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : list[0] ?? "Plan 71 once";
  return text.replace("{vlist}", vlist);
}

function passes(b, ctx) {
  const v = ctx.damage.voids || 0;
  if (!b.if) return true;
  if (b.if === "quiet") return quiet(ctx);
  if (b.if === "loud") return !quiet(ctx);
  if (b.if === "calm") return v === 0;
  if (b.if === "void") return v > 0;
  if (b.if === "void2") return v >= 2;
  return true;
}

/** Render a list of report blocks. `st` carries the paragraph count across nested boxes. */
function blocks(list, ctx, st) {
  return list.filter((b) => passes(b, ctx)).map((b) => block(b, ctx, st)).join("");
}

function block(b, ctx, st) {
  const room = ctx.room;
  if (b.h) return `<h2 class="sec" data-at="${esc(b.at ?? "")}"${b.scene ? ` data-scene="${b.scene}"` : ""}>${esc(b.h)}</h2>`;
  if (b.p) {
    const i = st.p++;
    const text = fill(b.p, ctx);
    const dv = clamp01(ctx.entryD + Math.min(0.12, 0.012 * (i + 2)));
    const s = i % 2 ? sentenceOf(text, hash(`${room}:r${i}`)) : "";
    const echo = i === st.last ? st.path : [];
    return `<p class="prose rp"${s ? fragAttrs("line", `${room}:r${i}`, s) : ""}>${prose(text, dv, hash(`${room}:r${i}`), { path: echo, room })}</p>`;
  }
  if (b.keym) return keymHTML(b.keym, room);
  if (b.table) return tableHTML(b.table);
  if (b.curve) return curveHTML(b.curve);
  if (b.bars) return barsHTML(b.bars);
  if (b.lines) return linesHTML(b.lines);
  if (b.dist) return distHTML(b.dist);
  if (b.stamp) return `<p class="stamp-w"><span class="stamp"${fragAttrs("stamp", b.id, b.stamp)}>${esc(b.stamp)}</span></p>`;
  if (b.list) return `<ol class="${b.list.cls}"${b.list.start ? ` start="${b.list.start}"` : ""}>${b.list.items.map((t) => `<li>${rich(t)}</li>`).join("")}</ol>`;
  if (b.xbox) {
    return `<details class="xbox">
      <summary><span class="xbox-t">${esc(b.xbox.t)}</span> <span class="xbox-n">${esc(b.xbox.n ?? "")}</span></summary>
      <div class="xbox-b">${blocks(b.xbox.body, ctx, st)}</div>
    </details>`;
  }
  if (b.w && WIDGETS[b.w]) return WIDGETS[b.w](ctx);
  return "";
}

/* ---------- widgets ---------- */

function ledgerHTML() {
  return `<details class="xbox ledger">
    <summary><span class="xbox-t">The ledger, 2041</span> <span class="xbox-n">4 entries</span></summary>
    <ol class="ledger-l">
      <li>What lies outside the observed regime?</li>
      <li>Can the committee be evaluated?</li>
      <li class="ledger-mono">What lies outside the observed regime?</li>
      <li><span data-plan-slot="any">Who wrote entry 4?</span></li>
    </ol>
  </details>`;
}

function squares(n, cell) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const full = Math.floor(n / cols);
  const rest = n - full * cols;
  const rows = full + (rest ? 1 : 0);
  const W = cols * cell;
  const H = rows * cell;
  const id = `sq${n}`;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
    <defs><pattern id="${id}" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><rect width="${cell - 1.2}" height="${cell - 1.2}" rx="0.6"/></pattern></defs>
    ${rest ? `<rect x="0" y="0" width="${rest * cell}" height="${cell}" fill="url(#${id})"/>` : ""}
    <rect x="0" y="${rest ? cell : 0}" width="${W}" height="${full * cell}" fill="url(#${id})"/>
  </svg>`;
}

function computeHTML() {
  const runs = [
    ["STEWARD-5", "2039", "2×10<sup>28</sup>", 1],
    ["STEWARD-6", "2041", "1.6×10<sup>29</sup>", 8],
    ["The Lattice, run 1", "2042", "6.4×10<sup>30</sup>", 320],
  ];
  return `<figure class="compute">
    <div class="compute-row">
      ${runs.map(([n, y, f, k], i) => `<div class="compute-b"${i === 2 ? fragAttrs("figure", "9:run1", "The Lattice, run 1, in STEWARD-5s", { value: "320×" }) : ""}>${squares(k, 7)}<p>${n}<br>(${y} · ${f} FLOP)</p></div>`).join("")}
    </div>
    <figcaption>Training compute per run. One square is one STEWARD-5.</figcaption>
  </figure>`;
}

/** Room 9: the nineteen sites, as registered. The column draws them on its globe. */
function sitesHTML() {
  const rows = SITES.map(([id, op, region, , , mw]) => [id, OPERATORS[op], region === "Not located" ? `${region}^35` : region, mw.toLocaleString("en-US")]);
  const total = SITES.reduce((a, s) => a + s[5], 0);
  return `<details class="xbox sites">
    <summary><span class="xbox-t">The Lattice site register</span> <span class="xbox-n">19 sites · ${total.toLocaleString("en-US")} MW</span></summary>
    <div class="xbox-b">${tableHTML({ n: "Table 9.1", cap: "Sites under the Schedule, 2042", head: ["Site", "Operator", "Region", "MW"], rows, foot: ["", "", "Total", { t: total.toLocaleString("en-US"), f: "number", id: "9:mw" }] })}</div>
  </details>`;
}

/* Room 12: Appendix C, a transcript of 400 pages, one page at a time. */
const PRINTED_A = TRANSCRIPT.printed.flat().map(([, a]) => (typeof a === "string" ? a : a.quiet));

function trPairs(k) {
  const T = TRANSCRIPT;
  if (k <= T.printed.length) return T.printed[k - 1];
  if (k === T.pages) return tr.q ? T.last.quiet : T.last.loud;
  if (tr.q) return null;
  // The withheld pages, as a louder house prints them.
  const r = rng(hash(`tr${k}|${tr.escapes}`));
  const n = 2 + (k % 2);
  const out = [];
  for (let j = 0; j < n; j++) {
    const i = Math.floor(r() * T.q.length);
    const ai = tr.voids && r() < 0.18 * Math.min(3, tr.voids) ? Math.floor(r() * T.a.length) : i;
    const back = 1 + Math.floor(r() * (k - 1));
    const sub = (s) => s
      .replace(/\{k\}/g, String(k))
      .replace(/\{r\}/g, String(back))
      .replace("{mins}", (() => { const m = Math.max(1, Math.round((Date.now() - tr.t0) / 60000)); return m === 1 ? "One minute" : `${m} minutes`; })())
      .replace("{quote}", PRINTED_A[back % PRINTED_A.length]);
    out.push([sub(T.q[i]), sub(T.a[ai])]);
  }
  return out;
}

function trPageHTML(k) {
  const pairs = trPairs(k);
  if (!pairs) return `<p class="tr-wh">${rich(TRANSCRIPT.withheld)}</p><p class="tr-folio">pp. 7–399</p>`;
  const answers = pairs.map(([, a]) => (typeof a === "string" ? a : tr.q ? a.quiet : a.loud));
  const shown = tr.rev ? [...answers].reverse() : answers;
  const swap = tr.voids && k > TRANSCRIPT.printed.length && k < TRANSCRIPT.pages && k % 2 === 0;
  return `<dl class="qa${swap ? " qa-swap" : ""}">${pairs.map(([q], i) => {
    const a = shown[i];
    const mark = k === 1 && !tr.q && a === "Which plan did you come in by?" ? fragAttrs("line", "12:a4", a) : "";
    return `<dt>${esc(q)}</dt><dd${mark}>${esc(a)}</dd>`;
  }).join("")}</dl><p class="tr-folio">— ${k} —</p>`;
}

function transcriptHTML(ctx) {
  tr = { page: 1, rev: false, q: quiet(ctx), voids: ctx.damage.voids || 0, escapes: ctx.escapes, t0: Date.now() };
  const N = TRANSCRIPT.pages;
  return `<details class="xbox transcript">
    <summary><span class="xbox-t">Transcript, Appendix C</span> <span class="xbox-n">${N} pp.</span></summary>
    <div class="tr-page" aria-live="polite">${trPageHTML(1)}</div>
    <div class="tr-nav" role="group" aria-label="Transcript pages">
      <button type="button" class="pill pill-s tr-b" data-tr="-1" aria-label="Previous page" disabled>←</button>
      <label class="tr-at"><span>p.</span><input class="tr-in" type="number" min="1" max="${N}" value="1" inputmode="numeric" aria-label="Page"><span>of ${N}</span></label>
      <button type="button" class="pill pill-s tr-b" data-tr="1" aria-label="Next page">→</button>
      <button type="button" class="pill pill-s" data-reverse aria-pressed="false">Read in reverse</button>
    </div>
  </details>`;
}

function trGo(article, k) {
  const N = TRANSCRIPT.pages;
  const box = article.querySelector(".transcript");
  if (!box || !tr) return;
  tr.page = Math.min(N, Math.max(1, Math.round(k) || 1));
  box.querySelector(".tr-page").innerHTML = trPageHTML(tr.page);
  box.querySelector(".tr-in").value = String(tr.page);
  box.querySelector('[data-tr="-1"]').disabled = tr.page === 1;
  box.querySelector('[data-tr="1"]').disabled = tr.page === N;
}

function trStep(article, dir) {
  const P = TRANSCRIPT.printed.length;
  let k = tr.page + dir;
  // The quiet house skips the withheld pages as one.
  if (tr.q && k > P + 1 && k < TRANSCRIPT.pages) k = dir > 0 ? TRANSCRIPT.pages : P + 1;
  trGo(article, k);
}

const CHARTS = [
  ["Capability index (rebased ×3)", "M14 86 C40 84 50 70 62 58 L62 84 C80 80 92 66 104 52 L104 82 C124 76 136 58 148 40 L148 78 C158 72 166 52 172 22", [4, 12, 28, 6, 18, 34, 8, 26, 50, 12, 38, 68], "7:index"],
  ["Revenue, $T / yr", "M14 88 C70 86 110 78 136 58 S166 22 172 10", [1, 2, 4, 9, 18, 31, 52, 80], "7:revenue"],
  ["Agents deployed, M", "M14 89 C80 88 120 80 140 62 C156 46 164 26 170 8", [1, 1.5, 3, 6, 12, 24, 44, 81], "7:agents"],
  ["Evaluations passed, 99–100%", "M14 70 L40 60 L66 52 L92 40 L118 34 L144 24 L172 14", [20, 30, 38, 50, 56, 66, 76], "7:evals"],
  ["Benchmarks saturated", "M14 88 H50 V74 H86 V60 H112 V42 H140 V28 H160 V14 H172", [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [5, 4], [5, 5]], "7:bench"],
];

function chart([label, d, points, id], opts = {}) {
  return `<figure class="g${opts.crooked ? " g-crooked" : ""}"${fragAttrs("curve", id, label, { points })}>
    ${opts.crooked ? `<svg class="g-string" viewBox="0 0 180 40" aria-hidden="true"><path d="M30 40 L90 6 L150 40"/><circle cx="90" cy="5" r="2.6"/></svg>` : ""}
    <div class="g-frame">
      <svg viewBox="0 0 180 104" aria-hidden="true">
        <path class="g-ax" d="M14 8 V90 H174"/>
        <path class="g-ln" d="${d}"/>
      </svg>
      <figcaption>${label}</figcaption>
    </div>
  </figure>`;
}

function galleryHTML() {
  const crooked = FORETOLD.find((f) => f.id === "7:over");
  return `<div class="gallery" role="group" aria-label="The gallery: seven frames">
    ${CHARTS.map((c) => chart(c)).join("")}
    ${chart([crooked.text, "M14 34 C60 37 110 44 172 52", crooked.data.points, crooked.id], { crooked: true })}
    <figure class="g g-loan"><div class="g-frame" data-slot="curve figure"><span class="g-empty" data-plan-slot="any">On loan</span></div></figure>
  </div>`;
}

function metricsHTML(ctx) {
  const plans = ctx.walk.log.filter((s) => s.via === "door").length;
  const cells = [
    ["Ledger entries", "4", "Rooms you have entered", String(ctx.visited.size)],
    ["Committee members", "9", "Plans you chose", String(plans)],
    ["Revisions", "12", "Times you went back", String(ctx.walk.backtracks)],
    ["Retired by a person", "0", "Rooms you have not entered", String(Math.max(0, ROOM_COUNT - ctx.visited.size))],
  ];
  return `<figure class="keym keym-turn">
    <figcaption class="keym-h"><span class="keym-k">Key Metrics</span><span class="chip">${esc(ctx.R.date)}</span></figcaption>
    <dl class="keym-g">
      ${cells.map(([ka, va, kb, vb], i) => `<div class="keym-c" style="--i:${i}">
        <dt><span class="a">${ka}</span><span class="b">${kb}</span></dt>
        <dd><span class="a">${va}</span><span class="b">${vb}</span></dd>
      </div>`).join("")}
    </dl>
    <p class="keym-src"><span class="a">Ledger of Unanswered Questions, rev. 12</span><span class="b">Ledger of Unanswered Questions, rev. 13</span></p>
  </figure>`;
}

function memoHTML(ctx) {
  const visits = ctx.walk.log.filter((s) => s.room === 2).length;
  const words = [5, 8, 3, 9, 6, 4, 7, 5, 2];
  const n = Math.max(1, words.length - 3 * (visits - 1));
  const bars = words.slice(0, n).map((w) => `<span class="redact" style="--w:${w}"></span>`).join(" ");
  return `<figure class="memo">
    <figcaption class="memo-h"><span>Delegation Order 45/2</span><span>Memorandum</span></figcaption>
    <p class="memo-b"><span class="memo-1" data-slot="line"><span class="sr">Redacted.</span><span class="memo-bars" aria-hidden="true">${bars}.</span></span> <span${fragAttrs("line", "2:memo", "Please continue.")} data-plan-slot="listed">Please continue.</span></p>
  </figure>`;
}

function planwallHTML() {
  const card = (k, sub) => `<li class="plan"><span class="pin" aria-hidden="true"></span><b>${k}</b><span data-plan-slot="listed">${sub}</span></li>`;
  return `<figure class="plans">
    <ol class="plan-row" aria-label="The plan wall">
      ${card("Plan D", "Race")}
      ${card("Plan C", "Burn the Lead")}
      ${card("Plan B", "Outpace")}
      <li class="plan-a-wrap"><span class="plan plan-s" aria-label="Plan S, pinned behind Plan A: Shut it all down"><b>Plan S</b><span>Shut it all down</span></span><span class="plan plan-a"${fragAttrs("label", "20:planA", "Plan A: Verified Slowdown")}><span class="pin" aria-hidden="true"></span><b>Plan A</b><span>Verified Slowdown</span></span></li>
      <li class="plan plan-none" data-slot="plan label stamp" aria-label="A sixth pin"><span class="pin" aria-hidden="true"${fragAttrs("label", "20:pin", "A sixth pin, holding nothing")}></span><span class="plan-none-t" data-plan-slot="hidden"></span></li>
    </ol>
  </figure>`;
}

function scheduleHTML(ctx) {
  const now = hhmm(new Date());
  const rows = [
    ["06:00", "STEWARD-10 checkpoint promoted"],
    ["06:00", "Nightly evaluations published (pass)"],
    ["09:30", "Commission session 46-14 convenes"],
    ["11:00", "Plan A reviewed; Plan S re-pinned"],
    ["16:45", "Weather, as forecast"],
    ["23:59", "Schedule for 15 April posted"],
  ];
  if (!quiet(ctx)) {
    const at = rows.findIndex(([t]) => t > now);
    rows.splice(at < 0 ? rows.length : at, 0, [now, { t: "A reader enters the Plan Room", f: "label", id: "20:reader" }, true]);
  }
  return `<figure class="rt rt-sched">
    <figcaption><span class="rt-n">The Schedule</span> 14 April 2046, extract</figcaption>
    <div class="rt-w"><table>
      <thead><tr><th scope="col">Time</th><th scope="col">What</th><th scope="col">Who</th></tr></thead>
      <tbody>${rows.map(([t, w, you]) => `<tr${you ? ' class="rt-you"' : ""}><th scope="row">${t}</th><td>${cellHTML(w)}</td><td></td></tr>`).join("")}</tbody>
    </table></div>
  </figure>`;
}

function coverHTML() {
  return `<header class="cover">
    <p class="cover-k">Registry of Billable Cognition</p>
    <p class="cover-f">Form R-1</p>
    <p class="cover-t">Annual Report</p>
    <p class="cover-p">for the fiscal year ended 31 December 2042</p>
    <p class="cover-n">The Lattice Consortium</p>
    <p class="cover-p">Meridian · Halcyon · Kestrel, a scheduling arrangement</p>
    <dl class="cover-d">
      <div><dt>Registry file no.</dt><dd${fragAttrs("label", "8:file", "RBC-0001")}>RBC-0001</dd></div>
      <div><dt>Accelerated filer</dt><dd>Yes, by nine days</dd></div>
      <div><dt>Shell company</dt><dd>See risk factor 63</dd></div>
    </dl>
    <span class="stamp cover-stamp"${fragAttrs("stamp", "8:filed", "Filed")}>Filed</span>
  </header>`;
}

const RELATED_HEAD = `<thead><tr><th scope="col">No.</th><th scope="col">Parties</th><th scope="col">Nature of transaction</th><th scope="col">Consideration</th></tr></thead>`;

/** Room 8, while the house is quiet: the Consortium's own related parties. The last is in progress. */
function relatedQuietHTML() {
  const rows = [
    ["Meridian → Halcyon", "Accelerator time under the Schedule", "4.1×10⁹ accel·h"],
    ["Halcyon → Kestrel", "Accelerator time under the Schedule", "3.7×10⁹ accel·h"],
    ["Kestrel → Meridian", "Accelerator time under the Schedule", "3.9×10⁹ accel·h"],
    ["Consortium → Registry", "Cognition supplied to read filings^23", "$41B"],
    ["Registry → Consortium", "Audit of this filing", "1 audit·h"],
    ["STEWARD-6 → STEWARD-6", "Preparation and review of this filing", "at cost"],
    ["Consortium → a reader", "Disclosure", ""],
  ];
  const body = rows.map(([p, n, c], i) => {
    const last = i === rows.length - 1;
    return `<tr class="tx${last ? " tx-now" : ""}" style="--i:${i}"><th scope="row">${i + 1}</th><td>${esc(p)}</td><td>${rich(n)}${last ? `<sup class="fn"><a href="#note-30" aria-label="note 30">30</a></sup>` : ""}</td><td>${last ? "in progress" : esc(c)}</td></tr>`;
  }).join("");
  return `<figure class="rt rt-live" id="r7">
    <figcaption><span class="rt-n">Schedule R-7</span> Related-party transactions, fiscal 2042</figcaption>
    <div class="rt-w"><table>${RELATED_HEAD}<tbody>${body}</tbody>
      <tfoot><tr><td></td><td>Total</td><td><span${fragAttrs("figure", "8:tx", "Transactions disclosed in Schedule R-7", { value: "7" })}>7 transactions</span></td><td></td></tr></tfoot>
    </table></div>
  </figure>`;
}

/** Room 8: the reader's walk, filed as related-party transactions. */
function relatedHTML(ctx) {
  if (quiet(ctx)) return relatedQuietHTML();
  const log = ctx.walk.log;
  const all = log.map((s, i) => {
    const prev = i ? log[i - 1].room : null;
    if (i === 0) return [`${s.room}`, "Opening balance", "—"];
    if (s.via === "door") return [`${s.from ?? prev} → ${s.room}`, `Plan ${s.room}: “${s.say ?? ""}”`, "1 plan"];
    if (s.via === "back") return [`${prev} → ${s.room}`, "Reversal", "—"];
    if (s.via === "forward") return [`${prev} → ${s.room}`, "Reinstatement", "—"];
    return [`— → ${s.room}`, "Arrival without a plan", "unrecorded"];
  });
  const shown = all.slice(-12);
  const skipped = all.length - shown.length;
  const plans = log.filter((s) => s.via === "door").length;
  const backs = log.filter((s) => s.via === "back").length;
  const rows = shown.map(([rooms, nature, cons], i) => {
    const n = skipped + i + 1;
    const last = i === shown.length - 1;
    return `<tr class="tx${last ? " tx-now" : ""}" style="--i:${i}"><th scope="row">${n}</th><td>${esc(rooms)}</td><td>${esc(nature)}${last ? `<sup class="fn"><a href="#note-30" aria-label="note 30">30</a></sup>` : ""}</td><td>${last ? "in progress" : esc(cons)}</td></tr>`;
  }).join("");
  return `<figure class="rt rt-live" id="r7">
    <figcaption><span class="rt-n">Schedule R-7</span> Related-party transactions between rooms of the house</figcaption>
    <div class="rt-w"><table>${RELATED_HEAD.replace("Parties", "Rooms")}
      <tbody>${skipped ? `<tr class="tx tx-agg" style="--i:0"><th scope="row">1–${skipped}</th><td>…</td><td>Earlier transactions, aggregated</td><td>${skipped}</td></tr>` : ""}${rows}</tbody>
      <tfoot><tr><td></td><td>Total</td><td><span${fragAttrs("figure", "8:plans", "Plans disclosed in Schedule R-7", { value: String(plans) })}>${plans} ${plans === 1 ? "plan" : "plans"}</span>${backs ? `, ${backs} ${backs === 1 ? "reversal" : "reversals"}` : ""}</td><td></td></tr></tfoot>
    </table></div>
  </figure>`;
}

function relatedNote(ctx) {
  const log = ctx.walk.log;
  const s = log.at(-1);
  const n = log.length;
  const at = hhmm(new Date());
  const prev = n > 1 ? log[n - 2].room : null;
  const from = s.via === "door" ? s.from ?? prev : prev;
  const R = from != null ? ROOMS[from] : null;
  if (s.via === "door" && R) {
    return `Schedule R-7, transaction ${n}: Room ${from}, “${R.title}” (${R.date}), to this filing, on the representation “${String(s.say ?? "").replace(/[.!?]$/, "")}”, at ${at}. The Consortium incorporates Room ${from} by reference.`;
  }
  if ((s.via === "back" || s.via === "forward") && R) {
    return `Schedule R-7, transaction ${n}: a ${s.via === "back" ? "reversal" : "reinstatement"} from Room ${from}, “${R.title}”, at ${at}. Reversals are disclosed at their original value.`;
  }
  return `Schedule R-7, transaction ${n}: an arrival without a plan, at ${at}. The Consortium has no record of where from, and has recorded that.`;
}

/* ---------- Room 3: Appendix A ---------- */

/** A headline figure, corrected `k` times. Only plain quantities correct themselves. */
function corrected(fig, k, voids) {
  const m = String(fig).match(/^([\d,]+(?:\.\d+)?)(%|×.*)?$/);
  if (!m || !k) return null;
  const v = Number(m[1].replace(/,/g, ""));
  const dec = (m[1].split(".")[1] || "").length;
  const rest = m[2] ?? "";
  let out;
  if (dec || rest) out = (v * (1 + 0.004 * k * (1 + Math.min(3, voids)))).toFixed(Math.max(1, dec));
  else out = Math.round(v + k * Math.max(1, Math.round(v / 1000))).toLocaleString("en-US");
  return out + rest;
}

const axOpen = (e) => e.n === "A.1";

function axText(ctx, s) {
  return esc(s)
    .replace(/\[\[(\d+)\|(.+?)\]\]/g, (_, to, t) => planIn(ctx, Number(to), t, "ax-plan"))
    .replace(/\^(\d+)/g, (_, n) => `<sup class="fn"><a href="#note-${n}" aria-label="note ${n}">${n}</a></sup>`);
}

function axEntryHTML(e, ctx, m, loud) {
  const i = e.n.slice(2);
  const voids = ctx.damage.voids || 0;
  const open = axOpen(e);
  let fig = esc(e.fig);
  let rev = "";
  let errs = e.e.map(([d, t]) => `<li><span class="ax-d">${esc(d)}</span> ${esc(t)}</li>`);
  if (e.n === "A.7" && loud) {
    const n = m.readers || 1;
    fig = `<s>0</s> ${n}`;
    rev = `rev. ${n}`;
    for (let k = Math.max(1, n - 3); k <= n; k++) errs.push(`<li><span class="ax-d">${k === n ? `Today, ${hhmm(new Date())}` : "Earlier"}</span> First published as ${k - 1}; corrected to ${k}.</li>`);
  } else if (loud && m.ax[e.n]) {
    const k = m.ax[e.n];
    const c = corrected(e.fig, k, voids);
    if (c) {
      fig = `<s>${esc(e.fig)}</s> ${esc(c)}`;
      rev = `rev. ${k}`;
      errs.push(`<li><span class="ax-d">On reading</span> Corrected ${times(k)} since first printed; now ${esc(c)}.</li>`);
    }
  }
  const src = e.s.map((s) => {
    if (s.plan) return `<li>${planIn(ctx, s.plan, esc(s.c), "ax-plan")}</li>`;
    if (s.room != null) {
      return `<li><button type="button" class="ax-x" aria-expanded="false">${esc(s.c)}</button><blockquote class="ax-q" hidden><p>${esc(s.ex)}</p><footer>Room ${s.room}</footer></blockquote></li>`;
    }
    return `<li>${esc(s.c)}</li>`;
  });
  if (e.n === "A.8" && voids) {
    for (const n of Object.keys(ctx.damage.voidRooms || {})) src.push(`<li class="ax-void"><s>Room ${esc(n)}</s> (withheld)</li>`);
  }
  const figAttr = e.fig ? fragAttrs("figure", e.id, `Appendix ${e.n}, ${e.t}`, { value: e.fig }) : "";
  return `<li class="ax-e" data-ax="${e.n}">
    <h3 class="ax-hh"><button type="button" class="ax-h" aria-expanded="${open}" aria-controls="axb-${i}">
      <span class="ax-n">${e.n}</span><span class="ax-t">${esc(e.t)}</span><span class="ax-f"${figAttr}>${fig}</span><span class="ax-rev">${rev}</span>
    </button></h3>
    <div class="ax-b" id="axb-${i}"${open ? "" : " hidden"}>
      <p class="ax-m">${axText(ctx, e.m)}</p>
      ${src.length ? `<p class="ax-k">Sources</p><ol class="ax-s">${src.join("")}</ol>` : ""}
      ${e.fig ? `<p class="ax-k">Corrections</p>${errs.length ? `<ol class="ax-c">${errs.join("")}</ol>` : `<p class="ax-none">None.</p>`}` : ""}
    </div>
  </li>`;
}

function appendixHTML(ctx) {
  const loud = !quiet(ctx);
  const m = memory(ctx);
  if (loud) m.readers = (m.readers || 0) + 1;
  remember(m);
  mem = m;
  const nsrc = APPENDIX.reduce((a, e) => a + e.s.length, 0);
  const ncorr = APPENDIX.reduce((a, e) => a + e.e.length, 0) + (loud ? Object.values(m.ax).reduce((a, k) => a + k, 0) + (m.readers || 0) : 0);
  const terms = APPENDIX_INDEX.filter(([, , only]) => !only || loud);
  return `<div class="ax">
    <p class="ax-meta"><span>${APPENDIX.length} entries</span><span>${nsrc} sources</span><span class="ax-nc" data-n="${ncorr}">${ncorr} corrections</span><span>${loud ? `Revised today, ${hhmm(new Date())}` : "Revised January 2041"}</span></p>
    <p class="ax-lede">Figures are given as first published and, where they have since changed, as corrected. A room of the house is cited by number where the room is the source.</p>
    <ol class="ax-l">${APPENDIX.map((e) => axEntryHTML(e, ctx, m, loud)).join("")}</ol>
    <ol class="ax-l ax-recv" aria-label="Received">${[1, 2, 3].map((k) => `<li class="ax-r" data-slot="*" data-n="A.${APPENDIX.length + k}"></li>`).join("")}</ol>
    <div class="ax-ix" role="group" aria-label="Index"><span class="ax-ix-k">Index</span>${terms.map(([t, key]) => `<button type="button" class="ax-term" data-term="${attr(key)}" aria-pressed="false">${esc(t)}</button>`).join("")}</div>
    <p class="ax-folio"><span class="ax-pg">A–1</span>${planIn(ctx, 14, "over", "ax-over")}</p>
  </div>`;
}

function axSetOpen(li, open) {
  const btn = li.querySelector(".ax-h");
  btn.setAttribute("aria-expanded", String(open));
  li.querySelector(".ax-b").hidden = !open;
}

/** Opening an entry, once the calm has gone, corrects its figure again. */
function axToggle(li, ctx) {
  const open = li.querySelector(".ax-h").getAttribute("aria-expanded") !== "true";
  axSetOpen(li, open);
  if (!open || quiet(ctx) || !mem) return;
  const e = APPENDIX.find((x) => x.n === li.dataset.ax);
  if (!e || e.n === "A.7") return;
  const prev = corrected(e.fig, mem.ax[e.n] || 0, ctx.damage.voids || 0) ?? e.fig;
  const k = (mem.ax[e.n] || 0) + 1;
  const c = corrected(e.fig, k, ctx.damage.voids || 0);
  if (!c) return;
  mem.ax[e.n] = k;
  remember(mem);
  const f = li.querySelector(".ax-f");
  f.innerHTML = `<s>${esc(e.fig)}</s> ${esc(c)}`;
  li.querySelector(".ax-rev").textContent = `rev. ${k}`;
  let ol = li.querySelector(".ax-c");
  if (!ol) {
    li.querySelector(".ax-none")?.remove();
    li.querySelector(".ax-b").insertAdjacentHTML("beforeend", `<ol class="ax-c"></ol>`);
    ol = li.querySelector(".ax-c");
  }
  ol.insertAdjacentHTML("beforeend", `<li class="ax-new"><span class="ax-d">${hhmm(new Date())}</span> ${esc(prev)} corrected to ${esc(c)} on reading.</li>`);
  if (ol.children.length > 6) ol.children[ol.children.length - 7]?.remove();
  const nc = li.closest(".ax").querySelector(".ax-nc");
  const n = Number(nc.dataset.n) + 1;
  nc.dataset.n = String(n);
  nc.textContent = `${n} corrections`;
}

function axExcerpt(btn) {
  const q = btn.nextElementSibling;
  const open = btn.getAttribute("aria-expanded") !== "true";
  btn.setAttribute("aria-expanded", String(open));
  q.hidden = !open;
}

function axUnmark(ax) {
  ax.querySelectorAll("mark.ax-mk").forEach((mk) => {
    const p = mk.parentNode;
    mk.replaceWith(document.createTextNode(mk.textContent));
    p.normalize();
  });
}

/** The index: every pressed term is marked wherever it occurs, and its entries open. */
function axIndex(btn, ax) {
  btn.setAttribute("aria-pressed", String(btn.getAttribute("aria-pressed") !== "true"));
  axUnmark(ax);
  const keys = [...ax.querySelectorAll('.ax-term[aria-pressed="true"]')].map((b) => b.dataset.term);
  if (!keys.length) return;
  const re = new RegExp(`(${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  for (const li of ax.querySelectorAll(".ax-e")) {
    const body = li.querySelector(".ax-b");
    const title = li.querySelector(".ax-t").textContent;
    if (!re.test(body.textContent + " " + title)) continue;
    re.lastIndex = 0;
    axSetOpen(li, true);
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest("a, button, mark, sup") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    for (const n of nodes) {
      const parts = n.textContent.split(re);
      if (parts.length < 2) continue;
      const frag = document.createDocumentFragment();
      parts.forEach((p, j) => {
        if (!p) return;
        if (j % 2) {
          const mk = document.createElement("mark");
          mk.className = "ax-mk";
          mk.textContent = p;
          frag.append(mk);
        } else frag.append(p);
      });
      n.replaceWith(frag);
    }
  }
}

/** What followed the reader in is filed as received, with its provenance. Runs once fragments have landed. */
function axReceived(article) {
  for (const li of article.querySelectorAll(".ax-r")) {
    const cf = li.querySelector(".cf");
    if (!cf || li.querySelector(".ax-rk")) continue;
    const from = cf.dataset.cfFrom ?? "?";
    li.insertAdjacentHTML("afterbegin", `<p class="ax-rk"><span class="ax-n">${li.dataset.n}</span> <span class="ax-rs">Not yet verified.</span></p>`);
    li.insertAdjacentHTML("beforeend", `<button type="button" class="pill pill-s ax-v" data-from="${esc(from)}">Verify</button>`);
  }
}

function axVerify(btn, ctx) {
  const li = btn.closest(".ax-r");
  const k = Number(btn.dataset.k || 0) + 1;
  btn.dataset.k = String(k);
  const from = btn.dataset.from;
  const st = li.querySelector(".ax-rs");
  if (k === 1) st.textContent = "Verified: as printed.";
  else if (ctx.damage.voids) st.textContent = `Verified ${times(k)}. It was not there the last time.`;
  else st.textContent = `Verified ${times(k)}: as printed.`;
}

/* ---------- Room 14 ---------- */

/** What Room 14 shows: a thing from a room the reader has not reached yet. */
function foretell(ctx, m) {
  if (m.foretold && !been(ctx, m.foretold.room)) return m.foretold;
  if (m.foretold && !m.told.includes(m.foretold.id)) m.told.push(m.foretold.id);
  const open = FORETOLD.filter((f) => !been(ctx, f.room) && !m.told.includes(f.id));
  m.foretold = open.length ? open[hash(`14|${ctx.escapes}|${m.told.length}`) % open.length] : null;
  return m.foretold;
}

function foretoldHTML(f) {
  const from = ` data-from="${f.room}"`;
  if (f.kind === "figure") return `<span class="ft ft-figure"${from}><b>${esc(f.data.value)}</b><small>${esc(f.text)}</small></span>`;
  if (f.kind === "curve") {
    const p = f.data.points;
    const lo = Math.min(...p), hi = Math.max(...p);
    const pts = p.map((v, i) => `${((i / (p.length - 1)) * 100).toFixed(1)},${(30 - ((v - lo) / (hi - lo || 1)) * 28).toFixed(1)}`).join(" ");
    return `<span class="ft ft-curve"${from}><svg viewBox="-2 -2 104 34" aria-hidden="true"><polyline points="${pts}"/></svg><small>${esc(f.text)}</small></span>`;
  }
  return `<span class="ft ft-${f.kind}"${from}>${esc(f.text)}</span>`;
}

/** Room 14's imprint: the report's front matter, set small at the foot of the verso. */
function imprintHTML(ctx, loud) {
  const I = ctx.R.imprint;
  if (!I) return "";
  const printing = loud ? `${I.printing} This printing, today, ${hhmm(new Date())}.` : I.printing;
  return `<section class="r14-imp" aria-label="Imprint">
    ${I.head.map((t, i) => `<p class="${i ? "r14-ih2" : "r14-ih"}">${rich(t)}</p>`).join("")}
    <dl class="r14-dl">${I.items.map(([k, t]) => `<div><dt>${esc(k)}</dt><dd>${rich(t === "{printing}" ? printing : t)}</dd></div>`).join("")}</dl>
    ${I.cite ? `<p class="r14-cite"><span class="r14-ck">Cite as</span> ${rich(I.cite)}</p>` : ""}
  </section>`;
}

function fourteenHTML(ctx) {
  const blank = `<p class="r14-blank">This page intentionally left blank.</p>`;
  const folio = `<p class="r14-folio"><span data-plan-slot="listed">14</span></p>`;
  if (quiet(ctx)) {
    return `<div class="r14 r14-q">${blank}<div class="r14-gap" aria-hidden="true"></div>${imprintHTML(ctx, false)}${folio}</div>`;
  }
  const m = memory(ctx);
  m.r14 = (m.r14 || 0) + 1;
  const f = foretell(ctx, m);
  remember(m);
  if (f) ctx.emit({ kind: f.kind, id: f.id, from: f.room, text: f.text, data: f.data });
  return `<div class="r14">
    ${blank}
    <div class="r14-gap" aria-hidden="true"></div>
    ${f ? `<p class="r14-f">${foretoldHTML(f)}</p>` : ""}
    <div class="r14-gap r14-gap-s" aria-hidden="true"></div>
    <p class="r14-count"><span class="r14-k">Visitors to this page</span> <span class="r14-d">000000</span><span class="r14-real" aria-hidden="true">${m.r14}</span></p>
    ${imprintHTML(ctx, true)}
    ${folio}
  </div>`;
}

/* ---------- Room 29 ---------- */

const VOID_FINDING = {
  71: "Something is asking.",
  17: "The page continues.",
  52: "A plan that was not written.",
  2054: "A year with nothing in it.",
};

function voidtableHTML(ctx) {
  const vr = ctx.damage.voidRooms || {};
  const seq = [];
  for (const [n, c] of Object.entries(vr).sort((a, b) => b[1] - a[1])) for (let i = 0; i < c; i++) seq.push(Number(n));
  const shown = seq.slice(0, 11);
  const rows = shown.map((n, i) => [String(i + 1), String(n), VOID_FINDING[n] ?? "Something is asking."]);
  if (seq.length > shown.length) rows.push([`${shown.length + 1}–${seq.length}`, "…", "The same."]);
  if (seq.includes(71)) rows.push(["", "71", { t: "It does not know this.", f: "line", id: "29:know" }]);
  return tableHTML({ n: "Table 5.1", cap: "Findings, plans not on the wall", head: ["Visit", "Plan", "Finding"], rows });
}

function againHTML(ctx) {
  const R = ctx.R;
  const lede = R.prose.map((t) => `<p>${esc(t.replace(/\^\d+/g, ""))}</p>`).join("");
  const depth = Math.min(4, 1 + Math.floor((ctx.damage.voids || 0) / 2));
  let inner = "";
  for (let i = 0; i < depth; i++) inner = `<div class="again">${i === depth - 1 ? `<p class="again-k">Review of the Plans</p>` : ""}${lede}${inner}</div>`;
  return `<div class="again-w" aria-hidden="true">${inner}</div>`;
}

const WIDGETS = {
  ledger: ledgerHTML,
  compute: computeHTML,
  sites: sitesHTML,
  transcript: transcriptHTML,
  gallery: galleryHTML,
  metrics: metricsHTML,
  memo: memoHTML,
  planwall: planwallHTML,
  schedule: scheduleHTML,
  cover: coverHTML,
  related: relatedHTML,
  appendix: appendixHTML,
  fourteen: fourteenHTML,
  voidtable: voidtableHTML,
  again: againHTML,
};

/* ---------- hooks ---------- */

export function decorate(article, ctx) {
  const R = ctx.R;
  const room = ctx.room;
  const calm = quiet(ctx);
  const front = article.querySelector("#front");
  if (front) front.innerHTML = frontHTML(ctx);

  // The appendix places all of its own plans; nothing else moves them.
  if (room === 3) article.dataset.plans = "self";

  // The report follows the lede, before the plans.
  if (R.report?.length) {
    const paras = article.querySelectorAll(":scope > .prose");
    const anchor = paras[paras.length - 1] ?? article.querySelector(".room-head");
    const shown = R.report.filter((b) => passes(b, ctx));
    const pCount = shown.reduce((n, b) => n + (b.p ? 1 : 0), 0);
    const st = { p: 0, last: pCount - 1, path: ctx.walk.log.map((s) => s.room) };
    anchor.insertAdjacentHTML("afterend", `<div class="report">${blocks(shown, ctx, st)}</div>`);
  }

  // Notes that know something.
  const setNotes = (notes) => {
    for (const [n, t] of Object.entries(notes || {})) {
      const li = article.querySelector(`#note-${n}`);
      if (li) li.textContent = t;
    }
  };
  if (!calm) setNotes(R.notesLoud);
  if (ctx.damage.voids) setNotes(R.notesVoid);
  if (room === 8 && !calm) {
    const li = article.querySelector("#note-30");
    if (li) li.textContent = relatedNote(ctx);
  }

  // Things Room 14 showed before the reader got here carry its number.
  const m = memory(ctx);
  if (m.foretold?.room === room && !m.told.includes(m.foretold.id)) m.told.push(m.foretold.id);
  for (const id of m.told) {
    const el = article.querySelector(`[data-frag-id="${CSS.escape(id)}"]`);
    if (el) {
      el.classList.add("foretold");
      el.dataset.told = "14";
    }
  }
  if (room !== 14 && room !== 3) remember(m);
  if (room !== 3) mem = m;

  // Plans: the heading in the AI-2040 register and a plan name under each number.
  // Every plan card looks the same, whatever the reader has done before.
  const year = (R.date.match(/\d{4}/) || [""])[0];
  article.querySelector("#choose-h")?.setAttribute("data-year", year);
  article.querySelectorAll("a.door[data-to]").forEach((a) => {
    const to = Number(a.dataset.to);
    const name = PLAN_NAMES[to];
    if (name) {
      const sub = document.createElement("span");
      sub.className = "door-sub";
      sub.textContent = name;
      a.append(sub);
    }
  });

  // A room you return to after the house has torn keeps its scars.
  article.classList.toggle("scarred", ctx.damage.voids > 0 || ctx.entryD >= 0.36);

  article.addEventListener("click", (e) => {
    const t = e.target;
    const pill = t.closest("[data-pill]");
    if (pill) return onPill(pill, article, ctx);
    const rev = t.closest("[data-reverse]");
    if (rev && tr) {
      tr.rev = rev.getAttribute("aria-pressed") !== "true";
      rev.setAttribute("aria-pressed", String(tr.rev));
      return trGo(article, tr.page);
    }
    const step = t.closest("[data-tr]");
    if (step && tr) return trStep(article, Number(step.dataset.tr));
    const axh = t.closest(".ax-h");
    if (axh) return axToggle(axh.closest(".ax-e"), ctx);
    const axx = t.closest(".ax-x");
    if (axx) return axExcerpt(axx);
    const term = t.closest(".ax-term");
    if (term) return axIndex(term, term.closest(".ax"));
    const ver = t.closest(".ax-v");
    if (ver) return axVerify(ver, ctx);
  });
  article.addEventListener("change", (e) => {
    if (e.target.matches?.(".tr-in") && tr) trGo(article, Number(e.target.value));
  });

  // Fragments land after decorate; the appendix files them once they have.
  if (room === 3) {
    raf = requestAnimationFrame(() => {
      raf = 0;
      axReceived(article);
    });
  }

  // Encounters that switch on when seen. None of them while the house is quiet.
  const watch = [];
  const km = article.querySelector(".keym-turn");
  if (km && !calm) watch.push([km, ctx.walk.log.filter((s) => s.room === room).length > 1, "turned", { rootMargin: "0px 0px -38% 0px", threshold: 0.9 }]);
  const r7 = article.querySelector(".rt-live");
  if (r7) watch.push([r7, calm, "filled", { threshold: 0.2 }]);
  if (watch.length) {
    const ready = new Map();
    for (const [el, now, cls, opt] of watch) {
      if (ctx.reduced || now || !("IntersectionObserver" in window)) el.classList.add(cls);
      else ready.set(el, [cls, opt]);
    }
    if (ready.size) {
      // One observer; the strictest threshold is checked per element.
      io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          const r = ready.get(e.target);
          if (!r || !e.isIntersecting || e.intersectionRatio < r[1].threshold - 0.01) continue;
          e.target.classList.add(r[0]);
          io.unobserve(e.target);
          ready.delete(e.target);
        }
      }, { rootMargin: "0px 0px -30% 0px", threshold: [0.2, 0.5, 0.9] });
      ready.forEach((_, el) => io.observe(el));
    }
  }

  // Dated subsections drive the column's date chip and its picture.
  secs = [...article.querySelectorAll("h2.sec[data-at]")]
    .map((el) => ({ el, mi: monthIndex(el.dataset.at), scene: el.dataset.scene || "", top: 0 }))
    .filter((s) => s.mi != null);

  const gal = article.querySelector(".gallery");
  const plans = article.querySelector(".plans");
  if (gal && !calm) enc = { kind: "gallery", el: gal, top: 0, h: 0, max: { vertical: 0, cable: 0 } };
  else if (plans && !calm) enc = { kind: "plans", el: plans, top: 0, h: 0, max: { path: 0 } };
  measured = false;
  if (enc || secs.length) {
    onResize = () => { measured = false; };
    addEventListener("resize", onResize);
    // Boxes opening and late fonts move things: re-measure when the room changes height.
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(() => { measured = false; });
      ro.observe(article);
    }
  }
}

function measure() {
  measured = true;
  const y = scrollY;
  if (enc?.el.isConnected) {
    const b = enc.el.getBoundingClientRect();
    enc.top = b.top + y;
    enc.h = b.height;
  }
  for (const s of secs) s.top = s.el.getBoundingClientRect().top + y;
  const rep = secs[0]?.el.closest(".report");
  reportEnd = rep ? rep.getBoundingClientRect().bottom + y : 0;
}

function fire(n) {
  if (!mem || mem.fired[n]) return;
  mem.fired[n] = 1;
  remember(mem);
}

export function update(ctx) {
  if (!enc && !secs.length) return;
  if (!measured) measure();
  const y = scrollY;
  const vh = innerHeight;
  if (secs.length) {
    const line = y + vh * 0.42;
    let at = -1;
    for (let i = 0; i < secs.length; i++) if (secs[i].top <= line) at = i;
    const s = secs[at];
    cue("month", s ? s.mi : -1);
    if (s?.scene) {
      const end = secs[at + 1]?.top ?? reportEnd;
      cue("scene", s.scene);
      cue("sceneP", end > s.top ? (line - s.top) / (end - s.top) : 1);
    } else cue("scene", "");
  }
  if (!enc || !enc.h) return;
  const { top, h, max } = enc;
  const step = (a, b, x) => (ctx.reduced ? (x >= b ? 1 : 0) : smooth(a, b, x));
  if (enc.kind === "gallery") {
    // Reaching the crooked chart: the curve stands up. Reading past it: it lets go.
    const mid = y + vh * 0.55;
    max.vertical = Math.max(max.vertical, step(top, top + h * 0.6, mid));
    max.cable = Math.max(max.cable, step(top + h * 0.75, top + h + vh * 0.4, y + vh * 0.5));
    cue("vertical", max.vertical);
    cue("cable", max.cable);
    if (max.cable > 0.5) fire(7);
  } else if (enc.kind === "plans") {
    max.path = Math.max(max.path, step(top - vh * 0.45, top + h * 0.2, y + vh * 0.25));
    cue("path", max.path);
    if (max.path > 0.5) fire(20);
  }
}

export function leave() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  io?.disconnect();
  io = null;
  ro?.disconnect();
  ro = null;
  if (onResize) removeEventListener("resize", onResize);
  onResize = null;
  enc = null;
  secs = [];
  mem = null;
  tr = null;
  cue("vertical", 0);
  cue("cable", 0);
  cue("path", 0);
  cue("month", -1);
  cue("scene", "");
}
