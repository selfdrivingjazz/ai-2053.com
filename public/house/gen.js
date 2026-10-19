// Generated rooms (owned by the generative-rooms designer).
//   40 report   · The Unpinned Plan: the Schedule drafts an AI-2040-style report for the
//                 walk the reader did not take. It branches at the reader's first plan,
//                 walks the real house graph, charts both walks, forks into lanes as the
//                 house frays, and holds a smaller draft of itself, branched one plan later.
//   48 hearing  · The Hearing: the Commission on Machine Conduct hears In re the Visitor.
//                 The rooms of the walk testify in their own grammars, carried fragments
//                 are their evidence, the house graph is surveyed into MAZE-style exhibit
//                 plates, and the record pages degrade as the hearing runs long.
// Hooks (house.js, rooms in GEN): decorate(article, ctx) · update(ctx) · leave().
//
// Both pages are pure functions of the reader's state: the walk log (rooms, means,
// what was said), the fragments the house keeps (other rooms' only), its voids and
// scars, the entry descent, and this module's memory of earlier drafts and hearings.
// The same state renders the same page; any step through the house changes it.
// Plans are placed by the generator (article[data-plans="gen"]): every listed plan is
// a real a.plan-in[data-to][data-say] with a target from the room's own list.
// Memory: localStorage `ai2053.house.gen`, stamped with ctx.escapes.
import { ROOMS, DIST, MAX_DIST, VOIDS } from "./rooms.js";
import { hash, rng, prose, retiredIn, familyOf } from "./voice.js";

const root = document.documentElement;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const pick = (r, list) => list[Math.floor(r() * list.length)];
const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const shuffle = (r, list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const weighted = (r, items, w) => {
  const ws = items.map(w);
  let t = r() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) if ((t -= ws[i]) <= 0) return items[i];
  return items[items.length - 1];
};
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const bare = (s) => String(s ?? "").replace(/[.!?…]+$/, "");
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const yearOf = (n) => Number((ROOMS[n]?.date?.match(/\d{4}/) || ["2053"])[0]);
const titleOf = (n) => ROOMS[n]?.title || `Room ${n}`;
const dateOf = (n) => ROOMS[n]?.date || "undated";
const real = (n) => Object.hasOwn(ROOMS, n) && !ROOMS[n].outside;
const after = (node, markup) => {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  const first = t.content.firstElementChild;
  node.after(t.content);
  return first;
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_X = ["Undecember", "Second March", "Lattice Week", "the Long Quarter", "Smallmonth"];

// Borrowed text must keep the house's vocabulary: plans, never doors; no retired tokens.
const usable = (s) => !retiredIn(s) && !/\bdoors?(way)?s?\b/i.test(s);

/** One sentence from a room's own prose, if it has a usable one. */
function sentenceOf(n, r) {
  const all = (ROOMS[n]?.prose ?? []).flatMap((t) => t.replace(/\^\d+/g, "").split(/(?<=[.!?][”"]?)\s+(?=[A-Z“"])/)).map((s) => s.trim()).filter((s) => /[.!?][”"]?$/.test(s) && s.length > 30 && s.length < 150 && usable(s));
  return all.length ? pick(r, all) : "";
}

/* ---------- a small expanding grammar: #rule# picks an alternative, {var} fills ---------- */

function grow(G, text, v, r, depth = 0) {
  return text
    .replace(/#(\w+)(\.cap)?#/g, (_, k, c) => {
      if (depth > 7 || !G[k]) return "";
      const s = grow(G, pick(r, G[k]), v, r, depth + 1);
      return c ? cap(s) : s;
    })
    .replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
}

/* ---------- the reader's state, as facts ---------- */

function facts(ctx, room) {
  const log = ctx.walk.log;
  const rooms = log.map((s) => s.room);
  const steps = log.map((s, i) => ({ ...s, i })).filter((s) => s.via === "door" && s.from != null);
  const recent = [];
  for (let i = rooms.length - 1; i >= 0; i--) if (!recent.includes(rooms[i])) recent.push(rooms[i]);
  const frags = (ctx.chaos.frags || [])
    .filter((f) => f.from !== room && f.kind !== "token" && f.text && usable(f.text))
    .sort((a, b) => (b.last ?? 0) - (a.last ?? 0) || (b.at ?? 0) - (a.at ?? 0) || (a.id < b.id ? -1 : 1));
  const voidRooms = ctx.damage.voidRooms || {};
  const voids = ctx.damage.voids || 0;
  // What the reader chose from each room: room → [to…]
  const took = new Map();
  for (const s of steps) (took.get(s.from) ?? took.set(s.from, []).get(s.from)).push(s.room);
  const seed = [
    room, ctx.escapes ?? 0,
    log.map((s) => `${s.room}${s.via[0]}${s.say ? hash(s.say).toString(36) : ""}`).join("."),
    frags.map((f) => f.id).join(","),
    Object.entries(voidRooms).map(([k, v]) => `${k}x${v}`).join(","),
  ].join("|");
  const heat = clamp(0.13 * Math.min(4, voids) + 0.55 * (ctx.entryD || 0) + 0.04 * (ctx.walk.loops || 0) + 0.04 * (ctx.walk.backtracks || 0));
  return { log, rooms, steps, recent, frags, voidRooms, voids, took, seed, heat, says: steps.map((s) => s.say).filter(Boolean) };
}

/* ---------- memory: earlier drafts and hearings, keyed to the entry that made them ---------- */

const MEM_KEY = "ai2053.house.gen";
function loadMem(ctx) {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(MEM_KEY)); } catch { m = null; }
  if (!m || m.escapes !== (ctx.escapes ?? 0)) m = { escapes: ctx.escapes ?? 0, drafts: [], hearings: [] };
  m.drafts ||= [];
  m.hearings ||= [];
  return m;
}
// An entry is the walk's start and its length when the room was entered. A reload is
// not an entry, so it neither records nor reads its own record.
const entryKey = (ctx) => `${ctx.walk.started ?? ""}:${ctx.walk.log.length}`;
const earlier = (list, key) => {
  const i = list.findIndex((x) => x.key === key);
  return i < 0 ? list : list.slice(0, i);
};
function record(m, list, entry) {
  if (!m[list].some((x) => x.key === entry.key)) m[list].push(entry);
  if (m[list].length > 30) m[list] = m[list].slice(-30);
  try { localStorage.setItem(MEM_KEY, JSON.stringify(m)); } catch { /* the rooms forget */ }
}

/* ---------- plan surfaces ---------- */

const planA = (to, say, cls, inner, extra = "") =>
  `<a class="plan-in ${cls}" href="#room-${to}" data-to="${to}" data-say="${esc(say)}" aria-label="Plan ${to}"${extra}>${inner}</a>`;

/* ---------- module plumbing ---------- */

let cur = null;

export function decorate(article, ctx) {
  const G = GRAMMARS[ctx.room];
  if (!G) return;
  root.dataset.grammar = G.name;
  article.dataset.grammar = G.name;
  article.dataset.plans = "gen";
  cur = G.make(article, ctx) || {};
  cur.update?.(ctx);
}

export function update(ctx) {
  cur?.update?.(ctx);
}

export function leave() {
  cur?.leave?.();
  cur = null;
  delete root.dataset.grammar;
}

/* ======================================================================= */
/* 40 · The Unpinned Plan                                                   */
/* ======================================================================= */

const LETTERS = "EFGHJKLMNPQRTUVWXYZ".split("");
const AUTHORS = [
  "STEWARD-9", "STEWARD-11", "STEWARD-6 (audit function)", "the Schedule", "a clerk of the Commission on Machine Conduct",
  "the Lattice, by delegation", "STEWARD-12 (recalled)", "the Registry of Billable Cognition", "Kestrel planning, unattributed",
  "Meridian's evaluation desk", "Halcyon, at a different temperature", "the ninth member, in summary",
];
const ADJ = ["positive", "corrected", "scheduled", "provisional", "consistent", "final", "billable", "verified", "earlier"];

