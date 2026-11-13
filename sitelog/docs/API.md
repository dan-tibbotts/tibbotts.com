# Mock service boundary and future API

No REST backend runs in this mockup. The static development server deliberately returns 404 for API/auth routes. All app operations use local modules; no `workers.dev`, third-party API or email request is made.

| Local interface                               | Future responsibility                                          |
| --------------------------------------------- | -------------------------------------------------------------- |
| `mock-auth.currentUser / requireUser`         | `GET /sitelog/auth/session`, authenticated session validation  |
| `mock-auth.requestCode / verifyCode / logout` | `/sitelog/auth/request-code`, `/verify-code`, `/logout`        |
| `mock-api.accessibleJobs / authoriseJob`      | Authorised `/sitelog/api/jobs` list/details                    |
| `mock-api.saveJob`                            | Admin job create/update and assignment management              |
| `mock-api.inviteUser`                         | Office invitation endpoint plus private auth-service operation |
| `mock-api.applyOperation` (`time`)            | Time create/revise with idempotency and expected revision      |
| `mock-api.applyOperation` (`note`)            | Note create/update with idempotency                            |
| `mock-api.applyOperation` (`media`)           | Upload intent, private object upload and verified completion   |
| `store` accepted records                      | Authorised list/history/activity/report reads                  |

Example local time operation:

```json
{
  "id": "operation-uuid",
  "userId": "fictional-user-id",
  "kind": "time",
  "expectedRevision": 1,
  "state": "queued",
  "data": {
    "id": "entry-uuid",
    "jobId": "job-id",
    "workerId": "fictional-user-id",
    "date": "2026-11-13",
    "start": "07:30",
    "end": "16:00",
    "breakMinutes": 30,
    "overnight": false
  }
}
```

The future API must derive identity from the server session, validate permissions independently, return structured JSON errors and `Cache-Control: no-store`, and use HTTP 409 for revision conflicts. Local errors currently use `Error.message`; revision conflicts also use `code: "CONFLICT"`.

No MCP endpoint is implemented. No user-supplied IDs, roles, local revisions or demo session data should be trusted by future services.

## Operations Stage 1 service additions

The application remains local-only. No REST endpoints, SQL database, auth Worker or service binding were fabricated for this stage.

- `workspaceSnapshot()` returns an explicit worker projection: assigned job fields, own time/revisions/schedules/outbox/drafts and authorised job notes/media. Job commercial fields, other workers' private times/schedules, invites, audit records and code/session-issuance metadata are excluded. A small redacted persona catalogue remains deliberately available for the existing mock role switcher; it is not a production identity endpoint.
- `accessibleJobs()` also projects worker-safe fields rather than returning hidden office values.
- `saveWorkSchedule(input, { expectedRevision })` requires an active, unexpired office identity. It validates effective date, NZ timezone, working days and explicit break values, rejects duplicate worker/effective-date records and stale revisions, and saves schedule/history/audit atomically. The office UI requires a connection to change central data; cached worker schedules remain available offline.
- Time operations delegate to `timesheet-service.acceptTimeOperation`. The identity/session, assignment, worker ownership, lock/status, expected revision, all-job overlap and idempotency checks occur inside the same IndexedDB write transaction as accepted data, immutable application history, receipt, outbox completion and actor audit. The transaction itself serialises concurrent calls without depending on Web Locks.
- Revision and overlap races return recoverable `code: 'CONFLICT'`; overlaps include `conflictType: 'overlap'`. The existing sync engine retains the operation and exposes a correction flow. An overlap for a newly created entry has no accepted same-ID counterpart, so it opens “Correct actual times” rather than a misleading before/after comparison.
- Existing approved/locked records cannot be corrected by workers or unlocked through ordinary entry payloads. An office correction needs `adminCorrection: true` and a reason; the original locked state is retained and the actual editor is recorded separately from the worker.

Production must implement these same invariants in real authenticated API/database transactions, with HTTP 409, no-store responses and CSRF/private auth validation. Browser IndexedDB, mock personas and these projections do not secure an attacker-controlled browser or provide cross-device enforcement.

## A2 local commercial service

`commercial-service.mjs` provides office-only workspace reads and typed `saveContact`, `decideApproval`, `saveCatalogItem`, `saveSupplierPrice`, `saveClientRate`, and `priceSelection` commands. These are local mock service boundaries, not deployed HTTP endpoints. Every write rechecks the current session/office role in the same IndexedDB transaction as revision checks, audit and history. Central commercial edits require the local connection to be online. Workers receive no commercial tables in their workspace projection.

Explicit manual selling rate + recorded reason wins; otherwise eligible client rate then standard item rate. A supplier purchase price never becomes a selling price. Only approved active suppliers can be used for new procurement. Archive records instead of deleting history. Overlapping client periods and duplicate supplier effective dates are rejected.

## A3 local terms and quotes

`quote-service.mjs`: `saveTerms`, `saveBranding`, `saveQuote`, `moveQuote`, `reviseQuote`, `duplicateQuote`, `saveEditorDraft`, `quoteWorkspace`. Services enforce office access, expected revisions, exact recalculation and allowed transitions. Draft → Review → Issued; issued can be declined, expired (only after expiry) or cancelled with reason. Revising issued/declined/expired produces an editable draft retaining the prior issue. Accepted state is reserved for the transactional A4 command. No email, external acceptance or production API is implied.

Client export uses `quoteIssues.client` only; office snapshots include procurement/cost history but are never passed to print/CSV. Native print view supports browser Save as PDF, not server PDF generation. All exported text is escaped; spreadsheet cells are formula-safe. No XLSX library is added.

## A4 local acceptance and direct authorisation

