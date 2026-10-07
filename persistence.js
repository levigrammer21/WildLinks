import { initialState, blankHole, GW, GH, VERSION } from "./world.js";
const KEY = "wild-links-save",
  BACKUP = "wild-links-backup";
const pack = (a) => {
  let out = [],
    last = a[0],
    count = 0;
  for (const v of a) {
    if (v === last) count++;
    else {
      out.push(count, last);
      last = v;
      count = 1;
    }
  }
  out.push(count, last);
  return out;
};
const unpack = (a, Type) => {
  let out = new Type(GW * GH),
    at = 0;
  for (let i = 0; i < a.length; i += 2) {
    out.fill(a[i + 1], at, at + a[i]);
    at += a[i];
  }
  return out;
};
export function serialize(s) {
  return JSON.stringify({
    ...s,
    terrain: pack(s.terrain),
    heights: pack(Array.from(s.heights, (v) => Math.round(v * 100) / 100)),
    encoding: "rle",
    appVersion: VERSION,
    lastSaved: Date.now(),
  });
}
export function deserialize(raw) {
  let d = JSON.parse(raw);
  if (!d || !Array.isArray(d.holes) || !d.terrain || !Number.isFinite(d.cash))
    throw Error("This file is not a Wild Links save.");
  let s = initialState();
  Object.assign(s, d);
  s.terrain =
    d.encoding === "rle"
      ? unpack(d.terrain, Uint8Array)
      : Uint8Array.from(d.terrain);
  s.heights =
    d.encoding === "rle"
      ? unpack(d.heights || [GW * GH, 0], Float32Array)
      : Float32Array.from(d.heights || new Float32Array(GW * GH));
  if (s.terrain.length !== GW * GH || s.heights.length !== GW * GH)
    throw Error("Invalid course dimensions.");
  s.player = {
    ...initialState().player,
    ...d.player,
    stats: { ...initialState().player.stats, ...d.player?.stats },
  };
  s.staff = { ...initialState().staff, ...d.staff };
  s.records = { ...initialState().records, ...d.records };
  s.holes = s.holes.map((h, i) => ({
    ...blankHole(i + 1),
    ...h,
    stats: { ...blankHole(i + 1).stats, ...h.stats },
  }));
  s.recordHistory ||= [];
  s.version = 3;
  return s;
}
export class LocalStore {
  load() {
    for (const key of [KEY, BACKUP]) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) return deserialize(raw);
      } catch (e) {
        console.warn("Save recovery", e);
      }
    }
    return initialState();
  }
  save(s) {
    try {
      const data = serialize(s),
        old = localStorage.getItem(KEY);
      if (old) localStorage.setItem(BACKUP, old);
      localStorage.setItem(KEY, data);
      s.lastSaved = Date.now();
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
}
