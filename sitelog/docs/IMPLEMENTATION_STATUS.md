# Implementation status — 13 November 2026

**Current local workspace:** v3 A1–A7 and local A8 recovery/hardening are implemented. The application remains a dependency-free browser mockup with additive schema 8. Historical results below are retained; the final verification matrix records the latest run. Real cloud/security/device/legal release gates remain open. See [release notes](RELEASE_NOTES.md) for changed-file groups and [README](../README.md) to run it.

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
- [x] **Stage 2 — Commercial foundations:** contacts/roles, supplier approvals, material/supplier price book, UOM conversions, client price precedence, terms templates/history.
- [x] **Stage 3 — Quote flow:** standalone quote/revisions, decimal pricing/GST snapshots, planning, persistent mobile totals, editable terms snapshots, safe client projections and print/CSV exports.
- [x] **Stage 4 — Authorisation/conversion:** issued-revision acceptance, charge-up authorisation, immutable acceptance, idempotent job/material/inspection creation, explicit additional-scope mode, historical job review/backfill.
- [x] **Stage 5 — Delivery planning:** orders/partial receipts, inspections/outcomes, contractor bookings, schedule/agenda, dependencies and readiness.
- [x] **Stage 6 — Job records/change control:** versioned documents/categories/access, photo covers/repeat-capture, decisions, variations/approval and generated tasks.
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

# v3 addendum — A0 baseline assessment

13 November 2026. Read both supplied v2 and v3 specifications in full; v3 extends v2. v2's archived `SPECIFICATION.md` was verified byte-for-byte against the supplied file. The v3 addendum is archived as `SiteLog_Copilot_Expansion_Instructions_v3.md`. Applicable AGENTS instructions and current source were inspected at clean baseline commit `a011ad6d66d607b2fffeadf649ff064c530f291c`.

**Current authorisation: assessment only.** No header/version/build/update code or business feature was implemented in A0. The original mockup and operations Stage 1 records above remain historical/current functionality; their completion does not mean v2 production stages or v3 A1 are complete.

## Findings and documents

- `V3_BASELINE_ASSESSMENT.md`: v2 stage-by-stage reality check, v3 module gaps, proposed data/API slices, dependencies, risks, package policy and test evidence.
- `VERSIONING_AND_RELEASES.md`: proposed smallest A1 slice, immutable installed build identity, every-screen header coverage, two-build/multi-tab update protection, backend separation, tests and rollback.
- `DECISIONS.md`: scope/order interpretations and unresolved commercial differences. No conflict was silently resolved by rewriting runtime behaviour.

Version is currently **0.1.0 in package metadata**, but the application only hardcodes **v0.1 in its footer**. Header/login/error versions, Git SHA/time/environment, an API `/about` response and controlled release updates are missing. The fixed `sitelog-shell-v2` cache and network-first unversioned assets do not establish immutable build identity or two-build update safety. The application remains browser-local, with no real API/auth Workers, D1/R2, CI or deployed environment isolation.

## Addendum checklist and priority

This order changes the **next priority** to A1 rather than proceeding directly to earlier operations Stage 2. It does not remove the prior operations or v2 baseline requirements.

