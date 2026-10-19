// The House of 2053: rooms, plans, history, descent, lasting damage and the
// chaos engine. Descent is computed from the reader's real walk: distance from
// Room 1, rooms visited, plans taken, backtracks, loops, void passes, scroll
// within the room, and whether this browser has reached the centre before.
//
// Two kinds of memory:
//   walk  (sessionStorage) the history stack and log of this tab's visit;
//   house (localStorage, chaos.js) damage and fragments. It only ever grows,
//         survives Back, reloads and new tabs, and is cleared only by leaving
//         the house by the ledger (ledger.js).
//
// Module contract (docs/CONTRACT.md): every hook receives ctx() below.
//   early.js  decorate(article, ctx) · update(ctx) · leave()   rooms in EARLY
//   late.js   decorate · update · leave · renderCentre(ctx) · renderOutside(ctx)   rooms in LATE
//   deep.js   decorate · update · leave   rooms in DEEP
//   column.js mountColumn(el) · updateColumn(ctx)   the right-hand instrument column
import { ROOMS, START, CENTRE, OUTSIDE, DIST, MAX_DIST, LATE_ROOMS, DEEP_ROOMS, LONG_ROOMS, GEN_ROOMS, SCROLL_ROOMS, SPATIAL_ROOMS, VOIDS, HIDDEN, plansOf } from "./rooms.js";
import { prose, hash, rng } from "./voice.js";
import { engrave, overlay, warmPlates } from "./plate.js";
import { renderMap } from "./map.js";
import * as early from "./early.js";
import * as late from "./late.js";
import * as deep from "./deep.js";
import * as long from "./long.js";
import * as gen from "./gen.js";
import * as scrollRooms from "./scroll.js";
import * as spatial from "./spatial.js";
import * as living from "./living.js";
import * as scars from "./scars.js";
import * as graphs from "./graphs.js";
import { mountColumn, updateColumn } from "./column.js";
import { loadHouse, saveHouse, newHouse, keep, chose, arm, take, select, place, lift } from "./chaos.js";
import { settled } from "./ledger.js";

const WALK_KEY = "ai2053.house.walk";
const PRIOR_KEY = "ai2053.house.prior";
const root = document.documentElement;
const main = document.getElementById("main");
const dash = document.getElementById("dash");
const params = new URLSearchParams(location.search);
const reducedMQ = matchMedia("(prefers-reduced-motion: reduce)");
const mobileMQ = matchMedia("(max-width: 860px)");

const clamp = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const stageOf = (v) => (v < 0.18 ? 0 : v < 0.36 ? 1 : v < 0.56 ? 2 : v < 0.78 ? 3 : 4);

const overrideRaw = params.get("descent");
const override = overrideRaw !== null && overrideRaw !== "" && Number.isFinite(Number(overrideRaw)) ? clamp(Number(overrideRaw)) : null;

const store = {
  get(s, k) {
    try { return JSON.parse(s.getItem(k)); } catch { return null; }
  },
  set(s, k, v) {
    try { s.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable: the house forgets */ }
  },
};

/* ---------- review reset (out of world; /reset/) ---------- */

// Everything this house keeps lives under "ai2053." keys. /reset/ removes them
// and writes a new epoch. A tab that was opened under an older epoch is stale:
// none of its writes (unload saves, module memories) may land, and it reloads
// itself into the new, clean house as soon as it notices.
const EPOCH_KEY = "ai2053.epoch";
const readEpoch = () => {
  try { return localStorage.getItem(EPOCH_KEY) || "0"; } catch { return "0"; }
};
const epoch = readEpoch();
const stale = () => readEpoch() !== epoch;
{
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (String(k).startsWith("ai2053.") && k !== EPOCH_KEY && stale()) return;
    return setItem.call(this, k, v);
  };
}
addEventListener("storage", (e) => {
  if ((e.key === EPOCH_KEY || e.key === null) && stale()) location.reload();
});
addEventListener("pageshow", (e) => {
  if (e.persisted && stale()) location.reload();
});

