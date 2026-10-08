import { uid, dist, terrainAt, T, ownedAt, clamp } from "./world.js";
import { facilityPosition } from "./facilities.js";
export const DECORATIONS = [
  { id: "bench", name: "Park bench", cost: 90, upkeep: 1, radius: 12 },
  { id: "planter", name: "Flower planter", cost: 75, upkeep: 1, radius: 10 },
  { id: "rock", name: "Landscape rocks", cost: 50, upkeep: 0, radius: 12 },
  {
    id: "fountain",
    name: "Courtyard fountain",
    cost: 280,
    upkeep: 2,
    radius: 18,
  },
  { id: "sign", name: "Course sign", cost: 60, upkeep: 0, radius: 10 },
  { id: "arch", name: "Garden arch", cost: 220, upkeep: 1, radius: 14 },
  { id: "bridge", name: "Wooden footbridge", cost: 350, upkeep: 2, radius: 44 },
  {
    id: "stand",
    name: "Viewing stand · 12 seats",
    cost: 900,
    upkeep: 6,
    radius: 28,
  },
];
const first = [
    "Casey",
    "Rowan",
    "Avery",
    "Morgan",
    "Taylor",
    "Sam",
    "Alex",
    "Jordan",
    "Jamie",
    "Harper",
    "Cameron",
    "Drew",
  ],
  last = [
    "Reed",
    "Brooks",
    "Ellis",
    "Hayes",
    "Bennett",
    "Shaw",
    "Parker",
    "Lewis",
    "Cruz",
    "Stone",
    "Price",
    "Lane",
  ];
