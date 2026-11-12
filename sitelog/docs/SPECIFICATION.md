# SiteLog — Copilot Implementation Instructions

**Version:** 1.0  
**Date:** 13 November 2026  
**Purpose:** Deliver a small, secure, offline-first Progressive Web App for recording site progress, time and media with a separate frontend, REST backend, and project-specific authentication service.

> **Instructions to Copilot:** Treat this document as the authoritative functional and technical brief. Work incrementally. Start by inspecting the repository, producing a concrete stage plan and identifying deployment prerequisites. **Do not attempt to build the entire application in one response or deploy to production without explicit approval.** Ask only when a genuinely blocking external choice or credential is required. Do not weaken security or drop offline requirements to make a demo work.

## A. Confirmed decisions (do not reconsider without instruction)

1. Product name **SiteLog**; public URL prefix **`https://tibbotts.com/sitelog/`**.
2. **Single company** for the initial version. **Do not build multi-tenancy** or company-switching functionality. Keep identifiers and permissions suitable for future evolution without speculative abstractions.
3. **Invite-only, one-time email code** sign-in (no passwords). Authentication is a **separate SiteLog-specific responsibility/service**; it is **not shared with unrelated tibbotts.com applications**.
4. Build both a **worker-facing PWA** and a minimal **office administration interface**.
5. Support **photos and videos**, client-side media optimisation, local queuing and user-controlled uploading.
6. Allow timesheet corrections with **immutable edit history**.
7. **Preserve the existing GitHub Pages site** for all routes outside `/sitelog/`. Do not move or overwrite the main site. Cloudflare handles only the path-specific SiteLog routes.
8. Code dependencies/assets must be **free to use commercially and properly licensed**; prefer browser/platform APIs and permissive open-source packages.
9. Keep **frontend, business REST API and authentication separated by deployable boundaries**; plan a separate MCP adapter for later, but do not build the MCP server in the first release.
10. Keep **development, staging and production** data, secrets and deployments isolated. Production deployment must be an explicit, manual approval/action.

## B. Product intent and language

**SiteLog — Simple site records, less paperwork.**

A field worker should be able to select a job, record time, add a short note and capture site photos/videos in as few actions as possible, including without internet connectivity. The office uses these job records to understand site progress, compare estimated versus actual labour hours, improve future quoting and resolve questions about completed work.

**This is not an employee-surveillance product.** Avoid UI labels such as “evidence”, “prove work”, “employee activity”, “track worker”, “monitor productivity”, “verify performance” or “interrogate”. Prefer:

- “Current job”, “Find my job”, “Record Time”, “Add Photos”, “Add Video”, “Add Note”, “Daily Record”, “Site Progress”, “Photos & Videos”, “Saved on Device”, “Waiting for Wi-Fi”, “Synced”.
- Office-facing: “Job Overview”, “Actual vs Estimated Hours”, “Daily Records”, “Photos & Videos”, “Timesheet Review”.
- Never use tracking-style copy for location; explain that location is requested to **suggest nearby jobs**, and can be declined.

Avoid unnecessary alerts, forced narratives for every photo, intrusive dashboards and extra required form fields. Workers should be able to correct records without being shamed by the interface. Internal audit records exist for reliable recordkeeping, not employee rankings.

## C. Architecture and hosting

### Logical components

- **PWA frontend:** static HTML/CSS/modern JavaScript, service worker, web app manifest, IndexedDB, responsive worker screens and office screens. Prefer native APIs. Avoid a frontend framework unless there is a documented need.
- **Business API Worker:** request validation, application permissions, business rules, D1 queries, R2 access, idempotent sync. **Never** store passwords or independently authenticate email codes.
- **Authentication Worker:** one-time-code issuance/verification, invite-only users, sessions, logout and session validation. Own its own D1 database or isolated auth schema. Communicate with the business API using a **Cloudflare Worker Service Binding / private RPC entrypoint**, not a publicly trusted `x-user-id` header.
- **D1:** structured business records plus an independently bound authentication data store; separate dev/stage/prod instances.
- **R2:** private media files. The API checks job access before authorising upload or download. No publicly browsable bucket.
- **Later MCP adapter:** independent adapter to authorised REST/application operations. Do not expose user browser session cookies as MCP credentials; design OAuth/agent scopes separately later.

