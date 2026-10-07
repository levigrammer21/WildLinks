import {
  VERSION,
  initialState,
  CELL,
  T,
  TOOLS,
  clamp,
  dist,
  uid,
  blankHole,
  landSize,
  ownedAt,
  landPlots,
  brushStroke,
  stamp,
  analyzeHole,
  validateHole,
  terrainAt,
  heightAt,
} from "./world.js";
import { LocalStore, serialize, deserialize } from "./persistence.js";
import { clubs, suggestClub, shotProfile, previewShot } from "./golf.js";
import {
  Simulation,
  FACILITIES,
  STAFF,
  demand,
  dailyCosts,
  relative,
} from "./simulation.js";
import {
  courseGoals,
  claimUpgrade,
  buyPlot,
  SIDE_GOALS,
  EVENTS,
  startTournament,
  eventBoard,
  golferFit,
  staffStatus,
} from "./club.js";
import { CloudStore } from "./cloud.js";
import {
  TEE_NAMES,
  teeFor,
  teePar,
  addJournal,
  staffAdvice,
  landingClusters,
  selectFeature,
  planTransform,
  applyTransform,
  revisionFeedback,
} from "./design.js";
import { Renderer } from "./render.js";
const $ = (id) => document.getElementById(id),
  money = (n) => "$" + Math.round(n).toLocaleString(),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let cloud = new CloudStore({
    onStatus: (status) => updateCloudBadge(status),
    onUser: (user) => accountChanged(user),
  }),
  store = new LocalStore(cloud.session?.uid || "guest"),
  s = store.load(),
  sim = new Simulation(s, toast),
  renderer = new Renderer($("course"), s),
  mode = s.holes.some((h) => h.open) ? "watch" : "build",
  tool = "tee",
  holeIndex = 0,
  brush = 24,
  speed = 1,
  lastSpeed = 1,
  selected = null,
  undo = [],
  redo = [],
  tx = null,
  pending = false,
  lastPoint = null,
  pointers = new Map(),
  gesture = null,
  swing = null,
  clubIndex = 0,
  activeTab = "overview",
  lastUI = 0,
  lastSave = 0,
  autoFollow = false,
  rangeDraft = null,
  objectDraft = null,
  cloudConnecting = false;
