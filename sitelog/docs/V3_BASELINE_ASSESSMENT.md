# v2 + v3 assessment — addendum phase A0

13 November 2026. **Assessment and planning only; A1 is not implemented.**

## Authority and inspected baseline

Read the supplied `SiteLog_Copilot_Implementation_Instructions_v2.md` (312 lines) and `SiteLog_Copilot_Expansion_Instructions_v3.md` (602 lines) in full. The archived `SPECIFICATION.md` is byte-for-byte identical to the supplied v2 file, whose internal heading says version 1.0. The supplied v3 addendum is archived under its original filename. v3 extends the baseline; it does not replace security, privacy, offline, licence or hosting requirements.

The user's current instruction limits this turn to A0. Embedded coding prompts in the documents are requirements/context, not permission to implement A1 or the other modules now. Applicable repository rules are `sitelog/AGENTS.md`; no ancestor or additional nested AGENTS files were found. The working tree was clean at inspection. Inspected revision: `a011ad6d66d607b2fffeadf649ff064c530f291c` (`feat: implement work schedules and time suggestions functionality`).

Current architecture is a dependency-free, browser-local mockup. UI and focused forms call separate mock identity/business service modules, backed by IndexedDB and one persistent sync engine. There are **no independently deployed frontend/API/auth Workers, real REST backend, D1/R2 resources or CI/deployment workflows**. Existing local features must not be called completed production v2 stages.

## v2 baseline requirements and stages

| v2 area/stage | Implemented in the current local app | Missing for the specified production baseline |
| --- | --- | --- |
| 0 — Discovery | Existing architecture, API/data-model, licence, migration and deployment docs; earlier operations gap analysis | Approved live infrastructure/access configuration remains external setup |
| 1 — Foundation/preview | Native static PWA; `/sitelog/` manifest/SW; loopback server; Node/Chrome tests | Separate deployable packages/configs, cloud preview, CI and dynamic business `/api/about` |
| 2 — Authentication | Mock invites, email-code flow, expiry, persona switching and safe local-work retention in `src/mock-auth.mjs` | Independent auth Worker/store; real email sender; secure bootstrap; keyed OTP digests/IP abuse controls; secure cookies, CSRF/origin protection and private RPC. Mock code is explicitly not production authentication |
| 3 — Jobs/admin | Job list/editor, readable addresses, optional coordinates/radius, assignments, manual search and one-shot nearby choice in `src/app.mjs`/`nearby-jobs.mjs` | D1 schema, real API/session authorisation, authenticated cross-device reads and staged deployment |
| 4 — Daily records | Time/note forms, transactional autosave/outbox, NZ dates/DST/overnight and breaks, own-entry/lock checks, revisions, actual-vs-estimated labour hours and CSV | Server-enforced validation/history, SQL constraints/transactions, trusted server receipt time and live API contracts |
| 5 — Media | Multi-select/camera inputs; actual photo resize/WebP/JPEG, thumbnails/checksums, bounded videos, local playback/download | Private R2; authenticated upload intents/finalisation/downloads; real transfer/progress/resumability; original-quality policy; actual-device codec/orientation verification |
| 6 — Offline/sync | IndexedDB v2, user-scoped draft/outbox projections, retries/idempotency/conflicts, reload recovery, network policies/manual override and storage warnings | Real remote sync, server permission refresh and HTTP conflicts; actual iOS/Android install/termination/quota checks; safe release-to-release update protocol |
| 7 — Hardening/release | Synthetic tests; local upgrade preservation; licence/backup/release documentation; unrelated-route regressions | Real service security/abuse tests, privacy/retention review, verified restore, isolated dev/stage/prod deployments, staging acceptance and manual production release |
| 8 — Future MCP | Reserved and not implemented | Remains future; do not add MCP, payroll or accounting integrations as part of this assessment |