### URL contract

| Path | Owner |
|---|---|
| `https://tibbotts.com/` | Existing GitHub Pages site |
| `https://tibbotts.com/sitelog/` | SiteLog PWA |
| `https://tibbotts.com/sitelog/api/*` | SiteLog business API Worker |
| `https://tibbotts.com/sitelog/auth/*` | SiteLog authentication Worker |
| `https://tibbotts.com/sitelog/mcp` | Reserved for a **future** MCP service; do not expose yet |

Use relative API URLs such as `/sitelog/api/jobs`. Do not hardcode `workers.dev` in production client code. Keep all three interfaces on the same public origin where possible. The frontend, API and auth remain distinct deployments despite sharing a public hostname.

### Cloudflare routing constraints

1. To route a path on `tibbotts.com`, the domain must be in a Cloudflare zone and the DNS record **proxied through Cloudflare**; retain the existing GitHub Pages origin for other routes.
2. Configure specific paths for `/sitelog/api/*`, `/sitelog/auth/*` and `/sitelog/*`. Most-specific routing wins; document and test this ordering. Arrange a canonical redirect for `/sitelog` to `/sitelog/` without affecting the rest of the site.
3. For the frontend Worker, use **Workers Static Assets** with the `/sitelog` asset base path (verify support in the pinned Wrangler version). Ensure script, CSS, manifest, icons and service worker URLs are rooted correctly under `/sitelog/`.
4. Configure service-worker scope **`/sitelog/` only**. Never cache login/auth endpoints or authenticated REST responses in the public Cache API. Never intercept or serve another project’s routes.
5. **Do not alter nameservers, DNS records, email MX/SPF/DKIM, GitHub Pages settings or production routes automatically.** Provide a safe, reviewed change plan and rollback first. Validate current DNS/HTTPS and ensure the existing homepage and `/family/` keep working.
6. Use isolated preview/staging URLs and Cloudflare Git integration for builds. **The user's Mac runs macOS Big Sur**, which is not supported by recent Wrangler versions (macOS 13.5+); do not assume the latest Wrangler will run locally. Pin versions, check Node requirements and provide cloud-build alternatives.
7. Do not expose internal auth RPC endpoints publicly. Protect any staging environment containing real data; use synthetic data by default.

### Source repository structure (recommended independent project repo)

```text
sitelog/
├── README.md
├── AGENTS.md                     # concise project rules for AI coding agents
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATA_MODEL.md
│   ├── DEPLOYMENT.md
│   ├── PRIVACY_AND_RETENTION.md
│   ├── THIRD_PARTY_LICENSES.md
│   └── IMPLEMENTATION_STATUS.md
├── frontend/
│   ├── public/                   # manifest, icons, service-worker
│   ├── src/                      # UI, API client, sync engine, media processing
│   └── package.json              # only if justified
├── backend/
│   ├── src/                      # API routing, services, permissions, storage
│   ├── migrations/               # D1 business schema
│   └── wrangler.jsonc
├── auth/
│   ├── src/                      # OTP, sessions, invite service, internal RPC
│   ├── migrations/               # D1 identity schema
│   └── wrangler.jsonc
├── tests/
│   ├── unit/
│   └── integration/
└── .github/workflows/            # build/test/preview; manual production release
```

Keep the existing GitHub Pages repository untouched, apart from an optional link to SiteLog once live. If the user expressly prefers a monorepo later, put the same SiteLog structure under `projects/sitelog/` without changing URL contracts or deployment boundaries.

## D. Workers' mobile experience and layout

