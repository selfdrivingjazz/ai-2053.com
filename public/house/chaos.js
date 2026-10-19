// The chaos engine: the house's memory of itself, above any one room.
//
// House state lives in localStorage (it outlasts a tab; only leaving the house
// properly clears it):
//   { v, damage: { map, voids, voidRooms: {n: entries}, rooms: {n: worst d} },
//     chaos: { seq, frags: [Fragment], stuck: {room: [id]} }, escapes }
// Fragment: { id, kind, from, text, data?, at (seq first taken), last (seq last
//   taken), n (times it has turned up somewhere it does not belong) }
// Kinds: line · figure · token · number · plan · label · curve · stamp.
//
// Renderers declare what can be carried off by marking elements:
//   data-frag="<kind>"  [data-frag-id] [data-frag-text] [data-frag-data='{"points":[…]}']
// Anything marked that the reader actually looked at (≥50% visible for ~1s)
// is taken when they leave the room. Renderers may also mark containers with
// data-slot="<kinds>|*" to invite fragments to land there, and may call
// ctx.emit(fragment) to plant one directly.
//
// Every choice below is seeded by (fragment id, room, house seq): the same walk
// produces the same contamination.
import { fnv } from "./ledger.js";
import * as voice from "./voice.js";
import { GLITCH } from "./rooms.js";

const KEY = "ai2053.house";
const MAX_FRAGS = 32;
const MAX_STUCK_ROOM = 3;
const MAX_STUCK_TOTAL = 48;
const MAX_TAKE = 3;
const MAX_PLACED = 6;
const DWELL = 900;
const KINDS = new Set(["line", "figure", "token", "number", "plan", "label", "curve", "stamp"]);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function newHouse(escapes = 0) {
  return { v: 2, damage: { map: 0, voids: 0, voidRooms: {}, rooms: {} }, chaos: { seq: 0, frags: [], stuck: {} }, escapes };
}

export function loadHouse() {
  let h = null;
  try { h = JSON.parse(localStorage.getItem(KEY)); } catch { /* unreadable: start clean */ }
  if (!h || h.v !== 2) return newHouse();
  h.damage.voidRooms ??= {};
  retire(h);
  return h;
}

// The old anomaly tokens are retired: carried fragments made of them are rewritten
// in the house's newer forms. Nothing else about the house changes.
const STALE = new Set(GLITCH.map((t) => t.trim()));
function retire(h) {
  if (typeof voice.restale !== "function") return;
  for (const f of h.chaos.frags) {
    if (!STALE.has(String(f.text).trim()) && !GLITCH.some((t) => String(f.text).includes(t.trim()))) continue;
    const r = voice.restale(f.text);
    if (!r) continue;
    f.kind = KINDS.has(r.kind) ? r.kind : f.kind;
    f.text = String(r.text).slice(0, 140);
    if (r.data !== undefined) f.data = r.data;
  }
}

export function saveHouse(h) {
  try { localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* storage unavailable: the house forgets */ }
}

