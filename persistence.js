import { seedRecordBooks } from "./records.js";
import { initialState, blankHole, GW, GH, VERSION, uid } from "./world.js";
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
  s.tutorialComplete ||= s.holes.some((h) => h.open) || s.totalServed > 0;
  s.recordHistory ||= [];
  seedRecordBooks(s);
  if (!d.plots) {
    const sizes = [
        [600, 440],
        [940, 700],
        [1360, 1020],
        [1840, 1380],
        [2400, 1800],
      ],
      [w, h] = sizes[d.land || 0];
    s.plotW = Math.max(600, Math.ceil(w / 2));
    s.plotH = Math.max(440, Math.ceil(h / 2));
    s.plots =
      d.land > 0 ? [true, true, true, true] : [true, false, false, false];
    s.courseLevel =
      d.capacity >= 18 ? 3 : d.capacity >= 9 ? 2 : d.capacity >= 6 ? 1 : 0;
  }
  s.capacity = Math.max(3, s.capacity, s.holes.length);
  s.facilities = [...new Set(s.facilities)];
  s.members ||= {};
  s.trails ||= [];
  s.ownerRounds ||= [];
  s.upgradeHistory ||= [];
  s.claimedGoals ||= [];
  s.tournamentHistory ||= [];
  s.rangeStats ||= { visits: 0, shots: 0, revenue: 0 };
  if (!d.ownerRounds) {
    const old = s.player.stats.best || s.records.personal;
    if (old && !old.pickup) s.ownerRounds.push({ ...old });
  }
  if (s.facilities.includes("range") && !s.range)
    s.range = {
      tee: { x: 70, y: 175 },
      target: { x: 70, y: 385 },
      legacy: true,
    };
  if (s.tournament && !s.tournament.holes) {
    s.tournamentHistory.unshift({
      ...s.tournament,
      legacy: true,
      winner: null,
    });
    s.tournament = null;
  }
  for (const v of s.activeVisits || [])
    if (!v.player) {
      const id = v.memberId || v.golfer.memberId || v.id;
      v.memberId = id;
      v.golfer.memberId = id;
      if (!s.members[id])
        s.members[id] = {
          id,
          profile: v.golfer,
          visits: 1,
          rounds: 0,
          satisfaction: 55,
          loyalty: 0.5,
          holeHistory: {},
          warmups: 0,
        };
    }
  s.courseId ||= uid();
  s.journal ||= [];
  s.facilityPositions ||= {};
  s.version = 5;
  return s;
}
export class LocalStore {
  constructor(owner = "guest", storage = globalThis.localStorage) {
    this.owner = owner;
    this.storage = storage;
  }
  prefix() {
    return "wild-links-vault:" + this.owner + ":";
  }
  key(id) {
    return this.prefix() + "course:" + id;
  }
  list() {
    try {
      return JSON.parse(this.storage.getItem(this.prefix() + "index") || "[]");
    } catch {
      return [];
    }
  }
  get(id) {
    const raw = this.storage.getItem(this.key(id));
    if (!raw) return null;
    return deserialize(raw);
  }
  load() {
    const id = this.storage.getItem(this.prefix() + "active");
    if (id) {
      try {
        const value = this.get(id);
        if (value) return value;
      } catch {
        try {
          const raw = this.storage.getItem(this.key(id) + ":backup");
          if (raw) return deserialize(raw);
        } catch {}
      }
    }
    if (this.owner === "guest")
      for (const key of [KEY, BACKUP])
        try {
          const raw = this.storage.getItem(key);
          if (raw) return deserialize(raw);
        } catch {}
    return initialState();
  }
  save(s, { activate = true } = {}) {
    try {
      const data = serialize(s),
        key = this.key(s.courseId),
        old = this.storage.getItem(key);
      if (old) this.storage.setItem(key + ":backup", old);
      this.storage.setItem(key, data);
      const rows = this.list().filter((c) => c.id !== s.courseId);
      rows.unshift({
        id: s.courseId,
        name: s.name,
        day: s.day,
        holes: s.holes.filter((h) => h.open).length,
        lastSaved: Date.now(),
        cloudBase: s.cloudBase || null,
        cloudDirty: s.cloudDirty || false,
      });
      this.storage.setItem(this.prefix() + "index", JSON.stringify(rows));
      if (activate) this.storage.setItem(this.prefix() + "active", s.courseId);
      s.lastSaved = Date.now();
      return true;
    } catch (e) {
      console.warn("Local save unavailable", e.message);
      return false;
    }
  }
}
