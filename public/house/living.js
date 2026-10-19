// Living plans, across every room (hooks called by house.js after the room module
// has decorated and the chaos engine has placed its fragments; docs/CONTRACT.md).
//
// AI 2040 draws its plans as a list at the bottom of the page. In a fresh house
// the list is left exactly as drawn. As the house is damaged (voids, a torn map,
// carried debris, descent, loops) plans also live in the page:
// a word in a sentence, a "Room N" the text happens to mention, a figure that
// equals the plan, a sentence that finishes itself, a footnote marker, a note,
// a sidenote, a report's signature, a data point on a chart, a carried
// fragment. The list itself is never emptied or disabled: every listed plan
// keeps its card, every visit, so a reader can always wander on and come back.
// Hidden plans (ctx.hidden) are always somewhere in the page.
//
// Every surface is a real <a class="plan-in" data-to data-say aria-label="Plan N">
// inside <main>, so the controller treats it as the plan it is. Nothing points
// at them: discovery is by reading, hovering and focus only.
//
// Placement is seeded by the house's state (room, escapes, voids, map damage),
// so the same house puts the same plan in the same place (remembered in
// localStorage `ai2053.house.living`, stamped with ctx.escapes).
//
// The same layer makes the voice's contamination answer touch: tap a redaction,
// a swapped word, a borrowed sentence or a carried fragment and it opens
// (hover and focus open them too, in chaos.css).
import { hash, rng, familyOf, scrubText } from "./voice.js";

const KEY = "ai2053.house.living";
const clamp = (x) => Math.min(1, Math.max(0, x));

/* ---------- memory ---------- */

let mem = null;
function memFor(escapes) {
  if (!mem) {
    try { mem = JSON.parse(localStorage.getItem(KEY)); } catch { mem = null; }
  }
  if (!mem || mem.escapes !== escapes) mem = { escapes, where: {} };
  mem.where ||= {};
  // Older houses remembered plans that had "left" their list for good. Plans no
  // longer leave: forget that.
  delete mem.moved;
  return mem;
}
function saveMem() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* the house forgets where it put things */ }
}

/* ---------- where plans may and may not live ---------- */

// Never inside these (controls, clones, screen-reader copies, moving parts, other plans).
const BAD = [
  "a", "button", "summary", "sup", "svg", "canvas", "h1", "h2", "h3", "label", "input", "select", "textarea",
  ".plan-in", ".door-li", ".m-doors", ".m-refl", ".m-floor", "[aria-hidden='true']", "[inert]",
  ".l-sr", ".c-sr", ".scope-sr", ".v-tail", ".a-past", ".ix-loc", ".hp-marq", ".numerology", ".chip",
  ".num", ".rx", ".wx", ".wd", ".sw", ".sf", ".gx", ".rg", ".echo", ".cf", "[data-plan-slot]", "[data-plans]",
].join(",");
const TEXT = "p, li, td, dd, figcaption";

// Rooms whose own encounter must stay as it is get a narrow allowance; rooms
// whose text can be evicted keep plans out of it.
const ALLOW = { 71: ".q p", 33: ":scope > .prose", 53: ".whispers .w" };
const AVOID = { 11: ":scope > .prose, .qs", 52: ".ix-graph" };

const STOP = new Set("this that with from have what them they your again into than then there their about would could should which were been being does just only also very more most much here look take make keep ask".split(" "));

