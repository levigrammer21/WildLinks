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
import { Simulation, dailyCosts } from "./simulation.js";
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
  assert(copy.version === 4);
  assert(validateHole(copy, copy.holes[0]) === null);
  assert(analyzeHole(copy, copy.holes[0]).length > 100);
}
console.log("Course outcomes:", JSON.stringify(totals, null, 2));
console.log("Ability averages:", {
  beginner: beginner / 40,
  scratch: scratch / 40,
});

// Full-property routing and historical records across a real eighteen-hole round.
{
  const s = initialState();
  s.land = 4;
  s.plots = [true, true, true, true];
  s.plotW = 1200;
  s.plotH = 900;
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
// Club progression, independently owned land, recurring identities and real practice.
{
  const {
    courseGoals,
    claimUpgrade,
    buyPlot,
    chooseVisitor,
    startTournament,
    eventBoard,
    finishTournament,
    staffStatus,
  } = await import("./club.js");
  const { ownedAt } = await import("./world.js");
  const s = initialState();
  assert.equal(s.capacity, 3);
  assert.deepEqual(s.plots, [true, false, false, false]);
  s.cash = 20000;
  assert.equal(buyPlot(s, 3), false);
  assert(buyPlot(s, 1));
  assert.equal(s.capacity, 3);
  assert(ownedAt(s, { x: 900, y: 200 }));
  assert(!ownedAt(s, { x: 200, y: 700 }));
  assert.equal(terrainAt(s, { x: 200, y: 700 }), -1);
  s.totalServed = 50;
  s.lifetimeRevenue = 5000;
  s.reputation = 60;
  assert(!courseGoals(s).ready);
  s.ownerRounds = [{ holes: 3, relative: 0, pickup: false }];
  assert(claimUpgrade(s));
  assert.equal(s.capacity, 6);
  assert.equal(claimUpgrade(s), false);
  const first = chooseVisitor(s, new Set(), 0.99);
  first.member.satisfaction = 90;
  const oldRandom = Math.random;
  Math.random = () => 0.1;
  const returned = chooseVisitor(s, new Set());
  assert.equal(returned.member.id, first.member.id);
  const different = chooseVisitor(s, new Set([first.member.id]));
  assert.notEqual(different.member.id, first.member.id);
  Math.random = oldRandom;
  assert(!startTournament(s, "six", "elite"));
  const base = course("straight");
  base.s.cash = 10000;
  base.s.capacity = 6;
  base.s.holes = Array.from({ length: 6 }, (_, i) => ({
    ...structuredClone(base.h),
    id: "event-hole-" + i,
    name: "Hole " + (i + 1),
  }));
  assert(startTournament(base.s, "six", "elite"));
  const sim = new Simulation(base.s);
  let entry = sim.spawn();
  assert(entry.golfer.skill >= 0.78);
  assert.equal(entry.holes.length, 6);
  assert.equal(entry.eventId, base.s.tournament.id);
  base.s.opened = false;
  for (let i = 0; i < 16000 && !entry.finished; i++) sim.tick(0.25);
  assert(entry.finished);
  assert.equal(eventBoard(base.s).length, 1);
  assert.equal(base.s.tournament.entries.length, 1);
  assert(finishTournament(base.s).winner);
  assert.equal(base.s.tournamentHistory.length, 1);
  assert.equal(staffStatus(s, "mechanic").active, false);
  s.staff.mechanic = 1;
  s.facilities.push("carts");
  assert(staffStatus(s, "mechanic").active);
  const practice = course("straight");
  practice.s.opened = false;
  practice.s.range = { tee: { x: 70, y: 120 }, target: { x: 70, y: 340 } };
  practice.s.facilities.push("range");
  practice.s.staff.pro = 1;
  const psim = new Simulation(practice.s),
    v = psim.spawn(0.6);
  v.state = "goingRange";
  v.rangeShots = 0;
  v.rangeBay = 0;
  for (let i = 0; i < 500 && v.rangeShots < 3; i++) psim.tick(0.1);
  assert.equal(v.rangeShots, 3);
  assert.equal(v.strokes, 0);
  assert.equal(practice.s.rangeStats.shots, 3);
  assert.equal(practice.s.rangeStats.revenue, 7);
  for (let i = 0; i < 8000 && !v.finished; i++) psim.tick(0.25);
  assert(v.finished);
  assert(practice.s.trails.length > 0);
  assert(practice.s.members[v.memberId].rounds > 0);
  const restored = deserialize(serialize(practice.s));
  assert.equal(restored.members[v.memberId].rounds, 1);
  assert.equal(restored.trails.length, practice.s.trails.length);
  const legacy = JSON.parse(serialize(practice.s));
  delete legacy.plots;
  delete legacy.plotW;
  delete legacy.plotH;
  delete legacy.ownerRounds;
  legacy.version = 3;
  legacy.land = 4;
  legacy.capacity = 18;
  legacy.player.stats.best = { holes: 9, relative: -1 };
  const migrated = deserialize(JSON.stringify(legacy));
  assert.equal(migrated.capacity, 18);
  assert.deepEqual(migrated.plots, [true, true, true, true]);
  assert(ownedAt(migrated, { x: 2390, y: 1790 }));
  assert.equal(migrated.ownerRounds[0].relative, -1);
  console.log(
    "Club progression, returning visitors, tournaments, practice, trails and legacy saves: PASS",
  );
}
