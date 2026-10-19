// The path map. At rest it is an AI-2040 "Choose a Path" tree of the rooms you
// have visited: rounded boxes, orthogonal thin rules, the current route drawn
// thick. As descent rises, rumoured rooms appear, untaken doors are drawn in,
// connectors sag and let go of their anchors, labels slide off their boxes,
// and the tree rolls itself up into a labyrinth whose centre is 2053.
import { ROOMS, LEVELS, DIST, MAX_DIST, CENTRE, RUMOURS } from "./rooms.js";
import { hash, rng } from "./voice.js";

export const VW = 360;
export const VH = 470;
const CX = VW / 2;
const CY = 248;
const NODE_W = 42;
const NODE_H = 30;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const f = (n) => n.toFixed(1);
const yearOf = (n) => (ROOMS[n]?.date.match(/\d{4}/) || [""])[0];

function radialPos(n) {
  const L = DIST[n];
  const ring = LEVELS[L];
  const i = ring.indexOf(n);
  const R = (MAX_DIST - L) * 31;
  const a = -Math.PI / 2 + (i / ring.length) * Math.PI * 2 + L * 0.65;
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
}

function treePos(n, shown) {
  const L = DIST[n];
  const row = LEVELS[L].filter((m) => shown.has(m));
  const i = row.indexOf(n);
  const gap = Math.min(84, (VW - 56) / Math.max(1, row.length));
  return [CX + (i - (row.length - 1) / 2) * gap, 34 + L * 80];
}

/**
 * model: { visited:Set<number>, taken:Set<"a>b">, trail:number[], current, d,
 *          voids:number, prior:number[]|null, walkRooms:number[], reduced:boolean }
 * `d` is the map's own damage (never lower than it has been); `voids` counts
 * entries into void rooms, `voidRooms` per void. All only grow, so the map never un-mangles.
 */
