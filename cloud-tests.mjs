import assert from "node:assert/strict";
import { CloudStore, validateRegistration, splitSnapshot } from "./cloud.js";
import { LocalStore, serialize, deserialize } from "./persistence.js";
import { initialState, brushStroke, T, terrainAt, blankHole } from "./world.js";
import {
  selectFeature,
  planTransform,
  applyTransform,
  teeFor,
  teePar,
  staffAdvice,
  landingClusters,
} from "./design.js";
class MemoryStorage {
  constructor() {
    this.data = new Map();
  }
  getItem(k) {
    return this.data.get(k) || null;
  }
  setItem(k, v) {
    this.data.set(k, String(v));
  }
  removeItem(k) {
    this.data.delete(k);
  }
}
let calls = 0,
  tick = 0;
const documents = new Map();
const reply = (status, data) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});
const fail = (status, code) =>
  reply(status, { error: { status: code, message: code } });
async function firebase(url, options = {}) {
  calls++;
  if (url.includes("identitytoolkit")) {
    const body = JSON.parse(options.body);
    if (url.includes("sendOobCode")) return reply(200, {});
    assert(!body.password.includes("confirmation"));
    return reply(200, {
      localId: "owner",
      email: body.email,
      idToken: "owner",
      refreshToken: "refresh",
      expiresIn: "3600",
    });
  }
  if (url.includes("securetoken"))
    return reply(200, {
      id_token: "owner",
      refresh_token: "refresh",
      expires_in: "3600",
    });
  const u = new URL(url),
    path = u.pathname.split("/documents/")[1],
    method = options.method || "GET";
  if (
    !path?.startsWith(
      "users/" + options.headers.Authorization.split(" ")[1] + "/",
    )
  )
    return fail(403, "PERMISSION_DENIED");
  if (path.endsWith("/courses"))
    return reply(200, {
      documents: [...documents]
        .filter(([p]) => p.startsWith(path + "/") && p.split("/").length === 4)
        .map(([, d]) => d),
    });
  const old = documents.get(path);
  if (method === "GET") return old ? reply(200, old) : fail(404, "NOT_FOUND");
  if (method === "DELETE") {
    documents.delete(path);
    return reply(200, {});
  }
  if (u.searchParams.get("currentDocument.exists") === "false" && old)
    return fail(409, "ALREADY_EXISTS");
  if (
    u.searchParams.has("currentDocument.updateTime") &&
    old?.updateTime !== u.searchParams.get("currentDocument.updateTime")
  )
    return fail(400, "FAILED_PRECONDITION");
  const d = {
    name: "projects/wildlinks-1de54/databases/(default)/documents/" + path,
    fields: JSON.parse(options.body).fields,
    updateTime:
      "2026-10-07T18:00:" + String(tick++).padStart(2, "0") + ".000000Z",
  };
  documents.set(path, d);
  return reply(200, d);
}
assert.throws(
  () => validateRegistration("x@example.com", "abcdef", "different"),
  /match/,
);
assert.throws(() => validateRegistration("bad", "abcdef", "abcdef"), /email/);
assert.throws(() => validateRegistration("x@example.com", "abc", "abc"), /6/);
assert.equal(splitSnapshot("😃".repeat(160000)).join(""), "😃".repeat(160000));
const local = new MemoryStorage(),
  cloud = new CloudStore({ storage: local, fetcher: firebase });
