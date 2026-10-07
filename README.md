# Wild Links — v1.0.0

A mobile-first golf course sandbox and tycoon game. Start with an undeveloped property, $5,000, a check-in hut, and one hole. Paint your own golf architecture, open it to paying visitors, watch their shots, and play the same course yourself.

## Publish on GitHub Pages

1. Extract this ZIP. Upload **the files inside it directly into your repository root**, including `.nojekyll` if your upload method supports it. Do not upload a containing folder.
2. Enable GitHub Pages for that branch, serving the repository root.
3. Open your Pages address in a modern browser. There is **no build step, backend, account, API key, or dependency installation** needed to play.

The `index.html` file must be served over HTTP or HTTPS; double-clicking it as a local `file://` document will not load JavaScript modules consistently. For local desktop testing, run `python3 -m http.server 8080` in the repository, then open `http://localhost:8080`. GitHub Pages provides HTTPS automatically.

## First hole

The game opens in Build mode. Tap to place your tee. Choose Green and paint a landing area, then choose Pin and tap inside it. Choose Fairway and draw a route. Add hazards if you want, then tap **Open hole**. Visitors arrive at check-in, pay, walk to the tee and play. A default par is recommended from length; edit it from Course routing → Details.

There are no compulsory layouts. A fairway stroke preserves existing green terrain, making it easy to connect the surfaces. Rough or Clear can reshape a green; moving a pin onto non-green terrain prevents reopening until corrected. Water or trees can make a hole practically impossible: golfers will attempt recoveries and may eventually pick up at a clearly reported stroke limit.

## Touch controls

| Mode | Controls |
| --- | --- |
| Build | One finger paints or places the selected object. Brush slider changes diameter in yards. Two fingers pan/pinch; Move also allows one-finger panning. Undo refunds construction cost; redo charges it again. |
| Watch | Drag to pan, pinch to zoom. Tap a golfer for their card; Follow tracks their ball and shots. Tap a tee or pin to inspect a hole. |
| Play | Touch near your ball and pull backward. Pull direction aims in the opposite direction; pull length sets power. Release to swing. Drag elsewhere to inspect the course. Club selection is automatic, with a manual override. |
| Camera | +/− zoom. The crosshair frames the whole property. Aim at pin returns to your shot preview during a personal round. |
| Time | Tap the speed button for pause, 1×, 2× and 4×. Building pauses play. Personal golf limits time to 1×. |

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

Land expansion supports **1 → 3 → 6 → 9 → 18** holes. Purchases require money, reputation and completed visitor rounds. Land adds space; it does not install any prebuilt holes. Manage or add holes from Course routing. Redesigning remains available throughout the game.

Facilities add comfort and services. Staff do specific jobs: groundskeepers repair wear, check-in workers shorten admission intervals and operate the shop, mechanics enable faster cart travel, professionals run the range, and service staff operate the café. Facility care and wages are charged daily. Beyond 18 holes, improve reputation, refine your architecture, run club opens and pursue course records.

Records include hole scoring, longest drives, longest holed putts, closest approaches, aces, course records, visitor bests, personal bests and a record book. Different available routing configurations have their own current comparison; historical entries remain preserved. Nine- and eighteen-hole records populate when those rounds are played.

## Saves

Autosaves run every 20 seconds and after important changes. Ongoing rounds, their shot state, course terrain, height, business, statistics and personal skills are saved. A previous-save backup is retained. Versioned loading merges new defaults into older compatible saves without deliberately resetting progress.

Clubhouse → Save offers manual saving, JSON export/import and course naming. Saves are local to this browser and this site address. **Export a backup before clearing browser storage or switching devices.** Cloud saving is not enabled without backend credentials; the persistence adapter is isolated so it can be replaced later.

A service worker provides an offline fallback after the app has loaded successfully online. If you change the deployed game files yourself, use a new cache version in `sw.js`. The network is preferred, so ordinary updates appear without erasing saves.

## Root-only project structure

| File | Purpose |
| --- | --- |
| `index.html`, `style.css` | Responsive game shell and bottom-sheet interface |
| `app.js` | Touch controls, editor transactions, HUD and management UI |
| `world.js` | Terrain, brushes, property, hole definitions and architecture analysis |
| `golf.js` | Golfer generation, club selection, shot AI and shared execution physics |
| `simulation.js` | Visitors, queues, shot states, economy, records, progression and operating days |
| `render.js` | Cached Canvas terrain, golfers, trajectory previews and camera |
| `persistence.js` | Versioned, compressed saves and backup adapter |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Offline fallback and app metadata |
| `tests.mjs`, `package.json` | Dependency-free Node simulation acceptance checks |
| `.nojekyll` | Direct static hosting marker |

All project files are at the repository root. No external fonts, images, libraries or runtime requests are needed.

## Verification

Run `node tests.mjs` (or `npm test`) with modern Node to verify simulated play on straight, dogleg, double-dogleg and island-green courses, golfer skill differences, hazards, concurrent visitors, revenue, daily expenses and save round trips. Browser acceptance testing additionally exercised real touch events, brush painting, undo/redo, pinch/pan, personal slingshot shots, mid-round reload, land purchase, another custom hole and responsive phone/tablet layouts. See `VALIDATION.md` for the build's results and practical simplifications.
