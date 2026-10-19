// Plates: jmill's maze images re-engraved as pen-and-ink line screens.
// Line width swells with darkness (one, two, three hatch layers), contours come
// from a Sobel pass, and a hidden clue is drawn by turning the hatch 90° inside
// its letterforms, the way MAZE hides numbers in its drawings. As the house
// frays the engraved lines loosen independently of one another.
// The pixels are engraved in plate-worker.js (engrave-core.js) from small
// grayscale derivatives in /media/eng/, cached per room and descent, and the
// plates behind a room's doors are analysed in idle time before you open them.
import { hash, rng } from "./voice.js";

export const PLATE_ASPECT = 3 / 4; // height / width
const MAX_W = 1280;
const DERIV = "/media/eng/";

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Device-pixel size a plate will be engraved at, for a box `cssW` wide. */
function geometry(cssW) {
  const css = Math.max(240, cssW);
  const W = Math.min(MAX_W, Math.round(css * Math.min(2, window.devicePixelRatio || 1)));
  return { W, H: Math.round(W * PLATE_ASPECT), dpr: W / css };
}

/** The derivative to engrave from: the small one unless the plate is large on screen. */
export const plateUrl = (src, W) => `${DERIV}${src.replace(/\.[a-z]+$/i, "")}-${W > 900 ? 1024 : 640}.webp`;

const job = (plate, g) => ({
  url: plateUrl(plate.src, g.W), crop: plate.crop, mirror: !!plate.mirror, W: g.W, H: g.H, dpr: g.dpr,
  screen: plate.screen, angle: plate.angle, period: plate.period, ringCentre: plate.ringCentre,
});

// One worker for the whole house; a main-thread fallback where workers can't draw.
let worker;
let seq = 0;
const waiting = new Map();
function getWorker() {
  if (worker !== undefined) return worker;
  worker = null;
  try {
    if (typeof OffscreenCanvas !== "undefined" && new OffscreenCanvas(1, 1).getContext("2d")) {
      worker = new Worker(new URL("./plate-worker.js", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }) => {
        const w = waiting.get(data.id);
        if (!w) return;
        waiting.delete(data.id);
        if (data.error) w.reject(new Error(data.error));
        else w.resolve(data.dropped ? null : data.bitmap);
      };
    }
  } catch {
    worker = null;
  }
  return worker;
}

// Each plate canvas is a slot; the worker only draws for the newest one.
const slots = new WeakMap();
let slotSeq = 0;

/** → ImageBitmap, or null if a newer request superseded this one. */
async function run(canvas, j) {
  const w = getWorker();
  if (!w) return (await import("./engrave-core.js")).engraveJob(j);
  if (!slots.has(canvas)) slots.set(canvas, ++slotSeq);
  const id = ++seq;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    w.postMessage({ type: "engrave", id, slot: slots.get(canvas), job: j }, [j.mask.buffer]);
  });
}

const jitters = new Map();
function jitterFor(plate) {
  const seed = hash(plate.src + plate.crop.join());
  if (!jitters.has(seed)) {
    const r = rng(seed);
    const a = new Float32Array(4096);
    for (let i = 0; i < a.length; i++) a[i] = r() * 6.283;
    jitters.set(seed, a);
  }
  return jitters.get(seed);
}