- [x] **A0 — Baseline audit only:** both briefs read, code/architecture/version/cache/schema/permissions/tests inspected, gaps and staged plan recorded.
- [x] **A1 — P0 visible version/build/update:** package-sourced SemVer in compact header and login/offline/error paths; immutable Git/build UTC/environment metadata; independent safe API identity when available; fingerprinted artifact/cache; safe update notification/check/reload preserving all local work; two-build and multi-tab tests.
- [ ] **Baseline production integration gate:** independently deployed real auth/API, private RPC, email/bootstrap/abuse/CSRF controls, D1/R2/migrations, private media and isolated preview/stage environments. Required before real employee/commercial data and production API-security claims; local A1 does not need this setup.
- [x] **A2 — Customers/suppliers/subcontractors/price book:** contacts and approval history, item/UOM and effective supplier costs, exact NZD/quantity primitives, client sell-rate precedence and office-only permissions.
- [x] **A3 — Terms/quotes/exports:** configurable/reviewable Standard templates and independent ordered quote clauses, standalone lifecycle/revisions, persistent totals, safe snapshots/print/PDF/CSV and reviewed branded XLSX or explicit testable follow-up.
- [x] **A4 — Acceptance/job conversion:** recorded acceptance/direct authorisation, immutable quote baseline and unique source links, atomic/idempotent job/material/inspection creation, safe existing-job migration and additional-work mode.
- [x] **A5 — Schedule/materials/purchasing:** job/crew/subcontractor activities, conflicts/readiness/dependencies, approved-supplier orders/partial receipts, explicit external-send semantics and authorised offline worker summaries.
- [x] **A6 — Inspections/documents/decisions:** inspection booking/outcome/follow-up history, private immutable document versions/categories/visibility/downloads and decisions register. Existing media, accepted thumbnail covers and repeat-capture source links are retained.
- [x] **A7 — Variations/job costing:** recorded approvals, original/approved/pending budget separation, reliable actual/committed/received cost bases, reconciled job reports and no worker financial leakage/rankings.
- [x] **A8 — Local hardening/recovery:** synthetic end-to-end scenarios, archive/byte restoration rehearsal, privacy/permissions, all office screens at 320px, safe update/failure/rollback and unchanged homepage/family regressions.
- [ ] **A8 external release gates:** real auth/API/private storage, deployed staging, real database recovery, iOS/Android installation/accessibility, reviewed legal/retention settings and explicit manual production approval. These remain deferred by the local-mockup scope.

Earlier operations contract/payment controls remain on their existing future checklist; no legal templates, deadlines or compliance claims are introduced in this assessment.

## A0 checks actually run

| Check | Result |
| --- | --- |
| `npm --prefix sitelog test` | **31/31 passed** |
| `npm --prefix sitelog run check` | **28 JavaScript files passed**; manifest/icons/zero-dependency policy passed |
| `npm --prefix sitelog run test:browser` | **45 existing + 33 operations Stage 1 checks passed**; no uncaught browser exceptions; disposable Chrome profile |
| Source/spec inspection | Package 0.1.0, hardcoded footer v0.1, static cache v2, no build pipeline or API `/about`; actual paths recorded in assessment |
| A1-specific verification | **Not run: not implemented.** No installed-version, two-build update or production metadata tests currently exist |

No new packages were added. No real phone, live Cloudflare account/DNS/route, production deployment, trusted backend, real database restore or legal-compliance verification was performed. Browser test success does not establish those results. Test data stayed synthetic/disposable; no user records were migrated/reset by A0.

**Next reviewable milestone: A1 only**, following `VERSIONING_AND_RELEASES.md`. Missing backend/auth infrastructure, real-device acceptance and approved commercial/legal configuration remain explicit dependencies, not reasons to fabricate functionality. Assessment changes are confined to `sitelog/docs/`; app source, version, database schema/data, media preferences, authentication separation, URL scope and hosting remain unchanged.

# v3 execution — A1 Application Versioning

The user approved A0 and explicitly authorised implementation of A1 followed by A2 and subsequent phases incrementally, without routine approval stops. Production release and destructive/irreversible actions still require approval. Preserve the earlier A0 assessment as a historical snapshot; its assessment-only instruction no longer limits the current authorised work.

A1 implementation is complete in the existing local application:

