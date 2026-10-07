import {
  CELL,
  GW,
  GH,
  T,
  ownedAt,
  index,
  terrainAt,
  dist,
  clamp,
} from "./world.js";
export const TEE_NAMES = {
  forward: "Forward",
  standard: "Standard",
  championship: "Championship",
};
export function teeFor(h, set = "standard") {
  return set === "standard" ? h.tee : h.tees?.[set] || h.tee;
}
export function teePar(h, set = "standard") {
  if (set === "standard" || !h.tees?.[set]) return h.par;
  const d = dist(teeFor(h, set), h.pin);
  return h.teePars?.[set] || (d < 230 ? 3 : d < 470 ? 4 : 5);
}
export function chooseTees(g) {
  return g.skill < 0.35
    ? "forward"
    : g.skill > 0.8
      ? "championship"
      : "standard";
}
export function playedHole(h, v) {
  return { ...h, tee: teeFor(h, v.teeSet), par: teePar(h, v.teeSet) };
}
export function addJournal(s, title, text, extra = {}) {
  s.journal ||= [];
  s.journal.unshift({
    id: globalThis.crypto?.randomUUID?.() || Math.random().toString(36),
    day: s.day,
    title,
    text,
    ...extra,
  });
  s.journal = s.journal.slice(0, 250);
}
export function staffAdvice(s) {
  const holes = s.holes.filter((h) => h.open).length,
    traffic =
      s.history.slice(0, 3).reduce((a, d) => a + d.served, 0) /
      Math.max(1, s.history.slice(0, 3).length),
    wear = holes * 0.6 + traffic * Math.max(holes, 1) * 0.16,
    repair = s.staff.grounds * (s.facilities.includes("maintenance") ? 12 : 7),
    out = [];
  if (wear > repair || s.conditions < 70) {
    const per = s.facilities.includes("maintenance") ? 12 : 7;
    out.push(
      `Course care: approximately ${wear.toFixed(1)} condition points of wear/day versus ${repair} repair. ${Math.max(1, Math.ceil((wear - repair) / per))} additional groundskeeper${Math.ceil((wear - repair) / per) > 1 ? "s" : ""} would cover the recent workload.`,
    );
  }
  for (const [f, role, name] of [
    ["shop", "desk", "pro shop"],
    ["carts", "mechanic", "cart fleet"],
    ["range", "pro", "paid range coaching"],
    ["food", "service", "café"],
  ])
    if (s.facilities.includes(f) && !s.staff[role])
      out.push(
        `Your ${name} needs one ${role === "desk" ? "check-in worker" : role === "pro" ? "golf professional" : role === "service" ? "service worker" : "maintenance worker"}.`,
      );
  if (!out.length)
    out.push(
      "Your current crew covers the recent workload. Recheck as visits and hole count grow.",
    );
  return out;
}
export function landingClusters(s, { hole = null, filter = "all" } = {}) {
  const bins = new Map();
  for (const t of s.trails || []) {
    if (hole && t.hole !== hole) continue;
    if (
      (filter === "owner" && t.memberId !== "owner") ||
      (filter === "beginner" && t.skill >= 0.35) ||
      (filter === "club" && (t.skill < 0.35 || t.skill >= 0.8)) ||
      (filter === "scratch" && t.skill < 0.8)
    )
      continue;
    const x = Math.floor(t.land.x / 24) * 24 + 12,
      y = Math.floor(t.land.y / 24) * 24 + 12,
      key = x + ":" + y,
      b = bins.get(key) || { x, y, n: 0, penalties: 0 };
    b.n++;
    b.penalties += t.penalty ? 1 : 0;
    bins.set(key, b);
  }
  return [...bins.values()].sort((a, b) => b.n - a.n);
}
export function selectFeature(s, p) {
  if (s.range && dist(p, s.range.tee) < 20)
    return { kind: "range", center: { ...s.range.tee } };
  for (const [id, pos] of Object.entries(s.facilityPositions || {}))
    if (dist(p, pos) < 22) return { kind: "facility", id, center: { ...pos } };
  const terrain = terrainAt(s, p);
  if (![T.GREEN, T.SAND].includes(terrain)) return null;
  const start = index(p.x, p.y),
    queue = [start],
    seen = new Set([start]);
  for (let k = 0; k < queue.length && queue.length < 20000; k++) {
    const i = queue[k],
      x = i % GW,
      y = Math.floor(i / GW);
    for (const j of [
      x > 0 ? i - 1 : -1,
      x < GW - 1 ? i + 1 : -1,
      y > 0 ? i - GW : -1,
      y < GH - 1 ? i + GW : -1,
    ])
      if (j >= 0 && !seen.has(j) && s.terrain[j] === terrain) {
        seen.add(j);
        queue.push(j);
      }
  }
  if (queue.length >= 20000) return null;
  const pts = queue.map((i) => ({
      i,
      x: (i % GW) * CELL + CELL / 2,
      y: Math.floor(i / GW) * CELL + CELL / 2,
    })),
    center = {
      x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
      y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
    };
  return { kind: "terrain", terrain, points: pts, center };
}
export function planTransform(s, f, center, scale = 1) {
  if (f.kind !== "terrain") {
    const moved = { x: center.x - f.center.x, y: center.y - f.center.y };
    const target =
      f.kind === "range"
        ? { x: s.range.target.x + moved.x, y: s.range.target.y + moved.y }
        : center;
    if (
      !ownedAt(s, center) ||
      !ownedAt(s, target) ||
      (f.kind === "range" && !ownedAt(s, { x: center.x + 12, y: center.y }))
    )
      throw Error("Keep the complete feature on owned land.");
    return { center, moved, scale: 1, cost: 80 };
  }
  scale = clamp(scale, 0.6, 1.6);
  const cells = new Set(f.points.map((p) => p.i)),
    bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };
  for (const p of f.points) {
    const x = center.x + (p.x - f.center.x) * scale,
      y = center.y + (p.y - f.center.y) * scale;
    bounds.minX = Math.min(bounds.minX, x - CELL * scale);
    bounds.maxX = Math.max(bounds.maxX, x + CELL * scale);
    bounds.minY = Math.min(bounds.minY, y - CELL * scale);
    bounds.maxY = Math.max(bounds.maxY, y + CELL * scale);
  }
  const dest = [];
  for (
    let y = Math.floor(bounds.minY / CELL) * CELL + CELL / 2;
    y <= bounds.maxY;
    y += CELL
  )
    for (
      let x = Math.floor(bounds.minX / CELL) * CELL + CELL / 2;
      x <= bounds.maxX;
      x += CELL
    ) {
      const source = {
        x: f.center.x + (x - center.x) / scale,
        y: f.center.y + (y - center.y) / scale,
      };
      if (!cells.has(index(source.x, source.y))) continue;
      if (!ownedAt(s, { x, y }))
        throw Error("Keep the complete shape on owned land.");
      dest.push(index(x, y));
    }
  return { center, scale, dest, cost: Math.round(60 + dest.length * 0.35) };
}
export function applyTransform(s, f, plan, tx) {
  const delta = {
    x: plan.center.x - f.center.x,
    y: plan.center.y - f.center.y,
  };
  if (f.kind === "range") {
    s.range.tee = { ...plan.center };
    s.range.target = {
      x: s.range.target.x + delta.x,
      y: s.range.target.y + delta.y,
    };
  } else if (f.kind === "facility") {
    s.facilityPositions[f.id] = { ...plan.center };
  } else {
    const source = new Set(f.points.map((p) => p.i)),
      affected = new Set([...source, ...plan.dest]);
    for (const i of affected) {
      if (!tx.cells.has(i))
        tx.cells.set(i, { t: s.terrain[i], h: s.heights[i] });
      if (source.has(i))
        s.terrain[i] = f.terrain === T.GREEN ? T.FAIRWAY : T.ROUGH;
    }
    for (const i of plan.dest) s.terrain[i] = f.terrain;
    for (const h of s.holes) {
      if (h.pin && source.has(index(h.pin.x, h.pin.y))) {
        h.pin = {
          x: plan.center.x + (h.pin.x - f.center.x) * plan.scale,
          y: plan.center.y + (h.pin.y - f.center.y) * plan.scale,
        };
        h.green = { ...h.pin };
      }
    }
  }
  tx.cost = plan.cost;
}
export function revisionFeedback(h) {
  const rev = h.revisionStats?.[h.revision],
    base = h.designBaseline;
  return {
    before: base?.n ? base.total / base.n : null,
    after: rev?.n ? rev.total / rev.n : null,
    plays: rev?.n || 0,
  };
}