function clean(f, room) {
  if (!f || !KINDS.has(f.kind)) return null;
  const text = String(f.text ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  if (!text && f.kind !== "curve") return null;
  let data;
  if (f.data != null) {
    const s = JSON.stringify(f.data);
    if (s.length <= 300) data = f.data;
  }
  return { id: String(f.id ?? `${room}:${f.kind}:${fnv(text)}`).slice(0, 60), kind: f.kind, from: Number(f.from ?? room), text, ...(data ? { data } : {}) };
}

/** Add or refresh a fragment. Oldest unstuck fragments are forgotten beyond the cap. */
export function keep(house, frag, room) {
  const f = clean(frag, room);
  if (!f) return null;
  const c = house.chaos;
  const old = c.frags.find((x) => x.id === f.id);
  if (old) {
    old.last = c.seq;
    old.text = f.text;
    return old;
  }
  c.frags.push({ ...f, at: c.seq, last: c.seq, n: 0 });
  const stuck = new Set(Object.values(c.stuck).flat());
  while (c.frags.length > MAX_FRAGS) {
    const i = c.frags.findIndex((x) => !stuck.has(x.id));
    c.frags.splice(i < 0 ? 0 : i, 1);
  }
  return f;
}

/** A plan the reader chose follows them as a fragment of its own. */
export function chose(house, from, to, say) {
  if (!say) return;
  keep(house, { kind: "plan", id: `plan:${from}>${to}`, from, text: say, data: { to } }, from);
}

/* ---------- harvesting what the reader actually saw ---------- */

let io = null;
let watched = new Map();

export function arm(article) {
  disarm();
  watched = new Map();
  const els = [...article.querySelectorAll("[data-frag]")].slice(0, 40);
  if (!els.length || !("IntersectionObserver" in window)) return;
  io = new IntersectionObserver((entries) => {
    const now = performance.now();
    for (const e of entries) {
      const rec = watched.get(e.target);
      if (!rec) continue;
      if (e.isIntersecting && e.intersectionRatio >= 0.5) {
        if (!rec.since) rec.since = now;
        rec.first ??= now;
      } else if (rec.since) {
        rec.total += now - rec.since;
        rec.since = 0;
      }
    }
  }, { threshold: [0, 0.5] });
  els.forEach((el, i) => {
    watched.set(el, { i, since: 0, total: 0, first: null });
    io.observe(el);
  });
}

function disarm() {
  io?.disconnect();
  io = null;
}

/** On leaving a room: keep up to three things the reader looked at there. */
export function take(house, room) {
  const now = performance.now();
  const seen = [];
  for (const [el, rec] of watched) {
    const t = rec.total + (rec.since ? now - rec.since : 0);
    if (t >= DWELL) seen.push({ el, first: rec.first ?? 0, i: rec.i });
  }
  disarm();
  watched = new Map();
  seen.sort((a, b) => a.first - b.first || a.i - b.i);
  for (const { el, i } of seen.slice(-MAX_TAKE)) {
    let data;
    try { data = el.dataset.fragData ? JSON.parse(el.dataset.fragData) : undefined; } catch { data = undefined; }
    keep(house, {
      kind: el.dataset.frag,
      id: el.dataset.fragId || `${room}:${el.dataset.frag}:${i}`,
      from: room,
      text: el.dataset.fragText ?? el.textContent,
      data,
    }, room);
  }
}

/* ---------- what turns up in this room ---------- */

/**
 * Decide which fragments follow the reader into `room` this time, and which of
 * them stick to it for good. Call once per entry, after house.chaos.seq has
 * advanced. Returns { following, stuck } (fragments).
 */
export function select(house, room, stage) {
  const c = house.chaos;
  const byId = new Map(c.frags.map((f) => [f.id, f]));
  const stuckIds = (c.stuck[room] ||= []).filter((id) => byId.has(id));
  c.stuck[room] = stuckIds;
  const voids = house.damage.voids;
  // A fresh house holds still: nothing follows anyone for the first rooms.
  const calm = !voids && c.seq < 6;
  const k = calm ? 0 : Math.min(4, 1 + (c.seq > 9 ? 1 : 0) + Math.min(2, voids) + (stage >= 3 ? 1 : 0));
  // The plan you just chose is the least surprising thing to find following
  // you; until the house has a void in it, plans lag two steps behind.
  const recency = (f) => f.last - (f.kind === "plan" && !voids ? 2.5 : 0);
  const following = c.frags
    .filter((f) => f.from !== room && !stuckIds.includes(f.id))
    .sort((a, b) => recency(b) - recency(a) || b.at - a.at)
    .slice(0, k);
  let total = Object.values(c.stuck).reduce((a, l) => a + l.length, 0);
  for (const f of following) {
    if (stuckIds.length >= MAX_STUCK_ROOM || total >= MAX_STUCK_TOTAL) break;
    if (fnv(`${f.id}|${room}|${c.seq}`) % 6 < 1 + Math.min(3, voids)) {
      stuckIds.push(f.id);
      total++;
    }
  }
  const stuck = stuckIds.map((id) => byId.get(id));
  for (const f of [...following, ...stuck]) f.n = (f.n || 0) + 1;
  return { following: following.filter((f) => !stuckIds.includes(f.id)), stuck };
}

/* ---------- placing them ---------- */

function curveSVG(pts) {
  if (!Array.isArray(pts) || pts.length < 2) return "";
  const xs = pts.map((p, i) => (Array.isArray(p) ? p[0] : i));
  const ys = pts.map((p) => (Array.isArray(p) ? p[1] : p));
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const P = pts.map((_, i) => `${(((xs[i] - x0) / (x1 - x0 || 1)) * 100).toFixed(1)},${(30 - ((ys[i] - y0) / (y1 - y0 || 1)) * 28).toFixed(1)}`);
  return `<svg viewBox="-2 -2 104 34" aria-hidden="true"><polyline points="${P.join(" ")}"/></svg>`;
}

function fragHTML(f, how, rot) {
  const t = esc(f.text);
  const attrs = `class="cf cf-${f.kind} cf-${how}" data-cf-from="${f.from}" style="--cf-n:${Math.min(6, f.n || 1)};--cf-r:${rot.toFixed(1)}deg"`;
  switch (f.kind) {
    case "plan":
      // A carried plan is only its words: nothing here may look like a plan that does not work.
      return `<span ${attrs}><i>“${t}”</i></span>`;
    case "figure":
      return `<span ${attrs}><b>${esc(f.data?.value ?? t)}</b>${f.data?.value ? `<small>${t}</small>` : ""}</span>`;
    case "curve":
      return `<span ${attrs}>${curveSVG(f.data?.points)}${t ? `<small>${t}</small>` : ""}</span>`;
    case "number":
      return `<span ${attrs} aria-hidden="true">${t}</span>`;
    default:
      return `<span ${attrs}>${t}</span>`;
  }
}

// Where each kind prefers to land, in order of preference.
const PREFER = {
  line: ["slot", "prose", "margin", "note", "q"],
  figure: ["slot", "column", "margin", "plate", "prose"],
  token: ["slot", "prose", "q", "column"],
  number: ["slot", "margin", "plate", "column"],
  plan: ["slot", "q", "margin", "prose"],
  label: ["slot", "plate", "column", "margin", "prose"],
  curve: ["slot", "column", "margin", "plate"],
  stamp: ["slot", "margin", "plate", "q"],
};

function sentenceBreak(p, r) {
  const nodes = [];
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/[.!?;]\s/.test(n.textContent)) nodes.push(n);
  if (!nodes.length) return null;
  const node = nodes[r % nodes.length];
  const idx = node.textContent.search(/[.!?;]\s/) + 2;
  return node.splitText(idx);
}

