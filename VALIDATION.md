# Wild Links 1.1.0 — validation

Validated on October 7, 2026.

## Simulation

`npm test` runs reproducible seeded acceptance checks against the actual shared golf engine:

- Straight, dogleg, double-dogleg and island-green layouts played by five golfer archetypes, all finishing without pickups.
- Forty novice and forty scratch rounds: novice average 4.425, scratch average 3.1 on the comparison layout.
- Concurrent traffic, paid admissions, daily wages, course wear, water penalties and playable drops.
- Distinct eighteen-hole and nine-hole rounds completed without pickups, recording scores of 63 and 31 in the seeded fixture.
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

Stylized 2D golf uses four-yard terrain samples, animated flight height, statistical execution variation, terrain interaction and sampled route decisions. Visitors have tee spacing and three separate practice bays. Facilities use clubhouse locations except the player-placed range. Persistence remains local with manual JSON backup/import; no cloud account is required. Physical mobile devices may render differently from browser touch emulation.