let walk;
let house = loadHouse();
let prior = store.get(localStorage, PRIOR_KEY);
let room = START;
let scrollP = 0;
let d = 0;
let entryD = 0;
let plateQ = -1;
let plateJob = 0;
let mod = early;
let sel = { following: [], stuck: [] };

// The outside exists only for a walk that has left.
const validRoom = (n) => Number.isInteger(n) && Object.hasOwn(ROOMS, n) && (n !== OUTSIDE || !!walk?.escaped);
const moduleFor = (n) => (SCROLL_ROOMS.has(n) ? scrollRooms : SPATIAL_ROOMS.has(n) ? spatial : LONG_ROOMS.has(n) ? long : GEN_ROOMS.has(n) ? gen : DEEP_ROOMS.has(n) ? deep : LATE_ROOMS.has(n) ? late : early);

const roomFromHash = () => {
  const m = location.hash.match(/^#room-(\d+)$/);
  const n = m ? Number(m[1]) : NaN;
  return validRoom(n) ? n : null;
};

function newWalk(start, via) {
  return { epoch, log: [{ room: start, via }], stack: [start], idx: 0, base: 0, backtracks: 0, loops: 0, peak: 0, completed: false, started: new Date().toISOString() };
}

/** The read-only snapshot handed to every module hook. */
function ctx() {
  return {
    room, R: ROOMS[room], d, stage: stageOf(d), entryD, scrollP,
    walk, damage: house.damage, prior, escapes: house.escapes,
    chaos: { seq: house.chaos.seq, frags: house.chaos.frags, following: sel.following, stuck: sel.stuck },
    emit: (f) => keep(house, f, room),
    fresh: isFresh(), hidden: HIDDEN[room] ?? [],
    visited: new Set(walk.log.map((s) => s.room)),
    reduced: reducedMQ.matches, mobile: mobileMQ.matches,
  };
}

/**
 * A fresh reader: a house that has never been through a void and has had only
 * a handful of rooms entered. The house holds still for longer for them. An old,
 * damaged house is never fresh again (its scars are not washed away).
 */
function isFresh() {
  return !house.damage.voids && house.chaos.seq < 9 && house.damage.map < 0.3;
}

function save() {
  store.set(sessionStorage, WALK_KEY, walk);
  saveHouse(house);
}

/** Every arrival is logged; arriving in a void is remembered by the house. */
function arrive(entry) {
  walk.log.push(entry);
  if (VOIDS.has(entry.room)) {
    house.damage.voids++;
    house.damage.voidRooms[entry.room] = (house.damage.voidRooms[entry.room] || 0) + 1;
  }
}

function stepThrough(to, say) {
  const from = walk.stack[walk.idx];
  if (walk.log.some((s) => s.room === to)) walk.loops++;
  walk.stack = walk.stack.slice(0, walk.idx + 1);
  walk.stack.push(to);
  walk.idx = walk.stack.length - 1;
  arrive({ room: to, via: "door", from, say });
}

function jumpTo(to) {
  walk.stack = walk.stack.slice(0, walk.idx + 1);
  walk.stack.push(to);
  walk.idx = walk.stack.length - 1;
  arrive({ room: to, via: "jump" });
}

// `?path=1-4-15-1-9` replays a walk (for review). Plans that do not exist
// become jumps. A replayed walk is never settled by the ledger.
function seedWalk(spec) {
  const rooms = spec.split(/[-,. ]+/).map(Number).filter((n) => n !== OUTSIDE && validRoom(n));
  if (!rooms.length) return null;
  walk = newWalk(rooms[0], rooms[0] === START ? "start" : "jump");
  walk.seeded = true;
  for (let i = 1; i < rooms.length; i++) {
    const plan = plansOf(walk.stack[walk.idx]).find((x) => x.to === rooms[i]);
    if (plan) stepThrough(rooms[i], plan.say);
    else jumpTo(rooms[i]);
  }
  return walk;
}

function rawDescent() {
  const visited = new Set(walk.log.map((s) => s.room));
  const plans = walk.log.filter((s) => s.via === "door").length;
  const inVoid = walk.log.filter((s) => VOIDS.has(s.room)).length;
  const floor = prior ? Math.min(0.24, 0.12 * (prior.completions || 1)) : 0;
  return (
    0.5 * ((DIST[room] ?? 0) / MAX_DIST) +
    0.14 * Math.min(1, (visited.size - 1) / 9) +
    0.08 * Math.min(1, plans / 14) +
    Math.min(0.12, 0.04 * walk.backtracks) +
    Math.min(0.2, 0.05 * walk.loops) +
    Math.min(0.16, 0.08 * inVoid) +
    Math.min(0.12, 0.03 * house.damage.voids) +
    floor +
    0.1 * scrollP
  );
}

function descent() {
  if (override !== null) return override;
  if (room === CENTRE) return 1;
  if (room === OUTSIDE) return 0;
  // The false calm: for a fresh reader the first rooms barely move.
  const calm = isFresh() ? 0.35 + 0.65 * smooth(2, 9, house.chaos.seq) : 1;
  const raw = rawDescent() * calm;
  walk.peak = Math.max(walk.peak, raw);
  // You can go back, but you cannot un-know: a floor under the descent.
  return clamp(Math.max(raw, walk.peak * 0.82));
}

/* ---------- rendering ---------- */

const yearOf = (n) => (ROOMS[n].date.match(/\d{4}/) || ["2053"])[0];

function numerology(year) {
  const digits = year.split("").map(Number);
  const sum = digits.reduce((a, b) => a + b, 0);
  const verdict = Object.hasOwn(ROOMS, sum) && sum !== OUTSIDE ? `Room ${sum} exists.` : `There is no Room ${sum}.`;
  return `${year} → ${digits.join(" + ")} = ${sum} → ${verdict}`;
}

function noteText(n, text, dv) {
  let t = esc(text);
  if (dv >= 0.18) t += ` See note ${(Number(n) * 7) % 15 + 1}.`;
  if (dv >= 0.36) t += ` See also this note.`;
  return t;
}

const planCardHTML = ({ to, say }, i) => `<li class="door-li" style="--i:${i}">
        <div class="wire"><svg viewBox="0 0 22 100" preserveAspectRatio="none" aria-hidden="true"><path d="M11 0 L11 100"/></svg><p class="say">“${esc(say)}”</p></div>
        <a class="door" href="#room-${to}" data-to="${to}" data-say="${esc(say)}" aria-label="Plan ${to}: ${esc(say)}">
          <span class="door-k">Plan</span><span class="door-n">${to}</span>
        </a>
      </li>`;

function plansHTML(plans, dv, question) {
  const items = plans.map(planCardHTML).join("");
  const q = question ? `<div class="q"><p>${dv >= 0.56 ? prose(question, dv, hash("q" + room), { path: [], room }) : esc(question)}</p></div>` : "";
  return `<section class="choose" id="doors" aria-labelledby="choose-h">
    <h2 id="choose-h">Plans</h2>
    ${q}
    <ol class="doors" style="--n:${plans.length}">${items}</ol>
  </section>`;
}

const mapSlotHTML = () => `<details class="map-slot" id="mapSlot"><summary>Map <span class="map-slot-n"></span></summary></details>`;

function plateHTML(n, caption) {
  return `<figure class="plate" id="plate">
    <div class="plate-box">
      <canvas class="plate-c" role="img" aria-label="Plate ${n}${caption ? `: ${esc(caption)}` : ""}"></canvas>
      <svg class="plate-o" viewBox="0 0 400 300" aria-hidden="true"></svg>
    </div>
    ${caption ? `<figcaption><b>Plate ${n}.</b> ${esc(caption)}</figcaption>` : ""}
  </figure>`;
}

function renderRoom(dv) {
  const R = ROOMS[room];
  if (R.outside) {
    main.innerHTML = `<article class="room outside" data-room="${OUTSIDE}">${late.renderOutside(ctx())}</article>`;
    return;
  }
  if (room === CENTRE) return renderCentre();
  const path = walk.log.map((s) => s.room);
  const paras = [...R.prose];
  if (room === START && prior) {
    paras.unshift(`Welcome back. Our records show that a visitor walked ${prior.path.join(" · ")} and reached the centre${prior.completions > 1 ? `, ${prior.completions} times` : ""}. We have no record of the centre. Please continue.`);
  }
  // Each paragraph offers one of its sentences to the chaos engine.
  const sentence = (t, i) => {
    const all = t.replace(/\^\d+/g, "").match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()).filter((s) => s.length > 24 && s.length < 140) ?? [];
    return all.length ? all[hash(`${room}:s${i}`) % all.length] : "";
  };
  const P = paras.map((t, i) => {
    const s = sentence(t, i);
    return `<p class="prose"${s ? ` data-frag="line" data-frag-id="${room}:p${i}" data-frag-text="${esc(s)}"` : ""}>${prose(t, clamp(dv + i * 0.05), hash(`${room}:${i}`), { path, room })}</p>`;
  });
  const notes = Object.entries(R.notes || {})
    .map(([n, t]) => `<li id="note-${n}" value="${n}">${noteText(n, t, dv)}</li>`)
    .join("");
  main.innerHTML = `<article class="room" data-room="${room}">
    ${room === START ? `<header class="front" id="front"></header>` : ""}
    <header class="room-head">
      <p class="room-k"><span class="room-no">Room ${room}</span><span class="chip chip-inline">${esc(R.date)}</span></p>
      <h1 tabindex="-1">${R.title ? `${yearOf(room)}: ${esc(R.title)}` : yearOf(room)}</h1>
      ${stageOf(dv) >= 3 ? `<p class="numerology" aria-hidden="true">${numerology(yearOf(room))}</p>` : ""}
      <span class="rule" aria-hidden="true"></span>
    </header>
    ${P[0] ?? ""}
    ${R.plate ? plateHTML(room, R.plate.caption) : ""}
    ${P.slice(1).join("")}
    ${plansHTML(R.doors, dv, R.question)}
    ${mapSlotHTML()}
    ${notes ? `<section class="notes" aria-label="Notes"><h2>Notes</h2><ol>${notes}</ol></section>` : ""}
  </article>`;
}