- Design **mobile first**, with large touch targets and accessible contrast. Responsive office desktop layout can reuse components without inheriting worker-specific complexity.
- **Compact persistent header**: small SiteLog logo/name; always-visible media upload icon with queued count and current policy; settings/account access. **No large “My Day” hero.**
- **Compact current-job selector directly below header**: job name, concise location, dropdown/change action. Use current or last selected job as a default only when sensible, with an easy correction path.
- Main view: prominent **Record Time**, **Add Photos**, **Add Note**, **Add Video** actions; underneath, concise “Today's Records” list and sync state. Avoid large cards that waste vertical space.
- Worker can view past days and previously cached jobs, edit eligible hours and delete local drafts before sync, subject to audit/retention rules.
- **Office Admin** views: jobs, job creation/editing, geographic site coordinates, worker invitations/assignments, timesheet review and corrections, job photo/video gallery, job progress timeline, estimated vs actual labour hours, simple CSV export.
- UI uses neutral, legible language. Use “Saved on Device”, “Waiting for Wi-Fi”, “Uploading”, “Synced”, “Needs attention”; never show an unconfirmed upload as “saved to office”.
- PWA must be installable on iOS and Android where supported; it must also work in a regular mobile browser. Use correct manifest `scope` and `start_url` under `/sitelog/`. HTTPS required.

## E. Single-company data model and permissions

Do **not** build a Tenant or Company table merely for hypothetical future customers. Minimum logical entities (choose clear, consistent naming):

- `User`: ID, normalised email, display name, role (`worker` or `office_admin`), active state and timestamps; auth service owns identity. No public registration.
- `Invite`: invited email/role, inviter, state, expiry, timestamps (auth service).
- `OneTimeCode`: email/identity, keyed hash of code, expiry, attempt count, issue metadata and consumed state (auth service).
- `Session`: opaque hashed session token identifier, user ID, expiry, revoke timestamp and metadata (auth service).
- `Job`: ID, human name, display address, optional WGS84 latitude/longitude, suggested radius in metres, work/site instructions, status, estimated labour hours, timestamps.
- `JobAssignment`: job ID, worker ID, status, assignment dates.
- `WorkNote`: ID, job ID, author ID, date, text, created/updated timestamps, sync/idempotency ID.
- `TimesheetEntry`: ID, job ID, worker ID, **work date and time zone**, start/end, unpaid break minutes, total worked minutes, notes optional, created/updated timestamps, revision number and status.
- `TimesheetRevision`: immutable before/after snapshot or field changes, editor ID, timestamp, reason optional and revision sequence.
- `MediaAttachment`: ID, job ID, uploader ID, optional note ID, `photo`/`video`, R2 object key, MIME type, actual byte size, original byte size if known, capture/import timestamp if available, server receipt time, dimensions/duration if available, checksum, upload and visibility status.
- `UploadRequest` / server idempotency record: upload/session ID, allowed job/user, expected media metadata, expiry/state; prevents unauthorised references and duplicate records.

Use UUID identifiers generated client-side for offline record idempotency; validate them on the server. Use parameterised SQL and explicit indexes on `(job_id, date)`, `(worker_id, date)` and assignment lookups. Document a migration and seed-data strategy using **fictional** jobs and workers.

### Access rules

- Only invited, active users may log in.
- Workers see only **assigned** jobs (and their own timesheets), can add job notes/media, and correct their own eligible entries. Do not expose other workers' private records unless there is an explicit job requirement and authorisation.
- Office Admins create/edit jobs, manage assignments/invites, review records, and perform administrative corrections (always audited).
- Every API query and R2 access must re-check authorisation **server-side**. Do not trust job IDs, role flags or current-job selections supplied by the client.
- Do not include employee productivity rankings, continuous location logs or invisible background tracking.

## F. Authentication: independent SiteLog service

Use an **invite-only email one-time-code** login, not passwords or an improvised login protocol.

