# Local data model

The IndexedDB database is `sitelog-mockup-v1`, current schema version 8. The earlier stage sections below describe additive history. Every object store uses `id` as its key.

| Store        | Purpose                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta`       | Seed version, selected job per user, demo session, per-device upload/network settings, time defaults, demo codes and applied-operation markers |
| `users`      | Fictional active identities, display name, email and role                                                                                      |
| `jobs`       | Name, readable location, optional coordinates, radius, instructions, estimated minutes, stage/status and assigned worker IDs                   |
| `timesheets` | Accepted office-copy entries, work date, timezone, UTC start/end, break/worked integer minutes and current revision                            |
| `revisions`  | Application-append-only before/after snapshots, editor, sequence, reason and receipt timestamp                                                 |
| `notes`      | Accepted office-copy site notes                                                                                                                |
| `media`      | Accepted media metadata: type, sizes, dimensions/duration when readable, checksum, import/modification/receipt times                           |
| `operations` | UUID operation, user, entity snapshot, expected revision, queue state, attempt count, retry time and error                                     |
| `blobs`      | Actual media and thumbnail blobs, linked by media UUID and creating user                                                                       |
| `drafts`     | User-scoped unfinished form values with autosave timestamp                                                                                     |
| `invites`    | Local invitation records and inviter; no outbound delivery                                                                                     |

User-created entity and operation IDs are UUIDs. Seed IDs are readable fixture identifiers. Production must validate UUIDs, use separate auth/business stores, normalise assignments into their own table and index job/date and worker/date lookups.

Business dates use Pacific/Auckland. Timezone resolution rejects nonexistent/ambiguous local DST times rather than choosing silently. Overnight work is explicit, limited to 24 elapsed hours. Overlap checks span dates and jobs for the same worker.

Original image capture time is not inferred from filesystem metadata. `fileModifiedAt` and `importedAt` have distinct meanings. Photos are processed, so their checksum describes the saved compressed bytes, not the original source. Local “receivedAt” values are a device-clock simulation, not trusted server time.

There is no Company/Tenant table. There is no production migration or production dataset.

## Operations Stage 1 — schema version 2

The database name above is preserved; `src/migrations.mjs` upgrades its **schema version to 2**. See `MIGRATIONS.md` for backfill, backup, verification and rollback limitations.

| Added store         | Purpose                                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workSchedules`     | Worker ID, effective-from business date, NZ timezone, weekday start/end/break/overnight values, expected revision and editor. Legacy personal preferences are separate review-only records with no inferred effective date/days. |
| `scheduleRevisions` | Immutable application snapshots of each central schedule change, prior/after values, editor and timestamp.                                                                                                                       |
| `auditEvents`       | Time/schedule command actor, worker/record IDs, revision and timestamp. No movement/location logs.                                                                                                                               |

Time revisions now also record whether a locked-record correction was explicitly administrative. Time operations can carry `adminCorrection` and `conflictType`. Existing rows are not rewritten on upgrade; new/changed timed entries are recomputed from actual endpoints. The working date and timezone stay distinct from UTC receipt/edit timestamps.

Known hours-only values are displayed without assigning invented start/end times. New accepted timed corrections retain the previous hours-only snapshot in history. No acceptance details, real business hours, prices or coordinates are invented.

## A2 additive schema 3

Retains `sitelog-mockup-v1`, every previous record, queue entry, draft and blob. Adds typed stores `contacts`, `catalogItems`, `supplierPrices`, `clientRates`, `commercialRevisions`, plus item/supplier, client/item and history indexes. Multi-role contacts share one identity; approval transitions record actor, reason and UTC time. Changes preserve before/after revisions. Existing records are not backfilled with invented commercial values.

Quantities and unit rates are canonical decimal strings, at most six fractional places; arithmetic uses BigInt, with half-up rounding at line-cent boundaries, then GST on the summed cents. Totals are safe integer NZD cents. Binary floating-point monetary input is rejected. Purchase UOM differing from the selling UOM requires an explicit positive conversion. Margin is (sell − buy) / sell, and is undefined at zero sell. Missing prices remain unpriced.

## A3 additive schema 4