- `scripts/build.mjs` generates an immutable public artifact from the authoritative package version, validated Git SHA, one UTC build timestamp and an allowlisted environment. Content-derived build IDs bind all native modules/styles/manifest/icons to `/sitelog/assets/<buildId>/`; no runtime pseudo-version or secret/environment dump is used.
- The compact worker/office header, login, boot and storage-error views display a clickable package-sourced version. Build Details shows installed Git/time/environment/build identity and separately fetches the safe, no-store `/sitelog/api/about` local preview-server identity. It never relabels the running frontend from server metadata.
- `src/release.mjs` detects waiting releases and supports explicit Reload, Later and Check for updates. Open forms block reload; pending draft writes and stored media are checked; the existing sync engine quiesces without changing the saved upload policy. All SiteLog tabs participate in a readiness handshake. Unknown/legacy clients defer updates until closed/reloaded.
- The generated service worker serves immutable complete shells, preserves old active clients' assets and candidate install/waiting caches, cleans only obsolete SiteLog static caches, and never deletes IndexedDB or caches API/auth data. A multi-tab test caught and fixed premature candidate-cache cleanup.
- No A1 database migration or data reset is performed. Local builds/server run on the existing Node environment; no dependency or cloud resource was added. `npm start` builds once; `npm run build` creates/switches a completed artifact atomically for local preview.

Verification at the A1 checkpoint: **35 unit tests passed** (31 existing + 4 build tests); **78 existing Chrome workflow checks passed**; **20 new A1 Chrome checks passed** on the packaged build, including A→B update with queued time/note/photo/video/conflict data retained, another dirty tab blocking activation, offline installed identity, storage-error version and a 320 px header. No production deployment or real-phone verification was performed. The API identity is explicitly `local-mock`; real Worker authentication/API/private storage remain future integration work.

A1 changed build/server scripts, the public-shell service worker, release UI/module, index/styles, sync quiescing, package scripts and build/update tests. Next phase: **A2 contacts, approvals and price book**. The user confirmed that explicit office manual sell overrides require a recorded reason and take precedence; automatic suggestion is client-specific rate then standard sell rate.

## A2 implementation checkpoint

Contacts with multiple roles, explicit supplier/subcontractor approval, searchable office contact and price-book screens, effective supplier buy prices/UOM conversion, client sell rates, expected-revision checks and immutable commercial history are implemented. The manual override decision is recorded in DECISIONS. Schema 3 is additive; no existing data is reset. Workers are denied commercial-service reads and commercial tables are excluded from worker DTOs. All records remain local mocks.

A2 focused verification: 43 unit tests passed, 38 JavaScript files passed syntax/manifest/dependency checks, and 16 commercial browser checks passed. Full regression results are recorded below after completion. No new dependencies, external services or production changes.

## A3 short implementation plan

Add focused terms, quote domain/service/UI/export modules; extend the existing office tabs rather than rebuilding the application. Additive schema 4 stores templates, standalone quotes, immutable issue snapshots and office/user-scoped editor drafts. Existing commercial revision/audit commands remain transactional. Terms start empty/unconfigured, with no invented legal wording. Provide ordered plain-text clauses, independent quote copies, duplicate warnings, explicit review/issue, revision and decline/cancel/expiry actions. Client exports use an allowlist excluding supplier costs and margins; native browser print/PDF and formula-safe CSV require no dependencies. Branded XLSX remains a documented/testable follow-up subject to licence review. Tests cover exact totals, terms independence, issue immutability, permissions, mobile tabs/totals and draft recovery. Rollback retains additive stores and older quote snapshots; never reset data to roll back static files.

A2 full regression checkpoint: **43 unit, 114 browser checks passed**, including all original/operations/A1 checks; 38 JS syntax files and zero-dependency/manifest policy passed.

## A3 implementation checkpoint

Implemented standalone quote list/search/editor, Items/Terms/Review navigation without tab validation, local office drafts/recovery, persistent mobile totals, plain-text terms templates/history and confirmed clause removal, independent quote terms, manual/client/standard selling rates separate from supplier cost snapshots, explicit reprice, inspection plans, review/issue/decline/cancel/expiry/revise/duplicate commands, immutable issue snapshots, single-business branding and private-field-free print/PDF-compatible/CSV exports. Schema 4 is additive. No terms/legal review is fabricated. XLSX remains the permitted explicit staged follow-up in `XLSX_FOLLOW_UP.md`.

Focused verification: **48 unit tests passed**, **21 A3 Chrome checks passed** including end-to-end UI creation/issue, independent snapshots, concurrency, mobile 320px, local draft recovery and worker denial. Full regressions are rerun after integration. No production deployment, external sends or new dependencies.

