// Plate engraving core, shared by plate-worker.js (normal path) and plate.js's
// main-thread fallback. The expensive, descent-independent part (decode, crop,
// luminance, blur, levels, contour gradient) is computed once per
// image/crop/size and cached; each request only runs the line-screen pass.
//
// Job fields: url, crop [x,y,w,h], mirror, W, H, dpr, d, screen, angle, period,
// ringCentre, mask (Uint8Array W*H, 1 = inside the clue), jitter (Float32Array 4096).

const PAPER = [255, 255, 248];
const INK = [17, 17, 17];
const RED = [180, 18, 27];
const ASPECT = 3 / 4;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const canvasFor = (W, H) => {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(W, H);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return c;
};

const bitmaps = new Map(); // url → Promise<ImageBitmap>
export function load(url) {
  if (!bitmaps.has(url)) {
    const p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`plate image ${r.status}: ${url}`);
        return r.blob();
      })
      .then((b) => createImageBitmap(b));
    p.catch(() => bitmaps.delete(url));
    bitmaps.set(url, p);
  }
  return bitmaps.get(url);
}

const analyses = new Map(); // key → { tone, edge } as bytes; small LRU
export async function analyse(m) {
  const key = `${m.url}|${m.crop.join()}|${m.mirror ? 1 : 0}|${m.W}x${m.H}|${m.dpr}`;
  if (analyses.has(key)) {
    const a = analyses.get(key);
    analyses.delete(key);
    analyses.set(key, a);
    return a;
  }
  const img = await load(m.url);
  const { W, H } = m;
  const [cx, cy, cw, ch] = m.crop;
  let sw = cw * img.width;
  let sh = ch * img.height;
  if (sh / sw > ASPECT) sh = sw * ASPECT;
  else sw = sh / ASPECT;
  const sx = cx * img.width + (cw * img.width - sw) / 2;
  const sy = cy * img.height + (ch * img.height - sh) / 2;
  const g = canvasFor(W, H).getContext("2d", { willReadFrequently: true });
  g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  const pix = g.getImageData(0, 0, W, H).data;

  const N = W * H;
  const lum = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const xs = m.mirror && x >= W / 2 ? W - 1 - x : x;
      lum[y * W + x] = pix[(y * W + xs) * 4] / 255; // derivatives are grayscale
    }
  }
  const blur = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const o = y * W + x;
      blur[o] = (lum[o - W - 1] + lum[o - W] + lum[o - W + 1] + lum[o - 1] + lum[o] + lum[o + 1] + lum[o + W - 1] + lum[o + W] + lum[o + W + 1]) / 9;
    }
  }
  const hist = new Uint32Array(256);
  for (let i = 0; i < N; i++) hist[Math.min(255, (lum[i] * 255) | 0)]++;
  let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > N * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > N * 0.02) { hi = v; break; } }
  const range = Math.max(0.08, (hi - lo) / 255);
  const low = lo / 255;
  // Tone (0 paper … 255 ink) and contour strength, both independent of descent.
  const tone = new Uint8ClampedArray(N);
  const edge = new Uint8ClampedArray(N);
  const edgeScale = 1 / range / Math.max(1, m.dpr * 0.75);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      let t = 1 - (lum[o] - low) / range;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      tone[o] = Math.pow(t, 1.15) * 255;
      if (x > 1 && y > 1 && x < W - 2 && y < H - 2) {
        const gx = blur[o - W + 1] + 2 * blur[o + 1] + blur[o + W + 1] - blur[o - W - 1] - 2 * blur[o - 1] - blur[o + W - 1];
        const gy = blur[o + W - 1] + 2 * blur[o + W] + blur[o + W + 1] - blur[o - W - 1] - 2 * blur[o - W] - blur[o - W + 1];
        edge[o] = smooth(0.32, 0.75, Math.hypot(gx, gy) * edgeScale) * 255;
      }
    }
  }
  const a = { tone, edge };
  analyses.set(key, a);
  while (analyses.size > 5) analyses.delete(analyses.keys().next().value);
  return a;
}

/** The line-screen pass for one descent value. Returns ImageData. */
export function screenPass(m, { tone, edge }) {
  const { W, H, dpr, d, mask, jitter } = m;
  const fray = smooth(0.32, 0.92, d);
  const P = (m.period ?? 4.6) * dpr;
  const a1 = ((m.angle ?? 35) * Math.PI) / 180;
  const screen = m.screen ?? "lines";
  const a2 = a1 + (screen === "cross" ? Math.PI / 2 : (70 * Math.PI) / 180);
  const a3 = a1 + (screen === "cross" ? Math.PI / 4 : (-50 * Math.PI) / 180);
  const c1 = Math.cos(a1), s1 = Math.sin(a1);
  const c2 = Math.cos(a2), s2 = Math.sin(a2);
  const c3 = Math.cos(a3), s3 = Math.sin(a3);
  const cq = Math.cos(a1 + Math.PI / 2), sq = Math.sin(a1 + Math.PI / 2);
  const [rcx, rcy] = (m.ringCentre ?? [0.5, 0.5]).map((v, k) => v * (k ? H : W));
  const wobbleAmp = fray * 0.55;
  const wobbleLen = P * (9 + 10 * (1 - fray));
  const edgeKeep = ((1 - 0.65 * fray) * 0.85) / 255;
  const clueBoost = 0.1 + 0.3 * d;
  const clueRed = d >= 0.78;

  const line = (ph, s) => {
    if (s <= 0) return 0;
    const f = ph - Math.floor(ph);
    const dist = f < 0.5 ? f : 1 - f;
    const v = (s * 0.5 - dist) * P + 0.5;
    return v <= 0 ? 0 : v >= 1 ? 1 : v;
  };
  const wob = (ph, u) => (wobbleAmp <= 0 ? ph : ph + wobbleAmp * Math.sin(u / wobbleLen + jitter[Math.floor(ph) & 4095]));

  const out = new ImageData(W, H);
  const o8 = out.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      let t = tone[o] / 255;
      const inClue = mask[o] === 1;
      if (inClue) t = Math.min(1, Math.max(t, 0.38) + clueBoost);
      let cov;
      if (screen === "rings") {
        const r = Math.hypot(x - rcx, y - rcy);
        const ph = inClue ? (x * c1 + y * s1) / P : r / P;
        cov = line(wob(ph, Math.atan2(y - rcy, x - rcx) * r), t * 0.95);
      } else {
        const ca = inClue ? cq : c1, sa = inClue ? sq : s1;
        cov = line(wob((x * ca + y * sa) / P, -x * sa + y * ca), t * 0.9);
      }
      if (t > 0.48) cov = Math.max(cov, line(wob((x * c2 + y * s2) / P, -x * s2 + y * c2), (t - 0.48) * 1.1));
      if (t > 0.78) cov = Math.max(cov, line(wob((x * c3 + y * s3) / P, -x * s3 + y * c3), (t - 0.78) * 1.6));
      const e = edge[o] * edgeKeep;
      if (e > cov) cov = e;
      const ink = inClue && clueRed ? RED : INK;
      const i4 = o * 4;
      o8[i4] = PAPER[0] + (ink[0] - PAPER[0]) * cov;
      o8[i4 + 1] = PAPER[1] + (ink[1] - PAPER[1]) * cov;
      o8[i4 + 2] = PAPER[2] + (ink[2] - PAPER[2]) * cov;
      o8[i4 + 3] = 255;
    }
  }
  return out;
}

/** One complete engraving job → ImageBitmap. */
export async function engraveJob(m) {
  const a = await analyse(m);
  return createImageBitmap(screenPass(m, a));
}