await assert.rejects(
  cloud.login("x@example.com", "abcdef", "different", true),
  /match/,
);
assert.equal(calls, 0);
await cloud.login("x@example.com", "abcdef", "abcdef", true);
assert.equal(cloud.session.uid, "owner");
assert(!local.getItem("wild-links-account").includes("abcdef"));
cloud.ready = true;
let a = initialState();
a.name = "Cedar Creek";
a.player.xp = 10;
let saved;
cloud.onSaved = (meta) => {
  saved = meta;
  a.cloudBase = meta.updateTime;
};
cloud.queue(a, serialize(a), true);
clearTimeout(cloud.timer);
await cloud.flush();
assert(saved);
const rows = await cloud.list();
assert.equal(rows[0].name, "Cedar Creek");
assert.equal(rows[0].xp, 10);
const copy = deserialize(await cloud.load(rows[0]));
assert.equal(copy.courseId, a.courseId);
assert.deepEqual(copy.plots, a.plots);
const stale = new CloudStore({ storage: local, fetcher: firebase });
stale.ready = true;
stale.bases = { [a.courseId]: rows[0] };
const outdated = deserialize(serialize(a));
cloud.bases = { [a.courseId]: rows[0] };
a.cash = 7000;
cloud.queue(a, serialize(a), true);
clearTimeout(cloud.timer);
await cloud.flush();
outdated.cash = 1;
stale.queue(outdated, serialize(outdated), true);
clearTimeout(stale.timer);
await stale.flush();
assert(stale.blocked.has(a.courseId));
assert.equal(stale.status, "Choose save");
assert.equal(deserialize(await cloud.load((await cloud.list())[0])).cash, 7000);
const b = initialState();
b.name = "Second Course";
cloud.queue(a, serialize(a));
cloud.queue(b, serialize(b));
clearTimeout(cloud.timer);
await cloud.flush();
clearTimeout(cloud.timer);
await cloud.flush();
clearTimeout(cloud.timer);
assert.equal((await cloud.list()).length, 2);
cloud.session.expires = 0;
assert.equal(await cloud.token(), "owner");
await cloud.resetPassword("x@example.com");
const offline = new CloudStore({
  storage: local,
  fetcher: async () => {
    throw Error("offline");
  },
});
offline.ready = true;
offline.queue(b, serialize(b), true);
clearTimeout(offline.timer);
await offline.flush();
assert(offline.pending);
assert(offline.status.includes("local safe"));
const storage = new MemoryStorage(),
  guest = new LocalStore("guest", storage);
let old = initialState();
old.cash = 9999;
storage.setItem("wild-links-save", serialize(old));
assert.equal(guest.load().cash, 9999);
assert(guest.save(old));
const second = initialState();
second.name = "New Course";
assert(guest.save(second));
assert.equal(guest.list().length, 2);
assert.equal(guest.get(old.courseId).cash, 9999);
assert.equal(guest.load().courseId, second.courseId);
const ownerStore = new LocalStore("owner", storage);
assert.equal(ownerStore.list().length, 0);
assert.equal(ownerStore.load().cash, 5000);
const s = initialState(),
  h = s.holes[0];
h.tee = { x: 60, y: 300 };
h.pin = { x: 220, y: 100 };
h.green = { ...h.pin };
let tx = { cells: new Map(), cost: 0 };
brushStroke(s, h.pin, 24, "green", tx);
const feature = selectFeature(s, h.pin),
  plan = planTransform(s, feature, { x: 300, y: 180 }, 1.25),
  change = { cells: new Map(), cost: 0 };
applyTransform(s, feature, plan, change);
assert.equal(terrainAt(s, h.pin), T.GREEN);
assert(Math.abs(h.pin.x - 300) < 4);
assert(change.cost > 0);
assert.throws(() => planTransform(s, feature, { x: 800, y: 600 }, 1), /owned/);
h.tees.forward = { x: 180, y: 230 };
assert.deepEqual(teeFor(h, "forward"), h.tees.forward);
assert.equal(teePar(h, "forward"), 3);
assert.deepEqual(teeFor(h, "championship"), h.tee);
h.open = true;
assert(staffAdvice(s)[0].includes("groundskeeper"));
s.trails = [
  {
    hole: h.id,
    land: { x: 100, y: 100 },
    skill: 0.2,
    penalty: 1,
    memberId: "visitor",
  },
];
assert.equal(landingClusters(s)[0].penalties, 1);
await cloud.signOut();
assert.equal(local.getItem("wild-links-account"), null);
console.log(
  "Auth validation/session/refresh, cloud chunk round-trip, conflict protection, offline queue, multiple courses, legacy migration, transforms, tees and feedback: PASS",
);
