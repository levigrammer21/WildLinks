import assert from "node:assert/strict";
import { initialState, T, brushStroke, terrainAt, dist } from "./world.js";
import { Navigation, onBridge } from "./navigation.js";
import { CourseLife, validateDecoration, spectatorAppeal } from "./life.js";
import { serialize, deserialize } from "./persistence.js";
const s = initialState(),
  nav = new Navigation(s),
  tx = { cells: new Map(), cost: 0 };
for (let y = 140; y <= 290; y += 4)
  brushStroke(s, { x: 250, y }, 36, "water", tx);
const start = { x: 160, y: 210 },
  goal = { x: 340, y: 210 },
  route = nav.plan(start, goal);
assert(route.length > 2);
for (let i = 1; i < route.length; i++) assert(nav.line(route[i - 1], route[i]));
const actor = { pos: { ...start } };
for (let i = 0; i < 1000 && !nav.move(actor, goal, 30, 0.1); i++)
  assert.equal(terrainAt(s, actor.pos) === T.WATER, false);
assert(dist(actor.pos, goal) < 2);
assert(nav.line(start, start));
s.decorations.push({ id: "bridge", type: "bridge", x: 250, y: 210, angle: 0 });
nav.invalidate();
assert(onBridge(s, { x: 250, y: 210 }));
assert(nav.line({ x: 210, y: 210 }, { x: 290, y: 210 }));
const island = initialState(),
  it = { cells: new Map(), cost: 0 };
brushStroke(island, { x: 300, y: 210 }, 65, "water", it);
brushStroke(island, { x: 300, y: 210 }, 20, "green", it);
const n2 = new Navigation(island);
assert(n2.plan({ x: 150, y: 210 }, { x: 300, y: 210 }).some((p) => p.ferry));
const boat = { pos: { x: 150, y: 210 } };
let ferry = false;
for (let i = 0; i < 1000 && dist(boat.pos, { x: 300, y: 210 }) > 2; i++) {
  n2.move(boat, { x: 300, y: 210 }, 30, 0.1);
  ferry ||= boat.travelMode === "ferry";
}
assert(ferry);
assert(dist(boat.pos, { x: 300, y: 210 }) < 2);
const live = initialState();
live.holes[0].tee = { x: 90, y: 160 };
live.holes[0].pin = { x: 450, y: 160 };
const lt = { cells: new Map(), cost: 0 };
for (let x = 90; x <= 450; x += 8)
  brushStroke(live, { x, y: 160 }, 24, "fairway", lt);
live.staff.grounds = 1;
live.staff.pro = 1;
live.facilities.push("range");
live.range = { tee: { x: 100, y: 280 }, target: { x: 300, y: 280 } };
const life = new CourseLife(live, new Navigation(live));
for (let i = 0; i < 600; i++) life.tick(0.1, []);
assert.equal(live.workers.length, 2);
assert(live.daily.groundWork > 0);
assert(live.workers.find((w) => w.role === "grounds").mower);
assert(
  dist(live.workers.find((w) => w.role === "pro").pos, live.range.tee) < 40,
);
live.decorations.push({ id: "stand", type: "stand", x: 330, y: 210 });
validateDecoration(live, live.decorations[0]);
const visit = {
  id: "star",
  ball: { x: 330, y: 160 },
  golfer: { skill: 0.9 },
  finished: false,
};
assert.equal(spectatorAppeal(live, visit), 1);
assert.equal(spectatorAppeal(live, {...visit,golfer:{skill:.3}}),0);
live.tournament={id:"open"};
assert.equal(spectatorAppeal(live,{...visit,eventId:"open",golfer:{skill:.3}}),1.5);
live.tournament=null;
const oldRandom = Math.random;
Math.random = () => 0;
const cash = live.cash;
for (let i = 0; i < 200; i++) life.tick(1, [visit]);
assert(live.fanStats.served >= 12);
assert.equal(live.cash - cash, live.fanStats.served * live.fanFee);
assert(live.fans.filter((f) => f.state !== "leaving").length <= 12);
const seated = live.fans.find((f) => f.state === "seated");
assert(seated);
life.react(visit, { holed: true, remaining: 0 });
assert(seated.cheer > 0);
visit.finished = true;
for (let i = 0; i < 600; i++) life.tick(1, [visit]);
assert.equal(live.fans.length, 0);
Math.random = oldRandom;
const restored = deserialize(serialize(live));
assert.equal(restored.decorations.length, 1);
assert.equal(restored.fanStats.revenue, live.fanStats.revenue);
assert.equal(restored.workers.length, 2);
assert.equal(restored.fanFee, 4);
console.log(
  "Dry routing, bridge crossing, island ferry, visible crew, actual maintenance, range pro, paid/capped spectators, cheering, departure and save restore: PASS",
);