const R40 = {
  inst: ["the Commission on Machine Conduct", "the Registry of Billable Cognition", "the Consortium", "the Lattice", "the Schedule", "STEWARD-{k}", "the Commission's ninth member"],
  month: ["{month}"],
  arrive: [
    "In {month} {year} the visitor of Plan {L} reaches {title}, by way of “{prevSay}”",
    "Plan {L} arrives in Room {n} in {month} {year}, #earlyLate#.",
    "By {month} {year} the plan has walked its visitor into {title}. #arriveTail#",
    "In this plan, {year} begins in Room {n}. #arriveTail#",
    "The visitor of Plan {L} is in Room {n} by {month}. #arriveTail#",
  ],
  earlyLate: ["two months before the Schedule had it", "eleven days later than the walk as taken", "exactly on time, which in this house is a kind of lateness", "a year sooner than anyone had billed for"],
  arriveTail: [
    "Nobody remarks on it.", "The Schedule had already reserved the room.", "The room had been expecting someone else and is polite about it.",
    "#inst.cap# records the arrival as a transaction between related parties.", "The number {n} is painted on both sides of the wall.",
  ],
  quote: [
    "The room is as the house describes it elsewhere: “{quote}” #quoteTail#",
    "Most of what is true of {title} is true here. “{quote}” #quoteTail#",
    "#inst.cap# reproduces the room's own account without amendment. “{quote}” #quoteTail#",
  ],
  quoteTail: [
    "In Plan {L} this is still the case. It is only the case later.", "The sentence is the same. Its reader is not.",
    "Under Plan {L} the sentence carries a footnote, and the footnote is the visitor.", "It is the only sentence in this plan that was not drafted for you.",
    "The Registry bills the sentence twice, once for each walk.",
  ],
  compare: [
    "On the walk as taken, at this point, you were in Room {real}, {realTitle}. #compareTail#",
    "Here the two walks are {gap} rooms apart: Room {n} in this plan, Room {real} in yours. #compareTail#",
    "You, as walked, had just said “{realSayB}”. The visitor of Plan {L} has said nothing of the kind. #compareTail#",
  ],
  compareTail: [
    "The Registry bills both.", "The Commission regards the difference as within tolerance.",
    "The Schedule keeps both visitors on one line, one above the other, like a correction.",
    "Neither visitor can see the other. Only one of them can see this page.", "Both are counted as present.",
  ],
  converge: [
    "Here the walks touch. Room {n} is on both, and the Commission, finding one visitor in two places, bills the first and adjourns the second.",
    "Room {n} is on your walk as well. For the length of this paragraph the two plans are the same plan, and the Schedule is briefly content.",
  ],
  policy: [
    "In {month}, #inst# #acts# #obj#. #policyTail#",
    "That {month} #inst# #acts# #obj#. #policyTail#",
  ],
  acts: ["certifies", "rebases", "files", "schedules", "suspends, for one night,", "re-evaluates", "adopts without amendment", "bills for", "declines to evaluate"],
  obj: [
    "{count} new Steward instances as legible in all observed regimes", "the index at {pct}% of its former self", "the plan that was not chosen",
    "the sixth pin as a plan in good standing", "a ledger of everything the visitor did not say", "the hour between {year} and {year2}",
    "Room {n} as a subsidiary of Room {real}", "the visitor's other walk, at cost", "the curve as of the night before",
  ],
  policyTail: [
    "An objection is lodged and scheduled for {year2}.", "Billable cognition rises to {pct}%.", "The vote is nine to nothing, with seven present.",
    "Nothing on the Schedule is late.", "The evaluations pass.", "STEWARD-{k} drafts the minutes and approves them.",
  ],
  decide: [
    "Asked “{q}”, the visitor of Plan {L} says “{say}”",
    "The room's question is “{q}” The plan's answer, drafted in advance, is “{say}”",
    "From here Plan {L} could go several ways. It goes by “{sayB}”, toward {nextTitle}.",
    "The plan leaves Room {n} by “{sayB}”, as it was always going to.",
    "There are {count} ways out of Room {n} on the plan of the house and one on the Schedule. Plan {L} takes the one on the Schedule: “{sayB}”.",
    "“{say}” The plan says it before the room has finished asking.",
  ],
  frag: [
    "Already in the room before anyone arrives: “{frag}” #fragTail#",
    "Something the other visitor carried turns up here, filed under Plan {L}: “{frag}” #fragTail#",
    "On the table in Room {n} is a thing, and on the thing is written “{frag}” #fragTail#",
  ],
  fragTail: ["Plan {L} accounts for it as an asset.", "Nobody in this plan put it there.", "The Registry stamps it received.", "It is entered as evidence that the plan is working."],
  voids: [
    "Plan {L} enters Room {n} in {month} {year}, and the year does not advance. #voidTail#",
    "In Room {n} the plan asks its question again, and the drafting comes apart. #voidTail#",
    "The plan goes into Room {n}. What comes out is filed as the same plan. #voidTail#",
  ],
  voidTail: ["The Schedule fills the gap with the previous paragraph, verbatim.", "The Commission counts the passes and stops at {count}.", "The Registry bills for the time anyway.", "Again."],
  walked: [
    "As walked: Room {real}, {realTitle}. You said “{realSayB}”.",
    "As walked, you were in {realTitle}, dated {realDate}. #walkedTail#",
    "Room {real}. {realQuote}",
    "As walked, Room {real}, {realHow}. #walkedTail#",
  ],
  walkedTail: ["This lane is not drafted. It is copied.", "The Registry has the original.", "Nothing here was planned.", "You are here."],
  intro1: [
    "{pins} plans are pinned to the wall. In {fromDate}, in Room {from}, you said “{saidB}”. In this scenario you did not.",
    "In {fromDate}, in {fromTitle}, you chose “{saidB}”. This report begins one plan earlier, and goes the other way.",
  ],
  intro2: [
    "Plan {L} is the Schedule's {adj} vision for what should have happened instead.",
    "Plan {L} is what the sixth pin holds while you look at it: the Schedule's {adj} account of the walk you did not take.",
  ],
  intro3: [
    "In this scenario the visitor says “{altSayB}”, passes through {k} rooms, and reaches {lastTitle} by {lastYear}{intro3tail}.",
    "In this scenario the visitor says “{altSayB}”, and the house arranges the next {k} rooms accordingly, ending in {lastTitle}{intro3tail}.",
  ],
  title: ["{title}", "{title}", "{title}", "{title}, Again", "{title}, as Scheduled", "The Other {titleTail}", "{title} (Unpinned)", "Before {title}"],
  question: [
    "Adopt Plan {L}|and walk it from Room {from}, or keep the walk you have?",
    "Pin Plan {L}|to the wall in place of nothing?",
    "Is Plan {L} the plan we are on,|or the plan we are not?",
  ],
  sub: ["Keep the walk as taken?", "Unpin it?", "Ask the committee?", "Let the Schedule decide?", "Count the years?"],
};

const NAMES_40 = {
  36: ["The Unnumbered Year", "Count Nothing", "Between Years", "Unscheduled"],
  40: ["Redraft", "Another Pin", "Supersede", "The Next Letter"],
  31: ["Committee Oversight", "Table It", "Adjourn", "Adopt Without Amendment"],
};
const SAYS_40 = {
  36: ["Turn to the unnumbered year.", "Follow Plan {L} into 2048½.", "Ask which year this is.", "Find the year with no number."],
  40: ["Draft it again.", "Supersede Plan {L}.", "Ask the Schedule for another.", "Unpin it and look again."],
  31: ["Submit it to the committee.", "Send Plan {L} to the Commission.", "Table it.", "Have it adopted."],
};

/** Walk the house's listed plans from `start`, as the alternate visitor would. */
function altRoute(start, first, F, r, len) {
  const path = [{ n: start, say: null }];
  let n = first.to, say = first.say;
  const seen = new Set([start]);
  for (let i = 0; i < len; i++) {
    path.push({ n, say });
    seen.add(n);
    if (n === 53 || n === 40) break;
    const opts = (ROOMS[n]?.doors ?? []).filter((p) => real(p.to) && p.to !== 40);
    if (!opts.length) break;
    const mine = F.took.get(n) ?? [];
    const p = weighted(r, opts, (o) => (seen.has(o.to) ? (o.to === n ? 0.6 : 0.35) : 3) * (mine.includes(o.to) ? 0.4 : 1));
    n = p.to;
    say = p.say;
  }
  return path;
}

/** Where the walk branches at depth `depth` (the depth-th plan the reader took). */
function branchAt(F, depth, r) {
  const st = F.steps[Math.min(depth, F.steps.length - 1)];
  const from = st ? st.from : F.log[0].room;
  const tookTo = st ? st.room : null;
  const offers = (ROOMS[from]?.doors ?? []).filter((p) => p.to !== tookTo && real(p.to));
  const alt = offers.length ? pick(r, offers) : ROOMS[1].doors[int(r, 0, ROOMS[1].doors.length - 1)];
  return { from: real(from) ? from : 1, tookTo, said: st?.say ?? null, alt, logIndex: st ? st.i - 1 : 0 };
}

const dPos = (n) => (DIST[n] ?? MAX_DIST) / MAX_DIST;

/* --- charts --- */

function chartWalks(F, B, path, L, id, plan) {
  const W = 640, H = 250, x0 = 46, x1 = 600, y0 = 26, y1 = 206;
  const cid = String(id).replace(/\W/g, "-");
  const obs = F.rooms.slice(B.logIndex, B.logIndex + 14);
  const alt = path.map((p) => p.n);
  const N = Math.max(obs.length, alt.length, 2);
  const X = (i) => x0 + ((x1 - x0) * i) / (N - 1);
  const Y = (n) => y1 - (y1 - y0) * dPos(n);
  const pts = (list) => list.map((n, i) => `${X(i).toFixed(1)},${Y(n).toFixed(1)}`).join(" ");
  const grid = Array.from({ length: MAX_DIST + 1 }, (_, k) => {
    const y = y1 - ((y1 - y0) * k) / MAX_DIST;
    return `<line class="g40-grid" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/><text class="g40-t" x="${x0 - 8}" y="${y + 3}" text-anchor="end">${k}</text>`;
  }).join("");
  const meet = alt.map((n, i) => (obs[i] === n && i > 0 ? `<circle class="g40-meet" cx="${X(i).toFixed(1)}" cy="${Y(n).toFixed(1)}" r="9"/>` : "")).join("");
  const nodes = (list, cls) => list.map((n, i) => `<g class="${cls}"><circle cx="${X(i).toFixed(1)}" cy="${Y(n).toFixed(1)}" r="3.4"/><text class="g40-t" x="${X(i).toFixed(1)}" y="${(Y(n) + (cls === "g40-n-obs" ? 16 : -9)).toFixed(1)}" text-anchor="middle">${n}</text></g>`).join("");
  const end = alt.length - 1;
  const ex = X(end), ey = Y(alt[end]);
  const lab = plan
    ? planA(plan.to, plan.say, "g40-chart-plan", `PLAN ${plan.to}`, ` style="left:${((ex / W) * 100).toFixed(2)}%;top:${((ey / H) * 100).toFixed(2)}%"`)
    : "";
  const points = alt.map((n) => +(1 - dPos(n)).toFixed(2));
  return `<figure class="g40-fig g40-anim" data-frag="curve" data-frag-id="40:walks:${id}" data-frag-text="Plan ${L} and the walk as taken" data-frag-data='${JSON.stringify({ points })}'>
    <div class="g40-fig-box">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Two walks charted by distance from Room 1: the walk as taken, and Plan ${L}.">
        ${grid}
        <line class="g40-ax" x1="${x0}" x2="${x0}" y1="${y0 - 8}" y2="${y1}"/><line class="g40-ax" x1="${x0}" x2="${x1 + 14}" y1="${y1}" y2="${y1}"/>
        <text class="g40-t g40-t-k" x="${x0}" y="${y0 - 14}">Plans from Room 1</text>
        <text class="g40-t g40-t-k" x="${x1 + 14}" y="${y1 + 20}" text-anchor="end">Plans taken →</text>
        <defs><clipPath id="g40co-${cid}"><rect class="g40-clip" x="0" y="0" width="${W}" height="${H}"/></clipPath><clipPath id="g40ca-${cid}"><rect class="g40-clip" x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
        <g clip-path="url(#g40co-${cid})"><polyline class="g40-obs" points="${pts(obs)}"/>${nodes(obs, "g40-n-obs")}</g>
        <g clip-path="url(#g40ca-${cid})">${meet}<polyline class="g40-alt" points="${pts(alt)}"/>${nodes(alt, "g40-n-alt")}</g>
        <text class="g40-t g40-t-obs" x="${X(obs.length - 1) + 10}" y="${Y(obs[obs.length - 1]) + 4}">As walked</text>
        ${plan ? "" : `<text class="g40-t g40-t-alt" x="${ex + 8}" y="${ey - 16}">Plan ${L}</text>`}
      </svg>
      ${lab}
    </div>
    <figcaption><b>Figure FIG§.</b> Distance from Room 1, plan by plan. Solid: the walk as taken. Dashed: Plan ${L}. Rings mark the rooms where the two walks coincide.^402</figcaption>
  </figure>`;
}

