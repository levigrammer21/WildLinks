## New in 1.2

- Email/password accounts with confirmed registration, password recovery, private Firestore course collections, offline local saves, visible sync status and stale-device conflict choices.
- Multiple properties. Starting a course keeps the previous one. An existing local property can be brought into an account. Importing JSON creates a separate course.
- Forward, Standard and Championship tees. Optional tees are placed with one tap; missing ones fall back to Standard. AI chooses by ability; the owner and tournaments choose a set. Scores and records retain their tee set.
- Move or resize an organic green/bunker from Hole Details → Move / resize. A pin follows its green. Facilities and the range can be relocated. Quoted costs and Undo/Redo remain available.
- Recent landing heatmaps, penalty clusters, scoring by ability and tee set, and actual before/after redesign averages.
- Regular profiles show favorite holes and friendly rivals based on recorded rounds. Repeat-visit and personal-best entries build the course journal.
- Twelve named invitees with scheduled tee times, live contenders, follow controls, selected tournament tees, final standings, sponsor/owner awards and a trophy cabinet.
- Staff recommendations compare recent workload with repair capacity and identify inactive facilities.
- The owner’s permanent ability still improves through completed holes, not business upgrades or range grinding.

Read **FIREBASE_SETUP.md** and publish **firestore.rules** before using private cloud saves. Firebase console settings require the project owner; the ZIP includes everything needed on the game side.

# Wild Links — v1.2.0

A mobile-first golf course sandbox and tycoon game. Start with an undeveloped property, $5,000, a check-in hut, and capacity for three holes. Paint your own golf architecture, open it to paying visitors, watch their shots, and play the same course yourself.

## Publish on GitHub Pages

1. Extract this ZIP. Upload **the files inside it directly into your repository root**, including `.nojekyll` if your upload method supports it. Do not upload a containing folder.
2. Enable GitHub Pages for that branch, serving the repository root.
3. Open your Pages address in a modern browser. There is **no build step or dependency installation** needed to play locally. The configured Firebase project supports optional account/cloud saving; publish the supplied rules and enable Email/Password as described in FIREBASE_SETUP.md.

The `index.html` file must be served over HTTP or HTTPS; double-clicking it as a local `file://` document will not load JavaScript modules consistently. For local desktop testing, run `python3 -m http.server 8080` in the repository, then open `http://localhost:8080`. GitHub Pages provides HTTPS automatically.

## First hole

The game opens in Build mode. Tap to place your tee. Choose Green and paint a landing area, then choose Pin and tap inside it. Choose Fairway and draw a route. Add hazards if you want, then tap **Open hole**. Visitors arrive at check-in, pay, walk to the tee and play. A default par is recommended from length; edit it from Course routing → Details.

There are no compulsory layouts. A fairway stroke preserves existing green terrain, making it easy to connect the surfaces. Rough or Clear can reshape a green; moving a pin onto non-green terrain prevents reopening until corrected. Water or trees can make a hole practically impossible: golfers will attempt recoveries and may eventually pick up at a clearly reported stroke limit.

## Touch controls

| Mode   | Controls                                                                                                                                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build  | One finger paints or places the selected object. Brush slider changes diameter in yards. Two fingers pan/pinch; Move also allows one-finger panning. Undo refunds construction cost; redo charges it again.                 |
| Watch  | Drag to pan, pinch to zoom. Tap a golfer for their card; Follow tracks their ball and shots. Tap a tee or pin to inspect a hole.                                                                                            |
| Play   | Touch near your ball and pull backward. Pull direction aims in the opposite direction; pull length sets power. Release to swing. Drag elsewhere to inspect the course. Club selection is automatic, with a manual override. |
| Camera | +/− zoom. The crosshair frames the whole property. Aim at pin returns to your shot preview during a personal round.                                                                                                         |
| Time   | Tap the speed button for pause, 1×, 2× and 4×. Building pauses play. Personal golf limits time to 1×.                                                                                                                       |

The translucent landing ellipse is **uncertainty**, not an exact destination. The actual shot has contact, direction and distance variation. Driver accuracy, iron control, wedges, bunker play, putting and recovery all matter. The owner starts as a recreational golfer and improves slowly by completing holes.

## Golf and architecture

- Every golfer takes sequential shots. AI evaluates landing candidates, their dispersion, hazards, trees, slopes, reachable distance and remaining play. Sampled route analysis helps find fairway corridors and doglegs; strong or aggressive golfers may prefer a direct carry.
- The **same `executeShot` function** handles visiting golfers and the owner. Only the strategy input differs.
- Flight, tree interception, bounce, roll, surface friction, slope, water drops and out-of-bounds penalties are simulated. Putting uses direction/speed variance, green slope and cup capture. This is stylized two-dimensional golf with animated flight height, not a professional aerodynamic simulator.
- Terrain is internally sampled at four-yard resolution and rendered as a smooth, painted landscape. Navigation samples are coarser; they require no manual setup. Small details below that scale are intentionally abstracted.
- Hole details expose architecture estimates and **actual scoring averages** for beginners, club golfers and scratch golfers. Quality is separate from difficulty. Reviews consider experiences, value, pace, conditions, scenery, facilities and golfer preferences.
- Visitors queue at tees and wait for earlier golfers to clear landing areas. Admission intervals and an active-golfer cap prevent excessive crowding.