function renderCentre() {
  const R = ROOMS[CENTRE];
  main.innerHTML = `<article class="room centre" data-room="${CENTRE}">
    <header class="room-head">
      <p class="room-k"><span class="room-no">Room ${CENTRE}</span><span class="chip chip-inline">2053</span></p>
      <h1 tabindex="-1">2053</h1>
    </header>
    ${late.renderCentre(ctx())}
    ${R.plate ? plateHTML(CENTRE, R.plate.caption) : ""}
    ${plansHTML(R.doors, 1, "")}
    ${mapSlotHTML()}
  </article>`;
}

/* ---------- live state ---------- */

function clueFor() {
  const plate = ROOMS[room].plate;
  if (plate?.clue?.dynamic === "loop71") return `71×${walk.log.filter((s) => s.room === 71).length}`;
  if (plate?.clue?.dynamic === "steps") return String(walk.log.filter((s) => s.via === "door").length);
  if (room === START && prior) return String(prior.path.length - 1);
  return undefined;
}

function updatePlate() {
  const plate = ROOMS[room].plate;
  if (!plate) return;
  const svg = main.querySelector(".plate-o");
  if (svg) svg.innerHTML = overlay(room, ROOMS[room].doors, d, { reduced: reducedMQ.matches });
  // The engraving is redrawn only when the house changes stage, not on every scroll step.
  const q = stageOf(d);
  if (q === plateQ) return;
  plateQ = q;
  const canvas = main.querySelector(".plate-c");
  if (!canvas) return;
  const job = ++plateJob;
  const dv = d;
  // Yield a frame so layout has settled before measuring the canvas.
  requestAnimationFrame(() => {
    if (job !== plateJob) return;
    engrave(canvas, plate, dv, { clueText: clueFor(), room }).catch((err) => {
      canvas.closest(".plate")?.classList.add("plate-missing");
      console.warn(err.message);
    });
  });
}

