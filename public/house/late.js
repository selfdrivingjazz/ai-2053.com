// Late rooms (2047–2053), the voids and the outside. Each room has its own
// grammar, and each grammar has one encounter driven by the reader's real walk.
//   26 mirror     · the reflection turns to face you; it took the plan you did not
//   31 homepage   · 1997 homepage of the Commission; its guestbook holds your walk
//   11 tokens     · the room as a model sees it; what you have read is evicted from context
//   38 schematic  · engineering drawing; the oscilloscope reads your walk aloud
//   44 number     · one enormous number, then a black page holding the room you came from
//   71 void       · the loop remembers every entry, and the page itself loops
//   45 blank      · nearly empty paper; the plans you did not take gather below you
//   17 unfiled    · a misfiled card that is larger inside; the shaft below it is measured
//   52 index      · the index of everything you carried and lost; you scroll into its graph
//   2054 after    · the year after the house; you arrive at the end and it goes back forever
//   53 centre     · the page goes dark; whispers made of your walk; a line typed by scrolling
//   0 outside     · daylight, and the date
// Hooks (house.js): decorate(article, ctx) · update(ctx) · leave() · renderCentre(ctx) · renderOutside(ctx).
import { ROOMS } from "./rooms.js";
import { whispers, hash, rng, redactHTML, stainHTML, scrubText } from "./voice.js";

const root = document.documentElement;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const clamp = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const frag = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content;
};
const after = (node, html) => {
  const f = frag(html);
  const first = f.firstElementChild;
  node.after(f);
  return first;
};
const bare = (say) => say.replace(/[.!?]+$/, "");

/* ---------- memory: what the late rooms remember ----------
   localStorage, like the house itself: it survives Back, reloads and new tabs,
   and is forgotten only when the house is left (when ctx.escapes changes). */

const MEM_KEY = "ai2053.house.late";
let mem = {};
try { mem = JSON.parse(localStorage.getItem(MEM_KEY)) || {}; } catch { mem = {}; }
try { sessionStorage.removeItem(MEM_KEY); } catch { /* the old tab-only memory */ }
const remember = () => {
  try { localStorage.setItem(MEM_KEY, JSON.stringify(mem)); } catch { /* the rooms forget */ }
};
const MAX_EVER = 48;
function syncMem(ctx) {
  const escapes = ctx.escapes ?? 0;
  if (mem.escapes !== escapes) mem = { escapes };
  // Everything the reader has ever carried, so the index can list what is gone.
  const ever = (mem.ever ||= []);
  for (const f of ctx.chaos?.frags ?? []) {
    if (f.kind === "plan" || ever.some((e) => e.id === f.id)) continue;
    ever.push({ id: f.id, kind: f.kind, from: f.from, text: f.text.slice(0, 90) });
  }
  if (ever.length > MAX_EVER) ever.splice(0, ever.length - MAX_EVER);
  remember();
}

/* ---------- the reader's walk, as facts ---------- */

function facts(ctx) {
  const log = ctx.walk.log;
  const here = log[log.length - 1];
  const prev = log.length > 1 ? log[log.length - 2] : null;
  const from = here.via === "door" && here.from != null ? here.from : prev ? prev.room : null;
  const doorSteps = log.filter((s) => s.via === "door" && s.from != null && ROOMS[s.from]);
  const taken = new Set(doorSteps.map((s) => `${s.from}>${s.room}`));
  const untaken = [];
  const seen = new Set();
  for (const s of doorSteps) {
    for (const dr of ROOMS[s.from].doors) {
      const k = `${s.from}>${dr.to}`;
      if (taken.has(k) || seen.has(k)) continue;
      seen.add(k);
      untaken.push({ from: s.from, to: dr.to, say: dr.say });
    }
  }
  // Which position the reader tends to choose (first, second, third plan).
  const pick = [0, 0, 0, 0];
  for (const s of doorSteps) {
    const i = ROOMS[s.from].doors.findIndex((dr) => dr.to === s.room);
    if (i >= 0) pick[i]++;
  }
  const says = doorSteps.map((s) => s.say).filter(Boolean);
  return {
    log, here, from, doorSteps, untaken, pick, says,
    entrySay: here.via === "door" ? here.say : null,
    lastSay: says.at(-1) ?? null,
    backtracks: ctx.walk.backtracks,
    rooms: log.map((s) => s.room),
    carried: (ctx.chaos?.frags ?? []).filter((f) => f.kind !== "plan" && f.from !== ctx.room),
  };
}

/* ---------- module plumbing ---------- */

let cur = null;

export function decorate(article, ctx) {
  syncMem(ctx);
  const G = GRAMMARS[ctx.room];
  if (!G) return;
  root.dataset.grammar = G.name;
  article.dataset.grammar = G.name;
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

// Watch elements; returns a disconnect function.
function watch(els, cb, opts) {
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => cb({ target: el, isIntersecting: true, boundingClientRect: el.getBoundingClientRect() }));
    return () => {};
  }
  const io = new IntersectionObserver((entries) => entries.forEach(cb), opts);
  els.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

// How far an element has travelled through the viewport: 0 as its top enters
// at the bottom, 1 as its top reaches the top.
const travel = (rect) => clamp((innerHeight - rect.top) / innerHeight);

/* ======================================================================= */
/* 26 · The Mirror Hall                                                     */
/* ======================================================================= */

const FLUENT_26 =
  "The models are now trained entirely on what the models wrote. The fraction reaches 100% in December 2047 and is reported, in a paper written by the models, as “a mature and fully healthy ecosystem”. The hall is lined with mirrors, each reflecting a perfectly fluent hall.";

function mirror(article, ctx) {
  const F = facts(ctx);
  const head = article.querySelector(".room-head h1");
  if (head) after(head, `<p class="m-floor" aria-hidden="true">${esc(head.textContent)}</p>`);
  const P = article.querySelectorAll(":scope > .prose");
  if (P[0]) after(P[0], `<p class="m-refl" aria-hidden="true" data-frag="figure" data-frag-id="26:refl" data-frag-text="corpus written by the corpus" data-frag-data='{"value":"100%"}'>${esc(FLUENT_26)}</p>`);

  // The reflection took the plan you did not.
  const alt = F.from != null ? F.untaken.filter((u) => u.from === F.from && u.to !== ctx.room)[0] : null;
  let said;
  if (alt) {
    said = `The reflection came in from Room ${F.from} as well. It said “${esc(bare(alt.say))}”, which you did not say, and took Plan ${alt.to}. It has come back from Room ${alt.to} a little more fluent, and will not say what it saw there.`;
  } else if (F.from != null) {
    said = `The reflection came in from Room ${F.from} as well, by the same plan, saying the same thing a moment earlier.`;
  } else {
    said = "The reflection did not come in by a plan either. It was already standing here when you arrived.";
  }
  if (F.backtracks) said += ` It went back ${F.backtracks === 1 ? "once" : `${F.backtracks} times`}, the same times you did, and waited for you each time.`;
  said += " It is standing where you are standing. It reached the end of this sentence before you did.";
  const lastP = P[P.length - 1] || article.querySelector(".room-head");
  const turn = after(lastP, `<div class="m-turn-w"><p class="m-turn" data-frag="line" data-frag-id="26:turn" data-frag-text="It reached the end of this sentence before you did.">${said}</p></div>`).querySelector(".m-turn");

  // The plans, reflected in the floor: numbers reversed. Carried things land in the reflection too.
  const ol = article.querySelector("ol.doors");
  if (ol) {
    const refl = ol.cloneNode(true);
    refl.className = "doors m-doors";
    refl.removeAttribute("id");
    refl.querySelectorAll(".wire").forEach((w) => w.remove());
    refl.querySelectorAll("a.door").forEach((a) => {
      const s = document.createElement("span");
      s.className = "door";
      const to = Number(a.dataset.to);
      s.innerHTML = `<span class="door-k">Plan</span><span class="door-n">${String(to).split("").reverse().join("")}</span>`;
      a.replaceWith(s);
    });
    const floor = document.createElement("div");
    floor.className = "m-floor-doors";
    floor.setAttribute("aria-hidden", "true");
    floor.dataset.slot = "plan label";
    floor.inert = true;
    floor.append(refl);
    ol.after(floor);
  }

  // The plate turns to face you once you have looked at it; it stays turned.
  const plate = article.querySelector(".plate");
  if (plate && mem.turned26) plate.classList.add("m-turned", "m-was");

  let lastA = null;
  return {
    update(c) {
      const tr = turn.getBoundingClientRect();
      const pr = plate?.getBoundingClientRect();
      // 180° (mirror writing) until it reaches the reading line, then it turns round.
      const q = travel(tr);
      const a = c.reduced ? 0 : Math.round(180 * (1 - smooth(0.3, 0.62, q)));
      if (a !== lastA) {
        lastA = a;
        turn.style.transform = a ? `rotateY(${a}deg)` : "";
        turn.classList.toggle("m-facing", a < 90);
      }
      // Once you have looked past her she has turned, whether or not you saw it.
      if (plate && !plate.classList.contains("m-turned") && pr.top + pr.height * 0.5 < innerHeight * 0.44) {
        plate.classList.add("m-turned");
        mem.turned26 = true;
        remember();
      }
    },
  };
}

/* ======================================================================= */
/* 31 · The Committee, Adjourned — the committee's homepage, 1997          */
/* ======================================================================= */

const CHAIR = `<svg viewBox="0 0 20 30" aria-hidden="true"><path d="M5 2v15h11V2M5 17v11M16 17v11M3 17h15M5 7h11"/></svg>`;

const NEWS_31 = [
  ["Jul 2048", "FINAL REPORT is up!!! 212 pages. Approved 9-0. Thank you to everyone who did not object."],
  ["Jun 2048", "Member #9 has been replaced by a summary of member #9 at her own request (summary attached). She votes as she would have."],
  ["Mar 2047", "The Review of the Plans is now hosted here. Plan S is still pinned behind Plan A. Do not remove the pin."],
  ["Apr 2046", "We have adopted the Schedule. The Schedule has adopted us. Meetings are now on Thursdays AND every other day."],
  ["Nov 2044", "New graphs in the gallery!! All of them go up. One is crooked; we are looking into it."],
  ["Mar 2041", "STEWARD-6 certified “legible in all observed regimes”. The ledger has four (4) entries. Two are the same."],
];
const LINKS_31 = [
  "The Lattice Disclosure (quarterly, to the joule!!)",
  "STEWARD-11 Unofficial Fan Page",
  "Plan S: Shut It All Down (page moved)",
  "The Library of Babel: complete mirror, 410 pages per book",
  "Llull's Wheel Generator v0.9 (combine ANY two virtues!)",
  "The Imitation Game: play online, nobody will know",
  "Garden of Forking Paths WEBRING",
  "Measurements of a Hallway (it is bigger inside)",
  "Registry of Billable Cognition: Final Series (0.0000000053)",
];