// What a report is signed with, by grammar.
const SIGN = {
  report: ["Approved for circulation:", "STEWARD-"],
  mirror: ["Reflected by", "STEWARD-"],
  homepage: ["Webmaster:", "STEWARD-"],
  tokens: ["Completion by", "STEWARD-"],
  schematic: ["Drawn by", "STEWARD-"],
  number: ["Counted by", "STEWARD-"],
  void: ["Signed again by", "STEWARD-"],
  blank: ["", "STEWARD-"],
  unfiled: ["Misfiled by clerk", ""],
  index: ["Compiled by", "STEWARD-"],
  after: ["Recorded by", "STEWARD-"],
  centre: ["said by", "STEWARD-"],
  graph: ["Plotted by", "STEWARD-"],
  wheel: ["Turned by", "STEWARD-"],
  registry: ["Filed by clerk", ""],
};
const NOTE_TAIL = [
  "Minutes of an uncirculated session.",
  "Registry of Billable Cognition, unnumbered line.",
  "Commission on Machine Conduct, draft, not adopted.",
  "Source: the Schedule, as amended.",
  "Consortium circular, recalled the same day.",
  "Lattice working paper; the Lattice disputes it.",
];

// Kinds of place, in the order each grammar reaches for them.
const PREFER = {
  report: ["slot", "fn", "word", "sentence", "figure", "margin", "room", "num", "sig", "cf", "note"],
  mirror: ["room", "word", "cf", "sentence", "margin", "fn", "sig"],
  homepage: ["slot", "word", "num", "room", "cf", "sentence", "sig"],
  tokens: ["slot", "cf", "word", "note", "margin", "sig"],
  schematic: ["slot", "num", "word", "room", "cf", "fn", "sig"],
  number: ["num", "room", "cf", "word", "margin", "sentence", "sig"],
  void: ["slot", "word", "sentence", "cf", "fn", "sig"],
  blank: ["margin", "cf", "word", "sentence", "sig"],
  unfiled: ["slot", "word", "room", "cf", "num", "sig"],
  index: ["slot", "room", "word", "num", "cf", "sig"],
  after: ["slot", "word", "sentence", "cf", "sig"],
  centre: ["num", "word", "cf"],
  graph: ["word", "sentence"],
  wheel: ["slot", "word", "sentence", "fn", "sig", "cf"],
  registry: ["slot", "word", "fn", "cf", "margin", "num", "sig"],
};
// A fresh house shows its hidden plans only as citations would appear.
const QUIET = ["slot", "fn", "room", "word", "num", "note", "sig"];

/* ---------- the layer ---------- */

let live = null;

export function decorate(article, ctx) {
  leave();
  // The old anomaly tokens are retired wherever they still turn up.
  scrubText(article);
  const st = { article, placed: [], stage: ctx.stage, off: null };
  live = st;
  arm(st);
  if (article.dataset.plans === "gen" || article.dataset.plans === "self") return;
  settle(st, article, ctx);
  // Owner: a place can be hidden by its own room's styles from the start (an
  // empty frame drawn as nothing). Once laid out, any plan that landed somewhere
  // with no box goes back where it was drawn.
  st.raf = requestAnimationFrame(() => {
    st.raf = 0;
    if (live !== st) return;
    for (const p of st.placed) {
      if (p.a.isConnected && (p.a.getClientRects().length || p.a.closest("details:not([open])"))) continue;
      rescue(st, p);
    }
  });
}

export function update(ctx) {
  if (!live || ctx.stage === live.stage) return;
  live.stage = ctx.stage;
  // Some grammars hide parts of the page as the stage rises; a plan that went
  // with them comes back to its place in the list.
  for (const p of live.placed) {
    // (a plan in a closed box is still there: open the box)
    if (p.a.isConnected && (p.a.getClientRects().length || p.a.closest("details:not([open])"))) continue;
    rescue(live, p);
  }
}

export function leave() {
  if (!live) return;
  if (live.raf) cancelAnimationFrame(live.raf);
  live.off?.();
  live = null;
}

/* ---------- touch: the contamination opens ---------- */