## A4 short implementation plan

Add an atomic office quote-acceptance command and prospective direct-job authorisation. Additive schema 5 introduces material requirements, job inspection plans and authorisation records with unique source links. Acceptance records the exact issued revision, manual reference/date and accepted baseline, then creates one job with planned requirements/inspections in the same transaction. Repeated/concurrent requests return the same job. Existing jobs retain their IDs, assignments, records and access, with missing acceptance clearly marked for office review rather than invented. Existing-job quote association remains a separately approved optional workflow. Tests target concurrent/retried acceptance, snapshot carry-over, prospective direct-job gates, worker denial, and UI acceptance. No purchasing, bookings or external messages happen on acceptance. Rollback preserves additive data and source IDs; no destructive downgrade.

A3 full regression checkpoint: **135 browser checks passed** (45 original, 33 operations, 20 A1 including office quote-draft retention, 16 A2, 21 A3); 48 unit tests passed.

## A4 implementation checkpoint

Implemented atomic, idempotent quote acceptance with unique source constraints; exact issued office/client baseline on the job; copied planned material requirements and inspection plans; recorded acceptance/date/reference; linked quote/job UI; prospective direct-job authorisation and expected-revision checks; retained legacy jobs/assignments/time without fabricated approval. Additive schema 5. Focused verification: **15 A4 Chrome checks passed**, including concurrent acceptance, retries with stale revisions, exactly-once child records, immutable accepted quote, direct-work gate, preserved legacy data, UI acceptance and worker DTO restrictions. Syntax/manifest/zero-dependency checks passed across 46 JS files at this checkpoint. No production change or external message/order.

## A5 short implementation plan

Extend the office with day/week/agenda planning and material/purchase-order views. Additive schema 6 stores planned activities, purchase orders and immutable receipt events; continue using the existing transactional commercial audit/revision mechanism. New orders require approved suppliers, keep quoted procurement snapshots and record supplier-change reasons, reserve requirements against duplicate ordering, and distinguish prepared/manual issue/confirmation from an actual external send. Partial receipts use exact quantities, idempotency and deliberate over-delivery reasons. Schedule conflicts, dependencies and stage-relevant readiness require recorded overrides; rescheduling preserves actual times and identifies dependent plans for review. Worker DTOs expose only assigned schedule and delivery summaries, readable offline, with no cost/price leakage. Native UI/Node tests add no dependencies. Rollback keeps all additive data and immutable receipt history; no production action.

A4 full regression: **48 unit tests and 150 Chrome checks passed**. An existing Stage 1 test race was corrected to wait for an open time dialog; closed dialogs retain their previous DOM, which the earlier assertion sometimes inspected. Production functionality was not changed to satisfy the test.

## A5 implementation checkpoint

Implemented office day/week/agenda NZ work planning, worker/subcontractor allocations, dependencies/cycle checks, approval/conflict/material-readiness overrides, dependent-plan review on reschedule, materials Outstanding/Ordered/Due/Received filters, typed manual requirements, approved-supplier purchase orders with snapshots and supplier-change reasons, duplicate-order reservation, separate manual issue/confirmation, print/PDF-compatible manual order view, cancellation and immutable/idempotent partial receipts with deliberate over-delivery reasons. Worker authorised upcoming plans and safe delivery summaries reopen offline and contain no financial data. Worker primary capture actions remain ahead of the upcoming list.

Schema 6 is additive. Focused verification: **52 unit tests and 22 A5 browser checks passed**. The latter cover purchasing and schedule services plus real office forms, exact partial receipt, historical records, worker restrictions and offline schedule reload. Full suite is rerun below after integration. No dependency, external service, real order/send or production deployment was added.

A5 unit verification after export/format checks: **54 tests passed**. Added hostile-text/private-field checks for manual PO print views and exact cent formatting at safe-integer limits. The application/test dependency set remains empty.

## A6 short implementation plan

