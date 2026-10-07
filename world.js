export const VERSION = "1.2.1",
  CELL = 4,
  GW = 600,
  GH = 450;
export const T = {
  ROUGH: 0,
  FAIRWAY: 1,
  GREEN: 2,
  SAND: 3,
  WATER: 4,
  DEEP: 5,
  PATH: 6,
  TREE: 7,
  FLOWER: 8,
  TEE: 9,
};
export const COLORS = [
  "#52834d",
  "#83b75c",
  "#a1cf76",
  "#edce91",
  "#54a5b5",
  "#396743",
  "#bca983",
  "#286544",
  "#8eaa65",
  "#72ad5b",
];
export const TOOLS = [
  ["tee", "⚑", "Tee", 80],
  ["green", "◉", "Green", 0.075],
  ["pin", "⚐", "Pin", 0],
  ["fairway", "〰", "Fairway", 0.014],
  ["rough", "░", "Rough", 0.004],
  ["deep", "▒", "Deep rough", 0.006],
  ["sand", "◒", "Bunker", 0.04],
  ["water", "≈", "Water", 0.05],
  ["tree", "♣", "Trees", 0.06],
  ["flower", "✿", "Garden", 0.035],
  ["path", "⌁", "Path", 0.025],
  ["raise", "↟", "Raise", 0.018],
  ["lower", "↡", "Lower", 0.018],
  ["level", "═", "Level", 0.012],
  ["erase", "⌫", "Clear", 0.007],
];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a, b, t) => a + (b - a) * t;
export const gaussian = () =>
  Math.sqrt(-2 * Math.log(Math.max(0.00001, Math.random()))) *
  Math.cos(Math.random() * Math.PI * 2);
export const uid = () =>
  globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
