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
