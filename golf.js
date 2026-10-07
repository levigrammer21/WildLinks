import {
  T,
  clamp,
  dist,
  gaussian,
  terrainAt,
  heightAt,
  slopeAt,
  landSize,
  routeToPin,
  uid,
} from "./world.js";
const FIRST = [
  "Marcus",
  "Jamal",
  "Elena",
  "Theo",
  "Priya",
  "Caleb",
  "Nora",
  "Levi",
  "Jun",
  "Amelia",
  "Owen",
  "Zara",
  "Elliot",
  "Sofia",
  "Miles",
  "Grace",
  "Hugo",
  "Avery",
  "Iris",
  "Dante",
  "Harper",
  "Arthur",
  "Maya",
  "Finn",
  "Ruth",
  "Cameron",
  "Rowan",
  "Naomi",
  "Andre",
  "Lou",
];
const LAST = [
  "Hill",
  "Carter",
  "Brooks",
  "Chen",
  "Patel",
  "Rivera",
  "Bennett",
  "Reed",
  "Walker",
  "Morgan",
  "Cruz",
  "Sullivan",
  "Baker",
  "Scott",
  "Hayes",
  "Foster",
  "Wright",
  "Kim",
  "Price",
  "Bell",
  "Davis",
  "Mitchell",
  "Young",
  "Parker",
];
export function generateGolfer(forced) {
  const k = forced ?? Math.random(),
    archetype =
      k < 0.23
        ? "Weekend beginner"
        : k < 0.5
          ? "Club regular"
          : k < 0.72
            ? "Conservative veteran"
            : k < 0.92
              ? "Aggressive bomber"
              : "Scratch strategist",
    skill =
      archetype === "Weekend beginner"
        ? 0.17 + Math.random() * 0.18
        : archetype === "Scratch strategist"
          ? 0.88 + Math.random() * 0.1
          : archetype === "Conservative veteran"
            ? 0.6 + Math.random() * 0.2
            : 0.35 + Math.random() * 0.35;
  return {
    name:
      FIRST[(Math.random() * FIRST.length) | 0] +
      " " +
      LAST[(Math.random() * LAST.length) | 0],
    archetype,
    skill,
    drive:
      archetype === "Aggressive bomber"
        ? 260 + Math.random() * 45
        : 155 + skill * 140,
    accuracy: clamp(skill + gaussian() * 0.07, 0.12, 0.98),
    iron: clamp(skill + gaussian() * 0.05, 0.1, 0.98),
    wedge: clamp(skill + gaussian() * 0.08, 0.1, 0.98),
    putting: clamp(skill + gaussian() * 0.06, 0.15, 0.98),
    recovery: clamp(skill + gaussian() * 0.07, 0.1, 0.97),
    bunker: clamp(skill + gaussian() * 0.09, 0.1, 0.98),
    management: archetype === "Conservative veteran" ? 0.95 : skill,
    confidence: 0.4 + Math.random() * 0.5,
    patience: 0.3 + Math.random() * 0.7,
    risk:
      archetype === "Aggressive bomber"
        ? 0.93
        : archetype === "Conservative veteran"
          ? 0.13
          : 0.2 + Math.random() * 0.6,
    preferred: skill,
    color: ["#f1ce77", "#ee8d75", "#91bcd8", "#e5eae1", "#b79ed5"][
      (Math.random() * 5) | 0
    ],
  };
}
export function clubs(g) {
  return [
    { name: "Driver", range: g.drive, loft: 1.2, kind: "drive" },
    { name: "3 Wood", range: g.drive * 0.88, loft: 1.1, kind: "iron" },
    { name: "5 Iron", range: g.drive * 0.73, loft: 1.4, kind: "iron" },
    { name: "7 Iron", range: g.drive * 0.61, loft: 1.65, kind: "iron" },
    { name: "9 Iron", range: g.drive * 0.48, loft: 1.9, kind: "iron" },
    { name: "Wedge", range: g.drive * 0.34, loft: 2.1, kind: "wedge" },
    { name: "Sand wedge", range: g.drive * 0.25, loft: 2.5, kind: "bunker" },
    { name: "Putter", range: 38, loft: 0, kind: "putt" },
  ];
}
export function suggestClub(s, g, p, pin) {
  const t = terrainAt(s, p),
    d = dist(p, pin),
    cs = clubs(g);
  if (t === 2 || d < 4) return cs[7];
  if (t === 3) return cs[6];
  if (t === 7 || t === 5) return d > 80 ? cs[4] : cs[5];
  return (
    cs
      .slice(0, 6)
      .reverse()
      .find((c) => c.range >= d * 0.94) || cs[0]
  );
}
export function shotProfile(s, g, p, c, power) {
  let t = terrainAt(s, p),
    ability =
      c.kind === "drive"
        ? g.accuracy
        : c.kind === "iron"
          ? g.iron
          : c.kind === "putt"
            ? g.putting
            : c.kind === "bunker"
              ? g.bunker
              : g.wedge,
    lie = t === 0 ? 0.87 : t === 5 ? 0.62 : t === 3 ? 0.72 : t === 7 ? 0.6 : 1;
  if (c.kind === "bunker" && t === 3) lie = 0.96;
  if (c.kind === "putt" && t !== 2) lie = 0.48;
  const range = c.range * clamp(power, 0.025, 1.15) * lie,
    condition =
      (1 + Math.max(0, 85 - s.conditions) / 150) *
      (1 + (0.5 - (g.confidence ?? 0.5)) * 0.1),
    spread =
      (c.kind === "putt"
        ? (0.09 + (1 - ability) * 0.055) * Math.sqrt(Math.max(0.2, range))
        : (0.016 + (1 - ability) * 0.11) * range) * condition;
  return {
    range,
    spread,
    depth:
      c.kind === "putt"
        ? range * (0.03 + (1 - ability) * 0.1)
        : range * (0.03 + (1 - ability) * 0.065),
    ability,
    lie,
  };
}
export function previewShot(s, g, p, c, power, angle) {
  const pr = shotProfile(s, g, p, c, power),
    target = {
      x: p.x + Math.cos(angle) * pr.range,
      y: p.y + Math.sin(angle) * pr.range,
    };
  return { ...pr, target, angle };
}
// All golfers, including the owner, enter this exact execution/terrain pipeline.
export function executeShot(s, g, p, pin, c, power, angle) {
  const pr = shotProfile(s, g, p, c, power),
    putt = c.kind === "putt",
    rollFactor = putt ? 1 : c.kind === "drive" ? 0.12 : 0.055,
    carry = putt ? 0 : pr.range / (1 + rollFactor);
  let lateral = gaussian() * pr.spread,
    contact = gaussian() * pr.depth,
    quality = "Solid strike",
    mishit = Math.random() < (1 - pr.ability) * 0.15;
  if (mishit && !putt) {
    const variants = ["Push", "Pull", "Slice", "Hook", "Poor contact"];
    quality = variants[(Math.random() * variants.length) | 0];
    if (quality === "Poor contact") contact -= carry * 0.28;
    else
      lateral +=
        (quality === "Push" || quality === "Slice" ? 1 : -1) *
        carry *
        (0.12 + Math.random() * 0.12);
  } else if (
    Math.abs(lateral) < pr.spread * 0.22 &&
    Math.abs(contact) < pr.depth * 0.3
  )
    quality = putt ? "Beautiful roll" : "Excellent contact";
  else if (lateral > pr.spread) quality = putt ? "Pushed putt" : "Pushed right";
  else if (lateral < -pr.spread) quality = putt ? "Pulled putt" : "Pulled left";
  else if (contact < -pr.depth)
    quality = putt ? "Left it short" : "Short of target";
  else if (contact > pr.depth) quality = putt ? "Ran past" : "Long of target";
  let forward = Math.max(0.1, (putt ? pr.range : carry) + contact),
    a = angle;
  const elev = heightAt(s, p),
    intended = {
      x: p.x + Math.cos(a) * forward,
      y: p.y + Math.sin(a) * forward,
    };
  forward = Math.max(
    0.1,
    forward - (heightAt(s, intended) - elev) * (putt ? 0 : 1.8),
  );
  let land = {
      x:
        p.x +
        Math.cos(a) * forward -
        Math.sin(a) * lateral +
        (putt ? 0 : (s.weather.windX * forward) / 110),
      y:
        p.y +
        Math.sin(a) * forward +
        Math.cos(a) * lateral +
        (putt ? 0 : (s.weather.windY * forward) / 110),
    },
    treeHit = false;
  if (!putt) {
    for (let i = 1; i <= 35; i++) {
      const t = i / 35,
        q = { x: p.x + (land.x - p.x) * t, y: p.y + (land.y - p.y) * t },
        z =
          Math.sin(t * Math.PI) * c.loft * forward * 0.13 +
          elev -
          heightAt(s, q);
      if (terrainAt(s, q) === 7 && z < 13 && t > 0.02) {
        land = q;
        treeHit = true;
        quality = "Clipped a tree";
        break;
      }
    }
  }
  let path = [{ ...p, z: 0 }],
    landingIndex = 0;
  if (!putt) {
    for (let i = 1; i <= 25; i++) {
      let t = i / 25;
      path.push({
        x: p.x + (land.x - p.x) * t,
        y: p.y + (land.y - p.y) * t,
        z: Math.sin(t * Math.PI) * c.loft * forward * 0.13,
      });
    }
    landingIndex = path.length - 1;
  }
  let end = { ...land },
    penalty = 0,
    holed = false,
    t = terrainAt(s, end),
    drop = null,
    roll = putt ? forward : forward * rollFactor,
    steps = Math.max(8, Math.min(60, Math.ceil(roll * 2)));
  if (putt) {
    end = { ...p };
    land = { ...p };
  }
  let velocity = putt ? forward / steps : roll / steps,
    dx = putt
      ? (Math.cos(a) * forward - Math.sin(a) * lateral) / steps
      : Math.cos(a) * velocity,
    dy = putt
      ? (Math.sin(a) * forward + Math.cos(a) * lateral) / steps
      : Math.sin(a) * velocity;
  if (!putt && (t === 4 || t === -1)) {
    penalty = 1;
    quality =
      t === 4 ? "Splash · penalty drop" : "Out of bounds · penalty drop";
  } else
    for (let i = 0; i < steps; i++) {
      let slope = slopeAt(s, end),
        tt = terrainAt(s, end),
        friction =
          tt === 3
            ? 0.13
            : tt === 5
              ? 0.35
              : tt === 0
                ? 0.68
                : tt === 7
                  ? 0.1
                  : tt === 2
                    ? 1
                    : 0.9;
      if (!putt && i === 0 && tt === 3) {
        quality = "Found the bunker";
        break;
      }
      let next = {
        x: end.x + dx * friction - slope.x * (putt ? 0.6 : 0.25),
        y: end.y + dy * friction - slope.y * (putt ? 0.6 : 0.25),
      };
      const close = segmentDistance(pin, end, next);
      if (
        tt === 2 &&
        close < (putt ? 0.7 : 0.45) &&
        (!putt || i > steps * 0.45 || forward < 4)
      ) {
        end = { ...pin };
        holed = true;
        quality = putt ? "Holed the putt!" : "In the cup!";
        path.push({ ...end, z: 0 });
        break;
      }
      end = next;
      path.push({
        ...end,
        z: !putt && i < 6 ? Math.abs(Math.sin((i / 6) * Math.PI)) * 2 : 0,
      });
      tt = terrainAt(s, end);
      if (tt === 4 || tt === -1) {
        penalty = 1;
        quality =
          tt === 4
            ? "Rolled into water · penalty drop"
            : "Out of bounds · penalty drop";
        break;
      }
      if (tt === 7) break;
    }
  if (penalty) {
    let safe = { ...p };
    for (let i = 0; i <= 100; i++) {
      let tt = i / 100,
        q = { x: p.x + (end.x - p.x) * tt, y: p.y + (end.y - p.y) * tt };
      if (terrainAt(s, q) === 4 || terrainAt(s, q) === -1) break;
      safe = q;
    }
    const l = landSize(s);
    drop = {
      x: clamp(safe.x - Math.cos(a) * 6, 3, l.w - 3),
      y: clamp(safe.y - Math.sin(a) * 6, 3, l.h - 3),
    };
    if ([4, -1].includes(terrainAt(s, drop))) drop = { ...p };
    end = drop;
  }
  if (!penalty && !holed && dist(end, pin) < 0.55 && terrainAt(s, end) === 2) {
    holed = true;
    end = { ...pin };
    quality = "In the cup!";
  }
  return {
    start: { ...p },
    land,
    end,
    drop,
    penalty,
    holed,
    quality,
    path,
    landingIndex,
    club: c.name,
    kind: c.kind,
    distance: dist(p, end),
    duration: putt ? 1.1 : 2.0,
    treeHit,
    remaining: dist(end, pin),
  };
}
function segmentDistance(p, a, b) {
  const x = b.x - a.x,
    y = b.y - a.y,
    v = x * x + y * y,
    t = v ? clamp(((p.x - a.x) * x + (p.y - a.y) * y) / v, 0, 1) : 0;
  return Math.hypot(a.x + t * x - p.x, a.y + t * y - p.y);
}
export function decideShot(s, g, p, h, route) {
  const direct = dist(p, h.pin),
    cs = clubs(g),
    t = terrainAt(s, p);
  if (t === 2 || direct < 4) {
    const c = cs[7],
      sl = slopeAt(s, p);
    return {
      club: c,
      power: clamp(direct / c.range, 0.025, 1.1),
      angle: Math.atan2(
        h.pin.y - p.y + sl.y * direct * 0.8,
        h.pin.x - p.x + sl.x * direct * 0.8,
      ),
      target: h.pin,
      reason: direct > 12 ? "Lagging toward the cup" : "Reading the putt",
    };
  }
  let candidates = [h.pin];
  route = route || routeToPin(s, h);
  let nearest = 0,
    nd = Infinity;
  route.forEach((q, i) => {
    let d = dist(p, q);
    if (d < nd) {
      nd = d;
      nearest = i;
    }
  });
  for (let i = nearest + 1; i < route.length; i += 2)
    if (dist(p, route[i]) < g.drive * 1.1) candidates.push(route[i]);
  const base = Math.atan2(h.pin.y - p.y, h.pin.x - p.x);
  for (let a = -1.2; a <= 1.2; a += 0.3)
    for (const r of [0.35, 0.6, 0.85, 1])
      candidates.push({
        x: p.x + Math.cos(base + a) * g.drive * r,
        y: p.y + Math.sin(base + a) * g.drive * r,
      });
  let best = null,
    bv = Infinity;
  for (const q of candidates) {
    let d = dist(p, q);
    if (d < 6) continue;
    let c = suggestClub(s, g, p, q);
    if (t === 3) c = cs[6];
    if (t === 7 || t === 5) c = d > 80 ? cs[4] : cs[5];
    let max = shotProfile(s, g, p, c, 1).range;
    if (d > max * 1.12) continue;
    let power = clamp(d / max, 0.08, 1),
      angle = Math.atan2(q.y - p.y, q.x - p.x),
      pr = shotProfile(s, g, p, c, power),
      risk = 0;
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
    ]) {
      let tt = terrainAt(s, {
        x: q.x + dx * pr.spread * 1.5,
        y: q.y + dy * pr.spread * 1.5,
      });
      risk +=
        tt === 4 || tt === -1
          ? 3
          : tt === 7
            ? 2.3
            : tt === 3
              ? 0.9
              : tt === 5
                ? 1.4
                : tt === 0
                  ? 0.35
                  : 0;
    }
    risk /= 7;
    let trees = 0;
    for (let j = 1; j < 16; j++) {
      let u = j / 16,
        pp = { x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u };
      if (
        terrainAt(s, pp) === 7 &&
        Math.sin(u * Math.PI) * c.loft * d * 0.13 < 13
      )
        trees += 0.25;
    }
    let remaining = dist(q, h.pin),
      routeCost = remaining / Math.max(100, g.drive * 0.75);
    if (route.length) {
      let qi = 0,
        qn = Infinity;
      route.forEach((v, i) => {
        let dd = dist(q, v);
        if (dd < qn) {
          qn = dd;
          qi = i;
        }
      });
      let rl = (route.length - 1 - qi) * 20;
      routeCost = Math.min(
        routeCost + 1,
        rl / Math.max(100, g.drive * 0.75) + qn / 100,
      );
    }
    let score =
      1 +
      routeCost +
      risk * (1.55 - g.risk) * (0.6 + g.management) +
      trees +
      (terrainAt(s, q) === 2 ? -0.32 : 0) +
      Math.random() * (1 - g.management) * 0.12;
    if (score < bv) {
      bv = score;
      best = {
        club: c,
        power,
        angle,
        target: q,
        reason:
          risk > 0.65
            ? "Taking the aggressive line"
            : d < g.drive * 0.55 && direct > d * 1.4
              ? "Laying up to safe ground"
              : trees
                ? "Punching out from the trees"
                : "Playing toward the green",
      };
    }
  }
  if (best) return best;
  let c = cs[5],
    angle = base;
  return {
    club: c,
    power: clamp(direct / c.range, 0.1, 1),
    angle,
    target: {
      x: p.x + Math.cos(angle) * c.range,
      y: p.y + Math.sin(angle) * c.range,
    },
    reason: "Looking for a recovery route",
  };
}
export function createVisit(g, holes, player = false) {
  return {
    id: uid(),
    golfer: g,
    player,
    holes: holes.map((h) => h.id),
    holeIndex: 0,
    ball: { ...holes[0].tee },
    pos: { ...holes[0].tee },
    strokes: 0,
    putts: 0,
    penalties: 0,
    scores: [],
    state: "waiting",
    timer: 0,
    shot: null,
    plan: null,
    mood: "Ready to play",
    thought: "A fresh course. Let’s see what it offers.",
    experiences: { water: 0, sand: 0, trees: 0, rough: 0, wait: 0, walk: 0 },
    fairwayHit: false,
    gir: false,
    finished: false,
    group: uid(),
    color: g.color || "#f2ce78",
  };
}
export function experienceThought(v, h, result) {
  let e = v.experiences,
    g = v.golfer;
  if (result.penalty) {
    e.water++;
    return [
      "That carry asks a lot of my game.",
      "I should have taken the safer route.",
      "Water wins this time.",
    ][(Math.random() * 3) | 0];
  }
  if (result.treeHit) {
    e.trees++;
    return [
      "The trees demand a smarter angle.",
      "Need to find a way out of these branches.",
    ][(Math.random() * 2) | 0];
  }
  if (result.holed) {
    if (v.strokes < h.par)
      return [
        "A birdie opportunity rewarded!",
        "That risk paid off. What a hole.",
        "I’ll remember that finish.",
      ][(Math.random() * 3) | 0];
    if (v.strokes > h.par + 2)
      return [
        "This hole is beyond my comfort zone.",
        "A tough finish. I need somewhere safe to miss.",
      ][(Math.random() * 2) | 0];
    return [
      "A fair test. I enjoyed that.",
      "This hole makes you think.",
      "That was a fun finish.",
    ][(Math.random() * 3) | 0];
  }
  if (result.kind === "putt" && v.putts >= 3)
    return "This green is making me work for every stroke.";
  if (result.remaining < 50)
    return g.skill > 0.7
      ? "A chance to get up and down."
      : "Finally close enough to see the cup.";
  return v.plan?.reason === "Laying up to safe ground"
    ? "No need to force it. There’s a safer route."
    : result.quality === "Excellent contact"
      ? "Caught that one perfectly."
      : "Let’s find a good angle for the next shot.";
}