The earlier **operations Stage 1** is implemented locally: effective weekly usual hours and revisions, gap suggestions across jobs, once-per-day unpaid-break suggestions, readable hours-only legacy entries, atomic IndexedDB time acceptance, context-safe/offline corrections and credible/manual nearby selection. See `work-schedules.mjs`, `schedule-service.mjs`, `time-suggestions.mjs`, `time-form.mjs`, `timesheet-service.mjs`, `permissions.mjs`, and `migrations.mjs`. **Usual hours are not a job/crew scheduling calendar.**

Supporting invariants are present: single company; worker-safe DTOs; neutral copy; no continuous GPS/telemetry/rankings; actual integer worked minutes; public-shell-only CacheStorage; separate mock auth/business modules; all three per-device media policies with unknown-network hold and manual override; zero npm dependencies. Real server enforcement and private media access remain missing.

## P0 finding: visible version and safe updates

| v3 requirement | Evidence | Assessment |
| --- | --- | --- |
| SemVer source | `package.json` and lockfile contain `0.1.0` | Suitable source to designate; runtime does not consume it |
| Header version on every page | `src/app.mjs` topbar/desktop brand/mobile brand have no version | Missing |
| Login/offline/error identity | Login and boot/error render paths have no version; offline reuses shell | Missing |
| Current visible label | Footer hardcodes `Local mockup · v0.1` in `src/app.mjs` | Not a canonical SemVer/build identity; fails header requirement |
| Immutable Git SHA/UTC time/environment | No build script/module or CI injection exists | Missing; repository HEAD is not evidence of the artifact installed on a phone |
| Backend identity | `scripts/serve.mjs` serves static files; `/sitelog/api/about` deliberately returns 404 and a regression test asserts it | Missing; frontend version must not be passed off as an API version |
| Fingerprinted assets/build caches | `index.html` imports `./src/app.mjs` and `./styles.css`; SW uses fixed `sitelog-shell-v2` | Missing. DB schema version 2, SW cache suffix v2, package 0.1.0 and document v3 are separate concepts |
| Consistent installed shell | SW fetches allowlisted unversioned files network-first and overwrites their cache entries independently | Inferred mixed-build risk: an old open shell could load files from a new release. No upgrade failure is claimed to have been observed |
| User-controlled update | SW registration exists, but no waiting-worker prompt, manual update check, build handshake or draft-aware reload flow | Missing |
| Cache privacy | Explicit public allowlist; API/auth/MCP and unrelated paths excluded; prior static SiteLog caches cleaned on activation | Implemented foundation; cleanup must become safe for old clients with build-specific caches |
| Data-safe upgrade | v1→v2 migration and offline recovery tested | Useful foundation, but not a test of frontend build A→B updates |

**Recommended next milestone: A1, visible installed version + immutable build identity + safe two-build update, with no commercial module or IndexedDB schema migration.** Detailed plan and acceptance gates are in `VERSIONING_AND_RELEASES.md`.

## v3 module coverage and staged plan

All routes below are **proposed**, not existing endpoints. They sit under `/sitelog/api`; identity stays under `/sitelog/auth`. Adapt existing modules, add narrow services/forms, and extract UI groups incrementally instead of relocating/rebuilding the application to match an illustrative file tree.

