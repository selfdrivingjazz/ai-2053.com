// Plate engraving worker: keeps the per-pixel work off the main thread.
//   { type: "engrave", id, slot, job } → { id, bitmap, ms } | { id, dropped } | { id, error }
//   { type: "warm", job }              fetch, decode and analyse ahead of need
// Jobs are queued, not run in arrival order: only the newest plate on screen
// (the latest `slot`) is engraved, its newest request first; requests for plates
// that have left the screen are dropped; warming happens only when idle.
import { analyse, engraveJob } from "./engrave-core.js";

let queue = [];
let warm = [];
let latestSlot = 0;
let busy = false;
// Yield to let newer messages arrive before choosing a job. A MessageChannel
// task, not setTimeout: chained timers in background pages are throttled hard.
const tick = new MessageChannel();
tick.port1.onmessage = () => step();

function pump() {
  if (busy) return;
  busy = true;
  tick.port2.postMessage(0);
}

async function step() {
  const stale = queue.filter((m) => m.slot !== latestSlot);
  for (const m of stale) self.postMessage({ id: m.id, dropped: true });
  queue = queue.filter((m) => m.slot === latestSlot);
  // Several requests for the same plate: only the newest descent is worth drawing.
  const next = queue.pop();
  for (const m of queue) self.postMessage({ id: m.id, dropped: true });
  queue = [];
  try {
    if (next) {
      const t0 = performance.now();
      try {
        const bitmap = await engraveJob(next.job);
        self.postMessage({ id: next.id, bitmap, ms: Math.round(performance.now() - t0) }, [bitmap]);
      } catch (err) {
        self.postMessage({ id: next.id, error: String(err?.message || err) });
      }
    } else if (warm.length) {
      await analyse(warm.shift()).catch(() => {});
    }
  } finally {
    busy = false;
    if (queue.length || warm.length) pump();
  }
}

self.onmessage = ({ data }) => {
  if (data.type === "warm") {
    warm.push(data.job);
    if (warm.length > 6) warm = warm.slice(-6);
  } else {
    latestSlot = Math.max(latestSlot, data.slot);
    queue.push(data);
  }
  pump();
};
