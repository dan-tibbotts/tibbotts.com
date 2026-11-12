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
