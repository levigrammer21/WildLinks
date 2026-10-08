# Wild Links 1.3.0

- Named workers appear on the property: groundskeepers ride mowers on fairways, tend greens and rake bunkers; professionals work beside the range; check-in, cart and café employees work at their facilities. Staff cards show current tasks and Find centers the camera on a worker. Groundskeepers must reach and perform their work to restore conditions.
- Golfers and staff use terrain-aware walking routes, prefer paths, avoid ponds, and cross placed footbridges. Disconnected island greens retain a visible ferry crossing. Walking golfers carry bags, animate their steps and react to actual shot outcomes; landings show sand, leaves, splashes or celebratory particles.
- Build eight procedural decorations in Build → Decor or Clubhouse → Decor & fans: benches, flowers, rocks, fountains, signs, arches, footbridges and viewing stands. Placement is quoted; move, rotate, remove, Undo/Redo and saves are supported. Nearby landscaping contributes modestly to beauty feedback.
- Viewing stands seat twelve fans. Tournament competitors, strong golfers and established returning players with a recorded under-par best attract spectators nearby. Fans pay a configurable admission, walk to seats, cheer good shots and leave after play. Gate receipts are tracked separately in daily reports; higher admission reduces demand. Total live spectators are capped at 48 for mobile performance.
- Returning golfers improve gradually through completed rounds. Owner improvement remains tied to personally playing completed holes. Existing properties migrate without resetting progress.

# Wild Links 1.2.2

- Add an install screen with native prompt support, Android/iPad fallback instructions and installed-app recognition. Supply 180/192/512 PNG icons, a maskable icon, manifest identity, Apple web-app metadata and complete offline caching.
- Replace already-built facility purchase buttons with Move. Guard duplicate confirmations and deduplicate old facility entries on load.
- Fix facility rendering to honor saved positions; rendering, selection and golfer arrivals now share one position source. Include the check-in hut and driving range in relocation controls.
- Validate building footprints and spacing. Relocations retain quotes, Undo/Redo and persistence and do not reset hole design statistics.

# Wild Links 1.2.1

- Fix tree recovery: low punch shots use procedural trunk/canopy collision and search sideways/backward safe exits. Owners and AI share the new recovery club and physics.
- Fix repeated course-record announcements: compare each routing/actual tee configuration against its own historical best, normalize fallback tees, preserve ties, and exclude picked-up/incomplete rounds. Reconcile existing record books on load.
- Permanently dismiss the tutorial overlay when the first hole opens, including existing saves.
- Simplify driving-range placement to one tap plus review/confirmation, with rotation, optional manual targeting and owned-corridor validation.

# Wild Links 1.2.0

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

# Wild Links 1.1.1

- Fix starting a new course: install and save fresh state without allowing an exit autosave to restore the previous property. Reset active rounds, editor history and camera; retain the existing confirmation.

# Wild Links 1.1.0

- Begin with capacity for three holes on the northwest plot. Buy three adjoining plots without changing hole capacity.
- Earn 6, 9 and 18-hole capacity through the course-goals board, with additional naming, regulars, range and tournament challenges.
- Show actual recent shot trails by golfer ability or owner. Landing markers distinguish penalties.
- Place a driving range anywhere on owned land. Visitors sometimes warm up with three simulated shots before their round; professionals offer paid coaching.
- Remember visiting golfers, their preferences, satisfaction, repeat visits, personal bests and per-hole scores. Follow regulars from their profiles.
- Host fixed-routing, two-day 6, 9 and 18-hole tournaments for selected skill audiences. Keep named winner history and count each entrant’s best completed round.
- Show live staff activation, facility prerequisites, concrete benefits and daily wages.
- Preserve old terrain, land access, earned capacity, records and ongoing visits during save migration.