1. Office Admin invites a known email address. Bootstrap the first admin through a documented, secure one-time operator command/secret; never ship a default admin password or public admin creation endpoint.
2. User enters their email; a provider-agnostic `EmailSender` integration sends a short numeric one-time code. Email delivery may be a managed service, but do not add an unreviewed proprietary or noncommercial **software package**. Configure provider credentials using Cloudflare secrets, and provide a safe mock sender **only in local/test environments**.
3. Treat unknown emails generically to prevent account enumeration. Rate-limit by email and IP, cap verification attempts, use cryptographically secure randomness, store **only a keyed digest** of short codes, expire in roughly 10 minutes, and invalidate codes after use. Do not log codes in production.
4. On successful verification issue an opaque, cryptographically random server-side session in an `HttpOnly; Secure; SameSite=Lax` cookie, **host-only** (no `Domain`) with `Path=/sitelog`. Rotate/revoke sessions on login/logout; set finite lifetimes and document idle/session expiry policy. `SameSite` alone does not replace CSRF protection: validate `Origin` on changing requests and use an anti-CSRF mechanism if required by the design.
5. The business Worker validates sessions through a private **Service Binding/RPC** to the auth Worker. The frontend never treats user IDs/roles as proof of identity.
6. Provide `GET /sitelog/auth/session`, `POST /sitelog/auth/request-code`, `POST /sitelog/auth/verify-code`, `POST /sitelog/auth/logout` (or consistent equivalents). Use consistent JSON errors, no secrets in responses.
7. Offline: after a successful online login, allow the same user to access already cached jobs and save local drafts while offline, subject to the device security limitations. Require an online, valid session and fresh server-side permission check before syncing. On logout, remove/isolate cached personal data and pending records **only after a clear warning and explicit handling of unsynchronised work**. Document risks of shared devices.
8. Keep identity and access rules specific to SiteLog. No global `auth.tibbotts.com` or shared identity database with other projects.

## G. Job selection and location

- Office staff store **both** a readable site description/address and optional **WGS84 latitude/longitude**; neither is derived from the other at every request. Jobs on undeveloped land must work without a recognised postal address.
- Office setup supports manual address entry, lat/long entry and later a map pin. For address search/autocomplete, use a provider abstraction after verifying API terms, attribution, pricing and licensing; do not silently depend on a public geocoder with unsuitable production limits. At minimum, worker job search must search local job names and readable addresses.
- Worker can select **Find nearby jobs**, explicitly grant location permission, and choose from ranked matches. Use GPS accuracy, distance to job coordinates, assigned jobs, today's schedule (if later available), most-recent job and current explicit selection. Calculate nearby suggestions on device using downloaded authorised job coordinates where practical; do not send/store raw worker GPS coordinates unless justified.
- If GPS is denied, unavailable, inaccurate or ambiguous, job selection remains fast and fully manual. **Never silently switch a worker's active job solely on GPS.**
- Use configurable radius, starting with e.g. 150 metres, but do not present radius matching as proof that someone is physically on site.
- Cache assigned jobs and last chosen job for offline operation.

## H. Recording time, notes and job progress

- Time entry uses the current job and date automatically; offer worker-configurable standard start/end/break defaults (do not assume a default is the actual time). Automatically **suggest** next start from an existing same-day entry; avoid overlapping records on the same worker's day.
- Support multiple jobs in a day. Store worked time in **integer minutes** and calculate it from start/end/break. Validate finish after start and handle cross-midnight work explicitly. Track the job's local business date and `Pacific/Auckland` timezone; store server event timestamps in UTC.
- A worker can view and correct a time entry. Preserve **each revision** server-side with old/new values, editor and timestamp. Corrections do not overwrite history. Approved/locked entries require an explicitly defined admin correction flow.
- Notes are simple free text; no mandatory long descriptions, activity codes or progress percentages. Offer platform dictation where available; avoid unsupported claims about universal offline speech recognition.
- Office reports show job-level total actual labour hours versus an optional estimated-hours figure. This is for estimating and pricing quality, **not a worker ranking system**. Defer payroll, complex wage rates, invoices and job-cost accounting integrations.
- Provide an optional concise end-of-day review without making a rigid submission gate. Drafts autosave.