export function blankHole(n) {
  return {
    id: uid(),
    name: `Hole ${n}`,
    tees: {},
    teePars: {},
    teeStats: {},
    revisionStats: {},
    designBaseline: null,
    tee: null,
    green: null,
    pin: null,
    par: 4,
    manualPar: false,
    open: false,
    revision: 0,
    stats: {
      plays: 0,
      total: 0,
      birdies: 0,
      pars: 0,
      bogeys: 0,
      double: 0,
      aces: [],
      buckets: [
        { n: 0, total: 0 },
        { n: 0, total: 0 },
        { n: 0, total: 0 },
      ],
      low: null,
      drive: null,
      putt: null,
      approach: null,
    },
  };
}
export function initialState() {
  return {
    version: 5,
    courseId: uid(),
    journal: [],
    facilityPositions: {},
    heatmap: false,
    name: "Wild Links",
    cash: 5000,
    day: 1,
    minute: 480,
    land: 0,
    capacity: 3,
    plots: [true, false, false, false],
    plotW: 600,
    plotH: 440,
    courseLevel: 0,
    members: {},
    trails: [],
    showTrails: false,
    trailFilter: "all",
    ownerRounds: [],
    upgradeHistory: [],
    claimedGoals: [],
    tournamentHistory: [],
    rangeStats: { visits: 0, shots: 0, revenue: 0 },
    range: null,
    fee: 12,
    opened: false,
    reputation: 55,
    conditions: 95,
    holes: [blankHole(1)],
    terrain: naturalLand(),
    heights: new Float32Array(GW * GH),
    facilities: [],
    staff: { grounds: 0, desk: 0, mechanic: 0, pro: 0, service: 0 },
    records: {
      overall: null,
      nine: null,
      eighteen: null,
      ai: null,
      personal: null,
    },
    history: [],
    reviews: [],
    totalServed: 0,
    tutorialComplete: false,
    lifetimeRevenue: 0,
    achievements: [],
    player: makeOwner(),
    daily: {
      revenue: 0,
      expenses: 0,
      served: 0,
      satisfaction: [],
      complaints: {},
    },
    weather: { name: "Clear skies", windX: 1.6, windY: 0.7 },
    tournament: null,
    lastSaved: 0,
  };
}
export function makeOwner() {
  return {
    name: "The Owner",
    skill: 0.43,
    drive: 219,
    accuracy: 0.43,
    iron: 0.45,
    wedge: 0.48,
    putting: 0.44,
    recovery: 0.4,
    bunker: 0.4,
    management: 0.48,
    risk: 0.5,
    confidence: 0.52,
    patience: 0.6,
    preferred: 0.4,
    xp: 0,
    stats: {
      rounds: 0,
      holes: 0,
      strokes: 0,
      pars: 0,
      birdies: 0,
      eagles: 0,
      bogeys: 0,
      double: 0,
      aces: 0,
      fairways: 0,
      drives: 0,
      gir: 0,
      putts: 0,
      longestDrive: 0,
      longestPutt: 0,
      closest: null,
      best: null,
    },
  };
}
export function landPlots(s) {
  const w = s.plotW || 600,
    h = s.plotH || 440;
  return ["Northwest", "Northeast", "Southwest", "Southeast"].map(
    (name, id) => ({
      id,
      name,
      row: Math.floor(id / 2),
      col: id % 2,
      x: (id % 2) * w,
      y: Math.floor(id / 2) * h,
      w,
      h,
      owned: !!s.plots?.[id],
      cost: id === 3 ? 4800 : 2800,
    }),
  );
}
export function ownedAt(s, p) {
  if (p.x < 0 || p.y < 0) return false;
  if (!s.plots) {
    const l = landSize(s);
    return p.x < l.w && p.y < l.h;
  }
  return landPlots(s).some(
    (q) =>
      q.owned && p.x >= q.x && p.y >= q.y && p.x < q.x + q.w && p.y < q.y + q.h,
  );
}
export function landSize(s) {
  if (s.plots) {
    const owned = landPlots(s).filter((p) => p.owned);
    return {
      w: Math.max(...owned.map((p) => p.x + p.w)),
      h: Math.max(...owned.map((p) => p.y + p.h)),
    };
  }
  const sizes = [
    [600, 440],
    [940, 700],
    [1360, 1020],
    [1840, 1380],
    [2400, 1800],
  ];
  const [w, h] = sizes[s.land || 0];
  return { w, h };
}
export function index(x, y) {
  return (
    clamp(Math.floor(y / CELL), 0, GH - 1) * GW +
    clamp(Math.floor(x / CELL), 0, GW - 1)
  );
}
export function terrainAt(s, p) {
  const l = landSize(s);
  return !ownedAt(s, p) ? -1 : s.terrain[index(p.x, p.y)];
}
export const heightAt = (s, p) => s.heights[index(p.x, p.y)] || 0;
export function slopeAt(s, p) {
  return {
    x:
      (heightAt(s, { x: p.x + 8, y: p.y }) -
        heightAt(s, { x: p.x - 8, y: p.y })) /
      16,
    y:
      (heightAt(s, { x: p.x, y: p.y + 8 }) -
        heightAt(s, { x: p.x, y: p.y - 8 })) /
      16,
  };
}
export function brushStroke(s, p, r, tool, tx) {
  const l = landSize(s),
    type = {
      green: 2,
      fairway: 1,
      rough: 0,
      deep: 5,
      sand: 3,
      water: 4,
      tree: 7,
      flower: 8,
      path: 6,
      erase: 0,
    }[tool];
  for (
    let y = Math.max(0, Math.floor((p.y - r) / CELL));
    y <= Math.min(GH - 1, Math.floor((p.y + r) / CELL));
    y++
  )
    for (
      let x = Math.max(0, Math.floor((p.x - r) / CELL));
      x <= Math.min(GW - 1, Math.floor((p.x + r) / CELL));
      x++
    ) {
      const cx = x * CELL + 2,
        cy = y * CELL + 2,
        d = Math.hypot(cx - p.x, cy - p.y);
      if (d > r || !ownedAt(s, { x: cx, y: cy })) continue;
      const i = y * GW + x;
      if (tool === "fairway" && s.terrain[i] === T.GREEN) continue;
      let t = s.terrain[i],
        h = s.heights[i];
      if (type !== undefined) t = type;
      else {
        let a = 0.36 * (1 - d / r);
        h =
          tool === "level"
            ? h * (1 - 0.15 * (1 - d / r))
            : clamp(h + (tool === "raise" ? a : -a), -18, 30);
      }
      if (t === s.terrain[i] && h === s.heights[i]) continue;
      if (!tx.cells.has(i))
        tx.cells.set(i, { t: s.terrain[i], h: s.heights[i] });
      s.terrain[i] = t;
      s.heights[i] = h;
    }
  tx.cost =
    tx.cells.size * CELL * CELL * (TOOLS.find((x) => x[0] === tool)?.[3] || 0);
}
export function stamp(s, p, r, type, tx) {
  brushStroke(
    s,
    p,
    r,
    Object.keys({
      green: 2,
      fairway: 1,
      rough: 0,
      deep: 5,
      sand: 3,
      water: 4,
      tree: 7,
      flower: 8,
      path: 6,
    }).find(
      (k) =>
        ({
          green: 2,
          fairway: 1,
          rough: 0,
          deep: 5,
          sand: 3,
          water: 4,
          tree: 7,
          flower: 8,
          path: 6,
        })[k] === type,
    ) || "rough",
    tx,
  );
}
// Navigation costs favor playable corridors without demanding designer-authored routes.
export function routeToPin(s, h) {
  if (!h.pin || !h.tee) return [];
  const step = 20,
    l = landSize(s),
    w = Math.ceil(l.w / step),
    hh = Math.ceil(l.h / step),
    start = Math.floor(h.tee.y / step) * w + Math.floor(h.tee.x / step),
    end = Math.floor(h.pin.y / step) * w + Math.floor(h.pin.x / step),
    cost = new Float64Array(w * hh).fill(Infinity),
    prev = new Int32Array(w * hh).fill(-1),
    heap = [];
  const push = (i, v) => {
    heap.push([i, v]);
    let a = heap.length - 1;
    while (a) {
      let b = (a - 1) >> 1;
      if (heap[b][1] <= v) break;
      [heap[a], heap[b]] = [heap[b], heap[a]];
      a = b;
    }
  };
  const pop = () => {
    const a = heap[0],
      b = heap.pop();
    if (heap.length) {
      heap[0] = b;
      let i = 0;
      for (;;) {
        let j = i * 2 + 1;
        if (j >= heap.length) break;
        if (j + 1 < heap.length && heap[j + 1][1] < heap[j][1]) j++;
        if (heap[i][1] <= heap[j][1]) break;
        [heap[i], heap[j]] = [heap[j], heap[i]];
        i = j;
      }
    }
    return a;
  };
  cost[start] = 0;
  push(start, 0);
  while (heap.length) {
    const [i, c] = pop();
    if (c !== cost[i]) continue;
    if (i === end) break;
    let x = i % w,
      y = Math.floor(i / w);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      let xx = x + dx,
        yy = y + dy;
      if (xx < 0 || xx >= w || yy < 0 || yy >= hh) continue;
      let j = yy * w + xx,
        t = terrainAt(s, { x: xx * step + 10, y: yy * step + 10 }),
        pen = [1.6, 1, 1, 2.5, 25, 3, 1.5, 8, 1.6, 1][t] || 5;
      if (t < 0) continue;
      let nc = c + Math.hypot(dx, dy) * pen;
      if (nc < cost[j]) {
        cost[j] = nc;
        prev[j] = i;
        push(j, nc);
      }
    }
  }
  let path = [],
    i = end;
  for (let n = 0; i !== -1 && n < w * hh; n++) {
    path.push({ x: (i % w) * step + 10, y: Math.floor(i / w) * step + 10 });
    if (i === start) break;
    i = prev[i];
  }
  return path.reverse();
}
export function analyzeHole(s, h, knownRoute) {
  if (!h.tee || !h.pin) return null;
  const route = knownRoute || routeToPin(s, h),
    direct = dist(h.tee, h.pin);
  let length = 0,
    waterRun = 0,
    carry = 0,
    exposure = 0,
    fair = 0,
    scenic = 0,
    width = 0;
  for (let i = 1; i < route.length; i++) {
    length += dist(route[i - 1], route[i]);
    const t = terrainAt(s, route[i]);
    if (t === 4) {
      waterRun += 20;
      carry = Math.max(carry, waterRun);
    } else waterRun = 0;
    if (t === 1 || t === 2) fair++;
    if (t === 3 || t === 4 || t === 7 || t === 5) exposure++;
    for (const [dx, dy] of [
      [25, 0],
      [-25, 0],
      [0, 25],
      [0, -25],
    ]) {
      let tt = terrainAt(s, { x: route[i].x + dx, y: route[i].y + dy });
      if (tt === 1 || tt === 2) width++;
      if (tt === 4 || tt === 7 || tt === 8) scenic++;
    }
  }
  let n = Math.max(1, route.length - 1),
    forgive = clamp((width / (n * 4)) * 100, 0, 100),
    variety = clamp(
      (length / direct - 1) * 100 + (exposure / n) * 80 + (scenic / n) * 6,
      0,
      100,
    ),
    greenArea = 0;
  for (let y = h.green.y - 60; y < h.green.y + 60; y += 8)
    for (let x = h.green.x - 60; x < h.green.x + 60; x += 8)
      if (terrainAt(s, { x, y }) === 2) greenArea += 64;
  const par = h.par;
  return {
    length: Math.round(Math.max(direct, length)),
    direct: Math.round(direct),
    carry,
    forgiveness: Math.round(forgive),
    fairway: Math.round((fair / n) * 100),
    variety: Math.round(variety),
    hazards: Math.round((exposure / n) * 100),
    scenery: clamp(Math.round(35 + (scenic / n) * 18), 0, 100),
    greenAccess: clamp(Math.round(greenArea / 35), 0, 100),
    pace: Math.round(7 + length / 70 + (exposure / n) * 10),
    beginner: clamp(
      Math.round(forgive * 0.6 + (fair / n) * 40 - carry / 4),
      0,
      100,
    ),
    expert: clamp(
      Math.round(variety * 0.6 + length / 9 + (exposure / n) * 30),
      0,
      100,
    ),
    expected: [
      +(par + 1.3 + (100 - forgive) / 65 + carry / 100).toFixed(1),
      +(par + 0.4 + (100 - forgive) / 130).toFixed(1),
      +(par - 0.3 + (exposure / n) * 0.8).toFixed(1),
    ],
  };
}
export function validateHole(s, h) {
  if ((h.tee && !ownedAt(s, h.tee)) || (h.pin && !ownedAt(s, h.pin)))
    return "Purchase that plot before placing a tee or pin there.";
  if (!h.tee) return "Place a tee first.";
  if (!h.green) return "Paint a green first.";
  if (!h.pin) return "Place a pin on the green.";
  if (terrainAt(s, h.pin) !== T.GREEN)
    return "The pin needs to be on green terrain.";
  if (dist(h.tee, h.pin) < 25)
    return "Move the tee and pin at least 25 yards apart.";
  if (terrainAt(s, h.tee) === T.WATER) return "The tee is underwater.";
  return null;
}

function naturalLand() {
  const a = new Uint8Array(GW * GH);
  for (const [cx, cy, r] of [
    [550, 382, 44],
    [574, 55, 31],
    [18, 400, 23],
  ])
    for (
      let y = Math.floor((cy - r) / CELL);
      y < Math.ceil((cy + r) / CELL);
      y++
    )
      for (
        let x = Math.floor((cx - r) / CELL);
        x < Math.ceil((cx + r) / CELL);
        x++
      )
        if (
          x >= 0 &&
          y >= 0 &&
          x < GW &&
          y < GH &&
          Math.hypot(x * CELL - cx, y * CELL - cy) <
            r * (0.9 + Math.sin(x * 2 + y) * 0.14)
        )
          a[y * GW + x] = 7;
  return a;
}