Add focused inspection, decision and document services/UI using existing job/quote/source links. Additive schema 7 stores immutable inspection events, decisions, logical documents and immutable document versions; private file bytes use separate UUID keys in the existing local blob store (a local stand-in, not R2). Office actions schedule/book/outcome/follow-up inspections with preserved history, record decisions and upload multiple validated files/new versions. Worker reads/downloads require current assigned-job access and explicit sharing, with safe projections. Native download/print/index exports use no dependencies; hostile/oversized files, stale versions and unauthorised downloads are tested. Retain current media/upload policy and guard any selected unsaved document files during PWA updates. No external bookings, R2 provisioning or production deployment. Rollback retains additive metadata and immutable file bytes; no reset/delete migration.

A5 full regression checkpoint: **54 unit tests and 172 Chrome checks passed**. Existing homepage/family routes remained unchanged in the regression suite.

## A6 short verification checkpoint

Inspection booking/outcomes/follow-ups, decision revisions, private multi-file upload and immutable document versions, office history/access controls, supporting-document selectors, safe document-index CSV/authenticated UI links, worker shared-job views and authorised downloads are implemented with additive schema 7. Outcomes distinguish pass/failure and preserve corrective history. Quote-origin inspection phase/consent/lead time/responsibility is retained. Download validation is basic file/MIME/signature checking, not malware scanning; real private R2 and signed URLs remain deferred. Native attachments are used for untrusted files.

Focused verification so far: **57 unit tests passed and 18 A6 browser checks passed** before adding cover/repeat-capture checks. Office-selected thumbnail job covers and same-job repeat photos are also implemented; their extra browser checks and the full regression are run before closing A6. No new dependencies, external bookings or production changes.

## A7 short implementation plan

Add office variations with exact detailed pricing, immutable submission/approval records and explicit recorded approval. Approved changes generate material/inspection follow-up records idempotently while the original accepted quote stays unchanged. Add job costing with distinct original/approved/pending/revised estimates, accepted actual minutes and explicitly configured effective job labour-cost rates, received material costs versus outstanding ordered commitments, and manually recorded subcontractor commitments/completions. Show missing cost bases as unknown rather than zero; no payroll or worker rankings. Additive schema 8 and typed services/UI preserve all original data. Tests reconcile exact totals, approvals, retry generation, missing rates, received/committed separation, privacy and exports. Rollback retains additive records; no destructive migration or production action.

A6 focused verification complete: **21 browser checks passed**, including selected-thumbnail covers, repeat-photo queue/source linkage and preserved explicit Wi-Fi preference. The full regression is running before A7 integration.

A6 full regression checkpoint: **193 browser checks passed** with the added photo cover/repeat workflows; 57 unit tests passed before A7 tests were added.

## A7 implementation checkpoint

Implemented detailed draft/submitted/approved/rejected/withdrawn variations, immutable submission history/inspection, recorded approval and idempotent material/inspection generation, additions/credits, supporting files and same-job decision/inspection/document associations. Original accepted baselines stay immutable. Office job-cost summaries/CSV distinguish original, approved, pending and revised estimates, accepted actual labour, explicit effective job cost rates, received actual materials, outstanding order balances and manual subcontractor commitments/completions. Missing costs remain unknown and worker financial DTOs remain excluded. Commercial document categories are office-only.

Additive schema 8. Focused verification: **64 unit tests and 14 A7 Chrome checks passed**, including actual acceptance/time/receipt workflows, reconciliation, concurrent variation approval, office forms and worker denial. A further commercial-document policy test and the full suite are run before A8. No payroll, external accounting, statutory notice generation, dependency or production deployment was added.

A7 full regression checkpoint: **65 unit tests and 207 Chrome checks passed**, including document-commercial-visibility policy and every existing workflow.

## A8 local hardening plan