## I. Camera, photo/video compression, offline media and upload choice

### Device-side processing

- Use mobile file/camera input (`accept=image/*` or `video/*`, camera capture hints when supported), gallery selection and **multiple photos**. On iOS/Android, camera behaviour varies; always provide a file-picker fallback.
- **Photos:** before queueing for upload, correct orientation as needed, resize to **at most 1920 px longest edge**, encode **WebP ~0.8 quality** where supported or JPEG fallback. Save compressed bytes, width/height and original size for display. Targets (e.g. 200–500 KB) are **best effort**, not guaranteed. Create small thumbnails. Use `canvas`/`createImageBitmap` where supported, with appropriate fallbacks; avoid third-party compression packages by default.
- **Videos:** attempt efficient recording settings/codecs/bitrates when browser-supported. Don't assume browser-based transcoding works for arbitrary imported videos. If reliable recompression is unavailable, leave already-compressed video unchanged, show approximate size and ask permission before a potentially large upload. Support short clips and size limits; defer complex transcoding libraries unless licence, performance and compatibility are verified.
- Preserve meaningful metadata such as original capture/import time separately from file encoding. If compression removes EXIF, do not invent timestamps. Allow an optional original-quality upload for important details, subject to user approval and storage policy.
- Do not apply visible “evidence” language. Show “Add Photos”, “Add Video”, “Photos & Videos” and “Site Progress”.

### Per-device upload preference and status

- Persistent upload setting with **Wi-Fi only (default)**, **Mobile data only**, or **Both / any network**.
- **Always-visible compact upload icon** in top header, with number pending and state; tapping opens queue, per-item progress, retry, pause/resume and upload preference. Keep indicator unobtrusive; distinguish “saved on this device” from “synced”.
- The browser **cannot reliably identify Wi-Fi/cellular on all devices**, especially iOS Safari. If network type is unknown, **do not automatically upload media restricted to a specific network type**. Provide a clear **“Upload now using this connection”** manual override for the current upload/session, without silently changing the saved preference.
- Upload regular **notes and timesheets automatically** when online, independently of media policy. Photos/videos must respect the media setting. Do not equate `navigator.onLine` with a guaranteed working connection; handle request failures.
- Use private Cloudflare R2. For initial bounded uploads, upload to the API Worker with streamed bodies within configured request limits; for larger videos, design resumable multipart/direct-to-R2 uploads with short-lived, tightly scoped authorisation and explicit finalisation. Never let the browser choose arbitrary bucket keys. Consider file-type verification and safe content disposition for downloads.
- Retain local file data until confirmed successfully stored/registered by the server. Handle quota failures and file loss honestly. Warn before destructive actions affecting unsynchronised media.

## J. Offline-first PWA and synchronisation

- Cache **only the public app shell and non-sensitive static assets** via a service worker under `/sitelog/`.
- Store **user-scoped**, previously authorised job summaries, local draft notes/timesheets and compressed media blobs in IndexedDB. Partition by user ID; clear on safe logout/account switch. `CacheStorage` must not store private API/auth responses.
- Save an offline operation transactionally **before** displaying “Saved on Device”. Use client-generated operation UUIDs and server idempotency keys; retries must never produce duplicate timesheets, notes or media.
- Define an explicit local queue state machine: `draft`, `queued`, `syncing`, `synced`, `failed`, `conflict`. Persist retry state and errors. Never silently discard an entry.
- Sync when the app is open and connectivity appears to return, with exponential backoff/manual retry. Treat Background Sync as optional enhancement: it is not universally supported and cannot guarantee iOS background upload.
- Resolve conflicts intentionally. For notes, allow explicit edit/retry; for timesheets use revision/version checks and `409 Conflict` with a readable comparison flow. The server remains authoritative about permissions and accepted time data.
- Request persistent browser storage when supported, monitor quota/storage estimates, provide a pending-record count and clear storage warnings. Offline browser storage is **best effort, not permanent backup**. Validate iPhone behaviour and app termination/reopen.
- Keep app usable without geolocation or an active network; **first login/invite and initial job download require an internet connection**.

