# Implementation status — 13 November 2026

## Scope

Stage 0 discovery was completed first. The user then authorised a complete local concept mockup in this repository, with no external services or databases connected. The implementation therefore delivers the worker/office concept together, rather than beginning production Cloudflare stages or stopping for approval between individual mock screens.

The original supplied specification is archived verbatim in `SPECIFICATION.md`. Its filename refers to v2 while its internal version says 1.0. The user's later local-mockup instruction controls this iteration's repository, integration and release scope.

## Delivered

- [x] Independent `/sitelog/` application within the existing repository; no original files edited.
- [x] Responsive worker dashboard, persistent compact upload status, job selector, job search, optional one-shot nearby suggestions, daily records and media gallery.
- [x] Fictional worker/office identities, local invitation flow, mock one-time-code sign-in, session expiry, explicit safe sign-out/account switching.
- [x] Office job creation/editing, readable site descriptions, optional coordinates/radius, worker assignments, estimates/actual labour, time corrections, history, progress timeline, media and CSV export.
- [x] Integer-minute time calculations, break and overlap checks across jobs/dates, explicit overnight work, Pacific/Auckland date/DST handling.
- [x] Draft autosave, transactional note/time/media saves, user-scoped operations and explicit retry/conflict states.
- [x] Application-append-only time revisions, expected-version checks, readable comparison and intentional conflict resolution.
- [x] Real photo processing to at most 1920 px, WebP/JPEG fallback, thumbnails, persisted compressed blobs and SHA-256 checksums.
- [x] Video camera/library inputs, 50 MB file bound, large-video opt-in, local metadata inspection, playback/download; no transcoding claim.
- [x] Wi-Fi/mobile/any policies, conservative unknown-network behaviour, per-run manual override, pause/resume and retry. Notes/time sync independently of media policy.
- [x] Browser-local accepted “office” records, atomic idempotent finalisation, resumable queue after reload, bounded retry delays and cross-tab Web Lock where available.
- [x] Scoped manifest and service worker; explicit public-shell cache allowlist; real offline reopening in Chrome.
- [x] Storage estimates/pressure warning, persistent-storage request, clear quota/save errors and confirmation before destructive work removal/reset.
- [x] Dependency-free loopback development server, tests, lockfile, original local icons/illustrations and documentation.

## Verification actually run

