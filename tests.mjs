import assert from "node:assert/strict";
import {
  initialState,
  blankHole,
  brushStroke,
  analyzeHole,
  validateHole,
  T,
  terrainAt,
  dist,
} from "./world.js";
import {
  generateGolfer,
  createVisit,
  decideShot,
  executeShot,
  clubs,
} from "./golf.js";
import { Simulation, dailyCosts, EXPANSIONS } from "./simulation.js";
import { serialize, deserialize } from "./persistence.js";
let seed = 8210;
Math.random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
function paint(s, points, r, tool) {
  let tx = { cells: new Map(), cost: 0 };
  for (let i = 0; i < points.length; i++) {
    if (i) {
      const a = points[i - 1],
        b = points[i],
        n = Math.ceil(dist(a, b) / 4);
      for (let j = 1; j <= n; j++)
        brushStroke(
          s,
          { x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n },
          r,
          tool,
          tx,
        );
    } else brushStroke(s, points[i], r, tool, tx);
  }
  return tx.cost;
}
function course(kind) {
  let s = initialState(),
    h = s.holes[0];
  h.tee = { x: 80, y: 350 };
  h.green = { x: 480, y: 80 };
  h.pin = { ...h.green };
  h.par = 4;
  let path =
    kind === "straight"
      ? [h.tee, h.green]
      : kind === "dogleg"
        ? [h.tee, { x: 140, y: 150 }, h.green]
        : [h.tee, { x: 270, y: 330 }, { x: 260, y: 100 }, h.green];
  paint(s, path, 28, "fairway");
  paint(s, [h.green], 30, "green");
  if (kind === "island") {
    paint(s, [{ x: 460, y: 80 }], 60, "water");
    paint(s, [h.green], 30, "green");
  }
  if (kind === "double") {
    paint(s, [{ x: 370, y: 220 }], 24, "tree");
    paint(s, [{ x: 220, y: 110 }], 19, "sand");
  }
  h.open = true;
  s.opened = true;
  return { s, h };
}
let totals = {};
for (const kind of ["straight", "dogleg", "double", "island"]) {
  let scores = [];
  for (const k of [0.1, 0.4, 0.6, 0.85, 0.99]) {
    const { s, h } = course(kind),
      sim = new Simulation(s);
    s.opened = false;
    let v = createVisit(generateGolfer(k), [h]);
    sim.visits.push(v);
    for (let i = 0; i < 6000 && !v.finished; i++) sim.tick(0.25);
    assert(
      v.finished,
      `${kind} ${k}: golfer did not finish (${v.state}, strokes ${v.strokes})`,
    );
    assert(v.scores.length === 1);
    scores.push({
      type: v.golfer.archetype,
      score: v.scores[0].score,
      pickup: v.scores[0].pickup,
    });
  }
  totals[kind] = scores;
}
// Compare full shot execution distributions, not just labels.
let beginner = 0,
  scratch = 0;