function updateWires() {
  const fr = smooth(0.36, 0.9, d);
  main.querySelectorAll(".wire").forEach((wire, i) => {
    const r = rng(hash(`wire${room}:${i}`));
    const dir = r() < 0.5 ? -1 : 1;
    const detach = fr > 0.45 && r() < 0.65 ? smooth(0.45, 1, fr) : 0;
    const top = detach * (26 + r() * 30);
    const x0 = 11 + dir * detach * 7;
    const sag = fr * 8 * dir;
    const strands = detach > 0.2 ? ` M${x0} ${top} l${-2 * dir} ${-6 * detach} M${x0} ${top} l${2 * dir} ${-5 * detach}` : "";
    const path = wire.querySelector("path");
    if (path) path.setAttribute("d", `M${x0.toFixed(1)} ${top.toFixed(1)} Q${(11 + sag).toFixed(1)} ${(50 + top / 2).toFixed(1)} 11 100${strands}`);
    wire.classList.toggle("loose", detach > 0);
    wire.style.setProperty("--sway", `${(4 + r() * 3).toFixed(2)}s`);
  });
}

function updateTrail() {
  const recent = walk.log.slice(-8);
  document.getElementById("trail").innerHTML =
    (walk.log.length > 8 ? `<span class="t-more">…</span>` : "") +
    recent.map((s, i) => `${i ? `<span class="t-sep">${s.via === "back" ? "↩" : "→"}</span>` : ""}<span class="t-room${i === recent.length - 1 ? " now" : ""}">${s.room}</span>`).join("");
  const slotN = main.querySelector(".map-slot-n");
  if (slotN) {
    const n = new Set(walk.log.map((s) => s.room)).size;
    slotN.textContent = `· ${n}`;
  }
}

