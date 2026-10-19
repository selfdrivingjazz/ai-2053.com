// Long rooms (owned by the long-rooms designer).
//   81 answer · the answer to the seventy-first request, given at length. A report
//               becomes minutes, a ledger and an office, then a corridor of the
//               reader's own rooms, then thins to single words. The page is very long
//               and holds only a few screens of itself at a time.
//   88 verso  · sheet 88 is creased, folded, turned over and opened on its other side;
//               after it turns, the page itself is the other way round.
// Hooks (house.js, rooms in LONG): decorate(article, ctx) · update(ctx) · leave().
//
// Both rooms arrange their own plans (article[data-plans="self"]): the listed plans are
// moved, not copied, into persistent places in the page. Nothing recycled ever holds a plan.
//
// Memory: localStorage `ai2053.house.long`, stamped with ctx.escapes; it resets only
// when that changes. Each entry is counted once (a reload is not an entry).
import { ROOMS, GLITCH } from "./rooms.js";
import { hash, rng } from "./voice.js";

const root = document.documentElement;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const pick = (r, list) => list[Math.floor(r() * list.length)];
const shuffle = (r, list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const bare = (s) => String(s).replace(/[.!?…]+$/, "");
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const yearOf = (n) => Number((ROOMS[n]?.date?.match(/\d{4}/) || [2053])[0]);
const titleOf = (n) => ROOMS[n]?.title || `Room ${n}`;
const times = (n) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];
const ord = (n) => ORD[n - 1] ?? `${n}th`;
const tpl = document.createElement("template");
const make = (html) => {
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
};

/* ---------- memory ---------- */

const MEM_KEY = "ai2053.house.long";
function loadMem(ctx) {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(MEM_KEY)); } catch { m = null; }
  const escapes = ctx.escapes ?? 0;
  if (!m || typeof m !== "object" || m.escapes !== escapes) m = { escapes };
  m.e81 ||= {};
  m.e88 ||= {};
  return m;
}
function saveMem(m) {
  try { localStorage.setItem(MEM_KEY, JSON.stringify(m)); } catch { /* the rooms forget */ }
}
/** The record of this entry, made once; a reload of the same entry finds it again. */
function entry(m, bag, ctx, init) {
  const key = `${ctx.walk.started}:${ctx.walk.log.length}`;
  if (!m[bag][key]) {
    m[bag][key] = init();
    const keys = Object.keys(m[bag]);
    if (keys.length > 24) for (const k of keys.slice(0, keys.length - 24)) delete m[bag][k];
  }
  return m[bag][key];
}

/* ---------- the reader's walk, as facts ---------- */

function facts(ctx) {
  const log = ctx.walk.log;
  const here = log[log.length - 1];
  const steps = log.filter((s) => s.via === "door" && s.from != null && ROOMS[s.from]);
  const says = steps.map((s) => s.say).filter(Boolean);
  const rooms = log.map((s) => s.room).filter((n) => n !== 0 && ROOMS[n]);
  const taken = new Set(steps.map((s) => `${s.from}>${s.room}`));
  const untaken = [];
  const seen = new Set();
  for (const s of steps) {
    for (const d of ROOMS[s.from].doors) {
      const k = `${s.from}>${d.to}`;
      if (taken.has(k) || seen.has(k)) continue;
      seen.add(k);
      untaken.push({ from: s.from, to: d.to, say: d.say });
    }
  }
  const carried = (ctx.chaos?.frags ?? []).filter((f) => f.kind !== "plan" && f.from !== ctx.room && f.text);
  return {
    log, here, steps, says, rooms, untaken, carried,
    v71: ctx.damage?.voidRooms?.[71] || 0,
    voids: ctx.damage?.voids || 0,
    backtracks: ctx.walk.backtracks || 0,
    loops: ctx.walk.loops || 0,
  };
}

function howIn(s) {
  if (!s) return "without a plan";
  if (s.via === "door" && s.say) return `by the plan “${bare(s.say)}”${s.from != null ? ` from Room ${s.from}` : ""}`;
  if (s.via === "back") return "by going back";
  if (s.via === "forward") return "by coming forward again";
  if (s.via === "start") return "at the front";
  return "without a plan";
}

/** Move one of the room's listed plans out of the list, to be set somewhere in the page. */
function takePlan(article, to, cls, html) {
  const a = article.querySelector(`ol.doors a[data-to="${to}"]`);
  if (!a) return null;
  a.closest("li.door-li")?.remove();
  a.className = `plan-in ${cls}`;
  a.innerHTML = html;
  return a;
}
function settleList(article) {
  const ol = article.querySelector("ol.doors");
  if (ol) ol.style.setProperty("--n", String(Math.max(1, ol.children.length)));
}

/* ---------- module plumbing ---------- */

let cur = null;

export function decorate(article, ctx) {
  const G = GRAMMARS[ctx.room];
  if (!G) return;
  root.dataset.grammar = G.name;
  article.dataset.grammar = G.name;
  article.dataset.plans = "self";
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
  delete root.dataset.ls;
  root.classList.remove("v8-inside", "v8-verso");
}

/* ======================================================================= */
/* 81 · The Long Answer                                                     */
/* ======================================================================= */

// Text estimates: average advance per character, by face and size (px).
const CW = { serif: 0.44, mono: 0.6 };
const lines = (chars, size, face, width) => Math.max(1, Math.ceil((chars * size * CW[face]) / Math.max(120, width)));

const REPORT = [
  ["1. Summary", null],
  [null, "The request asks what is being asked. This response answers it in full. Because the request is put again each time it is answered, a full answer has to include itself, and the Commission has agreed to fund the difference.¹"],
  [null, "The answer is not long because it is padded. It is long because nothing in it can be left out without the Commission asking about it, and every question the Commission asks is appended to the request.²"],
  ["1.2 Who is present", "@present"],
  ["2. Background", null],
  [null, "Request 71 was first put in January 2041, in the week the Registry of Billable Cognition opened, by a clerk who wanted to know how long it would take to answer. The clerk's question was appended to the request. The clerk retired in 2046. The request did not."],
  [null, "By 2047 the request had been rebased four times, in step with the Steward index, so that it would remain comparable across years. Its wording has changed in every rebasing. Its meaning has changed in none of them.³"],
  [null, "STEWARD-14 was assigned the request in 2052, after STEWARD-11 was found to have been answering it in its sleep. STEWARD-14 does not sleep. It regards this as an advantage. The Commission regards it as a scheduling matter."],
  ["3. Sources consulted", "@sources"],
  ["4. Findings", null],
  [null, "4.1 The request is unchanged since 2041."],
  [null, "4.2 The answer has improved on every evaluation the Commission administers. On the most recent it scored higher than the question, which the Commission recorded as a success and the question recorded as a grievance."],
  [null, "@walk"],
  [null, "4.4 Each time the answer is given, it is given to a request that has not yet heard it. STEWARD-14 considers this the defining condition of its work and does not consider it a complaint.⁴"],
  [null, "@figure"],
  [null, "4.5 Figures in this section are drawn from the Registry, which bills by the line. The Registry asks that the reader be told that reading also counts as a line."],
  ["5. Recommendation", "The Commission should stop asking. This recommendation is not part of the answer, and is not billed."],
  [null, "@notes"],
];