if (s.activeVisits) {
  sim.visits = s.activeVisits.filter((v) => !v.finished);
  for (const v of sim.visits)
    if (v.player) {
      v.golfer = s.player;
      sim.playerVisit = v;
    }
  if (sim.playerVisit) {
    mode = "play";
    selected = sim.playerVisit.id;
    renderer.follow = selected;
  }
}
renderer.mode = mode;
renderer.frame();
sim.onDaily = (summary) => {
  save();
  if (!s.holes.some((h) => h.open)) return;
  if ($("overlay").hidden && mode !== "play") {
    const event = s.tournamentHistory[0];
    if (event?.ends === summary.day) showEventResults(event);
    else showDaily(summary);
  }
};
sim.onRound = (v, rec) => {
  renderer.preview = null;
  save();
  showRound(v, rec);
};
function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  el.onclick = () => el.remove();
  $("toasts").append(el);
  while ($("toasts").children.length > 2) $("toasts").firstChild.remove();
  setTimeout(() => el.remove(), 5000);
}
function save(manual = false) {
  if (tx || pending) return false;
  s.activeVisits = sim.visits.filter((v) => !v.finished);
  if (cloud.session && cloud.ready) s.cloudDirty = true;
  if (store.save(s)) {
    if (cloud.session && cloud.ready) cloud.queue(s, serialize(s), manual);
    if (manual)
      toast(
        cloud.session ? "Saved locally. Cloud sync queued." : "Course saved.",
      );
    return true;
  }
  toast("Storage is full or unavailable. Export your save from the clubhouse.");
  return false;
}
function sheet(title, html) {
  $("sheetTitle").textContent = title;
  $("sheetBody").innerHTML = html;
  $("overlay").hidden = false;
  $("sheet").scrollTop = 0;
}
function closeSheet() {
  if (pending) return;
  $("overlay").hidden = true;
}
$("closeSheet").onclick = closeSheet;
$("overlay").onclick = (e) => {
  if (e.target === $("overlay") && !rangeDraft?.target && !objectDraft?.feature)
    closeSheet();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSheet();
  if (e.key === " " && e.target.tagName !== "INPUT") {
    e.preventDefault();
    speed = speed ? 0 : lastSpeed;
    updateUI();
  }
  if (e.key === "z" && (e.ctrlKey || e.metaKey) && mode === "build") {
    e.preventDefault();
    undoAction(e.shiftKey);
  }
});
function setMode(m) {
  if (tx || pending) return;
  mode = m;
  renderer.mode = m;
  renderer.preview = null;
  objectDraft = null;
  renderer.editFeature = null;
  rangeDraft = null;
  renderer.rangeDraft = null;
  if (m === "build") {
    renderer.follow = null;
    selected = null;
    autoFollow = false;
    tool = s.holes[holeIndex].tee ? "fairway" : "tee";
  } else if (m === "watch") {
    if (sim.playerVisit && !sim.playerVisit.finished)
      toast("Your round is waiting. Tap Play course to resume.");
  }
  renderTools();
  updateUI();
}
$("build").onclick = () => setMode(mode === "build" ? "watch" : "build");
$("watch").onclick = () => {
  setMode("watch");
  if (!sim.visits.some((v) => !v.finished))
    toast(
      s.opened
        ? "Golfers will arrive during operating hours."
        : "Open a hole to welcome the first golfer.",
    );
};
$("play").onclick = showPlay;
$("trails").onclick = showTrails;
$("account").onclick = showAccount;
$("clubhouse").onclick = () => showClub("overview");
$("brand").onclick = () => showClub("overview");
$("time").onclick = () => {
  if (mode === "build") {
    toast("Construction pauses the course. Tap Watch to resume.");
    return;
  }
  if (mode === "play") {
    speed = speed ? 0 : 1;
  } else speed = { 0: 1, 1: 2, 2: 4, 4: 0 }[speed];
  if (speed) lastSpeed = speed;
  updateUI();
};
$("home").onclick = () => {
  renderer.follow = null;
  autoFollow = false;
  renderer.preview = null;
  renderer.frame();
  if (mode === "play") prepareShot();
};
$("zoomIn").onclick = () => renderer.zoom(1.3);
$("zoomOut").onclick = () => renderer.zoom(1 / 1.3);
$("brush").oninput = (e) => {
  brush = +e.target.value;
  updateUI();
};
$("undo").onclick = () => undoAction(false);
$("redo").onclick = () => undoAction(true);
$("holeSelect").onclick = showHoleList;
$("openHole").onclick = openHole;
function renderTools() {
  const all = [["hand", "✥", "Move", 0], ...TOOLS];
  $("tools").innerHTML = all
    .map(
      ([id, icon, name]) =>
        `<button data-tool="${id}" class="${tool === id ? "active" : ""}" aria-label="${name}"><i>${iconSVG(id)}</i>${name}</button>`,
    )
    .join("");
  $("tools")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          objectDraft = null;
          renderer.editFeature = null;
          rangeDraft = null;
          renderer.rangeDraft = null;
          tool = b.dataset.tool;
          renderTools();
          updateUI();
        }),
    );
}
function newTx() {
  return {
    cells: new Map(),
    holes: structuredClone(s.holes),
    structures: structuredClone({
      range: s.range,
      facilityPositions: s.facilityPositions,
    }),
    cost: 0,
    tool,
  };
}
function restoreTx(t) {
  for (const [i, v] of t.cells) {
    s.terrain[i] = v.t;
    s.heights[i] = v.h;
  }
  s.holes = restoreLayouts(t.holes);
  if (t.structures) Object.assign(s, structuredClone(t.structures));
  renderer.dirty = true;
  renderer.preview = null;
}
// Undo architecture, not the rounds that have been played since construction.
function restoreLayouts(layouts) {
  const current = new Map(s.holes.map((h) => [h.id, h]));
  const restored = structuredClone(layouts).map((h) => {
    const live = current.get(h.id);
    if (live) {
      h.stats = live.stats;
      h.teeStats = live.teeStats;
      h.revisionStats = live.revisionStats;
      h.open = live.open;
    }
    if (h.open && validateHole(s, h)) h.open = false;
    return h;
  });
  if (!restored.some((h) => h.open)) s.opened = false;
  return restored;
}
function commitTx(t) {
  let cost = Math.round(t.cost);
  if (s.cash < cost) {
    restoreTx(t);
    toast(`That work costs ${money(cost)}. You have ${money(s.cash)}.`);
    return false;
  }
  const entry = {
    before: t.holes,
    beforeStructures: t.structures,
    afterStructures: structuredClone({
      range: s.range,
      facilityPositions: s.facilityPositions,
    }),
    after: structuredClone(s.holes),
    cells: [],
    cost,
  };
  for (const [i, v] of t.cells)
    entry.cells.push({
      i,
      before: v,
      after: { t: s.terrain[i], h: s.heights[i] },
    });
  s.cash -= cost;
  s.daily.expenses += cost;
  undo.push(entry);
  if (undo.length > 40) undo.shift();
  redo = [];
  const h = s.holes[holeIndex],
    oldRev = h.revisionStats?.[h.revision];
  if (oldRev?.n) {
    h.designBaseline = { ...oldRev };
    addJournal(
      s,
      "Redesign of " + h.name,
      "Before this redesign: " +
        (oldRev.total / oldRev.n).toFixed(2) +
        " strokes over " +
        oldRev.n +
        " plays. Inspect design feedback for the new results.",
      { hole: h.id },
    );
  }
  s.holes[holeIndex].revision++;
  entry.after = structuredClone(s.holes);
  sim.invalidate();
  renderer.dirty = true;
  save();
  updateUI();
  return true;
}
function finishTx() {
  if (!tx) {
    lastPoint = null;
    if (rangeDraft?.target) confirmRangePlacement();
    if (objectDraft?.show) {
      objectDraft.show = false;
      objectSheet();
    }
    return;
  }
  let t = tx;
  tx = null;
  lastPoint = null;
  if (!t.cells.size && JSON.stringify(t.holes) === JSON.stringify(s.holes))
    return;
  let cost = Math.round(t.cost);
  if (cost > 500) {
    pending = true;
    sheet(
      "Approve construction",
      `<p>This work costs <b>${money(cost)}</b>. Your balance afterward: <b>${money(s.cash - cost)}</b>.</p><p>You can cancel without spending anything.</p><div class="row"><button class="primary" id="approve" ${s.cash < cost ? "disabled" : ""}>Build · ${money(cost)}</button><button id="cancelWork">Cancel</button></div>`,
    );
    $("approve").onclick = () => {
      pending = false;
      closeSheet();
      commitTx(t);
    };
    $("cancelWork").onclick = () => {
      restoreTx(t);
      pending = false;
      closeSheet();
      updateUI();
    };
  } else commitTx(t);
}
function undoAction(isRedo) {
  if (s.tournament)
    return toast("Finish the tournament before undoing course work.");
  if (tx || pending) return;
  const source = isRedo ? redo : undo,
    dest = isRedo ? undo : redo,
    entry = source.at(-1);
  if (!entry) return;
  if (isRedo && s.cash < entry.cost) {
    toast("Not enough cash to redo that work.");
    return;
  }
  source.pop();
  for (const cell of entry.cells) {
    let v = isRedo ? cell.after : cell.before;
    s.terrain[cell.i] = v.t;
    s.heights[cell.i] = v.h;
  }
  s.holes = restoreLayouts(isRedo ? entry.after : entry.before);
  const structures = isRedo ? entry.afterStructures : entry.beforeStructures;
  if (structures) Object.assign(s, structuredClone(structures));
  s.cash += isRedo ? -entry.cost : entry.cost;
  s.daily.expenses += isRedo ? entry.cost : -entry.cost;
  holeIndex = Math.min(holeIndex, s.holes.length - 1);
  dest.push(entry);
  sim.invalidate();
  renderer.dirty = true;
  save();
  updateUI();
}
function confirmRangePlacement() {
  const f = FACILITIES.find((f) => f.id === "range");
  sheet(
    "Build driving range",
    `<p>${Math.round(dist(rangeDraft.tee, rangeDraft.target))} yd practice area · ${money(f.cost)} construction · ${money(f.upkeep)} daily care.</p><p>Visitors sometimes hit three practice shots here before their round. Keep its flight corridor away from holes.</p><div class="row"><button id="confirmRange" class="primary">Build range</button><button id="cancelRange">Cancel</button></div>`,
  );
  $("confirmRange").onclick = () => {
    if (s.cash < f.cost) return toast("Not enough money.");
    s.cash -= f.cost;
    s.daily.expenses += f.cost;
    s.facilities.push("range");
    s.range = { ...rangeDraft };
    rangeDraft = null;
    renderer.rangeDraft = null;
    tool = "tee";
    save();
    closeSheet();
    setMode("watch");
    toast("Driving range open. Watch visitors warm up.");
  };
  $("cancelRange").onclick = () => {
    rangeDraft = null;
    renderer.rangeDraft = null;
    tool = "tee";
    closeSheet();
  };
}
function paint(p) {
  const h = s.holes[holeIndex],
    l = landSize(s);
  if (!ownedAt(s, p)) return;
  if (tool === "object" && objectDraft) {
    objectTap(p);
    return;
  }
  if (rangeDraft) {
    if (lastPoint) return;
    lastPoint = p;
    if (tool === "rangeTee") {
      if (!ownedAt(s, { x: p.x + 12, y: p.y })) {
        lastPoint = null;
        return toast("Leave room for three practice bays on your land.");
      }
      rangeDraft.tee = { ...p };
      renderer.rangeDraft = rangeDraft;
      tool = "rangeTarget";
      toast("Now tap the range target, at least 80 yards away.");
    } else {
      if (dist(rangeDraft.tee, p) < 80) {
        lastPoint = null;
        toast("Choose a target at least 80 yards away.");
        return;
      }
      rangeDraft.target = { ...p };
    }
    return;
  }
  if (s.tournament) {
    toast("The course is hosting a tournament. Redesign after the event.");
    return;
  }
  if (!tx) tx = newTx();
  if (tool.startsWith("tee:")) {
    if (lastPoint) return;
    const set = tool.split(":")[1];
    h.tees ||= {};
    h.tees[set] = { ...p };
    stamp(s, p, 8, T.FAIRWAY, tx);
    tx.cost = 80;
    lastPoint = p;
    return;
  }
  if (tool === "tee") {
    if (lastPoint) return;
    h.tee = { ...p };
    if (h.pin && !h.manualPar) {
      const d = dist(h.tee, h.pin);
      h.par = d < 230 ? 3 : d < 470 ? 4 : 5;
    }
    stamp(s, p, 8, T.FAIRWAY, tx);
    tx.cost = 80;
    lastPoint = p;
    return;
  }
  if (tool === "pin") {
    if (lastPoint) return;
    if (terrainAt(s, p) !== T.GREEN) {
      toast("Tap green terrain to place the pin.");
      return;
    }
    h.pin = { ...p };
    h.green = { ...p };
    lastPoint = p;
    if (!h.manualPar && h.tee) {
      let d = dist(h.tee, h.pin);
      h.par = d < 230 ? 3 : d < 470 ? 4 : 5;
    }
    return;
  }
  if (tool === "green" && !h.green) h.green = { ...p };
  let r = brush / 2;
  if (lastPoint) {
    let d = dist(lastPoint, p),
      n = Math.ceil(d / Math.max(2, r * 0.3));
    for (let i = 1; i <= n; i++)
      brushStroke(
        s,
        {
          x: lastPoint.x + ((p.x - lastPoint.x) * i) / n,
          y: lastPoint.y + ((p.y - lastPoint.y) * i) / n,
        },
        r,
        tool,
        tx,
      );
  } else brushStroke(s, p, r, tool, tx);
  lastPoint = p;
  if (tool === "fairway" && tx.cells.size > 10) h.fairwayDrawn = true;
  renderer.dirty = true;
  updateUI();
}
function openHole() {
  if (s.tournament?.holes.includes(s.holes[holeIndex].id))
    return toast("This hole is reserved for the tournament.");
  let h = s.holes[holeIndex];
  if (h.open) {
    h.open = false;
    s.opened = s.holes.some((h) => h.open);
    toast(`${h.name} is closed to new visitors. Existing rounds continue.`);
    save();
    updateUI();
    return;
  }
  const error = validateHole(s, h);
  if (error) {
    toast(error);
    return;
  }
  h.open = true;
  addJournal(
    s,
    "Hole opened",
    h.name +
      " · Par " +
      h.par +
      " · " +
      Math.round(dist(h.tee, h.pin)) +
      " yd.",
    { hole: h.id },
  );
  s.opened = true;
  s.minute = Math.min(s.minute, 1020);
  sim.arrival = 1;
  undo = [];
  redo = [];
  save();
  setMode("watch");
  sim.achievements();
  toast(`${h.name} is open. Your first golfers are on their way.`);
  autoFollow = true;
}
function objective() {
  if (objectDraft)
    return (
      "<b>Simple shape editor</b><br>" +
      (objectDraft.stage === "move"
        ? "Tap the new center on owned land."
        : "Tap a green, bunker, range tee or building.")
    );
  if (tool.startsWith("tee:"))
    return (
      "<b>Place " +
      TEE_NAMES[tool.split(":")[1]] +
      " tee</b><br>Tap a location on your land. Work costs $80."
    );
  if (rangeDraft)
    return (
      "<b>Place your driving range</b><br>" +
      (!rangeDraft.tee
        ? "Tap a tee location."
        : "Tap a target at least 80 yd away.") +
      " Select any construction tool to cancel."
    );
  let h = s.holes[holeIndex];
  if (mode === "build") {
    if (!h.tee)
      return "<b>Build your first hole</b><br>Tee tool selected. Tap your land to place it.";
    if (!h.green)
      return "<b>Next: paint a green</b><br>Choose Green, then draw a generous landing area.";
    if (!h.pin)
      return "<b>Next: place the pin</b><br>Choose Pin and tap inside your green.";
    if (!h.fairwayDrawn)
      return "<b>Connect your hole</b><br>Paint a fairway from the tee toward the green.";
    return `<b>${esc(h.name)} · ${h.pin ? Math.round(dist(h.tee, h.pin)) + " yd" : ""}</b><br>Paint freely. ${h.open ? "Edits apply when you return to Watch." : "Open the hole when you’re ready."} Two fingers move the camera.`;
  }
  if (mode === "play")
    return sim.playerVisit?.state === "waiting"
      ? "<b>Your tee time</b><br>Waiting for the landing area to clear."
      : sim.playerVisit?.state === "between"
        ? "<b>On to the next hole</b><br>Walking to the next tee."
        : sim.playerVisit?.state === "flying"
          ? "<b>Ball in flight</b>"
          : sim.playerVisit?.state === "walking"
            ? "<b>Finding your next lie</b>"
            : "<b>Your course. Your shot.</b><br>Pull back from the ball; longer pulls hit farther.";
  if (!s.holes.some((h) => h.open))
    return "<b>Your land is waiting</b><br>Tap Build to create and open a hole.";
  if (s.totalServed === 0)
    return "<b>Watch your design come alive</b><br>Tap a golfer, then Follow to watch every shot.";
  if (s.cash < 0)
    return "<b>Cash is low</b><br>Trim wages or fees, welcome visitors, and avoid new construction.";
  return "";
}
function updateUI() {
  let h = s.holes[holeIndex],
    n = s.holes.filter((h) => h.open).length;
  $("cash").textContent = money(s.cash);
  let mm = Math.floor(s.minute),
    hour = Math.floor(mm / 60),
    min = mm % 60;
  $("day").textContent =
    `DAY ${s.day} · ${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  $("business").textContent =
    `${s.opened ? "Open" : "Closed"} · ${n} hole${n === 1 ? "" : "s"} · ${Math.round(s.reputation)}★`;
  $("time").textContent =
    mode === "build"
      ? "Ⅱ"
      : speed === 0
        ? "Ⅱ"
        : `${mode === "play" ? Math.min(speed, 1) : speed}×`;
  $("buildbar").hidden = mode !== "build";
  $("shotbar").hidden =
    mode !== "play" || !sim.playerVisit || sim.playerVisit.finished;
  $("watchcard").hidden = mode !== "watch" || !selected;
  $("build").classList.toggle("active", mode === "build");
  $("watch").classList.toggle("active", mode === "watch");
  $("play").classList.toggle("active", mode === "play");
  $("objective").innerHTML = objective();
  $("holeSelect").textContent = `${h.name} ▾`;
  $("buildInfo").textContent =
    h.tee && h.pin
      ? `Par ${h.par} · ${Math.round(dist(h.tee, h.pin))} yd`
      : "Design freely";
  $("openHole").textContent = h.open ? "Close hole" : "Open hole";
  $("undo").disabled = !undo.length;
  $("redo").disabled = !redo.length;
  let tt = TOOLS.find((x) => x[0] === tool);
  $("costLabel").textContent = tx
    ? `${money(tx.cost)} work`
    : tool === "tee"
      ? "$80 each"
      : tool === "pin" || tool === "hand"
        ? "No cost"
        : tt
          ? `${money(tt[3] * 1000)} / 1k yd²`
          : "";
  if (mode === "play") updateShotBar();
  if (mode === "watch" && selected) updateWatchCard();
}
function updateWatchCard() {
  let v = sim.visits.find((v) => v.id === selected);
  if (!v || v.finished) {
    selected = null;
    $("watchcard").hidden = true;
    return;
  }
  let h = s.holes.find((h) => h.id === v.holes[v.holeIndex]),
    rel = v.scores.reduce((a, x) => a + x.score - x.par, 0),
    g = v.golfer;
  const handicap = Math.round((1 - g.skill) * 36);
  const atRange = ["goingRange", "rangeThinking", "rangeFlying"].includes(
    v.state,
  );
  const markup = `<b>${esc(g.name)}</b><small>${esc(g.archetype || "Course owner")} · HCP ${handicap} · ${atRange ? "Driving range" : esc(h.name)} · ${v.returning ? "Returning visitor" : "First visit"}</small><p>Stroke ${v.strokes + 1} · ${Math.round(dist(v.ball, h.pin))} yd to pin · ${relative(rel)}</p><small>${v.state === "flying" ? esc(v.shot.club) + " · " + esc(v.shot.quality) : v.plan ? esc(v.plan.club.name) + " · " + esc(v.plan.reason) : esc(v.mood)}</small><p>“${esc(v.thought)}”</p><small>${g.drive > 260 ? "Long hitter" : g.accuracy > 0.75 ? "Accurate from the tee" : "Finding consistency"} · ${g.putting > 0.7 ? "Confident putter" : g.risk > 0.7 ? "Attacks the risky line" : "Thinks through the next shot"}</small><div class="row"><button id="follow">${renderer.follow === v.id ? "Unfollow" : "Follow golfer"}</button><button id="dismissCard">Close</button></div>`;
  const card = $("watchcard");
  if (card.dataset.golfer !== v.id) {
    card.innerHTML =
      '<div id="watchContent"></div><div class="row"><button id="follow">Follow golfer</button><button id="dismissCard">Close</button></div>';
    card.dataset.golfer = v.id;
  }
  $("watchContent").innerHTML = markup.slice(
    0,
    markup.indexOf('<div class="row">'),
  );
  $("follow").textContent =
    renderer.follow === v.id ? "Unfollow" : "Follow golfer";
  $("follow").onclick = () => {
    renderer.follow = renderer.follow === v.id ? null : v.id;
    if (renderer.follow)
      renderer.camera.zoom = Math.max(renderer.camera.zoom, 0.85);
  };
  $("dismissCard").onclick = () => {
    selected = null;
    renderer.follow = null;
    $("watchcard").hidden = true;
  };
}
function showPlay() {
  $("toasts").replaceChildren();
  if (sim.playerVisit && !sim.playerVisit.finished) {
    mode = "play";
    renderer.mode = mode;
    selected = sim.playerVisit.id;
    renderer.follow = selected;
    speed = 1;
    prepareShot();
    updateUI();
    return;
  }
  let open = s.holes.filter((h) => h.open);
  if (!open.length) {
    toast("Open at least one hole before playing.");
    return;
  }
  let options = [];
  for (const n of [1, 3, 6, 9, 18])
    if (open.length >= n)
      options.push({
        label: n === 9 ? "Play front 9" : `Play ${n} hole${n === 1 ? "" : "s"}`,
        ids: open.slice(0, n).map((h) => h.id),
      });
  if (open.length >= 18)
    options.splice(options.length - 1, 0, {
      label: "Play back 9",
      ids: open.slice(9, 18).map((h) => h.id),
    });
  if (![1, 3, 6, 9, 18].includes(open.length))
    options.push({
      label: `Play all ${open.length} open holes`,
      ids: open.map((h) => h.id),
    });
  sheet(
    "Play your course",
    `<p>You start as a recreational golfer. Pull back from your ball to aim and set power. The landing region shows uncertainty, not a guaranteed result.</p><div class="grid"><div class="stat"><strong>${Math.round(s.player.drive)} yd</strong><small>Driver carry + roll</small></div><div class="stat"><strong>${Math.round((1 - s.player.skill) * 36)}</strong><small>Estimated handicap</small></div></div><label class="field">Tee set<select id="playTees"><option value="standard">Standard</option><option value="forward">Forward · shorter routes</option><option value="championship">Championship · longer challenge</option></select></label><p class="note">A missing optional tee uses Standard. Tournament entries must use the event tee set.</p><h3>Choose your round</h3><div class="row">${options.map((o, i) => `<button class="primary" data-round="${i}">${o.label}</button>`).join("")}</div><p class="note">The course keeps operating while you play. Golf ability improves through completed holes.</p>`,
  );
  $("sheetBody")
    .querySelectorAll("[data-round]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          let hs = options[+b.dataset.round].ids.map((id) =>
              s.holes.find((h) => h.id === id),
            ),
            v = sim.startPlayer(hs, $("playTees").value);
          selected = v.id;
          mode = "play";
          renderer.mode = mode;
          renderer.follow = v.id;
          renderer.camera.zoom = Math.max(renderer.camera.zoom, 1.1);
          speed = 1;
          closeSheet();
          prepareShot();
          save();
          updateUI();
        }),
    );
}
function prepareShot() {
  const v = sim.playerVisit;
  if (!v || v.finished || v.state !== "ready") return;
  let h = s.holes.find((h) => h.id === v.holes[v.holeIndex]),
    cs = clubs(v.golfer),
    c = suggestClub(s, v.golfer, v.ball, h.pin);
  clubIndex = cs.findIndex((a) => a.name === c.name);
  renderer.camera.zoom =
    c.kind === "putt"
      ? 3
      : c.kind === "wedge" || c.kind === "bunker"
        ? 1.6
        : 1.05;
  $("club").innerHTML = cs
    .map(
      (c, i) =>
        `<option value="${i}" ${i === clubIndex ? "selected" : ""}>${c.name} · ~${Math.round(c.range)} yd</option>`,
    )
    .join("");
  setPreviewTowardPin();
}
function setPreviewTowardPin() {
  let v = sim.playerVisit;
  if (!v || v.finished) return;
  let h = s.holes.find((h) => h.id === v.holes[v.holeIndex]),
    c = clubs(v.golfer)[clubIndex],
    power = clamp(
      dist(v.ball, h.pin) / shotProfile(s, v.golfer, v.ball, c, 1).range,
      0.025,
      1,
    );
  renderer.preview = {
    ...previewShot(
      s,
      v.golfer,
      v.ball,
      c,
      power,
      Math.atan2(h.pin.y - v.ball.y, h.pin.x - v.ball.x),
    ),
    start: v.ball,
    putt: c.kind === "putt",
  };
}
$("club").onchange = (e) => {
  clubIndex = +e.target.value;
  setPreviewTowardPin();
};
$("autoAim").onclick = () => {
  if (sim.playerVisit) {
    renderer.follow = sim.playerVisit.id;
    setPreviewTowardPin();
  }
};
$("endRound").onclick = () => {
  sheet(
    "Leave this round?",
    `<p>Your completed holes and golf practice are kept. An unfinished round does not set a course record.</p><div class="row"><button class="primary" id="leave">Leave round</button><button id="continueRound">Keep playing</button></div>`,
  );
  $("continueRound").onclick = closeSheet;
  $("leave").onclick = () => {
    sim.playerVisit.finished = true;
    sim.playerVisit = null;
    selected = null;
    renderer.follow = null;
    renderer.preview = null;
    closeSheet();
    setMode("watch");
    save();
  };
};
function updateShotBar() {
  let v = sim.playerVisit;
  if (!v) return;
  let h = s.holes.find((h) => h.id === v.holes[v.holeIndex]);
  if (!h) return;
  let t = terrainAt(s, v.ball),
    lie =
      [
        "Rough",
        "Fairway",
        "Green",
        "Bunker",
        "Water",
        "Deep rough",
        "Path",
        "Trees",
        "Garden",
        "Tee",
      ][t] || "Boundary";
  $("shotInfo").textContent =
    `${h.name} · Par ${h.par} · Stroke ${v.strokes + 1} · ${Math.round(dist(v.ball, h.pin))} yd`;
  $("shotHint").textContent =
    v.state === "ready"
      ? `${lie} · Pull back from the ball. Release to swing.`
      : v.state === "flying"
        ? `${v.shot.club} · ${v.shot.quality}`
        : v.state === "walking"
          ? "Walking to your ball…"
          : v.state === "waiting"
            ? "Waiting for a clear landing area…"
            : "Walking to the next tee…";
  $("club").disabled = v.state !== "ready";
  $("autoAim").disabled = v.state !== "ready";
}
function showRound(v, r) {
  sheet(
    "Round complete",
    `<div class="grid"><div class="stat"><strong>${r.score} (${relative(r.relative)})</strong><small>${r.holes}-hole round</small></div><div class="stat"><strong>${Math.round((1 - s.player.skill) * 36)}</strong><small>Your handicap estimate</small></div></div><table><thead><tr><th>Hole</th><th>Par</th><th>Score</th><th>Putts</th></tr></thead><tbody>${v.scores.map((x) => `<tr><td>${esc(x.name)}</td><td>${x.par}</td><td>${x.score}${x.pickup ? "*" : ""}</td><td>${x.putts}</td></tr>`).join("")}</tbody></table><p>You’ve practiced ${s.player.stats.holes} holes. Your shot prediction gradually tightens as your skills improve.</p><div class="row"><button class="primary" id="backToCourse">Back to course</button><button id="playAgain">Play again</button></div>`,
  );
  $("backToCourse").onclick = () => {
    closeSheet();
    selected = null;
    renderer.follow = null;
    setMode("watch");
  };
  $("playAgain").onclick = () => {
    closeSheet();
    showPlay();
  };
}
function showHoleList() {
  sheet(
    "Course routing",
    `<p>${s.holes.length} / ${s.capacity} holes designed. Select a hole to build or inspect its history.</p>${s.holes.map((h, i) => `<div class="item"><div><b>${esc(h.name)}</b> <span class="badge">${h.open ? "Open" : "Closed"}</span><p>Par ${h.par} · ${h.tee && h.pin ? Math.round(dist(h.tee, h.pin)) + " yd" : "Unbuilt"} · ${h.stats.plays} plays</p></div><button data-edit="${i}">Build</button><button data-info="${i}">Details</button></div>`).join("")}<div class="row" style="margin-top:16px"><button class="primary" id="newHole" ${s.holes.length >= s.capacity ? "disabled" : ""}>Add hole</button><button id="expandFromList">Buy land</button></div>`,
  );
  $("sheetBody")
    .querySelectorAll("[data-edit]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          holeIndex = +b.dataset.edit;
          renderer.activeHole = holeIndex;
          closeSheet();
          setMode("build");
          let h = s.holes[holeIndex];
          if (h.tee) {
            renderer.camera.x = h.tee.x;
            renderer.camera.y = h.tee.y + 70 / renderer.camera.zoom;
          }
        }),
    );
  $("sheetBody")
    .querySelectorAll("[data-info]")
    .forEach((b) => (b.onclick = () => showHole(+b.dataset.info)));
  $("newHole").onclick = () => {
    s.holes.push(blankHole(s.holes.length + 1));
    holeIndex = s.holes.length - 1;
    renderer.activeHole = holeIndex;
    undo = [];
    redo = [];
    closeSheet();
    setMode("build");
    tool = "tee";
    renderTools();
    renderer.frame();
    save();
  };
  $("expandFromList").onclick = () => showClub("land");
}
function showHole(i) {
  let h = s.holes[i],
    a = analyzeHole(s, h),
    st = h.stats;
  sheet(
    `${h.name} · Par ${h.par}`,
    `<div class="row"><button class="primary" id="editHole">Redesign hole</button><button id="toggleHole">${h.open ? "Close" : "Open"}</button></div><label class="field">Hole name<input id="holeName" maxlength="32" value="${esc(h.name)}"></label><div class="row"><label>Par <select id="parSelect">${[3, 4, 5, 6].map((p) => `<option ${p === h.par ? "selected" : ""}>${p}</option>`).join("")}</select></label><button id="renameHole">Save details</button></div>${
      a
        ? `<h3>Architecture</h3><div class="grid">${[
            ["Effective length", a.length + " yd"],
            ["Forgiveness", a.forgiveness + " / 100"],
            ["Strategic variety", a.variety + " / 100"],
            ["Safe-route carry", a.carry + " yd"],
            ["Fairway access", a.fairway + "%"],
            ["Green access", a.greenAccess + " / 100"],
            ["Beginner friendly", a.beginner + " / 100"],
            ["Expert challenge", a.expert + " / 100"],
            ["Scenic quality", a.scenery + " / 100"],
            ["Estimated pace", a.pace + " min"],
          ]
            .map(
              ([k, v]) =>
                `<div class="stat"><strong>${v}</strong><small>${k}</small></div>`,
            )
            .join(
              "",
            )}</div><p class="note">Architecture estimates inspect playable corridors. Actual scoring below comes from every simulated shot, including yours. Difficult holes can be excellent.</p>`
        : "<p>Place a tee, green and pin to analyze this hole.</p>"
    }<div class="row"><button id="teeSets">Tee sets</button><button id="shapeEdit">Move / resize</button><button id="designFeedback">Design feedback</button></div><h3>Played history</h3><div class="grid"><div class="stat"><strong>${st.plays ? (st.total / st.plays).toFixed(2) : "—"}</strong><small>Average score · ${st.plays} plays</small></div><div class="stat"><strong>${st.low?.value ?? "—"}</strong><small>Lowest score ${st.low ? "· " + esc(st.low.name) : ""}</small></div></div><table><tr><th>Golfer level</th><th>Actual average</th><th>Rounds</th></tr>${["Beginners", "Club golfers", "Scratch golfers"].map((n, j) => `<tr><td>${n}</td><td>${st.buckets[j].n ? (st.buckets[j].total / st.buckets[j].n).toFixed(2) : "—"}</td><td>${st.buckets[j].n}</td></tr>`).join("")}</table><p>${st.birdies} birdies or better · ${st.pars} pars · ${st.bogeys} bogeys · ${st.double} double+</p><h3>Hole records</h3>${["drive", "putt", "approach"].map((k) => `<div class="item"><div><b>${{ drive: "Longest drive", putt: "Longest holed putt", approach: "Closest approach" }[k]}</b><p>${st[k] ? Math.round(st[k].value * 10) / 10 + " yd · " + esc(st[k].name) + " · Day " + st[k].day : "No record yet"}</p></div></div>`).join("")}<p>Hole-in-ones: ${st.aces.length}${
      st.aces.length
        ? " · " +
          st.aces
            .slice(-5)
            .map((r) => esc(r.name) + " (Day " + r.day + ")")
            .join(", ")
        : ""
    }</p>`,
  );
  $("teeSets").onclick = () => showTeeSets(i);
  $("shapeEdit").onclick = () => startObjectEdit(i);
  $("designFeedback").onclick = () => showDesignFeedback(i);
  $("editHole").onclick = () => {
    holeIndex = i;
    renderer.activeHole = i;
    closeSheet();
    setMode("build");
  };
  $("toggleHole").onclick = () => {
    holeIndex = i;
    openHole();
    closeSheet();
  };
  $("parSelect").disabled = !!s.tournament?.holes.includes(h.id);
  $("renameHole").onclick = () => {
    h.name = $("holeName").value.trim() || `Hole ${i + 1}`;
    if (!s.tournament?.holes.includes(h.id)) h.par = +$("parSelect").value;
    h.manualPar = true;
    save();
    showHole(i);
  };
}
const tabs = [
  ["overview", "Operation"],
  ["land", "Land"],
  ["goals", "Course goals"],
  ["golfers", "Regulars"],
  ["events", "Tournaments"],
  ["facilities", "Facilities"],
  ["staff", "Staff"],
  ["records", "Records"],
  ["player", "Your golf"],
  ["reviews", "Feedback"],
  ["journal", "Journal"],
  ["save", "Save & courses"],
];
function showClub(tab = "overview") {
  activeTab = tab;
  sheet(
    s.name,
    `<div class="tabs">${tabs.map(([id, name]) => `<button data-tab="${id}" class="${id === tab ? "active" : ""}">${name}</button>`).join("")}</div><div id="clubContent"></div><p class="note">Wild Links v${VERSION} · Your land, your course.</p>`,
  );
  $("sheetBody")
    .querySelectorAll("[data-tab]")
    .forEach((b) => (b.onclick = () => showClub(b.dataset.tab)));
  const content = $("clubContent");
  if (tab === "overview") clubOverview(content);
  if (tab === "land") clubLand(content);
  if (tab === "goals") clubGoals(content);
  if (tab === "golfers") clubGolfers(content);
  if (tab === "events") clubEvents(content);
  if (tab === "facilities") clubFacilities(content);
  if (tab === "staff") clubStaff(content);
  if (tab === "records") clubRecords(content);
  if (tab === "player") clubPlayer(content);
  if (tab === "reviews") clubReviews(content);
  if (tab === "save") clubSave(content);
  if (tab === "journal") clubJournal(content);
}
function clubOverview(el) {
  let n = s.holes.filter((h) => h.open).length,
    active = sim.visits.filter((v) => !v.finished && !v.player).length;
  el.innerHTML = `<div class="grid"><div class="stat"><strong>${money(s.daily.revenue)}</strong><small>Today’s receipts</small></div><div class="stat"><strong>${s.daily.served}</strong><small>Completed rounds today</small></div><div class="stat"><strong>${Math.round(s.reputation)} / 100</strong><small>Reputation</small></div><div class="stat"><strong>${Math.round(s.conditions)}%</strong><small>Course conditions</small></div></div><h3>Green fee</h3><p>A ${n}-hole visit currently costs ${money(s.fee)}. ${active} golfers on the property. ${demand(s) > 1.8 ? "Demand is strong." : demand(s) > 0.7 ? "Demand is steady." : "Demand is light."}</p><label class="field">Fee per round<input id="feeInput" type="number" inputmode="numeric" min="0" max="250" value="${s.fee}"></label><div class="row"><button class="primary" id="setFee">Set fee</button><button id="businessToggle">${s.opened ? "Close admissions" : "Open admissions"}</button><button id="routing">Course routing</button></div><h3>Operating day</h3><p>08:00–18:00 arrivals; the property closes after the last round. ${s.weather.name}. Daily care, facilities and wages: <b>${money(dailyCosts(s))}</b>.</p><div class="row"><button id="nextDay">Finish day</button><button id="dailyReport" ${s.history.length ? "" : "disabled"}>Last daily report</button><button id="care">Restore conditions · $180</button></div><h3>Club events</h3><p>${s.tournament ? esc(s.tournament.name) + " is running until Day " + s.tournament.ends + "." : n >= 6 ? "Host a two-day open. Visitors compete on your current layout. Event receipts depend on completed rounds." : "Open at least six holes to host a club tournament."}</p><button id="tournament" ${n < 3 || s.tournament || s.cash < 350 ? "disabled" : ""}>Host a club open · $350</button>`;
  $("setFee").onclick = () => {
    s.fee = clamp(+$("feeInput").value || 0, 0, 250);
    save();
    showClub("overview");
  };
  $("businessToggle").onclick = () => {
    if (!n) {
      toast("Open a hole first.");
      return;
    }
    s.opened = !s.opened;
    save();
    showClub("overview");
  };
  $("routing").onclick = showHoleList;
  $("dailyReport").onclick = () => showDaily(s.history[0]);
  $("nextDay").onclick = () => {
    if (sim.visits.some((v) => !v.finished)) {
      toast(
        "Let active rounds finish before ending the day. Close admissions to stop new arrivals.",
      );
      return;
    }
    sim.finishDay();
    showClub("overview");
  };
  $("care").onclick = () => {
    if (s.cash < 180) {
      toast("Need $180 for course care.");
      return;
    }
    s.cash -= 180;
    s.daily.expenses += 180;
    s.conditions = Math.min(100, s.conditions + 30);
    save();
    showClub("overview");
  };
  $("tournament").disabled = false;
  $("tournament").textContent = "Tournament desk";
  $("tournament").onclick = () => showClub("events");
}
function clubLand(el) {
  el.innerHTML = `<p>Four adjoining plots make up your estate. Land adds space; course goals unlock holes. You start in the northwest with room for three holes.</p><div class="grid">${landPlots(
    s,
  )
    .map(
      (p) =>
        `<div class="stat"><strong>${p.name}</strong><small>${p.w} × ${p.h} yd · ${p.owned ? "Owned" : money(p.cost)}</small><button data-plot="${p.id}" ${p.owned ? "disabled" : ""}>${p.owned ? "Your land" : "Buy plot"}</button></div>`,
    )
    .join(
      "",
    )}</div><p>Current hole capacity: <b>${s.capacity}</b>. Designs remain editable.</p><div class="row"><button id="landGoals">Course goals</button><button id="landRouting">Manage & name holes</button></div>`;
  el.querySelectorAll("[data-plot]").forEach(
    (b) =>
      (b.onclick = () => {
        const result = buyPlot(s, +b.dataset.plot);
        if (!result)
          return toast("Buy an adjoining plot first, and check your budget.");
        renderer.dirty = true;
        renderer.frame();
        sim.invalidate();
        save();
        showClub("land");
        toast(
          result.name + " acquired. Hole capacity stays " + s.capacity + ".",
        );
      }),
  );
  $("landGoals").onclick = () => showClub("goals");
  $("landRouting").onclick = showHoleList;
}
function clubGoals(el) {
  const g = courseGoals(s);
  el.innerHTML = `<h3>${g ? g.upgrade.name : "Destination course achieved"}</h3><p>${g ? "Earn capacity for " + g.upgrade.capacity + " holes and " + money(g.upgrade.reward) + " by growing your club and playing your own course." : "Your 18-hole estate is ready for a lasting golfing history."}</p>${g ? g.checks.map((c) => `<div class="item"><div><b>${c.name}</b><p>${c.money ? money(c.value) : c.value} / ${c.money ? money(c.target) : c.target}</p><progress value="${Math.min(c.value, c.target)}" max="${c.target}"></progress></div></div>`).join("") + `<button id="claimUpgrade" class="primary" ${g.ready ? "" : "disabled"}>Upgrade course · ${g.upgrade.capacity} holes</button>` : ""}<h3>Club challenges</h3>${SIDE_GOALS.map((c) => `<div class="item"><div><b>${c.name}</b><p>${c.text} ${Math.min(c.value(s), c.target)} / ${c.target}</p><small>Reward ${money(c.reward)}</small></div><button data-goal="${c.id}" ${s.claimedGoals.includes(c.id) || c.value(s) < c.target ? "disabled" : ""}>${s.claimedGoals.includes(c.id) ? "Claimed" : "Claim"}</button></div>`).join("")}`;
  if (g)
    $("claimUpgrade").onclick = () => {
      const u = claimUpgrade(s);
      if (u) {
        save();
        showClub("goals");
        toast(u.name + "! Capacity is now " + s.capacity + " holes.");
      }
    };
  el.querySelectorAll("[data-goal]").forEach(
    (b) =>
      (b.onclick = () => {
        const c = SIDE_GOALS.find((c) => c.id === b.dataset.goal);
        if (!s.claimedGoals.includes(c.id) && c.value(s) >= c.target) {
          s.claimedGoals.push(c.id);
          s.cash += c.reward;
          save();
          showClub("goals");
        }
      }),
  );
}
function clubGolfers(el) {
  const members = Object.values(s.members).sort((a, b) => b.visits - a.visits);
  el.innerHTML = `<p>${members.length} remembered golfers · ${members.filter((m) => m.visits > 1).length} returning visitors. Happy regulars return more often; reputation attracts new faces.</p><label class="field">Show golfers<select id="memberFilter"><option value="all">Everyone</option><option value="returning">Returning visitors</option><option value="beginner">Beginners</option><option value="expert">Advanced golfers</option></select></label><div id="memberList"></div>`;
  const list = () => {
    $("memberList").innerHTML =
      members
        .filter((m) => {
          const f = $("memberFilter").value;
          return (
            f === "all" ||
            (f === "returning" && m.visits > 1) ||
            (f === "beginner" && m.profile.skill < 0.35) ||
            (f === "expert" && m.profile.skill > 0.78)
          );
        })
        .map(
          (m) =>
            `<div class="item"><div><b>${esc(m.profile.name)}</b><p>${esc(m.profile.archetype)} · ${m.visits} visits · satisfaction ${Math.round(m.satisfaction)}%</p></div><button data-member="${m.id}">Profile</button></div>`,
        )
        .join("") || "<p>Your first visitors will appear here.</p>";
    $("memberList")
      .querySelectorAll("[data-member]")
      .forEach((b) => (b.onclick = () => showMember(b.dataset.member)));
  };
  $("memberFilter").onchange = list;
  list();
}
function showMember(id) {
  const m = s.members[id];
  if (!m) return;
  const v = sim.visits.find((v) => v.memberId === id && !v.finished);
  sheet(
    m.profile.name,
    `<div class="profile-avatar" style="--golfer-color:${esc(m.profile.color || "#e8c879")}">⛳</div><p>${esc(m.profile.archetype)} · HCP ${Math.round((1 - m.profile.skill) * 36)} · ${m.visits} visits · ${m.rounds} completed rounds</p><p>${esc(golferFit(s, m))}</p><h3>Favorite hole</h3><p>${(() => {
      const ranked = s.holes
        .filter((h) => m.holeHistory[h.id]?.n)
        .sort(
          (a, b) =>
            m.holeHistory[a.id].strokes / m.holeHistory[a.id].n -
            a.par -
            (m.holeHistory[b.id].strokes / m.holeHistory[b.id].n - b.par),
        );
      return ranked[0]
        ? esc(ranked[0].name) + " · best average relative to par"
        : "Their played history will reveal a favorite.";
    })()}</p><h3>Friendly rivals</h3><p>${
      Object.values(s.members)
        .filter(
          (other) =>
            other.id !== m.id &&
            other.best &&
            m.best &&
            other.best.layout === m.best.layout,
        )
        .sort(
          (a, b) =>
            Math.abs(a.best.score - m.best.score) -
            Math.abs(b.best.score - m.best.score),
        )
        .slice(0, 3)
        .map((other) => esc(other.profile.name) + " · best " + other.best.score)
        .join("<br>") ||
      "Other golfers need a recorded round on the same routing and tees."
    }</p><p>Best round: ${m.best ? m.best.score + " (" + relative(m.best.relative) + ") over " + m.best.holes + " holes" : "Not yet recorded"} · ${m.warmups} range sessions</p><table><tr><th>Hole</th><th>Average</th><th>Plays</th></tr>${s.holes
      .map((h) => {
        const r = m.holeHistory[h.id];
        return `<tr><td>${esc(h.name)}</td><td>${r ? (r.strokes / r.n).toFixed(2) : "—"}</td><td>${r?.n || 0}</td></tr>`;
      })
      .join(
        "",
      )}</table><div class="row">${v ? '<button id="memberFollow" class="primary">Follow this visit</button>' : ""}<button id="backMembers">Back to regulars</button></div>`,
  );
  $("backMembers").onclick = () => showClub("golfers");
  if (v)
    $("memberFollow").onclick = () => {
      closeSheet();
      setMode("watch");
      selected = v.id;
      renderer.follow = v.id;
      updateUI();
    };
}
let eventLiveHash = "";
function eventHash() {
  const t = s.tournament;
  return t
    ? JSON.stringify([
        t.entries,
        t.schedule,
        sim.visits
          .filter((v) => !v.finished && v.eventId === t.id)
          .map((v) => [v.id, v.holeIndex, v.strokes, v.scores.length]),
      ])
    : "";
}
function clubEvents(el) {
  eventLiveHash = eventHash();
  const n = s.holes.filter((h) => h.open).length,
    t = s.tournament;
  el.innerHTML = `<p>Tournaments run for two operating days on a fixed 6, 9 or 18-hole routing. Only completed event rounds qualify; each golfer’s best score counts. Entry receipts are earned when a round finishes.</p>${
    t
      ? `<h3>${esc(t.name)} · ${esc(t.audience)}</h3><p>${TEE_NAMES[t.teeSet || "standard"]} tees · Ends after Day ${t.ends}. Course editing pauses during the event.</p><div class="row"><button id="eventRefresh">Refresh leaderboard</button><button id="joinEvent">Play this event</button></div><h3>On the course</h3>${
          sim.visits
            .filter((v) => !v.finished && v.eventId === t.id)
            .map(
              (v) =>
                `<div class="item"><div><b>${esc(v.golfer.name)}</b><p>Hole ${v.holeIndex + 1} · ${relative(v.scores.reduce((a, x) => a + x.score - x.par, 0))} · ${v.strokes} strokes</p></div><button data-contender="${v.id}">Follow</button></div>`,
            )
            .join("") ||
          "<p>Next entrants are preparing for their scheduled tee times.</p>"
        }<h3>Completed rounds</h3><table><tr><th>Golfer</th><th>Score</th></tr>${eventBoard(
          s,
        )
          .map(
            (e) =>
              `<tr><td>${esc(e.name)}</td><td>${e.score} (${relative(e.relative)})</td></tr>`,
          )
          .join("")}</table>`
      : `<label class="field">Event tee set<select id="eventTees"><option value="standard">Standard</option><option value="forward">Forward</option><option value="championship">Championship</option></select></label><label class="field">Invite golfers<select id="eventAudience"><option value="open">All abilities</option><option value="beginners">Beginners</option><option value="club">Club golfers</option><option value="elite">Elite golfers</option></select></label>${EVENTS.map((e) => `<div class="item"><div><b>${e.name}</b><p>${e.holes} open holes required · ${money(e.cost)} hosting · $22 per completed entry</p></div><button data-event="${e.id}" ${n < e.holes || s.cash < e.cost ? "disabled" : ""}>Host</button></div>`).join("")}`
  }<h3>Tournament history</h3>${s.tournamentHistory.map((e) => `<div class="item"><div><b>${esc(e.name)}</b><p>${e.winner ? esc(e.winner.name) + " · " + e.winner.score + " (" + relative(e.winner.relative) + ")" : "No completed entries"} · Day ${e.ends}</p></div><button data-event-result="${e.id}">Results</button></div>`).join("") || "<p>Your first tournament will become part of the club’s history.</p>"}`;
  el.querySelectorAll("[data-event-result]").forEach(
    (b) =>
      (b.onclick = () =>
        showEventResults(
          s.tournamentHistory.find((t) => t.id === b.dataset.eventResult),
        )),
  );
  if (t) {
    $("eventRefresh").onclick = () => showClub("events");
    $("joinEvent").onclick = () => {
      if (sim.playerVisit && !sim.playerVisit.finished)
        return toast("Finish or end your current round before entering.");
      const v = sim.startPlayer(
        t.holes.map((id) => s.holes.find((h) => h.id === id)),
        t.teeSet || "standard",
      );
      closeSheet();
      mode = "play";
      renderer.mode = mode;
      selected = v.id;
      renderer.follow = v.id;
      speed = 1;
      prepareShot();
      save();
      updateUI();
    };
    el.querySelectorAll("[data-contender]").forEach(
      (b) =>
        (b.onclick = () => {
          closeSheet();
          setMode("watch");
          selected = b.dataset.contender;
          renderer.follow = selected;
          updateUI();
        }),
    );
    el.insertAdjacentHTML(
      "beforeend",
      `<h3>Invited field</h3>${(t.schedule || []).map((e) => `<div class="item"><div><b>${esc(s.members[e.memberId]?.profile.name || "Invited member")}</b><p>Day ${e.day} · ${String(Math.floor(e.minute / 60)).padStart(2, "0")}:${String(Math.floor(e.minute % 60)).padStart(2, "0")} · ${e.admitted ? "Checked in" : "Scheduled"}</p></div></div>`).join("")}`,
    );
  }
  if (!t)
    el.insertAdjacentHTML(
      "beforeend",
      '<p class="note">Sponsor awards: $25 per completed unique visitor. Owner winner prize: $100 / $250 / $500. Each event invites 12 eligible golfers. Practice builds confidence; completed holes build ability.</p>',
    );
  el.querySelectorAll("[data-event]").forEach(
    (b) =>
      (b.onclick = () => {
        if (
          startTournament(
            s,
            b.dataset.event,
            $("eventAudience").value,
            $("eventTees").value,
          )
        ) {
          sim.arrival = 1;
          save();
          showClub("events");
          toast("Tournament underway. Returning golfers compete by name.");
        }
      }),
  );
}
function showTrails() {
  sheet(
    "Golfer trails",
    `<p>Actual shot paths and landing spots reveal how golfers use your design. Red marks show penalties; gold marks show safe landings. The most recent 1,200 shots are remembered.</p><label class="field">Trail overlay<select id="trailSelect">${[
      ["off", "Hidden"],
      ["all", "All golfers"],
      ["beginner", "Beginners"],
      ["club", "Club golfers"],
      ["scratch", "Advanced golfers"],
      ["owner", "Your shots"],
    ]
      .map(
        ([v, n]) =>
          `<option value="${v}" ${(!s.showTrails ? v === "off" : s.trailFilter === v) ? "selected" : ""}>${n}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="field">Landing heatmap<input id="heatToggle" type="checkbox" ${s.heatmap ? "checked" : ""}></label><button id="applyTrails" class="primary">Apply overlay</button>`,
  );
  $("applyTrails").onclick = () => {
    s.heatmap = $("heatToggle").checked;
    s.feedbackHole = null;
    s.showTrails = $("trailSelect").value !== "off";
    s.trailFilter = $("trailSelect").value;
    save();
    closeSheet();
  };
}
function clubFacilities(el) {
  el.innerHTML =
    "<p>Facilities support the golf. Your original check-in hut is already on the property.</p>" +
    FACILITIES.map(
      (f) =>
        `<div class="item"><div><b>${f.name}</b><p>${f.description}</p><small>${money(f.cost)} construction · ${money(f.upkeep)} daily care</small></div><button data-fac="${f.id}" ${s.facilities.includes(f.id) || s.cash < f.cost ? "disabled" : ""}>${s.facilities.includes(f.id) ? "Built" : "Build"}</button></div>`,
    ).join("");
  el.querySelectorAll("[data-fac]").forEach(
    (b) =>
      (b.onclick = () => {
        let f = FACILITIES.find((f) => f.id === b.dataset.fac);
        if (s.cash < f.cost || s.facilities.includes(f.id)) return;
        if (f.id === "range") {
          closeSheet();
          setMode("build");
          rangeDraft = {};
          tool = "rangeTee";
          toast(
            "Range: tap a tee location, then a target at least 80 yards away. Cost " +
              money(f.cost) +
              " on confirmation.",
          );
          return;
        }
        sheet(
          "Build " + f.name,
          `<p>${f.description}</p><p>${money(f.cost)} now; ${money(f.upkeep)} in daily care.</p><div class="row"><button class="primary" id="facilityYes">Build facility</button><button id="facilityNo">Cancel</button></div>`,
        );
        $("facilityNo").onclick = () => showClub("facilities");
        $("facilityYes").onclick = () => {
          s.cash -= f.cost;
          s.daily.expenses += f.cost;
          s.facilities.push(f.id);
          save();
          showClub("facilities");
          toast(f.name + " built beside the clubhouse.");
        };
      }),
  );
}
function clubStaff(el) {
  el.innerHTML =
    `<div class="advice"><b>Suggested staffing</b>${staffAdvice(s)
      .map((a) => `<p>${esc(a)}</p>`)
      .join(
        "",
      )}</div><p>Staff have practical jobs. Wages are charged when the day ends. Current wages: ${money(STAFF.reduce((a, f) => a + s.staff[f.id] * f.wage, 0))} per day.</p>` +
    STAFF.map(
      (f) =>
        `<div class="item"><div><b>${f.name} · ${s.staff[f.id]}</b><p>${staffStatus(s, f.id).status}</p><p class="note">${staffStatus(s, f.id).tip}</p><small>${staffStatus(s, f.id).active ? "Working" : "Inactive"} · ${money(f.wage)} per day each</small></div><button data-fire="${f.id}" ${s.staff[f.id] ? "" : "disabled"} aria-label="Release ${f.name}">−</button><button data-hire="${f.id}" ${s.staff[f.id] >= ({ desk: 3, mechanic: 1, pro: 1, service: 1 }[f.id] || 12) ? "disabled" : ""} aria-label="Hire ${f.name}">+</button></div>`,
    ).join("");
  el.querySelectorAll("[data-hire]").forEach(
    (b) =>
      (b.onclick = () => {
        s.staff[b.dataset.hire]++;
        save();
        showClub("staff");
      }),
  );
  el.querySelectorAll("[data-fire]").forEach(
    (b) =>
      (b.onclick = () => {
        s.staff[b.dataset.fire] = Math.max(0, s.staff[b.dataset.fire] - 1);
        save();
        showClub("staff");
      }),
  );
}
function clubRecords(el) {
  el.innerHTML =
    `<h3>Records by routing and tees</h3>${Object.values(s.recordBook || {})
      .map(
        (r) =>
          `<div class="item"><div><b>${r.holes} holes · ${TEE_NAMES[r.teeSet || "standard"]} tees</b><p>${esc(r.name)} · ${r.score} (${relative(r.relative)}) · Day ${r.day}</p></div></div>`,
      )
      .join("")}` +
    "<p>Records come from fully played rounds. New routing configurations establish their own current records; daily history and hole statistics stay with your property.</p>" +
    [
      ["overall", "Developing course record"],
      ["nine", "9-hole course record"],
      ["eighteen", "18-hole course record"],
      ["personal", "Your best round"],
      ["ai", "Best visitor round"],
    ]
      .map(([key, label]) => {
        let r = s.records[key];
        return `<div class="item"><div><b>${label}</b><p>${r ? `${r.score} (${relative(r.relative)}) · ${esc(r.name)}` : "No completed round yet"}</p><small>${r ? `${r.holes} holes · Day ${r.day}` : ""}</small></div></div>`;
      })
      .join("") +
    "<h3>Hole history</h3>" +
    s.holes
      .map(
        (h, i) =>
          `<div class="item"><div><b>${esc(h.name)}</b><p>${h.stats.plays} plays · Average ${h.stats.plays ? (h.stats.total / h.stats.plays).toFixed(2) : "—"}</p></div><button data-history="${i}">Inspect</button></div>`,
      )
      .join("");
  el.insertAdjacentHTML(
    "beforeend",
    `<h3>Record book</h3>${
      (s.recordHistory || [])
        .slice(0, 12)
        .map(
          (r) =>
            `<div class="item"><div><b>${r.score} (${relative(r.relative)}) · ${esc(r.name)}</b><small>${r.holes}-hole record · Day ${r.day}${r.player ? " · Course owner" : ""}</small></div></div>`,
        )
        .join("") || "<p>No records have been set yet.</p>"
    }`,
  );
  el.querySelectorAll("[data-history]").forEach(
    (b) => (b.onclick = () => showHole(+b.dataset.history)),
  );
}
function clubPlayer(el) {
  let p = s.player,
    ps = p.stats;
  el.innerHTML = `<label class="field">Your golfer’s name<input id="ownerName" maxlength="35" value="${esc(p.name)}"></label><button id="saveOwner">Save name</button><h3>Your abilities</h3><div class="grid">${[
    ["Driving distance", Math.round(p.drive) + " yd"],
    ["Driving accuracy", Math.round(p.accuracy * 100) + " / 100"],
    ["Iron accuracy", Math.round(p.iron * 100) + " / 100"],
    ["Wedge control", Math.round(p.wedge * 100) + " / 100"],
    ["Putting", Math.round(p.putting * 100) + " / 100"],
    ["Recovery", Math.round(p.recovery * 100) + " / 100"],
    ["Bunker play", Math.round(p.bunker * 100) + " / 100"],
  ]
    .map(
      ([label, value]) =>
        `<div class="stat"><strong>${value}</strong><small>${label}</small></div>`,
    )
    .join(
      "",
    )}</div><p>Each completed hole improves your consistency a little. Business success does not change your golfer’s ability.</p><h3>Career statistics</h3><table>${[
    ["Rounds", ps.rounds],
    ["Holes played", ps.holes],
    [
      "Average strokes per hole",
      ps.holes ? (ps.strokes / ps.holes).toFixed(2) : "—",
    ],
    ["Eagles / birdies", ps.eagles + " / " + ps.birdies],
    [
      "Pars / bogeys / double+",
      ps.pars + " / " + ps.bogeys + " / " + ps.double,
    ],
    [
      "Fairways hit",
      ps.drives ? Math.round((ps.fairways / ps.drives) * 100) + "%" : "—",
    ],
    [
      "Greens in regulation",
      ps.holes ? Math.round((ps.gir / ps.holes) * 100) + "%" : "—",
    ],
    ["Putts per hole", ps.holes ? (ps.putts / ps.holes).toFixed(2) : "—"],
    ["Longest drive", Math.round(ps.longestDrive) + " yd"],
    ["Longest holed putt", ps.longestPutt.toFixed(1) + " yd"],
    [
      "Closest approach",
      ps.closest === null ? "—" : ps.closest.toFixed(1) + " yd",
    ],
    ["Hole-in-ones", ps.aces],
    [
      "Best 9",
      ps.bestNine
        ? `${ps.bestNine.score} (${relative(ps.bestNine.relative)})`
        : "—",
    ],
    [
      "Best 18",
      ps.bestEighteen
        ? `${ps.bestEighteen.score} (${relative(ps.bestEighteen.relative)})`
        : "—",
    ],
  ]
    .map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`)
    .join("")}</table>`;
  $("saveOwner").onclick = () => {
    s.player.name = $("ownerName").value.trim() || "The Owner";
    save();
    toast("Golfer name updated.");
  };
}
function clubReviews(el) {
  let r = s.reviews;
  const dims = [
    "quality",
    "value",
    "pace",
    "beauty",
    "conditions",
    "facilities",
  ];
  el.innerHTML = `${r.length ? `<div class="grid">${dims.map((d) => `<div class="stat"><strong>${Math.round(r.reduce((a, v) => a + (v.dimensions?.[d] || 55), 0) / r.length)} / 100</strong><small>${d[0].toUpperCase() + d.slice(1)}</small></div>`).join("")}</div>` : "<p>Your first completed visitor rounds will bring honest feedback about the course.</p>"}<h3>Visitor feedback</h3>${r
    .slice(0, 25)
    .map(
      (v) =>
        `<div class="item"><div><b>${esc(v.name)} · ${v.satisfaction}% satisfied</b><small>${esc(v.archetype)} · Day ${v.day} · ${v.score} (${relative(v.relative)}) over ${v.holes} holes</small><p>“${esc(v.text)}”</p></div></div>`,
    )
    .join("")}`;
}
function clubSave(el) {
  el.innerHTML = `<label class="field">Course name<input id="courseName" maxlength="32" value="${esc(s.name)}"></label><button id="saveCourseName">Save name</button><h3>Save and backup</h3><p>Your course and ongoing rounds autosave every 20 seconds and after important changes. Save files can move between devices.</p><p class="note">Last saved: ${s.lastSaved ? new Date(s.lastSaved).toLocaleString() : "Not yet"}. Saves are stored in this browser; export a backup before clearing browser data.</p><div class="row"><button class="primary" id="manualSave">Save now</button><button id="exportSave">Export save</button><button id="importSave">Import save</button></div><input type="file" id="saveFile" accept="application/json,.json" hidden><h3>Controls</h3><p>Watch: drag to pan, pinch to zoom, tap a golfer to follow.<br>Build: draw with one finger. Two fingers or Move tool pan. Pick a brush size; undo and redo refund or charge costs.<br>Play: touch near your ball, pull backward to aim and set power, release to hit. Drag elsewhere to inspect the hole. Change club for a different range.</p><h3>Your course collection</h3><div class="row"><button id="savedCourses">Saved courses & account</button><button class="primary" id="newGame">Start a new course</button></div>`;
  $("savedCourses").onclick = () =>
    cloud.session ? showAccount() : showCourses();
  $("saveCourseName").onclick = () => {
    s.name = $("courseName").value.trim() || "Wild Links";
    save();
    showClub("save");
  };
  $("manualSave").onclick = () => {
    save(true);
    showClub("save");
  };
  $("exportSave").onclick = () => {
    save();
    let a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([serialize(s)], { type: "application/json" }),
    );
    a.download = "Wild-Links-save.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("importSave").onclick = () => $("saveFile").click();
  $("saveFile").onchange = async (e) => {
    try {
      let file = e.target.files[0];
      if (!file) return;
      if (file.size > 20000000) throw Error("Save file is too large.");
      let imported = deserialize(await file.text());
      sheet(
        "Load this course?",
        `<p>Load <b>${esc(imported.name)}</b>, Day ${imported.day}, with ${imported.holes.length} holes and ${money(imported.cash)}? This adds a separate course to your collection.</p><div class="row"><button class="primary" id="loadYes">Load course</button><button id="loadNo">Cancel</button></div>`,
      );
      $("loadNo").onclick = () => showClub("save");
      $("loadYes").onclick = () => {
        if (!save()) return;
        imported.courseId = uid();
        imported.cloudBase = null;
        imported.cloudDirty = !!cloud.session;
        if (!store.save(imported)) return toast("Storage is full.");
        installCourse(imported);
        save(true);
      };
    } catch (e) {
      toast(e.message);
    }
  };
  $("newGame").onclick = showNewCourse;
}
function showDaily(d) {
  let complaint = Object.entries(d.complaints)
      .filter(([k]) => k !== "Enjoyed the course")
      .sort((a, b) => b[1] - a[1])[0],
    best = s.holes
      .filter((h) => h.stats.plays)
      .sort(
        (a, b) =>
          a.stats.total / a.stats.plays -
          a.par -
          (b.stats.total / b.stats.plays - b.par),
      )[0];
  sheet(
    `Day ${d.day} results`,
    `<div class="grid">${[
      ["Receipts", money(d.revenue)],
      ["Expenses", money(d.expenses)],
      ["Net", money(d.revenue - d.expenses)],
      ["Rounds completed", d.served],
      ["Satisfaction", d.satisfaction === null ? "—" : d.satisfaction + "%"],
      ["Conditions", d.conditions + "%"],
    ]
      .map(
        ([a, b]) =>
          `<div class="stat"><strong>${b}</strong><small>${a}</small></div>`,
      )
      .join(
        "",
      )}</div><p>Best scoring hole: ${best ? esc(best.name) : "No completed holes yet"}<br>Most common complaint: ${complaint ? complaint[0] : "No repeated complaint"}<br>${d.conditions < 60 ? "Course care is overdue. Hire groundskeepers or restore conditions." : "The course is ready for another day."}</p><button class="primary" id="continueDay">Back to the course</button>`,
  );
  $("continueDay").onclick = closeSheet;
}
// Pointer events unify touch, pen and mouse. Multitouch always controls the camera.
const canvas = $("course");
canvas.addEventListener("pointerdown", (e) => {
  if (cloudConnecting)
    return toast("Checking cloud saves. Your local course is safe.");
  if (!e.isPrimary && e.pointerType === "mouse") return;
  canvas.setPointerCapture(e.pointerId);
  const p = { x: e.clientX, y: e.clientY };
  pointers.set(e.pointerId, p);
  if (pointers.size === 2) {
    if (tx) {
      restoreTx(tx);
      tx = null;
      lastPoint = null;
    }
    if (swing) {
      swing = null;
      renderer.preview = null;
    }
    const a = [...pointers.values()];
    gesture = {
      kind: "pinch",
      distance: dist(a[0], a[1]),
      mid: { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 },
    };
    renderer.follow = null;
    return;
  }
  if (pointers.size > 2) return;
  const world = renderer.world(p);
  gesture = {
    kind: "pan",
    start: p,
    last: p,
    moved: false,
    time: performance.now(),
  };
  if (mode === "build" && tool !== "hand") {
    gesture.kind = "paint";
    paint(world);
  } else if (
    mode === "play" &&
    sim.playerVisit?.state === "ready" &&
    dist(p, renderer.screen(sim.playerVisit.ball)) < 50
  ) {
    gesture.kind = "swing";
    swing = { origin: p, angle: renderer.preview?.angle || 0, power: 0 };
    renderer.follow = null;
  } else renderer.follow = null;
});
canvas.addEventListener("pointermove", (e) => {
  const p = { x: e.clientX, y: e.clientY };
  renderer.cursor = { ...renderer.world(p), radius: brush / 2 };
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, p);
  if (pointers.size >= 2) {
    const a = [...pointers.values()],
      mid = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 },
      d = dist(a[0], a[1]);
    if (gesture?.kind === "pinch") {
      renderer.zoom(d / Math.max(1, gesture.distance), mid);
      renderer.camera.x -= (mid.x - gesture.mid.x) / renderer.camera.zoom;
      renderer.camera.y -= (mid.y - gesture.mid.y) / renderer.camera.zoom;
    }
    gesture = { kind: "pinch", distance: d, mid };
    return;
  }
  if (!gesture || gesture.kind === "pinch") return;
  if (dist(p, gesture.start) > (gesture.kind === "swing" ? 3 : 5))
    gesture.moved = true;
  if (gesture.kind === "paint") paint(renderer.world(p));
  else if (gesture.kind === "swing" && swing) {
    const dx = swing.origin.x - p.x,
      dy = swing.origin.y - p.y,
      pull = Math.hypot(dx, dy);
    if (pull > 3) swing.angle = Math.atan2(dy, dx);
    swing.power = clamp(pull / 115, 0.025, 1.1);
    let v = sim.playerVisit,
      c = clubs(v.golfer)[clubIndex];
    renderer.preview = {
      ...previewShot(s, v.golfer, v.ball, c, swing.power, swing.angle),
      start: v.ball,
      putt: c.kind === "putt",
    };
  } else if (gesture.kind === "pan") {
    renderer.camera.x -= (p.x - gesture.last.x) / renderer.camera.zoom;
    renderer.camera.y -= (p.y - gesture.last.y) / renderer.camera.zoom;
  }
  gesture.last = p;
});
function release(e, cancel = false) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pointers.size) {
    gesture = { kind: "pinch", distance: 0, mid: [...pointers.values()][0] };
    return;
  }
  const g = gesture;
  gesture = null;
  if (!g) return;
  if (g.kind === "paint") {
    if (cancel && tx) {
      restoreTx(tx);
      tx = null;
      lastPoint = null;
    } else finishTx();
  } else if (g.kind === "swing" && swing) {
    if (!cancel && swing.power > 0.025 && g.moved) {
      const v = sim.playerVisit;
      sim.hit(v, {
        club: clubs(v.golfer)[clubIndex],
        power: swing.power,
        angle: swing.angle,
        reason: "Your chosen line",
      });
      renderer.preview = null;
      renderer.follow = v.id;
      speed = 1;
      save();
    } else setPreviewTowardPin();
    swing = null;
  } else if (g.kind === "pan" && !g.moved && !cancel) {
    tap(renderer.world({ x: e.clientX, y: e.clientY }), {
      x: e.clientX,
      y: e.clientY,
    });
  }
  updateUI();
}
canvas.addEventListener("pointerup", (e) => release(e));
canvas.addEventListener("pointercancel", (e) => release(e, true));
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    renderer.zoom(Math.exp(-e.deltaY * 0.001), { x: e.clientX, y: e.clientY });
  },
  { passive: false },
);
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
function tap(p, screen) {
  if (dist(p, { x: 38, y: 30 }) < 27) {
    showClub("overview");
    return;
  }
  let nearest = null,
    d = 28;
  for (const v of sim.visits)
    if (!v.finished) {
      let n = Math.min(
        dist(screen, renderer.screen(v.pos)),
        dist(screen, renderer.screen(v.ball)),
      );
      if (n < d) {
        d = n;
        nearest = v;
      }
    }
  if (nearest && mode === "watch") {
    selected = nearest.id;
    updateWatchCard();
    $("watchcard").hidden = false;
    return;
  }
  let i = s.holes.findIndex(
    (h) =>
      (h.pin && dist(p, h.pin) < 22 / renderer.camera.zoom) ||
      (h.tee && dist(p, h.tee) < 22 / renderer.camera.zoom),
  );
  if (i >= 0 && mode === "watch") showHole(i);
}
let previous = performance.now(),
  prevPlayerState = null;
function loop(now) {
  let dt = Math.min(0.1, (now - previous) / 1000);
  previous = now;
  if (mode !== "build" && !pending && !cloudConnecting)
    sim.tick(dt * (mode === "play" ? Math.min(speed, 1) : speed));
  if (autoFollow && !renderer.follow) {
    let v = sim.visits.find((v) => !v.finished && !v.player);
    if (v) {
      renderer.follow = v.id;
      selected = v.id;
      renderer.camera.zoom = Math.max(renderer.camera.zoom, 0.85);
      autoFollow = false;
    }
  }
  let pv = sim.playerVisit;
  if (mode === "play" && pv && !pv.finished) {
    if (pv.state === "ready" && prevPlayerState !== "ready") {
      renderer.follow = pv.id;
      prepareShot();
    }
    if (pv.state !== "ready" && !swing) renderer.preview = null;
    prevPlayerState = pv.state;
  } else prevPlayerState = null;
  renderer.draw(dt, sim);
  if (now - lastUI > 500) {
    updateUI();
    const content = $("clubContent");
    if (
      !$("overlay").hidden &&
      activeTab === "events" &&
      content &&
      s.tournament &&
      eventHash() !== eventLiveHash &&
      !content.contains(document.activeElement)
    )
      clubEvents(content);
    lastUI = now;
  }
  if (now - lastSave > 20000) {
    save();
    lastSave = now;
  }
  requestAnimationFrame(loop);
}
addEventListener("resize", () => {
  renderer.resize();
  updateUI();
});
addEventListener("pagehide", () => save());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) save();
  else previous = performance.now();
});
renderTools();
updateUI();
requestAnimationFrame(loop);
save();
function showTeeSets(i) {
  const h = s.holes[i];
  sheet(
    h.name + " · tee sets",
    `<p>Standard uses your existing tee. Tap to place optional shorter or longer tees; golfers select tees by ability. Missing tees use Standard.</p>${Object.entries(
      TEE_NAMES,
    )
      .map(
        ([id, name]) =>
          `<div class="item"><div><b>${name}</b><p>${h.pin && teeFor(h, id) ? Math.round(dist(teeFor(h, id), h.pin)) + " yd · Par " + teePar(h, id) : "Place a tee and pin"}${id !== "standard" && !h.tees?.[id] ? " · Standard fallback" : ""}</p></div><button data-tee="${id}" ${s.tournament ? "disabled" : ""}>${id === "standard" ? "Move" : "Place / move"}</button></div>`,
      )
      .join("")}<h3>Scoring by tees</h3>${
      Object.entries(h.teeStats || {})
        .map(
          ([id, r]) =>
            `<p>${TEE_NAMES[id]}: ${(r.total / r.n).toFixed(2)} strokes over ${r.n} plays.</p>`,
        )
        .join("") || "<p>Played rounds will fill this history.</p>"
    }`,
  );
  $("sheetBody")
    .querySelectorAll("[data-tee]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          holeIndex = i;
          closeSheet();
          setMode("build");
          tool = b.dataset.tee === "standard" ? "tee" : "tee:" + b.dataset.tee;
          toast(
            "Tap the location for the " + TEE_NAMES[b.dataset.tee] + " tee.",
          );
        }),
    );
}
function startObjectEdit(i = holeIndex) {
  if (s.tournament) return toast("Finish the tournament before redesigning.");
  holeIndex = i;
  closeSheet();
  setMode("build");
  tool = "object";
  objectDraft = { stage: "select" };
  for (const [i, id] of s.facilities.filter((id) => id !== "range").entries())
    s.facilityPositions[id] ||= {
      x: 38 + (i % 4) * 42,
      y: 72 + Math.floor(i / 4) * 38,
    };
  toast(
    "Tap a green, bunker, driving-range tee or facility to move or resize it.",
  );
}
function objectSheet() {
  const f = objectDraft.feature;
  if (objectDraft.stage === "confirm") {
    const plan = objectDraft.plan;
    sheet(
      "Confirm course change",
      `<p>Cost: <b>${money(plan.cost)}</b>. ${f.kind === "terrain" ? "Your shape and its pin move together." : "The facility moves to your chosen location."}</p><div class="row"><button id="confirmFeature" class="primary" ${s.cash < plan.cost ? "disabled" : ""}>Apply · ${money(plan.cost)}</button><button id="cancelFeature">Cancel</button></div>`,
    );
    $("confirmFeature").onclick = () => {
      const t = newTx();
      applyTransform(s, f, plan, t);
      objectDraft = null;
      renderer.editFeature = null;
      closeSheet();
      commitTx(t);
      tool = "hand";
      renderTools();
    };
    $("cancelFeature").onclick = () => {
      objectDraft = null;
      renderer.editFeature = null;
      tool = "hand";
      closeSheet();
    };
    return;
  }
  sheet(
    f.kind === "terrain"
      ? f.terrain === T.GREEN
        ? "Edit green"
        : "Edit bunker"
      : "Move facility",
    `<p>Move with one tap on the destination. Resize keeps the same organic outline. Work stays reversible with Undo.</p><div class="row"><button id="moveFeature" class="primary">Move</button><button id="endFeature">Done</button></div>${f.kind === "terrain" ? '<label class="field">Size <span id="sizeLabel">100%</span><input id="featureSize" type="range" min="60" max="160" step="5" value="100"></label><p id="resizeQuote"></p><button id="resizeFeature">Apply new size</button>' : ""}`,
  );
  $("moveFeature").onclick = () => {
    objectDraft.stage = "move";
    closeSheet();
    toast("Tap the new center on your land.");
  };
  $("endFeature").onclick = () => {
    objectDraft = null;
    renderer.editFeature = null;
    tool = "hand";
    closeSheet();
  };
  if (f.kind === "terrain") {
    const quote = () => {
      const scale = +$("featureSize").value / 100;
      $("sizeLabel").textContent = Math.round(scale * 100) + "%";
      try {
        $("resizeQuote").textContent =
          "Estimated work: " + money(planTransform(s, f, f.center, scale).cost);
        $("resizeFeature").disabled = false;
      } catch (e) {
        $("resizeQuote").textContent = e.message;
        $("resizeFeature").disabled = true;
      }
    };
    $("featureSize").oninput = quote;
    quote();
    $("resizeFeature").onclick = () => {
      objectDraft.plan = planTransform(
        s,
        f,
        f.center,
        +$("featureSize").value / 100,
      );
      objectDraft.stage = "confirm";
      objectSheet();
    };
  }
}
function objectTap(p) {
  if (lastPoint) return;
  lastPoint = p;
  if (objectDraft.stage === "select") {
    const feature = selectFeature(s, p);
    if (!feature)
      return toast("Tap a connected green, bunker, range tee or building.");
    objectDraft.feature = feature;
    objectDraft.stage = "selected";
    renderer.editFeature = feature;
    objectDraft.show = true;
  } else if (objectDraft.stage === "move") {
    try {
      objectDraft.plan = planTransform(s, objectDraft.feature, p);
      objectDraft.stage = "confirm";
      objectDraft.show = true;
    } catch (e) {
      toast(e.message);
    }
  }
}
function showDesignFeedback(i) {
  const h = s.holes[i],
    clusters = landingClusters(s, { hole: h.id }),
    shots = s.trails.filter((t) => t.hole === h.id),
    bad = clusters
      .filter((c) => c.penalties)
      .sort((a, b) => b.penalties - a.penalties)[0],
    r = revisionFeedback(h);
  sheet(
    h.name + " · design feedback",
    `<p>Based on ${shots.length} recent actual shots and ${h.stats.plays} historical hole plays. Forgiveness and challenge are separate goals.</p><div class="grid"><div class="stat"><strong>${shots.filter((t) => t.penalty).length}</strong><small>Recent penalties</small></div><div class="stat"><strong>${clusters[0]?.n || 0}</strong><small>Shots in busiest landing area</small></div></div><p>${bad ? bad.penalties + " penalties clustered near " + Math.round(bad.x) + ", " + Math.round(bad.y) + " yd. A safer landing area or forward tee could help." : "No recent penalty cluster. Watch different abilities to discover your routes."}</p><table><tr><th>Ability</th><th>Actual score</th><th>Plays</th></tr>${[
      "Beginners",
      "Club golfers",
      "Advanced",
    ]
      .map((n, i) => {
        const b = h.stats.buckets[i];
        return `<tr><td>${n}</td><td>${b.n ? (b.total / b.n).toFixed(2) : "—"}</td><td>${b.n}</td></tr>`;
      })
      .join(
        "",
      )}</table><h3>Since the latest redesign</h3><p>Before: ${r.before === null ? "No played baseline" : r.before.toFixed(2)} · After: ${r.after === null ? "Awaiting played holes" : r.after.toFixed(2)} · ${r.plays} new plays</p><div class="row"><button id="showHeat" class="primary">Show landing heatmap</button><button id="feedbackBuild">Redesign</button></div><p class="note">Gold clusters are landings; red clusters contain penalties. Bigger circles mean more visits to that landing area.</p>`,
  );
  $("showHeat").onclick = () => {
    s.heatmap = true;
    s.showTrails = false;
    s.feedbackHole = h.id;
    save();
    closeSheet();
    renderer.frame();
  };
  $("feedbackBuild").onclick = () => {
    holeIndex = i;
    closeSheet();
    setMode("build");
  };
}
function clubJournal(el) {
  el.innerHTML = `<p>Your course’s living history: design changes, returning golfers, records, memorable shots and trophies.</p><h3>Trophy cabinet</h3>${(s.trophies || []).map((t) => `<div class="trophy"><span>${iconSVG("trophy")}</span><div><b>${esc(t.name)}</b><p>${esc(t.winner)} · ${t.score} · Day ${t.day}${t.owner ? " · Won by you" : ""}</p></div></div>`).join("") || "<p>Host a tournament to begin your trophy collection.</p>"}<h3>Course journal</h3>${(s.journal || []).map((j) => `<div class="item"><div><small>DAY ${j.day}</small><b>${esc(j.title)}</b><p>${esc(j.text)}</p></div>${j.hole && s.holes.some((h) => h.id === j.hole) ? `<button data-journal-hole="${j.hole}">Inspect</button>` : ""}${j.memberId && s.members[j.memberId] ? `<button data-journal-member="${j.memberId}">Golfer</button>` : ""}</div>`).join("") || "<p>Your first hole opening will begin the story.</p>"}`;
  el.querySelectorAll("[data-journal-hole]").forEach(
    (b) =>
      (b.onclick = () =>
        showHole(s.holes.findIndex((h) => h.id === b.dataset.journalHole))),
  );
  el.querySelectorAll("[data-journal-member]").forEach(
    (b) => (b.onclick = () => showMember(b.dataset.journalMember)),
  );
}
function showEventResults(t) {
  sheet(
    t.name + " · final results",
    `<div class="winner-banner">${iconSVG("trophy")}<h3>${t.winner ? esc(t.winner.name) : "No completed entries"}</h3><p>${t.winner ? t.winner.score + " (" + relative(t.winner.relative) + ") · " + TEE_NAMES[t.teeSet || "standard"] + " tees" : "All rounds must finish to qualify."}</p></div><p>Hosting & owner awards: <b>${money(t.payout || 0)}</b>. Trophy recorded on Day ${t.ends}.</p><table><tr><th>Place</th><th>Golfer</th><th>Score</th></tr>${(t.leaderboard || []).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.score} (${relative(r.relative)})</td></tr>`).join("")}</table><button id="resultsBack" class="primary">Tournament desk</button>`,
  );
  $("resultsBack").onclick = () => showClub("events");
}

