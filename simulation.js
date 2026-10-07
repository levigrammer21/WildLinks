import { playedHole, chooseTees, teeFor, addJournal } from "./design.js";
import {
  clamp,
  dist,
  terrainAt,
  T,
  uid,
  landSize,
  analyzeHole,
  routeToPin,
} from "./world.js";
import {
  generateGolfer,
  createVisit,
  decideShot,
  executeShot,
  experienceThought,
  clubs,
} from "./golf.js";
import { chooseVisitor, rememberRound, finishTournament } from "./club.js";
export const FACILITIES = [
  {
    id: "club",
    name: "Clubhouse",
    cost: 2200,
    upkeep: 24,
    description:
      "Comfortable check-in, seating and lockers. Better value and more patient visitors.",
  },
  {
    id: "shop",
    name: "Pro shop",
    cost: 1800,
    upkeep: 15,
    description:
      "Sell balls and essentials. Earn $3 per visitor with a check-in worker.",
  },
  {
    id: "range",
    name: "Driving range",
    cost: 2400,
    upkeep: 16,
    description:
      "Place a real practice area. Some visitors warm up before their round ($3); a professional adds $4 coaching income.",
  },
  {
    id: "practice",
    name: "Practice green",
    cost: 1200,
    upkeep: 9,
    description: "A welcoming warm-up area. Improves facilities satisfaction.",
  },
  {
    id: "carts",
    name: "Cart barn",
    cost: 3200,
    upkeep: 23,
    description:
      "Shorter walks between holes. A mechanic keeps carts available.",
  },
  {
    id: "maintenance",
    name: "Maintenance shed",
    cost: 1400,
    upkeep: 12,
    description:
      "Grounds crews can maintain more terrain with reliable equipment.",
  },
  {
    id: "food",
    name: "Halfway café",
    cost: 1700,
    upkeep: 15,
    description:
      "Food and drinks. A service worker earns $4 per golfer and restores patience.",
  },
  {
    id: "restrooms",
    name: "Restrooms",
    cost: 850,
    upkeep: 7,
    description: "Essential comfort on longer rounds. Reduces complaints.",
  },
];
export const STAFF = [
  {
    id: "grounds",
    name: "Groundskeeper",
    wage: 32,
    description: "Repairs daily wear. Large properties need more than one.",
  },
  {
    id: "desk",
    name: "Check-in worker",
    wage: 26,
    description: "Faster arrival spacing; operates the pro shop.",
  },
  {
    id: "mechanic",
    name: "Maintenance worker",
    wage: 30,
    description:
      "Enables faster cart travel when a cart barn is built. One worker is enough; groundskeepers handle course repairs.",
  },
  {
    id: "pro",
    name: "Golf professional",
    wage: 40,
    description: "Runs the range and attracts experienced golfers.",
  },
  {
    id: "service",
    name: "Café worker",
    wage: 24,
    description: "Serves visitors at the halfway café.",
  },
];
export function demand(s) {
  let n = s.holes.filter((h) => h.open).length;
  if (!n || !s.opened) return 0;
  const fair = 10 + n * 5 + s.reputation * 0.12 + s.facilities.length * 1.5,
    ratio = s.fee / fair;
  return clamp(
    (0.5 +
      s.reputation / 65 +
      Math.sqrt(n) * 0.25 +
      (s.facilities.includes("range") ? 0.2 : 0) +
      (s.tournament ? 0.3 : 0)) *
      (ratio > 1 ? Math.exp(-(ratio - 1) * 1.6) : 1.15),
    0.02,
    4,
  );
}
export function maintenanceCost(s) {
  let area = 0;
  for (let i = 0; i < s.terrain.length; i += 7)
    if ([1, 2, 3, 8, 9].includes(s.terrain[i])) area += 112;
  return Math.round(
    8 + area * 0.0008 + s.holes.filter((h) => h.open).length * 3,
  );
}
export function dailyCosts(s) {
  return (
    maintenanceCost(s) +
    FACILITIES.filter((f) => s.facilities.includes(f.id)).reduce(
      (a, f) => a + f.upkeep,
      0,
    ) +
    STAFF.reduce((a, f) => a + s.staff[f.id] * f.wage, 0)
  );
}
export class Simulation {
  constructor(s, notify = () => {}) {
    this.s = s;
    this.notify = notify;
    this.visits = [];
    this.arrival = 5;
    this.routes = new Map();
    this.analyses = new Map();
    this.seq = 0;
    this.playerVisit = null;
    this.onDaily = null;
    this.onRound = null;
    this.lastAdmission = -100;
  }
  route(h) {
    let key = h.id + ":" + h.revision;
    if (!this.routes.has(key)) {
      this.routes.set(key, routeToPin(this.s, h));
      if (this.routes.size > 100)
        this.routes.delete(this.routes.keys().next().value);
    }
    return this.routes.get(key);
  }
  analysis(h) {
    const key = h.id + ":" + h.revision;
    if (!this.analyses.has(key))
      this.analyses.set(key, analyzeHole(this.s, h, this.route(h)));
    return this.analyses.get(key);
  }
  invalidate() {
    this.routes.clear();
    this.analyses.clear();
  }
  startPlayer(holes, teeSet = "standard") {
    if (this.playerVisit && !this.playerVisit.finished) return this.playerVisit;
    let v = createVisit(
      this.s.player,
      holes.map((h) => playedHole(h, { teeSet })),
      true,
    );
    v.teeSet = teeSet;
    if (
      this.s.tournament &&
      holes.map((h) => h.id).join("|") === this.s.tournament.holes.join("|") &&
      teeSet === (this.s.tournament.teeSet || "standard")
    )
      v.eventId = this.s.tournament.id;
    this.visits.push(v);
    this.playerVisit = v;
    return v;
  }
  spawn(forced) {
    let holes = this.s.tournament
      ? this.s.tournament.holes
          .map((id) => this.s.holes.find((h) => h.id === id))
          .filter(Boolean)
      : this.s.holes.filter((h) => h.open);
    if (!holes.length) return null;
    const active = new Set(
      this.visits.filter((v) => !v.finished).map((v) => v.memberId),
    );
    let invited = null;
    if (this.s.tournament?.schedule && forced === undefined) {
      invited = this.s.tournament.schedule.find(
        (e) =>
          !e.admitted &&
          (e.day < this.s.day ||
            (e.day === this.s.day && e.minute <= this.s.minute)) &&
          !active.has(e.memberId),
      );
      if (!invited) return null;
    }
    const { profile, member } = chooseVisitor(
      this.s,
      active,
      forced,
      invited?.memberId,
    );
    if (invited) invited.admitted = true;
    const teeSet = this.s.tournament?.teeSet || chooseTees(profile);
    let v = createVisit(
      profile,
      holes.map((h) => playedHole(h, { teeSet })),
    );
    v.teeSet = teeSet;
    v.memberId = member.id;
    v.returning = member.visits > 1;
    if (v.returning && member.visits % 3 === 2) {
      this.notify(profile.name + " is back for visit " + member.visits + ".");
      addJournal(
        this.s,
        "A familiar face",
        profile.name + " returned for visit " + member.visits + ".",
        { memberId: member.id },
      );
    }
    v.eventId = this.s.tournament?.id || null;
    v.thought = v.returning
      ? `Back for visit ${member.visits}. Let's see how the course plays today.`
      : v.thought;
    v.basePatience = v.golfer.patience;
    if (this.s.facilities.includes("food") && this.s.staff.service)
      v.golfer.patience = Math.min(1, v.golfer.patience + 0.15);
    this.visits.push(v);
    let income =
      this.s.fee +
      (this.s.facilities.includes("shop") && this.s.staff.desk ? 3 : 0) +
      (this.s.facilities.includes("food") && this.s.staff.service ? 4 : 0);
    this.s.cash += income;
    this.s.daily.revenue += income;
    this.s.lifetimeRevenue += income;
    v.group = "group-" + Math.floor(this.seq++ / 2);
    v.pos = { x: 38 + (this.seq % 3) * 6, y: 44 };
    v.state = "between";
    const freeBay = [0, 1, 2].find(
      (b) =>
        !this.visits.some(
          (o) =>
            o !== v &&
            !o.finished &&
            ["goingRange", "rangeThinking", "rangeFlying"].includes(o.state) &&
            o.rangeBay === b,
        ),
    );
    if (
      freeBay !== undefined &&
      this.s.range &&
      this.s.facilities.includes("range") &&
      Math.random() < (this.s.staff.pro ? 0.7 : 0.48)
    ) {
      v.state = "goingRange";
      v.rangeShots = 0;
      v.rangeBay = freeBay;
    }
    return v;
  }
  tick(dt) {
    const s = this.s;
    dt = Math.min(dt, 4);
    s.minute += dt * 0.9;
    if (s.minute >= 1200 && this.visits.every((v) => v.finished || v.player)) {
      this.finishDay();
      return;
    }
    if (s.minute < 1080 && s.opened) {
      this.arrival -= dt;
      if (this.arrival <= 0) {
        if (
          this.visits.filter((v) => !v.finished && !v.player).length <
          Math.min(24, 5 + s.holes.length * 2)
        )
          this.spawn();
        this.arrival =
          clamp(38 / demand(s), 9, 350) *
          Math.max(0.55, 1 - s.staff.desk * 0.2);
      }
    }
    for (const v of this.visits) {
      if (v.finished) continue;
      let original = s.holes.find((x) => x.id === v.holes[v.holeIndex]);
      let h = original ? playedHole(original, v) : null;
      if (!h?.pin) {
        v.finished = true;
        continue;
      }
      v.timer += dt;
      if (["goingRange", "rangeThinking", "rangeFlying"].includes(v.state)) {
        this.warmup(v, dt);
        continue;
      }
      if (v.state === "waiting") {
        const occupied = this.visits.some(
          (o) =>
            o !== v &&
            !o.finished &&
            o.holes[o.holeIndex] === h.id &&
            !["goingRange", "rangeThinking", "rangeFlying"].includes(o.state) &&
            (o.state === "flying" ||
              (o.strokes === 0 && o.state !== "waiting") ||
              (dist(o.ball, h.tee) < 45 && o.state !== "waiting")),
        );
        if (occupied) {
          v.experiences.wait += dt;
          v.thought = "Waiting for the group ahead to move clear.";
          let q = this.visits
            .filter(
              (o) =>
                !o.finished &&
                o.state === "waiting" &&
                o.holes[o.holeIndex] === h.id,
            )
            .indexOf(v);
          v.pos = {
            x: h.tee.x - 8 - (q % 3) * 7,
            y: h.tee.y + 10 + Math.floor(q / 3) * 8,
          };
          continue;
        }
        v.pos = { ...v.ball };
        v.state = v.player ? "ready" : "thinking";
        v.timer = 0;
        v.thought = "Taking a look at the opening shot.";
      } else if (v.state === "thinking" && !v.player) {
        if (v.timer > 1 && !v.plan)
          v.plan = decideShot(s, v.golfer, v.ball, h, this.route(h));
        if (v.timer > 2.8) {
          const unsafe = this.visits.some(
            (o, i) =>
              o !== v &&
              !o.finished &&
              i < this.visits.indexOf(v) &&
              o.holes[o.holeIndex] === h.id &&
              dist(o.ball, v.plan.target) < 25 &&
              o.state !== "waiting",
          );
          if (unsafe) {
            v.experiences.wait += dt;
            v.thought = "Letting the group ahead clear the landing area.";
            continue;
          }
          this.hit(v, v.plan);
        }
      } else if (v.state === "flying") {
        if (v.timer >= v.shot.duration) this.land(v, h);
      } else if (v.state === "walking") {
        let d = dist(v.pos, v.ball);
        if (d < 3) {
          v.pos = { ...v.ball };
          v.state = v.player ? "ready" : "thinking";
          v.timer = 0;
          v.plan = null;
        } else {
          const step = Math.min(
            d,
            dt * (s.facilities.includes("carts") && s.staff.mechanic ? 55 : 30),
          );
          v.pos.x += ((v.ball.x - v.pos.x) / d) * step;
          v.pos.y += ((v.ball.y - v.pos.y) / d) * step;
        }
      } else if (v.state === "between") {
        const next = playedHole(
          s.holes.find((x) => x.id === v.holes[v.holeIndex]),
          v,
        );
        let d = dist(v.pos, next.tee);
        if (d < 4) {
          v.pos = { ...next.tee };
          v.ball = { ...next.tee };
          v.state = "waiting";
          v.timer = 0;
        } else {
          const step = Math.min(
            d,
            dt * (s.facilities.includes("carts") && s.staff.mechanic ? 60 : 32),
          );
          v.pos.x += ((next.tee.x - v.pos.x) / d) * step;
          v.pos.y += ((next.tee.y - v.pos.y) / d) * step;
          v.experiences.walk += dt;
          v.thought = "Walking to the next tee.";
        }
      }
    }
    this.visits = this.visits.filter(
      (v) => !v.finished || v.player || v.timer < 15,
    );
    for (const v of this.visits) if (v.finished) v.timer += dt;
  }
  warmup(v, dt) {
    const s = this.s,
      r = s.range;
    if (!r) {
      v.state = "between";
      return;
    }
    const tee = { x: r.tee.x + (v.rangeBay || 0) * 6, y: r.tee.y };
    if (v.state === "goingRange") {
      const d = dist(v.pos, tee),
        step = Math.min(d, dt * 32);
      if (d > 3) {
        v.pos.x += ((tee.x - v.pos.x) / d) * step;
        v.pos.y += ((tee.y - v.pos.y) / d) * step;
        v.thought = "Heading to the range before my tee time.";
        return;
      }
      v.pos = { ...tee };
      v.ball = { ...tee };
      v.state = "rangeThinking";
      v.timer = 0;
      const income = 3 + (s.staff.pro ? 4 : 0);
      s.cash += income;
      s.daily.revenue += income;
      s.lifetimeRevenue += income;
      s.rangeStats.revenue += income;
      s.rangeStats.visits++;
      if (s.members[v.memberId]) s.members[v.memberId].warmups++;
    } else if (v.state === "rangeThinking" && v.timer > 1.5) {
      const club = clubs(v.golfer)[v.rangeShots % 2 === 0 ? 0 : 3],
        angle = Math.atan2(r.target.y - tee.y, r.target.x - tee.x);
      v.rangeShot = executeShot(
        s,
        v.golfer,
        tee,
        r.target,
        club,
        Math.min(1, dist(tee, r.target) / club.range),
        angle,
      );
      v.state = "rangeFlying";
      v.timer = 0;
      v.thought = s.staff.pro
        ? "The pro is helping me settle into my swing."
        : "A few balls to find my rhythm.";
    } else if (v.state === "rangeFlying" && v.timer >= v.rangeShot.duration) {
      s.rangeStats.shots++;
      v.rangeShots++;
      v.golfer.confidence = clamp(
        v.golfer.confidence + (s.staff.pro ? 0.04 : 0.02),
        0.1,
        0.95,
      );
      if (v.rangeShots >= 3) {
        v.state = "between";
        const h = s.holes.find((h) => h.id === v.holes[0]);
        v.ball = { ...teeFor(h, v.teeSet) };
        v.rangeShot = null;
        v.thought = "Warmed up. Time for the first tee.";
      } else {
        v.state = "rangeThinking";
        v.ball = { ...tee };
      }
      v.timer = 0;
    }
  }
  hit(v, plan) {
    if (v.state !== "ready" && v.state !== "thinking") return false;
    let h = this.s.holes.find((x) => x.id === v.holes[v.holeIndex]);
    v.plan = plan;
    v.shot = executeShot(
      this.s,
      v.golfer,
      v.ball,
      h.pin,
      plan.club,
      plan.power,
      plan.angle,
    );
    v.strokes++;
    if (plan.club.kind === "putt") v.putts++;
    v.state = "flying";
    v.timer = 0;
    v.thought = plan.reason || "Here goes.";
    return true;
  }
  land(v, h) {
    let r = v.shot;
    this.s.trails ||= [];
    this.s.trails.push({
      hole: h.id,
      teeSet: v.teeSet || "standard",
      memberId: v.memberId || (v.player ? "owner" : "visitor-" + v.id),
      name: v.golfer.name,
      skill: v.golfer.skill,
      day: this.s.day,
      start: r.start,
      land: r.land,
      end: r.end,
      penalty: r.penalty,
      kind: r.kind,
      quality: r.quality,
      points: r.path
        .filter((_, i) => i % 4 === 0)
        .map((p) => ({ x: p.x, y: p.y })),
    });
    if (this.s.trails.length > 1200)
      this.s.trails.splice(0, this.s.trails.length - 1200);
    if (r.holed && r.distance > 20)
      addJournal(
        this.s,
        "A shot to remember",
        v.golfer.name +
          " holed a " +
          Math.round(r.distance) +
          " yd " +
          r.club +
          " on " +
          h.name +
          ".",
        { hole: h.id, memberId: v.memberId || "owner" },
      );
    v.ball = { ...r.end };
    v.strokes += r.penalty;
    v.penalties += r.penalty;
    if (v.player && !r.penalty && r.kind !== "putt" && v.strokes > 1) {
      v.golfer.stats.closest =
        v.golfer.stats.closest === null
          ? r.remaining
          : Math.min(v.golfer.stats.closest, r.remaining);
    }
    v.golfer.confidence = clamp(
      v.golfer.confidence +
        (r.penalty
          ? -0.035
          : r.quality === "Excellent contact"
            ? 0.018
            : r.holed
              ? 0.025
              : -0.003),
      0.1,
      0.95,
    );
    if (r.kind === "putt" && r.holed)
      recordMax(h.stats, "putt", r.distance, v, this.s.day);
    if (v.strokes === 1 && !r.penalty) {
      recordMax(h.stats, "drive", r.distance, v, this.s.day);
      v.fairwayHit = [1, 2].includes(terrainAt(this.s, v.ball));
      if (v.player) {
        v.golfer.stats.drives++;
        if (v.fairwayHit) v.golfer.stats.fairways++;
        v.golfer.stats.longestDrive = Math.max(
          v.golfer.stats.longestDrive,
          r.distance,
        );
      }
    }
    if (terrainAt(this.s, v.ball) === 2 && v.strokes <= h.par - 2) v.gir = true;
    if (
      !r.penalty &&
      r.kind !== "putt" &&
      v.strokes > 1 &&
      (!h.stats.approach || r.remaining < h.stats.approach.value)
    )
      h.stats.approach = {
        name: v.golfer.name,
        value: r.remaining,
        day: this.s.day,
      };
    let t = terrainAt(this.s, v.ball);
    if (t === 3) v.experiences.sand++;
    if (t === 0 || t === 5) v.experiences.rough++;
    v.thought = experienceThought(v, h, r);
    v.mood = r.penalty
      ? "Frustrated"
      : r.holed && v.strokes <= h.par
        ? "Delighted"
        : v.strokes > h.par + 2
          ? "Challenged"
          : "Focused";
    if (r.holed) {
      this.finishHole(v, h);
    } else if (v.strokes >= Math.max(12, h.par + 9)) {
      v.thought = "Picking up at the stroke limit. This layout beat me today.";
      this.finishHole(v, h, true);
    } else {
      v.state = "walking";
      v.timer = 0;
    }
  }
  finishHole(v, h, pickup = false) {
    let st = h.stats,
      score = v.strokes,
      rel = score - h.par;
    h.teeStats ||= {};
    const ts = (h.teeStats[v.teeSet || "standard"] ||= { n: 0, total: 0 });
    ts.n++;
    ts.total += score;
    h.revisionStats ||= {};
    const rev = (h.revisionStats[h.revision] ||= { n: 0, total: 0 });
    rev.n++;
    rev.total += score;
    st.plays++;
    st.total += score;
    let b = v.golfer.skill < 0.35 ? 0 : v.golfer.skill < 0.8 ? 1 : 2;
    st.buckets[b].n++;
    st.buckets[b].total += score;
    st[
      rel < 0 ? "birdies" : rel === 0 ? "pars" : rel === 1 ? "bogeys" : "double"
    ]++;
    if (!st.low || score < st.low.value)
      st.low = { name: v.golfer.name, value: score, day: this.s.day };
    if (score === 1 && !pickup) {
      st.aces.push({ name: v.golfer.name, day: this.s.day });
      this.notify(`Hole in one! ${v.golfer.name} aces ${h.name}.`);
    }
    v.scores.push({
      hole: h.id,
      name: h.name,
      par: h.par,
      teeSet: v.teeSet || "standard",
      score,
      putts: v.putts,
      pickup,
    });
    if (v.player) {
      let p = v.golfer,
        ps = p.stats;
      ps.holes++;
      ps.strokes += score;
      ps.putts += v.putts;
      if (v.gir) ps.gir++;
      ps[
        rel <= -2
          ? "eagles"
          : rel === -1
            ? "birdies"
            : rel === 0
              ? "pars"
              : rel === 1
                ? "bogeys"
                : "double"
      ]++;
      if (score === 1 && !pickup) ps.aces++;
      if (v.shot.kind === "putt" && v.shot.holed)
        ps.longestPutt = Math.max(ps.longestPutt, v.shot.distance);
      if (h.stats.approach?.name === p.name)
        ps.closest =
          ps.closest === null
            ? h.stats.approach.value
            : Math.min(ps.closest, h.stats.approach.value);
      p.xp++;
      for (const key of [
        "skill",
        "accuracy",
        "iron",
        "wedge",
        "putting",
        "recovery",
        "bunker",
      ])
        p[key] = Math.min(0.96, p[key] + 0.0012 * (1 - p[key]));
      p.drive = Math.min(290, p.drive + 0.05);
      this.notify(
        `${h.name}: ${score} (${relative(rel)})${pickup ? " · picked up" : ""}`,
      );
    }
    v.holeIndex++;
    if (v.holeIndex >= v.holes.length) this.finishRound(v);
    else {
      v.state = "between";
      v.timer = 0;
      v.strokes = 0;
      v.putts = 0;
      v.plan = null;
      v.gir = false;
      v.fairwayHit = false;
    }
  }
  finishRound(v) {
    let s = this.s,
      total = v.scores.reduce((a, h) => a + h.score, 0),
      par = v.scores.reduce((a, h) => a + h.par, 0),
      rel = total - par,
      rec = {
        name: v.golfer.name,
        score: total,
        relative: rel,
        holes: v.scores.length,
        day: s.day,
        layout:
          v.holes.join(",") +
          (v.teeSet && v.teeSet !== "standard" ? ":" + v.teeSet : ""),
        teeSet: v.teeSet || "standard",
        player: v.player,
        memberId: v.memberId || "owner",
        pickup: v.scores.some((h) => h.pickup),
      };
    let key =
      rec.holes === 18 ? "eighteen" : rec.holes === 9 ? "nine" : "overall";
    if (
      !s.records[key] ||
      s.records[key].layout !== rec.layout ||
      rel < s.records[key].relative
    ) {
      s.recordHistory ||= [];
      s.recordHistory.unshift({ ...rec, category: key });
      addJournal(
        s,
        "Course record",
        rec.name +
          " shot " +
          total +
          " (" +
          relative(rel) +
          ") from " +
          rec.teeSet +
          " tees over " +
          rec.holes +
          " holes.",
        { memberId: rec.memberId },
      );
      s.recordHistory = s.recordHistory.slice(0, 100);
      s.records[key] = rec;
      this.notify(
        `New ${rec.holes}-hole course record: ${rec.name}, ${total} (${relative(rel)}).`,
      );
    }
    s.recordBook ||= {};
    const bk = rec.layout;
    if (!s.recordBook[bk] || rec.relative < s.recordBook[bk].relative)
      s.recordBook[bk] = { ...rec };
    let personal = v.player ? "personal" : "ai";
    if (
      !s.records[personal] ||
      s.records[personal].layout !== rec.layout ||
      rel < s.records[personal].relative
    )
      s.records[personal] = rec;
    if (v.player) {
      s.player.stats.rounds++;
      s.ownerRounds.unshift({ ...rec });
      s.ownerRounds = s.ownerRounds.slice(0, 100);
      if (
        !s.player.stats.best ||
        s.player.stats.best.layout !== rec.layout ||
        rel < s.player.stats.best.relative
      )
        s.player.stats.best = rec;
      if (
        rec.holes === 9 &&
        (!s.player.stats.bestNine || rel < s.player.stats.bestNine.relative)
      )
        s.player.stats.bestNine = rec;
      if (
        rec.holes === 18 &&
        (!s.player.stats.bestEighteen ||
          rel < s.player.stats.bestEighteen.relative)
      )
        s.player.stats.bestEighteen = rec;
      this.onRound?.(v, rec);
    } else {
      let e = v.experiences,
        quality = clamp(
          85 -
            e.water * (v.golfer.risk > 0.75 ? 4 : 9) -
            e.trees * 4 -
            Math.max(0, rel - v.scores.length * (1 - v.golfer.skill) * 2.7) * 4,
          12,
          98,
        ),
        value = clamp(
          95 -
            (s.fee / (10 + v.scores.length * 5 + s.reputation * 0.12) - 0.5) *
              40,
          5,
          100,
        ),
        pace = clamp(
          95 - e.wait / (4 + v.golfer.patience * 7) - e.walk / 90,
          10,
          100,
        ),
        fac = clamp(
          45 +
            s.facilities.length * 7 -
            (v.holes.length > 6 && !s.facilities.includes("restrooms")
              ? 20
              : 0),
          10,
          100,
        ),
        beauty =
          v.holes.reduce(
            (a, id) =>
              a +
              (this.analysis(s.holes.find((h) => h.id === id))?.scenery || 35),
            0,
          ) / v.holes.length,
        sat =
          quality * 0.42 +
          value * 0.2 +
          pace * 0.15 +
          s.conditions * 0.15 +
          fac * 0.04 +
          beauty * 0.04;
      const architectures = v.holes.map((id) =>
          this.analysis(s.holes.find((h) => h.id === id)),
        ),
        variety =
          architectures.reduce((a, h) => a + (h?.variety || 0), 0) /
          v.holes.length;
      const mismatch = Math.max(
        0,
        Math.abs(rel / v.holes.length - (2.5 - v.golfer.preferred * 3.3)) - 1.4,
      );
      sat = clamp(
        sat -
          mismatch * 4 -
          (v.golfer.skill > 0.8 && variety < 15 && rel < -v.holes.length
            ? 6
            : 0),
        5,
        100,
      );
      let complaint =
        e.water >= 2
          ? "Forced carries"
          : e.wait > 40
            ? "Pace of play"
            : value < 50
              ? "Green fee"
              : s.conditions < 60
                ? "Course conditions"
                : e.trees > 2
                  ? "Tree trouble"
                  : quality < 55
                    ? "Unforgiving holes"
                    : "Enjoyed the course";
      if (complaint === "Enjoyed the course" && beauty > 65)
        v.thought = [
          "A beautiful setting for a thoughtful round.",
          "The scenery made that round feel special.",
        ][(Math.random() * 2) | 0];
      else if (
        complaint === "Enjoyed the course" &&
        v.golfer.skill > 0.8 &&
        variety < 15 &&
        rel < -v.holes.length
      )
        v.thought = "Pleasant golf, but I’d enjoy another strategic choice.";
      else if (
        complaint === "Enjoyed the course" &&
        e.sand &&
        rel <= v.holes.length
      )
        v.thought =
          "Clever bunker placement. Good recovery shots get rewarded.";
      s.reviews.unshift({
        name: v.golfer.name,
        archetype: v.golfer.archetype,
        score: total,
        relative: rel,
        holes: v.scores.length,
        satisfaction: Math.round(sat),
        text:
          complaint === "Enjoyed the course"
            ? v.thought
            : complaint === "Pace of play"
              ? "Enjoyed the golf, but spent too long waiting."
              : complaint === "Green fee"
                ? "The fee felt steep for what’s here."
                : complaint === "Course conditions"
                  ? "The course needs more care."
                  : v.thought,
        dimensions: {
          quality: Math.round(quality),
          value: Math.round(value),
          pace: Math.round(pace),
          beauty: Math.round(beauty),
          conditions: Math.round(s.conditions),
          facilities: fac,
        },
        complaint,
        day: s.day,
      });
      s.reviews = s.reviews.slice(0, 60);
      s.reputation = clamp(s.reputation * 0.97 + sat * 0.03, 10, 98);
      s.daily.served++;
      s.totalServed++;
      s.daily.satisfaction.push(sat);
      s.daily.complaints[complaint] = (s.daily.complaints[complaint] || 0) + 1;
      s.conditions = clamp(s.conditions - 0.16 * v.holes.length, 10, 100);
      rememberRound(s, v, rec, Math.round(sat));
    }
    if (
      s.tournament &&
      v.eventId === s.tournament.id &&
      v.holes.join(",") === s.tournament.holes.join(",") &&
      (v.teeSet || "standard") === (s.tournament.teeSet || "standard") &&
      !rec.pickup
    ) {
      s.tournament.entries.push(rec);
      if (!v.player) {
        s.cash += s.tournament.entryFee;
        s.daily.revenue += s.tournament.entryFee;
        s.lifetimeRevenue += s.tournament.entryFee;
      }
    }
    v.finished = true;
    v.state = "finished";
    v.timer = 0;
    this.achievements();
  }
  achievements() {
    let s = this.s;
    for (const [key, yes, reward, message] of [
      ["first", s.totalServed >= 1, 250, "First happy customer"],
      ["ten", s.totalServed >= 10, 500, "Ten rounds in the books"],
      [
        "architect",
        s.holes.filter((h) => h.open).length >= 3,
        750,
        "Three-hole architect",
      ],
      ["reputation", s.reputation >= 75, 1000, "A course worth talking about"],
      ["owner", s.player.stats.holes >= 9, 400, "Owner’s first nine"],
      [
        "full",
        s.holes.filter((h) => h.open).length === 18,
        4000,
        "Eighteen holes of your own",
      ],
    ])
      if (yes && !s.achievements.includes(key)) {
        s.achievements.push(key);
        s.cash += reward;
        this.notify(`${message} · $${reward} grant`);
      }
  }
  finishDay() {
    let s = this.s,
      expenses = dailyCosts(s);
    s.cash -= expenses;
    s.daily.expenses += expenses;
    let area = Math.max(1, s.holes.filter((h) => h.open).length),
      crew = s.staff.grounds * (s.facilities.includes("maintenance") ? 12 : 7);
    s.conditions = clamp(s.conditions + crew - area * 0.6, 10, 100);
    if (s.tournament && s.day >= s.tournament.ends) {
      const result = finishTournament(s);
      this.notify(
        result.winner
          ? `${result.name}: ${result.winner.name} wins with ${result.winner.score}.`
          : `${result.name} ended without a completed competitive round.`,
      );
    }
    let summary = {
      day: s.day,
      ...s.daily,
      satisfaction: s.daily.satisfaction.length
        ? Math.round(
            s.daily.satisfaction.reduce((a, b) => a + b, 0) /
              s.daily.satisfaction.length,
          )
        : null,
      conditions: Math.round(s.conditions),
    };
    s.history.unshift(summary);
    s.history = s.history.slice(0, 60);

    s.day++;
    s.minute = 480;
    s.daily = {
      revenue: 0,
      expenses: 0,
      served: 0,
      satisfaction: [],
      complaints: {},
    };
    let wind = Math.random() * Math.PI * 2,
      strength = Math.random() * 4;
    s.weather = {
      name:
        strength > 2.5
          ? "Breezy"
          : strength > 1
            ? "Light breeze"
            : "Clear skies",
      windX: Math.cos(wind) * strength,
      windY: Math.sin(wind) * strength,
    };
    this.onDaily?.(summary);
    this.notify(
      `Day ${summary.day}: $${Math.round(summary.revenue - expenses)} net · ${summary.served} rounds finished.`,
    );
  }
}
function recordMax(stats, key, value, v, day) {
  if (!stats[key] || value > stats[key].value)
    stats[key] = {
      name: v.golfer.name,
      memberId: v.memberId || "owner",
      value,
      day,
    };
}
export const relative = (x) => (x === 0 ? "E" : x > 0 ? "+" + x : String(x));