| Command/check                           | Result                                                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm --prefix sitelog test`             | **15/15 passed**: time arithmetic, DST, overlap, overnight, business dates, network rules, permissions, revision conflicts, queue projection, CSV escaping and distance |
| `npm --prefix sitelog run check`        | **17 JavaScript files passed** syntax checks; manifest scope, icon files and zero-dependency policy passed                                                              |
| `npm --prefix sitelog run test:browser` | **45/45 passed** in installed Chrome 138 with a disposable profile; no uncaught browser exceptions                                                                      |
| Visual inspection                       | Desktop and 390 px mobile screenshots inspected                                                                                                                         |
| Existing tracked files                  | Unchanged; only `sitelog/` was added                                                                                                                                    |

The browser suite exercises draft recovery after reload; note editing without duplication; offline time/note saves; real 2400×1600 → 1920×1280 WebP processing; a real short WebM file; unknown-network hold and manual override; office corrections and history; job creation/assignment; local invitations; revision conflict resolution; idempotency; worker restrictions; expired-session preservation/renewal; code sign-in/reuse rejection; public-only cache contents; actual network-disabled reopening; mobile overflow; canonical redirects; and plain/encoded dotfile blocking by the local server. Both existing site routes return HTTP 200 from the local server.

## Limits and remaining production work

- This is a mockup, not the production application. Identity, email, uploads, office records and permissions are browser-local simulations. No secure cookies, private RPC, D1/R2, external mail service, server clock or production REST endpoints exist.
- Local records/history are inspectable and modifiable through browser developer tools. “Demo synced” is not an external backup. Other browsers/devices do not share the data.
- No real iPhone/Android camera, installation, storage-quota exhaustion or location-accuracy test was performed. Follow `MANUAL_TESTS.md` on actual devices.
- Video codec support depends on the browser; imported clips are unchanged. Browser storage may be evicted. Background uploads while the app is closed are not guaranteed or implemented.
- The local server binds to loopback, so a phone needs a separately reviewed HTTPS preview to exercise its camera/PWA. No tunnel, LAN exposure or hosted preview was created.
- Notes support editing; time entries retain application revision history. Production approval/locking, retention, originals, backups and legal/privacy review remain future work.
- Current Wrangler is unsupported on the Big Sur host. A later Cloudflare implementation needs a supported cloud build/test runtime and reviewed deployment configuration.

## Cloudflare/manual actions

**None performed.** No nameserver/DNS/email/GitHub Pages changes, cloud resources, credentials, Git push, deployments or hosting configuration changes were made. Production integration remains a separate task requiring the user's instruction and the reviewed routing/rollback plan.

## Next step

Run the mockup and experiment with the worker/office workflows. Refine the product and device interactions before replacing the mock authentication and office adapters with independently deployed services. See `README.md` for exact run commands and demonstration scenarios.

# Operations expansion — Stage 0 and Stage 1

The operations specification is now checked in as `SiteLog_Operations_Codex_Specification.md`. Stage 0 discovery is documented in `SITELOG_GAP_ANALYSIS.md`; that document maps all sections and SL-01–SL-24 to actual repository files and missing functionality. Original mockup delivery above remains historical, not a claim that the operations expansion is complete.

Baseline rerun before implementation: **15 unit tests passed, 17 JavaScript syntax checks passed, 45 Chrome workflow checks passed**, with no uncaught browser exceptions.

## Staged operations checklist

- [x] **Stage 0 — Discovery:** full specification/instructions read; architecture, schema, auth, queue, UI, tests and deployment inspected; gaps, risks, scope and preservation plan recorded.
- [x] **Stage 1 — Time and location (existing local app):** additive schema migration; central effective weekly schedules; remaining-gap/break suggestions; identity/locked-entry permissions; atomic overlaps/revisions/idempotency; mobile/context-safe/offline forms; credible nearby/manual selection; regression/migration/concurrency tests.
- [ ] **Stage 2 — Commercial foundations:** contacts/roles, supplier approvals, material/supplier price book, UOM conversions, client price precedence, terms templates/history.
- [ ] **Stage 3 — Quote flow:** standalone quote/revisions, decimal pricing/GST snapshots, planning, persistent mobile totals, editable terms snapshots, safe client projections and print/CSV exports.
- [ ] **Stage 4 — Authorisation/conversion:** issued-revision acceptance, charge-up authorisation, immutable acceptance, idempotent job/material/inspection creation, explicit additional-scope mode, historical job review/backfill.
- [ ] **Stage 5 — Delivery planning:** orders/partial receipts, inspections/outcomes, contractor bookings, schedule/agenda, dependencies and readiness.
- [ ] **Stage 6 — Job records/change control:** versioned documents/categories/access, photo covers/repeat-capture, decisions, variations/approval and generated tasks.
- [ ] **Stage 7 — Contract/payment administration:** reviewed applicability/rules/templates, exact claim/schedule/service snapshots, manual reviewed deadlines where unresolved, no automated legal action.
- [ ] **Stage 8 — Hardening/staging:** full permissions/offline/concurrency/migration/export/device/accessibility/licence checks, backup/restore rehearsal and reviewed release runbook. Production remains separately authorised and manual.

Stage 1 is implemented and verified in the existing browser-local application. The production server/authentication portions remain unavailable infrastructure, as detailed below. Stages 2–8 have not been started; they remain required on the checklist.

## Stage 1 implemented behaviour

- `src/migrations.mjs` upgrades the existing database to v2 with additive schedule/history/audit stores and indexes. It keeps the database name, original records/IDs, media bytes, drafts, assignments and queues intact. Existing personal suggestions are retained as review-only data, without invented working days or effective dates. Hours-only records remain readable, including when no historical creation timestamp exists.
- Office → **Usual hours** manages effective-dated per-weekday patterns, explicit overnight shifts and breaks, with a Monday-to-weekdays copy shortcut, expected revisions and audit history. Workers read only their own schedule; the former personal preference remains preserved rather than overriding central data.
- `src/time-suggestions.mjs` calculates remaining intervals across jobs, suggests only the available interval after the latest recorded interval, offers earlier gaps explicitly and subtracts only unallocated usual break. It handles covered/non-working/unconfigured days and hours-only review honestly. Actual start/end/break values remain editable.
- `src/time-form.mjs` retains the existing job/session defaults and offline outbox, keeps actual values/drafts on context changes, persists unresolved context confirmation, collapses optional notes and keeps a touch-sized save action visible at 320 px. Lost job access does not silently reassign a draft to another site.
- `src/timesheet-service.mjs` checks active identity, assignments, ownership, lock status, revisions, overlaps and replay receipts inside one IndexedDB write transaction with accepted records/history/audit/outbox completion. Concurrent calls do not rely on Web Locks to prevent overlaps. Locked office corrections need explicit intent and a reason, retain lock status and record actor separately from worker.
- The existing sync engine persists overlap conflicts and opens an actual-time correction flow even when a new entry has no accepted same-ID record. Corrected operations sync once; notes/media policies and existing functionality remain intact.
- `src/permissions.mjs` and the mock API return explicit worker-safe job/time/schedule projections, excluding commercial fields and other workers' private time/schedules. Demo role switching stays an explicitly simulated facility.
- `src/nearby-jobs.mjs` uses assignment, optional coordinates, radius and accuracy to distinguish credible, ambiguous, poor-accuracy and no-match suggestions. Denied GPS/manual selection continue working. No GPS storage/transmission or automatic site switching was added.
- The public-shell service-worker cache advances to v2 and includes the new public modules, with `/sitelog/` scope retained. No third-party dependency was added.

## Stage 1 results actually run

| Check                                   | Result                                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm --prefix sitelog test`             | **31/31 unit tests passed** (original 15 plus 16 schedule/gap/permission/location/legacy validation tests)                                              |
| `npm --prefix sitelog run check`        | **28 JavaScript files passed** syntax, manifest scope/icons and zero-dependency checks                                                                  |
| `npm --prefix sitelog run test:browser` | **45/45 existing workflow checks + 33/33 Stage 1 checks passed**, Chrome 138, disposable profile; no uncaught browser exceptions                        |
| Migration fixture                       | Actual v1→v2 IndexedDB upgrade; every original row compared; original/thumbnail bytes compared; queue/draft/hour-only preservation verified             |
| Concurrency                             | Simultaneous overlap, replay and stale corrections tested directly at service boundary without Web Locks; one accepted result and recoverable conflicts |
| Offline                                 | Draft/context reopened, time correction persisted through reload, one new revision after reconnect; offline-overlap corrected and replayed once         |
| Mobile                                  | 320 px page/dialog overflow and visible 44 px save-action checks passed; screenshot inspected                                                           |
| Existing site                           | Local `/` and `/family/` regressions passed; their source files and infrastructure unchanged                                                            |