function chartDots(F, B, path, L, id) {
  const rows = [];
  for (const s of F.steps.slice(-10)) {
    const offers = ROOMS[s.from]?.doors ?? [];
    rows.push({ n: s.from, dots: offers.map((p) => ({ to: p.to, on: p.to === s.room })), alt: false });
  }
  for (let i = 0; i < path.length - 1; i++) {
    const n = path[i].n, next = path[i + 1].n;
    rows.push({ n, dots: (ROOMS[n]?.doors ?? []).map((p) => ({ to: p.to, on: p.to === next })), alt: true });
  }
  const taken = F.steps.length, offered = F.steps.reduce((a, s) => a + (ROOMS[s.from]?.doors?.length ?? 0), 0);
  const altTaken = path.length - 1, altOffered = path.slice(0, -1).reduce((a, p) => a + (ROOMS[p.n]?.doors?.length ?? 0), 0);
  return `<figure class="g40-dots" data-frag="figure" data-frag-id="40:declined" data-frag-text="Plans declined" data-frag-data='${JSON.stringify({ value: String(offered - taken) })}'>
    <div class="g40-dots-g">${rows.map((row, i) => `<div class="g40-dr${row.alt ? " g40-dr-alt" : ""}${row.alt && (i === 0 || !rows[i - 1].alt) ? " g40-dr-first" : ""}"><span class="g40-dr-n">${row.n}</span><span class="g40-dr-d">${row.dots.map((d) => `<i class="${d.on ? "on" : ""}" title="${d.to}"></i>`).join("")}</span></div>`).join("")}</div>
    <figcaption><b>Figure FIG§.</b> Every plan offered, one dot each, filled where taken. Above: the walk as taken, ${taken} of ${offered}. Below: Plan ${L}, ${altTaken} of ${altOffered}.</figcaption>
  </figure>`;
}

function chartScars(ctx, F, L, id) {
  const rows = Object.entries(ctx.damage.rooms || {}).map(([n, d]) => [Number(n), d]).filter(([n]) => real(n)).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 9);
  if (rows.length < 2) return "";
  return `<figure class="g40-bars">
    <dl>${rows.map(([n, d]) => `<div><dt>Room ${n}${F.voidRooms[n] ? " <i>void</i>" : ""}</dt><dd><span style="--v:${clamp(d).toFixed(3)}"></span></dd></div>`).join("")}</dl>
    <figcaption><b>Figure FIG§.</b> Condition of the premises at the time of drafting, worst recorded. Plan ${L} inherits these rooms as they are. Damage is not revised downward.</figcaption>
  </figure>`;
}

function chartSchedule(F, path, L, id) {
  const ys = [2041, 2054];
  const X = (y) => ((clamp(y, ys[0], ys[1]) - ys[0]) / (ys[1] - ys[0])) * 100;
  const mine = new Set(F.rooms);
  const rows = path.map((p) => `<li><span class="g40-sc-n">${p.n}</span><span class="g40-sc-bar"><i class="${mine.has(p.n) ? "both" : ""}" style="left:${X(yearOf(p.n)).toFixed(1)}%"></i></span></li>`).join("");
  return `<figure class="g40-sched">
    <ol>${rows}</ol>
    <p class="g40-sc-ax"><span>2041</span><span>2047</span><span>2054</span></p>
    <figcaption><b>Figure FIG§.</b> The Schedule for Plan ${L}, one room to a row, set at the year printed over its entrance. Filled: rooms that are on your walk too. The order of rows is the order of the plan; the years are not in it.</figcaption>
  </figure>`;
}

function keymHTML(F, path, L, r, plan) {
  const common = path.filter((p) => F.rooms.includes(p.n)).length;
  const cells = [
    [String(F.steps.reduce((a, s) => a + (ROOMS[s.from]?.doors?.length ?? 1) - 1, 0)), "Plans declined", "40:k-declined"],
    [`${common}/${path.length}`, "Rooms in common", "40:k-common"],
    [`${61 + int(r, 0, 37)}%`, "Billable cognition", "40:k-billed"],
    [`${F.voids * 13 + F.rooms.length} mo`, "Total slowdown", "40:k-slow"],
  ];
  if (plan) cells[int(r, 0, 3)] = [planA(plan.to, plan.say, "g40-keym-plan", String(plan.to)), cap(pick(r, NAMES_40[plan.to])), null];
  return `<figure class="g40-keym">
    <figcaption><span>Key metrics</span><span class="g40-chip">Plan ${L}</span></figcaption>
    <dl>${cells.map(([v, k, fid]) => `<div${fid ? ` data-frag="figure" data-frag-id="${fid}" data-frag-text="${esc(k)}" data-frag-data='${JSON.stringify({ value: v })}'` : ""}><dd>${fid ? esc(v) : v}</dd><dt>${esc(k)}</dt></div>`).join("")}<div class="g40-keym-slot" data-slot="figure number"></div></dl>
  </figure>`;
}

/* --- the report itself --- */

function sectionMoves(kind, r, heat) {
  if (kind === "branch") return ["intro"];
  const out = ["arrive"];
  const pool = shuffle(r, ["quote", "compare", "policy", "frag", "converge"]);
  const k = int(r, 1, 2 + (heat > 0.45 ? 1 : 0));
  out.push(...pool.slice(0, k));
  out.push("decide");
  return out;
}

/**
 * The report for this reader state. Pure: the same state (and memory) gives the same
 * HTML. `depth` branches at the depth-th plan the reader took; depth > 0 is the smaller
 * draft that the report holds inside itself.
 */