const OPENS = ".rx, .sw, .wd, .wx, .sf, .gx, .cf, .evicted";
function arm(st) {
  const { article } = st;
  // A few redactions take focus, so a keyboard can lean on them too.
  [...article.querySelectorAll(".rx")].filter((el) => !el.closest("a, button, [aria-hidden='true']")).slice(0, 4).forEach((el) => el.setAttribute("tabindex", "0"));
  const onClick = (e) => {
    if (e.target.closest("a[href], button, summary")) return;
    const el = e.target.closest(OPENS);
    if (el && article.contains(el)) el.classList.toggle("is-open");
  };
  article.addEventListener("click", onClick);
  st.off = () => article.removeEventListener("click", onClick);
}

/* ---------- placement ---------- */

function heatOf(ctx, article) {
  if (ctx.fresh) return 0;
  const dm = ctx.damage ?? {};
  const carried = Math.min(3, article.querySelectorAll(".cf").length);
  return (dm.voids || 0) * 1.2 + (dm.map || 0) * 4 + carried * 0.5 + ctx.stage * 0.6 + Math.min(1.5, (ctx.walk?.loops || 0) * 0.3) + Math.min(1, (ctx.walk?.backtracks || 0) * 0.2);
}

function settle(st, article, ctx) {
  const room = ctx.room;
  const fam = familyOf(room);
  const m = memFor(ctx.escapes ?? 0);
  const r = rng(hash(`living|${room}|${ctx.escapes ?? 0}|${ctx.damage?.voids ?? 0}|${Math.floor((ctx.damage?.map ?? 0) * 5)}`));
  const list = article.querySelector("#doors > ol.doors, .choose > ol.doors");
  const env = { st, article, ctx, r, fam, room, mem: m, key: null, used: new Set(), sig: null, scope: scopeFor(article, room) };

  // Hidden plans: always somewhere in the page (unless the room already shows them).
  for (const plan of ctx.hidden ?? []) {
    if (article.querySelector(`a[data-to="${plan.to}"]`)) continue;
    const a = put(env, plan, ctx.fresh ? QUIET : PREFER[fam] ?? PREFER.report);
    if (a) st.placed.push({ a, plan, door: null });
  }

  // Listed plans: left as drawn in a fresh house, and in the rooms whose
  // encounter is the page itself. Otherwise some of them also turn up in the
  // page; their cards stay where they are, live.
  if (ctx.fresh || !list || ALLOW[room]) return;
  const doors = (ctx.R?.doors ?? []).filter((plan) => list.querySelector(`a.door[data-to="${plan.to}"]`));
  if (!doors.length) return;
  const f = clamp((heatOf(ctx, article) - 2.5) / 9);
  const k = Math.round(f * doors.length);
  if (!k) return;
  const order = doors.map((plan) => ({ plan, w: r() })).sort((a, b) => a.w - b.w).slice(0, k);
  for (const { plan } of order) {
    // Already living in the page (a room module put it there): once is enough.
    if ([...article.querySelectorAll(`a[data-to="${plan.to}"]`)].some((a) => !list.contains(a))) continue;
    const a = put(env, plan, PREFER[fam] ?? PREFER.report);
    if (a) st.placed.push({ a, plan, listed: true });
  }
  saveMem();
}

function scopeFor(article, room) {
  const allow = ALLOW[room] ? new Set(article.querySelectorAll(ALLOW[room])) : null;
  const avoid = AVOID[room] ? [...article.querySelectorAll(AVOID[room])] : [];
  return (el) => (!allow || [...allow].some((x) => x.contains(el))) && !avoid.some((x) => x.contains(el));
}

/**
 * Hide one plan. A plan stays where the house last hid it (the same kind of
 * place, the same words when they are still there) until another void moves it.
 */
function put(env, plan, prefer) {
  const voids = env.ctx.damage?.voids ?? 0;
  const where = (env.mem.where[env.room] ||= {});
  const rec = where[plan.to];
  const same = !!rec && rec.v === voids;
  env.r = rng(hash(`living|${env.room}|${plan.to}|${env.ctx.escapes ?? 0}|${voids}`));
  env.key = same ? rec.key : null;
  let got = place(env, plan, prefer, same ? rec.kind : null);
  env.key = null;
  if (!got) got = { a: sign(env, plan), kind: "sig" };
  where[plan.to] = { kind: got.kind, key: keyOf(got.a), v: voids };
  saveMem();
  return got.a;
}
const keyOf = (el) => el.textContent.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 40);