function installCourse(next) {
  const callbacks = { onDaily: sim.onDaily, onRound: sim.onRound };
  s = next;
  sim = Object.assign(new Simulation(s, toast), callbacks);
  sim.visits = (s.activeVisits || []).filter((v) => !v.finished);
  sim.playerVisit = sim.visits.find((v) => v.player) || null;
  if (sim.playerVisit) sim.playerVisit.golfer = s.player;
  renderer.s = s;
  renderer.follow = null;
  renderer.preview = null;
  renderer.cursor = null;
  renderer.rangeDraft = null;
  renderer.editFeature = null;
  renderer.dirty = true;
  selected = null;
  holeIndex = 0;
  undo = [];
  redo = [];
  tx = null;
  pending = false;
  lastPoint = null;
  pointers.clear();
  gesture = null;
  swing = null;
  objectDraft = null;
  prevPlayerState = null;
  speed = lastSpeed = 1;
  $("watchcard").hidden = true;
  $("watchcard").dataset.golfer = "";
  closeSheet();
  setMode(
    sim.playerVisit ? "play" : s.holes.some((h) => h.open) ? "watch" : "build",
  );
  if (sim.playerVisit) {
    selected = sim.playerVisit.id;
    renderer.follow = selected;
  }
  renderer.frame();
  updateUI();
}
function updateCloudBadge(status) {
  $("account").textContent = status;
  $("account").title = cloud.session
    ? cloud.session.email
    : "Account and saved courses";
}
async function connectCloud() {
  if (!cloud.session) return;
  cloud.ready = false;
  cloudConnecting = true;
  cloud.setStatus("Connecting");
  try {
    const rows = await cloud.list();
    cloud.bases = Object.fromEntries(rows.map((r) => [r.id, r]));
    const remote = cloud.bases[s.courseId];
    if (remote) {
      if (s.cloudDirty && s.cloudBase !== remote.updateTime) {
        cloud.blocked.add(s.courseId);
        cloud.setStatus("Choose save");
        cloud.ready = true;
        return;
      }
      if (!s.cloudDirty && s.cloudBase !== remote.updateTime) {
        const loaded = deserialize(await cloud.load(remote));
        loaded.cloudBase = remote.updateTime;
        loaded.cloudDirty = false;
        if (!store.save(loaded))
          throw Error("Browser storage is full. Export a backup.");
        installCourse(loaded);
      }
    } else if (
      rows.length &&
      !s.holes.some((h) => h.tee) &&
      s.cash === 5000 &&
      !s.player.xp
    ) {
      const r = rows.sort((a, b) => b.updated - a.updated)[0],
        loaded = deserialize(await cloud.load(r));
      loaded.cloudBase = r.updateTime;
      loaded.cloudDirty = false;
      if (!store.save(loaded)) throw Error("Browser storage is full.");
      installCourse(loaded);
    }
    const career = rows
      .filter((r) => r.player)
      .sort((a, b) => b.xp - a.xp)[0]?.player;
    if (career && career.xp > s.player.xp) {
      s.player = structuredClone(career);
      if (sim.playerVisit) sim.playerVisit.golfer = s.player;
      s.cloudDirty = true;
      store.save(s);
    }
    cloud.ready = true;
    cloud.lastError = "";
    cloud.setStatus("Cloud saved");
    if (s.cloudDirty || !cloud.bases[s.courseId]) {
      s.cloudDirty = true;
      store.save(s);
      cloud.queue(s, serialize(s), true);
    }
  } catch (e) {
    cloud.ready = true;
    cloud.lastError = e.message;
    cloud.setStatus(
      e.code === "PERMISSION_DENIED"
        ? "Cloud rules needed"
        : "Offline · local safe",
    );
  } finally {
    cloudConnecting = false;
  }
}
async function accountChanged(user) {
  s.activeVisits = sim.visits.filter((v) => !v.finished);
  store.save(s);
  store = new LocalStore(user?.uid || "guest");
  installCourse(store.load());
  if (user) await connectCloud();
  else cloud.ready = false;
  showAccount();
}
function showAccount() {
  const user = cloud.session;
  sheet(
    user ? "Your courses" : "Welcome to Wild Links",
    user
      ? `<p>Signed in as <b>${esc(user.email)}</b></p><p class="note">${esc(cloud.status)}${cloud.lastError ? " · " + esc(cloud.lastError) : ""}</p><div class="row"><button id="refreshCloud">Reconnect & refresh</button><button id="cloudSaveNow">Sync now</button><button id="logout">Sign out</button></div><h3>Your properties</h3><div id="courseSlots"></div><div class="row"><button id="newSlot" class="primary">New course</button><button id="bringGuest">Bring local course</button></div><p class="note">Courses are private to your account. Each has its own business and history. Your owner golfer’s career travels with you.</p>`
      : `<p>Save your courses across your phone and iPad. Local play remains available offline.</p><form id="accountForm"><label class="field">Email<input id="authEmail" type="email" autocomplete="email" required></label><label class="field">Password<input id="authPassword" type="password" autocomplete="current-password" minlength="6" required></label><label class="field" id="confirmField" hidden>Confirm password<input id="authConfirm" type="password" autocomplete="new-password"></label><p id="authError" class="form-error" role="alert"></p><div class="row"><button id="authSubmit" type="submit" class="primary">Sign in</button><button id="authToggle" type="button">Create account</button><button id="forgotPassword" type="button">Forgot password</button></div></form><div class="row"><button id="guestSlots">Local courses</button><button id="continueLocal">Continue locally</button></div>`,
  );
  if (!user) {
    let registering = false;
    $("authToggle").onclick = () => {
      registering = !registering;
      $("confirmField").hidden = !registering;
      $("authConfirm").required = registering;
      $("authSubmit").textContent = registering ? "Create account" : "Sign in";
      $("authToggle").textContent = registering
        ? "Already have an account"
        : "Create account";
      $("authPassword").autocomplete = registering
        ? "new-password"
        : "current-password";
      $("authError").textContent = "";
    };
    $("accountForm").onsubmit = async (e) => {
      e.preventDefault();
      const button = $("authSubmit");
      button.disabled = true;
      try {
        await cloud.login(
          $("authEmail").value,
          $("authPassword").value,
          $("authConfirm").value,
          registering,
        );
      } catch (error) {
        if ($("authError")) $("authError").textContent = error.message;
      } finally {
        if (button.isConnected) button.disabled = false;
      }
    };
    $("forgotPassword").onclick = async () => {
      try {
        await cloud.resetPassword($("authEmail").value);
        $("authError").textContent =
          "If that account exists, check your email for a reset link.";
      } catch (e) {
        $("authError").textContent = e.message;
      }
    };
    $("continueLocal").onclick = closeSheet;
    $("guestSlots").onclick = showCourses;
    return;
  }
  $("refreshCloud").onclick = async () => {
    await connectCloud();
    showAccount();
  };
  $("cloudSaveNow").onclick = () => {
    save(true);
    cloud.flush();
  };
  $("logout").onclick = async () => {
    save();
    await cloud.signOut();
  };
  $("newSlot").onclick = showNewCourse;
  $("bringGuest").onclick = () => {
    const guest = new LocalStore().load();
    sheet(
      "Bring your local course",
      `<p>Add ${esc(guest.name)}, Day ${guest.day}, as a separate account course? Your local copy stays available.</p><button id="confirmBring" class="primary">Add to my account</button>`,
    );
    $("confirmBring").onclick = () => {
      guest.courseId = uid();
      guest.cloudBase = null;
      guest.cloudDirty = true;
      if (!store.save(guest)) return toast("Browser storage is full.");
      installCourse(guest);
      save(true);
      showAccount();
    };
  };
  renderCourseSlots($("courseSlots"));
}
function renderCourseSlots(el) {
  const merged = new Map(
    store.list().map((r) => [r.id, { ...r, local: true }]),
  );
  for (const r of Object.values(cloud.bases || {}))
    merged.set(r.id, { ...r, local: merged.has(r.id) });
  el.innerHTML = [...merged.values()]
    .map(
      (r) =>
        `<div class="item"><div><b>${esc(r.name)}</b><p>Day ${r.day} · ${r.holes} open holes · ${r.id === s.courseId ? "Current course" : r.local ? "On this device" : "Cloud course"}</p></div><button data-course="${r.id}" ${r.id === s.courseId && !cloud.blocked.has(r.id) ? "disabled" : ""}>${cloud.blocked.has(r.id) ? "Resolve" : "Open"}</button></div>`,
    )
    .join("");
  el.querySelectorAll("[data-course]").forEach(
    (b) =>
      (b.onclick = () =>
        cloud.blocked.has(b.dataset.course)
          ? showConflict(b.dataset.course)
          : switchCourse(b.dataset.course)),
  );
}
function showCourses() {
  sheet(
    "Your local courses",
    '<div id="courseSlots"></div><button id="newSlot" class="primary">New course</button>',
  );
  renderCourseSlots($("courseSlots"));
  $("newSlot").onclick = showNewCourse;
}
async function switchCourse(id, { remote = false } = {}) {
  if (tx || pending) return toast("Finish the current construction first.");
  if (!save()) return;
  cloudConnecting = true;
  try {
    let next = store.get(id),
      meta = cloud.bases?.[id];
    if (
      meta &&
      (!next ||
        remote ||
        (!next.cloudDirty && next.cloudBase !== meta.updateTime))
    ) {
      next = deserialize(await cloud.load(meta));
      next.cloudBase = meta.updateTime;
      next.cloudDirty = false;
    }
    if (!next) throw Error("This course is not available offline yet.");
    if (next.cloudDirty && meta && next.cloudBase !== meta.updateTime) {
      cloud.blocked.add(id);
      showConflict(id);
      return;
    }
    if (
      !next.activeVisits?.some((v) => v.player) &&
      s.player.xp > next.player.xp
    )
      next.player = structuredClone(s.player);
    if (!store.save(next)) throw Error("Storage is full.");
    installCourse(next);
    toast(next.name + " is open.");
  } catch (e) {
    toast(e.message);
  } finally {
    cloudConnecting = false;
  }
}
function showNewCourse() {
  sheet(
    "Start another course",
    `<p>Your current property will be saved. The new property starts with $5,000 and three hole slots. Your golfer keeps their ability and career.</p><label class="field">Course name<input id="newCourseName" maxlength="32" value="My New Links"></label><div class="row"><button id="resetYes" class="primary">Create course</button><button id="resetNo">Keep playing here</button></div>`,
  );
  $("resetNo").onclick = () => showClub("save");
  $("resetYes").onclick = () => {
    if (!save()) return;
    const fresh = initialState();
    fresh.name = $("newCourseName").value.trim() || "My New Links";
    fresh.player = structuredClone(s.player);
    fresh.cloudDirty = !!cloud.session;
    if (!store.save(fresh))
      return toast("Could not save the new course. Current property kept.");
    installCourse(fresh);
    save(true);
    toast("New course ready. Your previous property is in saved courses.");
  };
}
function showConflict(id) {
  const local = store.get(id);
  sheet(
    "Two versions of this course",
    `<p>Another device has saved a different version. Your local course is safe. Keep both to preserve your changes, or open the cloud version.</p><p>Local: ${esc(local?.name || "Course")} · Day ${local?.day || 1}</p><div class="row"><button id="keepBoth" class="primary">Keep both courses</button><button id="useCloud">Open cloud version</button></div>`,
  );
  $("keepBoth").onclick = async () => {
    if (!local) return;
    const copy = deserialize(serialize(local));
    copy.courseId = uid();
    copy.name = (copy.name + " · local copy").slice(0, 32);
    copy.cloudBase = null;
    copy.cloudDirty = true;
    if (!store.save(copy)) return toast("Storage is full.");
    installCourse(copy);
    save(true);
    await cloud.flush();
    toast("Local version kept as a separate course.");
  };
  $("useCloud").onclick = async () => {
    try {
      const rows = await cloud.list(),
        meta = rows.find((r) => r.id === id);
      if (!meta) throw Error("Cloud course unavailable.");
      const backup = deserialize(serialize(local));
      backup.courseId = uid();
      backup.name = (backup.name + " · backup").slice(0, 32);
      backup.cloudBase = null;
      backup.cloudDirty = false;
      store.save(backup, { activate: false });
      const next = deserialize(await cloud.load(meta));
      next.cloudBase = meta.updateTime;
      next.cloudDirty = false;
      cloud.pending = null;
      cloud.blocked.delete(id);
      cloud.bases[id] = meta;
      if (!store.save(next)) throw Error("Storage is full.");
      installCourse(next);
      cloud.setStatus("Cloud saved");
      toast("Cloud version opened. Local version retained as a backup.");
    } catch (e) {
      toast(e.message);
    }
  };
}