## Growing the club

Clubhouse → Operation controls admission, pricing, course care, day reports and tournaments. Revenue arrives at admission; completed rounds provide reputation, feedback and milestone grants. The day runs from 08:00, stops new arrivals at 18:00, and closes after late rounds. Nothing advances while the browser is closed.

The estate has four plots in a 2×2 layout; you own the northwest to start. Northeast and southwest cost $2,800 each; southeast costs $4,800 and requires an adjoining owned plot. Land purchases add space only. Course goals unlock **3 → 6 → 9 → 18** holes through completed visits, revenue, reputation and a par-or-better owner round. Six holes require 50 visits, $5,000 revenue, reputation 60 and a 3-hole par round; nine require 150 visits, $18,000, reputation 67 and a 6-hole par round; eighteen require 400 visits, $60,000, reputation 75 and a 9-hole par round. Claim upgrades on the goals board. Manage or add holes from Course routing. Redesigning remains available throughout the game.

Every visitor is remembered, including their abilities, preferences, visits, satisfaction and scoring on each hole. Happy golfers return, and higher reputation brings stronger demand. Clubhouse → Regulars reveals who your architecture suits. The map’s trail button overlays actual recent shots, filtered by ability or the owner. Name holes from Routing → Details.

Build a driving range from Facilities: tap its tee, then its target, and confirm the quoted cost. Visitors sometimes hit three real practice shots before their tee time, paying $3 for practice or $7 with coaching. Three practice bays prevent crowding.

Tournaments require at least 6, 9 or 18 open holes, cost $350 / $600 / $1,200 to host, and run for two operating days. Choose an ability audience, watch the live leaderboard, and earn $22 for each completed competitive round. Each golfer’s best round counts. Event hole designs and pars are locked until the event ends; owner rounds with the same routing and tee set also qualify. Winners remain in tournament history.

Facilities add comfort and services. Staff do specific jobs: groundskeepers repair wear, check-in workers shorten admission intervals and operate the shop, mechanics enable faster cart travel, professionals add paid range coaching, and service staff operate the café. Facility care and wages are charged daily. Beyond 18 holes, improve reputation, refine your architecture, run tournaments and pursue course records.

Records include hole scoring, longest drives, longest holed putts, closest approaches, aces, course records, visitor bests, personal bests and a record book. Different available routing configurations have their own current comparison; historical entries remain preserved. Nine- and eighteen-hole records populate when those rounds are played.

## Saves

Autosaves run every 20 seconds and after important changes. Ongoing rounds, their shot state, course terrain, height, business, statistics and personal skills are saved. A previous-save backup is retained. Versioned loading merges new defaults into older compatible saves without deliberately resetting progress.

Clubhouse → Save offers manual saving, JSON export/import and course naming. Local saves are specific to this browser and site address; signed-in courses also synchronize with Firestore. **Export a backup before clearing browser storage or switching devices.** Cloud saving uses the supplied Firebase project. Local and cloud adapters remain separate.

A service worker provides an offline fallback after the app has loaded successfully online. If you change the deployed game files yourself, use a new cache version in `sw.js`. The network is preferred, so ordinary updates appear without erasing saves.

## Root-only project structure

| File                                               | Purpose                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `index.html`, `style.css`                          | Responsive game shell and bottom-sheet interface                                |
| `app.js`                                           | Touch controls, editor transactions, HUD and management UI                      |
| `world.js`                                         | Terrain, brushes, property, hole definitions and architecture analysis          |
| `golf.js`                                          | Golfer generation, club selection, shot AI and shared execution physics         |
| `club.js`                                          | Plot purchases, course goals, returning golfers, tournaments and staff status   |
| `simulation.js`                                    | Visitors, queues, shot states, economy, records, progression and operating days |
| `render.js`                                        | Cached Canvas terrain, golfers, trajectory previews and camera                  |
| `cloud.js`, `firestore.rules`, `FIREBASE_SETUP.md` | Firebase accounts, chunked private cloud saves, access rules and setup          |
| `design.js`                                        | Tee sets, feature transforms, landing clusters, journal and staff advice        |
| `cloud-tests.mjs`                                  | Mocked Firebase, cloud conflict and design acceptance checks                    |
| `persistence.js`                                   | Versioned, compressed saves and backup adapter                                  |
| `sw.js`, `manifest.webmanifest`, `icon.svg`        | Offline fallback and app metadata                                               |
| `tests.mjs`, `package.json`                        | Dependency-free Node simulation acceptance checks                               |
| `.nojekyll`                                        | Direct static hosting marker                                                    |

All project files are at the repository root. No external fonts, images or runtime libraries are needed. Account features make HTTPS requests to Firebase; guest play works offline after the first load.

## Verification

Run `node tests.mjs` (or `npm test`) with modern Node to verify simulated play on straight, dogleg, double-dogleg and island-green courses, golfer skill differences, hazards, concurrent visitors, revenue, daily expenses and save round trips. Browser acceptance testing additionally exercised real touch events, brush painting, undo/redo, pinch/pan, personal slingshot shots, mid-round reload, land purchase, another custom hole and responsive phone/tablet layouts. See `VALIDATION.md` for the build's results and practical simplifications.