function clueMask(plate, W, H, text) {
  const mask = new Uint8Array(W * H);
  const clue = plate.clue;
  if (!clue || !text) return mask;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.translate(clue.x * W, clue.y * H);
  if (clue.rot) g.rotate((clue.rot * Math.PI) / 180);
  if (clue.flip) g.scale(-1, 1);
  g.font = `700 ${Math.round(clue.size * H)}px "ET Book", Georgia, serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#fff";
  g.fillText(text, 0, 0);
  const px = g.getImageData(0, 0, W, H).data;
  for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4] > 127 ? 1 : 0;
  return mask;
}

// Finished engravings, so returning to a room (Back) is instant. Small LRU.
const done = new Map();
function remember(key, bmp) {
  done.set(key, bmp);
  while (done.size > 8) {
    const k = done.keys().next().value;
    done.get(k).close?.();
    done.delete(k);
  }
}

/**
 * Engrave `plate` into `canvas` at descent `d`.
 * opts: { clueText, room }. Sets canvas.dataset.ready = "1" once drawn.
 */
export async function engrave(canvas, plate, d, opts = {}) {
  const token = (canvas.plateSeq = (canvas.plateSeq || 0) + 1);
  const g = geometry(canvas.clientWidth || canvas.parentElement.clientWidth || 600);
  const dq = Math.round(d * 20) / 20;
  const text = opts.clueText ?? plate.clue?.text;
  const key = `${opts.room}|${plate.src}|${plate.crop.join()}|${g.W}|${dq}|${text}`;
  let bmp = done.get(key);
  if (bmp) {
    done.delete(key);
    done.set(key, bmp);
  } else {
    if (document.fonts?.load) await document.fonts.load('700 48px "ET Book"').catch(() => {});
    bmp = await run(canvas, { ...job(plate, g), d: dq, mask: clueMask(plate, g.W, g.H, text), jitter: jitterFor(plate) });
    if (!bmp) return; // superseded by a newer request; that one draws
    remember(key, bmp);
  }
  if (!canvas.isConnected || canvas.plateSeq !== token) return;
  canvas.width = g.W;
  canvas.height = g.H;
  canvas.getContext("2d").drawImage(bmp, 0, 0);
  canvas.dataset.ready = "1";
}

/** Fetch, decode and analyse plates ahead of need (the rooms behind the doors). */
export function warmPlates(plates, cssW) {
  const w = getWorker();
  if (!w) return;
  const g = geometry(cssW);
  for (const p of plates) if (p) w.postMessage({ type: "warm", job: job(p, g) });
}

/**
 * The plate's engraved frame and its door plaques, as SVG (viewBox 400×300).
 * Plaques hang from nails by two wires; as the house frays one wire lets go,
 * the plaque swings, and at the end it lies on the floor of the plate.
 */
export function overlay(roomNo, doors, d, opts = {}) {
  const fray = smooth(0.36, 0.86, d);
  const r = rng(hash("plaques" + roomNo));
  const n = doors.length;
  const labels = doors.map((x) => x.to);
  // Drift: the plate's numbering stops agreeing with the doors.
  if (d >= 0.3 && n > 1) [labels[0], labels[1]] = [labels[1], labels[0]];
  let plaques = "";
  doors.forEach((_, i) => {
    const x = 400 * ((i + 1) / (n + 1));
    const y = 24;
    const dir = r() < 0.5 ? -1 : 1;
    const loose = fray > 0.25 && r() < 0.75;
    const fallen = d >= 0.88;
    const rot = fallen ? dir * (70 + r() * 30) : loose ? dir * (8 + 34 * smooth(0.25, 1, fray)) : dir * 1.5 * fray;
    const drop = fallen ? 240 - y : loose ? 10 * fray : 0;
    const sway = loose && !fallen && !opts.reduced ? ` class="sway" style="animation-duration:${(4 + r() * 3).toFixed(2)}s;animation-delay:-${(r() * 3).toFixed(2)}s"` : "";
    const wireL = loose ? "" : `<line x1="0" y1="0" x2="-13" y2="14"/>`;
    plaques += `<g transform="translate(${x.toFixed(1)} ${(y + drop).toFixed(1)})">
      <circle r="1.6" class="nail"/>
      <g transform="rotate(${rot.toFixed(1)})"><g${sway}>
        ${wireL}<line x1="0" y1="0" x2="13" y2="14"/>
        <rect x="-15" y="14" width="30" height="19" rx="1.5" class="plaque"/>
        <text x="0" y="28.5" text-anchor="middle" class="plaque-n">${labels[i]}</text>
      </g></g>
    </g>`;
  });

  // Frame: outer rule stays; inner rule sags at the bottom and lets go at one corner.
  const sag = (8 + 18 * fray) * fray;
  const hang = 30 * smooth(0.5, 1, fray);
  const inner = fray < 0.02
    ? `<rect x="9" y="9" width="382" height="282" class="frame-in"/>`
    : `<path class="frame-in" d="M9 ${9 + hang} L9 291 Q200 ${291 + sag} 391 291 L391 9 L${60 + hang * 2} 9"/>
       <path class="frame-in loose" d="M9 ${9 + hang} q ${-4 * fray} ${10 * fray} ${2 * fray} ${18 * fray}"/>`;
  const numBox = `<g transform="translate(358 262)"><rect width="30" height="26" class="plate-box-n"/><text x="15" y="19" text-anchor="middle" class="plate-n">${roomNo}</text></g>`;
  return `<rect x="3" y="3" width="394" height="294" class="frame-out"/>${inner}${plaques}${numBox}`;
}