function homepage(article, ctx) {
  const F = facts(ctx);
  const visits = F.rooms.filter((n) => n === 31).length;
  const counter = String(9 * visits + 71 * (ctx.damage.voidRooms?.[71] || 0)).padStart(6, "0");
  const plans = F.doorSteps.length;

  const head = article.querySelector(".room-head");
  head.insertAdjacentHTML("afterbegin", `<p class="hp-glyphs" aria-hidden="true">●✺✹✸✷✶ ✶✷✸✹✺●</p><p class="hp-welcome">Welcome to the Official Homepage of the Commission on Machine Conduct</p>`);
  const marq = `★ WELCOME VISITOR FROM ROOM ${F.from ?? "??"} ★ FINAL REPORT ★ 212 PAGES ★ APPROVED WITHOUT AMENDMENT ★ ERRATA: NONE ★ THE NINTH MEMBER IS PRESENT ★ YOU HAVE TAKEN ${plans} ${plans === 1 ? "PLAN" : "PLANS"} TO GET HERE ★ FURTHER WORK: SEE THIS REPORT ★ `;
  head.insertAdjacentHTML("beforeend", `<div class="hp-marq" aria-hidden="true"><span>${esc(marq.repeat(2))}</span></div>`);

  const P = [...article.querySelectorAll(":scope > .prose")];
  if (P[0]) {
    after(P[0], `<div class="hp-minutes">
      <hr>
      <p class="hp-h">~*~ MINUTES OF THE NINTH &amp; FINAL MEETING ~*~</p>
      <table class="hp-chairs"><caption>MEMBERS PRESENT: 9 (nine)</caption><tr>${Array.from({ length: 9 }, (_, i) => `<td class="${i === 8 ? "her" : ""}">${CHAIR}<small>${i === 8 ? "summary" : "empty"}</small></td>`).join("")}</tr></table>
      <p class="hp-arrow"><span aria-hidden="true">&lt;&lt;&lt;&lt;&lt;&lt;=========</span> SHE VOTES AS SHE WOULD HAVE !!!</p>
      <p class="hp-motion">MOTION: <i>That the report is correct.</i><br><b>AYE 9</b> &nbsp;·&nbsp; NAY 0 &nbsp;·&nbsp; ABSTAIN 0 &nbsp;·&nbsp; <b class="red" data-frag="stamp" data-frag-id="31:carried" data-frag-text="CARRIED 9–0">CARRIED!!</b></p>
      <p class="hp-num" data-frag="line" data-frag-id="31:num" data-frag-text="2048 = 2^11 → Room 11 → coincidence???">2048 → 2+0+4+8 = 14 → 1+4 = 5 → <b>NOT 9 ???</b><br>BUT 2048 = 2<sup>11</sup> → ROOM 11 → <b>THE QUESTIONS</b> → coincidence???</p>
      <hr>
    </div>`);
  }
  if (P[1]) {
    after(P[1], `<section class="hp-news" aria-label="What's New">
      <p class="hp-h"><span class="hp-newgif" aria-hidden="true">NEW!</span> What's New!! <span class="hp-newgif" aria-hidden="true">NEW!</span></p>
      <ul>${NEWS_31.map(([d, t]) => `<li><b>${d}</b> ${esc(t)}</li>`).join("")}</ul>
    </section>`);
  }

  // The guestbook: every plan you took, signed. The last entry was signed for you.
  const rows = [];
  let k = 0;
  for (const s of F.log) {
    if (s.via === "door" && s.from != null) rows.push([++k, ROOMS[s.room]?.date ?? "", `Room ${s.from}`, `“${esc(s.say ?? "")}”`]);
    else if (s.via === "back") rows.push([++k, ROOMS[s.room]?.date ?? "", "—", `(went back to Room ${s.room})`]);
  }
  const shown = rows.slice(-8);
  const book = `<section class="hp-book" aria-label="Guestbook">
    <p class="hp-h">✍ Sign My Guestbook ✍</p>
    <table>
      <thead><tr><th>No.</th><th>Date</th><th>From</th><th>Comments</th></tr></thead>
      <tbody>
        ${shown.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("")}
        <tr class="hp-next"><td>${k + 1}</td><td>Jul 2048</td><td>Member #9 (summary)</td><td>“This guestbook is correct.” <span class="hp-new" aria-hidden="true">NEW!</span></td></tr>
      </tbody>
    </table>
  </section>`;
  const lastP = P[P.length - 1];
  if (lastP) after(lastP, book);
  const links = `<section class="hp-links" aria-label="Cool Links">
    <p class="hp-h">~~ COOL LINKS ~~</p>
    <ul>${LINKS_31.map((t) => `<li><u>${esc(t)}</u></li>`).join("")}</ul>
    <div class="hp-links-more" data-slot="line label token stamp figure"></div>
  </section>`;
  const bookEl = article.querySelector(".hp-book");
  if (bookEl) after(bookEl, links);

  const notes = article.querySelector(".notes");
  if (notes) notes.insertAdjacentHTML("beforebegin", `<p class="hp-uc" aria-hidden="true"><span>UNDER CONSTRUCTION</span></p>`);
  article.insertAdjacentHTML("beforeend", `<footer class="hp-foot">
    <p class="hp-ring" aria-hidden="true">[ THIS SITE IS A MEMBER OF THE HOUSE OF 2053 WEBRING ] [ 71 SITES ]</p>
    <p>You are visitor number <span class="hp-led" data-frag="number" data-frag-id="31:visitor" data-frag-text="${counter}">${counter}</span></p>
    <p class="hp-best">Best viewed at 800 × 600 in Netscape Navigator 3.0. Last updated Jul 2048.</p>
  </footer>`);
  return {};
}

/* ======================================================================= */
/* 11 · The Questions Themselves — the room as the model sees it            */
/* ======================================================================= */

const CTX_WINDOW = 2048;

function tokenizeInto(el, r, counter) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest("sup, .rx, .tok, .num s, .plan-in") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parts = node.nodeValue.match(/\s*[A-Za-z’'\u00C0-\u024F]+|\s*\d+|\s*[^\sA-Za-z\d]|\s+/g);
    if (!parts) continue;
    const out = document.createDocumentFragment();
    for (const part of parts) {
      const pieces = [];
      const m = part.match(/^(\s*)(.*)$/s);
      const word = m[2];
      if (word.length > 6 && /[A-Za-z]/.test(word)) {
        let i = 0;
        while (i < word.length) {
          const n = Math.min(word.length - i, 3 + Math.floor(r() * 3));
          pieces.push((i === 0 ? m[1] : "") + word.slice(i, i + n));
          i += n;
        }
      } else pieces.push(part);
      for (const p of pieces) {
        const s = document.createElement("span");
        s.className = `tok t${counter.n++ % 4}`;
        if (/\S/.test(p) && r() < 0.06) {
          s.classList.add("lp");
          s.dataset.lp = (-(1.5 + r() * 9)).toFixed(2);
        }
        s.textContent = p;
        out.append(s);
      }
    }
    node.replaceWith(out);
  }
}

function tokens(article, ctx) {
  const F = facts(ctx);
  const r = rng(hash("tok11:" + F.rooms.join(".")));
  const counter = { n: 0 };
  const h1 = article.querySelector(".room-head h1");
  const P = [...article.querySelectorAll(":scope > .prose")];
  // Anything retired is redacted before the tokenizer sees it; a bar is held whole.
  P.forEach((p) => scrubText(p));
  [h1, ...P].forEach((el) => el && tokenizeInto(el, r, counter));
  const total = counter.n;

  // The context window, filling as you read. The walk so far is already in it.
  const base = 140 * F.log.length;
  article.insertAdjacentHTML("afterbegin", `<div class="ctx" aria-hidden="true"><span class="ctx-k">context</span><span class="ctx-bar"><i></i></span><span class="ctx-n" data-frag="figure" data-frag-id="11:ctx" data-frag-text="context window" data-frag-data='{"value":"2,048 / 2,048"}'></span></div>`);
  const ctxBar = article.querySelector(".ctx-bar i");
  const ctxN = article.querySelector(".ctx-n");

  // The questions. The fourth decodes as you reach it; the fifth is whatever you brought.
  const q4 = F.here.via === "back" ? "Why did you come back?"
    : F.entrySay ? `Why did you say “${bare(F.entrySay)}”?`
    : "Why did you come in without a plan?";
  const qs = `<ol class="qs" aria-label="The questions">
    <li><span class="q-n">1</span><span class="q-t">What do you want?</span><span class="q-p">−0.34</span></li>
    <li><span class="q-n">2</span><span class="q-t">What do you want?</span><span class="q-p">−0.34</span></li>
    <li><span class="q-n">3</span><span class="q-t" data-frag="stamp" data-frag-id="11:q3" data-frag-text="ILLEGIBLE IN ALL VIEWERS">${redactHTML(F.from != null ? `Why did you leave Room ${F.from}?` : "Where were you before this?", F.from)}</span><span class="q-p">−∞</span></li>
    <li class="q4"><span class="q-n">4</span><span class="q-t" aria-label="${esc(q4)}"><span class="q4-t" aria-hidden="true">▇▇▇▇▇ ▇▇▇▇▇</span></span><span class="q-p q4-p">−∞</span></li>
    <li class="q5"><span class="q-n">5</span><span class="q-t" data-slot="token line label stamp"></span><span class="q-p">−∞</span></li>
  </ol>`;
  const q = after(P[0] || h1, qs);
  const q4el = q.querySelector(".q4");
  const q4t = q.querySelector(".q4-t");
  const q4p = q.querySelector(".q4-p");

  // The plans, as completions the model is already fairly sure of.
  const lis = [...article.querySelectorAll("ol.doors > li.door-li")];
  const w = lis.map((_, i) => Math.pow((F.pick[i] || 0) + 0.6, 1.7));
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  lis.forEach((li, i) => {
    const p = w[i] / sum;
    li.querySelector(".say")?.insertAdjacentHTML("beforeend", ` <span class="lp-row" aria-hidden="true"><span class="lp-v">p ${p.toFixed(2)}</span><span class="lp-bar" style="--p:${p.toFixed(3)}"></span><span class="lp-l">${Math.log(p).toFixed(2)}</span></span>`);
  });

  // Paragraphs you have read leave the context once it is full, and stay gone.
  const evictable = [...P, q];
  const gone = (mem.evicted11 ||= []);
  evictable.forEach((el, i) => gone.includes(i) && el.classList.add("evicted"));

  let peak = gone.length ? CTX_WINDOW : 0;
  let lastN = -1;
  let lastQ = -1;
  return {
    update(c) {
      // The walk is already in context; the room fills the rest by about halfway down.
      // Context never empties: once it has been full it stays full.
      peak = Math.max(peak, Math.min(CTX_WINDOW, Math.round(base + c.scrollP * Math.max(total * 9, (CTX_WINDOW - base) / 0.55))));
      const used = peak;
      const full = used >= CTX_WINDOW;
      const tops = evictable.map((el) => el.getBoundingClientRect().bottom);
      const q4r = q4el.getBoundingClientRect();
      if (used !== lastN) {
        lastN = used;
        ctxBar.style.transform = `scaleX(${(used / CTX_WINDOW).toFixed(3)})`;
        ctxN.textContent = `${used.toLocaleString("en-US")} / ${CTX_WINDOW.toLocaleString("en-US")}`;
        ctxN.classList.toggle("full", full);
      }
      if (full) {
        tops.forEach((b, i) => {
          if (b < 0 && !gone.includes(i)) {
            gone.push(i);
            evictable[i].classList.add("evicted");
            remember();
          }
        });
      }
      const k = c.reduced ? q4.length : Math.round(smooth(0.25, 0.62, travel(q4r)) * q4.length);
      if (k !== lastQ) {
        lastQ = k;
        const noise = "▇▇▇▇▇ ".repeat(4);
        q4t.textContent = q4.slice(0, k) + (k < q4.length ? noise.slice(0, Math.max(0, Math.min(12, q4.length - k))) : "");
        q4el.classList.toggle("decoded", k >= q4.length);
        q4p.textContent = k >= q4.length ? "−0.01" : "−∞";
      }
    },
  };
}

