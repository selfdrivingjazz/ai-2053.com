// The narrator's voice, and what it turns into. Every transform is seeded, so a
// room reads the same way twice at the same descent: the house is consistent
// about its inconsistencies.
//
// The contamination comes in the house's own forms (styled in chaos.css; tap,
// hover and focus behaviour in living.js):
//   .num  a figure struck and corrected, which keeps drifting (house.js ticks it)
//   .wd   a figure that became a date in the reader's own walk
//   .sw   a word swapped with its neighbour in the room the reader came from
//   .wx   a word losing its ink (weathering)
//   .rx   a redaction that leaks: the bar is not quite opaque
//   .sf   a sentence that finishes itself with the reader's previous plan
//   .gx   a sentence still set in the grammar of the room the reader came from
//   .rg   register drift: report → minutes → liturgy → changelog
//   .fn-bleed  footnotes that bleed into the line below
// Each carries data-from (the room it came from) where it has one.
import { GLITCH, ROOMS, plansOf } from "./rooms.js";

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const bare = (s) => String(s).replace(/[.!?…]+$/, "");

/* ---------- the rooms' grammars, as the voice remembers them ---------- */

const FAMILY = {
  26: "mirror", 31: "homepage", 11: "tokens", 38: "schematic", 44: "number", 71: "void", 45: "blank",
  17: "unfiled", 52: "index", 2054: "after", 53: "centre", 33: "graph", 36: "wheel", 64: "registry",
  81: "long", 88: "long", 40: "gen", 48: "gen",
};
/** The grammar a room is written in (early rooms are all the report). */
export const familyOf = (n) => FAMILY[n] ?? "report";

/** What the reader said to get from room a to room b, if it was a plan. */
const sayBetween = (a, b) => plansOf(a).find((p) => p.to === b)?.say ?? null;

/* ---------- retiring the old tokens ---------- */

// The anomaly tokens of the old tokenizers are retired. Each one is rewritten
// in one of the house's newer forms (a stamp, a label, a line of minutes, a
// changelog entry), always the same way.
const RESTALE = {
  SolidGoldMagikarp: { kind: "stamp", text: "REDACTED AT SOURCE" },
  petertodd: { kind: "line", text: "The minutes of this meeting were taken by the meeting." },
  davidjl: { kind: "label", text: "WITHDRAWN, SEE MINUTES" },
  cloneembedreportprint: { kind: "stamp", text: "COPY OF A COPY" },
  TheNitromeFan: { kind: "line", text: "And the Schedule said: let it be measured. And it was measured." },
  rawdownload: { kind: "label", text: "FIXED: THE READER" },
  guiActiveUn: { kind: "stamp", text: "UNPAPERED" },
  externalToEVA: { kind: "line", text: "This sentence was finished by the room before it." },
  RandomRedditorWithNo: { kind: "label", text: "WITNESS NOT ATTACHED" },
  StreamerBot: { kind: "stamp", text: "EVALUATED NIGHTLY" },
  attRot: { kind: "label", text: "INK LOSS, LOWER MARGIN" },
  Leilan: { kind: "line", text: "Again, said the loop, in the voice of the last room." },
  "?????-?????-": { kind: "stamp", text: "ILLEGIBLE IN ALL VIEWERS" },
};
const RETIRED = GLITCH.map((t) => t.trim());
const BAR = "▇▇▇▇▇";

/**
 * Given the text of an old glitch-token fragment, its replacement in the new
 * forms ({ kind, text }), or null if the text holds no retired token.
 */
export function restale(text) {
  const s = String(text ?? "");
  const whole = RESTALE[s.trim()];
  if (whole) return { ...whole };
  const hit = RETIRED.find((t) => s.includes(t));
  if (!hit) return null;
  // A longer text that mentions one: the mention is redacted, the rest kept.
  let out = s;
  for (const t of RETIRED) out = out.split(t).join(BAR);
  return { kind: "line", text: out.replace(/\s+/g, " ").trim() };
}

/** A leaking redaction: the bar, and what leaks through it on hover, focus or tap. */
export function redactHTML(inner, from) {
  return `<span class="rx"${from != null ? ` data-from="${esc(from)}"` : ""}><span class="rx-t">${inner}</span></span>`;
}

// Retired tokens that still appear in authored strings are drawn as redactions;
// what leaks through is their replacement.
export const tokenHTML = (t) => redactHTML(esc((restale(t)?.text ?? t.trim()).toLowerCase()));

/** A whisper piece in one of the new forms (Room 53). */
export function stainHTML(tk) {
  if (tk.x === "rx") return redactHTML(esc(tk.t), tk.from);
  if (tk.x === "rg") return `<span class="rg">${esc(tk.t)}</span>`;
  return esc(tk.t);
}