`job-authorisation.mjs`: `acceptQuote(quoteId, {issueId, expectedRevision, reference, acceptedBy, acceptedDate, workerIds})`, and `saveAuthorisedJob`. Acceptance is office-only and online in the local simulation, verifies the current issued revision, then atomically creates its linked job once. Repeated calls for that accepted issue return the existing receipt, including stale-version retries. A different issue cannot replace acceptance. Manual acceptance date cannot exceed today or the quote expiry. A4 does not send supplier orders, inspection requests or customer messages.

Existing `mock-api.saveJob` delegates to the authorisation service. New direct jobs need explicit `chargeUpAuthorisation`; office edits preserve prior acceptance/origin and check revisions. Existing worker assignments/read access remain intact; worker DTOs omit all commercial source, authorisation and baseline information.

## A5 local planning and purchasing

`planning-service.mjs`: office-only `planningWorkspace`, `saveActivity` with expected revision, active job/authorised assignments, NZ dated endpoints, dependency cycle validation and recorded conflict/readiness overrides. Subcontractor confirmation requires a reference; rescheduling marks dependent plans for review without moving external bookings or actual timesheets.

`purchasing-service.mjs`: `addRequirement`, `prepareOrder`, `orderDecision`, `recordReceipt`, `cancelRequirement`. Preparing reserves a same-job requirement group against duplicate orders; only approved suppliers are eligible, and changing a quoted supplier needs a reason. Current supplier costs use explicit UOM conversions; free-text/manual costs need a reason. Orders progress prepared → manually_issued → confirmed → partially_received/received. Manual issue/confirmation record an external action arranged by the office; they send nothing. Native print view can be saved as PDF for manual issue. Cancellation retains receipt history.

Receipt requests use a stable UUID and normalised content fingerprint. Exact retries replay; changed payloads with the same key reject. Quantities are accumulated exactly. Partial receipts stay partial; deliberate over-delivery needs a reason. Actual receipt costs are explicitly NZD excl GST and append immutable events. Worker responses expose only allowed activity/delivery summaries for assigned jobs; office records, costs, overrides and supplier contacts are absent.

## A6 local inspections, decisions and documents

`project-record-service.mjs` provides office plan/booking, immutable outcome, idempotent follow-up and decision-revision commands. Booking is a manual internal record; no authority is contacted. Inspection pass/failure stays distinct from appointment completion. Outcome and decision attachments capture exact document version IDs; a later upload does not rewrite the referenced version. Planning outside known job windows requires a recorded override.

`document-service.mjs` validates 1–15 files (25 MB each, 100 MB per batch), matching permitted MIME/extensions and basic signatures, checks active office identity again inside the write, and atomically adds immutable file/version objects. Validation is not malware scanning or full PDF/Office structure verification; downloads are attachments, never trusted HTML. New version upload checks expected revision. Worker downloads recheck assigned-job access, active explicit sharing and current-version eligibility; superseded versions remain office-only. Revoking sharing denies future downloads but cannot recall bytes already downloaded. Object keys refer to private local IndexedDB blobs, not an R2 deployment. Real authenticated short-lived download URLs remain part of future backend integration.

Office document CSV index uses formula-safe cells and links back to the authenticated SiteLog UI; no public object URLs are exported. Job covers use accepted photo thumbnails with a safe illustration fallback. Office cover selection and repeat-photo references remain scoped to the same authorised job, and capture retains the existing media outbox/upload policy.

## A7 local variations and job costing

`variation-service.mjs`: draft/change detail pricing, record submission, explicit recorded approval/rejection/withdrawal/revision. Submission copies a frozen snapshot. Approval records person/date/reference, generates planned materials and inspections once, and keeps the original accepted quote unchanged. Credits change the financial budget but do not silently cancel prior procurement. Supporting files snapshot exact document version IDs; decisions, inspections and documents can link variations on the same job. These are project change records, not statutory notices or verified external signatures.

`costing-service.mjs`: office-only workspace/summary, effective job labour-cost bases and manually sourced subcontractor commitments/completions. Dates cannot overlap for active labour rates. Changes require expected revisions and reasons. Job reports separate original/approved/pending/revised budgets; sum only current accepted times; price labour per integer-minute entry against explicit dated job rates; count received material events as actual, and outstanding balances of manually issued/confirmed/part-received orders as commitment. Prepared/cancelled outstanding orders are excluded. Completed subcontractor amounts move into actuals once. Missing rates/estimates/unpriced bookings remain explicit unknowns, with no inferred pay or worker rankings. All displayed cost amounts are NZD excluding GST.

Commercial document categories (quotes, purchase orders, variations, contract) remain office-only on upload, metadata change, worker projection and download, even if an older record contains a worker visibility flag. Other document sharing still requires explicit office classification and authorised job access.

## A8 local backup/recovery boundary

`backup-service.mjs` exposes office-only `createBackup`, `inspectBackup`, `rehearseRestore`, `importMissingRecords`. One consistent read transaction captures records and blob references; asynchronous encoding/checksums occur after it. Archives include all synthetic workspace records/private bytes but exclude sessions/one-time login metadata. SHA-256 checks validate archive/file integrity, not authenticity. Only known tables/IDs/formats/schemas are accepted, with a 256 MB local archive limit.

Rehearsal restores to a newly generated disposable database, reads back records and hashes, then removes only that temporary database. Missing-ID import uses one transaction, never overwrites existing keys, counts/skips differing existing records, and aborts on source/version uniqueness conflicts. The current identity/session is retained. This is a local recovery tool, not a production database restore API. Update preparation awaits in-progress backup work and refuses reload while its review form is open.
