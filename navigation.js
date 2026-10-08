import { terrainAt, T, dist, landSize, ownedAt } from "./world.js";
export function onBridge(s, p) {
  return (s.decorations || []).some((d) => {
    if (d.type !== "bridge") return false;
    const a = ((d.angle || 0) * Math.PI) / 180,
      dx = p.x - d.x,
      dy = p.y - d.y;
    return (
      Math.abs(dx * Math.cos(a) + dy * Math.sin(a)) <= 42 &&
      Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) <= 9
    );
  });
}
class Heap {
  constructor() {
    this.a = [];
  }
  push(v) {
    let i = this.a.push(v) - 1;
    while (i) {
      let p = (i - 1) >> 1;
      if (this.a[p].f <= v.f) break;
      this.a[i] = this.a[p];
      i = p;
    }
    this.a[i] = v;
  }
  pop() {
    const v = this.a[0],
      last = this.a.pop();
    if (this.a.length) {
      let i = 0;
      while (i * 2 + 1 < this.a.length) {
        let c = i * 2 + 1;
        if (c + 1 < this.a.length && this.a[c + 1].f < this.a[c].f) c++;
        if (this.a[c].f >= last.f) break;
        this.a[i] = this.a[c];
        i = c;
      }
      this.a[i] = last;
    }
    return v;
  }
  get length() {
    return this.a.length;
  }
}
export class Navigation {
  constructor(s) {
    this.s = s;
    this.version = 0;
    this.cache = new Map();
  }
  invalidate() {
    this.version++;
    this.cache.clear();
  }
  walkable(p, boat = false) {
    const t = terrainAt(this.s, p);
    return t !== -1 && (t !== T.WATER || onBridge(this.s, p) || boat);
  }
  line(a, b, boat = false) {
    const n = Math.max(1, Math.ceil(dist(a, b) / 3));
    for (let i = 0; i <= n; i++)
      if (
        !this.walkable(
          { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n },
          boat,
        )
      )
        return false;
    return true;
  }
  plan(start, goal) {
    if (dist(start, goal) < 2) return [{ ...goal }];
    const l = landSize(this.s),
      step = 12,
      w = Math.ceil(l.w / step),
      h = Math.ceil(l.h / step),
      size = w * h;
    const index = (p) =>
        Math.max(0, Math.min(h - 1, Math.floor(p.y / step))) * w +
        Math.max(0, Math.min(w - 1, Math.floor(p.x / step))),
      point = (i) => ({
        x: (i % w) * step + 6,
        y: Math.floor(i / w) * step + 6,
      }),
      source = index(start),
      end = index(goal),
      key =
        start.x.toFixed(1) +
        "," +
        start.y.toFixed(1) +
        ":" +
        goal.x.toFixed(1) +
        "," +
        goal.y.toFixed(1);
    if (this.cache.has(key))
      return [
        { ...start },
        ...this.cache.get(key).map((p) => ({ ...p })),
        { ...goal },
      ];
    for (const boat of [false, true]) {
      const cost = new Float32Array(size).fill(Infinity),
        parent = new Int32Array(size).fill(-1),
        closed = new Uint8Array(size),
        heap = new Heap();
      cost[source] = 0;
      heap.push({ i: source, f: 0 });
      let found = false;
      while (heap.length) {
        const { i } = heap.pop();
        if (closed[i]) continue;
        closed[i] = 1;
        if (i === end) {
          found = true;
          break;
        }
        const p = i === source ? start : point(i),
          x = i % w,
          y = Math.floor(i / w);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (closed[j]) continue;
          const q = j === end ? goal : point(j),
            t = terrainAt(this.s, q);
          if (!this.line(p, q, boat)) continue;
          const factor =
            t === T.PATH || onBridge(this.s, q)
              ? 0.65
              : t === T.WATER
                ? 8
                : t === T.TREE
                  ? 2.1
                  : t === T.DEEP
                    ? 1.6
                    : t === T.GREEN
                      ? 1.35
                      : 1;
          const c = cost[i] + dist(p, q) * factor;
          if (c >= cost[j]) continue;
          cost[j] = c;
          parent[j] = i;
          heap.push({ i: j, f: c + dist(q, goal) * 0.65 });
        }
      }
      if (found) {
        const path = [];
        let i = end;
        while (i !== source && i >= 0) {
          const p = i === end ? { ...goal } : point(i);
          p.ferry = terrainAt(this.s, p) === T.WATER && !onBridge(this.s, p);
          path.unshift(p);
          i = parent[i];
        }
        this.cache.set(key, path);
        if (this.cache.size > 180)
          this.cache.delete(this.cache.keys().next().value);
        return [{ ...start }, ...path, { ...goal }];
      }
    }
    return [{ ...start }];
  }
  move(agent, goal, speed, dt) {
    if (!agent.pos) agent.pos = { ...goal };
    if (dist(agent.pos, goal) < 1.5) {
      agent.pos = { ...goal };
      agent.travelMode = null;
      return true;
    }
    if (
      !agent.walkRoute ||
      agent.walkVersion !== this.version ||
      !agent.walkGoal ||
      dist(agent.walkGoal, goal) > 2
    ) {
      agent.walkRoute = this.plan(agent.pos, goal);
      agent.walkIndex = 1;
      agent.walkGoal = { ...goal };
      agent.walkVersion = this.version;
    }
    let budget = speed * dt;
    while (budget > 0 && agent.walkIndex < agent.walkRoute.length) {
      const q = agent.walkRoute[agent.walkIndex],
        d = dist(agent.pos, q);
      agent.travelMode =
        q.ferry ||
        !this.line(agent.pos, q) ||
        (terrainAt(this.s, agent.pos) === T.WATER &&
          !onBridge(this.s, agent.pos))
          ? "ferry"
          : "walk";
      const m = Math.min(d, budget);
      if (d) {
        agent.heading = Math.atan2(q.y - agent.pos.y, q.x - agent.pos.x);
        agent.pos.x += ((q.x - agent.pos.x) * m) / d;
        agent.pos.y += ((q.y - agent.pos.y) * m) / d;
      }
      budget -= m;
      if (d < 0.01 || m >= d - 0.01) agent.walkIndex++;
      else break;
    }
    if (
      agent.walkIndex >= agent.walkRoute.length &&
      dist(agent.pos, goal) < 2
    ) {
      agent.pos = { ...goal };
      agent.travelMode = null;
      return true;
    }
    return false;
  }
}