// Read-only inspection plus direct access to the live systems for automated acceptance checks.
globalThis.WildLinks = {
  get state() {
    return s;
  },
  get simulation() {
    return sim;
  },
  get renderer() {
    return renderer;
  },
  get mode() {
    return mode;
  },
  setMode,
  save,
  showClub,
  showHole,
  showPlay,
  showAccount,
  showCourses,
  showNewCourse,
  get cloud() {
    return cloud;
  },
  openHole,
  version: VERSION,
};
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {});

function iconSVG(id) {
  const paths = {
    trophy:
      "M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 15v5M8 21h8",
    hand: "M12 3v18M3 12h18M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4",
    tee: "M7 21V3l12 4-12 4M3 21h9",
    pin: "M9 22V2l11 5-11 4",
    green:
      "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    fairway: "M2 19C8 19 4 4 10 4s2 15 8 15M5 19C11 19 7 4 13 4s2 15 8 15",
    rough: "M4 20V9m8 11V4m8 16V9M4 14l-3-3m11-1 3-3m5 8 3-3",
    deep: "M3 20V8m5 12V3m5 17V8m5 12V4m4 16V8",
    sand: "M3 17c2-8 6-12 10-6s7-3 8 6ZM8 18h.1M14 16h.1",
    water:
      "M2 7c4-5 6 5 10 0s6 5 10 0M2 13c4-5 6 5 10 0s6 5 10 0M2 19c4-5 6 5 10 0s6 5 10 0",
    tree: "M12 22v-8M12 3c-7 0-9 13 0 13s7-13 0-13ZM8 22h8",
    flower:
      "M12 22v-8m0 4 5-3M12 3a3 3 0 1 0 0 6 3 3 0 1 0 0-6M6 8a3 3 0 1 0 0 6 3 3 0 1 0 0-6M18 8a3 3 0 1 0 0 6 3 3 0 1 0 0-6",
    path: "M5 22c0-10 14-10 14-20M1 22C1 12 15 12 15 2",
    raise: "M3 17l9-10 9 10M7 21l5-6 5 6",
    lower: "M3 7l9 10 9-10M7 3l5 6 5-6",
    level: "M2 8h20M2 16h20",
    erase: "M3 14l10-10 8 8-9 9H9Zm5 4 9-9M12 21h10",
    build: "M4 20l1-5L16 4l4 4L9 19Zm10-14 4 4",
    watch:
      "M2 12c5-10 15-10 20 0-5 10-15 10-20 0M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    play: "M6 22V2l14 5-14 5",
    clubhouse: "M2 11 12 3l10 8M5 9v12h14V9M10 21v-8h4v8",
    home: "M12 2v5m0 10v5M2 12h5m10 0h5M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[id] || paths.green}"/></svg>`;
}
$("brand").firstChild.replaceWith(
  Object.assign(document.createElement("span"), { innerHTML: iconSVG("tee") }),
);
for (const id of ["build", "watch", "play", "clubhouse"])
  $(id).querySelector("span").innerHTML = iconSVG(id);
$("home").innerHTML = iconSVG("home");
renderTools();

cloud.onSaved = (meta) => {
  if (!cloud.session) return;
  if (s.courseId === meta.id) {
    s.cloudBase = meta.updateTime;
    s.cloudDirty = cloud.pending?.id === meta.id || cloud.backlog.has(meta.id);
    store.save(s);
  } else {
    const course = store.get(meta.id);
    if (course) {
      course.cloudBase = meta.updateTime;
      course.cloudDirty =
        cloud.pending?.id === meta.id || cloud.backlog.has(meta.id);
      store.save(course, { activate: false });
    }
  }
};
cloud.onConflict = (id) =>
  toast(
    "A newer cloud version exists. Tap Choose save to keep both or load it.",
  );
addEventListener("online", () => {
  if (cloud.session) connectCloud().then(() => cloud.flush());
});
updateCloudBadge(cloud.status);
if (cloud.session) connectCloud();