/** Try each kind of place in order (unused kinds first); returns { a, kind } or null. */
function place(env, plan, prefer, first) {
  const fresh = prefer.filter((k) => !env.used.has(k));
  const tried = [...fresh, ...prefer.filter((k) => env.used.has(k))];
  // A little of the house's own disorder in the order it tries things.
  for (let i = 0; i < tried.length - 1; i++) {
    if (env.r() < 0.35) [tried[i], tried[i + 1]] = [tried[i + 1], tried[i]];
  }
  if (first && KINDS[first]) tried.unshift(first);
  for (const kind of new Set(tried)) {
    const fn = KINDS[kind];
    // One signature per page unless nothing else will hold the plan.
    if (!fn || (kind === "sig" && env.used.has("sig") && kind !== first)) continue;
    const a = fn(env, plan);
    if (a) {
      env.used.add(kind);
      return { a, kind };
    }
  }
  return null;
}

function anchor(plan, cls) {
  const a = document.createElement("a");
  a.className = `plan-in li-${cls}`;
  a.href = `#room-${plan.to}`;
  a.dataset.to = String(plan.to);
  a.dataset.say = plan.say;
  a.setAttribute("aria-label", `Plan ${plan.to}`);
  return a;
}

// A place a reader can actually see now: not folded away, hidden or inert.
const visible = (el) => el.getClientRects().length > 0 && !el.closest("details:not([open]) > :not(summary), [hidden], [inert], [aria-hidden='true']");
const pick = (r, list) => list[Math.floor(r() * list.length)];
const bare = (s) => String(s).replace(/[.!?…]+$/, "");
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

function containers(env, sel = TEXT) {
  return [...env.article.querySelectorAll(sel)].filter((el) => !el.closest(BAD) && env.scope(el) && visible(el) && !notesHiddenSoon(env, el));
}

// Stage 4 hides the notes; keep plans out of them when the page is close to it.
function notesHiddenSoon(env, el) {
  return env.ctx.d + 0.14 >= 0.78 && !!el.closest(".notes");
}

function textNodes(env, root) {
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const bad = n.parentElement.closest(BAD);
      return n.nodeValue.trim() && (!bad || !root.contains(bad) || bad === root) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n);
  return out;
}

function wrap(node, start, end, a) {
  const mid = node.splitText(start);
  mid.splitText(end - start);
  mid.replaceWith(a);
  a.append(mid);
  return a;
}