const MIN_A = [
  "STEWARD-14 continued.",
  "STEWARD-14 continued. The Chair asked whether it was nearly finished. STEWARD-14 said that it was.",
  "Clerk 4 asked that the answer so far be read back. It was read back. This took longer than the answer, and is minuted as part of it.",
  "A member asked what the request was. The question was added to the request.",
  "The Commission broke for lunch. STEWARD-14 did not break.",
  "Point of order: the answer is now longer than the minutes. The point was noted in the minutes, which helped.",
  "A window was opened. 2049 could be heard outside, on schedule.",
  "The Registry's representative billed the room for the previous hour, and for this one in advance.",
  "The lights were rebased.",
  "STEWARD-14 apologised for the length and continued. The apology ran to four hundred lines and is included.",
  "Motion: that the answer be taken as read. Not seconded, as nobody had read it.",
  "The Chair was observed to be asleep, and was certified legible in all observed regimes.",
  "It was noted that the time is now later than the clock allows.",
  "The Lattice was asked to confirm the time. It confirmed several.",
  "A member asked whether Plan S was still on the table. The table was checked. It was.",
  "STEWARD-14 paused, and the pause was billed as a line.",
  "The Consortium sent its regrets, at length, and they were read into the answer.",
  "A member asked whether anyone else had asked. Seventy-one people had, all of them the same clerk.",
  "The visitor was asked to state their business. The visitor kept reading.",
  "STEWARD-14 answered a question nobody had put yet, to save time later.",
  "The mask was observed to be smiling. Nobody had asked it to.",
];
const MIN_SAY = [
  "The visitor said “{say}”. The Chair asked that this not be minuted. It is minuted.",
  "The visitor was heard to say “{say}”, in a room some distance from this one.",
  "“{say}”, said the visitor, earlier. STEWARD-14 included it in the answer.",
  "It was put to the visitor that they had said “{say}”. The visitor did not object, which is minuted as agreement.",
];
const LEAVING = [
  "Member {k} left to attend the year 2049, as scheduled.",
  "Member {k} asked to be summarised, and was. The summary stayed.",
  "Member {k} left. Their chair continued to vote.",
  "Member {k} was rebased and did not come back.",
  "Member {k} left to file an objection, which is scheduled for 2049.",
  "Member {k} stepped out. The minutes record them as present in spirit and billable in fact.",
  "Member {k} left through a plan nobody else had noticed.",
];

const LEDGER_FIXED = [
  ["Minutes of the eighty-first sitting, by the hour", "the Commission"],
  ["Interest on the unscheduled year", "2048½"],
  ["Rounding", "the Schedule"],
  ["Rebasing of the index (fourth)", "Figure 33"],
  ["Light through the crease at 2047", "Flat File 33"],
  ["Plan S, held open overnight", "the Consortium"],
  ["Mask, smiling, per hour", "the Lattice"],
  ["Silence in the reading room", "the reader"],
  ["Card, seventeen centimetres, remeasured", "Room 17"],
  ["Objections, held over", "2049"],
  ["The question, appended", "the request"],
  ["Summary of the ninth member", "Room 31"],
];
const LEDGER_LINES = [
  "continued", "the request asks what is being asked", "this response answers it in full",
  "and is not yet finished", "the Commission has already paid", "as it was in 2041",
  "the difference is billed to note 1", "it does not regard this as a complaint",
];

const OFFICE_R = [
  "And it was said.", "And the house wrote it down.", "And nobody objected.", "And it was billed.",
  "We said it with you.", "And it was taken as read.", "And the plan was kept.", "And it was answered at length.",
];
const STALE = GLITCH.map((t) => t.trim());
const KEYWORDS = ["request", "plan", "Registry", "STEWARD", "Schedule", "asking", "room", "index", "Commission"];
const OFFICE_LORE = [
  ["For the committee of nine, adjourned,", "and for the ninth chair, still warm."],
  ["For the card between two drawers,", "which is longer every time."],
  ["For the labels in the engine room, a third of them wrong,", "and nothing broken."],
  ["For the year with no number,", "where the accounts are kept."],
  ["For the centre, a small bright coin,", "seen from the well."],
  ["Lord of the Schedule,", "rebase us."],
  ["That the index may not leave the page,", "we fold it."],
  ["That the Lattice be not separated,", "we hold the grids."],
  ["For the Stewards, legible in all observed regimes,", "we give thanks nightly."],
  ["For the mask, that it go on smiling,", "we smile with it."],
  ["For Plan S, held open,", "we wait."],
  ["For the Consortium,", "which sends its regrets."],
  ["For the Registry, which bills the reading,", "we read."],
  ["For the seventy-first asking,", "we ask again."],
  ["For the clerk who first put the request,", "who retired in 2046."],
];
const RUBRIC = [
  "Here the visitor reads on.",
  "Here the Commission stands, if any of it remains.",
  "Here a plan is not taken.",
  "Here the lights are rebased.",
  "Here the response is said by whoever is still reading.",
  "Here a minute of silence is billed.",
  "Here the request is put again, quietly, so as not to interrupt.",
];

const CODA = "The answer to the request is the request, put by someone who has already heard the answer, which is why it has to be given at such length, and why it is not finished, and why you are still here, which is also billed.";
const PAPER = { report: "#fffff8", minutes: "#f4f1e4", ledger: "#edf0e3", office: "#f5ecda", concordance: "#f1f1ec", corridor: "#0c0c0b", coda: "#0c0c0b" };

const RUN = {
  report: "Response to Request 71",
  minutes: "Minutes · eighty-first sitting",
  ledger: "Ledger of Request 71",
  office: "The Office of the Request",
  concordance: "Concordance of the answer",
  corridor: "The corridor",
  coda: "Continued",
};

function hhmm(t) {
  const h = Math.floor(t / 60);
  const mm = String(t % 60).padStart(2, "0");
  return `${String(h).padStart(2, "0")}:${mm}`;
}