/** Record lasting damage. Called on every entry and every stage change. */
function scar() {
  const dm = house.damage;
  // A void tears the map at least this far, and it stays torn.
  const voidFloor = dm.voids ? Math.min(0.94, 0.66 + 0.07 * dm.voids) : 0;
  dm.map = Math.max(dm.map, d, voidFloor);
  dm.rooms[room] = Math.max(dm.rooms[room] || 0, d);
}

function updateMap() {
  const visited = new Set(walk.log.map((s) => s.room));
  visited.delete(OUTSIDE);
  const taken = new Set(walk.log.filter((s) => s.via === "door" && s.from != null).map((s) => `${s.from}>${s.room}`));
  const trail = (walk.idx >= walk.base ? walk.stack.slice(walk.base, walk.idx + 1) : [room]).filter((n) => n !== OUTSIDE);
  const ghost = prior && prior.at < walk.started ? prior.path : null;
  const svg = document.getElementById("map");
  renderMap(svg, {
    visited, taken, trail, current: room, d: override ?? house.damage.map,
    voids: house.damage.voids, voidRooms: house.damage.voidRooms,
    prior: ghost, walkRooms: walk.log.map((s) => s.room).filter((n) => n !== OUTSIDE), reduced: reducedMQ.matches,
  });
  svg.setAttribute("aria-label", "Map");
}

function apply(force) {
  const nd = descent();
  if (!force && Math.abs(nd - d) < 0.004) {
    const c = ctx();
    mod.update(c);
    living.update(c);
    scars.update(c);
    graphs.update(c);
    updateColumn(c);
    return;
  }
  d = nd;
  const st = stageOf(d);
  root.dataset.stage = String(st);
  root.style.setProperty("--d", d.toFixed(3));
  root.style.setProperty("--fray", smooth(0.36, 0.88, d).toFixed(3));
  if (room !== OUTSIDE) scar();
  root.style.setProperty("--map-d", house.damage.map.toFixed(3));
  updateTrail();
  updateMap();
  updateWires();
  updatePlate();
  const c = ctx();
  updateColumn(c);
  mod.update(c);
  living.update(c);
  scars.update(c);
  graphs.update(c);
}

function placeMap() {
  const fig = document.getElementById("mapFig");
  const slot = document.getElementById("mapSlot");
  if (mobileMQ.matches && slot) slot.append(fig);
  else if (fig.parentElement !== dash) dash.append(fig);
}