for (let i = 0; i < 40; i++) {
  for (const [k, key] of [
    [0.1, "beginner"],
    [0.99, "scratch"],
  ]) {
    let { s, h } = course("straight");
    let sim = new Simulation(s);
    s.opened = false;
    let v = createVisit(generateGolfer(k), [h]);
    sim.visits.push(v);
    for (let j = 0; j < 5000 && !v.finished; j++) sim.tick(0.3);
    assert(v.finished);
    if (key === "beginner") beginner += v.scores[0].score;
    else scratch += v.scores[0].score;
  }
}
assert(scratch < beginner, "Skill should improve actual score");
// Hazard handling and same physics input usable by humans and AI.
{
  let { s, h } = course("straight"),
    g = generateGolfer(0.99),
    p = { x: 100, y: 100 };
  paint(s, [{ x: 180, y: 100 }], 45, "water");
  let shot = executeShot(s, g, p, h.pin, clubs(g)[5], 0.9, 0);
  assert(shot.penalty === 1);
  assert(terrainAt(s, shot.end) !== T.WATER);
}
// Admissions produce real income; rounds must finish under concurrent play.
{
  const { s } = course("straight"),
    sim = new Simulation(s);
  s.fee = 12;
  const initial = s.cash;
  for (let i = 0; i < 4500; i++) sim.tick(0.3);
  assert(s.lifetimeRevenue > 0);
  assert(
    s.totalServed >= 5,
    `Only ${s.totalServed} visits finished in traffic`,
  );
  assert(s.cash !== initial);
  console.log(
    "Traffic:",
    s.totalServed,
    "served; cash",
    s.cash,
    "active",
    sim.visits.map((v) => [v.state, v.strokes]),
  );
  s.staff.grounds = 1;
  const before = s.cash,
    cost = dailyCosts(s);
  sim.finishDay();
  assert(s.cash === before - cost);
  assert(s.day > 1);
}
// Serialized terrain/elevation and round state survive a versioned round trip.
{
  let { s, h } = course("double");
  paint(s, [h.green], 20, "raise");
  s.player.stats.holes = 7;
  s.activeVisits = [createVisit(s.player, [h], true)];
  assert(
    s.heights[Math.floor(h.green.y / 4) * 600 + Math.floor(h.green.x / 4)] > 0,
  );
  let copy = deserialize(serialize(s));
  assert.deepEqual([...copy.terrain], [...s.terrain]);
  assert(
    Math.abs(
      copy.heights[
        Math.floor(h.green.y / 4) * 600 + Math.floor(h.green.x / 4)
      ] -
        s.heights[Math.floor(h.green.y / 4) * 600 + Math.floor(h.green.x / 4)],
    ) < 0.011,
  );
  assert(copy.player.stats.holes === 7);
  assert(copy.activeVisits[0].player);
  assert(copy.version === 3);
  assert(validateHole(copy, copy.holes[0]) === null);
  assert(analyzeHole(copy, copy.holes[0]).length > 100);
}
assert.deepEqual(
  EXPANSIONS.map((x) => x.holes),
  [3, 6, 9, 18],
);
console.log("Course outcomes:", JSON.stringify(totals, null, 2));
console.log("Ability averages:", {
  beginner: beginner / 40,
  scratch: scratch / 40,
});

// Full-property routing and historical records across a real eighteen-hole round.
{
  const s = initialState();
  s.land = 4;
  s.capacity = 18;
  s.holes = [];
  s.opened = false;
  for (let i = 0; i < 18; i++) {
    let h = blankHole(i + 1),
      x = (i % 6) * 390,
      y = Math.floor(i / 6) * 570;
    h.tee = { x: x + 45, y: y + 435 };
    h.green = { x: x + 280, y: y + 90 };
    h.pin = { ...h.green };
    h.par = 4;
    h.open = true;
    paint(s, [h.tee, { x: x + 95, y: y + 210 }, h.green], 30, "fairway");
    paint(s, [h.green], 32, "green");
    s.holes.push(h);
  }
  const sim = new Simulation(s),
    v = createVisit(generateGolfer(0.99), s.holes);
  sim.visits.push(v);
  for (let i = 0; i < 20000 && !v.finished; i++) sim.tick(0.3);
  assert(v.finished, "18-hole round should finish");
  assert.equal(v.scores.length, 18);
  assert(s.records.eighteen);
  assert(s.recordHistory.length >= 1);
  assert(
    v.scores.every((h) => !h.pickup),
    "Playable full course should finish without pickups",
  );
  let nine = createVisit(generateGolfer(0.99), s.holes.slice(0, 9));
  sim.visits = [nine];
  for (let i = 0; i < 14000 && !nine.finished; i++) sim.tick(0.3);
  assert(nine.finished);
  assert(s.records.nine);
  console.log("Full course records:", {
    eighteen: s.records.eighteen.score,
    nine: s.records.nine.score,
  });
}

console.log("All simulation acceptance checks passed.");