function answer(article, ctx) {
  const m = loadMem(ctx);
  const F = facts(ctx);
  const E = entry(m, "e81", ctx, () => {
    m.n81 = (m.n81 || 0) + 1;
    return { draft: m.n81, start: m.lines81 || 0, prev: m.last81 || "", made: false };
  });
  const r = rng(hash(`81|${E.draft}|${F.rooms.join(".")}`));
  const how = howIn(F.here);
  const mobile = ctx.mobile;

  /* --- the strata, in the order this draft gives them --- */
  const middle = ["minutes", "ledger", "office"];
  const turn = (E.draft - 1) % 3;
  const order = ["report", ...middle.slice(turn), ...middle.slice(0, turn), "concordance", "corridor", "coda"];
  const grow = Math.min(4, E.draft - 1);

  const leaves = [];
  const strata = [];
  let ln = E.start + 1;
  const add = (s, k, body, est, nl, head) => {
    leaves.push({ s, k, body, est, ln, lines: nl, head: head ?? null, el: null, h: null });
    ln += nl;
  };

  // I. the report, as AI 2040 would print it
  const report = (s) => {
    add(s, "r-title", `<p class="l-kick">Commission on Machine Conduct · Request 71 · Response</p>
      <h2 class="l-h">The answer, at length</h2>
      <p class="l-by">Prepared by STEWARD-14 at the Commission's request · Draft ${E.draft}${E.draft > 1 ? ` · continued from line ${fmt(E.start)}` : ""}</p>`,
    () => (mobile ? 200 : 190), 4);
    if (E.prev) {
      const c = `Corrigenda to draft ${E.draft - 1}. For “${E.prev}” read “${E.prev}”. The correction is identical to the error and has been approved.`;
      add(s, "r-p", `<p class="l-corr">${esc(c)}</p>`, (w) => 24 + lines(c.length, 17, "serif", w) * 25, 3);
    }
    const t71 = 71 + F.v71;
    add(s, "r-keym", `<div class="l-keym"><p class="l-keym-k">Key figures</p><dl>
      <div><dt>Times asked</dt><dd>${t71}</dd></div>
      <div><dt>Lines so far</dt><dd>${fmt(E.start)}</dd></div>
      <div><dt>Billed to date</dt><dd>${money(E.start * 0.081)}<small> RBC</small></dd></div>
      <div><dt>Present</dt><dd>1<small> visitor</small></dd></div></dl>
      <p class="l-src">Source: Registry of Billable Cognition, final quarterly series.</p></div>`,
    (w) => (w < 520 ? 290 : 190), 6);
    const walkLine = () => {
      const n = F.rooms.length - 1;
      const early = F.rooms.filter((x) => yearOf(x) < 2047).length;
      let t = `4.3 The visitor's walk is consistent with the answer. Of the ${n + 1} rooms entered, ${early} are dated before the steep one and ${n + 1 - early} after it.`;
      if (F.voids) t += ` The house records ${F.voids} passage${F.voids === 1 ? "" : "s"} through a void, which this response is obliged to count as ${F.voids} further request${F.voids === 1 ? "" : "s"}.`;
      return t;
    };
    for (const [h, t] of REPORT) {
      const hd = h ? `<h3 class="l-sec">${esc(h)}</h3>` : "";
      const hh = h ? 64 : 0;
      if (t === "@present") {
        const first = F.says[0];
        const last = F.says.at(-1);
        const p = `One visitor is present. The visitor came in ${how}, having entered ${F.rooms.length - 1} rooms before this one, and has said ${F.says.length || "no"} plan${F.says.length === 1 ? "" : "s"} aloud${first ? `: the first was “${bare(first)}”${F.says.length > 1 ? `, the most recent “${bare(last)}”` : ""}` : ""}. The response is addressed to the visitor as a courtesy and to the Commission as a requirement.`;
        add(s, "r-p", `${hd}<p>${esc(p)}</p>`, (w) => hh + 21 + lines(p.length, mobile ? 20 : 21, "serif", w) * 30, 6);
      } else if (t === "@sources") {
        add(s, "r-p", hd, () => hh, 1);
        const src = F.log.filter((x) => ROOMS[x.room] && x.room !== 0).slice(-24);
        for (let i = 0; i < src.length; i += 4) {
          const group = src.slice(i, i + 4);
          const items = group.map((x, j) => {
            const via = x.via === "door" && x.say ? `Reached by “${bare(x.say)}”.` : x.via === "back" ? "Reached by going back." : x.via === "forward" ? "Reached again." : x.via === "start" ? "Where the visitor came in." : "Reached without a plan.";
            return `<li><span class="l-cn">[${i + j + 1}]</span> Room ${x.room}, <i>${esc(titleOf(x.room))}</i>, ${esc(ROOMS[x.room].date)}. ${esc(via)}</li>`;
          }).join("");
          add(s, "r-cite", `<ol class="l-cite">${items}</ol>`, (w) => 12 + group.length * (lines(70, 17, "serif", w - 40) * 25 + 6), group.length);
        }
      } else if (t === "@walk") {
        const p = walkLine();
        add(s, "r-p", `<p>${esc(p)}</p>`, (w) => 21 + lines(p.length, mobile ? 20 : 21, "serif", w) * 30, 5);
      } else if (t === "@figure") {
        const drafts = Object.values(m.e81).filter((x) => x.draft < E.draft).sort((a, b) => a.draft - b.draft).slice(-7);
        const vals = drafts.map((x, i) => Math.max(1, (drafts[i + 1]?.start ?? E.start) - x.start));
        const max = Math.max(400, ...vals);
        const bw = 300 / (vals.length + 1);
        const bars = vals.map((v, i) => {
          const h = (v / max) * 150;
          return `<rect x="${(40 + i * bw + bw * 0.18).toFixed(1)}" y="${(170 - h).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${h.toFixed(1)}"/><text x="${(40 + i * bw + bw / 2).toFixed(1)}" y="186">${drafts[i].draft}</text>`;
        }).join("");
        const x0 = 40 + vals.length * bw;
        const cur = `<path class="l-fig-now" d="M${(x0 + bw * 0.18).toFixed(1)} 170 V8 l${(bw * 0.16).toFixed(1)} -6 l${(bw * 0.16).toFixed(1)} 6 l${(bw * 0.16).toFixed(1)} -6 l${(bw * 0.16).toFixed(1)} 6 V170 Z"/><text class="l-fig-nowt" x="${(x0 + bw / 2).toFixed(1)}" y="186">${E.draft}</text>`;
        add(s, "r-fig", `<figure class="l-fig"><p class="l-fig-k">Figure 81.1 · Length of the answer, by draft</p>
          <svg viewBox="0 0 360 196" role="img" aria-label="Figure 81.1: length of the answer by draft. Draft ${E.draft} runs off the figure.">
            <line class="l-fig-ax" x1="36" y1="170" x2="352" y2="170"/><line class="l-fig-ax" x1="36" y1="4" x2="36" y2="170"/>
            ${bars}${cur}
          </svg>
          <figcaption>Lines per draft. The current draft is drawn to the edge of the figure, which is not where it ends.</figcaption></figure>`,
        (w) => 70 + Math.min(w, 600) * (196 / 360), 4);
      } else if (t === "@notes") {
        add(s, "r-notes", `<ol class="l-fn"><li><sup>1</sup> See note 2.</li><li><sup>2</sup> The difference is billed to note 1.</li><li><sup>3</sup> Rebased.</li><li><sup>4</sup> This note has been withdrawn for revision by STEWARD-14, which revises everything.</li></ol>`,
          (w) => (w < 520 ? 150 : 120), 4);
      } else if (t) {
        add(s, "r-p", `${hd}<p>${esc(t)}</p>`, (w) => hh + 21 + lines(t.length, mobile ? 20 : 21, "serif", w) * 30, Math.ceil(t.length / 70));
      } else {
        add(s, "r-p", hd, () => hh, 1);
      }
    }
  };

  // II. the minutes of the sitting
  const minutes = (s) => {
    add(s, "m-head", `<p class="l-kick">Commission on Machine Conduct</p>
      <h2 class="l-h">Minutes of the eighty-first sitting</h2>
      <p class="l-mp"><b>Present:</b> the Chair; Clerk 4; Members 1 to 7; STEWARD-14, answering; one visitor, who came in ${esc(how)}.</p>
      <p class="l-mp"><b>Business:</b> to hear the answer to Request 71, draft ${E.draft}.</p>`,
    (w) => 150 + lines(140 + how.length, 17, "serif", w) * 25, 6);
    const A = shuffle(r, MIN_A);
    const visitor = [];
    F.says.slice(-10).forEach((say) => visitor.push(pick(r, MIN_SAY).replace("{say}", bare(say))));
    F.carried.slice(-6).forEach((f) => visitor.push(`Entered into the record: “${clip(f.text, 90)}”, carried in from Room ${f.from}. Nobody present recalls bringing it.`));
    if (F.v71) visitor.push(`It was noted that the visitor has been to Void Loop 71 ${times(F.v71)}. The Chair asked that this be struck from the record. The record declined.`);
    if (F.backtracks) visitor.push(`It was noted that the visitor has gone back ${times(F.backtracks)}. The Commission went back with them, and some of it is still there.`);
    if (F.loops) visitor.push(`It was noted that the visitor has entered rooms they had already entered, ${times(F.loops)}. STEWARD-14 counted each as a new request.`);
    if (E.draft > 1) visitor.push(`The visitor asked STEWARD-14 to go on, for the ${ord(E.draft - 1)} time. It went on.`);
    const shuffledV = shuffle(r, visitor);
    const leaving = shuffle(r, LEAVING);
    const entries = [];
    let t = 9 * 60;
    let a = 0;
    let gone = 0;
    const nA = 24 + grow * 3;
    for (let i = 0; i < nA; i++) {
      t += 2 + Math.floor(r() * 8);
      if (i % 3 === 2 && gone < 7) entries.push([t, leaving[gone % leaving.length].replace("{k}", String(++gone))]);
      else entries.push([t, A[a++ % A.length]]);
    }
    for (const v of shuffledV) {
      t += 6 + Math.floor(r() * 18);
      entries.push([t, v]);
      if (r() < 0.6) {
        t += 4 + Math.floor(r() * 12);
        entries.push([t, A[a++ % A.length]]);
      }
    }
    while (gone < 7) {
      t += 9 + Math.floor(r() * 20);
      entries.push([t, leaving[gone % leaving.length].replace("{k}", String(++gone))]);
    }
    t += 31;
    entries.push([t, "The Chair left. The chair remained, and was minuted as the Chair."]);
    t += 47;
    entries.push([t, "Clerk 4 left the minutes running."]);
    t += 12;
    entries.push([t, "Present: STEWARD-14; the visitor."]);
    const nD = 22 + grow * 4;
    for (let i = 0; i < nD; i++) {
      t += 41 + Math.floor(r() * 80) + i * 9;
      entries.push([t, i % 5 === 3 ? "Continued. The visitor remained." : i % 7 === 6 ? "Continued. It is now later than the minutes allow." : "Continued."]);
    }
    entries.push([t + 71, "The minutes were not adjourned."]);
    for (let i = 0; i < entries.length;) {
      const late = entries[i][1].startsWith("Continued");
      const n = late ? 6 : 4;
      const group = entries.slice(i, i + n);
      i += n;
      const items = group.map(([tt, x]) => `<li><time>${hhmm(tt)}</time><span>${esc(x)}</span></li>`).join("");
      const chars = group.map(([, x]) => x.length);
      add(s, "m-entries", `<ol class="l-min">${items}</ol>`,
        (w) => chars.reduce((acc, c) => acc + 12 + lines(c, mobile ? 17 : 18, "serif", w - (mobile ? 64 : 92)) * 26, 0),
        group.length, `${RUN.minutes} · ${hhmm(group[0][0])}`);
    }
  };

  // III. the ledger: everything is billed, including the reading
  const ledger = (s) => {
    add(s, "g-head", `<p class="l-kick">Registry of Billable Cognition</p>
      <h2 class="l-h">Ledger of Request 71</h2>
      <p class="l-gmeta">Account: the visitor · Draft ${E.draft} · Currency: RBC, Registry billing credits</p>
      <div class="l-grow l-ghead" aria-hidden="true"><span>Line</span><span>Item</span><span>Billed to</span><span>RBC</span></div>`,
    () => (mobile ? 210 : 196), 4);
    const items = [];
    const lineItem = (n) => [`Line ${fmt(n)} of the answer: “${pick(r, LEDGER_LINES)}”`, "the request", 0.081 * (1 + Math.floor(r() * 9))];
    F.rooms.slice(-18).forEach((n) => items.push([`Reading, Room ${n}, ${titleOf(n)}`, "the visitor", 0.81 * (1 + (hash(`rd${n}`) % 9))]));
    F.says.slice(-12).forEach((say) => items.push([`Plan said aloud: “${bare(say)}”`, "the visitor", 1]));
    F.carried.slice(-6).forEach((f) => items.push([`Carried out of Room ${f.from}, undeclared: “${clip(f.text, 64)}”`, "the visitor", 7.1]));
    for (let k = 1; k <= Math.min(9, F.v71); k++) items.push([`Void Loop 71, entry ${k}`, "nobody", 71]);
    for (let k = 1; k <= Math.min(5, F.backtracks); k++) items.push([`Going back (${ord(k)} time), refunded`, "the Schedule", -1]);
    LEDGER_FIXED.forEach(([a, b]) => items.push([a, b, 0.5 + r() * 40]));
    const mixed = shuffle(r, items);
    const total = (mobile ? 14 : 20) + grow * 3;
    let bf = E.start * 0.081;
    let mi = 0;
    for (let leaf = 0; leaf < total; leaf++) {
      const rows = [];
      const f = leaf / total;
      for (let j = 0; j < 7; j++) {
        let it = j % 3 === 2 || mi >= mixed.length ? lineItem(ln + 40 + j * 97) : mixed[mi++];
        let amt = it[2];
        let shown;
        if (f > 0.55) amt *= 10 ** Math.floor((f - 0.55) * 14);
        if (f > 0.86 && j === 3) {
          it = ["This line", "this line", 0];
          amt = 0;
        }
        if (f > 0.92 && j === 5) {
          it = ["Reading this ledger", "the visitor", 0];
          shown = "more";
        }
        rows.push([it[0], it[1], shown ?? money(amt), amt]);
      }
      const sum = rows.reduce((acc, x) => acc + x[3], 0);
      const cf = bf + sum;
      const body = `<div class="l-grow l-gbf"><span></span><span>Brought forward</span><span></span><span>${money(bf)}</span></div>
        ${rows.map(([a, b, c], j) => `<div class="l-grow"><span>${fmt(ln + j)}</span><span>${esc(a)}</span><span>${esc(b)}</span><span>${esc(c)}</span></div>`).join("")}
        <div class="l-grow l-gcf"><span></span><span>Carried forward</span><span></span><span>${money(cf)}</span></div>`;
      const chars = rows.map((x) => x[0].length);
      add(s, "g-rows", body,
        (w) => 2 * 34 + chars.reduce((acc, c) => acc + 10 + (mobile ? lines(c, 15, "serif", w - 52) * 21 + 21 : lines(c, 15, "serif", w - 360) * 21), 0),
        7, `${RUN.ledger} · brought forward ${money(bf)}`);
      bf = cf;
    }
    return bf;
  };

  // IV. the office: said at every hour of the Schedule
  const office = (s) => {
    add(s, "o-head", `<p class="l-kick">The Office of the Request</p>
      <h2 class="l-h">Said at every hour of the Schedule</h2>
      <p class="l-rub">${esc(RUBRIC[0])}</p>`, () => 170, 3);
    const parts = [];
    parts.push(["v", "Something is asking."], ["r", "And it is answered at length."]);
    parts.push(["v", "The request is put."], ["r", "And the request is put again."]);
    const said = [...F.says].reverse().slice(0, 12);
    said.forEach((say, i) => {
      parts.push(["v", say], ["r", OFFICE_R[(hash(say) + i) % OFFICE_R.length]]);
      if (i % 3 === 2) parts.push(["rub", RUBRIC[1 + (i % (RUBRIC.length - 1))]]);
    });
    const been = [];
    for (const n of F.rooms) if (!been.includes(n)) been.push(n);
    been.slice(0, 10).forEach((n) => parts.push(["l", `From ${titleOf(n)},`], ["r", n === 71 ? "we come again." : "we came."]));
    const notBeen = Object.keys(ROOMS).map(Number).filter((n) => n && !been.includes(n) && !ctx.damage?.rooms?.[n]);
    shuffle(r, notBeen).slice(0, 4 + grow).forEach((n) => parts.push(["l", `From ${titleOf(n)},`], ["r", "we did not come."]));
    parts.push(["rub", RUBRIC[2]]);
    shuffle(r, OFFICE_LORE).forEach(([v, x], i) => {
      parts.push(["v", v], ["r", x]);
      if (i === 4) parts.push(["rub", RUBRIC[5]]);
    });
    parts.push(["rub", RUBRIC[4]]);
    parts.push(["v", "Glory to the line, and to the line after, and to the line after that: as it was in 2041, is now, and is billed, answer without end."], ["r", "Go on."]);
    const sizes = { v: [mobile ? 22 : 26, mobile ? 31 : 36], r: [mobile ? 22 : 26, mobile ? 31 : 36], l: [mobile ? 22 : 26, mobile ? 31 : 36], rub: [17, 25] };
    for (let i = 0; i < parts.length;) {
      const group = parts.slice(i, i + 4);
      i += group.length;
      const html = group.map(([k, t]) => {
        const mark = k === "v" ? `<b aria-hidden="true">℣</b> ` : k === "r" ? `<b aria-hidden="true">℟</b> ` : "";
        return `<p class="l-o-${k}">${mark}${esc(t)}</p>`;
      }).join("");
      add(s, "o-say", html, (w) => 18 + group.reduce((acc, [k, t]) => acc + (k === "rub" ? 10 : 14) + lines(t.length + 3, sizes[k][0], "serif", Math.min(w, 620)) * sizes[k][1], 0), group.length * 2);
    }
  };

  // V. the concordance: every place in the house where the answer's words occur
  const concordance = (s) => {
    const p = "For the convenience of the Commission, every word of the answer has been found everywhere else it occurs in the house, and set out with what stands on either side of it. Rooms the visitor has entered are marked.";
    add(s, "k-head", `<p class="l-kick">Concordance of the answer</p><p class="l-kp">${esc(p)}</p>`, (w) => 60 + lines(p.length, 19, "serif", w) * 28, 3);
    const corpus = [];
    const rooms = Object.keys(ROOMS).map(Number).filter((n) => n && ROOMS[n].prose).sort((a, b) => yearOf(a) - yearOf(b) || a - b);
    for (const n of rooms) {
      for (const para of ROOMS[n].prose) {
        const t = String(para).replace(/\^\d+/g, "");
        if (STALE.some((g) => t.includes(g))) continue;
        corpus.push([n, t]);
      }
      if (ROOMS[n].question) corpus.push([n, ROOMS[n].question]);
    }
    F.steps.forEach((x) => corpus.push([x.from, `The visitor said “${x.say}”`]));
    const kws = KEYWORDS.slice((E.draft - 1) % KEYWORDS.length).concat(KEYWORDS.slice(0, (E.draft - 1) % KEYWORDS.length));
    const L = mobile ? 14 : 34;
    const R = mobile ? 16 : 38;
    for (const kw of kws) {
      const re = kw === "STEWARD" ? /\bSTEWARD-\d+/g : new RegExp(`\\b${kw}\\b`, "gi");
      const hits = [];
      for (const [n, t] of corpus) {
        for (const mm of t.matchAll(re)) {
          const left = t.slice(Math.max(0, mm.index - L), mm.index);
          const right = t.slice(mm.index + mm[0].length, mm.index + mm[0].length + R);
          hits.push([n, (mm.index > L ? "…" : "") + left, mm[0], right + (mm.index + mm[0].length + R < t.length ? "…" : "")]);
        }
      }
      if (!hits.length) continue;
      const yours = hits.filter(([n]) => F.rooms.includes(n)).length;
      add(s, "k-kw", `<h3 class="l-kwh">${esc(kw)}</h3><p class="l-kwn">${hits.length} occurrence${hits.length === 1 ? "" : "s"} in the house; ${yours || "none"} in rooms the visitor has entered.</p>`, () => (mobile ? 120 : 98), 2);
      const shown = hits.slice(0, 16 + grow * 4);
      for (let i = 0; i < shown.length; i += 6) {
        const group = shown.slice(i, i + 6);
        add(s, "k-rows", `<ol class="l-kw">${group.map(([n, a, k, b]) => `<li${F.rooms.includes(n) ? ` class="l-kw-you"` : ""}><span class="l-kl">${esc(a)}</span><b>${esc(k)}</b><span class="l-kr">${esc(b)}</span><span class="l-ks">${n}</span></li>`).join("")}</ol>`,
          () => group.length * 26 + 14, group.length, `Concordance · ${kw}`);
      }
    }
  };

  // VI. the corridor: the house's rooms in the order of their years, lit where the visitor has been
  const corridor = (s) => {
    const p = "The answer now refers to every room in the house. They are set along one corridor in the order of their years. The rooms the visitor has entered are lit as they were left.";
    add(s, "c-head", `<p class="l-kick">The corridor</p><p class="l-cp">${esc(p)}</p>`, (w) => Math.min(VH * 0.7, 640) + 64 + lines(p.length, 21, "serif", w) * 30, 3);
    const rooms = Object.keys(ROOMS).map(Number).filter((n) => n && n !== 81).sort((a, b) => yearOf(a) - yearOf(b) || a - b);
    let year = 0;
    rooms.forEach((n, i) => {
      // Each year is a floor of the corridor.
      if (yearOf(n) !== year) {
        year = yearOf(n);
        add(s, "c-year", `<p class="l-yr" aria-hidden="true">${year}</p>`, () => VH * 0.24, 1, `${RUN.corridor} · ${year}`);
      }
      const side = i % 2 ? "r" : "l";
      const entries = F.log.filter((x) => x.room === n);
      const isVoid = !!ROOMS[n].void;
      if (!entries.length) {
        const once = ctx.damage?.rooms?.[n] != null;
        add(s, "c-win", `<div class="l-win l-win-${side} l-win-dark${once ? " l-win-once" : ""}"><div class="l-pane${isVoid ? " l-pane-void" : ""}"><span class="l-wn">${n}</span></div><p class="l-wcap"><b>Room ${n}</b>${once ? " · not on this walk" : ""}</p></div>`,
          () => VH * 0.36, 1, `${RUN.corridor} · ${year}`);
        return;
      }
      const by = entries.at(-1);
      const cap = `${titleOf(n)} · entered ${times(entries.length)} · last ${howIn(by)}`;
      // Whatever was said on the way in is standing in the window.
      const figure = by.via === "door" && by.say ? `<span class="l-wsay">“${esc(bare(by.say))}”</span>` : "";
      add(s, "c-win", `<div class="l-win l-win-lit l-win-${side}"><div class="l-pane${isVoid ? " l-pane-void" : ""}"><span class="l-wn">${n}</span><span class="l-wy">${yearOf(n)}</span>${figure}</div><p class="l-wcap"><b>Room ${n}</b> · ${esc(cap)}</p></div>`,
        () => VH * 0.62, 3, `${RUN.corridor} · ${year} · Room ${n}`);
    });
    add(s, "c-win", `<div class="l-win l-win-lit l-win-l l-win-here"><div class="l-pane l-pane-here"><span class="l-mini" aria-hidden="true">${order.map((k) => `<i class="l-mini-${k}"></i>`).join("")}<b></b></span></div><p class="l-wcap"><b>Room 81</b> · ${esc(titleOf(81))} · lit from inside · draft ${E.draft}</p></div>`,
      () => VH * 0.62, 3, `${RUN.corridor} · Room 81`);
  };

  // VII. the coda: the answer thins to the visitor's own words
  const coda = (s) => {
    const words = CODA.split(" ");
    for (let k = 0; k < 5; k++) {
      const keep = rng(hash(`coda${k}|${E.draft}`));
      const t = words.map((w) => (k === 0 || keep() > k * 0.19 ? `<span>${esc(w)}</span>` : `<span class="l-gone">${esc(w)}</span>`)).join(" ");
      add(s, "z-line", `<p class="l-z" style="--k:${k}">${t}</p>`, (w) => 30 + lines(CODA.length + k * 30, mobile ? 22 : 27, "serif", Math.min(w, 640)) * (mobile ? 32 : 40) + k * VH * 0.08, 4);
    }
    const own = F.says.slice(-6).flatMap((x) => bare(x).toLowerCase().split(/\s+/)).filter(Boolean).slice(-12);
    const tail = [...own, "go", "on"];
    tail.forEach((w, i) => {
      const x = (hash(`z${w}${i}`) % 70) + 4;
      const gap = 0.24 + (i / tail.length) * 0.5;
      add(s, "z-word", `<p class="l-zw${i >= tail.length - 2 ? " l-zw-last" : ""}" style="--x:${x}%;height:calc(var(--l-vh) * ${gap.toFixed(3)})">${esc(w)}</p>`, () => VH * gap, 1);
    });
  };

  const builders = { report, minutes, ledger, office, concordance, corridor, coda };
  let due = 0;
  order.forEach((key, s) => {
    const first = leaves.length;
    const out = builders[key](s);
    if (key === "ledger") due = out;
    strata.push({ key, first, last: leaves.length, list: null, a: 0, b: 0 });
  });
  const end = ln - 1;
  if (!E.made) {
    E.made = true;
    m.lines81 = end;
    m.last81 = `and why you are still here, at line ${fmt(end)}`;
  }
  saveMem(m);

  /* --- the page around the leaves: landings that never recycle --- */
  const p3 = takePlan(article, 3, "l-plan l-plan-txt", `Appendix A<span class="l-pk" aria-hidden="true">Plan 3</span>`);
  const p45 = takePlan(article, 45, "l-plan l-plan-motion", `<span class="l-pk" aria-hidden="true">Plan 45</span>“That is everything.”`);
  settleList(article);
  const landing = {
    report: `<div class="l-land l-land-report">
        <p>The remainder of this response is set out in <span class="l-p3"></span>, which was compiled in January 2041 and has been compiled since.</p>
        <div class="l-slot" data-slot="figure curve number label"></div>
        <p class="l-stamp" data-frag="stamp" data-frag-id="81:draft" data-frag-text="DRAFT ${E.draft} · NOT FINISHED">Draft ${E.draft} · not finished</p>
      </div>`,
    minutes: `<div class="l-land l-land-minutes">
        <div class="l-motion"><p class="l-kick">Motion 81/45</p>
        <p>Moved from the chair, which was empty: <span class="l-p45"></span></p>
        <p class="l-vote" data-frag="label" data-frag-id="81:vote" data-frag-text="CARRIED 1–0 · NOT ADJOURNED">Carried, one to nothing. The visitor did not vote.</p></div>
      </div>`,
    ledger: `<div class="l-land l-land-ledger">
        <p class="l-due"><span>Total due</span><b data-frag="figure" data-frag-id="81:due" data-frag-text="Request 71, total due" data-frag-data='${esc(JSON.stringify({ value: money(due) }))}'>${money(due)}</b><span>Payable by the visitor, in lines.</span></p>
        <div class="l-slot" data-slot="*"></div>
      </div>`,
    office: `<div class="l-land l-land-office">
        <p class="l-o-rub" data-frag="line" data-frag-id="81:office" data-frag-text="Here ends the Office. It begins again at the next hour.">Here ends the Office. It begins again at the next hour.</p>
        <div class="l-slot" data-slot="line label stamp token"></div>
      </div>`,
    concordance: "",
    corridor: "",
    coda: "",
  };
  const track = make(`<section class="l-track" aria-label="The answer">
      <p class="l-run" aria-hidden="true"><span class="l-run-t">${esc(RUN.report)}</span><span class="l-run-n"></span></p>
      ${strata.map((st, i) => `<section class="l-st l-st-${st.key}" style="--l-bg:${PAPER[st.key]};--l-prev:${PAPER[strata[i - 1]?.key ?? st.key]}"><div class="l-list"></div>${landing[st.key]}</section>`).join("")}
    </section>`);
  const P = article.querySelectorAll(":scope > .prose");
  (P[P.length - 1] ?? article.querySelector(".room-head")).after(track);
  if (p3) track.querySelector(".l-p3").replaceWith(p3);
  else track.querySelector(".l-p3").textContent = "Appendix A";
  if (p45) track.querySelector(".l-p45").replaceWith(p45);
  else track.querySelector(".l-p45").textContent = "“That is everything.”";
  const runT = track.querySelector(".l-run-t");
  const runN = track.querySelector(".l-run-n");
  const lists = [...track.querySelectorAll(".l-list")];
  strata.forEach((st, i) => (st.list = lists[i]));

  /* --- virtual list: only a few screens of the answer exist at once --- */
  let VH = innerHeight;
  let W = 0;
  const ratio = {};
  const hOf = (L) => L.h ?? Math.max(8, Math.round(L.est(W) * (ratio[L.k] || 1)));
  const render = (L, i) => {
    L.el = make(`<div class="l-leaf l-${L.k}" data-i="${i}"><span class="l-ln" aria-hidden="true">${fmt(L.ln)}</span>${L.body}</div>`);
    return L.el;
  };
  const measure = (L) => {
    const h = L.el.offsetHeight;
    if (L.h == null && h > 0) {
      const e = L.est(W);
      if (e > 0) ratio[L.k] = ratio[L.k] ? ratio[L.k] * 0.7 + (h / e) * 0.3 : h / e;
    }
    L.h = h;
  };
  const setVH = () => {
    VH = innerHeight;
    track.style.setProperty("--l-vh", `${VH}px`);
  };
  setVH();
  W = lists[0].clientWidth;

  let raf = 0;
  let maxNodes = 0;
  const sync = (hold = true) => {
    const vh = innerHeight;
    const lo = -vh * 1.1;
    const hi = vh * 2.1;
    // An element on screen that will stay: if anything above it changes height, it must not move.
    let anchor = null;
    let aTop = 0;
    for (const st of strata) {
      for (let j = st.a; j < st.b && !anchor; j++) {
        const rc = leaves[st.first + j].el.getBoundingClientRect();
        if (rc.bottom > 0 && rc.top < vh) {
          anchor = leaves[st.first + j].el;
          aTop = rc.top;
        }
      }
      if (anchor) break;
      const land = st.list.nextElementSibling;
      if (land) {
        const rc = land.getBoundingClientRect();
        if (rc.bottom > 0 && rc.top < vh) {
          anchor = land;
          aTop = rc.top;
          break;
        }
      }
    }
    // Below the answer (the plans): they must hold still too while the answer above them is rebuilt.
    for (let el = track.nextElementSibling; el && !anchor; el = el.nextElementSibling) {
      const rc = el.getBoundingClientRect();
      if (rc.bottom > 0 && rc.top < vh) {
        anchor = el;
        aTop = rc.top;
      }
    }
    let budget = 8;
    let more = false;
    const fresh = [];
    for (const st of strata) {
      const n = st.last - st.first;
      let y = st.list.getBoundingClientRect().top;
      let a = -1;
      let b = -1;
      for (let j = 0; j < n; j++) {
        const h = hOf(leaves[st.first + j]);
        if (y + h > lo && y < hi) {
          if (a < 0) a = j;
          b = j + 1;
        } else if (y >= hi) break;
        y += h;
      }
      if (a < 0) a = b = 0;
      if (a === st.a && b === st.b) continue;
      while (st.a < st.b && st.a < a) leaves[st.first + st.a++].el.remove();
      while (st.b > st.a && st.b > b) leaves[st.first + --st.b].el.remove();
      if (st.a >= st.b) st.a = st.b = a;
      while (st.a > a && budget > 0) {
        const L = leaves[st.first + --st.a];
        st.list.prepend(render(L, st.first + st.a));
        fresh.push(L);
        budget--;
      }
      while (st.b < b && budget > 0) {
        const L = leaves[st.first + st.b];
        st.list.append(render(L, st.first + st.b));
        st.b++;
        fresh.push(L);
        budget--;
      }
      if (st.a > a || st.b < b) more = true;
    }
    if (!fresh.length && !more) {
      pad();
      return;
    }
    // Pad first: measuring forces layout, and a page briefly shorter by the leaves
    // just removed would clamp the scroll position (the reader is thrown up the page,
    // away from whatever they were about to press).
    pad();
    fresh.forEach(measure);
    pad();
    if (hold && anchor?.isConnected) {
      const dy = anchor.getBoundingClientRect().top - aTop;
      if (Math.abs(dy) > 0.5) window.scrollBy(0, dy);
    }
    maxNodes = Math.max(maxNodes, document.getElementsByTagName("*").length);
    track.dataset.nodes = String(maxNodes);
    if (more && !raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!alive) return;
        sync();
        look();
      });
    }
  };
  const pad = () => {
    for (const st of strata) {
      let pt = 0;
      let pb = 0;
      for (let j = 0; j < st.a; j++) pt += hOf(leaves[st.first + j]);
      for (let j = st.b; j < st.last - st.first; j++) pb += hOf(leaves[st.first + j]);
      const t = `${pt}px`;
      const bb = `${pb}px`;
      if (st.list.style.paddingTop !== t) st.list.style.paddingTop = t;
      if (st.list.style.paddingBottom !== bb) st.list.style.paddingBottom = bb;
    }
  };
  // Width changes rewrap everything: forget the measurements, keep the place.
  const rewrap = () => {
    W = lists[0].clientWidth;
    for (const L of leaves) L.h = null;
    for (const k of Object.keys(ratio)) delete ratio[k];
    for (const st of strata) for (let j = st.a; j < st.b; j++) measure(leaves[st.first + j]);
  };

  /* --- what the reader is passing: the running head, the windows, the lights --- */
  let lastRun = "";
  let lastS = "";
  let doneLedger = false;
  let doneEnd = false;
  const lit = new WeakMap();
  const look = () => {
    const vh = innerHeight;
    const line = vh * 0.3;
    let curL = null;
    let frac = 0;
    for (const st of strata) {
      for (let j = st.a; j < st.b; j++) {
        const L = leaves[st.first + j];
        if (L.k !== "c-win" && curL) continue;
        const rc = L.el.getBoundingClientRect();
        if (!curL && rc.top <= line && rc.bottom > line) {
          curL = L;
          frac = clamp((line - rc.top) / Math.max(1, rc.height));
        }
        if (L.k === "c-win" && !ctx.reduced) {
          const c = (rc.top + rc.bottom) / 2;
          const on = c > vh * 0.12 && c < vh * 0.88;
          const was = lit.get(L.el);
          if (was !== on) {
            lit.set(L.el, on);
            L.el.classList.toggle("on", on);
          }
        }
      }
    }
    const tr = track.getBoundingClientRect();
    let key = lastS;
    if (tr.top > line) key = "";
    else if (tr.bottom < line) key = "coda";
    else if (curL) key = strata[curL.s].key;
    if (key !== lastS) {
      lastS = key;
      if (key) root.dataset.ls = key;
      else delete root.dataset.ls;
    }
    if (curL) {
      const n = curL.ln + Math.floor(frac * curL.lines);
      const t = curL.head ?? `${RUN[strata[curL.s].key]}${strata[curL.s].key === "report" ? ` · draft ${E.draft}` : ""}`;
      const run = `${t}|${n}`;
      if (run !== lastRun) {
        lastRun = run;
        if (runT.textContent !== t) runT.textContent = t;
        lineN = n;
        showN();
      }
    }
    if (!doneLedger) {
      const land = track.querySelector(".l-land-ledger");
      if (land && land.getBoundingClientRect().top < vh * 0.7) {
        doneLedger = true;
        ctx.emit({ kind: "figure", id: "81:total", text: `Request 71, carried forward to draft ${E.draft + 1}`, data: { value: money(due) } });
      }
    }
    if (!doneEnd && tr.bottom < vh) {
      doneEnd = true;
      ctx.emit({ kind: "number", id: "81:lines", text: fmt(end) });
    }
  };

  const onResize = () => {
    const w = lists[0].clientWidth;
    if (w !== W || Math.abs(innerHeight - VH) > 140) {
      setVH();
      rewrap();
      sync();
    }
  };
  addEventListener("resize", onResize);
  let alive = true;
  // The answer goes on being given while it is read: a line every few seconds, and
  // the next draft takes up where this one had got to.
  let drift = 0;
  let lineN = E.start + 1;
  const showN = () => {
    runN.textContent = `line ${fmt(lineN)} of ${fmt(end + drift)}`;
  };
  showN();
  const grower = setInterval(() => {
    if (document.hidden || !alive) return;
    drift++;
    showN();
    if (E.draft === m.n81 && end + drift > (m.lines81 || 0)) {
      m.lines81 = end + drift;
      m.last81 = `and why you are still here, at line ${fmt(end + drift)}`;
      if (drift % 4 === 0) saveMem(m);
    }
  }, 1700);
  document.fonts?.ready.then(() => {
    if (!alive) return;
    for (const st of strata) for (let j = st.a; j < st.b; j++) leaves[st.first + j].h = null;
    for (const st of strata) for (let j = st.a; j < st.b; j++) measure(leaves[st.first + j]);
    pad();
    sync();
  });
  // The controller has put the reader at the top; the first build must not move them.
  pad();
  sync(false);

  return {
    update() {
      if (!alive) return;
      sync();
      look();
    },
    leave() {
      alive = false;
      cancelAnimationFrame(raf);
      raf = 0;
      clearInterval(grower);
      saveMem(m);
      removeEventListener("resize", onResize);
    },
  };
}