let entered = false;
function enter({ focus }) {
  // What the reader looked at in the room they are leaving may follow them.
  if (entered && room !== OUTSIDE) take(house, room);
  entered = true;
  mod.leave();
  living.leave();
  scars.leave();
  graphs.leave();
  lift(document.getElementById("column"));
  room = walk.stack[walk.idx];
  mod = moduleFor(room);
  if (room === CENTRE && !walk.completed) {
    walk.completed = true;
    prior = { completions: (prior?.completions || 0) + 1, path: walk.log.map((s) => s.room), at: new Date().toISOString() };
    store.set(localStorage, PRIOR_KEY, prior);
  }
  scrollP = 0;
  window.scrollTo(0, 0);
  // Prose is corrupted once, on entry, so it never reflows under the reader.
  // A room you return to is at least as damaged as you left it.
  d = descent();
  entryD = room === OUTSIDE ? 0 : Math.max(d, house.damage.rooms[room] || 0);
  if (room !== OUTSIDE) {
    scar();
    house.chaos.seq++;
    sel = select(house, room, stageOf(entryD));
  } else {
    sel = { following: [], stuck: [] };
  }
  save();
  // On mobile the map lives inside the room; bring it home before the room is replaced.
  dash.append(document.getElementById("mapFig"));
  renderRoom(entryD);
  // Every entry starts at the top of the new page. A room that wants another
  // entry (e.g. arriving at the bottom of 2054) sets it in its decorate().
  window.scrollTo(0, 0);
  plateQ = -1;
  placeMap();
  const article = main.querySelector("article");
  mod.decorate(article, ctx());
  apply(true);
  if (room !== OUTSIDE) {
    place(article, document.getElementById("column"), sel, room, house.chaos.seq);
    living.decorate(article, ctx());
    scars.decorate(article, ctx());
    graphs.decorate(article, ctx());
    arm(article);
  }
  const R = ROOMS[room];
  document.title = room === START || R.outside ? "AI 2053" : `${yearOf(room)}: ${R.title} · AI 2053`;
  if (focus) main.querySelector("h1")?.focus({ preventScroll: true });
  holdStart(article);
  requestAnimationFrame(() => requestAnimationFrame(ensureOnward));
  // While the reader is in this room, prepare the plates behind its plans.
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 400));
  const here = room;
  idle(() => {
    if (room !== here) return;
    const box = main.querySelector(".plate-box") ?? main;
    warmPlates(R.doors.map(({ to }) => ROOMS[to]?.plate), box.clientWidth);
  });
}

/** Leaving by the ledger: the house is cleared and the walk goes outside. */
function leaveHouse() {
  house = newHouse(house.escapes + 1);
  entered = false; // nothing from inside is carried out
  walk.escaped = true;
  walk.stack[walk.idx] = OUTSIDE;
  walk.log[walk.log.length - 1].room = OUTSIDE;
}

/* ---------- plan surfaces ---------- */

// Only real plans may look like plans. Any a[data-to] in the page that does not
// leave this room (listed or hidden) is unwrapped back into plain text, whoever
// drew it and whenever (generated pages draw some later).
let sweepQueued = false;
function sweepPlans() {
  sweepQueued = false;
  if (room === OUTSIDE) return;
  const ok = new Set(plansOf(room).map((p) => p.to));
  for (const a of main.querySelectorAll("a[data-to]")) {
    if (ok.has(Number(a.dataset.to))) continue;
    const span = document.createElement("span");
    span.className = a.className.replace(/\b(plan-in|door)\b/g, "").trim();
    span.append(...a.childNodes);
    a.replaceWith(span);
  }
}
new MutationObserver(() => {
  if (sweepQueued) return;
  sweepQueued = true;
  queueMicrotask(sweepPlans);
}).observe(main, { childList: true, subtree: true });

/* ---------- the start of a room ---------- */