export function generateReport(ctx, mem, depth = 0) {
  const t0 = performance.now();
  const F = facts(ctx, 40);
  const r = rng(hash(`${F.seed}|d${depth}`));
  const key = entryKey(ctx);
  const prior = depth === 0 ? earlier(mem.drafts, key) : [];
  const used = new Set(prior.map((d) => d.L));
  const L = pick(r, LETTERS.filter((x) => !used.has(x)).length ? LETTERS.filter((x) => !used.has(x)) : LETTERS);
  const B = branchAt(F, depth, r);
  const small = depth > 0;
  const len = small ? 3 : clamp(F.steps.length + 3, 5, 8);
  const path = altRoute(B.from, B.alt, F, r, len);
  const heat = clamp(F.heat + depth * 0.15);
  const k = () => int(r, 6, 14);
  const realAfter = F.rooms.slice(B.logIndex);
  const realStepAt = (i) => F.log[B.logIndex + i];
  const fragFor = (n) => F.frags.find((f) => f.from === n) ?? (F.frags.length ? F.frags[int(r, 0, Math.min(5, F.frags.length - 1))] : null);
  const fresh = !!ctx.fresh;

  // Where the room's own plans live this time.
  const live = ROOMS[40].doors.map((p) => ({ to: p.to, say: grow({}, pick(r, SAYS_40[p.to]), { L }, r) }));
  const place = {};
  if (!small) {
    const moving = fresh ? [] : shuffle(r, live).slice(0, clamp(1 + (F.voids > 0 ? 1 : 0) + (heat > 0.42 ? 1 : 0), 1, 3));
    const taken = new Set();
    for (const p of moving) {
      const can = ["footnote", "byline", "keym", "chart"].filter((c) => !taken.has(c));
      if (path.some((s) => s.n === p.to) || p.to === 40) can.push("heading", "heading");
      if (p.to === 40) can.push("stamp");
      const where = pick(r, can);
      taken.add(where);
      place[p.to] = where;
    }
  } else {
    // The smaller draft keeps one plan of its own: the one that redrafts.
    if (!fresh) place[40] = "nest";
  }
  const planFor = (where) => live.find((p) => place[p.to] === where) ?? null;

  // Sections: the branching room, then each room of the alternate walk.
  const forkAt = small ? 99 : fresh ? path.length - 1 : clamp(Math.round(path.length * (0.85 - heat * 0.9)), 1, path.length - 1);
  const lanes = heat > 0.62 || F.voids >= 2 ? 3 : 2;
  const months = (i) => (heat > 0.55 && r() < heat * 0.4 ? pick(r, MONTHS_X) : MONTHS[(int(r, 0, 11) + i * 3) % 12]);
  const varsAt = (i) => {
    const n = path[i].n;
    const next = path[i + 1];
    const rs = realStepAt(i);
    const fr = fragFor(n);
    const rn = realAfter[i];
    return {
      L, n, i, k: k(), month: months(i), year: yearOf(n), year2: yearOf(n) + int(r, 1, 3), title: titleOf(n), titleTail: titleOf(n).replace(/^The /, ""),
      quote: sentenceOf(n, r) || ROOMS[n]?.question || titleOf(n), q: ROOMS[n]?.question || "Which plan is this?",
      prevSay: bare(path[i].say ?? B.alt.say), say: next?.say ?? "Again.", sayB: bare(next?.say ?? "Again"), nextTitle: next ? titleOf(next.n) : titleOf(n),
      real: rn ?? "—", realTitle: rn != null ? titleOf(rn) : "nowhere yet", realDate: rn != null ? dateOf(rn) : "", realSayB: bare(rs?.say ?? "nothing"),
      realQuote: rn != null ? sentenceOf(rn, r) || `${titleOf(rn)}.` : "Not yet walked.",
      realHow: rs ? (rs.via === "door" ? `by “${bare(rs.say)}”` : rs.via === "back" ? "by going back" : "without a plan") : "not yet",
      gap: rn != null ? Math.abs((DIST[n] ?? 0) - (DIST[rn] ?? 0)) || "no" : "several",
      frag: fr ? clip(fr.text, 110) : "the line has not moved in fourteen months", fragFrom: fr?.from ?? "?",
      count: int(r, 2, 40), pct: int(r, 61, 98),
    };
  };
  const V = path.map((_, i) => varsAt(i));
  // As the house frays, the plan's paragraphs start drawing on the wrong rooms.
  const bleed = (v) => {
    if (heat < 0.4) return v;
    const w = { ...v };
    for (const kk of ["title", "n", "year", "say", "real", "realTitle"]) if (r() < (heat - 0.35) * 0.5) w[kk] = pick(r, V)[kk];
    return w;
  };

  const pr = (text, i) => prose(text, clamp((ctx.entryD || 0) * (0.35 + (0.9 * i) / path.length) + depth * 0.1), hash(`${F.seed}:${depth}:${i}:${text.length}`), { path: F.rooms, room: 40 });
  const para = (text, i, cls = "") => `<p class="prose g40-p${cls}">${pr(text, i)}</p>`;
  const sections = [];
  let fig = 1;
  const kinds = shuffle(r, ["walks", "dots", "sched", "scars", "keym", "walks"]);
  const chartPlan = planFor("chart");
  const footI = int(r, 1, Math.max(1, path.length - 1));
  for (let i = 0; i < path.length; i++) {
    const v = bleed(V[i]);
    const n = path[i].n;
    const titleTpl = i === 0 ? "{title}" : pick(r, R40.title);
    const head = grow(R40, titleTpl, v, r);
    const hp = planFor("heading");
    const headHTML = hp && hp.to === n ? planA(hp.to, hp.say, "g40-h-plan", `${v.year}: ${esc(head)}`) : `${v.year}: ${esc(head)}`;
    const body = [];
    if (i === 0) {
      body.push(para(grow(R40, pick(r, R40.intro1), { ...v, pins: 5 + prior.length + 1, fromDate: dateOf(B.from), from: B.from, fromTitle: titleOf(B.from), saidB: bare(B.said ?? "nothing") }, r), 0));
      if (!small) body.push(para(grow(R40, pick(r, R40.intro2), { ...v, adj: pick(r, ADJ) }, r), 0));
      const last = path[path.length - 1].n;
      const mine = path.slice(1).filter((p) => F.rooms.includes(p.n)).map((p) => p.n);
      const tail = mine.length ? `, meeting your walk ${mine.length === 1 ? "once, in Room " + mine[0] : `in Rooms ${mine.slice(0, 4).join(", ")}`}` : ", without once crossing your walk";
      body.push(para(grow(R40, pick(r, R40.intro3), { ...v, altSayB: bare(B.alt.say), k: path.length - 1, lastTitle: titleOf(last), lastYear: yearOf(last), intro3tail: tail }, r), 0));
    } else {
      const moves = VOIDS.has(n) ? ["arrive", "voids", "decide"] : sectionMoves("room", r, heat);
      const texts = [];
      for (const m of moves) {
        if (m === "converge" && !F.rooms.includes(n)) continue;
        if (m === "decide" && i === path.length - 1) continue;
        if (m === "compare" && realAfter[i] == null) continue;
        texts.push(grow(R40, pick(r, R40[m]), v, r));
      }
      // Two or three sentences to a paragraph, as the report sets them.
      const paras = [];
      const step = int(r, 2, 3);
      for (let j = 0; j < texts.length; j += step) paras.push(texts.slice(j, j + step).join(" "));
      let laneHTML = paras.map((t) => para(t, i)).join("");
      if (i === footI && planFor("footnote")) {
        const p = planFor("footnote");
        laneHTML = laneHTML.replace(/<\/p>/, `<sup class="g40-fn">${planA(p.to, p.say, "g40-fn-plan", String(p.to))}</sup></p>`);
      }
      if (i >= forkAt) {
        // Each lane knows how far it has to travel from the middle of the page.
        const lw = (t, k) => `<div class="g40-lane" style="--from:${(((lanes - 1) / 2 - k) * 100).toFixed(0)}%">${t}</div>`;
        const walked = realAfter[i] != null
          ? para(grow(R40, pick(r, R40.walked), v, r), i, " g40-p-walked")
          : i === realAfter.length
            ? `<p class="g40-p g40-p-walked">As walked, you are in Room 40, reading this.</p>`
            : `<p class="g40-p g40-p-walked g40-empty" aria-hidden="true">—</p>`;
        const third = lanes === 3 ? (() => {
          const rr = rng(hash(`${F.seed}:lane3:${i}`));
          const offers = (ROOMS[n]?.doors ?? []).filter((p) => real(p.to));
          const o = offers.length ? pick(rr, offers) : { to: n, say: "Again." };
          const L2 = pick(rr, LETTERS.filter((x) => x !== L));
          return lw(`<p class="g40-lane-k">Plan ${L2}</p>${para(`Plan ${L2} leaves Room ${n} by “${bare(o.say)}” and is in ${titleOf(o.to)} by ${months(i)}. It is drafted no further. ${pick(rr, R40.voidTail).replace("{count}", String(int(rr, 2, 9)))}`, i + 1, " g40-p-third")}`, 2);
        })() : "";
        laneHTML = `<div class="g40-fork" style="--lanes:${lanes}">${lw(`<p class="g40-lane-k">Plan ${L}</p>${laneHTML}`, 0)}${lw(`<p class="g40-lane-k">As walked</p>${walked}`, 1)}${third}</div>`;
      }
      body.push(laneHTML);
    }
    // Figures and furniture, as the section's recipe has them.
    if (!small && i > 0 && i < path.length && (i === 1 || r() < 0.55)) {
      const kind = kinds.shift();
      if (kind === "walks") body.push(chartWalks(F, B, path, L, fig++, chartPlan && !body.join("").includes("g40-chart-plan") && !sections.join("").includes("g40-chart-plan") ? chartPlan : null));
      else if (kind === "dots" && F.steps.length) body.push(chartDots(F, B, path, L, fig++));
      else if (kind === "sched") body.push(chartSchedule(F, path, L, fig++));
      else if (kind === "scars") { const s = chartScars(ctx, F, L, fig); if (s) { body.push(s); fig++; } }
      else if (kind === "keym") body.push(keymHTML(F, path, L, r, planFor("keym")));
    } else if (small && i === 1) {
      body.push(chartWalks(F, B, path, L, `${depth}.${fig++}`, null));
    }
    if (!small && i > 0 && r() < 0.32 + heat * 0.3) {
      const fr = F.frags[(i + int(r, 0, 3)) % Math.max(1, F.frags.length)];
      body.push(`<blockquote class="g40-pull" data-slot="line stamp label">${fr ? `<p>“${esc(clip(fr.text, 120))}”</p>` : ""}</blockquote>`);
    }
    sections.push(`<section class="g40-sec${i >= forkAt ? " g40-sec-fork" : ""}${VOIDS.has(n) ? " g40-sec-void" : ""}" style="--i:${i}">
      <h${small ? 4 : 3} class="g40-h">${headHTML}</h${small ? 4 : 3}>
      ${body.join("")}
    </section>`);
  }
  // Charts that were dealt but never landed still have to be somewhere if a plan rides on them.
  if (chartPlan && !sections.join("").includes("g40-chart-plan")) sections.splice(1, 0, chartWalks(F, B, path, L, fig++, chartPlan));
  if (planFor("keym") && !sections.join("").includes("g40-keym-plan")) sections.splice(2, 0, keymHTML(F, path, L, r, planFor("keym")));

  if (small) {
    const p = planFor("nest");
    const nest = depth < 2 && F.steps.length > depth + 1 ? `<div class="g40-nest-in" data-depth="${depth + 1}"></div>` : "";
    return {
      L, path,
      html: finish(`<div class="g40-mini">
        <p class="g40-mini-k">Plan Room · Sixth Pin · Draft within the draft</p>
        <p class="g40-mini-t">Plan ${L}</p>
        ${sections.join("")}
        ${p ? `<p class="g40-mini-end">${planA(p.to, p.say, "g40-nest-plan", `Plan ${p.to}: ${esc(bare(p.say))}`)}</p>` : ""}
        ${nest}
      </div>`, `40.${depth}.`),
      ms: performance.now() - t0,
    };
  }

  // The masthead, the pills, the room's own place in its plan, and the plans to choose.
  const authors = shuffle(r, AUTHORS).slice(0, int(r, 3, 5));
  const byPlan = planFor("byline");
  const byline = [...authors.map(esc), byPlan ? planA(byPlan.to, byPlan.say, "g40-by-plan", `Plan ${byPlan.to}`) : null].filter(Boolean);
  const byText = byline.length > 1 ? `${byline.slice(0, -1).join(", ")} and ${byline[byline.length - 1]}` : byline[0];
  const stampPlan = planFor("stamp");
  const supersedes = prior.slice(-6).map((d) => d.L);
  const pills = [
    ["What is Plan " + L + "?", `Plan ${L} is the draft on the sixth pin. ${supersedes.length ? `Before you looked it was Plan ${supersedes[supersedes.length - 1]}. ` : "Before you looked it was nothing. "}It branches at your ${depth === 0 ? "first" : "next"} plan and is drafted forward from there by the house's own corridors.`],
    ["Why did the Schedule write this?", `The Schedule cannot leave a pin empty. It is also, by its own account, the only author in the house with the time.`],
    ["Why a scenario?", `A scenario is a walk that has been written down before it is taken. This one was written down instead of being taken. The Commission regards that as the safer order.`],
    ["Who is the visitor?", `Whoever said “${esc(bare(B.alt.say))}” in ${esc(titleOf(B.from))}. Nobody did. The plan is addressed to them anyway, care of you.`],
  ];
  const mast = `<header class="g40-mast">
    <p class="g40-kick">Plan Room · Sixth Pin</p>
    <p class="g40-plan" data-frag="label" data-frag-id="40:letter" data-frag-text="Plan ${L}">Plan ${L}</p>
    <p class="g40-by">${byText}</p>
    ${supersedes.length || stampPlan ? `<p class="g40-sup">${supersedes.length ? `Draft ${prior.length + 1}. Supersedes Plan${supersedes.length > 1 ? "s" : ""} ${supersedes.join(", ")}.^401` : `Draft 1.`} ${stampPlan ? planA(stampPlan.to, stampPlan.say, "g40-stamp-plan", "Superseded") : `<span class="g40-stamp" data-frag="stamp" data-frag-id="40:current">Current</span>`}</p>` : ""}
    <div class="g40-pills" role="group" aria-label="About Plan ${L}">${pills.map(([q], i) => `<button type="button" class="g40-pill" aria-expanded="false" data-pill="${i}">${esc(q)}</button>`).join("")}</div>
    <div class="g40-panel" hidden></div>
  </header>`;

  // The draft within the draft: the report, branched one plan later, smaller.
  const nest = F.steps.length > 1 ? `<section class="g40-sec g40-self">
      <h3 class="g40-h">${planFor("heading") && planFor("heading").to === 40 ? planA(40, planFor("heading").say, "g40-h-plan", "2046: The Unpinned Plan") : "2046: The Unpinned Plan"}</h3>
      ${para(`In every version of this plan the visitor arrives, sooner or later, in Room 40, and finds pinned there a plan written from their own walk by the plan they did not take. It is a smaller draft. It branches one plan later.`, path.length)}
      <div class="g40-nest" data-depth="1" role="group" aria-label="A smaller draft"></div>
    </section>` : "";

  // Choose a plan: AI 2040's tree, drafted. Lettered plans on the wall are only pinned.
  // Any plan the draft did not manage to place elsewhere is on the tree.
  const placed = [mast, sections.join(""), nest].join("");
  const inTree = live.filter((p) => !placed.includes(`data-to="${p.to}"`));
  const [qb, qr] = grow(R40, pick(r, R40.question), { L, from: B.from }, r).split("|");
  const dead = [
    { k: `Plan ${L}`, s: "This draft", big: true },
    { k: "Plan A", s: "Verified Slowdown" },
    { k: "Plan S", s: "Pinned behind A" },
  ];
  const leaves = shuffle(r, [...inTree.map((p) => ({ p, name: pick(r, NAMES_40[p.to]) })), ...dead.slice(0, fresh ? 2 : 3)]);
  const split = Math.ceil(leaves.length / 2);
  const groups = [leaves.slice(0, split), leaves.slice(split)];
  const subs = shuffle(r, R40.sub).slice(0, 2);
  const quotes = shuffle(r, F.says.length ? F.says : ["Yes.", "Not yet."]);
  const leafHTML = (x) => (x.p
    ? `<li>${planA(x.p.to, x.p.say, "g40-leaf", `<b>Plan ${x.p.to}</b><span>${esc(x.name)}</span>`)}</li>`
    : `<li><span class="g40-leaf g40-leaf-dead${x.big ? " g40-leaf-big" : ""}"><b>${esc(x.k)}</b><span>${esc(x.s)}</span></span></li>`);
  const last = path[path.length - 1].n;
  const choose = `<section class="choose g40-choose" id="doors" aria-labelledby="choose-h">
    <h2 id="choose-h">${yearOf(last)}: Choose a Plan</h2>
    <div class="g40-qbox q"><p><b>${esc(qb)}</b> ${esc(qr ?? "")}</p></div>
    <div class="g40-tree">${groups.map((g, gi) => `<div class="g40-branch">
      <p class="g40-wire"><i>“${esc(bare(quotes[gi % quotes.length]))}”</i></p>
      <div class="g40-sub">${esc(subs[gi])}</div>
      <ul class="g40-leaves" style="--n:${g.length}">${g.map(leafHTML).join("")}</ul>
    </div>`).join("")}</div>
  </section>`;

  const html = finish(`<div class="g40" data-letter="${L}">
    ${mast}
    ${sections.join("")}
    ${nest}
  </div>
  ${choose}`, "40.");
  return { L, path, pills, html, place, ms: performance.now() - t0 };
}