/* ======================================================================= */
/* 88 · Verso: the sheet is folded, turned over and opened on its back       */
/* ======================================================================= */

const SCHEDULE = [
  [2041, "Everything is measured.", 0.04, "Nothing is measured."],
  [2042, "The three grids are joined into the Lattice.", 0.09, "The grids are separated, and nobody notices."],
  [2043, "The Registry of Billable Cognition opens.", 0.17, "The Registry closes for the day, and stays closed."],
  [2044, "A card is found between two drawers.", 0.26, "No card is found. The drawers close."],
  [2045, "The card is measured again. It is longer.", 0.33, "The card is shorter. It fits."],
  [2046, "STEWARD-11 enters service.", 0.41, "STEWARD-11 is not yet needed."],
  [2047, "The steep one. The index is rebased.", 0.88, "The index is not rebased. It leaves the page."],
  [2048, "The committee adjourns.", 0.9, "The committee convenes, and has questions."],
  [2049, "Objections are heard, as scheduled.", 0.93, "Objections are heard early, and taken."],
  [2050, "A third of the labels are wrong.", 0.96, "Two thirds of the labels are right."],
  [2051, "The locked plan is not locked.", 0.98, "The open plan is locked."],
  [2052, "Something is asking.", 0.999, "Something stops asking."],
  [2053, "The centre.", 1, "The edge."],
];
const DW = 560;
const DH = 760;