// The house owns where a room starts. Motion already under way when the reader
// chose (a touch fling's momentum, an elastic bounce at the foot of the page, a
// smooth scroll) belongs to the room they left, and browsers keep running it after
// the page is replaced, past the scrollTo(0, 0) in enter(). So until the reader acts
// in the new room (touch, pointer, wheel, key), any scroll that arrives is that
// leftover motion, and the room is put back at its start. The hold ends at the
// reader's first input or once the page has been still for a moment. Rooms that
// place the reader themselves (2054 opens at its end) mark data-entry="own".
const READER_INPUT = ["touchstart", "pointerdown", "wheel", "keydown"];
let holding = null;
function holdStart(article) {
  holdRelease();
  if (!article || article.dataset.entry === "own") return;
  const h = {
    quiet: 0,
    onScroll() {
      if (scrollY > 0.5) window.scrollTo({ top: 0, behavior: "instant" });
      clearTimeout(h.quiet);
      h.quiet = setTimeout(holdRelease, 600);
    },
  };
  holding = h;
  h.quiet = setTimeout(holdRelease, 600);
  addEventListener("scroll", h.onScroll, { passive: true });
  for (const t of READER_INPUT) addEventListener(t, holdRelease, { capture: true, passive: true });
}
function holdRelease() {
  const h = holding;
  if (!h) return;
  holding = null;
  clearTimeout(h.quiet);
  removeEventListener("scroll", h.onScroll);
  for (const t of READER_INPUT) removeEventListener(t, holdRelease, { capture: true });
}

/* ---------- a way onward ---------- */

// However the room, the living layer, debris or a generator have rearranged
// things, every plan the room lists stays somewhere a reader can see and press:
// its card, or a surface in the text. A listed plan with neither (its place
// folded away, hidden, covered or rebuilt) has its card drawn again in the
// room's list. Hidden plans are extra ways out, never the only one.
const PLACE_GONE = "details:not([open]) > :not(summary), [hidden], [inert], [aria-hidden='true']";
function pressable(a) {
  if (!a.isConnected || a.closest(PLACE_GONE)) return false;
  const r = [...a.getClientRects()].find((q) => q.width >= 8 && q.height >= 8);
  if (!r) return false;
  const cs = getComputedStyle(a);
  if (cs.visibility !== "visible" || cs.pointerEvents === "none") return false;
  for (let e = a; e && e !== main; e = e.parentElement) if (Number(getComputedStyle(e).opacity) < 0.25) return false;
  return true;
}
function ensureOnward() {
  const article = main.querySelector("article");
  if (room === OUTSIDE || !article) return;
  const missing = (ROOMS[room].doors ?? []).filter((p) => ![...main.querySelectorAll(`a[data-to="${p.to}"]`)].some(pressable));
  if (!missing.length) return;
  let ol = article.querySelector("ol.doors");
  if (!ol || !ol.getClientRects().length || ol.closest(PLACE_GONE)) {
    article.insertAdjacentHTML("beforeend", `<section class="choose" aria-label="Plans"><ol class="doors"></ol></section>`);
    ol = article.querySelector("section.choose:last-of-type ol.doors");
  }
  for (const plan of missing) {
    // A card of this plan that cannot be pressed where it is (covered, folded) is replaced, not doubled.
    ol.querySelector(`a.door[data-to="${plan.to}"]`)?.closest("li")?.remove();
    const t = document.createElement("template");
    t.innerHTML = planCardHTML(plan, ol.children.length).trim();
    ol.append(t.content.firstElementChild);
  }
  ol.style.setProperty("--n", String(ol.children.length));
}
let onwardAt = 0;

/* ---------- events ---------- */