## K. REST API contracts (initial version)

Use JSON and consistent schemas/error envelopes. Set `Cache-Control: no-store` for sensitive/private responses. Prefer appropriate HTTP status codes, pagination, filtering and idempotency. Document endpoint request/response examples in `docs/API.md`.

| Method | Route | Responsibility |
|---|---|---|
| `GET` | `/sitelog/api/about` | Version, environment-safe metadata and current **server** UTC time; no secrets |
| `GET` | `/sitelog/api/me` | Current authenticated user and SiteLog role |
| `GET` | `/sitelog/api/jobs` | Assigned jobs (worker) or authorised list (admin) |
| `GET` | `/sitelog/api/jobs/{id}` | One authorised job |
| `POST` | `/sitelog/api/jobs` | Office Admin creates job |
| `PATCH` | `/sitelog/api/jobs/{id}` | Office Admin updates job/location/estimates |
| `GET` | `/sitelog/api/jobs/{id}/activity` | Job timeline: notes, media and relevant work records |
| `POST` | `/sitelog/api/jobs/{id}/notes` | Create note, idempotently |
| `GET` | `/sitelog/api/timesheets?date=YYYY-MM-DD` | Worker’s own entries or admin-authorised records |
| `POST` | `/sitelog/api/timesheets` | Create validated time entry, idempotently |
| `PATCH` | `/sitelog/api/timesheets/{id}` | Revise with expected revision/version |
| `GET` | `/sitelog/api/timesheets/{id}/history` | Authorised immutable revision history |
| `POST` | `/sitelog/api/jobs/{id}/media/uploads` | Create authorised, time-limited upload intent |
| `PUT` | `/sitelog/api/media/uploads/{id}/content` | Initial bounded upload (or use authorised multipart design) |
| `POST` | `/sitelog/api/media/uploads/{id}/complete` | Verify stored object and register media idempotently |
| `GET` | `/sitelog/api/media/{id}` | Authorised media metadata/content access |
| `GET` | `/sitelog/api/admin/users` | Office Admin users/invites |
| `POST` | `/sitelog/api/admin/invites` | Invite worker or admin |
| `POST` | `/sitelog/api/jobs/{id}/assignments` | Assign worker to job |
| `GET` | `/sitelog/api/admin/job-hours` | Job-level estimated vs actual hours |

Auth service owns `/sitelog/auth/*`; the business API must not recreate OTP endpoints. Media upload design must be adjusted as needed for Cloudflare per-request body limits and safe resumability, rather than assuming one arbitrary video can always fit in a single request.

## L. Licensing, security, privacy and records

### Approved dependency policy

- Use **standard platform/browser APIs first**; add a dependency only when it materially reduces risk or complexity.
- Prefer **MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC**. Other OSI-approved licences permit commercial use but may impose obligations: **review GPL, LGPL, AGPL, MPL and other copyleft licences before inclusion**. No noncommercial-only, source-available-but-restricted, ambiguous, unlicensed or unknown-licence package/assets without explicit written approval.
- Audit **direct and transitive dependencies**, fonts, icons, map data/providers, photos, video codecs and build tools. Maintain `docs/THIRD_PARTY_LICENSES.md`, relevant notices and a lockfile. Pin dependencies. Include automated licence/security checks where practical and **fail builds on unknown/disallowed licences**, with a documented review escape hatch requiring user approval.
- Commercial cloud hosting, mail sending and DNS are **managed service contracts**, not necessarily OSS libraries; document recurring cost, free-tier assumptions, privacy/data-processing terms and alternatives. Do not promise every managed service is free/open source.