Add an office-only complete local backup archive containing typed records, original blobs/thumbnails, metadata and checksums while excluding sessions/one-time login codes. Validate archives and rehearse restoration into a new disposable database with byte/checksum read-back. Provide reviewable import of missing records only: existing IDs/data are preserved, conflicting records are skipped, and unique-constraint failure aborts the import rather than overwriting anything. Keep backups local/downloaded; no external storage or production database action. Tests cover tampering, retained drafts/outbox/blob bytes, office permission and non-destructive import, plus all office screens at 320px. Finish licence/privacy/scope and documented release/rollback checks. Real phone, real auth/API/R2/database backups, staging and production acceptance remain explicit external/manual gates under the user's local mockup boundary.

## A8 local implementation checkpoint

Added complete office-only local archives with file/thumbnail bytes and checksums, excluded sessions/OTP state, explicit review and disposable restore/read-back rehearsal, and append-only missing-ID import retaining existing data. Update preparation waits for backup work. Older tabs can reopen retained stores after additive upgrades; incompatible schemas fail safely without downgrade/recreation. Office workspace DTOs omit other identities’ unsent drafts/queues, and commercial document policy is enforced for legacy visibility flags too. Mobile document hashes/references wrap correctly.

Focused A8 verification: **31 browser checks passed** (backup, missing-ID replay, byte restoration, session retention, compatibility, privacy, all 16 office tabs at 320px, document history layout and worker denial). A1 now also has failed-install, quota-write and explicit rollback checks; the complete final run is recorded below after it finishes. No third-party packages, external services, real orders/messages or production changes.

## Final local verification — 13 November 2026

| Check | Actual result |
| --- | --- |
| `npm --prefix sitelog test` | **69 passed, 0 failed**: existing time/schedule/privacy plus build, exact money, quotes/exports, planning/costing, file validation and archive integrity/unsafe-reference checks |
| `npm --prefix sitelog run check` | **73 JavaScript files** passed syntax checks; manifest scope/icons and zero-dependency policy passed |
| `npm --prefix sitelog run build` | **Passed**, package-sourced version with generated Git/UTC/local environment and immutable artifact |
| Original browser workflows | **45 passed** |
| Operations Stage 1 browser workflows | **33 passed** |
| A1 installed version/update/failure/rollback | **23 passed** |
| A2 contacts/approvals/pricing | **16 passed** |
| A3 terms/quotes/editor/export boundaries | **21 passed** |
| A4 acceptance/conversion/authorisation | **15 passed** |
| A5 planning/materials/purchasing/offline | **22 passed** |
| A6 inspections/decisions/documents/photos | **21 passed** |
| A7 variations/cost reconciliation | **14 passed** |
| A8 archive/restore/privacy/mobile/compatibility | **31 passed** |
| Total Chrome browser checks | **241 passed, 0 failed** |
| `git diff --check` | **Passed** |
| Changes outside `sitelog/` | **None** |

The final privacy pass also escapes shared UI action/status attributes and rejects unsafe archive identifiers/references. Tests use disposable browser profiles and synthetic files/data; no existing user's browser database was reset or migrated by the test runner. Generated local builds are ignored. No production deployment, push, external service/database connection, supplier order, email, council booking or website infrastructure change occurred.

**Remaining prerequisites/follow-ups:** reviewed real auth/API/private R2/D1 and service-side permissions; real preview/staging/production configuration and database recovery; iPhone/Android installed-PWA/accessibility and legacy-profile acceptance; reviewed business/legal/retention policies and real approved terms; branded XLSX per `XLSX_FOLLOW_UP.md`; formal contract/payment/statutory workflows under their separate scope. These are not claimed complete by local tests. None blocks experimenting with the implemented local concept. Production remains separately authorised/manual.

## Startup/static-hosting repair — 14 November 2026

The reported public URL was serving the raw source index. Its generated `build-info.mjs` was absent (HTTP 503), so static imports failed before `app.mjs` could render its error UI. The built localhost preview returned the correct generated module and was usable. This was a missing static-hosting verification path in the previous run.

Added an import-free startup wrapper with a caught, actionable failure view; modern mobile-app meta tag; and `build:static` packaging for a complete `/sitelog/` immutable static tree. Packaging retains older asset folders, includes generated build identity/service worker, leaves the active preview pointer alone and never publishes. Browser test helpers now locate the module directory without assuming a particular entry filename.