/**
 * Put the selected fragments into the rendered article. Returns how many landed.
 * `column` is the instrument column element (fragments may adhere to it).
 */
export function place(article, column, sel, room, seq) {
  const prose = [...article.querySelectorAll(".prose")];
  const slots = [...article.querySelectorAll("[data-slot]")];
  const used = new Set();
  const margins = new Set();
  let placed = 0;
  const all = [...sel.stuck.map((f) => [f, "stuck"]), ...sel.following.map((f) => [f, "follow"])];
  for (const [f, how] of all) {
    if (placed >= MAX_PLACED) break;
    const h = fnv(`${f.id}|${room}|${how === "stuck" ? "s" : seq}`);
    const rot = ((h % 9) - 4) * (how === "stuck" ? 0.6 : 1.2);
    const html = fragHTML(f, how, rot);
    let done = false;
    for (const where of PREFER[f.kind] ?? PREFER.line) {
      if (done) break;
      if (where === "slot") {
        const open = slots.filter((s) => !used.has(s) && (s.dataset.slot === "*" || s.dataset.slot.split(/\s+/).includes(f.kind)));
        if (!open.length) continue;
        const s = open[h % open.length];
        s.insertAdjacentHTML("beforeend", html);
        used.add(s);
        done = true;
      } else if (where === "prose" && prose.length) {
        const p = prose[h % prose.length];
        if (used.has(p)) continue;
        const at = sentenceBreak(p, h >>> 3);
        if (!at) continue;
        const tmp = document.createElement("span");
        tmp.innerHTML = html;
        at.parentNode.insertBefore(tmp.firstChild, at);
        used.add(p);
        done = true;
      } else if (where === "margin" && prose.length) {
        const p = prose[(h >>> 5) % prose.length];
        if (margins.has(p)) continue;
        p.insertAdjacentHTML("beforebegin", `<aside class="cf-margin${h % 2 ? " cf-left" : ""}">${html}</aside>`);
        margins.add(p);
        done = true;
      } else if (where === "note") {
        let ol = article.querySelector(".notes ol");
        if (!ol) {
          article.insertAdjacentHTML("beforeend", `<section class="notes" aria-label="Notes"><h2>Notes</h2><ol></ol></section>`);
          ol = article.querySelector(".notes ol");
        }
        ol.insertAdjacentHTML("beforeend", `<li class="cf-note">${html}</li>`);
        done = true;
      } else if (where === "q") {
        const q = article.querySelector(".q p");
        if (!q || used.has(q)) continue;
        q.insertAdjacentHTML("beforeend", ` ${html}`);
        used.add(q);
        done = true;
      } else if (where === "plate") {
        const box = article.querySelector(".plate-box");
        if (!box || used.has(box)) continue;
        box.insertAdjacentHTML("beforeend", `<div class="cf-on-plate" style="--x:${8 + (h % 70)}%;--y:${10 + ((h >>> 4) % 70)}%">${html}</div>`);
        used.add(box);
        done = true;
      } else if (where === "plans") {
        const ol = article.querySelector(".doors");
        if (!ol || used.has(ol)) continue;
        ol.insertAdjacentHTML("afterend", `<div class="cf-plans">${html}</div>`);
        used.add(ol);
        done = true;
      } else if (where === "column" && column && !column.hidden && column.offsetParent) {
        if (column.querySelectorAll(".cf").length >= 2) continue;
        column.insertAdjacentHTML("beforeend", `<div class="cf-on-col" style="--x:${(h % 60) + 4}%;--y:${10 + ((h >>> 4) % 60)}%">${html}</div>`);
        done = true;
      }
    }
    if (done) placed++;
  }
  return placed;
}

/** Remove fragments the engine put outside the article (the article is replaced anyway). */
export function lift(column) {
  column?.querySelectorAll(".cf-on-col").forEach((n) => n.remove());
}