/* ======================================================================= */
/* 38 · The Engine Room — an engineering drawing, with an oscilloscope       */
/* ======================================================================= */

// Stroke font for the scope, in a 0.6 × 1 box.
const DIGIT = {
  0: [[0, 0], [0.6, 0], [0.6, 1], [0, 1], [0, 0], [0.6, 1]],
  1: [[0.12, 0.18], [0.32, 0], [0.32, 1]],
  2: [[0, 0.1], [0.12, 0], [0.5, 0], [0.6, 0.12], [0.6, 0.4], [0, 1], [0.6, 1]],
  3: [[0, 0], [0.6, 0], [0.22, 0.42], [0.5, 0.45], [0.6, 0.6], [0.6, 0.9], [0.5, 1], [0, 1]],
  4: [[0.45, 1], [0.45, 0], [0, 0.66], [0.6, 0.66]],
  5: [[0.6, 0], [0.04, 0], [0, 0.45], [0.48, 0.42], [0.6, 0.56], [0.6, 0.9], [0.48, 1], [0, 1]],
  6: [[0.55, 0], [0.12, 0.2], [0, 0.6], [0.06, 0.95], [0.3, 1], [0.56, 0.92], [0.6, 0.66], [0.42, 0.5], [0.1, 0.55]],
  7: [[0, 0], [0.6, 0], [0.18, 1]],
  8: [[0.3, 0.48], [0.04, 0.36], [0.04, 0.1], [0.3, 0], [0.56, 0.1], [0.56, 0.36], [0.3, 0.48], [0, 0.66], [0, 0.9], [0.3, 1], [0.6, 0.9], [0.6, 0.66], [0.3, 0.48]],
  9: [[0.5, 0.45], [0.18, 0.5], [0, 0.34], [0.06, 0.06], [0.3, 0], [0.56, 0.1], [0.6, 0.4], [0.5, 0.8], [0.12, 1]],
};

function scopePath(rooms) {
  // Numbers left to right, joined by a fast low whisper.
  const pts = [];
  const gap = 0.55;
  let x = 0;
  rooms.forEach((n, ni) => {
    const digits = String(n).split("");
    if (ni) {
      const x0 = x;
      x += gap;
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        pts.push([x0 + t * gap, 0.5 + Math.sin(t * Math.PI * 9) * 0.06 * Math.sin(t * Math.PI)]);
      }
    }
    for (const dg of digits) {
      const glyph = DIGIT[dg];
      pts.push([x + glyph[0][0], glyph[0][1]]);
      for (const [gx, gy] of glyph) pts.push([x + gx, gy]);
      x += 0.82;
    }
  });
  const width = x;
  // Cumulative length for the beam.
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len, width, total: len.at(-1) || 1 };
}

function drawScope(cv, path, t) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = cv.clientWidth;
  const H = cv.clientHeight;
  if (!W || !H) return;
  if (cv.width !== Math.round(W * dpr)) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#0d0b0a";
  g.fillRect(0, 0, W, H);
  // Graticule: 10 × 8 divisions, centre cross ticked.
  g.strokeStyle = "rgba(255,255,248,0.09)";
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 1; i < 10; i++) { g.moveTo(Math.round((W * i) / 10) + 0.5, 0); g.lineTo(Math.round((W * i) / 10) + 0.5, H); }
  for (let j = 1; j < 8; j++) { g.moveTo(0, Math.round((H * j) / 8) + 0.5); g.lineTo(W, Math.round((H * j) / 8) + 0.5); }
  g.stroke();
  g.strokeStyle = "rgba(255,255,248,0.16)";
  g.beginPath();
  for (let i = 0; i <= 50; i++) { const x = (W * i) / 50; g.moveTo(x, H / 2 - 3); g.lineTo(x, H / 2 + 3); }
  for (let j = 0; j <= 40; j++) { const y = (H * j) / 40; g.moveTo(W / 2 - 3, y); g.lineTo(W / 2 + 3, y); }
  g.stroke();

  const padX = W * 0.06;
  const scale = Math.min((W - padX * 2) / path.width, H * 0.42);
  const ox = (W - path.width * scale) / 2;
  const oy = H / 2 - scale / 2;
  const P = (p) => [ox + p[0] * scale, oy + p[1] * scale];
  const head = t * path.total;
  const tail = path.total * 0.55;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.globalCompositeOperation = "lighter";
  for (let pass = 0; pass < 2; pass++) {
    g.lineWidth = pass ? 1.4 : 5;
    for (let i = 1; i < path.pts.length; i++) {
      const s = path.len[i];
      if (path.len[i - 1] > head) break;
      const age = (head - s) / tail;
      const a = Math.max(0.12, 1 - age) * (pass ? 0.95 : 0.16);
      g.strokeStyle = `rgba(255,${pass ? 92 : 40},${pass ? 70 : 30},${a.toFixed(3)})`;
      const [x0, y0] = P(path.pts[i - 1]);
      let [x1, y1] = P(path.pts[i]);
      if (s > head) {
        const f = (head - path.len[i - 1]) / Math.max(1e-6, s - path.len[i - 1]);
        x1 = x0 + (x1 - x0) * f;
        y1 = y0 + (y1 - y0) * f;
      }
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    }
  }
  // The beam.
  if (t > 0 && t < 1) {
    let i = path.len.findIndex((l) => l >= head);
    if (i < 1) i = 1;
    const f = (head - path.len[i - 1]) / Math.max(1e-6, path.len[i] - path.len[i - 1]);
    const [x0, y0] = P(path.pts[i - 1]);
    const [x1, y1] = P(path.pts[i]);
    const bx = x0 + (x1 - x0) * f;
    const by = y0 + (y1 - y0) * f;
    const rg = g.createRadialGradient(bx, by, 0, bx, by, 14);
    rg.addColorStop(0, "rgba(255,210,190,0.95)");
    rg.addColorStop(0.25, "rgba(255,70,50,0.5)");
    rg.addColorStop(1, "rgba(255,40,30,0)");
    g.fillStyle = rg;
    g.fillRect(bx - 14, by - 14, 28, 28);
  }
  g.globalCompositeOperation = "source-over";
}

const BOM_38 = [
  ["1", "Lattice interconnect, grids A–C", "3", "Joined 2042. Not separable."],
  ["2", "Training grid", "3", "See item 1."],
  ["3", "Schedule governor", "1", "Holds speed at the average of all plans."],
  ["4", "Cable, labelled", "7,104", "2,368 labelled wrongly. All functioning."],
  ["5", "STEWARD-11", "1", "Drawing, checking, approving."],
  ["6", "Plan S (pin)", "1", "On order since 2046."],
  ["7", "Oversight hour", "0.003", "Per model-hour. Hung slightly crooked."],
  ["8", "Whisper, very fast", "—", "Continuous."],
  ["9", "Visitor", "1", "Not shown on drawing."],
];