New verification: **70 unit tests passed**, including static package completeness/retention; **7 startup/static browser checks passed**, reproducing raw-source failure without touching a database, then loading the packaged application on a plain static server and retaining records offline. Full regressions are rerun below. No production deployment, DNS/Pages/route change or user database/cache clearing performed.

Final repair verification (14 November): **70 unit tests, 248 browser checks, 77 JavaScript syntax/manifest/dependency checks passed**. Both `build:static` (production-labelled, local output only) and normal preview build succeeded. Local page, bootstrap and generated metadata each return HTTP 200. The extra seven browser checks use a plain static server, including an offline reopen. `git diff --check` passed. The generated review bundle is `.build/static/sitelog/`; public publication is still pending the user's required production approval.

## GitHub Pages and service strategies — 14 November 2026

The current authorised change supports the user's existing branch-based Pages publication: `build:pages` writes tracked `sitelog/index.html`, `service-worker.js`, `pages-build.json` and complete `assets/<buildId>/`; source HTML/SW moved to `templates/`. `check:pages` verifies source/config/build-script/version freshness plus every asset and both entries. No Actions workflow, root `.nojekyll`, hosting, DNS, homepage or family change is introduced. Local generation never commits/pushes/deploys.

`deployment.json` selects GitHubPages or Production. The composition root/factory validates explicit service method ports. All feature UI and sync business calls use the selected facade. GitHubPages composes the existing mock implementations and keeps the current database/queue/legacy sync lock. Production selects a separate class and reserved client namespace, but deliberately raises `PRODUCTION_NOT_CONFIGURED` before seed/DB/network/app initialization until real adapters are implemented. It does not fall back on mock code. UI demo actions are capability guarded. Full future AI contracts/security/cache/rollout guidance is in `DEPLOYMENT_STRATEGIES.md`.

Verification checkpoint: **76 unit tests and 258 browser checks passed**, including all existing workflows plus real repository static Pages entry, generated selector/identity, immutable target separation, stale/missing asset detection, protected Production startup/data preservation, URL selector isolation and mock strategy reset. Syntax/manifest/zero-dependency checks passed across **89 source/test/script files** (generated asset copies are verified by `check:pages`). Final source/configuration checks follow after documentation/formatting. No new dependencies or production resources connected.

GitHub Pages/strategy final checklist:

- [x] Complete committable root entries, generated identity/config and immutable assets; no separate Node host required on Pages.
- [x] Build/check commands for the user's existing commit/push workflow; source templates remain separate; stale/missing/changed output is detected.
- [x] Build-time GitHubPages/Production selection, factory and validated ports used by UI and sync.
- [x] Existing mock storage, drafts/media/outbox and cross-tab lock preserved.
- [x] Independent Production strategy with explicit startup/method errors and no mock seed/auth/data/network fallback.
- [x] AI handoff guide specifying method responsibilities, cache separation, server-authoritative security and production acceptance gates.
- [ ] Real Production authentication/business/database/file adapters and infrastructure: intentionally deferred, not simulated as working.

Final verification: **76 unit tests passed**, **258 full browser checks passed**. After preserving the legacy mock sync lock, **78 focused original/update/deployment checks passed again**; unit tests and syntax checks were rerun. **89 source/test/script syntax checks**, manifest/icon/zero-dependency policy, `check:pages`, local build, Production review build and `git diff --check` passed. The Production build is a deliberately blocked extension point. No files outside SiteLog changed, and no commit, push, deployment or external service connection was performed. Only the current unpublished Pages artifact is retained in this change; future builds retain prior published asset directories.

## Office navigation and page forms — 14 November 2026

Office sections now have direct side-menu links grouped under Office, Commercial, Project delivery, Team and Workspace. The long office tab strip is removed; mobile users get the same grouped Office menu. Active links identify the selected section.