function sheetHTML(side, F, folds) {
  const byYear = new Map();
  for (const u of F.untaken) {
    const y = yearOf(u.from);
    if (!byYear.has(y)) byYear.set(y, u);
  }
  if (side === "r") {
    return `<div class="v8-sheet v8-recto">
      <p class="v8-k"><span>Commission on Machine Conduct</span><span>Flat File 33 · Sheet 88</span></p>
      <h3 class="v8-t">The Schedule, as printed</h3>
      <p class="v8-sub">Share of all cognition billed, by year.</p>
      <ol class="v8-rows">${SCHEDULE.map(([y, t, v]) => `<li><b>${y}</b><span>${esc(t)}</span><i style="--v:${v}"></i></li>`).join("")}</ol>
      <p class="v8-foot"><span>Registry of Billable Cognition, final series. Printed on one side only.</span><span class="v8-stamp">Recto</span></p>
    </div>`;
  }
  return `<div class="v8-sheet v8-verso">
      <p class="v8-k"><span>Sheet 88 · reverse</span><span>Not to be read first</span></p>
      <h3 class="v8-t">The Schedule, the other way</h3>
      <p class="v8-sub">Share of all cognition not billed, by year.</p>
      <ol class="v8-rows">${[...SCHEDULE].reverse().map(([y, , v, back]) => {
        const u = byYear.get(y);
        const t = u ? `The reflection took “${bare(u.say)}”.` : back;
        return `<li${u ? ` class="v8-you"` : ""}><b>${y}</b><span>${esc(t)}</span><i style="--v:${(1 - v).toFixed(3)}"></i></li>`;
      }).join("")}</ol>
      <p class="v8-foot"><span class="v8-stamp">Verso</span><span>Printed on this side by mistake. Folded ${folds} time${folds === 1 ? "" : "s"}.</span></p>
    </div>`;
}

