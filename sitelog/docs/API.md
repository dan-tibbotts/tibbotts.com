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