| Phase | Existing reuse / missing functionality | Proposed data/API/UI slice | Completion evidence |
| --- | --- | --- | --- |
| **A0 — This assessment** | Existing docs and operations Stage 0/1 retained | This assessment, decisions, A1 release design and staged checklist only | Current code inspected; baseline tests reported; runtime unchanged |
| **A1 — Version/update P0** | Existing topbar, login/boot paths, SW, package, Node server/test harness | One SemVer source, generated immutable artifact metadata, compact version/details, fingerprinted assets, staged update handshake, safe `/about` metadata | Build A→B tests; every screen/offline reports its own artifact; queued notes/time/photo/video/drafts survive |
| **Baseline integration gate** | Existing mock auth/API boundaries, domain services, local tests | Separately approved local/cloud service implementation: auth Worker/store, business Worker, D1/R2 bindings, CSRF/permissions, migrations, private media and isolated preview | Needed before real commercial/employee data or claims of production API security; does not block local A1 |
| **A2 — Contacts/suppliers/subcontractors/price book** | Only demo staff and job assignments exist | Contact roles with stable IDs, supplier approval/history, subcontractor trade/status, items/UOM, effective supplier purchase prices and client sell overrides. Office contacts/price-book screens. `/customers`, `/suppliers`, `/subcontractors`, `/catalog/items`, supplier-prices and client rates | Approved-supplier checks; correct comparable UOM/costs; exact NZD/quantity rules; rate precedence/ambiguity reviewed; worker DTOs exclude commercial data |
| **A3 — Terms + quotes** | No terms/quotes/pricing/export modules; reuse form/CSV safeguards | Standard and other reviewed template revisions/ordered lines; independent quote-specific terms; standalone quotes/lines/inspection plans; immutable issued documents. `/terms/templates`, `/quotes`, issue/revise/decline/exports. Items → Terms → Review with persistent totals | Decimal qty, NZD/GST snapshots, clause X/confirm/reload/edit behaviours, no template cross-mutation, no supplier-cost leaks, print/PDF and CSV; verified branded XLSX implementation or explicit staged follow-up |
| **A4 — Acceptance → job** | Existing jobs must keep IDs/access; direct job creation currently has no commercial gate | Acceptance/charge-up record, quote/job source links, snapshots, material requirements and inspection origins. `/quotes/{id}/accept` and explicit non-quoted authorisation command | One job and requirement set under concurrent retries, including new idempotency keys; legacy acceptance marked needs review; additional-work acceptance never accidentally duplicates a job |
| **A5 — Work planning + purchasing** | Reuse usual-hours patterns and job assignments; no calendar, bookings or PO/receipts exist | Activities/dependencies/worker-subcontractor allocations; material requirements/orders/lines/receipts. `/schedule`, job materials, purchase-orders and receipts. Office day/week/agenda and readiness; worker-safe upcoming summaries | Planned vs actual kept separate; overlap/readiness overrides audited; unapproved supplier blocked; partial quantities remain outstanding; no automatic external order/booking; authorised schedule summaries reopen offline |
| **A6 — Inspections/documents/decisions** | Existing media is not general document versioning; no inspection/decision entities | Inspection booking/outcome history, decisions, category/visibility rules, logical documents and immutable versions/private object keys. Job inspection/decision/document routes and version downloads | Prior bytes/version references retained; failed/follow-up outcomes not erased; authorisation on reads/downloads; worker only gets explicitly shared site summaries/files |
| **A7 — Variations + costing** | Actual-vs-estimated labour **hours only**; no rates/cost totals/variations | Variation/revision/approval, original/approved/pending budget components, source-aware cost summaries, actual/committed/received material and subcontractor cost basis. Job variations, cost-summary and reports routes | Approved vs pending separated; generation idempotent; current accepted times counted once; missing costs shown unknown; totals reconcile; no worker financial data or rankings |
| **A8 — Hardening/staged release** | Reuse existing regression, migration and licence checks | Full real-service E2E, two-build/multi-tab recovery, backups/restore, devices, commercial export security, privacy/retention and deployment/rollback runbooks | v3 scenarios A–F demonstrable on synthetic staging; homepage/family unchanged; manual production approval remains separate |

Smaller sub-slices within a phase are acceptable, each with review. Do not implement multiple commercial phases in one pass. Do not present an approval, PO send, council booking or API validation as real while using local simulation.

## Data, migration and service contracts to retain

