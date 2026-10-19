// The ledger: pure readings of a walk's log, shared by the house and by
// offline route checks (node can import this file directly).

export function fnv(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The steps taken since the reader last stood in Room 1, ending with the latest. */
export function sinceVestibule(log) {
  let i = log.length - 2;
  while (i >= 0 && log[i].room !== 1) i--;
  return i < 0 ? null : log.slice(i + 1);
}

const SEAL = 1449063008;

/** Whether the latest step settles the ledger. */
export function settled(log) {
  const seg = sinceVestibule(log);
  if (!seg || seg.some((s) => s.via !== "door")) return false;
  const shape = seg.map((s) => (s.room === 53 ? "c" : s.room === 71 ? "v" : s.room === 1 ? "s" : "x")).join("");
  return fnv(`${seg.length}|${shape}`) === SEAL;
}
