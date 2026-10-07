import { clamp, uid, landPlots } from "./world.js";
import { generateGolfer } from "./golf.js";

export const UPGRADES = [
  {
    name: "Community Course",
    capacity: 6,
    visitors: 50,
    revenue: 5000,
    reputation: 60,
    ownerHoles: 3,
    reward: 750,
  },
  {
    name: "Established Club",
    capacity: 9,
    visitors: 150,
    revenue: 18000,
    reputation: 67,
    ownerHoles: 6,
    reward: 1500,
  },
  {
    name: "Destination Course",
    capacity: 18,
    visitors: 400,
    revenue: 60000,
    reputation: 75,
    ownerHoles: 9,
    reward: 3000,
  },
];
export const SIDE_GOALS = [
  {
    id: "named",
    name: "Make it yours",
    text: "Give three holes their own names.",
    target: 3,
    value: (s) =>
      s.holes.filter((h) => h.name && !/^Hole \d+$/.test(h.name)).length,
    reward: 300,
  },
  {
    id: "regulars",
    name: "Familiar faces",
    text: "Have 10 different golfers return for another visit.",
    target: 10,
    value: (s) =>
      Object.values(s.members || {}).filter((m) => m.visits >= 2).length,
    reward: 600,
  },
  {
    id: "warmup",
    name: "Warm welcome",
    text: "Let 25 visitors warm up at the driving range.",
    target: 25,
    value: (s) => s.rangeStats?.visits || 0,
    reward: 500,
  },
  {
    id: "event",
    name: "Tournament host",
    text: "Complete your first club tournament.",
    target: 1,
    value: (s) => (s.tournamentHistory || []).filter((t) => t.winner).length,
    reward: 800,
  },
];
export function courseGoals(s) {
  const u = UPGRADES[s.courseLevel || 0];
  if (!u) return null;
  const parRound = s.ownerRounds?.some(
    (r) => r.holes >= u.ownerHoles && r.relative <= 0 && !r.pickup,
  );
  return {
    upgrade: u,
    checks: [
      {
        name: "Visitor rounds completed",
        value: s.totalServed,
        target: u.visitors,
      },
      {
        name: "Lifetime visitor revenue",
        value: Math.round(s.lifetimeRevenue),
        target: u.revenue,
        money: true,
      },
      {
        name: "Course reputation",
        value: Math.floor(s.reputation),
        target: u.reputation,
      },
      {
        name: `Shoot par or better over ${u.ownerHoles}+ holes`,
        value: parRound ? 1 : 0,
        target: 1,
      },
    ],
    ready:
      s.totalServed >= u.visitors &&
      s.lifetimeRevenue >= u.revenue &&
      s.reputation >= u.reputation &&
      parRound,
  };
}
export function claimUpgrade(s) {
  let g = courseGoals(s);
  if (!g?.ready) return false;
  s.courseLevel = (s.courseLevel || 0) + 1;
  s.capacity = Math.max(s.capacity, g.upgrade.capacity);
  s.cash += g.upgrade.reward;
  s.upgradeHistory.push({
    name: g.upgrade.name,
    day: s.day,
    capacity: s.capacity,
  });
  return g.upgrade;
}
export function buyPlot(s, id) {
  const p = landPlots(s)[id];
  if (!p || p.owned) return false;
  const neighbor = landPlots(s).some(
    (q) =>
      q.owned &&
      ((q.row === p.row && Math.abs(q.col - p.col) === 1) ||
        (q.col === p.col && Math.abs(q.row - p.row) === 1)),
  );
  if (!neighbor || s.cash < p.cost) return false;
  s.cash -= p.cost;
  s.daily.expenses += p.cost;
  s.plots[id] = true;
  return p;
}
export function chooseVisitor(s, active, forced) {
  s.members ||= {};
  const event = s.tournament,
    eligible = (g) =>
      !event ||
      event.audience === "open" ||
      (event.audience === "beginners" && g.skill < 0.46) ||
      (event.audience === "club" && g.skill >= 0.35 && g.skill < 0.8) ||
      (event.audience === "elite" && g.skill >= 0.78);
  const available = Object.values(s.members).filter(
    (m) => !active.has(m.id) && eligible(m.profile),
  );
  let member = null;
  if (
    forced === undefined &&
    available.length &&
    Math.random() < clamp(0.2 + s.reputation * 0.004, 0.25, 0.7)
  ) {
    const weighted = available.map((m) => ({
        m,
        w:
          Math.max(0.1, (m.satisfaction || 55) / 100) *
          Math.max(0.1, m.loyalty || 0.5) *
          (s.day - (m.lastDay || 0) + 1),
      })),
      sum = weighted.reduce((a, b) => a + b.w, 0);
    let pick = Math.random() * sum;
    for (const a of weighted) {
      pick -= a.w;
      if (pick <= 0) {
        member = a.m;
        break;
      }
    }
    member ||= available[0];
  }
  if (!member) {
    let profile = generateGolfer(
      forced ??
        (Math.random() <
        0.08 +
          Math.max(0, s.reputation - 60) * 0.004 +
          (s.staff.pro && s.facilities.includes("range") ? 0.04 : 0)
          ? 0.99
          : undefined),
    );
    if (event && forced === undefined) {
      for (let i = 0; i < 30 && !eligible(profile); i++)
        profile = generateGolfer(
          event.audience === "beginners"
            ? 0.1
            : event.audience === "elite"
              ? 0.99
              : event.audience === "club"
                ? 0.5
                : undefined,
        );
    }
    const id = uid();
    profile.memberId = id;
    member = {
      id,
      profile,
      visits: 0,
      rounds: 0,
      lastDay: null,
      satisfaction: 55,
      loyalty: 0.5,
      best: null,
      holeHistory: {},
      warmups: 0,
    };
    s.members[id] = member;
  }
  member.visits++;
  member.lastDay = s.day;
  return { profile: { ...member.profile }, member };
}
export function rememberRound(s, v, rec, satisfaction) {
  if (v.player) return;
  const m = s.members[v.memberId];
  if (!m) return;
  m.profile = { ...v.golfer, patience: v.basePatience ?? v.golfer.patience };
  m.rounds++;
  m.satisfaction = satisfaction;
  m.loyalty = clamp(
    (m.loyalty || 0.5) * 0.8 + (satisfaction / 100) * 0.2,
    0.08,
    1,
  );
  if (!m.best || m.best.layout !== rec.layout || rec.relative < m.best.relative)
    m.best = { ...rec };
  for (const score of v.scores) {
    const h = (m.holeHistory[score.hole] ||= { n: 0, strokes: 0, last: 0 });
    h.n++;
    h.strokes += score.score;
    h.last = score.score;
  }
}
export const EVENTS = [
  { id: "six", name: "Six-hole Club Open", holes: 6, cost: 350 },
  { id: "nine", name: "Nine-hole Invitational", holes: 9, cost: 600 },
  { id: "eighteen", name: "Club Championship", holes: 18, cost: 1200 },
];
export function startTournament(s, eventId, audience) {
  const e = EVENTS.find((e) => e.id === eventId),
    holes = s.holes.filter((h) => h.open).slice(0, e?.holes || 0);
  if (!e || s.tournament || s.cash < e.cost || holes.length < e.holes)
    return false;
  s.cash -= e.cost;
  s.daily.expenses += e.cost;
  s.tournament = {
    id: uid(),
    name: e.name,
    audience: ["open", "beginners", "club", "elite"].includes(audience)
      ? audience
      : "open",
    holes: holes.map((h) => h.id),
    ends: s.day + 1,
    entries: [],
    entryFee: 22,
    started: s.day,
  };
  s.opened = true;
  return s.tournament;
}
export function eventBoard(s) {
  const t = s.tournament;
  if (!t) return [];
  const best = new Map();
  for (const e of t.entries) {
    const id = e.memberId || e.name;
    if (!best.has(id) || e.score < best.get(id).score) best.set(id, e);
  }
  return [...best.values()].sort((a, b) => a.score - b.score);
}
export function finishTournament(s) {
  const t = s.tournament;
  if (!t) return null;
  const board = eventBoard(s),
    winner = board[0] || null,
    rec = { ...t, leaderboard: board, winner };
  s.tournamentHistory.unshift(rec);
  s.tournamentHistory = s.tournamentHistory.slice(0, 30);
  if (winner) s.reputation = clamp(s.reputation + 3, 10, 98);
  s.tournament = null;
  return rec;
}
export function golferFit(s, member) {
  const g = member.profile,
    holes = s.holes.filter((h) => h.open);
  if (!holes.length) return "Open a hole to discover their preferences.";
  const scored = holes
    .map((h) => ({ h, r: member.holeHistory[h.id] }))
    .filter((a) => a.r);
  const worst = scored.sort(
    (a, b) => b.r.strokes / b.r.n - b.h.par - (a.r.strokes / a.r.n - a.h.par),
  )[0];
  if (worst && worst.r.strokes / worst.r.n > worst.h.par + 2)
    return `${worst.h.name} is their toughest hole. Consider a safer landing area or shorter carry.`;
  return g.skill < 0.35
    ? "Prefers achievable carries, wider landing areas and forgiving greens."
    : g.risk > 0.75
      ? "Enjoys long carries and risk/reward shortcuts."
      : g.skill > 0.8
        ? "Wants strategic choices and challenging approaches."
        : "Prefers safe routes, good conditions and a fair fee.";
}
export function staffStatus(s, id) {
  const n = s.staff[id];
  if (id === "grounds") {
    const gain = n * (s.facilities.includes("maintenance") ? 12 : 7),
      wear = Math.max(1, s.holes.filter((h) => h.open).length) * 0.6;
    return {
      active: n > 0,
      status: n
        ? `Repairs ${gain} condition points/day; routine wear costs ${wear.toFixed(1)}, plus visitor wear.`
        : "No crew hired. Course conditions decline with traffic.",
      tip: s.facilities.includes("maintenance")
        ? "Maintenance shed improves each crew’s daily repair."
        : "A maintenance shed increases repair from 7 to 12 points per worker.",
    };
  }
  if (id === "desk")
    return {
      active: n > 0,
      status: n
        ? `Admissions ${Math.round((1 - Math.max(0.55, 1 - n * 0.2)) * 100)}% faster. ${s.facilities.includes("shop") ? "Shop earns $3 per visitor." : "No pro shop yet; retail income is inactive."}`
        : "You handle check-in yourself. No faster admissions or shop sales.",
      tip: "Hire one for check-in. Build a pro shop for retail income; extra workers shorten spacing, with a cap.",
    };
  if (id === "mechanic")
    return {
      active: n > 0 && s.facilities.includes("carts"),
      status:
        n && s.facilities.includes("carts")
          ? "Carts active: golfers move faster between shots and holes."
          : "Cart travel inactive: needs a cart barn AND a maintenance worker.",
      tip: "One worker enables the cart fleet. Additional workers do not stack speed bonuses.",
    };
  if (id === "pro")
    return {
      active: n > 0 && s.facilities.includes("range"),
      status:
        n && s.facilities.includes("range")
          ? "Range lessons earn $4 per warm-up. Coaching builds confidence; advanced visitors are more likely."
          : "Range coaching inactive: needs a driving range AND a professional.",
      tip: "The range works without a pro. One professional adds coached warm-ups; extras do not multiply lesson income.",
    };
  return {
    active: n > 0 && s.facilities.includes("food"),
    status:
      n && s.facilities.includes("food")
        ? "Café open: $4 per visitor, with more patience during waits."
        : "Café service inactive: needs a halfway café AND a service worker.",
    tip: "One worker operates the café. Additional workers do not stack income.",
  };
}