Adds `termsTemplates`, `quotes`, `quoteIssues`, `quoteDrafts`. Templates and quote edits append commercial before/after revisions. Issue records contain a frozen office snapshot plus a separate explicit client projection. Editing an issued quote requires an authorised revision and reason; earlier issued documents remain unchanged. Quote quantities, sell/cost snapshots and GST basis points are stored with the quote, not looked up during export. Terms are independent ordered copies. Company branding is a single `meta.companyProfile`, not a multi-tenant abstraction. Editor drafts are local and office/user-scoped; offline drafts do not imply central acceptance. Safe PWA update preparation awaits pending quote draft writes.

## A4 additive schema 5

Adds `materialRequirements`, `jobInspections`, `jobAuthorisations`. Jobs have a unique optional source-quote index; requirement/inspection source keys are also unique. Quote acceptance records current issued revision, authorising person, business date, reference, recorder and UTC timestamp. Creation of job, authorisation, planned requirements/inspections and accepted quote is one transaction. A replay returns its original job. Accepted job origin retains office and client issue snapshots; worker job projections exclude them. Labour estimates use quoted `hour` labour lines, converted to integer minutes; missing labour estimates are not invented from other UOMs.

Legacy jobs are not rewritten or re-created. Office UI derives “Acceptance details need review” when authorisation is absent. New direct work requires customer, agreed scope, charging basis, terms reference, authorising person/date and supporting reference. This gate applies prospectively. Association of an accepted quote with an existing job remains an optional separately approved workflow; the normal acceptance path always makes one new job for a standalone quote.

## A5 additive schema 6

Adds `activities`, `purchaseOrders`, `materialReceipts` and job/date/request indexes. Activities retain NZ local dated endpoints plus UTC instants, worker/subcontractor allocations, dependencies, selected required materials, approval/conflict/readiness warnings and override reasons. Schedule and purchasing edits append commercial revisions/audit records.

Purchase order lines preserve selected supplier cost/conversion or a reasoned manual rate separately from the original quoted material baseline. Active orders reserve requirements. Receipt events are immutable and contain quantity, actual unit cost/cents, source line, manual reference/date, recorder, UTC time and idempotency fingerprint. Previously recorded receipts remain after cancellation. Requirement status derives from exact received quantity and order state, with no inventory or accounting ledger.

Worker DTOs add `upcomingActivities` and `deliveries` as explicit safe projections, not complete planning/purchase records. Assigned job and shared-plan checks apply before projection. Local authorised summaries reopen offline; no current job is silently selected from the schedule.

## A6 additive schema 7

Adds `inspectionEvents`, `decisions`, `documents`, `documentVersions`, plus inspection/document indexes and unique `(documentId, version)` constraints. Each version gets a new private local blob UUID key and SHA-256 checksum. Logical-document title/category/sharing/archive changes preserve revision history; file bytes are never overwritten. Multi-file validation precedes one atomic metadata/blob transaction. Supported attachments are PDF, UTF-8 plain text, PNG/JPEG/WebP and download-only DOCX/XLSX; HTML/SVG/executable types are rejected. No antivirus or full Office/PDF parser is claimed.

Inspection events retain plans, outcomes and linked follow-up/corrective actions. A failed inspection remains failed after a new reinspection passes. Quote inspection origin also preserves required phase, consent reference, lead-time text and responsible person without inferring dates. Decisions store ordered revisions, date/recorder/responsibility/actions and exact supporting document-version references. Worker DTOs add only explicitly shared job document metadata, inspection site instructions and shared decisions; internal notes, version history and private storage keys remain excluded.

Job `coverMediaId` selects an accepted photo on that job. Worker media DTOs carry optional same-job `repeatFromMediaId`. Both are additive metadata, not new media queues; old media bytes and preferences remain unchanged.

## A7 additive schema 8

Adds `variations`, `variationSnapshots`, `jobCostRates`, `costCommitments`. A variation's detailed sell/cost/quantity/tax values are exact; additions/credits are explicit. Submission is immutable, approval/rejection is a recorded event and approved records cannot be edited in place. Approved additions generate material/inspection source keys once under the same transaction. Original job quote snapshots are untouched.

Labour-cost rates are explicit job-level NZD/hour bases with non-overlapping effective business dates, not employee payroll. Subcontractor costs distinguish planned, committed, completed and cancelled, with manually recorded references and reasoned revisions. Material actuals derive from immutable receipt events; outstanding commitments use ordered quantity minus received quantity at the saved order cost. Current accepted timesheet IDs are counted once; revision history and pending local entries are excluded. Line totals, GST and aggregate cents use exact arithmetic, including labour minutes/60 without intermediate decimal-hour rounding. Unpriced cost bases and partial estimates remain visible.
