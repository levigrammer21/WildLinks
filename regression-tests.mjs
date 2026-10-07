import assert from "node:assert/strict";
import { initialState, brushStroke, T, terrainAt, dist } from "./world.js";
import { generateGolfer, decideShot, executeShot } from "./golf.js";
import { Simulation } from "./simulation.js";
import { serialize, deserialize } from "./persistence.js";
import { suggestRange, rangeFits } from "./range.js";
let seed = 19170;
Math.random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
function paint(s, p, r, tool) {
  brushStroke(s, p, r, tool, { cells: new Map(), cost: 0 });
}
// Recovery must genuinely move balls into open ground, including backward/sideways exits.
for (const layout of ["grove", "blocked-forward"]) {
  const s = initialState(),
    h = s.holes[0];
  h.tee = { x: 80, y: 200 };
  h.green = h.pin = { x: 450, y: 200 };
  h.open = true;
  paint(s, h.pin, 30, "green");
  paint(s, { x: 200, y: 200 }, 36, "tree");
  if (layout === "blocked-forward") paint(s, { x: 285, y: 200 }, 60, "water");
  let total = 0;
  for (let n = 0; n < 60; n++) {
    const g = generateGolfer(n % 2 ? 0.1 : 0.98);
    let p = { x: 198 + (n % 5), y: 196 + (n % 7) },
      shots = 0;
    while (terrainAt(s, p) === T.TREE && shots < 8) {
      const plan = decideShot(s, g, p, h, []);
      assert.equal(plan.club.kind, "recovery");
      const result = executeShot(
        s,
        g,
        p,
        h.pin,
        plan.club,
        plan.power,
        plan.angle,
      );
      assert(!result.penalty, "Recovery should avoid water");
      p = result.end;
      shots++;
    }
    assert.notEqual(
      terrainAt(s, p),
      T.TREE,
      `${layout}: golfer remained trapped`,
    );
    assert(shots <= 4, `${layout}: repeated recovery loop`);
    total += shots;
  }
  console.log(layout, "recovery shots average:", total / 60);
}
// Follow full sequential rounds after an actual tree lie, rather than only testing target selection.
{
  const s = initialState(),
    h = s.holes[0];
  h.tee = { x: 80, y: 200 };
  h.green = h.pin = { x: 450, y: 200 };
  h.open = true;
  paint(s, h.pin, 45, "green");
  paint(s, { x: 200, y: 200 }, 36, "tree");
  const sim = new Simulation(s);
  for (const ability of [0.1, 0.4, 0.65, 0.85, 0.98]) {
    const v = sim.spawn(ability);
    v.ball = { x: 200, y: 200 };
    v.pos = { ...v.ball };
    v.state = "walking";
    v.strokes = 1;
    for (let i = 0; i < 12000 && !v.finished; i++) sim.tick(0.25);
    assert(v.finished);
    assert(!v.scores[0].pickup, "Tree recovery round should finish in the cup");
  }
  console.log(
    "Five ability profiles recovered from trees and holed out through sequential simulation: PASS",
  );
}
// Mixed labels with no alternate tee must not repeatedly reset the same course record.
{
  const s = initialState(),
    h = s.holes[0];
  h.tee = { x: 60, y: 200 };
  h.green = h.pin = { x: 220, y: 200 };
  h.open = true;
  h.par = 4;
  paint(s, h.pin, 30, "green");
  const notices = [],
    sim = new Simulation(s, (m) => notices.push(m));
  function round(score, set = "standard", pickup = false) {
    const v = sim.spawn(0.98);
    v.teeSet = set;
    v.scores = [{ hole: h.id, score, par: 4, pickup }];
    sim.finishRound(v);
  }
  round(4);
  round(6, "forward");
  round(5, "championship");
  round(4);
  assert.equal(notices.filter((n) => n.startsWith("New ")).length, 1);
  assert.equal(s.records.overall.score, 4);
  round(3, "forward");
  assert.equal(s.records.overall.score, 3);
  assert.equal(notices.filter((n) => n.startsWith("New ")).length, 2);
  round(1, "standard", true);
  assert.equal(s.records.overall.score, 3);
  h.tees.forward = { x: 120, y: 200 };
  round(4, "forward");
  round(5, "standard");
  round(5, "forward");
  assert.equal(s.recordBook[h.id + ":forward"].score, 4);
  assert.equal(s.recordBook[h.id].score, 3);
  assert.equal(notices.filter((n) => n.startsWith("New ")).length, 3);
  const restored = deserialize(serialize(s));
  assert.equal(restored.records.overall.score, 3);
  assert.equal(restored.recordBook[h.id + ":forward"].score, 4);
  assert(restored.tutorialComplete);
  console.log(
    "Comparable records, ties, tee fallback, real alternate tees, pickup exclusion and reload: PASS",
  );
}
{
  const s = initialState();
  for (const tee of [
    { x: 65, y: 65 },
    { x: 300, y: 200 },
    { x: 530, y: 365 },
  ]) {
    const r = suggestRange(s, tee);
    assert(r);
    assert(rangeFits(s, r.tee, r.target));
    assert(dist(r.tee, r.target) >= 80);
  }
  assert(!rangeFits(s, { x: 10, y: 10 }, { x: 610, y: 10 }));
  console.log("One-tap range suggestions and owned corridor validation: PASS");
}
