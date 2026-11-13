# Architecture

The November 2026 SiteLog specification remains the product brief. The user's subsequent instruction authorises a complete browser-local mockup inside this repository, without external services or databases. This replaces the separate-repository and incremental cloud-release plan for this iteration.

## Boundaries

```text
app.mjs / ui.mjs       Screens, dialogs, accessible controls and user interactions
          |
domain.mjs            Pure date/time, access, network and CSV rules
          |
records.mjs           Local operations, record projection and atomic draft commits
          |
sync.mjs              Queue lifecycle, connectivity policy and retries
          |
mock-api.mjs          Simulated office validation, accepted records and revisions
          |
mock-auth.mjs         Demonstration identity, invitations and expiring local sessions
          |
store.mjs             IndexedDB transactions and storage operations
```

`media.mjs` performs real browser-side photo processing, checksums and video metadata inspection. `seed.mjs` inserts fictional data only on the first launch or explicit reset. `service-worker.js` only caches a fixed allowlist of public shell assets under `/sitelog/`.

The UI reads accepted records overlaid with the current user's pending changes. Office views show the accepted browser-local office copy; they do not expose other accounts' pending drafts. Workers see assigned jobs and their own hours. Notes/media on assigned jobs are shared job records.

## Storage and atomicity

Drafts are written on input. Saving a note/time operation and removing its draft is one IndexedDB transaction. Media blobs/thumbnails and their queue operation are also committed together. Success feedback follows the transaction's completion.

The simulated office commits an accepted entity, revision (for time), idempotency marker and synced operation in one transaction. Replay does not duplicate records. A Web Lock serialises sync across tabs where supported. An interrupted `syncing` operation is returned to `queued` on startup. Failed operations persist with bounded exponential retry delays; conflicts require human resolution.

The local queue uses `queued → syncing → synced`, with `failed` and `conflict` branches. In-progress form drafts live in a separate user-scoped draft store and represent the conceptual `draft` state. Queue state `synced` is displayed as **Demo synced**.

## Future service replacement

Replace `mock-auth.mjs` with same-origin `/sitelog/auth/*` calls and secure server sessions. Replace `mock-api.mjs` with `/sitelog/api/*` transport while retaining domain/UI and queue concepts. Move validation, permissions, idempotency and immutable history to the server; client code cannot enforce these against an attacker.

A production migration must redesign how authenticated caches are loaded and how media finalisation works. Do not export this prototype database into production as trusted records. Do not deploy the demo code path as a production authentication fallback.

## Compatibility

Uses standard HTML/CSS/modules, IndexedDB, Web Crypto, canvas and service workers. `createImageBitmap` falls back to an image element. Network type and persistent storage APIs are optional. Native file inputs provide video capture on supporting mobile browsers and a library fallback. Unsupported video codecs may store successfully but fail playback in that browser. Video transcoding is intentionally absent.

The current Mac can edit/run the Node server and pure tests. No Wrangler or native Cloudflare runtime is required. Actual iPhone/Android behaviour, quota exhaustion and location permissions need the manual checklist.

## Operations Stage 1 extensions

The existing UI, mock identity, IndexedDB, media and single sync engine are retained. `time-form.mjs` and `schedule-form.mjs` extract focused form behaviour from the existing UI coordinator. `work-schedules.mjs` validates/selects effective weekly patterns; `time-suggestions.mjs` subtracts all-job intervals and allocates only the remaining usual break. Earlier gaps, covered days, non-working days and legacy records have explicit states. `nearby-jobs.mjs` evaluates optional coordinates, accuracy, assignment and radius without storing GPS or changing the selected site.

`permissions.mjs` provides explicit worker projections and entry/lock checks. `schedule-service.mjs` and `timesheet-service.mjs` use `store.readwrite()` to perform validation and mutations within one live IndexedDB transaction. No asynchronous network/crypto gaps or app-level Web Locks are required for atomic time acceptance. Existing notes/media/outbox code is reused.

These remain local simulation boundaries. A real server/auth/database implementation is still necessary for production enforcement. The v2 service-worker cache includes the new public modules and retains `/sitelog/` scope; private records remain outside CacheStorage.

## v3 feature modules and release boundary

The existing application is extended, not rebuilt. `app.mjs` coordinates shared navigation and existing worker capture. New cohesive modules handle release/build identity; exact decimal money and price-book rules; transactional commercial changes; quote/terms lifecycle and allowlisted exports; acceptance/direct authorisation; planning/purchasing/immutable receipts; inspections/decisions; immutable private local documents; variations and job costing; and local archive validation/restore rehearsal. Feature services recheck the current office identity, revision and state within the write transaction. No asynchronous file hashing/network gaps occur inside those transactions.

`permissions.mjs` returns explicit worker projections and filters other identities’ unsent drafts/queues from normal office workspace reads. The privileged local backup action deliberately archives this browser’s synthetic workspace, including retained drafts and files, but excludes sessions/OTP state. Archive import only adds missing IDs. All of these are mock boundaries, not trusted server enforcement.

`build.mjs` injects package/Git/time/environment once; `release.mjs` and the generated SW keep installed code and metadata bound to one immutable artifact. Cross-tab update preparation checks open forms/durable writes and quiesces the existing single worker sync engine. Office commercial edits remain central/mock online commands; local quote editor drafts can persist offline. No second competing worker outbox is added.

Additive schema 8 retains the database name and original records. The native opener shares concurrent connection attempts and lets an older tab reopen a newer database only if all stores it requires remain present; it never downgrades/deletes data or runs an older migration against a newer schema. Unknown/incompatible clients fail safely and need a compatible artifact.