document.addEventListener("click", (e) => {
  const plan = e.target.closest("a[data-to]");
  if (plan && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    const to = Number(plan.dataset.to);
    // Only the plans that really leave this room (listed or hidden) are plans.
    if (!validRoom(to) || !plansOf(room).some((p) => p.to === to) || !main.contains(plan)) return;
    chose(house, room, to, plan.dataset.say);
    stepThrough(to, plan.dataset.say);
    if (!walk.seeded && override === null && settled(walk.log)) leaveHouse();
    history.pushState({ lab: 1, idx: walk.idx }, "", `#room-${walk.stack[walk.idx]}`);
    enter({ focus: true });
    return;
  }
  const note = e.target.closest('a[href^="#note-"]');
  if (note) {
    // Footnotes scroll within the room; they are not rooms and leave no history.
    e.preventDefault();
    const target = document.getElementById(note.getAttribute("href").slice(1));
    if (target) {
      target.setAttribute("tabindex", "-1");
      target.scrollIntoView({ block: "center", behavior: reducedMQ.matches ? "auto" : "smooth" });
      target.focus({ preventScroll: true });
    }
  }
});

addEventListener("popstate", (e) => {
  const st = e.state;
  if (st?.lab && st.idx === walk.idx) return;
  if (st?.lab && walk.stack[st.idx] != null) {
    const via = st.idx < walk.idx ? "back" : "forward";
    if (via === "back") walk.backtracks++;
    walk.idx = st.idx;
    arrive({ room: walk.stack[walk.idx], via });
  } else {
    const h = roomFromHash();
    if (h == null) return;
    // A hand-edited address: the reader arrived without a plan.
    jumpTo(h);
    history.replaceState({ lab: 1, idx: walk.idx }, "", `#room-${h}`);
  }
  enter({ focus: true });
});

let ticking = false;
addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollP = max > 0 ? clamp(scrollY / max) : 0;
    apply(false);
    const now = performance.now();
    if (now - onwardAt > 1200) { onwardAt = now; ensureOnward(); }
  });
}, { passive: true });

let resizeTimer = 0;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    placeMap();
    plateQ = -1;
    apply(true);
  }, 180);
});
mobileMQ.addEventListener("change", placeMap);
reducedMQ.addEventListener("change", () => enter({ focus: false }));
addEventListener("pagehide", () => {
  if (room !== OUTSIDE) take(house, room);
  save();
});

// Drift: once the house starts drifting, its figures keep updating after you stop.
setInterval(() => {
  if (reducedMQ.matches || document.hidden || stageOf(d) < 1) return;
  for (const el of main.querySelectorAll(".num")) {
    const k = Number(el.dataset.k || 0) + 1;
    el.dataset.k = String(k);
    const dec = Number(el.dataset.dec);
    const v = Number(el.dataset.v) * (1 + 0.006 * k * (1 + d)) + (dec ? 0 : k);
    el.lastChild.textContent = ` ${dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-US")}`;
  }
}, 2400);

/* ---------- start ---------- */

function init() {
  // The house owns where a page starts; the browser must not restore an old
  // scroll offset over a new room on Back, Forward or reload.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  mountColumn(document.getElementById("column"));
  const saved = store.get(sessionStorage, WALK_KEY);
  const st = history.state;
  if (st?.lab && saved?.stack?.[st.idx] != null && (saved.epoch ?? "0") === epoch) {
    walk = saved;
    const hashRoom = roomFromHash();
    if (hashRoom == null || saved.stack[st.idx] === hashRoom) {
      walk.idx = st.idx;
      enter({ focus: false });
      return;
    }
  }
  walk = null;
  // A tab whose walk was made before a review reset starts over at the opening.
  if (saved && (saved.epoch ?? "0") !== epoch) {
    walk = newWalk(START, "start");
    history.replaceState({ lab: 1, idx: 0 }, "", `${location.pathname}#room-${START}`);
    enter({ focus: false });
    return;
  }
  const q = Number(params.get("room"));
  const seeded = params.get("path") ? seedWalk(params.get("path")) : null;
  if (seeded) {
    if (validRoom(q) && q !== walk.stack[walk.idx]) jumpTo(q);
  } else {
    const hashRoom = roomFromHash();
    const start = hashRoom ?? (validRoom(q) ? q : START);
    walk = newWalk(start, start === START ? "start" : "jump");
    if (start !== START) walk.seeded = true;
  }
  history.replaceState({ lab: 1, idx: walk.idx }, "", `#room-${walk.stack[walk.idx]}`);
  enter({ focus: false });
}

init();