Data-entry forms across worker and office workflows now render in the main content area with Back/Cancel actions and normal document scrolling. Existing draft/save/validation handlers are retained; background refreshes preserve the active editor, and an account change removes that editor. Read-only detail views, confirmations, the compact job chooser and device settings retain dialogs. These are application page views in the existing single-page prototype, without new URL routes or reload recovery for forms that did not already save drafts.

Job selectors and the Jobs search use searchable comboboxes with keyboard navigation, no-result feedback and selection through the original form controls. Results show the site name, address and smaller client text, searchable by all of those plus job code. Client names resolve from customer contacts, source quotes or direct-work authorisations; worker snapshots expose the client name only alongside authorised jobs. Existing jobs without a client show “Client not recorded”. No commercial contact records are added to worker snapshots.

Validation: 77 unit tests and 259 browser checks passed across the full existing browser suite plus the new navigation/form/combobox checks. Browser assertions now recognise an active page form as well as an open dialog, and the mobile time check scrolls the document to Save. New checks cover grouped navigation, editing through background refreshes, client search, keyboard selection and 320 px mobile forms. Syntax/manifest/dependency checks passed. Follow-up verification and the refreshed local Pages artifact are recorded below; nothing was published.

Final verification: 77 unit tests and 93 syntax/manifest/dependency checks passed again. After the account-change guard and explicit client-search fixture, 34 focused navigation/mobile/time checks passed; the 320 px page-form screenshot was reviewed. `build:pages`, `check:pages` and 10 browser checks against the regenerated Pages artifact passed. `git diff --check` passed. Generated assets retain the prior build, and no commit, push or publication was performed.

## Client portal, Parties and formal authorisation — 14 November 2026

Implemented the supplied request in the existing application. Phase 1 adds additive v9 Party/contact/representative stores, multi-relationship Parties, preserved legacy customer IDs and separately verified party grants. Phase 2 adds the client shell, issued quote views, combined-commitment approval, immutable batch/individual/work-authorisation evidence and idempotent atomic reuse of the original quote-to-job conversion. Phase 3 adds team-owned instructions, RFIs, issues, variation requests and shared versioned documents; the existing variation approval path handles formal priced changes. Phase 4 adds current requirements for clients and assigned site workers, permission-filtered formal activity, office outstanding actions, impact review and acknowledgement.

Larger forms use the page-form infrastructure from the prior change. No general messaging or invoice placeholders were added. Office actions are available in the grouped side menu. The opt-in fictional quote walkthrough uses the existing quote issue services and the clearly labelled Casey Wilson demo persona. No authority is inferred for existing customer parties.

Backend work includes storage-neutral domain commands, serialised/atomic repository implementations, REST request/session/origin validation, safe client projections, current-version document downloads and a credentialed REST frontend adapter. The original staff quote/variation paths share the extracted transaction logic. Existing source/job/material/inspection uniqueness is retained; document-version uniqueness is now indexed correctly. The default server returns `PORTAL_NOT_CONFIGURED` for portal REST. Production services remain explicitly blocked, without mock authentication fallback.

See [CLIENT_PORTAL.md](CLIENT_PORTAL.md) for the functioning local walkthrough, models, endpoint contract and remaining production integration. Real client authentication/session issuance, external identity provisioning, production database/object storage and the existing Production service adapters remain unconfigured. No production data, hosting, account, messaging service or external infrastructure was changed. This is a working local portal with tested server-side rules, not a claim that a live secure client deployment now exists.

Final portal verification: **104 unit/HTTP tests passed**, including all 15 requested acceptance areas through domain, REST and browser coverage. The full **273-check browser suite passed**. After the final shared-conversion party-link change, **60 focused portal/quote/acceptance/deployment browser checks passed** against the final source and regenerated Pages entry. **121 JavaScript syntax/manifest/dependency checks**, `build:pages`, `check:pages` and `git diff --check` passed. The mobile portal screenshot was reviewed. Browser coverage includes a real v8→v9 customer migration, combined financial commitment, explicit authority, client→office→client acknowledgement, worker requirements, and escaped untrusted titles. Only the final new unpublished asset bundle is retained alongside prior tracked builds. No commit, push, deployment or production-data modification was performed.