/** Find a regex match in the page's text and wrap it as the plan. */
function wrapMatch(env, plan, re, cls, sel) {
  const hits = [];
  for (const el of containers(env, sel)) {
    for (const node of textNodes(env, el)) {
      re.lastIndex = 0;
      let mt;
      while ((mt = re.exec(node.nodeValue))) {
        const off = mt.index + (mt[1] ? mt[0].indexOf(mt[1]) : 0);
        hits.push({ node, start: off, end: off + (mt[1] ?? mt[0]).length });
        if (hits.length > 40) break;
      }
    }
  }
  if (!hits.length) return null;
  // Where it was last time, if those words are still there.
  const again = env.key ? hits.filter((x) => x.node.nodeValue.slice(x.start, x.end).toLowerCase() === env.key) : [];
  const h = pick(env.r, again.length ? again : hits);
  return wrap(h.node, h.start, h.end, anchor(plan, cls));
}

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const KINDS = {
  // A place the room module offered.
  slot(env, plan) {
    const want = env.ctx.hidden?.some((h) => h.to === plan.to) ? "hidden" : "listed";
    const slots = [...env.article.querySelectorAll("[data-plan-slot]")].filter((el) => {
      const v = el.dataset.planSlot || "any";
      return !el.querySelector(".plan-in") && (v === "any" || v === want) && !el.closest("a, [aria-hidden='true']");
    });
    if (!slots.length) return null;
    const el = pick(env.r, slots);
    const a = anchor(plan, "slot");
    if (el.childNodes.length) a.append(...el.childNodes);
    else a.textContent = plan.say;
    el.append(a);
    return a;
  },

  // "Room 7", wherever the text happens to say it.
  room(env, plan) {
    return wrapMatch(env, plan, new RegExp(`\\b(?:Room|room|ROOM|Plan|plan)\\s${plan.to}(?![\\d.,]\\d)\\b`, "g"), "room");
  },

  // A figure in the text that equals the plan.
  num(env, plan) {
    return wrapMatch(env, plan, new RegExp(`(?<![\\dA-Za-z.,\\-/:−])${plan.to}(?![\\dA-Za-z]|[.,:/]\\d)`, "g"), "num", `${TEXT}, .w .wt`);
  },

  // One of the plan's own words, already in the page.
  word(env, plan) {
    const words = (plan.say.toLowerCase().match(/[a-z’']{4,}/g) ?? []).filter((w) => !STOP.has(w));
    words.sort((a, b) => b.length - a.length);
    for (const w of words.slice(0, 3)) {
      const a = wrapMatch(env, plan, new RegExp(`\\b${reEsc(w)}\\b`, "gi"), "word");
      if (a) return a;
    }
    return null;
  },

  // A sentence that finishes itself with the plan.
  sentence(env, plan) {
    const ps = containers(env, ".prose, .dp-month p, .w, .q p").filter((p) => p.textContent.length > 30);
    const ends = [];
    for (const p of ps) for (const node of textNodes(env, p)) {
      const re = /[a-z”’)]([.!?])(?=\s|$)/g;
      let mt;
      while ((mt = re.exec(node.nodeValue))) ends.push({ node, at: mt.index + 1 });
    }
    if (!ends.length) return null;
    const e = pick(env.r, ends);
    const rest = e.node.splitText(e.at);
    const a = anchor(plan, "sf");
    a.textContent = lowerFirst(bare(plan.say));
    rest.before(document.createTextNode(", "), a);
    return a;
  },

  // A footnote marker whose number is the plan.
  fn(env, plan) {
    const ps = containers(env, ".prose, .dp-month p, .xbox-b p");
    const ends = [];
    for (const p of ps) for (const node of textNodes(env, p)) {
      const re = /[a-z”’)][.!?,;](?=\s)/g;
      let mt;
      while ((mt = re.exec(node.nodeValue))) ends.push({ node, at: mt.index + 2 });
    }
    if (!ends.length) return null;
    const e = pick(env.r, ends);
    const rest = e.node.splitText(e.at);
    const sup = document.createElement("sup");
    sup.className = "fn li-fn";
    const a = anchor(plan, "fn");
    a.textContent = String(plan.to);
    sup.append(a);
    rest.before(sup);
    return a;
  },

  // A note in the notes, numbered as the plan.
  note(env, plan) {
    const ol = env.article.querySelector(".notes ol");
    if (!ol || !visible(ol) || ol.closest(BAD) || !env.scope(ol) || notesHiddenSoon(env, ol)) return null;
    const li = document.createElement("li");
    li.value = plan.to;
    li.className = "li-note";
    const a = anchor(plan, "note");
    a.textContent = `“${plan.say}”`;
    li.append(a, ` ${pick(env.r, NOTE_TAIL)}`);
    ol.append(li);
    return a;
  },

  // A sidenote beside a paragraph.
  margin(env, plan) {
    const ps = containers(env, ":scope > .prose, .report > .prose").filter((p) => !p.previousElementSibling?.matches(".li-margin, .cf-margin"));
    if (ps.length < 2) return null;
    const p = ps[1 + Math.floor(env.r() * (ps.length - 1))];
    const aside = document.createElement("aside");
    aside.className = `li-margin${env.r() < 0.5 ? " li-left" : ""}`;
    const a = anchor(plan, "margin");
    a.innerHTML = `<span class="li-mn">${plan.to}</span> `;
    a.append(plan.say);
    aside.append(a);
    p.before(aside);
    return a;
  },

  // A data point on one of the page's own charts.
  figure(env, plan) {
    const lines = [...env.article.querySelectorAll("figure:not(.plate) svg :is(polyline, path.g-ln, path.fig-ln)")].filter((pl) => {
      const svg = pl.ownerSVGElement;
      return svg && !svg.parentElement.closest("a, [aria-hidden='true'], .v-tail, .cf, .dp-wheel, .dp-track, .ix, .g-crooked") && env.scope(svg) && visible(svg);
    });
    if (!lines.length) return null;
    const pl = pick(env.r, lines);
    const svg = pl.ownerSVGElement;
    const host = svg.parentElement;
    const ctm = pl.getScreenCTM();
    const len = pl.getTotalLength?.() ?? 0;
    if (!ctm || !host || !len) return null;
    const p = pl.getPointAtLength(len * (0.3 + env.r() * 0.65)).matrixTransform(ctm);
    host.classList.add("li-host");
    const hr = host.getBoundingClientRect();
    if (!hr.width || !hr.height) return null;
    const a = anchor(plan, "pt");
    a.style.setProperty("--x", `${(((p.x - hr.left) / hr.width) * 100).toFixed(2)}%`);
    a.style.setProperty("--y", `${(((p.y - hr.top) / hr.height) * 100).toFixed(2)}%`);
    a.innerHTML = `<span class="li-dot"></span><span class="li-pl">${plan.to}</span>`;
    host.append(a);
    return a;
  },

  // A carried fragment turns out to be a plan.
  cf(env, plan) {
    const cfs = [...env.article.querySelectorAll(".cf")].filter((c) => !c.parentElement.closest("a, [aria-hidden='true'], .v-tail, .ix-loc") && env.scope(c) && visible(c) && !(env.fam === "report" && c.closest("[data-slot]")));
    if (!cfs.length) return null;
    const again = env.key ? cfs.filter((x) => keyOf(x) === env.key) : [];
    const c = pick(env.r, again.length ? again : cfs);
    const a = anchor(plan, "cf");
    c.replaceWith(a);
    a.append(c);
    return a;
  },

  sig(env, plan) {
    return sign(env, plan);
  },
};

/** The report's signature: always possible, so it is also the last resort. */
function sign(env, plan) {
  const [lead, prefix] = SIGN[env.fam] ?? SIGN.report;
  let p = env.sig;
  if (!p || !p.isConnected) {
    p = document.createElement("p");
    p.className = "li-sig";
    if (lead) p.append(`${lead} `);
    const before = env.article.querySelector(":scope > #doors, :scope > .choose") ?? env.article.querySelector("#doors");
    if (before?.parentElement) before.before(p);
    else env.article.append(p);
    env.sig = p;
  } else {
    p.append(" · ");
  }
  const a = anchor(plan, "sig");
  a.textContent = prefix ? `${prefix}${plan.to}` : String(plan.to);
  p.append(a);
  env.used.add("sig");
  return a;
}

/** A plan whose place in the page has vanished: its card is still in the list; a hidden plan goes to the signature. */
function rescue(st, p) {
  if (p.listed) {
    p.a.remove();
    return;
  }
  const env = { st, article: st.article, ctx: { hidden: [] }, r: rng(p.plan.to), fam: familyOf(Number(st.article.dataset.room)), used: new Set(), sig: st.article.querySelector(".li-sig") };
  const a = sign(env, p.plan);
  p.a.remove();
  p.a = a;
}