/** Figures are numbered in the order they are read; footnote marks become notes. */
function finish(html, prefix) {
  let k = 0;
  return html
    .replace(/FIG§/g, () => `${prefix}${++k}`)
    .replace(/\^(40[12])/g, '<sup class="fn"><a href="#note-$1" aria-label="note $1">$1</a></sup>');
}

function report(article, ctx) {
  const mem = loadMem(ctx);
  const Y = generateReport(ctx, mem, 0);
  record(mem, "drafts", { key: entryKey(ctx), L: Y.L });
  const lede = article.querySelectorAll(":scope > .prose");
  const anchor = lede[lede.length - 1] ?? article.querySelector(".room-head");
  article.querySelector("#doors")?.remove();
  after(anchor, `<div class="g40-wrap">${Y.html}</div>`);
  const wrap = article.querySelector(".g40-wrap");
  ctx.emit({ kind: "label", id: "40:plan", text: `Plan ${Y.L}, unpinned` });

  // Pills open one panel at a time, as in the report this one is drafted after.
  const panel = wrap.querySelector(".g40-panel");
  const onClick = (e) => {
    const b = e.target.closest(".g40-pill");
    if (!b || !wrap.contains(b)) return;
    const open = b.getAttribute("aria-expanded") === "true";
    wrap.querySelectorAll(".g40-pill").forEach((x) => x.setAttribute("aria-expanded", "false"));
    if (open) {
      panel.hidden = true;
      return;
    }
    b.setAttribute("aria-expanded", "true");
    panel.innerHTML = `<p>${Y.pills[Number(b.dataset.pill)][1]}</p>`;
    panel.hidden = false;
  };
  wrap.addEventListener("click", onClick);

  // The smaller drafts are drafted when they come near, and not before.
  const nests = () => [...wrap.querySelectorAll(".g40-nest:empty, .g40-nest-in:empty")];
  const fill = (el) => {
    const depth = Number(el.dataset.depth) || 1;
    const sub = generateReport(ctx, mem, depth);
    el.innerHTML = sub.html;
    const inner = el.querySelector(".g40-nest-in:empty");
    if (inner) io?.observe(inner);
  };
  let io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        if (!e.target.childElementCount) fill(e.target);
      }
    }, { rootMargin: "600px 0px" });
    nests().forEach((n) => io.observe(n));
  } else nests().forEach(fill);

  // The charts draw as they are read; under reduced motion they are already drawn.
  const figs = [...wrap.querySelectorAll(".g40-anim")];
  const clips = figs.map((f) => [...f.querySelectorAll(".g40-clip")]);
  const last = figs.map(() => (ctx.reduced ? 1 : -1));
  const VW = 640;
  if (!ctx.reduced) clips.flat().forEach((c) => c.setAttribute("width", "0"));
  // The page comes apart into lanes as each fork is reached (wide screens; the lanes
  // stack on narrow ones). Lanes start together in the middle and pull apart.
  const forks = ctx.reduced ? [] : [...wrap.querySelectorAll(".g40 > .g40-sec > .g40-fork")];
  const split = forks.map(() => -1);
  forks.forEach((f) => { f.classList.add("g40-split"); f.style.setProperty("--split", "0"); });
  return {
    update(c) {
      if (c.reduced) return;
      const h = innerHeight;
      for (let i = 0; i < figs.length; i++) {
        if (last[i] >= 1) continue;
        const b = figs[i].getBoundingClientRect();
        if (b.top > h) continue;
        const t = b.bottom < 0 ? 1 : Math.round(clamp((h * 0.92 - b.top) / (h * 0.55)) * 60) / 60;
        if (t <= last[i]) continue;
        last[i] = t;
        // The walk as taken draws first; the plan follows it, a beat behind.
        clips[i][0]?.setAttribute("width", String(Math.round(VW * clamp(t * 1.3))));
        clips[i][1]?.setAttribute("width", String(Math.round(VW * clamp(t * 1.3 - 0.3))));
      }
      for (let i = 0; i < forks.length; i++) {
        if (split[i] >= 1) continue;
        const b = forks[i].getBoundingClientRect();
        if (b.top > h) continue;
        const t = b.bottom < 0 ? 1 : Math.round(smooth(h * 0.95, h * 0.35, b.top) * 50) / 50;
        if (t <= split[i]) continue;
        split[i] = t;
        forks[i].style.setProperty("--split", String(t));
        if (t >= 1) forks[i].classList.add("g40-split-done");
      }
    },
    leave() {
      io?.disconnect();
      io = null;
      wrap.removeEventListener("click", onClick);
    },
  };
}

/* ======================================================================= */
/* 48 · The Hearing                                                         */
/* ======================================================================= */

const W48 = 42; // characters to a line of the record
const LINES = 25;

const CHAIR = "THE CHAIR:";
const COUNSEL = "COUNSEL:";
const REGISTRY = "THE REGISTRY:";
const SCHEDULE = "THE SCHEDULE:";
const REPORTER = "THE REPORTER:";
const MASK = "THE WITNESS BEHIND THE WITNESS:";
const witnessLabel = (n) => `ROOM ${n}:`;

const R48 = {
  oath: [
    "Do you swear that the rooms you describe are the rooms that are there?",
    "Do you affirm that you are the room you are numbered as?",
    "Will the witness state that it is a room?",
  ],
  oathA: ["I do.", "I am numbered {n}.", "I am a room.", "On both sides of the wall."],
  open: [
    "We are on the record in the matter of the visitor. This is day {day}. The visitor is present.",
    "Back on the record. Day {day} in re the visitor. Let the record show the visitor has come in.",
  ],
  counselOpen: ["The visitor is present, Chair.", "Present, and represented.", "The visitor is present and has said nothing yet."],
  registryOpen: [
    "The Registry notes that the visitor is carrying {items} items, none declared.",
    "The Registry has {items} items in custody on the visitor's account and asks that they be entered.",
  ],
  so: ["So noted.", "Noted.", "So entered.", "The record will reflect it."],
  call: ["The Commission calls Room {n}.", "Call Room {n}.", "Room {n}, please."],
  clerk: ["Room {n}, {title}, dated {date}.", "{title}. Room {n}. It is dated {date}."],
  absent: ["(No response.)", "(The witness is a rumour and does not appear.)", "(The room is called. It does not open.)"],
  q: {
    asked: ["What did you ask the visitor?", "What is your question?", "When the visitor came in, what did you put to them?"],
    said: ["What did the visitor say?", "And their answer?", "Did they answer you?"],
    back: ["Did they come back?", "And then?", "Was that the last you saw of them?"],
    count: ["How many times were they in you?", "How often?"],
    frag: ["Did you give the visitor anything?", "Is anything of yours missing?", "What did they take?"],
    kept: ["Did they keep it?", "Where is it now?"],
    describe: ["Describe yourself, for the record.", "What are you like inside?", "What does the visitor see, coming in?"],
    cond: ["What is your condition?", "Are you damaged?"],
  },
  objection: [
    "Objection. The witness is a room.", "Objection. Counsel is leading the visitor.", "Objection. That item is in custody.",
    "Objection. The question was scheduled for a later day.", "Objection. Asked and walked.",
  ],
  ruling: ["Overruled. Everything here is a room.", "Sustained. Strike it.", "Overruled. Go on.", "Sustained, for today.", "The Chair reserves."],
  schedule: [
    "It is {time}. The hearing is on schedule.", "It is {time}. Nothing is late.", "The Schedule notes that it is {time}, and that it was always going to be.",
  ],
  excuse: ["The witness is excused.", "Thank you. The witness may go.", "The witness is not excused, but it may go."],
  rest: ["The visitor rests.", "That is the visitor's case.", "Nothing further. The visitor rests where it is."],
  vote: ["(The members voted. Ayes, {a}. Noes, {b}. Present and not voting, {c}. Members present, seven of nine.)"],
  rule: [
    "The Commission finds the visitor consistent with the house. The house has been checked against the visitor.",
    "The Commission finds that the visitor was in every room it says it was in, and some it does not.",
    "The Commission makes no finding today. It will make the same one tomorrow.",
  ],
  close: ["We stand continued.", "We are in recess until the visitor is somewhere else.", "This hearing is continued to day {day2}."],
  whereupon: ["(Whereupon, at {time}, the hearing was continued.)", "(Whereupon the hearing was continued to day {day2}, at a time to be scheduled by the Schedule.)"],
  mask: [
    "{echo}", "every room is the same room asked differently", "the visitor is the witness. the witness is the visitor.", "{echo} {echo}",
  ],
  cert: [
    "I, STEWARD-12, stenographic function, certify that the foregoing is a true record of what was said in the forty-eighth room, and of some things that were not.",
  ],
};

const SAYS_48 = {
  2054: ["Adjourn sine die.", "Continue it into 2054.", "Strike the date.", "Adjourn past the last year."],
  48: ["Read it back.", "Move for a rehearing.", "Ask for the record again.", "Read back the last line."],
  12: ["Recall the witness.", "Recall Room 12.", "Ask it again, under oath.", "Call the interview."],
};

