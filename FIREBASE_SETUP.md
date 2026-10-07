# Firebase setup — Wild Links 1.2

The game already contains the supplied configuration for **wildlinks-1de54**. It uses Firebase Authentication and the default Cloud Firestore database. No build step or additional SDK installation is needed.

## Two console settings

1. In Firebase → **Authentication → Sign-in method**, enable **Email/Password** and save. The game’s Create Account form requires matching passwords twice. Firebase enforces the project’s password policy too.
2. In Firebase → **Firestore Database → Rules**, replace the editor contents with the complete contents of **firestore.rules**, then click **Publish**. These rules permit each authenticated player to read/write only their own course collection and deny anonymous access. Do not use open/test-mode rules for private saves.

Upload all ZIP contents directly into the GitHub repository root. GitHub Pages still serves the game; Firebase stores accounts and course snapshots.

## First sign-in

Tap **Local save** near the top of the game. Create an account or sign in. Choose **Bring local course** to add your existing browser course to your account; its original local copy is kept. Each account has separate local and cloud course slots. Starting another course retains previous properties and carries your owner golfer’s career forward.

Email/password sessions persist on this browser. Passwords are never saved in game storage. Forgot Password sends Firebase’s recovery email.

## How saving works

Local saves run after important actions and every 20 seconds. Cloud writes are coalesced, with a visible Sync pending / Syncing / Cloud saved / Offline indicator. **Sync now** requests an immediate upload. Offline changes remain local and retry after reconnecting; a course must have been opened on that device to be available offline there.

Large course data is split into immutable snapshot documents. The course’s head pointer changes only after every part has uploaded. A server timestamp precondition prevents stale devices from overwriting a newer save. Two cloud snapshot generations are retained during normal successful saves. Local course backups are kept too.

If devices disagree, choose **Keep both courses** or **Open cloud version**. Opening the cloud version first retains the local one as a separate backup. Avoid switching browsers, clearing browser data, or signing out while the indicator shows unsynced changes if you need those changes on another device. Export JSON remains available.

## Troubleshooting

- **Email/Password disabled:** enable that provider in Authentication.
- **Cloud rules needed:** publish the supplied rules in the default Firestore database.
- **Sync failed / Offline:** keep playing locally, reconnect, then tap Reconnect & refresh or Sync now.
- **Choose save:** resolve the two-device conflict from the account/course list.

The automated suite verifies account forms and cloud save/conflict flows with an isolated Firebase-response harness. It does not create a real account in your project or publish console settings for you. Verify a live sign-in and a phone-to-iPad course load after publishing the rules.