Only synthetic disposable-profile data was used; no valued user profile was migrated, reset or reseeded by these checks. The normal app performs an additive migration when the user next opens it. Read `MIGRATIONS.md` before trying it with valued local records.

## SL coverage after Stage 1

- **Local implementation covered:** SL-12, SL-13, SL-14 and SL-16; the worker ownership/lock/history/projection portion of SL-15. Service checks are browser-local, not server/cross-device guarantees.
- **Regression/partial:** SL-01 and SL-22 pass Chrome mockup regression/offline tests; actual-phone and production auth/staging checks remain. SL-21's hours-only behaviour is covered; terms/cost/acceptance review belongs to later stages. SL-23's time/date/DST/break tests are covered; decimal/UOM/margin tests await Stages 2–3. SL-24 has local migration recovery/licence/manual-release documentation; real isolated environments/restore rehearsal remain Stage 8.
- **Still required later:** SL-02–SL-11 (commercial flow and safe client output), SL-17 (repeat capture/cover completion), SL-18 (document versions), SL-19 (approved variations), SL-20 (reviewed contract/payment workflow), and the remaining parts of the partial IDs above. Nothing was silently dropped from the staged checklist.

## Blockers and limitations

1. **Server enforcement is not implemented:** the repository has no real REST API, auth Worker/private RPC, D1 or other server database. The existing local-only instruction and AGENTS scope were retained. Production SL-01/14/15/24 verification requires a separately authorised backend/authentication implementation and configured isolated infrastructure; no credentials or services were fabricated.
2. **Device tests remain manual:** no actual iPhone/Android camera, installed-PWA keyboard/safe-area, GPS accuracy, quota exhaustion or browser-profile restore test was performed. Browser emulation does not establish those results.
3. **Real schedules are not supplied:** no company hours were invented. Configure them through Office → Usual hours; previous saved personal preferences are available for review. This does not block recording actual times.
4. **No destructive downgrade shortcut:** IndexedDB cannot open v2 as v1. Recovery uses a compatible v2 build or a verified pre-upgrade profile backup; see `MIGRATIONS.md`. No automatic reset/import was introduced.

No production deployment, external order/email/booking, DNS change, cloud resource, Git push or commit was performed. Next implementation stage, after review, is **Stage 2 — Commercial foundations**.