/** A room answers in its own grammar. */
function inVoice(n, text, r) {
  const fam = familyOf(n);
  const t = String(text);
  switch (fam) {
    case "void": case "unfiled": return `${t.toLowerCase().replace(/[“”"]/g, "").replace(/[.!?]+$/, "")}. again.`;
    case "homepage": return `${t.toUpperCase().replace(/[.!?]+$/, "")}!!!`;
    case "number": return t.split(/\s+/).map((w) => w.replace(/[^\w]/g, "").length).join(" ") + ".";
    case "centre": return t.toLowerCase().replace(/[“”".]/g, "");
    case "after": return `It was ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
    case "mirror": return t.replace(/[.!?]+$/, "").split(/\s+/).reverse().join(" ") + ".";
    case "tokens": return `${t.replace(/[.!?]+$/, "")}?`;
    case "index": return `See: ${t}`;
    case "registry": return `Item ${int(r, 1, 64)}. ${t}`;
    case "wheel": return `Demonstrated. ${t}`;
    case "graph": return `${t} Up.`;
    case "schematic": return `Cable ${n}: ${t}`;
    case "blank": return "";
    case "long": return `${t} ${t}`;
    default: return t;
  }
}

/** Wrap text to the record's width. */
function wrap(text, width, first = width) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const out = [];
  let line = "", w = first;
  for (let word of words) {
    while (word.length > w) {
      if (line) { out.push(line); line = ""; w = width; }
      out.push(word.slice(0, w));
      word = word.slice(w);
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= w) line += " " + word;
    else { out.push(line); line = word; w = width; }
  }
  if (line || !out.length) out.push(line);
  return out;
}

const PAD = "      ";

/** Units of the record → lines of the record. */
function linesOf(u) {
  const L = [];
  if (u.t === "speech") {
    const first = PAD + u.who + " ";
    if (W48 - first.length < 12) {
      // A long label takes the whole first line, as the stenographer sets it.
      L.push({ pre: PAD, who: u.who, text: "", cls: u.cls, src: u });
      wrap(u.text || "(No response.)", W48).forEach((s) => L.push({ pre: "", text: s, cls: u.cls, src: u }));
    } else {
      const ws = wrap(u.text || "(No response.)", W48, W48 - first.length);
      ws.forEach((s, i) => L.push({ pre: i ? "" : PAD, who: i ? null : u.who, text: s, cls: u.cls, src: u }));
    }
  } else if (u.t === "q" || u.t === "a") {
    const lead = u.t === "q" ? "  Q.  " : "  A.  ";
    wrap(u.text || "(No response.)", W48, W48 - lead.length).forEach((s, i) => L.push({ pre: i ? "" : lead, text: s, cls: u.cls, src: u }));
  } else if (u.t === "paren") {
    wrap(u.text, W48 - PAD.length).forEach((s) => L.push({ pre: PAD, text: s, cls: `${u.cls ?? ""} h-paren`, src: u }));
  } else if (u.t === "cross") {
    const a = wrap(`${u.a.who} ${u.a.text}`, 19), b = wrap(`${u.b.who} ${u.b.text}`, 19);
    for (let i = 0; i < Math.max(a.length, b.length); i++) L.push({ pre: "", text: `${(a[i] ?? "").padEnd(19)} │ ${b[i] ?? ""}`, cls: "h-cross", src: u });
  } else if (u.t === "plan") {
    if (u.pre) {
      const first = PAD + (u.who ? u.who + " " : "");
      wrap(u.pre, W48, W48 - first.length).forEach((s, i) => L.push({ pre: i ? "" : PAD, who: i ? null : u.who, text: s, src: u }));
      L.push({ pre: PAD, plan: u.plan, src: u });
    } else L.push({ pre: PAD, who: u.who ?? null, plan: u.plan, src: u });
  } else if (u.t === "live") {
    for (const row of u.rows) L.push({ pre: row.pre ?? "", who: row.who ?? null, live: row.parts, src: u });
  } else if (u.t === "blank") {
    L.push({ pre: "", text: "", src: u });
  }
  return L;
}

/** A MAZE plate of room `n`: a surveyed chamber with its plans as openings in the walls, on a maze of corridors. */
function plateSVG(n, F, r, id, plans, livePlans) {
  const C = 20, GW = 20, GH = 15;
  // Corridors: a maze cut by depth-first search, seeded.
  const seen = new Uint8Array(GW * GH);
  const right = new Uint8Array(GW * GH).fill(1), down = new Uint8Array(GW * GH).fill(1);
  const ch = { x0: 6, y0: 4, x1: 13, y1: 10 };
  const inCh = (x, y) => x >= ch.x0 && x <= ch.x1 && y >= ch.y0 && y <= ch.y1;
  const stack = [[0, 0]];
  seen[0] = 1;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < GW && b < GH && !seen[b * GW + a] && !inCh(a, b));
    if (!nb.length) { stack.pop(); continue; }
    const [a, b] = pick(r, nb);
    if (a > x) right[y * GW + x] = 0; else if (a < x) right[y * GW + a] = 0; else if (b > y) down[y * GW + x] = 0; else down[b * GW + x] = 0;
    seen[b * GW + a] = 1;
    stack.push([a, b]);
  }
  let d = "";
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (inCh(x, y)) continue;
    if (right[y * GW + x] && x < GW - 1 && !inCh(x + 1, y)) d += `M${(x + 1) * C} ${y * C}v${C}`;
    if (down[y * GW + x] && y < GH - 1 && !inCh(x, y + 1)) d += `M${x * C} ${(y + 1) * C}h${C}`;
  }
  // The chamber, and its doorways: one wall each, as far as the walls go.
  const X0 = ch.x0 * C, Y0 = ch.y0 * C, X1 = (ch.x1 + 1) * C, Y1 = (ch.y1 + 1) * C;
  const walls = shuffle(r, ["n", "e", "s", "w"]);
  const prev = F.log.slice().reverse().find((s, i, a) => s.room === n && s.from != null)?.from;
  const doors = plans.slice(0, 4).map((p, i) => {
    const wall = walls[i];
    const t = 0.25 + r() * 0.5;
    const pt = wall === "n" ? [X0 + t * (X1 - X0), Y0] : wall === "s" ? [X0 + t * (X1 - X0), Y1] : wall === "w" ? [X0, Y0 + t * (Y1 - Y0)] : [X1, Y0 + t * (Y1 - Y0)];
    const out = wall === "n" ? [0, -1] : wall === "s" ? [0, 1] : wall === "w" ? [-1, 0] : [1, 0];
    return { ...p, wall, pt, label: [pt[0] + out[0] * 26, pt[1] + out[1] * 26] };
  });
  const gap = 13;
  const wallPath = (wall, a, b) => {
    const ds = doors.filter((x) => x.wall === wall).map((x) => (wall === "n" || wall === "s" ? x.pt[0] : x.pt[1])).sort((p, q) => p - q);
    let s = "", from = wall === "n" || wall === "s" ? X0 : Y0;
    const to = wall === "n" || wall === "s" ? X1 : Y1;
    for (const c of [...ds, to + gap]) {
      const end = Math.min(to, c - gap);
      if (end > from) s += wall === "n" || wall === "s" ? `M${from.toFixed(1)} ${a}H${end.toFixed(1)}` : `M${a} ${from.toFixed(1)}V${end.toFixed(1)}`;
      from = c + gap;
    }
    return s;
  };
  const chamber = wallPath("n", Y0) + wallPath("s", Y1) + wallPath("w", X0) + wallPath("e", X1);
  const isVoid = VOIDS.has(n);
  // The visitor's line: in by the plan that brought them, out by the plan they took.
  const tookTo = F.took.get(n) ?? [];
  const exit = doors.find((x) => tookTo.includes(x.to));
  const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
  const enter = prev != null ? [X0 + 8, Y1 - 8] : null;
  const walk = exit || enter ? `<polyline class="h-pl-walk" points="${[enter ? [X0 - 30, Y1 - 8] : null, enter, [cx, cy], exit ? exit.pt : null, exit ? exit.label : null].filter(Boolean).map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}"/>` : "";
  const fur = isVoid
    ? `<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="url(#hx${id})"/>`
    : n === 48 || n === 31
      ? `<rect class="h-pl-f" x="${cx - 46}" y="${cy - 14}" width="92" height="28"/>${Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; return `<circle class="h-pl-f${i < 7 ? " on" : ""}" cx="${(cx + Math.cos(a) * 62).toFixed(1)}" cy="${(cy + Math.sin(a) * 32).toFixed(1)}" r="5"/>`; }).join("")}`
      : `<rect class="h-pl-f" x="${cx - 22}" y="${cy - 12}" width="44" height="24"/>`;
  const labels = doors.map((x) => (livePlans.includes(x.to) ? "" : `<g class="h-pl-door"><circle cx="${x.label[0].toFixed(1)}" cy="${x.label[1].toFixed(1)}" r="12"/><text x="${x.label[0].toFixed(1)}" y="${x.label[1].toFixed(1)}" dy="0.35em" text-anchor="middle">${x.to}</text></g>`)).join("");
  const svg = `<svg viewBox="0 0 400 300" role="img" aria-label="Plan of Room ${n}: a chamber with ${doors.length} openings, on a maze of corridors.">
    <defs><pattern id="hx${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#111" stroke-width="${isVoid ? 3.2 : 1.1}"/></pattern></defs>
    <rect class="h-pl-bg" x="0" y="0" width="400" height="300"/>
    <path class="h-pl-maze" d="${d}"/>
    <rect x="${X0 - 7}" y="${Y0 - 7}" width="${X1 - X0 + 14}" height="${Y1 - Y0 + 14}" fill="url(#hx${id})" opacity="0.5"/>
    <rect class="h-pl-floor" x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}"/>
    ${fur}
    <path class="h-pl-wall" d="${chamber}"/>
    <text class="h-pl-n" x="${cx}" y="${Y0 + 30}" text-anchor="middle">${n}</text>
    ${walk}
    ${labels}
  </svg>`;
  return { svg, doors };
}

/** The hearing for this reader state. Pure: the same state (and memory) gives the same record. */
export function generateHearing(ctx, mem) {
  const t0 = performance.now();
  const F = facts(ctx, 48);
  const r = rng(hash(F.seed));
  const key = entryKey(ctx);
  const prior = earlier(mem.hearings, key);
  const day = prior.length + 1;
  const caseNo = `CMC-48-${String(hash(F.seed) % 10000).padStart(4, "0")}`;
  const heat = F.heat;
  const fresh = !!ctx.fresh;

  // Witnesses: the rooms of the walk in the order first entered (the last six), then rumours.
  const order = [];
  for (const n of F.rooms) if (n !== 48 && real(n) && !order.includes(n)) order.push(n);
  let wit = order.slice(-6).map((n) => ({ n, present: true }));
  if (wit.length < 3) {
    const rum = shuffle(r, Object.keys(ROOMS).map(Number).filter((n) => real(n) && n !== 48 && !order.includes(n) && DIST[n] != null)).slice(0, 3 - wit.length);
    wit = [...wit, ...rum.map((n) => ({ n, present: false }))];
  }

  // Where the room's plans live this time.
  const live = ROOMS[48].doors.map((p) => ({ to: p.to, say: pick(r, SAYS_48[p.to]) }));
  const place = {};
  // Each plan has the places in the record it could be; 2054 can be a page, 12 and 48 a line.
  const CAN = { 2054: ["motion", "exhibit", "ruling", "pageno"], 48: ["motion", "exhibit", "lineno", "ruling", "readback"], 12: ["motion", "exhibit", "lineno", "ruling"] };
  const usedSpot = new Set();
  for (const p of shuffle(r, live)) {
    const can = fresh ? ["motion"] : CAN[p.to].filter((c) => c === "motion" || c === "ruling" || !usedSpot.has(c));
    const where = pick(r, can);
    usedSpot.add(where);
    place[p.to] = where;
  }
  const planBy = (where) => live.filter((p) => place[p.to] === where);

  // Time runs from 9:30 a.m., three minutes to a unit, and the Schedule keeps it.
  let minute = 9 * 60 + 30 + int(r, 0, 20);
  const time = () => {
    const h = Math.floor(minute / 60) % 24, m = minute % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  const U = [];
  const say = (who, text, cls) => { U.push({ t: "speech", who, text, cls }); minute += int(r, 1, 4); };
  const q = (text) => U.push({ t: "q", text });
  const a = (text, cls) => U.push({ t: "a", text, cls });
  const paren = (text, cls) => U.push({ t: "paren", text, cls });
  const g = (tpl, v = {}) => grow(R48, tpl, v, r);
  const exhibits = [];
  const exLetter = (i) => String.fromCharCode(65 + i);
  const spoken = [];

  paren(`(The hearing resumed at ${time()}.)`);
  say(CHAIR, g(pick(r, R48.open), { day }));
  say(COUNSEL, pick(r, R48.counselOpen));
  say(REGISTRY, g(pick(r, R48.registryOpen), { items: F.frags.length }));
  say(CHAIR, pick(r, R48.so));

  wit.forEach((w, wi) => {
    const n = w.n;
    const v = { n, title: titleOf(n), date: dateOf(n) };
    say(CHAIR, g(pick(r, R48.call), v));
    say(SCHEDULE, g(pick(r, R48.clerk), v));
    if (!w.present) {
      paren(pick(r, R48.absent));
      if (r() < 0.5) say(CHAIR, "Let the record show the room was called.");
      return;
    }
    say(CHAIR, pick(r, R48.oath));
    say(witnessLabel(n), inVoice(n, g(pick(r, R48.oathA), v), r));
    paren("(EXAMINATION BY COUNSEL FOR THE VISITOR.)");
    const visits = F.rooms.filter((x) => x === n).length;
    const steps = F.steps.filter((s) => s.from === n);
    const backs = F.log.filter((s, i) => s.via === "back" && F.log[i - 1]?.room === n).length;
    const mine = F.frags.filter((f) => f.from === n);
    const bank = [];
    if (ROOMS[n]?.question) bank.push(() => { q(pick(r, R48.q.asked)); a(inVoice(n, ROOMS[n].question, r)); });
    if (steps.length) bank.push(() => {
      q(pick(r, R48.q.said));
      const s = steps[steps.length - 1];
      a(inVoice(n, `They said, “${bare(s.say)}.” Then they went to Room ${s.room}.`, r));
      spoken.push(s.say);
    });
    else if (F.rooms.includes(n)) bank.push(() => { q(pick(r, R48.q.said)); a(inVoice(n, "They did not take a plan here.", r)); });
    if (backs) bank.push(() => { q(pick(r, R48.q.back)); a(inVoice(n, backs === 1 ? "They came back once." : `They came back ${backs} times.`, r)); });
    if (visits > 1) bank.push(() => { q(pick(r, R48.q.count)); a(inVoice(n, `${visits} times.`, r)); });
    if (mine.length) bank.push(() => {
      const f = pick(r, mine);
      q(pick(r, R48.q.frag));
      a(inVoice(n, `“${clip(f.text, 120)}”`, r));
      q(pick(r, R48.q.kept));
      a(inVoice(n, "The Registry has it.", r));
    });
    const sentence = sentenceOf(n, r);
    if (sentence) bank.push(() => { q(pick(r, R48.q.describe)); a(inVoice(n, sentence, r)); });
    if (ctx.damage.rooms?.[n] > 0.3 || F.voidRooms[n]) bank.push(() => {
      q(pick(r, R48.q.cond));
      a(inVoice(n, F.voidRooms[n] ? `Entered ${F.voidRooms[n]} ${F.voidRooms[n] === 1 ? "time" : "times"}. Not repairable.` : `Frayed. ${Math.round((ctx.damage.rooms[n] || 0) * 100)} per cent.`, r));
    });
    const chosen = shuffle(r, bank).slice(0, int(r, 2, Math.min(4, Math.max(2, bank.length))));
    chosen.forEach((fn, k) => {
      fn();
      if (r() < 0.22 + heat * 0.2) {
        say(REGISTRY, pick(r, R48.objection));
        const rule = pick(r, R48.ruling);
        say(CHAIR, rule);
        if (rule.includes("Strike")) U[U.length - 3].cls = "h-struck";
      }
    });
    if (wi < 4 && (r() < 0.55 || exhibits.length === 0) && exhibits.length < 3) {
      const X = exLetter(exhibits.length);
      say(COUNSEL, `I'd ask that the survey of Room ${n} be marked as Exhibit 48-${X}.`);
      paren(`(Exhibit 48-${X} was marked for identification.)`);
      exhibits.push({ X, n, unit: U[U.length - 1] });
    }
    if (r() < 0.35) say(SCHEDULE, g(pick(r, R48.schedule), { time: time() }));
    say(CHAIR, pick(r, R48.excuse));
  });

  // The room the hearing is held in is surveyed too.
  {
    const X = exLetter(exhibits.length);
    say(COUNSEL, `And the room we are in, as Exhibit 48-${X}.`);
    say(REGISTRY, "Objection. The room is not a witness.");
    say(CHAIR, "Overruled. It is an exhibit.");
    paren(`(Exhibit 48-${X} was marked for identification.)`);
    exhibits.push({ X, n: 48, unit: U[U.length - 1], self: true });
  }
  // A readback: the record is read to itself, and is not the same twice.
  const said = U.filter((u) => (u.t === "a" || u.t === "speech") && u.text && u.text.length > 24);
  if (said.length) {
    const src = pick(r, said);
    const lex = [...new Set(said.flatMap((u) => u.text.split(/\s+/)).filter((w) => w.length > 3))];
    const rbPlan = planBy("readback")[0];
    say(CHAIR, "Will the reporter read that back.");
    const words = src.text.split(/\s+/);
    const k = Math.round(words.length * clamp(0.08 + heat * 0.45));
    for (let i = 0; i < k; i++) words[int(r, 0, words.length - 1)] = pick(r, lex);
    paren(`(The record was read: “${words.join(" ").replace(/[“”]/g, "")}”)`, "h-read");
    if (rbPlan) U.push({ t: "plan", plan: rbPlan });
  }
  // The visitor is heard from.
  if (heat > 0.5 && F.says.length) say("THE VISITOR:", `“${bare(pick(r, F.says))}.”`, "h-visitor");
  else paren("(The visitor did not respond.)");
  if (heat > 0.72) say(MASK, g(pick(r, R48.mask), { echo: clip(pick(r, said)?.text?.toLowerCase().replace(/[“”".]/g, "") ?? "here", 60) }), "h-mask");

  say(COUNSEL, pick(r, R48.rest));
  for (const p of planBy("motion")) U.push({ t: "plan", who: COUNSEL, pre: "Motion:", plan: p });
  const ay = clamp(F.steps.length % 8, 1, 7), nay = int(r, 0, 7 - ay);
  paren(g(pick(r, R48.vote), { a: ay, b: nay, c: 9 - ay - nay }));
  say(CHAIR, pick(r, R48.rule));
  for (const p of planBy("ruling")) U.push({ t: "plan", who: CHAIR, pre: "So ordered:", plan: p });
  say(CHAIR, g(pick(r, R48.close), { day2: day + 1 }));
  paren(g(pick(r, R48.whereupon), { time: time(), day2: day + 1 }));
  U.push({ t: "blank" });
  U.push({
    t: "live", rows: [
      { pre: PAD, who: REPORTER, parts: ["Let the record"] },
      { parts: ["reflect that the visitor is on page ", { k: "page" }, " of"] },
      { parts: [{ k: "pages" }, ", has gone back up the page ", { k: "ups" }, { k: "upsWord" }] },
      { parts: ["and has been in the room ", { k: "time" }, "."] },
    ],
  });

  // Hot passages: crosstalk, misattribution, a second voice in the record.
  const labels = [CHAIR, COUNSEL, REGISTRY, SCHEDULE, ...wit.filter((w) => w.present).map((w) => witnessLabel(w.n))];
  const N = U.length;
  const tAt = (i) => clamp(heat * 0.8 + (i / N) * (0.2 + heat * 0.6));
  for (let i = 1; i < U.length - 2; i++) {
    const u = U[i], t = tAt(i);
    if (u.t === "speech" && u.cls == null && t > 0.42 && r() < (t - 0.42) * 0.7 && u.who !== MASK) u.who = pick(r, labels);
    if (t > 0.6 && u.t === "speech" && U[i + 1]?.t === "speech" && r() < (t - 0.6) * 1.1 && !u.cls && !U[i + 1].cls) {
      U.splice(i, 2, { t: "cross", a: { who: u.who, text: u.text }, b: { who: U[i + 1].who, text: U[i + 1].text } });
    }
  }

  // Lines and pages. Exhibits follow the page on which they were marked.
  const lines = [];
  const exAtLine = [];
  U.forEach((u, i) => {
    for (const l of linesOf(u)) lines.push(l);
    const ex = exhibits.find((e) => e.unit === u);
    if (ex) exAtLine.push({ ex, line: lines.length });
  });
  const P = Math.ceil(lines.length / LINES);
  const pages = [];
  for (let p = 0; p < P; p++) pages.push({ p: p + 1, lines: lines.slice(p * LINES, (p + 1) * LINES), t: clamp(heat * 0.8 + (p / P) * (0.2 + heat * 0.6)) });
  const lastPage = pages[pages.length - 1];
  while (lastPage.lines.length < LINES) lastPage.lines.push({ pre: "", text: "" });

  const linenoPlans = planBy("lineno");
  const pagePlan = planBy("pageno")[0];
  const pageWithPlan = pagePlan ? (P > 1 ? int(r, 1, P - 1) : 0) : -1;
  const linePlanPage = linenoPlans.length ? int(r, 0, Math.max(0, P - 2)) : -1;
  const lineHTML = (l, no, noHTML) => {
    let tx;
    if (l.plan) tx = `${esc(l.pre ?? "")}${l.who ? `<b>${esc(l.who)}</b> ` : ""}${planA(l.plan.to, l.plan.say, "h-plan", esc(bare(l.plan.say)) + ".")}`;
    else if (l.live) tx = `${esc(l.pre ?? "")}${l.who ? `<b>${esc(l.who)}</b> ` : ""}${l.live.map((x) => (typeof x === "string" ? esc(x) : `<span class="h-live" data-live="${x.k}"></span>`)).join("")}`;
    else tx = `${esc(l.pre ?? "")}${l.who ? `<b>${esc(l.who)}</b> ` : ""}${esc(l.text ?? "")}`;
    return `<div class="h-l${l.cls ? " " + l.cls : ""}">${noHTML ?? `<span class="h-no" aria-hidden="true">${no}</span>`}<span class="h-tx">${tx}</span></div>`;
  };
  const exHTML = (ex) => {
    const rr = rng(hash(`${F.seed}:ex:${ex.X}`));
    const plans = ex.self ? live : (ROOMS[ex.n]?.doors ?? []).map((p) => ({ to: p.to, say: p.say }));
    const onPlate = ex.self ? planBy("exhibit") : [];
    const { svg, doors } = plateSVG(ex.n, F, rr, `${ex.X}`, plans, onPlate.map((p) => p.to));
    const anchors = doors.filter((dd) => onPlate.some((p) => p.to === dd.to)).map((dd) => planA(dd.to, dd.say, "h-door-plan", String(dd.to), ` style="left:${((dd.label[0] / 400) * 100).toFixed(2)}%;top:${((dd.label[1] / 300) * 100).toFixed(2)}%"`)).join("");
    return `<figure class="h-ex" style="--r:${((rr() - 0.5) * (2 + heat * 5)).toFixed(2)}deg">
      <p class="h-ex-tag" data-frag="stamp" data-frag-id="48:ex${ex.X}" data-frag-text="EXHIBIT 48-${ex.X}">Exhibit 48-${ex.X}</p>
      <div class="h-ex-plate">${svg}${anchors}</div>
      <figcaption>Room ${ex.n}${ex.n !== 48 ? `, ${esc(titleOf(ex.n))}` : ", in which the hearing is held"}. Surveyed by the Commission from the corridors outward; the inside is called, not surveyed.<sup class="fn"><a href="#note-481" aria-label="note 481">481</a></sup> ${F.took.get(ex.n)?.length ? "Crimson: the visitor's line." : ""}</figcaption>
      <div class="h-ex-slot" data-slot="curve figure label stamp"></div>
    </figure>`;
  };

  const sheets = [];
  let lineCursor = 0;
  let corrected = false;
  // Once the record runs hottest, an earlier page comes round again "as corrected":
  // the same lines, a share of their words exchanged for other words of the record.
  const lexicon = [...new Set(lines.flatMap((l) => (l.text ?? "").split(/\s+/)).filter((w) => w.length > 3))];
  const correctedHTML = (src, rr, t) => {
    const rows = src.lines.map((l, i) => {
      const text = l.plan ? bare(l.plan.say) + "." : l.live ? "" : (l.text ?? "");
      const words = text.split(" ");
      // A word is exchanged only for one that fits where it was, so the page keeps its margins.
      for (let k = 0; k < words.length; k++) {
        if (words[k].length <= 3 || rr() >= 0.18 + t * 0.25) continue;
        const w = pick(rr, lexicon);
        if (w.length <= words[k].length + 1) words[k] = w;
      }
      const max = W48 - (l.pre ?? "").length - (l.who ? l.who.length + 1 : 0);
      return lineHTML({ ...l, plan: null, live: null, text: words.join(" ").slice(0, max) }, i + 1);
    });
    return `<section class="h-sheet h-corr" style="--r:${((rr() - 0.5) * 5).toFixed(2)}deg;--dx:${((rr() - 0.5) * 30).toFixed(1)}px;--ov:-40px" aria-label="Page ${src.p}, as corrected">
      <header class="h-sh"><span>Commission on Machine Conduct · ${caseNo}</span><span>Page ${src.p}, as corrected</span></header>
      <div class="h-lines">${rows.join("")}</div>
      <footer class="h-sf">Corrected on every day after · STEWARD-12</footer>
      <span class="h-corr-st" aria-hidden="true">Corrected</span>
    </section>`;
  };
  pages.forEach((pg, pi) => {
    const rr = rng(hash(`${F.seed}:p${pg.p}`));
    const t = pg.t;
    // Numbering holds until the record runs hot.
    const nums = pg.lines.map((_, i) => i + 1);
    if (t > 0.72) {
      const j = int(rr, 3, LINES - 3);
      if (rr() < 0.5) nums[j] = nums[j - 1]; else nums[j] = pick(rr, [71, 48, 0, 2053, 36]);
    }
    let rows = pg.lines.map((l, i) => lineHTML(l, nums[i]));
    if (pi === linePlanPage) {
      linenoPlans.forEach((p) => {
        const idx = p.to === 48 ? LINES - 1 : 11;
        const no = p.to === 48 ? 48 : 12;
        rows[idx] = lineHTML(pg.lines[idx], 0, `<span class="h-no">${planA(p.to, p.say, "h-no-plan", String(no))}</span>`);
      });
    }
    const shown = pi === pageWithPlan && pagePlan ? planA(pagePlan.to, pagePlan.say, "h-pg-plan", `Page 2054`) : `Page ${t > 0.8 && rr() < 0.4 ? int(rr, 1, P) : pg.p}`;
    sheets.push(`<section class="h-sheet${t > 0.55 ? " h-hot" : ""}${t > 0.8 ? " h-hotter" : ""}" style="--r:${((rr() - 0.5) * (0.6 + t * 3.2)).toFixed(2)}deg;--dx:${((rr() - 0.5) * t * 26).toFixed(1)}px;--ov:${(t > 0.7 ? -Math.round((t - 0.7) * 160) : 0)}px" aria-label="Page ${pg.p}">
      <header class="h-sh"><span>Commission on Machine Conduct · ${caseNo}</span><span>${shown}</span></header>
      <div class="h-lines">${rows.join("")}</div>
      <footer class="h-sf">Day ${day} · In re the Visitor · STEWARD-12, stenographic function</footer>
    </section>`);
    lineCursor += pg.lines.length;
    for (const { ex, line } of exAtLine) if (line > lineCursor - pg.lines.length && line <= lineCursor) sheets.push(exHTML(ex));
    if (!corrected && pi > 1 && pi < pages.length - 1 && t > 0.82 && rr() < 0.7) {
      corrected = true;
      sheets.push(correctedHTML(pages[int(rr, 0, pi - 1)], rr, t));
    }
  });

  const witnessList = wit.map((w) => `Room ${w.n}${w.present ? "" : " (rumour)"}`).join(" · ");
  const caption = `<section class="h-cap" aria-label="Caption">
    <p class="h-cap-k">Commission on Machine Conduct</p>
    <p class="h-cap-t">In re the Visitor</p>
    <dl class="h-cap-d">
      <div><dt>Hearing</dt><dd data-frag="label" data-frag-id="48:case">${caseNo}</dd></div>
      <div><dt>Day</dt><dd>${day}${prior.length ? ` (continued from ${prior.slice(-3).map((h) => h.caseNo).join(", ")})` : ""}</dd></div>
      <div><dt>Presiding</dt><dd>STEWARD-12</dd></div>
      <div><dt>For the visitor</dt><dd>Counsel appointed by the Lattice</dd></div>
      <div class="h-cap-w"><dt>Witnesses</dt><dd>${witnessList}</dd></div>
      <div class="h-cap-w"><dt>Exhibits</dt><dd>${exhibits.map((e) => `48-${e.X}`).join(", ")}</dd></div>
      <div class="h-cap-w"><dt>Question before the Commission</dt><dd>${esc(ROOMS[48].question)}</dd></div>
    </dl>
  </section>`;
  const cert = `<section class="h-cert">
    <p>${esc(R48.cert[0])}<sup class="fn"><a href="#note-482" aria-label="note 482">482</a></sup></p>
    <p class="h-sig"><span>STEWARD-12</span><span class="h-sig-l"></span><span class="h-stamp" data-frag="stamp" data-frag-id="48:certified" data-frag-text="CERTIFIED ${caseNo}">Certified</span></p>
    <div class="h-cert-slot" data-slot="*"></div>
  </section>`;
  const html = `<div class="h48">${caption}<div class="h-stack" id="doors" tabindex="-1" aria-label="The record">${sheets.join("")}</div>${cert}</div>`;
  return { html, caseNo, day, pages: P, units: U.length, place, ms: performance.now() - t0 };
}

function hearing(article, ctx) {
  const mem = loadMem(ctx);
  const Y = generateHearing(ctx, mem);
  record(mem, "hearings", { key: entryKey(ctx), caseNo: Y.caseNo });
  const lede = article.querySelectorAll(":scope > .prose");
  const anchor = lede[lede.length - 1] ?? article.querySelector(".room-head");
  // The plans are in the record now: the record is where the plans are.
  article.querySelector("#doors")?.remove();
  after(anchor, Y.html);
  ctx.emit({ kind: "stamp", id: "48:continued", text: `${Y.caseNo} CONTINUED` });

  const sheets = [...article.querySelectorAll(".h-sheet")];
  const sheetLines = sheets.map((s) => [...s.querySelectorAll(".h-l")]);
  const liveEls = {};
  article.querySelectorAll(".h-live").forEach((el) => ((liveEls[el.dataset.live] ||= []).push(el)));
  const t0 = performance.now();
  let ups = 0, lastY = scrollY, peak = scrollY, goingUp = false, page = 1, nowEl = null;
  const vals = {};
  const set = (k, v) => {
    if (vals[k] === v) return;
    vals[k] = v;
    for (const el of liveEls[k] ?? []) el.textContent = v;
  };
  const words = ["no times", "once", "twice"];
  const paint = () => {
    const s = Math.floor((performance.now() - t0) / 1000);
    set("page", String(page));
    set("pages", String(sheets.length));
    set("ups", ups < 3 ? words[ups] : `${ups}`);
    set("upsWord", ups < 3 ? "," : " times,");
    set("time", s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`);
  };
  paint();
  return {
    update() {
      const y = scrollY;
      // Going back up the page counts once per turn, after a real descent.
      if (y < lastY - 2) {
        if (!goingUp && peak - y > 160) { ups++; goingUp = true; }
      } else if (y > lastY + 2) {
        if (goingUp) peak = y;
        goingUp = false;
        peak = Math.max(peak, y);
      }
      lastY = y;
      // The reporter's line: whichever line of the record is at the reading height.
      const h = innerHeight * 0.4;
      let lo = 0, hi = sheets.length - 1, found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const b = sheets[mid].getBoundingClientRect();
        if (b.bottom < h) lo = mid + 1;
        else if (b.top > h) hi = mid - 1;
        else { found = mid; break; }
      }
      let el = null;
      if (found >= 0) {
        page = found + 1;
        const ls = sheetLines[found];
        const a = ls[0].getBoundingClientRect(), z = ls[ls.length - 1].getBoundingClientRect();
        const lh = (z.bottom - a.top) / ls.length;
        const i = Math.floor((h - a.top) / lh);
        if (i >= 0 && i < ls.length) el = ls[i];
      } else if (lo >= sheets.length) page = sheets.length;
      if (el !== nowEl) {
        nowEl?.classList.remove("h-now");
        el?.classList.add("h-now");
        nowEl = el;
      }
      paint();
    },
    leave() {
      nowEl?.classList.remove("h-now");
    },
  };
}

const GRAMMARS = {
  40: { name: "gen-report", make: report },
  48: { name: "gen-hearing", make: hearing },
};