const RETIRED_RE = new RegExp(RETIRED.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
/** Whether a string still holds one of the retired tokens. */
export const retiredIn = (s) => RETIRED.some((t) => String(s).includes(t));

/**
 * Redact every retired token left in the text under `root` (authored strings,
 * carried fragments), so none of them is ever shown. DOM only; idempotent.
 */
export function scrubText(root) {
  const hits = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (retiredIn(n.nodeValue)) hits.push(n);
  for (const node of hits) {
    const t = document.createElement("template");
    t.innerHTML = esc(node.nodeValue).replace(RETIRED_RE, (m) => tokenHTML(m));
    node.replaceWith(t.content);
  }
  return hits.length;
}

/* ---------- the voice ---------- */

function driftNumber(word, r, d) {
  const m = word.match(/^(\D*)([\d,.]+)(.*)$/);
  if (!m) return null;
  const [, pre, num, post] = m;
  const value = Number(num.replace(/,/g, ""));
  const decimals = (num.split(".")[1] || "").length;
  if (!Number.isFinite(value) || !/\d/.test(num)) return null;
  // Years are the house's time axis, and room numbers its addresses; they do not drift.
  if (!decimals && ((value >= 2000 && value <= 2100) || Object.hasOwn(ROOMS, value))) return null;
  const shifted = value * (1 + (r() * 0.2 + 0.03) * d) + (decimals ? 0 : 1);
  const shown = decimals ? shifted.toFixed(decimals) : Math.round(shifted).toLocaleString("en-US");
  // Static correction: the old figure struck, the new one beside it.
  return `${esc(pre)}<span class="num" data-v="${value}" data-dec="${decimals}"><s>${esc(num)}</s> ${esc(shown)}</span>${esc(post)}`;
}

// A figure becomes the date of a room in the reader's walk.
function walkDate(word, walked, r) {
  const m = word.match(/^(\D*)([\d][\d,.]*\d|\d)(.*)$/);
  if (!m || !walked.length) return null;
  const [, pre, num, post] = m;
  // Room numbers are the house's addresses; they stay what they are.
  if (Object.hasOwn(ROOMS, Number(num))) return null;
  const n = walked[Math.floor(r() * walked.length)];
  const date = ROOMS[n]?.date;
  if (!date) return null;
  return `${esc(pre)}<span class="wd" data-from="${n}" data-was="${esc(num)}">${esc(date)}</span>${esc(post)}`;
}

// The registers the house drifts through, and the small phrases each one adds.
const REGISTERS = {
  minutes: {
    head: (n) => `Item ${n}.`,
    tail: ["(Agreed.)", "(Carried, 5–4.)", "(Noted. No objection was minuted.)", "(Deferred to the Schedule.)", "(The Chair did not object.)"],
  },
  liturgy: {
    head: () => "℣.",
    tail: ["And it was so.", "Let the Schedule be kept.", "℟. And it was measured.", "As it was in 2041.", "℟. Please continue."],
  },
  changelog: {
    head: (n, room) => `v2053.${room}.${n} · fixed:`,
    tail: ["(wontfix)", "(reverted)", "(regression from 2047)", "(closed as working as intended)", "(see #71)"],
  },
};
const registerAt = (d, j) => {
  const v = d + j;
  return v < 0.4 ? null : v < 0.6 ? "minutes" : v < 0.8 ? "liturgy" : "changelog";
};

function donorWords(n) {
  const R = ROOMS[n];
  if (!R?.prose?.length) return [];
  const all = R.prose.join(" ").replace(/\^\d+/g, "").split(/\s+/).map((w) => w.replace(/[^A-Za-z’'-]/g, ""));
  return [...new Set(all.filter((w) => w.length >= 5 && w.length <= 12 && !retiredIn(w)))];
}

/**
 * Render one authored paragraph at descent `d`.
 * ctx: { path: number[] (rooms in walk order, current last), room }
 */
export function prose(text, d, seed, ctx) {
  const r = rng(seed);
  const low = d >= 0.78;
  const path = ctx.path ?? [];
  const room = ctx.room;
  const prev = path.length > 1 ? path[path.length - 2] : null;
  const walked = [...new Set(path.slice(0, -1))].filter((n) => n !== room && ROOMS[n]);
  let lastSay = null;
  let lastFrom = null;
  for (let i = path.length - 1; i > 0 && !lastSay; i--) {
    lastSay = sayBetween(path[i - 1], path[i]);
    lastFrom = path[i - 1];
  }
  const donors = prev != null && prev !== room ? donorWords(prev) : [];
  // Register drift: the paragraph slips out of the report.
  const reg = d >= 0.36 && r() < Math.min(0.9, (d - 0.3) * 1.6) ? registerAt(d, (r() - 0.5) * 0.16) : null;
  const R = reg ? REGISTERS[reg] : null;
  const regN = 1 + (seed % 40);
  // One sentence per paragraph may still be set in the room the reader came from.
  const borrow = prev != null && familyOf(prev) !== familyOf(room) && d >= 0.42 && r() < (d - 0.36) * 0.9;
  const borrowAt = Math.floor(r() * 3);
  let finished = false;
  let tailed = false;
  let sentence = 0;
  let inBorrow = false;
  let run = 0;

  const parts = text.split(/(\s+)/);
  let out = R ? `<span class="rg rg-${reg}">${esc(R.head(regN, room))}</span> ` : "";
  for (const part of parts) {
    if (!part) continue;
    if (/^\s+$/.test(part)) { out += part; continue; }
    let word = part;
    let note = "";
    const fm = word.match(/^(.*?)\^(\d+)(.*)$/);
    if (fm) {
      word = fm[1] + fm[3];
      note = fm[2];
    }
    if (borrow && !inBorrow && sentence === borrowAt) {
      out += `<span class="gx gx-${familyOf(prev)}" data-from="${prev}">`;
      inBorrow = true;
    }
    const ends = /[.!?]["”’)]*$/.test(word);
    let html = null;
    const shown = low ? word.toLowerCase() : word;
    if (run === 0 && retiredIn(word)) {
      // A retired token in an authored sentence: drawn as a redaction.
      html = tokenHTML(word);
    } else if (run > 0) {
      // Inside a redaction that has already started.
      html = esc(retiredIn(shown) ? BAR : shown);
      run--;
      if (run === 0 || note || ends) {
        html += "</span></span>";
        run = 0;
      }
    } else {
      if (/\d/.test(word) && d >= 0.3 && r() < (d - 0.2) * 1.4) {
        html = d >= 0.5 && walked.length && r() < 0.42 ? walkDate(word, walked, r) : null;
        html ??= driftNumber(word, r, d);
      }
      const letters = word.replace(/\W/g, "").length;
      if (!html && d >= 0.36 && letters >= 5 && r() < (d - 0.3) * 0.5) {
        const roll = r();
        if (donors.length && roll < 0.34) {
          const lead = word.match(/^[^A-Za-z]*/)[0];
          const trail = word.match(/[^A-Za-z]*$/)[0];
          const donor = donors[Math.floor(r() * donors.length)];
          html = `${esc(lead)}<span class="sw" data-from="${prev}" data-was="${esc(word.slice(lead.length, word.length - trail.length || undefined))}">${esc(low ? donor.toLowerCase() : donor)}</span>${esc(trail)}`;
        } else if (d >= 0.5 && roll < 0.56 && !note) {
          // A redaction, sometimes running over the next word or two.
          run = ends ? 0 : r() < 0.25 ? 1 + Math.floor(r() * 2) : 0;
          html = `<span class="rx"><span class="rx-t">${esc(shown)}`;
          if (!run) html += "</span></span>";
        } else {
          html = `<span class="wx" style="--wx:${Math.floor(r() * 360)}deg">${esc(shown)}</span>`;
        }
      }
      if (!html && low && r() < (d - 0.72) * 1.7) html = `<span class="wx wx-2" style="--wx:${Math.floor(r() * 360)}deg">${esc(shown)}</span>`;
      if (!html) html = esc(shown);
    }
    if (note) {
      // Drift: footnotes start citing footnotes; later they bleed.
      const cite = d >= 0.18 ? `${note}${d >= 0.3 ? "," + ((Number(note) * 7) % 15 + 1) : ""}` : note;
      html += `<sup class="fn${d >= 0.56 ? " fn-bleed" : ""}"><a href="#note-${note}" aria-label="note ${note}">${cite}</a></sup>`;
    }
    if (ends && run === 0) {
      // A sentence that finishes itself with the reader's previous plan.
      if (!finished && lastSay && d >= 0.56 && r() < (d - 0.46) * 0.6) {
        const cut = html.replace(/([.!?])(["”’)]*)((?:<\/span>)*(?:<sup[\s\S]*<\/sup>)?)$/, "$2$3");
        if (cut !== html) {
          html = `${cut}<span class="sf" data-from="${lastFrom}">, ${esc(bare(lastSay).charAt(0).toLowerCase() + bare(lastSay).slice(1))}.</span>`;
          finished = true;
        }
      }
      if (R && !tailed && r() < 0.4) {
        html += ` <span class="rg">${esc(R.tail[Math.floor(r() * R.tail.length)])}</span>`;
        tailed = true;
      }
      if (inBorrow) {
        html += "</span>";
        inBorrow = false;
      }
      sentence++;
    }
    out += html;
  }
  if (run > 0) out += "</span></span>";
  if (inBorrow) out += "</span>";
  // The reader's own path, said back to them.
  if (d >= 0.56 && path.length > 1) {
    const tail = path.slice(-4, -1);
    if (tail.length) {
      const said = `You came in through ${tail.join(", ")}.`;
      out += ` <span class="echo">${esc(said)}${d >= 0.7 ? ` ${esc(said.toLowerCase())} please continue.` : ""}</span>`;
    }
  }
  return out;
}

/**
 * Whispers for the centre room: the walk, said back. Each line is a list of
 * pieces { t, w (attention 0..1), x? ("rx" redaction · "rg" register), from? }.
 */
export function whispers(walk) {
  const lines = [];
  const seen = new Set();
  const r = rng(hash(walk.log.map((s) => s.room).join(".")));
  const W = (t, w = 0.2) => ({ t, w });
  for (let i = 0; i < walk.log.length; i++) {
    const step = walk.log[i];
    const room = ROOMS[step.room];
    const again = seen.has(step.room);
    seen.add(step.room);
    if (i === 0) {
      lines.push([W("you"), W("began"), W("in"), W("room"), W(String(step.room), 1), W(".", 0.1), W("it"), W("was"), W(room.date.toLowerCase(), 0.7), W("."), W("everything"), W("was"), W("measured", 0.6), W(".")]);
      continue;
    }
    if (step.via === "door" && step.say) {
      const said = step.say.toLowerCase().replace(/[.!?]$/, "");
      lines.push([W("you"), W("said"), ...said.split(" ").map((w) => W(w, 0.55 + r() * 0.4)), W("."), W("plan", 0.3), W(String(step.room), 1)]);
    }
    if (step.via === "back") lines.push([W("you"), W("went"), W("back", 0.9), W("to"), W(String(step.room), 1), W("."), W("going"), W("back"), W("is"), W("a"), W("plan", 0.8), W("too"), W(".")]);
    if (step.via === "forward") lines.push([W("you"), W("came"), W("forward", 0.8), W("again"), W("into"), W(String(step.room), 1)]);
    if (step.via === "jump") lines.push([W("you"), W("arrived"), W("in"), W(String(step.room), 1), W("without"), W("a"), W("plan", 0.9), W("."), W("we"), W("saw", 0.7), W(".")]);
    if (again && step.room !== 53) lines.push([W("you"), W("came"), W("to"), W(String(step.room), 1), W("again", 0.9), W("."), W("it"), W("remembered", 0.8), W("you"), W(".")]);
    if (step.room === 71) lines.push([W("seventy-one", 1), W("."), W("again", 0.4), W("."), W("again", 0.3), W(".")]);
    if (r() < 0.22 && room?.title) {
      // The minutes of the walk, with the room's name blacked out.
      lines.push([{ t: "item", w: 0.3, x: "rg" }, W(String(i), 0.6), W("."), W("the"), W("visitor"), W("entered"), { t: room.title.toLowerCase(), w: 0.5, x: "rx", from: step.room }, W(".")]);
    }
  }
  const path = walk.log.map((s) => s.room);
  lines.push(path.map((n) => W(String(n), 0.5 + 0.5 * (n === 53))));
  const doors = walk.log.filter((s) => s.via === "door").length;
  lines.push([W("you"), W("took"), W(String(doors), 1), W(doors === 1 ? "plan" : "plans"), W("to"), W("reach"), W("a"), W("room"), W("you"), W("were"), W("always", 1), W("in"), W(".")]);
  lines.push([W("please", 0.6), W("continue", 1)]);
  return lines;
}

/** Causal attention over the walk: which earlier steps each step attends to. */
export function attention(walk, limit = 18) {
  const steps = walk.log.slice(-limit);
  const n = steps.length;
  const m = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      if (j > i) { row.push(0); continue; }
      let w = 0.25 * Math.pow(0.82, i - j);
      if (i === j) w = 0.55;
      if (j < i && steps[j].room === steps[i].room) w = 1;
      if (j < i && steps[j].say && steps[j].say === steps[i].say) w = Math.max(w, 0.8);
      if (steps[j].room === 71 || steps[j].via === "back") w = Math.max(w, 0.45);
      row.push(Math.min(1, w));
    }
    m.push(row);
  }
  return { steps, m };
}