export function personName(n) {
  return (
    first[n % first.length] +
    " " +
    last[(Math.floor(n / first.length) + n * 5) % last.length]
  );
}
export function validateDecoration(s, d) {
  const f = DECORATIONS.find((f) => f.id === d.type);
  if (!f) throw Error("Choose a decoration.");
  if (d.type !== "bridge" && terrainAt(s, d) === T.WATER)
    throw Error("Place this on dry ground.");
  const a = ((d.angle || 0) * Math.PI) / 180;
  const halfX = d.type === "bridge" ? 42 : d.type === "stand" ? 24 : f.radius,
    halfY = d.type === "bridge" ? 9 : d.type === "stand" ? 17 : f.radius;
  for (const x of [-halfX, halfX])
    for (const y of [-halfY, halfY]) {
      const p = {
        x: d.x + x * Math.cos(a) - y * Math.sin(a),
        y: d.y + x * Math.sin(a) + y * Math.cos(a),
      };
      if (!ownedAt(s, p))
        throw Error("Keep the whole decoration on your land.");
      if (d.type !== "bridge" && terrainAt(s, p) === T.WATER)
        throw Error("Place this on dry ground.");
    }
  if (
    (s.decorations || []).some(
      (o) =>
        o.id !== d.id &&
        dist(o, d) < (o.type === "stand" || d.type === "stand" ? 34 : 15),
    )
  )
    throw Error("Leave space between decorations.");
}
export function seatPosition(stand, index) {
  const a = ((stand.angle || 0) * Math.PI) / 180,
    x = -19 + (index % 6) * 7.5,
    y = 3 + Math.floor(index / 6) * 9;
  return {
    x: stand.x + x * Math.cos(a) - y * Math.sin(a),
    y: stand.y + x * Math.sin(a) + y * Math.cos(a),
  };
}
export function spectatorAppeal(s, v) {
  if (v.finished) return 0;
  if (v.eventId && s.tournament?.id === v.eventId) return 1.5;
  const m = s.members?.[v.memberId];
  return v.golfer.skill >= 0.8
    ? 1
    : v.player && v.golfer.skill >= 0.65 && v.golfer.stats.holes >= 15
      ? 0.85
      : m?.rounds >= 3 && m.best?.relative < 0
        ? 0.75
        : 0;
}
export class CourseLife {
  constructor(s, nav) {
    this.s = s;
    this.nav = nav;
    this.clock = 0;
    this.fanTimer = 2;
    this.serial = 0;
    s.workers ||= [];
    s.fans ||= [];
    s.decorations ||= [];
    s.fanStats ||= { served: 0, revenue: 0 };
    s.fanFee ??= 4;
  }
  sync() {
    const s = this.s,
      ids = new Set();
    for (const role of ["grounds", "desk", "mechanic", "pro", "service"])
      for (let i = 0; i < Math.min(24, s.staff[role] || 0); i++) {
        const id = role + "-" + i;
        ids.add(id);
        if (!s.workers.some((w) => w.id === id)) {
          const p = facilityPosition(
            s,
            role === "grounds" && s.facilities.includes("maintenance")
              ? "maintenance"
              : "check",
          );
          s.workers.push({
            id,
            name: personName(
              i +
                ["grounds", "desk", "mechanic", "pro", "service"].indexOf(
                  role,
                ) *
                  17,
            ),
            role,
            pos: { ...p },
            timer: 0,
            task: "Starting shift",
            stage: "choose",
          });
        }
      }
    s.workers = s.workers.filter((w) => ids.has(w.id));
  }
  groundTarget(w) {
    const s = this.s,
      holes = s.holes.filter((h) => h.tee && h.pin);
    for (let n = 0; n < 70; n++) {
      const h = holes[(this.serial + n) % Math.max(1, holes.length)];
      if (!h) break;
      const u = ((this.serial + n * 7) % 11) / 10,
        p = {
          x: h.tee.x + (h.pin.x - h.tee.x) * u + ((n % 3) - 1) * 18,
          y: h.tee.y + (h.pin.y - h.tee.y) * u + ((n % 5) - 2) * 12,
        };
      const t = terrainAt(s, p);
      if ([T.FAIRWAY, T.GREEN, T.SAND].includes(t)) {
        this.serial++;
        w.task =
          (t === T.GREEN
            ? "Tending green"
            : t === T.SAND
              ? "Raking bunker"
              : "Mowing fairway") +
          " · " +
          h.name;
        w.mower = t === T.FAIRWAY;
        return p;
      }
    }
    w.task = "Maintaining landscaping";
    w.mower = true;
    return { ...facilityPosition(s, "check"), x: 90, y: 110 };
  }
  tick(dt, visits) {
    this.clock += dt;
    this.sync();
    const s = this.s;
    for (const w of s.workers) {
      w.timer += dt;
      if (w.role === "grounds") {
        if (!w.target || w.stage === "choose") {
          w.target = this.groundTarget(w);
          w.stage = "travel";
          w.timer = 0;
        }
        if (w.stage === "travel" && this.nav.move(w, w.target, 16, dt)) {
          w.stage = "work";
          w.timer = 0;
        }
        if (w.stage === "work") {
          s.daily.groundWork = (s.daily.groundWork || 0) + dt;
          w.trail ||= [];
          if (w.mower) {
            const next = {
              x: w.pos.x + Math.sin(w.timer * 0.45) * dt * 1.8,
              y: w.pos.y + Math.cos(w.timer * 0.45) * dt * 1.2,
            };
            if (this.nav.walkable(next)) w.pos = next;
            w.trail.push({ ...w.pos });
            if (w.trail.length > 20) w.trail.shift();
          }
          if (w.timer > 10) {
            w.stage = "choose";
          }
        }
        continue;
      }
      let station = facilityPosition(s, "check"),
        active = true;
      if (w.role === "pro") {
        if (s.range) {
          station = { x: s.range.tee.x - 14, y: s.range.tee.y + 16 };
          const pupil = visits.find(
            (v) => v.state === "rangeThinking" || v.state === "rangeFlying",
          );
          w.task = pupil
            ? "Coaching " + pupil.golfer.name
            : "Preparing range lessons";
        } else {
          active = false;
          w.task = "Waiting for a driving range";
        }
      }
      if (w.role === "desk") {
        w.task = visits.some((v) => v.state === "between")
          ? "Checking in golfers"
          : "Preparing the next tee time";
        station = { x: station.x + 12, y: station.y + 12 };
      }
      if (w.role === "mechanic") {
        station = facilityPosition(s, "carts") || station;
        active = s.facilities.includes("carts");
        w.task = active
          ? "Servicing the cart fleet"
          : "Waiting for cart storage";
      }
      if (w.role === "service") {
        station = facilityPosition(s, "food") || station;
        active = s.facilities.includes("food");
        w.task = active ? "Serving refreshments" : "Waiting for a café";
      }
      w.stage = active ? "work" : "waiting";
      const goal = {
        x:
          station.x +
          Math.sin(this.clock * 0.08 + w.id.length) * 5 +
          (+w.id.split("-")[1] % 3) * 5,
        y: station.y + 8,
      };
      this.nav.move(w, goal, 14, dt);
    }
    this.fanTimer -= dt;
    const stands = s.decorations.filter((d) => d.type === "stand");
    for (const f of s.fans) {
      const stand = stands.find((d) => d.id === f.standId),
        v = visits.find((v) => v.id === f.visitId && !v.finished);
      f.timer += dt;
      if (!stand || !v || dist(v.ball, stand) > 230 || f.timer > 190)
        f.state = "leaving";
      if (
        f.state === "walking" &&
        this.nav.move(f, seatPosition(stand, f.seat), 18, dt)
      ) {
        f.state = "seated";
        f.timer = 0;
      }
      if (
        f.state === "leaving" &&
        this.nav.move(f, facilityPosition(s, "check"), 20, dt)
      )
        f.finished = true;
      if (f.cheer > 0) f.cheer -= dt;
    }
    s.fans = s.fans.filter((f) => !f.finished);
    if (this.fanTimer <= 0) {
      this.fanTimer = 8;
      const targets = visits.filter((v) => spectatorAppeal(s, v) > 0);
      let admitted = false;
      for (const stand of stands) {
        if (admitted || s.fans.length >= 48) break;
        const target = targets
          .filter((v) => dist(v.ball, stand) < 210)
          .sort((a, b) => spectatorAppeal(s, b) - spectatorAppeal(s, a))[0];
        if (!target) continue;
        const seats = new Set(
            s.fans
              .filter((f) => f.standId === stand.id && f.state !== "leaving")
              .map((f) => f.seat),
          ),
          seat = Array.from({ length: 12 }, (_, i) => i).find(
            (i) => !seats.has(i),
          );
        if (seat === undefined) continue;
        const demand =
          spectatorAppeal(s, target) *
          (s.reputation / 70) *
          Math.exp(-Math.max(0, s.fanFee - 4) / 6);
        if (Math.random() > Math.min(0.95, demand)) continue;
        const f = {
          id: uid(),
          name: personName((s.fanStats.served + 37) % 144),
          standId: stand.id,
          visitId: target.id,
          seat,
          state: "walking",
          pos: { ...facilityPosition(s, "check") },
          timer: 0,
          cheer: 0,
        };
        s.fans.push(f);
        s.cash += s.fanFee;
        s.daily.revenue += s.fanFee;
        s.daily.fanRevenue = (s.daily.fanRevenue || 0) + s.fanFee;
        s.daily.fans = (s.daily.fans || 0) + 1;
        s.lifetimeRevenue += s.fanFee;
        s.fanStats.served++;
        s.fanStats.revenue += s.fanFee;
        admitted = true;
      }
    }
  }
  react(v, result) {
    v.reaction = result.holed
      ? "celebrate"
      : result.penalty
        ? "disappointed"
        : result.remaining < 12
          ? "pleased"
          : "watching";
    v.reactionLeft = 2.5;
    for (const f of this.s.fans)
      if (
        f.visitId === v.id &&
        f.state === "seated" &&
        (result.holed ||
          result.quality === "Excellent contact" ||
          result.remaining < 8)
      )
        f.cheer = 3;
  }
}