- Keep `sitelog-mockup-v1` schema v2 and existing IDs, indexes, records, media bytes and outbox. A1 changes static artifacts, not user data. A2+ changes require additive migrations and tested backfills/restore plans; no destructive reseed or generic JSON bucket.
- Add explicit relationships/unique constraints when the SQL backend exists: supplier-price effective versions; quote/revision lines and terms; unique source quote for new-job acceptance; requirement/receipt origin and idempotency receipts; document/version immutable keys. Test D1 transaction semantics before claiming cross-record atomicity.
- Money must use integer cents/exact fixed-decimal and scaled decimal quantities, with a single documented rounding/tax policy and bounded inputs. Optional finer unit-rate precision must be separate from displayed cents. Never derive sell price from purchase cost. UOM conversions must be explicit. These primitives are **missing**, not covered by the current time arithmetic.
- Snapshot issued quote contact, sell/buy estimates, terms and tax configuration; edits to catalogues/templates never recalculate historical documents. Worker and client projections must explicitly omit internal costs/margins/planning. Protect reads, joins, exports and object downloads, not just buttons.
- Keep one worker outbox. Office issue/accept/order/approval commands can require online validation. Cache only authorised worker summaries/drafts/media; never prefetch office financial tables to worker devices. The current shared-browser demo is not a secure isolation boundary for real data.
- Costing must name the basis: ordered/committed, received, recorded/invoiced, or unknown. Do not treat quote sell totals as purchase cost, sum superseded time revisions, count pending variations as agreed, or infer missing labour/subcontractor rates.
- Terms and commercial/legal templates need reviewed business content. Do not invent approved Standard clauses or statutory notices. Keep the earlier operations contract/payment controls on their documented future checklist; v3 does not implement or validate them.

## Constraints, packages and risks

- Current host: macOS **11.7.11**, Node **22.20.0**, npm **10.9.3**; Wrangler absent. Node/browser checks run here. Current Wrangler requires macOS 13.5+, so future Workers integration needs a supported cloud/Linux environment; do not downgrade tooling just to claim local support. [Cloudflare requirements](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- **Proposed approved runtime/development dependency additions: none for A1.** Use platform/Node APIs, existing local SVG assets and the lockfile. Existing optional Prettier 3.6.2 is documented as MIT development tooling. A2+ PDF/XLSX/map libraries must have exact-version/direct/transitive licence review before adoption; no package has been selected or approved by this assessment.
- Initially use native HTML print for user-generated PDF and correctly named CSV. v3 includes branded XLSX: keep a concrete reviewed follow-up/test gate; never rename CSV to `.xlsx` or silently mark XLSX complete.
- Existing GitHub Pages files, `/family/`, DNS/email/routing and production settings stay untouched. No live Cloudflare/account inspection or DNS mutation is needed for this local A0. Historical DNS observations in older docs are not a fresh hosting verification.
- Actual iPhone/Android install, camera/codecs/orientation, browser eviction/quota, app termination, keyboard and two-version updates remain manual. CacheStorage and IndexedDB are different; static-cache cleanup must never delete records. Same-origin cookie paths/SW scope do not isolate against malicious scripts elsewhere on the origin.
- Decisions needing resolution before their dependent phase: manual sell override precedence, direct-charge authorisation semantics, XLSX library/licence and approved terms/retention/real schedules. None blocks assessment or local A1. See `DECISIONS.md`.

## Checks rerun for this A0

`npm --prefix sitelog test`: **31/31 passed**. `npm --prefix sitelog run check`: **28 JavaScript files**, syntax/manifest/icons/zero-dependency policy passed. `npm --prefix sitelog run test:browser`: **45 existing + 33 operations Stage 1 checks passed**, no uncaught browser exceptions, disposable Chrome profile. Covers current mockup, migration, local concurrency, media policy, offline reopen and 320 px form behaviour. **No build-A→build-B/version-label tests exist or ran.** No real device, remote auth, cloud deployment, production version or legal-compliance verification was performed.

Only assessment documents and the v3 archive are changed by A0; no runtime, package version, schema, service worker, application data or production configuration is changed.