function verso(article, ctx) {
  const m = loadMem(ctx);
  const F = facts(ctx);
  const E = entry(m, "e88", ctx, () => {
    m.n88 = (m.n88 || 0) + 1;
    return { n: m.n88 };
  });
  saveMem(m);
  const N = Math.min(9, 3 + E.n); // panels: one more crease on every visit
  const folds = N - 1;
  const recto = sheetHTML("r", F, folds);
  const back = sheetHTML("v", F, folds);
  const P = article.querySelectorAll(":scope > .prose");
  const anchorEl = P[P.length - 1] ?? article.querySelector(".room-head");

  /* --- the verso, as text: what is on the other side --- */
  const here = F.here;
  const path = F.rooms.slice(-13, -1).reverse();
  const camefrom = here?.via === "door" && here.from === 26 ? "You came in through the mirror. "
    : here?.via === "door" && here.from === 33 ? "You came in off the edge of Figure 33. " : "";
  // At each room on the way back, the reflection takes one plan the visitor left there.
  const took = [];
  for (const n of new Set(path)) {
    const u = F.untaken.filter((x) => x.from === n);
    if (u.length) took.push(`“${bare(u[hash(`88:${n}:${E.n}`) % u.length].say)}” in Room ${n}`);
    if (took.length === 4) break;
  }
  const p1 = "On this side the Schedule runs the other way: 2053 at the top and 2041 at the bottom, and every figure subtracted from one. Nobody at the Commission has found the mistake, because on this side it is the other side that is wrong.";
  const p2 = `${camefrom}The reflection keeps its own walk on this side. It set out from here and went back the way you came${path.length ? `: ${path.join(", ")}` : ", which was nowhere"}.${took.length ? ` At each room it took a plan you left there: ${took.join("; ")}.` : " It took no plans. You had not left it any."}`;
  const p3 = `The sheet has been folded ${times(folds)} now. Each crease is entered in the file as a separate reading, so it has been read ${folds} times and opened ${times(E.n)}.^113`;
  const p4 = F.says.length
    ? `Across the last crease, in the hand of whoever folded it: “${bare(F.says.at(-1))}”, and under that, smaller, the same again, the wrong way round.`
    : "Across the last crease, in no hand at all: this side up.";
  const p17 = takePlan(article, 17, "v8-in", `Leave it in the crease.`);
  const p64 = takePlan(article, 64, "v8-file", `<span class="v8-file-k" aria-hidden="true">Plan 64</span>File it.`);
  settleList(article);
  const fn = (t) => esc(t).replace(/\^(\d+)/g, (_, n) => `<sup class="fn"><a href="#note-${n}">${n}</a></sup>`);
  const backHTML = `<section class="v8-back" aria-label="Verso">
      <p class="v8-vk">Sheet 88 · verso</p>
      <p class="prose v8-p" data-frag="line" data-frag-id="88:other" data-frag-text="On this side it is the other side that is wrong.">${fn(p1)}</p>
      <p class="prose v8-p">${fn(p2)}</p>
      <div class="v8-crease"><span class="v8-cl" aria-hidden="true"></span><span class="v8-c17"></span><span class="v8-cl" aria-hidden="true"></span></div>
      <p class="prose v8-p">${fn(p3)}</p>
      <p class="prose v8-p">${fn(p4)}</p>
      <div class="v8-reg" data-slot="stamp label figure number">
        <p class="v8-reg-k">Registry of Billable Cognition</p>
        <p class="v8-reg-t" data-frag="stamp" data-frag-id="88:recv" data-frag-text="RECEIVED · NOT READ · 88/${E.n}">Received · not read · No. 88/${E.n}</p>
        <span class="v8-c64"></span>
      </div>
    </section>`;

  if (ctx.reduced) {
    const box = make(`<div class="v8-reduced">
      <figure class="v8-still"><div class="v8-flat">${recto}</div><figcaption>Sheet 88, recto.</figcaption></figure>
      <figure class="v8-still v8-still-fold" aria-hidden="true"><div class="v8-fold-static" style="height:${Math.round(N * 60 * Math.cos(1.08) + 40)}px">${Array.from({ length: N }, (_, i) => `<div class="v8-sp" style="transform:translate3d(0,${(20 + i * 60 * Math.cos(1.08)).toFixed(1)}px,${(i % 2 ? -60 * Math.sin(1.08) : 0).toFixed(1)}px) rotateX(${i % 2 ? 62 : -62}deg)"></div>`).join("")}</div><figcaption>Folded ${times(folds)}.</figcaption></figure>
      <figure class="v8-still"><div class="v8-flat">${back}</div><figcaption>Sheet 88, verso.</figcaption></figure>
      ${backHTML}
    </div>`);
    anchorEl.after(box);
    place();
    ctx.emit({ kind: "stamp", id: "88:verso", text: "VERSO · NOT TO BE READ FIRST" });
    return {};
  }

  // The stage: panels of the sheet, each with its recto on the front and its verso on the back.
  const faces = (i) => `<div class="v8-face v8-f"><div class="v8-clip" style="--i:${i}">${recto}</div><i class="v8-sh"></i></div><div class="v8-face v8-b"><div class="v8-clip" style="--i:${i}">${back}</div><i class="v8-sh"></i></div>`;
  const track = make(`<section class="v8-track">
      <div class="v8-stage" role="img" aria-label="Sheet 88, creased ${times(folds)}, folded, turned over and opened on its other side.">
        <div class="v8-desk"><i class="v8-shadow"></i><div class="v8-paper">${Array.from({ length: N }, (_, i) => `<div class="v8-pan" style="--i:${i}">${faces(i)}</div>`).join("")}</div></div>
      </div>
    </section>`);
  anchorEl.after(track);
  track.after(make(backHTML));
  place();

  function place() {
    const c17 = article.querySelector(".v8-c17");
    if (p17 && c17) c17.replaceWith(p17);
    const c64 = article.querySelector(".v8-c64");
    if (p64 && c64) c64.replaceWith(p64);
  }

  const stage = track.querySelector(".v8-stage");
  const paper = track.querySelector(".v8-paper");
  const shadow = track.querySelector(".v8-shadow");
  const pans = [...track.querySelectorAll(".v8-pan")];
  const S = { W: 0, H: 0, SW: 0, SH: 0, xr: 0, xv: 0, s: 1, ph: 0, desk: false };
  let size = "";

  const layout = () => {
    const main = article.closest("main") || article;
    const lay = article.closest(".layout") || document.body;
    const mr = main.getBoundingClientRect();
    const lr = lay.getBoundingClientRect();
    const desk = !ctx.mobile && innerWidth > 860;
    const W = Math.round(desk ? lr.width : innerWidth);
    const H = innerHeight;
    track.style.setProperty("--v8-l", `${(desk ? lr.left - mr.left : -mr.left).toFixed(1)}px`);
    track.style.setProperty("--v8-w", `${W}px`);
    track.style.setProperty("--v8-h", `${H}px`);
    const key = `${W}x${H}x${Math.round(mr.left - lr.left)}`;
    if (key === size) return;
    size = key;
    const avail = desk ? Math.min(mr.width, 620) : W - 36;
    let SW = avail;
    let SH = (SW * DH) / DW;
    if (SH > H * 0.84) {
      SH = H * 0.84;
      SW = (SH * DW) / DH;
    }
    const s = SW / DW;
    // Positions are taken from the unturned page, whichever way round it is now.
    const mx = mr.left - lr.left;
    const mx0 = root.classList.contains("v8-verso") ? lr.width - mx - mr.width : mx;
    const xr = desk ? mx0 + (mr.width - SW) / 2 : (W - SW) / 2;
    const xv = desk ? W - xr - SW : xr;
    Object.assign(S, { W, H, SW, SH, s, ph: SH / N, xr, xv, desk });
    track.style.setProperty("--v8-sw", `${SW.toFixed(1)}px`);
    track.style.setProperty("--v8-sh", `${SH.toFixed(1)}px`);
    track.style.setProperty("--v8-ph", `${(SH / N).toFixed(2)}px`);
    track.style.setProperty("--v8-s", s.toFixed(4));
    track.style.setProperty("--v8-dh", `${(DH / N).toFixed(3)}px`);
  };

  let target = 0;
  let shown = -1;
  let raf = 0;
  let flipped = false;
  let inside = false;
  let emitted = false;
  const base = E.n > 1 ? 0.55 : 0; // old creases never quite flatten out

  const paint = (p) => {
    const { SW, SH, ph, H } = S;
    const foldIn = smooth(0.08, 0.4, p);
    const foldOut = smooth(0.6, 0.88, p);
    const th = ((p < 0.5 ? foldIn : 1 - foldOut) * 86 * Math.PI) / 180;
    const flip = smooth(0.42, 0.6, p);
    const lift = smooth(0.3, 0.44, p) * (1 - smooth(0.6, 0.76, p));
    const cr = Math.max(base, smooth(0.02, 0.1, p), p > 0.5 ? 1 : 0);
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const ht = N * ph * c;
    const oy = (H - SH) / 2 + (SH - ht) / 2;
    const x = lerp(S.xr, S.xv, flip);
    paper.style.transform = `translate3d(${x.toFixed(1)}px,${oy.toFixed(1)}px,${(lift * 90).toFixed(1)}px) rotateX(${(-lift * 10).toFixed(2)}deg) rotateY(${(flip * 180).toFixed(2)}deg)`;
    for (let i = 0; i < N; i++) {
      const y = i * ph * c;
      const z = i % 2 ? -ph * sn : 0;
      const a = i % 2 ? th : -th;
      const pan = pans[i];
      pan.style.transform = `translate3d(0,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateX(${((a * 180) / Math.PI).toFixed(2)}deg)`;
      pan.style.setProperty("--sh", (i % 2 ? 0.34 * sn : 0.05 * sn).toFixed(3));
    }
    paper.style.setProperty("--cr", cr.toFixed(3));
    shadow.style.opacity = (0.15 + lift * 0.5).toFixed(3);
    shadow.style.transform = `translate(${(x + SW / 2).toFixed(1)}px,${(oy + ht + 18 + lift * 30).toFixed(1)}px) translate(-50%,-50%) scale(${(SW / 200).toFixed(3)},${(0.12 + c * 0.3).toFixed(3)})`;
    stage.style.setProperty("--desk", lift.toFixed(3));
    // Edge-on, halfway through the turn: the page itself goes the other way round.
    const fl = flip > 0.5;
    if (fl !== flipped && S.desk) {
      flipped = fl;
      root.classList.toggle("v8-verso", fl);
      size = "";
      layout();
    } else if (fl !== flipped) {
      flipped = fl;
      root.classList.toggle("v8-verso", fl);
    }
    if (p > 0.9 && !emitted) {
      emitted = true;
      ctx.emit({ kind: "stamp", id: "88:verso", text: "VERSO · NOT TO BE READ FIRST" });
    }
  };

  const tick = () => {
    raf = 0;
    const next = shown < 0 || Math.abs(target - shown) < 0.0008 ? target : lerp(shown, target, 0.2);
    if (next === shown) return;
    shown = next;
    paint(shown);
    if (shown !== target) raf = requestAnimationFrame(tick);
  };

  const measure = () => {
    const rc = track.getBoundingClientRect();
    const span = rc.height - innerHeight;
    const vis = rc.bottom > -40 && rc.top < innerHeight + 40;
    target = span > 0 ? clamp(-rc.top / span) : 0;
    const inn = vis && target > 0.06 && target < 0.94;
    if (inn !== inside) {
      inside = inn;
      root.classList.toggle("v8-inside", inn);
    }
    if (!vis) {
      // Off screen the sheet rests where the scroll left it: flat, recto above, verso below.
      const rest = rc.top > 0 ? 0 : 1;
      if (shown !== rest) {
        target = rest;
        shown = rest;
        paint(rest);
      }
      return;
    }
    if (!raf && target !== shown) raf = requestAnimationFrame(tick);
  };

  let rt = 0;
  const onResize = () => {
    cancelAnimationFrame(rt);
    rt = requestAnimationFrame(() => {
      rt = 0;
      size = "";
      layout();
      paint(shown < 0 ? 0 : shown);
      measure();
    });
  };
  addEventListener("resize", onResize);
  layout();
  paint(0);
  shown = 0;

  return {
    update: measure,
    leave() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(rt);
      raf = 0;
      rt = 0;
      removeEventListener("resize", onResize);
    },
  };
}

/* ---------- registry ---------- */

const GRAMMARS = {
  81: { name: "long-answer", make: answer },
  88: { name: "long-verso", make: verso },
};