### Security/privacy

- HTTPS only. Strict backend authorisation on every request, private R2, short-lived media authorisation, bound file size/content type limits, safe filenames, no bucket listing, secure headers and least-privilege Cloudflare bindings.
- Use parameterised queries, robust input validation, request/body limits, abuse controls, rate limiting and generic auth errors. Avoid secrets in logs, source, static output or GitHub Actions logs.
- Workers’ location is **used only on request to suggest a job**; no continuous GPS collection or stored movement trail. Provide manual selection; explain location purpose in plain language.
- Provide a concise worker privacy notice describing collected times, jobs, media, approximate site location data and who in the office can access them. Give retention/deletion/export policies, incident response considerations and access audit requirements; align with New Zealand Privacy Act 2020 guidance and obtain legal review before live rollout to employees.
- Client disputes may require defensible records: preserve server receipt time, submitted-by identity, job association, timesheet edit history and media checksums/metadata. Avoid claiming that compressed images are forensically identical to originals. Define a retention policy before production and allow admin export.
- No telemetry or analytics that monitors individual worker behaviour by default. No employee rankings. No location monitoring beyond explicit job matching.

## M. Testing and acceptance criteria

Implement automated unit/integration tests with only approved dependencies, plus a concise manual device test checklist. Tests should cover:

1. **Routes:** existing `tibbotts.com/` and `/family/` unchanged; SiteLog paths route correctly; `/sitelog` redirects safely; no CORS problem on same-origin API.
2. **Authentication:** invite-only OTP, invalid/expired/used codes, enumeration controls, attempt limits, session expiry/revocation/logout, no public private-RPC exposure.
3. **Authorisation:** worker cannot read other unassigned job or another worker’s timesheet; admin scopes enforced; R2 downloads/uploads protected.
4. **Job location:** search by name/address, manual selection, matching coordinates on undeveloped sites, denied GPS, inaccurate GPS, close adjacent sites and cached last job.
5. **Time:** default suggestion, two jobs in one day, break calculations, overlap validation, DST/time-zone handling, edit conflict and immutable revision history.
6. **Photos:** capture/multi-select, orientation, actual compression, thumbnail, offline IndexedDB save, interrupted upload/retry, private retrieval.
7. **Videos:** supported camera/file picker, bitrate preference where available, unsupported codec fallback, size controls, resumable or clearly limited upload path.
8. **Network choice:** Wi-Fi only, mobile only, both; network unknown; manual override; persistent top-bar icon and pending count; notes/time sync while media waits.
9. **Offline:** previously authenticated worker, app reload offline, cached jobs, hours/note/media drafts survive app restart and reconnect; duplicated submissions prevented; correct conflict/quota warnings.
10. **Licensing/build:** package lock committed, permitted licences, no embedded secrets, dev/stage/prod boundaries, smoke tests and rollbacks.

**Definition of done for initial release:** On a real phone, an invited worker can log in online; reopen the installed PWA offline; select a previously cached job; record time and a note; take multiple photos and record a short video; see media stored locally; choose Wi-Fi-only uploads; close/reopen the app with records intact; later reconnect, authenticate if required, sync the records without duplicates; and have an Office Admin view the correct job records and historical timesheet revisions. Limitations must be documented honestly.

## N. Implementation sequence — complete one stage at a time

**Stage 0 — Discovery and plan (FIRST RESPONSE).** Inspect repository and runtime constraints. Present proposed file tree, Cloudflare routing topology, package/license choices, authentication/email provider interface, test approach, risk list and the next smallest milestone. Identify user actions required for Cloudflare account, DNS, email provider and secrets. **Do not change DNS or production.**

**Stage 1 — Foundation and safe preview.** Scaffold isolated `frontend`, `backend`, `auth` and docs; pin build tools, set up tests, lint/basic formatting as appropriate; create a minimal PWA shell and unauthenticated **non-sensitive** `/sitelog/api/about` returning dynamic server date; deploy to preview/test URLs only. Validate path prefixes and service-worker scope.

