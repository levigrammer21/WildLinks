# Wild Links 1.2.1 — validation

Validated on October 7, 2026.

## Simulation

`npm test` runs reproducible seeded acceptance checks against the actual shared golf engine:

- Straight, dogleg, double-dogleg and island-green layouts played by five golfer archetypes, all finishing without pickups.
- Forty novice and forty scratch rounds: novice average 4.425, scratch average 3.1 on the comparison layout.
- Concurrent traffic, paid admissions, daily wages, course wear, water penalties and playable drops.
- Distinct eighteen-hole and nine-hole rounds completed without pickups, recording scores of 61 and 31 in the seeded fixture.
- Three starter slots; plot purchase adjacency; locked-plot boundaries; land purchases preserving capacity.
- Course upgrades requiring completed visits, revenue, reputation and a qualifying owner round.
- Returning visitors retaining identity, with active visitors excluded from repeat admission.
- Three range shots using shared physics, practice/coaching receipts and zero practice strokes on the course scorecard.
- Actual shot trails, per-member hole history, persistent practice statistics and save round trips.
- Six-hole elite tournaments: ability eligibility, fixed routing, qualifying completed entries and winner history.
- Staff facility prerequisites and active status.
- v1.0 save migration preserves full-property terrain access, earned eighteen-hole capacity and prior owner records.

## Browser

Chromium ran the static application over HTTP with real touch events:

- Painted a bending fairway, tee, green, pin, water and bunker. Checked expenses, undo and redo.
- Used two-finger pinch and pan. Opened a hole and watched a paid visitor finish.
- Played an owner round through touch slingshot controls and restored a saved round during flight.
- Bought adjoining land without increasing capacity, then built a separate dogleg and named it Heron Bend.
- Placed and confirmed a driving range with touch controls; visitors practiced and finished their rounds.
- Enabled actual golfer trails, inspected regular profiles, goals, records, events and live staff explanations.
- Claimed the 6, 9 and 18-hole upgrades through the interface using eligible test histories; bought all four plots while retaining capacity.
- Hosted an elite six-hole tournament, completed an entry, archived its winner and reloaded its history.
- Checked 360×740, 390×844, 844×390, 1024×768 and 768×1024 layouts for viewport overflow and touch-sized navigation.
- Reloaded the application offline after service-worker installation.

Test fixtures set eligible business balances/history to exercise later progression without waiting hundreds of live rounds. Competitive entries and golf scores are produced by sequential simulation, not assigned final results.

## Scope

Stylized 2D golf uses four-yard terrain samples, animated flight height, statistical execution variation, terrain interaction and sampled route decisions. Visitors have tee spacing and three separate practice bays. Facilities start at clubhouse locations and can be relocated with the design tools; the range is placed manually. Guest play uses local persistence; accounts add private cloud course slots. JSON backup/import remains available. Physical mobile devices may render differently from browser touch emulation.

## Earlier reset regression

Real phone-sized touch interactions verified reset cancellation, a failed-storage attempt preserving the current course, fresh cash and three-hole capacity, fresh simulation/renderer state, and reload after a page-exit autosave. Zero JavaScript runtime errors. The complete simulation suite also passed.

## 1.2 acceptance checks

The updated Node suite and Chromium touch acceptance suite passed with zero JavaScript runtime errors.

- Existing save migration and separate per-account local vaults; starting another property preserves previous courses and the owner career.
- Confirmed registration rejects mismatched passwords before any request. Signup, remembered sessions, token renewal and password-reset requests use Firebase REST API shapes.
- Full compressed course snapshots round-trip through immutable cloud chunks; multiple courses queue independently. A stale device cannot overwrite the newer head. Offline failures preserve local data.
- Actual mobile account forms: bring guest course into the account, create a second course, load on another device, resolve conflicting edits by retaining both properties, and sign out without exposing account courses to the guest vault.
- Forward tee placement, recommended par, missing-tee fallback and tee-aware scoring/records.
- Resize an organic green to 120%, undo and redo, move it with its pin, undo and redo, and enforce owned-land boundaries and quoted construction expenses.
- Inspect actual landing clusters, redesign statistics, regulars, staff advice and journal screens; phone/tablet viewport checks and offline reload.
- Selected Forward tees for an elite event, verified twelve scheduled invitees and automatic leaderboard updates, and opened the final winner/trophy results screen.
- Rechecked the business interface for 6/9/18-hole upgrades, all four plots, an elite six-hole competitive round, winner history and reload.

Firebase account and cloud tests use an isolated response harness. They verify requests, interface behavior and save conflicts without creating a real account or changing the supplied Firebase project's console settings. The owner must enable Email/Password and publish firestore.rules; a live cross-device check is still needed after that setup. Browser touch emulation does not substitute for testing on every physical phone model.

## 1.2.1 regression checks

- 120 seeded recovery trials across beginner and scratch golfers, in a grove and with water blocking the forward route. All escaped within four shots; average recovery shots were 1.08 and 1.18 respectively.
- Five different ability profiles recovered from tree lies and holed out through sequential simulation without pickups.
- Course records remain unchanged for worse scores, ties and pickups; alternate tee labels using the Standard position share a comparison. Real alternate tees retain distinct bests. Save/reload reconciles old record history.
- Actual phone-sized touch events: build/open a hole, confirm the tutorial clears, enter Build again without its return, place a range with one tap, rotate, choose a manual target, confirm construction expenses, and reload. Verified the owner receives the shared Punch shot club in a tree lie.
- Phone, landscape and tablet viewport checks passed with zero JavaScript runtime errors. The complete original simulation/cloud suite also passed.
