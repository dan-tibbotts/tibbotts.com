# SiteLog — local concept workspace

A working, dependency-free mockup of SiteLog, built in this repository at `/sitelog/`. The existing homepage, `/family/`, DNS and hosting configuration are unchanged. Nothing has been deployed.

## Run

From the repository root:

```sh
npm --prefix sitelog start
```

Open **http://localhost:4173/sitelog/**. Node 22 or later is required; no package installation is needed. The server binds only to this computer's loopback interface. Open the URL rather than double-clicking `index.html`, since modules, IndexedDB and service workers need a web origin.

The same server serves the existing homepage and family pages unchanged. Set `SITELOG_PORT` to use another port. Changing hostname, browser or port creates a different browser-storage origin.

## Try it

1. The mockup opens as **Alex Taylor**, a fictional worker, with sample jobs and records.
2. Record time, add a note, or select multiple photos. Photos really resize and compress. Video accepts a camera/file-picker clip up to 50 MB, without transcoding.
3. Open **Settings → Experiment with connectivity → Simulate offline**. Add records, close/reopen or reload the app, then reconnect.
4. The top upload button opens the queue. **Wi-Fi only** is the default. An unknown network holds media; **Upload now using this connection** gives a one-run override. Notes and hours do not wait for media preferences.
5. Open **Settings → Morgan Reed** for the office view. Review job hours, correct timesheets, see revision history, create jobs, assign workers and create local demo invitations.
6. Try **Settings → Try an edit conflict** to compare a queued correction with a different office revision. Resolve it intentionally.
7. Try session expiry and renewal. Signing out preserves unsynced work under its creating account, with an explicit explanation.
8. Sign in using a demo persona, or request a code for `alex@example.test`, `sam@example.test` or `office@example.test`. The mock email displays the code on screen. No email is sent.
9. Export time entries as CSV from Daily records or Office → Timesheets. Resetting the demo requires confirmation and restores the fictional seed data.

First use must load the app shell from the local server. Once the service worker is installed, the app can reopen without the server or network. Browser installation support varies; iOS installation uses Safari's Add to Home Screen. Real-phone camera and iOS installation testing remain manual.

## What is real, and what is simulated?

| Real browser functionality                                     | Local simulation                                    |
| -------------------------------------------------------------- | --------------------------------------------------- |
| IndexedDB persistence, draft autosave, account-scoped queue    | Sign-in, OTP delivery and office permissions        |
| Time calculations, overlap validation, NZ timezone/DST         | An office record set in the same browser database   |
| Revision conflict handling and append-only application history | Session expiry and user switching                   |
| Photo resize/encoding, thumbnails and SHA-256 checksums        | Upload progress; no file is transmitted             |
| Video/file capture inputs, local playback and download         | Invitations create browser-local fictional accounts |
| Public-shell offline cache and scoped PWA manifest             | Network type can be selected as a test scenario     |
| CSV export, manual one-shot location suggestions               | No Cloudflare, D1, R2 or email connection           |

**“Demo synced” is not a cloud backup.** All data and files remain on this device, in this browser. Clearing site data removes them. Use fictional data only. Local authentication and revision history are not tamper-resistant security boundaries; anyone with this browser's developer tools can alter the database.

## Checks

```sh
npm --prefix sitelog test
npm --prefix sitelog run check
npm --prefix sitelog run test:browser
```

The optional browser suite launches an installed Chrome with a disposable profile, a local server on port 4174 and Chrome debugging on port 9223. It needs no npm dependencies. Set `CHROME_PATH` if Chrome is installed somewhere unusual. Close other processes using those test ports first. The suite creates synthetic files, never sends email, and cleans up its own browser/server/profile. Its mobile screenshot is written to the operating system's temporary directory as `sitelog-mobile.png`.

See [architecture](docs/ARCHITECTURE.md), [implementation status](docs/IMPLEMENTATION_STATUS.md), [manual tests](docs/MANUAL_TESTS.md) and [future deployment](docs/DEPLOYMENT.md).

## Operations expansion — Stage 1

Discovery and the staged plan are in [SITELOG_GAP_ANALYSIS.md](docs/SITELOG_GAP_ANALYSIS.md). The operations specification is archived in [SiteLog_Operations_Codex_Specification.md](docs/SiteLog_Operations_Codex_Specification.md). This history describes the earlier time-entry stage. The v3 local expansion is now implemented as described below; real cloud/security integration remains separate.

Switch to **Morgan → Office admin → Usual hours** to configure a worker's effective weekly pattern. Enter Monday, select it as a working day and use **Copy Monday to weekdays**, or specify different days individually. There is no invented company schedule: unconfigured/non-working days ask for actual times. Previous explicit personal suggestions are retained for office review.

Record Time now finds remaining gaps across jobs, avoids repeating the day's unpaid break and preserves manual edits/drafts when the date or worker changes. Earlier gaps are explicit choices; a fully recorded usual shift requires actual extra time. Hours-only legacy records stay readable and require review before automatic gap calculation. Locked entries need an explicit office correction with a reason.

The browser database now upgrades additively to schema v8 (including the earlier v2 time/schedule migration) without renaming it, clearing data or reseeding existing installations. **Read [migration/backup/recovery notes](docs/MIGRATIONS.md) before trying the upgrade with valued local data.** The application is still a local mockup, not a production authentication or cloud service.

## v3 local expansion

The compact header on every page displays the installed package version. Tap it for Git/build UTC/environment details and update controls. `npm start` builds a complete immutable artifact once. To try a new local build while the server runs, use `npm --prefix sitelog run build`, then **Build Details → Check for updates → Reload**. Finish open forms first; saved drafts, uploads, preferences and private files remain on the device. Generated artifacts are ignored in `.build/`.

In Morgan’s office interface, try:

1. **Contacts & approvals / Price book:** add a client and supplier, explicitly approve the supplier, then enter items, supplier buy costs/conversions and client sell rates. Manual sell overrides require a reason.
2. **Terms / Quotes:** configure your own Standard clauses and business branding, create a standalone quote, move it to Review and issue an immutable snapshot. Print/Save as PDF and CSV use that snapshot; XLSX is the explicit [staged follow-up](docs/XLSX_FOLLOW_UP.md). No legal wording is invented.
3. **Acceptance:** record who approved the issued quote, when and the supporting reference. One linked job, planned materials and inspections are created, even if the request retries. Direct jobs use a recorded charge-up authorisation instead.
4. **Schedule / Materials & orders:** plan workers/subcontractors, review conflicts and readiness, prepare/record manual orders and receive partial deliveries. No supplier or authority is contacted.
5. **Inspections / Documents / Decisions:** retain outcomes/follow-ups, upload immutable file versions, explicitly share appropriate site information and record decisions. Accepted photo thumbnails can be job covers; repeat capture preserves its reference.
6. **Variations / Job costing:** record submitted/approved changes without rewriting the accepted quote. Compare original/revised/pending estimates with accepted hours, explicit labour-cost bases, received material costs and outstanding commitments.
7. **Backup & restore:** download a complete private local archive, verify/rehearse restoration in isolation, or import missing records while retaining every existing ID. Login codes/sessions are excluded.

All of this remains a browser-local concept. Use synthetic information; no cloud API, real authentication, R2, external email/order/inspection booking or production deployment is connected.
