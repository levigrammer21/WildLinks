# Wild Links 1.0.0 — validation

Validated on October 7, 2026.

## Simulation checks

- Straight, dogleg, double-dogleg and island-green courses: beginner, regular, veteran, bomber and scratch golfers all completed their holes through sequential shots.
- All 20 initial layout/archetype combinations finished without stroke-limit pickups.
- Across 40 seeded rounds per skill group on the straight fixture, beginners averaged **4.425**, while scratch golfers averaged **3.100**. Execution skill affects actual outcomes.
- Concurrent admissions served **60 completed rounds** in the traffic fixture. Revenue was earned, maintenance/wages were charged, and day advancement worked.
- Water produced a penalty and a playable drop.
- Painted terrain, raised elevation, persistent golfer statistics and an ongoing player visit survived a compressed/versioned save round trip.
- A scratch visitor played all **18 individually defined holes** and finished without a pickup, setting an **18-hole record of 60**. A separate nine-hole round set a **9-hole record of 28**.

These are reproducible seeded results from `node tests.mjs`, not preassigned game scores.

## Browser checks

Chromium ran the actual static application over HTTP. Real dispatched touch events exercised the Canvas editor and shot controls.

- Constructed a custom bending fairway, tee, green, pin, water and sand through the interface.
- Confirmed construction costs, undo refunds, redo charges, and fairway preservation of existing green terrain.
- Tested two-finger pinch and camera movement.
- Opened a hole; a visitor arrived, paid and completed it through the live simulation.
- Played an owner round using pull-back gestures, including club suggestion, landing uncertainty, animated shots and putting.
- Reloaded during a shot; restored the ongoing round and its association with the persistent owner golfer. Finished the round and earned personal golf experience/statistics.
- Earned the first land-purchase prerequisites through completed visits, bought land through the UI, and constructed another distinct hole on it.
- Exercised the remaining land purchases with eligible test balances/reputation/visit counts, confirming capacities of 6, 9 and 18.
- Built the pro shop, hired check-in and grounds staff, and confirmed shop income increased paid visitor receipts.
- Exported a JSON backup, imported it through the file picker and confirmation, and restored the full property capacity.
- Reloaded successfully with networking disabled after the service worker cache was populated.
- Checked phone portrait, phone landscape, tablet landscape and tablet portrait at **360×740, 390×844, 844×390, 1024×768 and 768×1024**. Navigation remained inside the viewport with touch-sized buttons and no document overflow.
- Browser acceptance completed with **zero JavaScript runtime errors**.

## Practical scope

The game uses stylized 2D golf, sampled terrain, animated flight height and statistical execution errors. It does not model professional aerodynamic ball flight. Terrain samples are four yards; walking between lies is simplified, and tee queues/landing-area clearance provide the pace system. Facilities occupy preset spaces beside check-in, while all golf-hole layouts are freely painted. Browser emulation validates the touch interface; physical device/browser combinations may render slightly differently.

Persistence is local, with JSON backup/import and a replaceable storage adapter. There is no cloud backend without credentials. Offline fallback begins after a successful online load. Progression continues beyond 18 through design refinement, reputation, records and club tournaments.