**Stage 2 — SiteLog-specific auth.** Implement auth D1 migrations, secure admin bootstrap, invite-only email OTP, email-sender abstraction, session cookies, private service binding, test login/logout/security. No real work data until auth is complete.

**Stage 3 — Jobs and office administration.** Implement business D1 schema, secure job list/details and office job/worker assignment screens, readable address + optional site coordinates, manual job search and nearby suggestion. Seed synthetic sample records in nonproduction only.

**Stage 4 — Daily records.** Implement offline-capable time and note forms, intelligent defaults, backend validation, optimistic revisions and timesheet edit history; job-level actual vs estimated hours for office.

**Stage 5 — Media.** Implement camera/gallery capture, compress photos on client, video recording/fallback, local storage, R2 private upload/download endpoints, upload queue, three network preference modes and visible header status.

**Stage 6 — Reliable offline sync.** Implement IndexedDB persistence, idempotent offline queue, reconnect retry, conflicts, storage quota warnings, per-user isolation, manual upload override and iOS/Android device tests.

**Stage 7 — Hardening and staged release.** Run auth/permission/privacy/licence/backup tests, verify existing GitHub Pages site, write migrations/rollback/runbook, deploy staging and run realistic tests; deploy production **only after explicit approval**. Production action must not be automatic merely because a commit is pushed to `main`.

**Stage 8 — Future, NOT in initial release.** MCP server exposing narrowly scoped authorised operations (`listJobs`, `getJob`, `addJobNote`, `getJobProgress`), with separate agent authentication and no direct DB access. Later enhancements: original-quality retention policy, advanced video transcoding, map-pin provider, costing integrations, timesheet approvals and exports.

### Copilot's work discipline

At each stage:

1. State the stage objective, proposed change list, and acceptance tests in plain English.
2. Implement **only that stage**. Use focused, single-responsibility modules/classes, readable names and well-defined boundaries. Avoid unnecessary patterns, premature abstractions, frameworks or dependencies.
3. Run available checks; report exact results and limitations (do **not** imply tests ran when they did not).
4. Update `docs/IMPLEMENTATION_STATUS.md` with completed work, deviations, known issues, manual Cloudflare actions and the next step.
5. Stop and present a concise review before proceeding to the next stage. Never silently reconfigure production or request that secrets be pasted into source code.

### Start Copilot with this instruction

> Read `SiteLog_Copilot_Implementation_Instructions.md` fully. It is the project brief and source of truth. Begin with **Stage 0 only**: inspect the repository, validate technical compatibility (including macOS Big Sur/Cloudflare tooling), propose the repository structure, Cloudflare routing and deployment plan, auth/email approach, major risks and a staged task checklist. Do not change production DNS, deploy anything or begin coding the full app. Give me your plan and any genuinely blocking prerequisites first.

## O. Official references to validate at execution time

- Cloudflare Workers routing: https://developers.cloudflare.com/workers/configuration/routing/routes/
- Cloudflare Workers static asset subdirectory: https://developers.cloudflare.com/workers/static-assets/routing/advanced/serving-a-subdirectory/
- Cloudflare Service Bindings: https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
- Wrangler supported environments: https://developers.cloudflare.com/workers/wrangler/install-and-update/
- Cloudflare D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- Cloudflare R2 uploads: https://developers.cloudflare.com/r2/objects/upload-objects/
- Browser Network Information API: https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
- Browser Background Sync: https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
- NZ Privacy Commissioner guidance on employee location: https://www.privacy.org.nz/resources-and-learning/knowledge-base/view/444/
- Open Source Initiative FAQ: https://opensource.org/faq

**Last instruction:** Maintain the product’s purpose: reduce site-worker paperwork, record work progress and improve job quoting; do not turn SiteLog into surveillance or unnecessarily complex job-management software.