export function renderMap(svg, model) {
  const { visited, taken, trail, current, d, prior, walkRooms, reduced } = model;
  const voids = model.voids || 0;
  // Each void the reader has been through, with how often.
  const voidRooms = Object.entries(model.voidRooms || (voids ? { 71: voids } : {}))
    .map(([n, c]) => [Number(n), c])
    .filter(([n, c]) => c > 0 && DIST[n] !== undefined)
    .sort((a, b) => a[0] - b[0]);
  const rumourOn = d >= 0.22;
  const untakenOn = smooth(0.3, 0.5, d);
  const fray = smooth(0.38, 0.88, d);
  const slide = smooth(0.48, 0.92, d);
  const roll = smooth(0.62, 0.96, d);
  const whisper = smooth(0.82, 1, d);

  // Which rooms are on the map.
  const shown = new Set(visited);
  const rumoured = new Set();
  if (rumourOn) {
    for (const n of visited) for (const { to } of ROOMS[n]?.doors ?? []) if (!shown.has(to)) rumoured.add(to);
    for (const n of rumoured) shown.add(n);
  }
  if (prior) for (const n of prior) if (ROOMS[n] && DIST[n] !== undefined && !shown.has(n)) { shown.add(n); rumoured.add(n); }
  for (const n of [...shown]) if (DIST[n] === undefined) shown.delete(n);

  const pos = new Map();
  for (const n of shown) {
    const [tx, ty] = treePos(n, shown);
    const [rx, ry] = radialPos(n);
    pos.set(n, [lerp(tx, rx, roll), lerp(ty, ry, roll)]);
  }
  // A void drags the house toward itself: every room is twisted around it and
  // pulled in, a little more each time you go in.
  const vortices = [];
  for (const [v, c] of voidRooms) {
    const vw = Math.min(1, c * 0.38);
    const centre = pos.get(v) ?? radialPos(v);
    vortices.push({ v, c, centre });
    for (const n of shown) {
      if (n === v) continue;
      const [x, y] = pos.get(n);
      const r = rng(hash(`void${v}:${n}`));
      const dx = x - centre[0], dy = y - centre[1];
      const dist = Math.hypot(dx, dy);
      const a = vw * (0.55 + r() * 0.7) * Math.max(0.25, 1 - dist / 420) * (r() < 0.5 ? -1 : 1);
      const pull = 1 - (0.14 + 0.1 * r()) * vw;
      const ca = Math.cos(a), sa = Math.sin(a);
      pos.set(n, [centre[0] + (dx * ca - dy * sa) * pull, centre[1] + (dx * sa + dy * ca) * pull]);
    }
  }
  // While it is still a tree the map is only as tall as the rooms you know of;
  // as it rolls into a labyrinth it takes the full square.
  let treeBottom = 0;
  for (const n of shown) treeBottom = Math.max(treeBottom, treePos(n, shown)[1]);
  const treeH = Math.max(160, treeBottom + 76);
  svg.setAttribute("viewBox", `0 0 ${VW} ${f(lerp(treeH, VH, roll))}`);

  const trailEdges = new Set();
  for (let i = 1; i < trail.length; i++) trailEdges.add(`${trail[i - 1]}>${trail[i]}`);

  let walls = "";
  if (roll > 0.01) {
    const wr = rng(97);
    for (let L = 0; L < MAX_DIST; L++) {
      const R = (MAX_DIST - L) * 31 - 15.5;
      const circ = 2 * Math.PI * R;
      const gapA = 9 + wr() * 8;
      const segA = circ * (0.3 + wr() * 0.25);
      const segB = circ - segA - 2 * gapA;
      const rot = wr() * 360;
      walls += `<circle cx="${CX}" cy="${CY}" r="${f(R)}" class="wall" stroke-dasharray="${f(segA)} ${f(gapA)} ${f(Math.max(0, segB))} ${f(gapA)}" transform="rotate(${f(rot)} ${CX} ${CY})"/>`;
      // A few radial walls between rings, so the rings read as a maze.
      for (let k = 0; L > 0 && k < 3; k++) {
        const a = wr() * Math.PI * 2;
        const r2 = R + 31;
        walls += `<line class="wall" x1="${f(CX + R * Math.cos(a))}" y1="${f(CY + R * Math.sin(a))}" x2="${f(CX + r2 * Math.cos(a))}" y2="${f(CY + r2 * Math.sin(a))}"/>`;
      }
    }
    walls = `<g class="walls" opacity="${f(roll * 0.85)}">${walls}</g>`;
  }

  // Edges.
  let edges = "";
  const edge = (a, b, kind) => {
    const [ax, ay] = pos.get(a);
    const [bx, by] = pos.get(b);
    const h = hash(`${a}>${b}`);
    const r = rng(h);
    const forward = DIST[b] > DIST[a] && roll < 0.5;
    let sx = ax, sy = ay + NODE_H / 2, ex = bx, ey = by - NODE_H / 2;
    let path;
    if (a === b) {
      // Self-loop (71 → 71): a hanging ring, one more for every time you went round.
      const s = 1 + fray * 0.8;
      let rings = "";
      for (let k = 0; k < Math.max(1, Math.min(voids, 5)); k++) {
        const g = s * (1 + k * 0.32);
        rings += `M${f(ax + 12)} ${f(ay + NODE_H / 2)} c ${f(14 * g)} ${f(16 * g)} ${f(-38 * g)} ${f(16 * g)} ${f(-24)} 0 `;
      }
      return `<path class="e ${kind}" d="${rings}"/>`;
    }
    if (roll >= 0.5) {
      sx = ax; sy = ay; ex = bx; ey = by;
    } else if (!forward) {
      sx = ax + (bx >= ax ? NODE_W / 2 : -NODE_W / 2);
      sy = ay;
      ex = bx + (bx >= ax ? -NODE_W / 2 : NODE_W / 2);
      ey = by;
      if (Math.abs(bx - ax) < 4) { sx = ax + NODE_W / 2; ex = bx + NODE_W / 2; }
    }
    const detachable = (h % 3 === 0 || kind === "untaken") && fray > 0.3;
    const amt = detachable ? smooth(0.3, 1, fray) : 0;
    const dir = r() < 0.5 ? -1 : 1;
    if (amt > 0) {
      // The far end lets go and falls.
      ex += dir * 14 * amt;
      ey += 30 * amt + (r() * 16 - 4) * amt;
    }
    const len = Math.hypot(ex - sx, ey - sy);
    const sagY = fray * (10 + len * 0.22) * (1 - 0.55 * roll);
    const bow = dir * fray * (6 + len * 0.12) * (1 - 0.5 * roll);
    if (fray < 0.04 && forward && roll < 0.04) {
      const ym = (sy + ey) / 2;
      path = `M${f(sx)} ${f(sy)} V${f(ym)} H${f(ex)} V${f(ey)}`;
    } else if (!forward && roll < 0.5) {
      const out = 26 + Math.abs(DIST[a] - DIST[b]) * 10 + fray * 10;
      const side = sx >= ax ? 1 : -1;
      path = `M${f(sx)} ${f(sy)} C${f(sx + side * out)} ${f(sy + sagY)} ${f(ex + side * out * 0.6)} ${f(ey + sagY)} ${f(ex)} ${f(ey)}`;
    } else {
      const mx = (sx + ex) / 2 + bow;
      const my = (sy + ey) / 2 + sagY;
      path = `M${f(sx)} ${f(sy)} Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}`;
    }
    let tail = "";
    if (amt > 0.15) {
      // Frayed strands at the loose end.
      for (let k = -1; k <= 1; k++) {
        tail += ` M${f(ex)} ${f(ey)} l${f(k * 3 * amt + dir)} ${f(5 * amt + r() * 2)}`;
      }
    }
    const swing = amt > 0 && !reduced
      ? ` class="sway" style="transform-origin:${f(sx)}px ${f(sy)}px;animation-duration:${(5 + r() * 4).toFixed(2)}s;animation-delay:-${(r() * 4).toFixed(2)}s"`
      : "";
    return `<g${swing}><path class="e ${kind}" d="${path}${tail}"/></g>`;
  };

  // Untaken doors between rooms on the map.
  if (untakenOn > 0) {
    let un = "";
    for (const a of shown) {
      if (!ROOMS[a]) continue;
      for (const { to } of ROOMS[a].doors) {
        if (!shown.has(to) || taken.has(`${a}>${to}`)) continue;
        if (!visited.has(a) && d < 0.9) continue;
        un += edge(a, to, "untaken");
      }
    }
    edges += `<g opacity="${f((0.25 + 0.55 * untakenOn) * (1 - 0.45 * roll))}">${un}</g>`;
  }
  // Doors you took.
  let took = "";
  for (const key of taken) {
    const [a, b] = key.split(">").map(Number);
    if (!pos.has(a) || !pos.has(b)) continue;
    took += edge(a, b, trailEdges.has(key) ? "trail" : "taken");
  }
  edges += `<g opacity="${f(1 - 0.6 * roll)}">${took}</g>`;
  // A faint ghost of a previous walk, remembered from another visit.
  let ghost = "";
  if (prior && prior.length > 1) {
    const pts = prior.filter((n) => pos.has(n)).map((n) => pos.get(n).map(f).join(" "));
    ghost = `<polyline class="ghostpath" points="${pts.join(" ")}"/>`;
  }
  // Once the tree has rolled into a labyrinth, your whole walk (backtracks
  // included) is laid through it as a single red thread.
  let thread = "";
  if (roll > 0.05 && walkRooms && walkRooms.length > 1) {
    const pts = walkRooms.filter((n) => pos.has(n)).map((n) => pos.get(n));
    let dpath = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      dpath += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
    }
    thread = `<path class="thread" d="${dpath}" opacity="${f(roll)}"/>`;
  }

  // Rumours that are not rooms at all.
  let fakes = "";
  if (d >= 0.56) {
    const fr = rng(53);
    const op = smooth(0.56, 0.75, d);
    for (const { label } of RUMOURS) {
      const tx = 30 + fr() * (VW - 60);
      const ty = 70 + fr() * 330;
      const a = fr() * Math.PI * 2;
      const [x, y] = [lerp(tx, CX + 172 * Math.cos(a), roll), lerp(ty, CY + 172 * Math.sin(a), roll)];
      const near = [...shown][Math.floor(fr() * shown.size)];
      const [nx, ny] = pos.get(near);
      fakes += `<g class="fake" opacity="${f(op * (1 - whisper * 0.5))}">
        <path class="e untaken" d="M${f(x)} ${f(y)} Q${f((x + nx) / 2)} ${f((y + ny) / 2 + 30)} ${f(lerp(x, nx, 0.7))} ${f(lerp(y, ny, 0.7) + 18)}"/>
        <circle cx="${f(x)}" cy="${f(y)}" r="13" class="node-fake"/>
        <text x="${f(x)}" y="${f(y + 4)}" text-anchor="middle" class="n-fake">${label}</text>
      </g>`;
    }
  }

  // Nodes.
  let nodes = "";
  const trailSet = new Set(trail);
  const rx = 4 + roll * 11;
  for (const n of shown) {
    const [x, y] = pos.get(n);
    const r = rng(hash("label" + n));
    const isRumour = rumoured.has(n);
    const cls = ["node"];
    if (isRumour) cls.push("rumour");
    if (trailSet.has(n)) cls.push("on-trail");
    if (n === current) cls.push("current");
    if (n === CENTRE && visited.has(n)) cls.push("centre");
    const slideAmt = slide * (0.35 + r() * 0.65);
    const dx = (r() < 0.5 ? -1 : 1) * (8 + r() * 22) * slideAmt;
    const dy = (4 + r() * 26) * slideAmt;
    const rot = (r() * 24 - 12) * slideAmt;
    // After the voids, some rooms forget their own numbers and answer to the void they know best.
    const topVoid = voidRooms.reduce((a, b) => (b[1] > a[1] ? b : a), [71, 0])[0];
    const voided = voids >= 2 && n !== topVoid && hash(`v${n}`) % 7 < Math.min(4, voids - 1);
    const label = voided ? String(topVoid) : isRumour ? (d >= 0.45 ? `${n}?` : "?") : String(n);
    if (voided) cls.push("voided");
    const yr = isRumour ? "" : yearOf(n);
    const leader = slideAmt > 0.45
      ? `<path class="leader" d="M0 ${NODE_H / 2} Q${f(dx * 0.3)} ${f(NODE_H / 2 + dy * 0.9)} ${f(dx)} ${f(dy + 4)}"/>`
      : "";
    const w = NODE_W * (1 - 0.3 * roll);
    const hgt = NODE_H * (1 - 0.25 * roll);
    nodes += `<g class="${cls.join(" ")}" transform="translate(${f(x)} ${f(y)})">
      <rect x="${f(-w / 2)}" y="${f(-hgt / 2)}" width="${f(w)}" height="${f(hgt)}" rx="${f(Math.min(rx, hgt / 2))}"/>
      ${leader}
      <g transform="translate(${f(dx)} ${f(dy)}) rotate(${f(rot)})">
        <text y="${yr ? 2 : 5}" text-anchor="middle" class="n"${voided ? ' style="fill:#b4121b"' : ""}>${label}</text>
        ${yr ? `<text y="11" text-anchor="middle" class="yr">${yr}</text>` : ""}
      </g>
    </g>`;
  }

  // The scar a void leaves: a spiral wound around it, one turn per visit. It never heals.
  let scarPath = "";
  for (const { v, c, centre } of vortices) {
    const turns = Math.min(6, c) + 0.5;
    const r = rng(hash(`scar${v}`));
    const dir = r() < 0.5 ? -1 : 1;
    let p = "";
    for (let k = 0; k <= turns * 32; k++) {
      const t = k / 32;
      const ang = dir * t * Math.PI * 2 + r() * 0.001;
      const rr = 4 + t * (12 + 3 * Math.min(c, 6));
      p += `${k ? "L" : "M"}${f(centre[0] + rr * Math.cos(ang))} ${f(centre[1] + rr * Math.sin(ang))} `;
    }
    scarPath += `<path class="void-scar" d="${p}" style="fill:none;stroke:#b4121b;stroke-width:0.9;stroke-dasharray:${c > 2 ? "none" : "3 2"};opacity:${f(0.35 + 0.1 * Math.min(5, c))}"/>`;
  }
  svg.innerHTML = `${walls}${ghost}${scarPath}<g class="edges">${edges}</g>${thread}${fakes}<g class="nodes">${nodes}</g>`;
  svg.classList.toggle("voided", voids > 0);
  svg.style.setProperty("--whisper", f(whisper));
}