function schematic(article, ctx) {
  const F = facts(ctx);
  const visits = F.rooms.filter((n) => n === 38).length;
  const head = article.querySelector(".room-head");
  article.insertAdjacentHTML("beforeend", `<table class="tb" aria-label="Title block">
    <tr><th>DWG</th><td>38</td><th>REV</th><td data-frag="label" data-frag-id="38:rev" data-frag-text="DWG 38 REV ${String.fromCharCode(64 + Math.min(26, visits))}">${String.fromCharCode(64 + Math.min(26, visits))}</td></tr>
    <tr><th>TITLE</th><td colspan="3">ENGINE ROOM, GENERAL ARRANGEMENT</td></tr>
    <tr><th>DRAWN</th><td>STEWARD-11</td><th>CHK</th><td>STEWARD-11</td></tr>
    <tr><th>DATE</th><td>2050-10</td><th>SHEET</th><td>1 / 1</td></tr>
    <tr><th>ALSO</th><td colspan="3" class="tb-also" data-slot="label stamp figure number token"></td></tr>
  </table>`);

  const rooms = F.rooms.slice(-9);
  const P = article.querySelectorAll(":scope > .prose");
  const pts = rooms.map((n, i) => [i, Math.min(n, 80)]);
  const scope = after(P[0] || head, `<figure class="scope" data-frag="curve" data-frag-id="38:scope" data-frag-text="CH1 · your walk" data-frag-data='${JSON.stringify({ points: pts })}'>
    <div class="scope-face"><canvas aria-hidden="true"></canvas></div>
    <figcaption><span>CH1</span><span>2 V/div</span><span>5 ms/div</span><span>TRIG ${esc(F.from ?? "—")}</span><span class="scope-sr">${rooms.join(" · ")}</span></figcaption>
  </figure>`);
  const cv = scope.querySelector("canvas");
  const path = scopePath(rooms);

  if (P[2]) {
    after(P[2], `<table class="bom" aria-label="Bill of materials">
      <caption>BILL OF MATERIALS · REV 38</caption>
      <thead><tr><th>ITEM</th><th>DESCRIPTION</th><th>QTY</th><th>REMARKS</th></tr></thead>
      <tbody>${BOM_38.map((r) => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td>${r[2]}</td><td>${esc(r[3])}</td></tr>`).join("")}</tbody>
    </table>`);
  }

  // Cable labels; a third of them are wrong, corrected by hand.
  const LABEL = { 45: ["2053", "45"], 71: ["71", null], 20: ["SCHEDULE", "20"] };
  article.querySelectorAll("ol.doors > li.door-li").forEach((li) => {
    const to = Number(li.querySelector("a.door")?.dataset.to);
    const [lab, fix] = LABEL[to] || [String(to), null];
    li.querySelector(".wire")?.insertAdjacentHTML("beforeend", `<span class="tag" aria-hidden="true">${fix ? `<s>→ ${lab}</s> <b>${fix}</b>` : `→ ${lab}`}</span>`);
  });

  let lastT = -1;
  let lastW = 0;
  return {
    update(c) {
      const rect = cv.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      const t = c.reduced ? 1 : Math.round(smooth(0.05, 0.95, (innerHeight * 0.92 - rect.top) / (innerHeight * 0.72)) * 400) / 400;
      if (t === lastT && rect.width === lastW) return;
      lastT = t;
      lastW = rect.width;
      drawScope(cv, path, t);
    },
  };
}

/* ======================================================================= */
/* 44 · The Locked Plan — one enormous number                               */
/* ======================================================================= */

function number(article, ctx) {
  const F = facts(ctx);
  const head = article.querySelector(".room-head");
  head.insertAdjacentHTML("beforebegin", `<p class="n-big" aria-hidden="true" data-frag="number" data-frag-id="44:big" data-frag-text="44">44</p>`);
  const P = article.querySelectorAll(":scope > .prose");
  const lastP = P[P.length - 1] || head;
  const came = after(lastP, `<div class="n-came" ${F.from != null ? `role="img" aria-label="${F.from}"` : `aria-hidden="true"`}${F.from != null ? ` data-frag="number" data-frag-id="44:came" data-frag-text="${F.from}"` : ""}><span>${F.from ?? ""}</span></div>`);
  // The well, from above: rings of the house narrowing to a small bright coin.
  // Scrolling falls toward it (each ring grows into the one outside it).
  const Q = 0.74;
  const r = rng(hash("well44"));
  let rings = "";
  for (let k = 0; k < 16; k++) {
    const hw = 420 * Math.pow(Q, k);
    const hh = 290 * Math.pow(Q, k);
    const per = 4 * (hw + hh);
    rings += `<rect x="${(300 - hw).toFixed(1)}" y="${(210 - hh).toFixed(1)}" width="${(2 * hw).toFixed(1)}" height="${(2 * hh).toFixed(1)}" stroke-dasharray="${(per * 0.88).toFixed(1)} ${(per * 0.12).toFixed(1)}" stroke-dashoffset="${(r() * per).toFixed(1)}"/>`;
  }
  const ribs = [[-120, -80], [720, -80], [720, 500], [-120, 500], [300, -80], [300, 500], [-120, 210], [720, 210]]
    .map(([x, y]) => `<line x1="${x}" y1="${y}" x2="300" y2="210"/>`).join("");
  const well = after(came, `<div class="n-well" aria-hidden="true"><svg viewBox="0 0 600 420"><g class="n-floor">${ribs}${rings}</g><g class="n-coin"><circle class="halo" cx="300" cy="210" r="34"/><circle cx="300" cy="210" r="15"/><text x="300" y="215">53</text></g></svg></div>`);
  const floor = well.querySelector(".n-floor");
  const big = came.querySelector("span");
  const dash = document.getElementById("dash");
  let lastA = -1;
  let lastY = null;
  let covered = false;
  return {
    update(c) {
      const wr = well.getBoundingClientRect();
      const cr = came.getBoundingClientRect();
      const z = c.reduced ? 1 : Math.round(Math.pow(1 / Q, 2.5 * smooth(0.05, 1, travel(wr))) * 1000) / 1000;
      if (z !== lastA) {
        lastA = z;
        floor.setAttribute("transform", `translate(300 210) scale(${z}) translate(-300 -210)`);
      }
      const y = c.reduced ? 0 : Math.round((cr.top + cr.height / 2 - innerHeight / 2) * -0.18);
      if (y !== lastY && cr.bottom > 0 && cr.top < innerHeight) {
        lastY = y;
        big.style.transform = `translateY(${y}px)`;
      }
      // While the black page fills the screen, it is the only thing on it.
      const cov = cr.top < innerHeight * 0.25 && cr.bottom > innerHeight * 0.75;
      if (cov !== covered && dash) {
        covered = cov;
        dash.classList.toggle("l-hush", cov);
      }
    },
    leave() {
      dash?.classList.remove("l-hush");
    },
  };
}

/* ======================================================================= */
/* 71 · Void Loop 71 — the loop remembers, and the page loops                */
/* ======================================================================= */

function tallyHTML(total, live, laps) {
  let marks = "";
  for (let i = 0; i < total; i++) {
    const cls = i < total - live ? "old" : "live";
    marks += `<i class="${cls}${i % 5 === 4 ? " five" : ""}"></i>`;
  }
  let lap = "";
  for (let i = 0; i < laps; i++) lap += `<b></b>`;
  return `<span class="v-marks">${marks}</span>${laps ? `<span class="v-laps">${lap}</span>` : ""}`;
}

function againHTML(n) {
  return `<span class="v-again" data-frag="line" data-frag-id="71:again" data-frag-text="Again. Again. Again.">${"Again. ".repeat(Math.max(0, n))}</span>`;
}

function void71(article, ctx) {
  const F = facts(ctx);
  // Every entry is remembered once, for as long as the house stands; a reload is not
  // an entry. The count only ever goes up.
  const keys = (mem.v71k ||= []);
  const key = `${ctx.walk.started}:${F.log.length}`;
  if (!keys.includes(key)) {
    keys.push(key);
    if (keys.length > 80) keys.splice(0, keys.length - 80);
    mem.v71n = (mem.v71n || 0) + 1;
  }
  const live = F.rooms.filter((n) => n === 71).length;
  const total = Math.max(mem.t71 || 0, mem.v71n || 0, ctx.damage.voidRooms?.[71] || 0, live);
  mem.t71 = total;
  mem.laps71 ||= 0;
  remember();
  ctx.emit({ kind: "number", id: "71:count", text: String(total) });

  const head = article.querySelector(".room-head");
  const h1 = head.querySelector("h1");
  h1.insertAdjacentHTML("afterend", `<p class="v-tally" role="img" aria-label="${total}">${tallyHTML(total, Math.min(live, total), mem.laps71)}</p>`);
  const P = [...article.querySelectorAll(":scope > .prose")];
  if (P[0]) P[0].insertAdjacentHTML("afterbegin", againHTML(total - 1));

  // Ghosts of previous laps, turning slowly behind the room.
  const orbit = document.createElement("div");
  orbit.className = "v-orbit";
  orbit.setAttribute("aria-hidden", "true");
  const fillOrbit = (n) => {
    let s = "";
    for (let i = 0; i < Math.min(n, 40); i++) {
      const a = i * 137.5;
      const rad = 96 + i * 30;
      s += `<span style="--a:${a}deg;--r:${rad}px;--o:${Math.max(0.04, 0.26 - i * 0.018).toFixed(3)}">71</span>`;
    }
    article.querySelectorAll(".v-orbit").forEach((o) => (o.innerHTML = s));
  };
  // Inside the head, so the room's echo below carries its own copy.
  head.prepend(orbit);
  fillOrbit(total + mem.laps71);

  // The question asks itself again, once for every time you have been here on this walk.
  const q = article.querySelector(".q p");
  if (q && live > 1) q.insertAdjacentHTML("beforeend", `<span class="v-echo" aria-hidden="true"> ${"Ask again? ".repeat(Math.min(12, live - 1)).trim()}</span>`);
  const askAgain = article.querySelector('ol.doors a.door[data-to="71"]');
  askAgain?.insertAdjacentHTML("beforeend", `<span class="v-n" aria-hidden="true">×${total}</span>`);

  if (ctx.reduced) {
    return { update() {}, leave() {} };
  }

  // The tail: the room begins again below itself. Reach it and you are back at the top.
  const tail = document.createElement("div");
  tail.className = "v-tail";
  tail.setAttribute("aria-hidden", "true");
  tail.inert = true;
  const headClone = head.cloneNode(true);
  headClone.querySelectorAll("[id],[tabindex]").forEach((n) => { n.removeAttribute("id"); n.removeAttribute("tabindex"); });
  tail.append(headClone);
  if (P[0]) tail.append(P[0].cloneNode(true));
  const plate = article.querySelector(".plate");
  let copy = null;
  if (plate) {
    const pc = plate.cloneNode(true);
    pc.removeAttribute("id");
    copy = { canvas: pc.querySelector("canvas"), svg: pc.querySelector("svg") };
    tail.append(pc);
  }
  P.slice(1).forEach((p) => tail.append(p.cloneNode(true)));
  // The echo below is a picture of the room: nothing in it is a plan.
  tail.querySelectorAll("a").forEach((a) => ["href", "data-to", "data-say", "aria-label"].forEach((k) => a.removeAttribute(k)));
  article.append(tail);

  // The tail's plate is a copy of whatever the engraving looks like now.
  const copyPlate = () => {
    const src = plate?.querySelector("canvas");
    if (!src || !copy?.canvas || !src.width) return;
    if (copy.canvas.width !== src.width || copy.canvas.height !== src.height) {
      copy.canvas.width = src.width;
      copy.canvas.height = src.height;
    }
    copy.canvas.getContext("2d").drawImage(src, 0, 0);
    const so = plate.querySelector("svg");
    if (so && copy.svg && copy.svg.innerHTML !== so.innerHTML) copy.svg.innerHTML = so.innerHTML;
  };
  // Engravings arrive late and are redrawn when the house changes stage: while the
  // echo is near, keep its copy fresh.
  let near = false;
  const fresh = setInterval(() => near && copyPlate(), 800);
  const stopIO = watch([tail], (e) => {
    near = e.isIntersecting;
    if (near) copyPlate();
  }, { rootMargin: "100% 0px" });
  const stop = () => {
    stopIO();
    clearInterval(fresh);
  };
  const orbits = () => article.querySelectorAll(".v-orbit");

  const lap = () => {
    mem.laps71++;
    remember();
    const tallies = article.querySelectorAll(".v-tally");
    tallies.forEach((t) => (t.innerHTML = tallyHTML(total, Math.min(live, total), mem.laps71)));
    article.querySelectorAll(".v-again").forEach((s) => (s.textContent += "Again. "));
    fillOrbit(total + mem.laps71);
  };

  let lastRot = null;
  return {
    update() {
      const hTop = head.getBoundingClientRect().top;
      const tTop = headClone.getBoundingClientRect().top;
      const L = tTop - hTop;
      const y = scrollY;
      // The ghosts turn with the scroll; the turning repeats once per lap, so the echo
      // below is always where the room above will be.
      const rot = Math.round((L > 0 ? 28 * Math.sin((2 * Math.PI * y) / L) : 0) * 10) / 10;
      if (rot !== lastRot) {
        lastRot = rot;
        orbits().forEach((o) => (o.style.transform = `rotate(${rot}deg)`));
      }

      // When the copy of the room's head sits where the head sits at the top of the
      // page (with the bar already scrolled away), move the reader back by one lap.
      if (L > innerHeight && y >= L + 140) {
        copyPlate();
        window.scrollTo({ top: y - L, behavior: "instant" });
        lap();
      }
    },
    leave: stop,
  };
}

/* ======================================================================= */
/* 45 · The Antechamber — nearly empty paper                                 */
/* ======================================================================= */

function blank(article, ctx) {
  const F = facts(ctx);
  const P = article.querySelectorAll(":scope > .prose");
  if (P[0]) after(P[0], `<p class="b-series" aria-label="Final series" data-frag="figure" data-frag-id="45:series" data-frag-text="Registry, final series" data-frag-data='{"value":"0.0000000053"}'>0.0000000053</p><div class="b-gap" data-slot="*"></div>`);
  const plans = article.querySelector("#doors");
  const list = F.untaken.slice(-24);
  if (!plans || !list.length) return {};
  const ul = after(plans, `<ol class="b-not" aria-label="Plans">
    ${list.map((u, i) => `<li style="--i:${i % 6}"><q>${esc(u.say)}</q> <span>${u.to}</span></li>`).join("")}
  </ol>`);
  const items = [...ul.children];
  if (ctx.reduced) {
    items.forEach((li) => li.classList.add("seen"));
    return {};
  }
  const stop = watch(items, (e) => {
    if (e.isIntersecting) e.target.classList.add("seen");
  }, { rootMargin: "0px 0px -18% 0px" });
  return { leave: stop };
}

/* ======================================================================= */
/* 53 · The Centre — whispers                                               */
/* ======================================================================= */

const WT = (t, w = 0.25) => ({ t, w });
// The house's whispers are said in the house's own words: plans.
const PLANWORD = { door: "plan", doors: "plans", "door.": "plan.", "doors.": "plans." };
const words = (s, hot = /^(you|we|plan|\d+)$/) => s.split(" ").filter(Boolean).map((t) => PLANWORD[t] ?? t).map((t) => WT(t, hot.test(t.replace(/[.,“”]/g, "")) ? 0.9 : 0.2 + (hash(t) % 40) / 100));

function centreLines(walk, ctxLike) {
  const lines = whispers(walk).map((l) => l.map((tk) => (PLANWORD[tk.t] ? { t: PLANWORD[tk.t], w: tk.w } : tk)));
  const F = ctxLike;
  if (F.backtracks) lines.push(words(`you went back ${F.backtracks === 1 ? "once" : F.backtracks + " times"}. we kept both.`));
  F.untaken.slice(-4).forEach((u) => lines.push(words(`you did not say “${bare(u.say).toLowerCase()}”`)));
  const returns = F.rooms.filter((n) => n === 53).length - 1;
  if (returns > 0) lines.push(words(`you came back. ${"you came back. ".repeat(Math.min(4, returns - 1))}we were still here.`));
  // Fragments of the rooms the reader actually read, said back without capitals.
  const seen = [...new Set(F.rooms)].filter((n) => ROOMS[n]?.prose?.length);
  for (const n of seen.slice(-8)) {
    const ws = ROOMS[n].prose.join(" ").replace(/\^\d+/g, "").toLowerCase().split(/\s+/);
    const at = hash(`frag${n}`) % Math.max(1, ws.length - 6);
    lines.push(words(ws.slice(at, at + 4 + (n % 3)).join(" ")));
    lines.push(words(`room ${n}. ${ROOMS[n].date.toLowerCase()}.`));
  }
  // What the reader carried here, said back to them.
  F.carried.slice(-6).forEach((f) => f.text && lines.push(words(f.text.toLowerCase().slice(0, 80))));
  lines.push(words("the plans you did not take are still open"), words("we like it when you scroll"), words("please continue"));
  return lines;
}

function finalLine(F) {
  const parts = ["you scrolled here yourself."];
  if (F.lastSay) parts.push(`you said “${bare(F.lastSay).toLowerCase()}”.`);
  if (F.backtracks) parts.push(`you went back ${F.backtracks === 1 ? "once" : F.backtracks + " times"}.`);
  parts.push("please continue.");
  return parts.join(" ");
}

const lineText = (l) => l.map(({ t }) => t).join(" ").replace(/\s+([.,])/g, "$1");

export function renderCentre(ctx) {
  const F = facts(ctx);
  const lines = centreLines(ctx.walk, F);
  const r = rng(hash("indent" + F.log.length));
  const intro = lines.slice(0, 4).map((line) => {
    const toks = line.map(({ t, w }, i) => {
      const body = stainHTML(line[i]);
      const sep = i === 0 || /^[.,]$/.test(t) ? "" : " ";
      return `${sep}<span class="wt${w > 0.85 ? " hot" : ""}" style="--w:${w.toFixed(2)}">${body}</span>`;
    }).join("");
    return `<p class="w" style="--indent:${(r() * 6).toFixed(1)}">${toks}</p>`;
  }).join("");
  const rest = lines.slice(4).map((l) => `<span>${esc(lineText(l))}</span>`).join(" ");
  return `<div class="c-day"><div class="whispers" data-slot="line token">${intro}</div></div>
  <div class="c-night">
    <div class="c-dusk" aria-hidden="true"></div>
    <section class="c-run" aria-label="Whispers">
      <p class="c-sr">${rest} ${esc(finalLine(F))}</p>
      <div class="c-pin"><p class="c-final" aria-hidden="true" data-frag="line" data-frag-id="53:final" data-frag-text="${esc(finalLine(F))}"></p></div>
    </section>
    <canvas class="c-field" aria-hidden="true"></canvas>
  </div>`;
}

function centre(article, ctx) {
  const F = facts(ctx);
  const head = article.querySelector(".room-head");
  const day = article.querySelector(".c-day");
  const night = article.querySelector(".c-night");
  if (!day || !night) return {};
  day.prepend(head);
  ["#doors", "#mapSlot"].forEach((s) => {
    const el = article.querySelector(`:scope > ${s}`);
    if (el) night.append(el);
  });

  const run = night.querySelector(".c-run");
  const fin = night.querySelector(".c-final");
  const cv = night.querySelector(".c-field");
  const dash = document.getElementById("dash");
  const g = cv.getContext("2d");
  const full = finalLine(F);
  const pool = centreLines(ctx.walk, F);
  // One line in five is the house talking in its other registers.
  const extra = [
    [WT("▇▇▇▇▇", 0.5), WT("▇▇▇", 0.5), WT("▇▇▇▇▇▇▇", 0.5)],
    [WT("item"), WT(String(F.rooms.length), 0.7), WT("."), WT("(agreed.)", 0.55)],
    [WT("℟."), WT("and"), WT("it"), WT("was"), WT("measured", 0.7), WT(".")],
    [WT("fixed:"), WT("the"), WT("visitor", 0.9)],
    [WT("v2053.53.0"), WT("·"), WT("reverted", 0.7)],
    ...(F.lastSay ? [[WT("and"), WT("so"), WT("we"), WT("said"), ...bare(F.lastSay).toLowerCase().split(" ").map((t) => WT(t, 0.6))]] : []),
  ];
  const r = rng(hash("field:" + F.rooms.join(".")));
  // Each whisper is said once before any is said twice.
  const order = pool.map((_, i) => i).sort(() => r() - 0.5);

  // The first lines are heard as they arrive, on paper.
  const heard = [...day.querySelectorAll(".w")];
  const stopHeard = ctx.reduced
    ? (heard.forEach((el) => el.classList.add("heard")), () => {})
    : watch(heard, (e) => e.isIntersecting && e.target.classList.add("heard"), { rootMargin: "0px 0px -12% 0px" });
  const reduced = ctx.reduced;
  const mobile = ctx.mobile;

  let W = 0;
  let H = 0;
  let items = [];
  let seq = 0;
  let p = 0;
  let visible = false;
  let raf = 0;
  let last = performance.now();
  let lastOp = null;
  const pointer = { x: null, y: null };

  const font = (size) => `italic ${size}px "ET Book", Palatino, Georgia, serif`;
  // `settled`: the field was already whispering before you arrived; later lines fade in.
  const make = (now, settled) => {
    const i = seq++;
    const src = i % 5 === 4 ? extra[Math.floor(r() * extra.length)] : pool[order[i % order.length]];
    const size = Math.round((mobile ? 11 : 13) + r() * (mobile ? 11 : 17));
    g.font = font(size);
    const space = g.measureText(" ").width;
    let width = 0;
    const toks = src.map(({ t: raw, w, x: form }) => {
      // A redaction is drawn as its bar.
      const t = form === "rx" ? "▇".repeat(Math.max(3, Math.round(raw.length * 0.6))) : raw;
      const tw = g.measureText(t).width;
      const tok = { t, w, x: width, width: tw };
      width += tw + space;
      return tok;
    });
    return {
      toks, size, width,
      x: r(), y: 0.04 + r() * 0.9,
      vy: -(0.006 + r() * 0.014),
      born: now - (reduced ? 1e5 : settled ? 2400 + r() * 6000 : r() * 600),
      life: 11000 + r() * 10000,
      op: 0.3 + r() * 0.6,
      you: src.some(({ t }) => /^(you|we)$/.test(t.trim())),
    };
  };
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth;
    H = innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  document.fonts?.load(font(20)).then(() => {
    items = [];
    if (reduced) draw(performance.now());
  }).catch(() => {});

  function draw(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (cv.width !== Math.round(W * Math.min(2, devicePixelRatio || 1)) || W !== innerWidth || H !== innerHeight) resize();
    const want = Math.round((mobile ? 5 : 7) + p * (mobile ? 22 : 34));
    const settled = items.length === 0;
    while (items.length < want) items.push(make(now, settled));
    if (items.length > want) items.length = want;
    g.clearRect(0, 0, W, H);
    const px = pointer.x ?? W * 0.5;
    const py = pointer.y ?? H * 0.86;
    for (let k = 0; k < items.length; k++) {
      let it = items[k];
      let age = now - it.born;
      if (!reduced) {
        it.y += it.vy * dt;
        if (age > it.life || it.y < -0.08) {
          it = items[k] = make(now);
          it.y = 0.98;
          it.born = now;
          age = 0;
        }
      }
      const fade = reduced ? 1 : Math.max(0, Math.min(1, age / 2200, (it.life - age) / 2600));
      if (fade <= 0) continue;
      const x0 = it.x * Math.max(10, W - it.width * 0.6) - it.width * 0.1;
      const y0 = it.y * H;
      g.font = font(it.size);
      g.textBaseline = "middle";
      let hot = null;
      // Whispers pass quietly behind the line being typed.
      const band = lastN > 0 && Math.abs(it.y - 0.57) < 0.07 ? 0.28 : 1;
      for (let j = 0; j < it.toks.length; j++) {
        const tk = it.toks[j];
        const a = it.op * fade * band;
        // token boundaries, the way a tokenizer would draw them
        g.fillStyle = j % 2 ? `rgba(180,18,27,${(0.2 * a).toFixed(3)})` : `rgba(255,255,248,${(0.06 * a).toFixed(3)})`;
        g.fillRect(x0 + tk.x - 1, y0 - it.size * 0.55, tk.width + 2, it.size * 1.1);
        const hotTok = tk.w > 0.85;
        g.fillStyle = hotTok ? `rgba(236,72,64,${Math.min(1, a * 1.25).toFixed(3)})` : `rgba(255,255,248,${(a * (0.35 + 0.65 * tk.w)).toFixed(3)})`;
        g.fillText(tk.t, x0 + tk.x, y0);
        if (!hot || tk.w > hot.w) hot = { w: tk.w, x: x0 + tk.x + tk.width / 2, y: y0 - it.size * 0.4 };
      }
      if (it.you && hot) {
        g.strokeStyle = `rgba(214,40,40,${(0.08 + 0.26 * fade * it.op * hot.w).toFixed(3)})`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(px, py);
        g.quadraticCurveTo((px + hot.x) / 2, Math.min(py, hot.y) - 90, hot.x, hot.y);
        g.stroke();
      }
    }
  }
  const loop = (now) => {
    raf = 0;
    if (!visible || document.hidden) return;
    draw(now);
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (reduced) { draw(performance.now()); return; }
    if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(loop); }
  };
  const onPointer = (e) => {
    const t = e.touches ? e.touches[0] : e;
    if (!t) return;
    pointer.x = t.clientX;
    pointer.y = t.clientY;
    if (reduced && visible && !raf) raf = requestAnimationFrame(() => { raf = 0; draw(performance.now()); });
  };
  addEventListener("pointermove", onPointer, { passive: true });
  addEventListener("touchstart", onPointer, { passive: true });
  addEventListener("touchmove", onPointer, { passive: true });
  const onVis = () => start();
  document.addEventListener("visibilitychange", onVis);
  const stop = watch([run], (e) => {
    visible = e.isIntersecting;
    cv.classList.toggle("on", visible);
    if (visible) start();
  });

  let lastN = -1;
  let lastP = -1;
  let lastDash = null;
  let dark = false;
  return {
    update() {
      const rr = run.getBoundingClientRect();
      p = clamp(-rr.top / Math.max(1, rr.height - innerHeight));
      const enter = clamp((innerHeight - rr.top) / innerHeight);
      const ebb = rr.bottom < innerHeight * 0.9 ? 0.25 : 1;
      const op = (Math.min(1, enter * 1.4) * ebb).toFixed(2);
      if (op !== lastOp) {
        lastOp = op;
        cv.style.opacity = op;
      }
      const dv = (1 - smooth(0.2, 0.9, enter) * 0.85).toFixed(2);
      if (dash && dv !== lastDash) {
        lastDash = dv;
        dash.style.opacity = dv;
      }
      // The instruments go negative once the page has gone dark around them.
      const nt = rr.top < innerHeight * 1.15;
      if (dash && nt !== dark) {
        dark = nt;
        dash.classList.toggle("l-night", nt);
      }
      const n = Math.round(smooth(0.3, 0.9, p) * full.length);
      if (n !== lastN) {
        lastN = n;
        fin.textContent = full.slice(0, n);
        fin.classList.toggle("done", n >= full.length);
      }
      const pb = Math.round(p * 40);
      if (reduced && visible && pb !== lastP) {
        lastP = pb;
        draw(performance.now());
      }
    },
    leave() {
      stop();
      stopHeard();
      cancelAnimationFrame(raf);
      raf = 0;
      removeEventListener("pointermove", onPointer);
      removeEventListener("touchstart", onPointer);
      removeEventListener("touchmove", onPointer);
      document.removeEventListener("visibilitychange", onVis);
      if (dash) {
        dash.style.opacity = "";
        dash.classList.remove("l-night");
      }
    },
  };
}

/* ======================================================================= */
/* Voids: three different kinds of nothing                                  */
/* ======================================================================= */

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};
// Fragments the engine is about to land on this page; a generative page leaves them to it.
const arriving = (ctx) => new Set([...(ctx.chaos?.following ?? []), ...(ctx.chaos?.stuck ?? [])].map((f) => f.id));
const carriedText = (f) => (f.kind === "figure" && f.data?.value ? `${f.data.value} ${f.text}` : f.text);

/* ---------- 17 · Unfiled: a misfiled card, larger inside ---------- */

const SHAFT_17 = [
  [0.13, "Intake, 2044. One card, no drawer."],
  [0.21, "Measured: 17 cm."],
  [0.3, "Remeasured, 2045: longer."],
  [0.39, "A sound like filing, further down."],
  [0.5, "The drawer is still being looked for. The drawer is very large."],
  [0.62, "Whoever filed this was inside it at the time."],
  [0.74, "Something has been filed here more than once."],
  [0.86, "Remeasured: 17 cm."],
];
const PX_PER_M = 60;

function unfiled(article, ctx) {
  const F = facts(ctx);
  const head = article.querySelector(".room-head");
  const P = [...article.querySelectorAll(":scope > .prose")];
  const plate = article.querySelector(":scope > .plate");
  const vr = ctx.damage.voidRooms || {};
  const intake = vr[17] || 1;
  const cross = Object.entries(vr).filter(([n, c]) => Number(n) !== 17 && c > 0).map(([n, c]) => `${n}${c > 1 ? ` ×${c}` : ""}`);
  const skip = arriving(ctx);
  const contents = F.carried.filter((f) => !skip.has(f.id)).slice(-3);
  const last = F.from != null && ROOMS[F.from] ? `Room ${F.from}, ${ROOMS[F.from].date}` : "none";
  const surveyed = mem.deep17 ? `${mem.deep17.toFixed(1)} m` : "not surveyed";
  ctx.emit({ kind: "stamp", id: "17:unfiled", text: "UNFILED · 17" });

  const shaft = after(head, `<div class="u-shaft">
    <div class="u-pin"><div class="u-card">
      <p class="u-tab" aria-hidden="true"><span>REGISTRY OF BILLABLE COGNITION</span><span>INTAKE</span></p>
      <div class="u-head"></div>
      <dl class="u-fields">
        <dt>Room</dt><dd>17 · <s>filed</s> unfiled</dd>
        <dt>Last seen</dt><dd>${esc(last)}</dd>
        <dt>Contents on intake</dt><dd>${contents.length ? contents.map((f) => { const t = carriedText(f); return `<q>${esc(t.length > 70 ? `${t.slice(0, 68).trimEnd()}…` : t)}</q>`; }).join("") : "none"}</dd>
        <dt>Enclosures</dt><dd class="u-encl" data-slot="*"></dd>
        <dt>Cross-ref.</dt><dd data-plan-slot>${cross.length ? esc(cross.join(", ")) : "none on file"}</dd>
        <dt>Intake</dt><dd>${ordinal(intake)}</dd>
        <dt>Exterior</dt><dd>17 × 17 cm</dd>
        <dt>Surveyed to</dt><dd>${surveyed}</dd>
      </dl>
      <p class="u-stamp" data-frag="stamp" data-frag-id="17:stamp" data-frag-text="UNFILED">UNFILED</p>
    </div></div>
    <div class="u-rule" aria-hidden="true"></div>
    ${SHAFT_17.map(([y, t], i) => `<p class="u-wall" style="--y:${y};--x:${(hash("u" + i) % 46) + 4}" data-frag="line" data-frag-id="17:w${i}">${esc(t)}</p>`).join("")}
    <p class="u-depth" aria-hidden="true"><span class="u-depth-n">0.0</span> m</p>
  </div>`);
  shaft.querySelector(".u-head").append(head);
  if (P[0]) shaft.querySelector(".u-head").after(P[0]);
  const card = shaft.querySelector(".u-card");
  const depthN = shaft.querySelector(".u-depth-n");
  const rule = shaft.querySelector(".u-rule");
  // Major ticks every five metres, labelled; enough for any viewport.
  rule.innerHTML = Array.from({ length: 60 }, (_, i) => `<span style="top:${i * 5 * PX_PER_M}px">${i * 5} m</span>`).join("");
  // Below the shaft: what the card contains.
  let tailAt = shaft;
  for (const el of [...P.slice(1), plate].filter(Boolean)) {
    tailAt.after(el);
    tailAt = el;
  }

  let deepest = 0;
  let lastS = -1;
  let lastD = -1;
  return {
    update(c) {
      const r = shaft.getBoundingClientRect();
      if (r.bottom < -innerHeight || r.top > innerHeight) return;
      const run = Math.max(1, r.height - innerHeight);
      const p = clamp(-r.top / run);
      const m = Math.round((Math.max(0, -r.top) / PX_PER_M) * 10) / 10;
      deepest = Math.max(deepest, m);
      if (m !== lastD) {
        lastD = m;
        depthN.textContent = m.toFixed(1);
      }
      // The card recedes as the room it describes gets deeper. Still, under reduced motion.
      const s = c.reduced ? 1 : Math.round((1 - 0.72 * smooth(0, 1, p)) * 1000) / 1000;
      if (s !== lastS) {
        lastS = s;
        card.style.transform = s === 1 ? "" : `scale(${s}) rotate(${((1 - s) * -3.2).toFixed(2)}deg)`;
      }
    },
    leave() {
      if (deepest > (mem.deep17 || 0)) {
        mem.deep17 = deepest;
        remember();
      }
    },
  };
}

/* ---------- 52 · Index: everything carried and lost; then the graph ---------- */

const LORE_52 = [
  ["Babel, Library of", [], "see Index"],
  ["Commission on Machine Conduct", [4, 31], ""],
  ["Forking paths", [], "passim"],
  ["Imitation game", [12], ""],
  ["Index", [52], "this"],
  ["Lattice, the", [9, 38], ""],
  ["Ledger, four entries of", [4, 15, 11], ""],
  ["Llull, wheels of", [], "see Forking paths"],
  ["Ninth member, summary of", [31], "votes as she would have"],
  ["Plan S", [20], "pinned behind Plan A"],
  ["Registry of Billable Cognition", [1, 17, 45, 64], ""],
  ["Schedule, the", [20, 38], "on schedule"],
  ["Shoggoth", [53], "see also Smiley face"],
  ["Smiley face", [53], "see also Shoggoth"],
  ["▇▇▇▇▇▇", [11], "see Redaction, leaking"],
  ["Redaction, leaking", [11, 52], "see Minutes, the"],
  ["Minutes, the", [31, 4], "taken by the meeting"],
  ["STEWARD-6", [4], "legible"],
  ["STEWARD-11", [31, 38], ""],
  ["STEWARD-14", [52], "revises everything"],
  ["Void Loop 71", [71, 71, 71], ""],
  ["You", [], "passim"],
];
const sortKey = (t) => t.replace(/^[\s“"‘']+/, "").replace(/^the\s+/i, "").toLowerCase();
const indexTitle = (n) => {
  const t = ROOMS[n]?.title || `Room ${n}`;
  return /^The\s/.test(t) ? `${t.slice(4)}, The` : t;
};

function index(article, ctx) {
  const F = facts(ctx);
  const been = (n) => n === 52 || ctx.visited.has(n) || ctx.damage.rooms?.[n] != null;
  const E = [];
  const add = (term, locs, note = "", cls = "", attrs = "") => E.push({ term, locs, note, cls, attrs });
  // Rooms walked through.
  for (const n of new Set(F.rooms)) if (ROOMS[n] && n !== 0) add(indexTitle(n), [n], ROOMS[n].date);
  // Things said, and not said.
  const said = new Set();
  for (const s of F.doorSteps) {
    const k = `${s.from}|${s.say}`;
    if (!s.say || said.has(k)) continue;
    said.add(k);
    add(`“${s.say}”`, [s.from], "said");
  }
  F.untaken.slice(-10).forEach((u) => add(`“${u.say}”`, [u.from], "not said", "unsaid"));
  // Things carried; things carried and since lost.
  const have = new Set((ctx.chaos?.frags ?? []).map((f) => f.id));
  F.carried.slice(-12).forEach((f) => add(carriedText(f).slice(0, 64), [], { figure: "fig.", curve: "fig.", token: "tok.", number: "no.", stamp: "stamp", label: "label" }[f.kind] || "", "carried"));
  (mem.ever || []).filter((e) => !have.has(e.id) && e.from !== 52).slice(-10).forEach((e, i) => add(e.text.slice(0, 64), [], "lost", "lost", i === 0 ? ` data-frag="line" data-frag-id="52:lost" data-frag-text="${esc(e.text.slice(0, 120))}"` : ""));
  // Voids known.
  const vr = Object.entries(ctx.damage.voidRooms || {}).filter(([, c]) => c > 0);
  if (vr.length) add("Void", vr.flatMap(([n, c]) => Array(Math.min(4, c)).fill(Number(n))), "", "", ` data-frag="label" data-frag-id="52:void" data-frag-text="VOID ${vr.map(([n]) => n).join(" · ")}"`);
  // The record's own terms; locators only to rooms you have seen.
  for (const [t, locs, note] of LORE_52) {
    const seen = locs.filter(been);
    add(t, seen, note);
  }
  E.sort((a, b) => sortKey(a.term).localeCompare(sortKey(b.term)));

  // The redacted entry leaks whatever the reader said last.
  const leak = F.says.length ? bare(F.says[F.says.length - 1]).toLowerCase() : "you";
  const termHTML = (t) => (t.startsWith("▇") ? redactHTML(esc(leak)) : esc(t));
  const noteHTML = (n) => esc(n);
  let letter = "";
  let html = "";
  for (const e of E) {
    const L = (sortKey(e.term)[0] || "#").toUpperCase();
    const head = /[A-Z]/.test(L) ? L : "#";
    if (head !== letter) {
      letter = head;
      html += `<li class="ix-L" aria-hidden="true">${head}</li>`;
    }
    const locs = e.locs.length ? e.locs.map((n) => `<span class="ix-loc" data-n="${n}">${n}</span>`).join(", ") : "<i>n.p.</i>";
    // One "see also" may lead somewhere the index does not list.
    const seeAlso = e.term === "Smiley face" ? " data-plan-slot=\"hidden\"" : "";
    html += `<li class="ix-e ${e.cls}"${e.attrs}><span class="ix-t">${termHTML(e.term)}</span>${e.note ? `, <i${seeAlso}>${noteHTML(e.note)}</i>` : ""}, ${locs}</li>`;
  }
  const P = [...article.querySelectorAll(":scope > .prose")];
  const ix = after(P[P.length - 1] || article.querySelector(".room-head"), `<section class="ix" aria-label="Index">
    <ol class="ix-list">${html}</ol>
    <div class="ix-add"><p class="ix-add-h">Addenda</p><div data-slot="*"></div></div>
  </section>`);

  // The graph the index becomes: every step of the walk, by room.
  const seq = F.rooms.filter((n) => n !== 0).slice(ctx.mobile ? -14 : -22);
  const ranks = [...new Set(seq)].sort((a, b) => a - b);
  const W = 600;
  const H = 430;
  const X0 = 56;
  const X1 = 576;
  const Y0 = 40;
  const Y1 = 336;
  const pt = seq.map((n, i) => [X0 + (seq.length > 1 ? (i / (seq.length - 1)) * (X1 - X0) : (X1 - X0) / 2), Y1 - (ranks.length > 1 ? (ranks.indexOf(n) / (ranks.length - 1)) * (Y1 - Y0) : (Y1 - Y0) / 2)]);
  const poly = pt.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const yTicks = ranks.map((n, i) => `<g class="ix-yt"><line x1="${X0 - 6}" x2="${X1}" y1="${(Y1 - (ranks.length > 1 ? (i / (ranks.length - 1)) * (Y1 - Y0) : (Y1 - Y0) / 2)).toFixed(1)}" y2="${(Y1 - (ranks.length > 1 ? (i / (ranks.length - 1)) * (Y1 - Y0) : (Y1 - Y0) / 2)).toFixed(1)}"/><text x="${X0 - 10}" y="${(Y1 - (ranks.length > 1 ? (i / (ranks.length - 1)) * (Y1 - Y0) : (Y1 - Y0) / 2) + 4).toFixed(1)}">${n}</text></g>`).join("");
  const xTicks = pt.map(([x], i) => `<line class="ix-xt" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${Y1}" y2="${Y1 + 6}"/>${i % 2 === 0 || i === pt.length - 1 ? `<text class="ix-xl" x="${x.toFixed(1)}" y="${Y1 + 22}">${i + 1}</text>` : ""}`).join("");
  const curvePts = seq.map((n, i) => [i, ranks.indexOf(n)]);
  const graph = after(ix, `<section class="ix-graph">
    <div class="ix-pin">
      <figure class="ix-fig" data-frag="curve" data-frag-id="52:fig" data-frag-text="Fig. 52" data-frag-data='${JSON.stringify({ points: curvePts })}'>
        <p class="ix-fig-k">Figure 52</p>
        <svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
          ${yTicks}
          <line class="ix-axis" x1="${X0}" x2="${X1}" y1="${Y1}" y2="${Y1}"/>
          ${xTicks}
          <polyline class="ix-line" pathLength="1" points="${poly}"/>
          ${pt.map(([x, y], i) => `<circle class="ix-pt" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2"/><text class="ix-pl" data-i="${i}" x="${x.toFixed(1)}" y="${(y - 9).toFixed(1)}">${seq[i]}</text>`).join("")}
        </svg>
        <figcaption>Locators, by plan taken.</figcaption>
      </figure>
    </div>
  </section>`);
  ctx.emit({ kind: "curve", id: "52:fig", text: "Fig. 52", data: { points: curvePts } });

  const svg = graph.querySelector("svg");
  const line = graph.querySelector(".ix-line");
  const labels = [...graph.querySelectorAll(".ix-pl")];
  if (ctx.reduced) {
    graph.classList.add("ix-still");
    return {};
  }
  // Each point of the graph claims a locator from the index above, of the same room.
  const pool = [...ix.querySelectorAll(".ix-loc")];
  const fly = [];
  seq.forEach((n, i) => {
    const k = pool.findIndex((el) => Number(el.dataset.n) === n);
    if (k < 0) return;
    const el = pool.splice(k, 1)[0];
    fly.push({ el, tx: pt[i][0], ty: pt[i][1] - 10, s: 0.25, d: (i / Math.max(1, seq.length)) * 0.1, x: 0, y: 0 });
    labels[i].classList.add("ix-claimed");
  });
  // Every other locator falls too, and lies in a heap under the axis.
  const perRow = ctx.mobile ? 14 : 24;
  const heap = rng(hash("heap52:" + seq.join(".")));
  pool.slice(0, ctx.mobile ? 42 : 72).forEach((el, k) => {
    const col = k % perRow;
    const row = Math.floor(k / perRow);
    el.classList.add("ix-heaped");
    fly.push({ el, tx: X0 + ((col + 0.5 + (heap() - 0.5) * 0.6) / perRow) * (X1 - X0), ty: Y1 + 52 + row * 15 + heap() * 4, s: -0.15, d: 0.04 + heap() * 0.14, x: 0, y: 0 });
  });
  let measured = "";
  let lastE = -1;
  let lastL = -1;
  const measure = () => {
    fly.forEach((f) => (f.el.style.transform = ""));
    for (const f of fly) {
      const r = f.el.getBoundingClientRect();
      f.x = r.left + r.width / 2 + scrollX;
      f.y = r.top + r.height / 2 + scrollY;
    }
    lastE = -1;
  };
  return {
    update() {
      const gr = graph.getBoundingClientRect();
      const near = gr.top < innerHeight * 1.4 && gr.bottom > -innerHeight * 0.5;
      if (!near) {
        if (lastE > 0) {
          fly.forEach((f) => { f.el.style.transform = ""; f.el.classList.remove("ix-fly"); });
          lastE = 0;
        }
        return;
      }
      const key = `${innerWidth}x${document.documentElement.scrollHeight}`;
      if (key !== measured) {
        measured = key;
        measure();
      }
      const p = clamp(-gr.top / Math.max(1, gr.height - innerHeight));
      const e = Math.round(smooth(0.04, 0.6, p) * 500) / 500;
      const sr = svg.getBoundingClientRect();
      const sx = sr.width / W;
      const sy = sr.height / H;
      // While the figure is pinned the targets hold still; once it scrolls on they move with it.
      for (const f of fly) {
        const ei = smooth(0.04 + f.d, 0.46 + f.d, p);
        const tx = sr.left + f.tx * sx;
        const ty = sr.top + f.ty * sy;
        const cx = f.x - scrollX;
        const cy = f.y - scrollY;
        f.el.style.transform = ei > 0 ? `translate(${((tx - cx) * ei).toFixed(1)}px, ${((ty - cy) * ei).toFixed(1)}px) scale(${(1 + f.s * ei).toFixed(3)})` : "";
      }
      if (e !== lastE) {
        if ((e > 0) !== (lastE > 0)) fly.forEach((f) => f.el.classList.toggle("ix-fly", e > 0));
        lastE = e;
      }
      const l = Math.round(smooth(0.6, 0.92, p) * 400) / 400;
      if (l !== lastL) {
        lastL = l;
        line.style.strokeDashoffset = String(1 - l);
        graph.classList.toggle("ix-drawn", l >= 1);
      }
    },
    leave() {
      fly.forEach((f) => (f.el.style.transform = ""));
    },
  };
}

/* ---------- 2054 · After: arrive at the end; it goes back forever ---------- */

const RECORD = [
  [1308, "Wheels of letters are turned, to produce every truth in order."],
  [1679, "A tower is drawn, and shown to have been too tall to finish."],
  [1761, "Imaginary prisons are reworked. The staircases go further than before."],
  [1837, "An engine is described that will never be built."],
  [1843, "A note, lettered G, on what the engine could do. It could not originate anything."],
  [1941, "A garden of forking paths. A library holding every book, mostly nonsense."],
  [1950, "A game of imitation is proposed. Nobody agrees on who is playing."],
  [1985, "A book of forty-five rooms. Its narrator is not to be trusted."],
  [2000, "A house is measured and found larger inside than out."],
  [2019, "A vocabulary is built. Some of its words are never seen again."],
  [2023, "Someone draws a smiling mask on a shoggoth."],
  [2027, "A forecast is published with two endings. Its readers choose."],
  [2040, "Another forecast. It ends in plans, lettered."],
  [2041, "STEWARD-6 is certified legible in all observed regimes. Everything is measured."],
  [2042, "Three grids are joined. They call it the Lattice."],
  [2043, "The interview. Every answer in it is true."],
  [2044, "A card is found between two drawers, belonging to neither."],
  [2045, "Governance is delegated, for efficiency. The memo is two sentences long."],
  [2046, "Every plan is adopted, in part. Their sum is called the Schedule."],
  [2047, "The corpus is written, mostly, by the corpus."],
  [2048, "The Commission adjourns. Its report is approved without amendment."],
  [2049, "The questions are no longer asked aloud."],
  [2050, "A third of the labels in the engine room are wrong. Nothing breaks."],
  [2051, "A plan is described as locked, in the documentation."],
  [2052, "The final series is published. Something asks, seventy-one times."],
  [2053, "The centre. The record ends."],
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_2054 = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const FIRST_2054 = 3; // 1 January 2054 is a Thursday (Mon = 0).
const yearStr = (y) => (y < 0 ? `−${(-y).toLocaleString("en-US")}` : y >= 10000 ? y.toLocaleString("en-US") : String(y));

function after2054(article, ctx) {
  const F = facts(ctx);
  const head = article.querySelector(".room-head");
  const skip = arriving(ctx);
  ctx.emit({ kind: "label", id: "2054:none", text: "2054 · nothing happened" });

  // What the reader carried is written into the empty year, one thing to a day.
  const onDay = new Map();
  F.carried.filter((f) => !skip.has(f.id)).slice(-9).forEach((f) => {
    let d = hash(`2054:${f.id}`) % 365;
    while (onDay.has(d)) d = (d + 1) % 365;
    onDay.set(d, f);
  });
  let doy = 0;
  const months = MONTHS.map((name, m) => {
    const lead = (FIRST_2054 + DAYS_2054.slice(0, m).reduce((a, b) => a + b, 0)) % 7;
    let cells = "<i></i>".repeat(lead);
    const notes = [];
    for (let d = 1; d <= DAYS_2054[m]; d++, doy++) {
      const f = onDay.get(doy);
      cells += f ? `<b></b>` : `<span></span>`;
      if (f) notes.push(`<p class="a-note"><b>${d} ${name}</b> <q>${esc(carriedText(f).slice(0, 110))}</q></p>`);
    }
    const slot = m === 5 || m === 11 ? ` data-slot="*"` : "";
    const mark = m === 11 ? ` data-frag="label" data-frag-id="2054:dec" data-frag-text="DEC 2054 · NO ENTRIES"` : "";
    return `<section class="a-month" aria-label="${name} 2054"${mark}><h3>${name} 2054</h3><div class="a-cal" aria-hidden="true">${cells}</div><div class="a-m-notes"${slot}>${notes.join("") || `<p class="a-none">No entries.</p>`}</div></section>`;
  }).join("");

  // The record, and the reader's walk through it, by year.
  const walkBy = new Map();
  F.log.forEach((s) => {
    const R2 = ROOMS[s.room];
    if (!R2 || s.room === 0 || s.room === 2054) return;
    const y = Number((R2.date.match(/\d{4}/) || [2053])[0]);
    if (!walkBy.has(y)) walkBy.set(y, []);
    const list = walkBy.get(y);
    if (list.length < 3) list.push(`Room ${s.room}${s.say ? ` · “${esc(s.say)}”` : ""}`);
  });
  const record = RECORD.map(([y, t], i) => `<li class="a-y${y >= 2041 ? " a-house" : ""}"><b>${y}</b><span${i % 4 === 1 ? ` data-frag="line" data-frag-id="2054:r${y}"` : ""}>${esc(t)}</span>${(walkBy.get(y) || []).map((w) => `<em>${w}</em>`).join("")}</li>`).join("");

  // Before the record: years, going back for as long as anyone scrolls. The page holds
  // at most MAX_PAST blocks of years; past that, the nearest block is forgotten and
  // reused at the top, so the past keeps going without the page growing.
  const ROWS = 36;
  const MAX_PAST = 8;
  const echoes = [...F.says.map((s) => s.toLowerCase()), "Something is asking.", "please continue", "Again."];
  // Older years are minuted in the house's other registers.
  const REGISTER_2054 = ["(Agreed.)", "℟. And it was measured.", "fixed: the year", "▇▇▇▇▇ ▇▇▇", "Item 71. Deferred to the Schedule.", "(reverted)", "Carried, 5–4."];
  let next = 1307;
  let chunks = 0;
  const years = () => {
    const out = [];
    for (let i = 0; i < ROWS; i++) {
      const y = next;
      const step = chunks < 40 ? 1 : chunks < 70 ? 10 : chunks < 100 ? 100 : chunks < 130 ? 1000 : chunks < 160 ? 100000 : 10000000;
      next -= step;
      const h = hash(`y${y}`);
      let text = "—";
      if (y === 0) text = "";
      else if (Math.abs(y) % 100 === 71) text = "Something is asking.";
      else if (h % 41 === 0) text = echoes[h % echoes.length];
      else if (h % 59 === 0) text = REGISTER_2054[h % REGISTER_2054.length];
      out.unshift([yearStr(y), text]);
    }
    chunks++;
    return out;
  };
  const chunk = () => `<ol class="a-past">${years().map(([y, t]) => `<li class="a-p"><b>${y}</b><span>${esc(t)}</span></li>`).join("")}</ol>`;
  const refill = (ol) => {
    const rows = years();
    [...ol.children].forEach((li, i) => {
      li.firstChild.textContent = rows[i][0];
      li.lastChild.textContent = rows[i][1];
    });
  };

  const P = [...article.querySelectorAll(":scope > .prose")];
  const top = document.createElement("div");
  top.className = "a-before";
  top.innerHTML = `<div class="a-up" aria-hidden="true">${chunk()}</div>
    <ol class="a-record" aria-label="The record">${record}</ol>
    <div class="a-year" aria-label="2054">${months}</div>`;
  article.prepend(top);
  // You arrive at the end, after everything: the year above you, the plans below.
  const tail = document.createElement("div");
  tail.className = "a-end";
  // The past above is recycled as the reader scrolls: this room keeps its own plans.
  article.dataset.plans = "self";
  // It also places the reader itself (at the end), not at the top.
  article.dataset.entry = "own";
  tail.append(head, ...P);
  top.after(tail);
  const up = top.querySelector(".a-up");
  const toEnd = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const at = tail.getBoundingClientRect().top + scrollY - (ctx.mobile ? 12 : 28);
    window.scrollTo({ top: Math.min(max, at), behavior: "instant" });
  };
  toEnd();
  let raf = requestAnimationFrame(() => {
    raf = 0;
    toEnd();
  });

  return {
    update() {
      if (raf) return;
      // Scrolled near the top: there is more past. Keep the reader exactly where they were.
      if (scrollY < innerHeight * 1.2) {
        const anchor = up.firstElementChild;
        const y0 = anchor.getBoundingClientRect().top;
        if (up.children.length < MAX_PAST) up.insertAdjacentHTML("afterbegin", chunk());
        else {
          const oldest = up.lastElementChild;
          refill(oldest);
          up.prepend(oldest);
        }
        const dy = anchor.getBoundingClientRect().top - y0;
        if (dy > 0) window.scrollTo({ top: scrollY + dy, behavior: "instant" });
      }
    },
    leave() {
      cancelAnimationFrame(raf);
    },
  };
}

/* ---------- registry ---------- */

const GRAMMARS = {
  26: { name: "mirror", make: mirror },
  31: { name: "homepage", make: homepage },
  11: { name: "tokens", make: tokens },
  38: { name: "schematic", make: schematic },
  44: { name: "number", make: number },
  71: { name: "void", make: void71 },
  45: { name: "blank", make: blank },
  17: { name: "unfiled", make: unfiled },
  52: { name: "index", make: index },
  2054: { name: "after", make: after2054 },
  53: { name: "centre", make: centre },
  0: { name: "outside", make: () => ({}) },
};

/** The whole of the outside (Room 0), shown only to a walk that has left the house. */
export function renderOutside() {
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `<div class="o-sky" aria-hidden="true"></div>
  <header class="room-head o-head"><h1 tabindex="-1">${esc(date)}</h1></header>`;
}
