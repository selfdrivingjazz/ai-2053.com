// The House of 2053: the graph. Rooms are dated states of the world; plans are
// the decisions between them (`doors` in the data, PLAN on the page).
// Room content lives in rooms-early.js, rooms-late.js and rooms-deep.js.
// Authored fiction: every institution and model named is invented.
//
// Prose syntax: `^n` after a word attaches footnote n (numbered across the house).
// Plate crops are fractions of the source image: [x, y, w, h]. `plate: null`
// means the room has no plate. `void: true` marks a void room.
import { EARLY } from "./rooms-early.js";
import { LATE } from "./rooms-late.js";
import { DEEP } from "./rooms-deep.js";
import { LONG } from "./rooms-long.js";
import { GEN } from "./rooms-gen.js";
import { SCROLL } from "./rooms-scroll.js";
import { SPATIAL } from "./rooms-spatial.js";

export const START = 1;
export const CENTRE = 53;
export const OUTSIDE = 0;

export const ROOMS = { ...EARLY, ...SCROLL, ...LATE, ...DEEP, ...LONG, ...GEN, ...SPATIAL };
// The report register (rendered by early.js; the column draws them as the early report).
export const EARLY_ROOMS = new Set([...Object.keys(EARLY), ...Object.keys(SCROLL)].map(Number));
export const SCROLL_ROOMS = new Set(Object.keys(SCROLL).map(Number));
export const SPATIAL_ROOMS = new Set(Object.keys(SPATIAL).map(Number));
export const LATE_ROOMS = new Set(Object.keys(LATE).map(Number));
export const DEEP_ROOMS = new Set(Object.keys(DEEP).map(Number));
export const LONG_ROOMS = new Set(Object.keys(LONG).map(Number));
export const GEN_ROOMS = new Set(Object.keys(GEN).map(Number));

// Hidden plans (owner): real edges of the graph that no plan list shows. living.js
// surfaces them inside the page (in text, figures, debris) or not at all.
export const HIDDEN = {
  3: [{ to: 8, say: "Sources: the filing." }],
  20: [{ to: 40, say: "The unpinned plan." }],
  26: [{ to: 88, say: "The reflection's room." }],
  33: [{ to: 88, say: "Off the curve." }],
  36: [{ to: 48, say: "The thirty-seventh chord." }],
  52: [{ to: 81, say: "See also." }],
  64: [{ to: 48, say: "File elsewhere." }],
  71: [{ to: 81, say: "Ask longer." }],
};

/** Every plan that leaves room `n`: its listed plans, then its hidden ones. */
export const plansOf = (n) => [...(ROOMS[n]?.doors ?? []), ...(HIDDEN[n] ?? [])];
export const VOIDS = new Set(Object.keys(ROOMS).map(Number).filter((n) => ROOMS[n].void));

// Rooms the map rumours about once the house starts to fray. They have no plans.
export const RUMOURS = [
  { n: 0, label: "0" },
  { n: 2055, label: "2055" },
];

export const GLITCH = [
  " SolidGoldMagikarp", " petertodd", " davidjl", "cloneembedreportprint",
  " TheNitromeFan", "rawdownload", "guiActiveUn", " externalToEVA",
  " RandomRedditorWithNo", "StreamerBot", " attRot", " Leilan", "?????-?????-",
];

// Distance (in plans) from Room 1, by breadth-first search over the real graph.
export const DIST = (() => {
  const dist = { [START]: 0 };
  const queue = [START];
  while (queue.length) {
    const r = queue.shift();
    for (const { to } of plansOf(r)) {
      if (!(to in dist)) { dist[to] = dist[r] + 1; queue.push(to); }
    }
  }
  return dist;
})();

export const MAX_DIST = Math.max(...Object.values(DIST));

// Rooms grouped by distance, in a fixed order, for the path map's layout.
// Rooms with no way in (the outside) are not on the map.
export const LEVELS = (() => {
  const levels = [];
  for (const n of Object.keys(ROOMS).map(Number)) {
    if (DIST[n] === undefined) continue;
    (levels[DIST[n]] ??= []).push(n);
  }
  // Fixed left-to-right order chosen so the clean tree has few crossings.
  const order = [1, 3, 4, 5, 14, 9, 8, 6, 12, 10, 13, 7, 16, 15, 2, 18, 20, 19, 29, 40, 21, 33, 26, 31, 11, 36, 17, 88, 38, 44, 64, 52, 71, 39, 45, 48, 81, 70, 53, 2054];
  return levels.map((l) => l.sort((a, b) => order.indexOf(a) - order.indexOf(b)));
})();

export const ROOM_COUNT = Object.keys(ROOMS).length;
