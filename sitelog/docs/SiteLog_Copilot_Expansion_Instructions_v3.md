# SiteLog — Copilot Expansion Instructions: Office Operations + Visible App Version

**Document version:** 3.0 (addendum to the existing SiteLog specification v2)  
**Date:** 13 November 2026  
**Product:** SiteLog  
**Canonical public URL:** `https://tibbotts.com/sitelog/`  
**Purpose:** Add the missing quoting, scheduling, procurement, materials, supplier, subcontractor, inspection, document, variation and commercial management workflows **without compromising** the simple offline-first field-worker PWA. Display the deployed application version on every screen.

> **Instructions for GitHub Copilot / coding agent:** Read `SiteLog_Copilot_Implementation_Instructions_v2.md` **and this file in full** before changing source. This is a **supplement**, not a replacement. If the original file has a different name in the repository, locate the approved v2 SiteLog specification and read that. Preserve all previous requirements, boundaries, privacy rules, licences, security, and deployment controls. Where v2 explicitly marked one of the features below as "later" or "deferred," this document authorises planning and implementation of it **in the staged order below**; do not silently discard v2's baseline requirements. Resolve any conflict explicitly in `docs/DECISIONS.md` and report it before coding. Do not build all modules in one pass.

---

## 1. Non-negotiable project decisions

1. Public URL is **`/sitelog/`**, never `/jobdiary/`. All API calls use `/sitelog/api/...`; SiteLog authentication uses `/sitelog/auth/...`; `/sitelog/mcp` is reserved for later.
2. **Single-company application**, not a multi-tenant SaaS at this stage. One organisation has workers, office users, customers, suppliers, subcontractors and jobs. Do not add a Tenant/Company abstraction for hypothetical clients.
3. **Separate responsibilities/deployables:** frontend PWA, business REST API, SiteLog-specific authentication, database migrations, and optional future MCP adapter. Maintain same-origin public URLs where practical.
4. **Authentication:** invite-only email one-time codes; separate auth Worker and data store; independent users/sessions from every other `tibbotts.com` project; server-enforced Office Admin / Worker permissions.
5. **Hosting:** Keep GitHub Pages as the origin for `tibbotts.com` routes outside `/sitelog/`. Use Cloudflare path-specific routing for SiteLog. Do not change existing site DNS, nameservers, MX records or production routes without a reviewed plan and express approval.
6. **PWA/offline:** Workers can view previously authorised jobs, capture notes/time/photos/video, and preserve pending submissions offline. Media is compressed where practical and respects the worker's **Wi-Fi only / Mobile data only / Both** upload preference; top header always shows the setting/queue status. Do not quietly bypass the upload policy.
7. **Language:** SiteLog supports site work, progress and accurate estimating; it is **not** an employee surveillance system. The worker UI uses "Site Photos", "Record Time", "Daily Record", "Site Progress". Avoid "collect evidence", "verify worker performance", tracking-style wording or performance rankings.
8. **Dependencies:** Native browser APIs first. Only include dependencies/assets with verified licences permitting commercial use and any obligations complied with. Prefer MIT, Apache-2.0, BSD and ISC; review copyleft separately. No noncommercial, unlicensed or unknown dependencies; review transitive packages, fonts, icons, map tile data, document/Excel tools and video codecs.
9. **Currency/time:** NZD monetary amounts, stored as **integer cents** or an equally exact fixed-decimal representation; quantities can be decimal and require carefully defined precision. Do not calculate monetary totals in binary floating point. Store event timestamps in UTC; work dates, schedules and NZ business rules use `Pacific/Auckland` explicitly.
10. **Release control:** Development, staging and production have separate data/secrets. Run tests before merge. **Production deployment is manual and requires user approval.** Every deployed frontend must show its **version visibly on the page** (see Section 3).
11. Avoid premature enterprise features: no payroll engine, accounting integration, multi-warehouse inventory, complex HR performance reporting or full ERP unless explicitly requested. Implement the requested operational workflows end to end, then extend gradually.

## 2. Product boundaries and user journeys

### 2.1 Worker-facing SiteLog PWA

The core mobile experience remains intentionally small:

- Small persistent SiteLog header, including **visible version text** and always-visible upload status/preferences control.
- Compact current-job selector immediately below the header. Suggest jobs based on authorised assignments, previous selection and optional **user-requested** GPS proximity; sites may be defined by latitude/longitude even without recognised street addresses.
- Primary quick actions: **Record Time**, **Add Photos**, **Add Note**, **Add Video**.
- Today's Records and simple relevant job information, including work instructions, upcoming work, material availability and next inspections **without presenting an office administration dashboard to workers**.
- Workers must be able to see their assigned schedule, key site instructions, inspection appointments and delivery information **when authorised** and previously cached offline.
- No mandatory narratives for each photo; automatic current job, date/time, worker and work record associations where appropriate.
- Worker UI never shows customer-specific margins, material purchase cost, sell rates, private financial figures or other office-only data.

### 2.2 Office administration

Office users can:

- Maintain customers/clients and jobs.
- Build and issue **standalone quotes**; an accepted quote can become a job.
- Manage itemised price books, supplier-specific purchasing costs, selling prices and client-specific pricing.
- Configure reusable, editable **terms, conditions and exclusions**.
- Track supplier/subcontractor details and approved status.
- Plan labour, subcontractor work, materials deliveries and site inspections.
- Turn quoted material requirements and planned inspections into actionable job records on acceptance.
- Manage purchase orders and material arrival/readiness; no full inventory module needed.
- Review daily site progress, time entries, photos and videos.
- Record project decisions, changes/variations and versioned documents.
- Compare **estimated versus actual** labour, materials and subcontractor costs at the **job** level for future pricing.
- Export commercial and project records with permissions and audit history.

### 2.3 Quote-to-job lifecycle (key workflow)

```text
Create quote (can exist without a job)
  -> Build itemised pricing, materials, planned inspections, terms, exclusions
  -> Draft / Review / Issued / Accepted / Declined / Expired / Cancelled
  -> On ACCEPTED (explicit office action): create Job exactly once
       + snapshot accepted quote, amounts, rates and terms
       + copy material requirements for purchasing
       + create planned inspections
       + carry useful scope/site instructions
  -> Plan workers, subcontractors, deliveries and inspections
  -> Workers record time, notes, photos and videos
  -> Office reviews job costs, variations, documents and progress
  -> Complete / Archive job (retain historical records)
```

- **A quote is not automatically a job.** A rejected/expired/draft quote remains standalone; a directly charged or non-quoted job can also be created without an originating quote.
- Accepting the same quote twice must **not create duplicate jobs**: use transactional status checks, unique source-quote constraints and idempotency.
- Never edit an already accepted historical quote in place and silently change an existing job. Issue an authorised revision/variation or explicitly documented change.

---

## 3. Mandatory: visible application version and build identity

This requirement is **P0** and should be implemented **before the larger office modules**.

### 3.1 Visible design

- Every worker and office page must visibly show a small version label, for example **`v0.3.0`**. This cannot be buried only in Settings, DevTools or a hidden About screen.
- Keep the header compact. Example mobile header:

  ```text
  [SiteLog] v0.3.0              [Cloud/Wi-Fi + 3] [Settings]
  [Current job: Whitby Drainage Works                  v]
  -------------------------------------------------------
  [Record Time]  [Add Photos]  [Add Note]  [Add Video]
  ```

- A secondary **Build Details** view (tap/click version label) shows: frontend version, shortened Git commit ID, build timestamp (UTC), deployment environment, and current backend API version **when online**. Never expose repository secrets, access tokens, internal service URLs or private configuration.
- Accessible label and adequate colour contrast; small but legible. Show version even on login and offline/error screens (if the app shell is available).
- **Always display the version of the frontend code actually running on the device**, not merely a claimed latest server release. An offline PWA may legitimately display an older build until it updates.

### 3.2 Single-source build version

- Define one authoritative app release version in the repository (e.g. root `package.json` version or a simple `version.json`; choose and document one). Use semantic versions: `MAJOR.MINOR.PATCH`.
- CI injects a **Git commit SHA**, UTC build time and environment into an immutable frontend build-info module/JSON at build time. Use a safe local fallback for development if the CI variables are absent. **Do not generate a new pseudo-version on each runtime request.**
- Expose a safe `GET /sitelog/api/about` response containing backend version, deployment label, server UTC time and optional short release/commit identifier. It must not contain secrets, account identifiers or environment variables.
- Separate **release version** (human meaningful) from **build identifier** (exact deployed artifact). Do not mislabel the API's version as the browser version.

### 3.3 PWA update and cache correctness

- Fingerprint JS/CSS assets and version application-shell caches using the **build identifier**, not a static cache name that keeps serving old code forever.
- Do not cache authenticated API or auth responses in the public Cache API. Keep worker data in user-isolated IndexedDB according to v2.
- When a newer service worker is installed, show an unobtrusive **"Update available — Reload"** action. Never lose unsynchronised drafts/uploads; check pending local operations before reloading and preserve them across the app update.
- Clean up old **static asset** caches after activation, but never delete unsynchronised user data as part of cache cleanup.
- On reload, verify the visible version changes when the new build becomes active; provide a manual "Check for updates" action in Settings and a fallback for update failure. Do not force reload in the middle of an entry.
- Add automated and manual tests for versions in preview, staging, production and offline mode.

### 3.4 Acceptance criteria for versioning

1. Version is visible on worker home, office pages, login page, offline page.
2. Version/build detail matches the actual packaged frontend artifact and CI commit.
3. Updating from one build to another shows a clear update/reload path.
4. Old unsynchronised time/photo/video/note drafts survive app update.
5. A stale offline app reports its **own installed** version honestly.
6. Backend `/api/about` reports its own current version when reachable.

---

## 4. Customers, contacts, suppliers and subcontractors

### 4.1 Customers/clients

- Office-only CRUD (with active/archived state) for client name, optional business/contact details, contact person and site/project references.
- Associate a customer with a quote and/or job. Preserve a snapshot of quote recipient/contact details when a quote is issued or accepted.
- Support **client-specific overrides** of standard sell rates. Never expose this information to workers.
- Avoid collecting unnecessary personal data. Do not create a multi-tenant Customer organisation model for this single-company application.

### 4.2 Suppliers

- Maintain supplier identity, trade/category, contacts, active/approved flag, notes and optional normal lead time.
- A supplier's price book records can differ for the **same item**. Allow office staff to compare supplier costs.
- **Only approved suppliers can be selected for new quote procurement choices and new purchase orders.** Existing historical orders must remain readable if a supplier is subsequently unapproved/archived.
- Preserve the selected supplier and prices as snapshots on quote/order lines, so later price-book edits do not rewrite history.

### 4.3 Subcontractors

- Maintain name, trade, contacts, insurance/approval status (simple dates/notes), normal rates if authorised and active status.
- Schedule subcontractors against jobs; optionally link a subcontractor to a quote line/anticipated cost.
- Office should be warned if a subcontractor is unapproved or scheduled against conflicting commitments; no full contractor payroll module.
- Field workers see only the subcontractor information relevant to their own assigned site work.

## 5. Materials price book and purchasing rates

### 5.1 Canonical catalogue

- One **Material/Service Item** has a stable ID, consistent human-readable name, description, category, unit of measure (UoM, e.g. `ea`, `m`, `m²`, `m³`, `hour`), default sell rate (if applicable), active state and optional item code.
- **SupplierPrice** is a separate record keyed by `(item_id, supplier_id, effective_from/version)` with unit cost, currency (NZD), last updated timestamp, optional standard lead time and supplier item reference.
- Keep purchase **cost** distinct from **sell price**. A general sell price is not necessarily equal to a supplier's unit cost or markup.
- Support optional **ClientRateOverride** for a particular item/client with effective dates and agreed sell rate. Use explicitly documented precedence: eligible client sell override > item standard sell rate > manual authorised quote sell rate where needed. A manual override should be displayed/recorded and require appropriate office permissions. Never silently treat a supplier cost as the sell rate.
- Choose and document the exact price resolution rules for inactive items, expired overrides and multiple effective prices; tests must cover ambiguity and prevent silent wrong prices.
- Support decimal quantities, well-defined rounding and NZD display. Do not trust client-supplied total values; recalculate on the server using exact arithmetic.

### 5.2 Supplier comparison

- Office can inspect an item and compare **approved supplier** cost, recent effective pricing, lead time and selected/default supplier.
- Quoting should allow selection of a supplier per material line from approved suppliers; quote may use an estimated supplier price, but must not equate this with an actual purchase.
- Show lead times on the client-facing quote **only when expressly intended**; do not leak confidential purchase costs or supplier discounts.
- Preserve audit history of price and rate changes at least by effective version and editor; old quotes/orders must retain original price snapshots.

### 5.3 Materials brought into an accepted job

- Accepted quote materials create **MaterialRequirement** records on the new job: item, required quantity/UoM, selected supplier preference, needed-by date, quoted cost/sell snapshots and notes.
- They are **not considered ordered** merely because the quote was accepted. Statuses might be `planned`, `requested`, `ordered`, `partially_received`, `received`, `cancelled`.
- Office staff can create purchase orders from requirements, combine compatible requirements where safe, record vendor reference, expected delivery, quantities ordered/received, actual unit cost and status.
- Track partial delivery; never report 100% received until quantities match. Support deliberate over-deliveries with audit and validation.
- A supplier can be changed before ordering with office approval; preserve the original quoted choice/snapshots and reason for change.
- Materials screen should show **Outstanding / Ordered / Due / Received** views and flag required materials not ordered before scheduled work starts. No inventory-stock ledger or accounting export in v1 of this expansion.

## 6. Quotes and quote templates

### 6.1 Quote model and lifecycle

- A quote can exist independently of a job. Fields: unique quote number, client, title/scope, optional site address and WGS84 coordinates, issue/expiry dates, status, revision, currency NZD, GST/tax configuration, comments and timestamps.
- States: `draft`, `review`, `issued`, `accepted`, `declined`, `expired`, `cancelled`. Define permitted transitions and role restrictions. Quotes cannot be marked accepted unless the required scope/pricing/terms are valid.
- Quote revisioning: edits to an issued quote create an authorised new revision/snapshot, rather than mutating the client-issued version silently. Store issuer and acceptance event with date and relevant source reference.
- Quote lines support: description, line type (`labour`, `material`, `subcontractor`, `other`), UoM, decimal quantity, unit sell rate, optional estimated unit cost for office-only costing, selected approved supplier if material, discount/markup if explicitly configured, sorting/grouping and optional notes. Sum must remain visible on screen even while scrolling a long quote.
- Keep financial precision correct: line amounts and totals use explicit currency and rounding rules; do not use JS floating point to calculate money. GST rate must be configurable and saved with the issued quote; don't infer tax treatment from the client.
- Quote list, search, duplicate-as-new-draft, view, edit drafts, review, issue, accept/decline and PDF/print-friendly export. Preserve the exact accepted/issued version. External client acceptance via secure customer portal is out of scope initially; office manually records acceptance with a reference/date.

### 6.2 Branded quote export

- Generate a professional, branded **print/PDF-compatible quote** with client details, scope, line items, units, quantities, rates, totals, GST, terms, exclusions, dates, validity period and revision identifier.
- **Include a branded Excel (`.xlsx`) export option** in the expansion, because it was part of earlier quoting goals. Only use a verified commercially permitted implementation. Do not silently add a library with ambiguous licensing; if a compliant library is unavailable, deliver CSV plus a clearly documented, testable XLSX implementation plan as a staged follow-up rather than producing a fake `.xlsx`.
- Export is a snapshot, not a live recalculation based on later price-book changes. Avoid untrusted formula injection in exported spreadsheet cells.

### 6.3 Terms, conditions and exclusions

- Dedicated Office **Terms** page: create, view, rename, revise and archive templates (default **Standard**).
- A template contains an **ordered list of individually editable plain-text lines**. On the quote editor, each line should appear as a simple text field **with an `X` remove control at the end**, plus a small add-line action. Avoid cumbersome rich-text editors.
- Selecting a template copies its current lines into the quote as an **independent editable snapshot**; changing a template later must not unexpectedly change issued or historical quotes.
- Support general terms/exclusions plus job-specific lines. Avoid duplicate/conflicting clauses by basic exact/near-duplicate warnings (deterministic where possible) with human review; never automatically delete contractual wording without approval.
- Provide a quick link from the quote editor to Terms management and an obvious route back. Confirm before removing a populated clause; preserve draft autosave where practical.

### 6.4 Acceptance: quote to job

- On acceptance (office action): atomically record accepted quote revision, create an active job **only if one has not already been created for this quote**, transfer scope, client/site address and coordinates, quoted labour baseline, material requirements and planned inspections.
- Preserve quoted amount, cost estimates and selected terms/exclusions as snapshots on job origin. Keep links `Quote -> Job` and `Job -> Accepted Quote` for traceability.
- For pre-existing jobs created independently, do not force quote linkage or re-create the job; define a controlled option to associate an accepted quote if the business explicitly approves this workflow.
- Tests must prove repeated API requests, retries and browser refresh never duplicate a job, material requirements or inspections.

## 7. Scheduling workers, subcontractors, materials and inspections

### 7.1 Office planner

- Provide a clear day/week **Schedule** view with job activities, worker allocations, subcontractor bookings, planned inspections and expected material deliveries.
- Support an activity/task with job, title, start/end, timezone, assigned workers/subcontractors, optional dependencies, status and notes. Scheduling is about **work planning**, not time-clock surveillance.
- Show simple conflict warnings (same worker/subcontractor assigned to overlapping commitments; inspection outside working window; material needed before available). Don't block valid overrides without a documented reason.
- Jobs may have no street address but still have site coordinates, a readable site description and map link when available.
- Worker PWA sees a concise **My Schedule / Upcoming** list for assigned work; it must be readable offline from cached authorised data. Current job selector can use today's schedule as one signal, but **never silently change the selected job**.

### 7.2 Material readiness

- Associate one or more MaterialRequirements with scheduled activities (optional initially). Show an obvious **materials not ready** or **order outstanding** indicator to the office when work is scheduled before required items are expected/received.
- Allow manual override with reason, audit entry and responsibility. Do not automatically procure materials based solely on a schedule edit.

### 7.3 Scheduling and status semantics

- Keep **planned times** distinct from **actual worker timesheet entries**.
- A rescheduled event must not retroactively rewrite a timesheet or a delivered-material date.
- Record schedule update history for important changes; audit editor/time and notify affected workers only through a future communication feature, not assumed push notifications.

## 8. Inspections

- During quoting, office staff can specify planned inspections with description, discipline/type, expected phase/date, inspection authority (if known), relevant requirements/notes and optional quoted allowance.
- Upon quote acceptance, copy planned inspections to the job as actionable records, preserving their origin, without duplicating if the acceptance request retries.
- Office can schedule/reschedule inspections, assign responsible person or inspector, record outcome (`planned`, `booked`, `completed`, `follow_up_required`, `cancelled`), outcome notes and date.
- Attach private photos/documents and reference a related Decision or Variation where appropriate. Keep supporting files versioned; never erase history by replacing the same R2 key.
- Worker PWA shows relevant upcoming inspection and its status. Recording an outcome can be office-only initially; do not require workers to fill out a long checklist.

## 9. Variations, decisions and document records

### 9.1 Variations

- Office can create a **Variation** linked to a job (and optionally a quote/contract reference): sequential identifier, title, reason, scope description, originator, status, date, cost estimate and sell amount, linked records and attachments.
- Track states such as `draft`, `submitted`, `approved`, `rejected`, `withdrawn`, with timestamps and decision references. Approval is an explicit event; never assume a submitted variation is approved.
- Preserve issued/approved versions. Do not alter the original accepted quote silently. Office job cost summaries should distinguish **original budget** from **approved variations** and **pending variations**.
- Important: a variation record is **not** automatically a compliant statutory claim, instruction or contractual notice. Present it as project recordkeeping; require review of applicable contract and NZ law before generating formal legal notices.

### 9.2 Decisions register

- Capture key site/office **Decisions**: title, summary, decision date, recorded-by, responsible party, related job/quote/variation/inspection, optional action/target date, supporting files and immutable audit trail.
- Make it easy to find the final decision and why a change was made. Do not create a social feed or excessive notification system.

### 9.3 Document handling and versioning

- Allow authorised uploads of documents/photos, including multiple files in one operation, with category (plans, quotes, purchase orders, inspection reports, variations, site photos, correspondence, other), filename, MIME, upload source, timestamps, owner and associations with jobs/inspections/variations.
- Each new version creates **a new immutable file object in private R2** plus a `DocumentVersion` metadata row, version number and checksum. Retain previous versions subject to documented retention rules; no overwriting the same object key.
- Display "Current version" and "Version history" in office views; workers may view only job documents explicitly shared with their role.
- Document download URLs are authorised and short lived. Validate file types/sizes and handle potentially hostile uploads/downloads safely.
- Provide clear naming/categorisation, permission-aware search and export of a job document index with links/metadata. Later integrations with SharePoint/Dropbox/Google Drive are **not** required for this stage.

### 9.4 NZ construction recordkeeping considerations

- Maintain reliable, exportable records of work, quotations, accepted terms, site photos, inspection outcomes, changes, documents, claims-related communications where entered, and who/when changed records.
- If tracking payment claims/schedules/notices later, make their dates and status explicit; do **not** invent statutory deadlines or claim that SiteLog guarantees compliance with the Construction Contracts Act 2002. Deadlines can depend on governing contract and statutory provisions. Legal/contractual templates must be reviewed before real-world use.
- Define retention, backup, legal hold (if required), access and audit policies before production. No employee or client data in staging/test by default.

## 10. Job cost and quotation feedback

The office needs a **job-level estimating feedback loop**, not worker-performance scoring.

- Preserve original quote baseline (quoted labour minutes/hours and expected labour cost if authorised, material quantities and estimated cost, subcontractor allowances, approved variation amounts).
- Aggregate **actual job hours** from authorised timesheet entries, excluding superseded revisions and avoiding double counting. The timesheet revision history remains immutable.
- Aggregate actual material purchasing costs from **received/ordered values by explicit chosen basis** (document which measure is displayed), and subcontractor costs from manually recorded/completed commitments if available.
- Office summary should show original estimate, approved changes, revised estimate, actual to date, and variance for labour hours/materials/subcontractors where reliable. Distinguish incomplete/invoiced/committed/actual figures. Never invent missing costs.
- Provide simple job comparison/export to support future pricing; **do not rank employees** or infer individual performance from time spent on a job.
- The worker sees their own daily entries and relevant job scope, never confidential margins, supplier cost or customer-specific sell rates.

## 11. Suggested bounded code structure and responsibilities

Keep the deployment separation from v2. Within the business API, use feature modules rather than one giant controller:

```text
sitelog/
  frontend/
    src/
      shell/                    # compact header, current job, version, sync status
      worker/                   # daily record, job info, schedule, media
      office/                   # quote, materials, schedule, suppliers, jobs, etc.
      offline/                  # local store and sync queue from v2
  backend/
    src/
      modules/
        jobs/
        quotes/
        terms/
        customers/
        suppliers/
        subcontractors/
        pricebook/
        materials/
        purchasing/
        scheduling/
        inspections/
        variations/
        decisions/
        documents/
        reporting/
      shared/                   # auth context, validation, money/date primitives
    migrations/
  auth/                         # independent OTP login/session service (unchanged)
  docs/
    ARCHITECTURE.md
    API.md
    DATA_MODEL.md
    WORKFLOWS.md
    VERSIONING_AND_RELEASES.md
    THIRD_PARTY_LICENSES.md
    IMPLEMENTATION_STATUS.md
    DECISIONS.md
```

Avoid unnecessary layers and design patterns; prefer small cohesive modules with narrow exported operations. Suggested responsibility examples:

| Component | Responsibility |
|---|---|
| `QuoteCalculator` | Exact line/tax/total calculation, without database or HTTP concerns |
| `QuoteWorkflow` | Validate quote state transitions, issue/revision/accept rules |
| `PriceResolver` | Determine effective item sell price from item and eligible client overrides |
| `QuoteAcceptanceService` | Transactionally convert accepted quote to job plus linked requirements/inspections |
| `MaterialPlanningService` | Derive and manage job material requirements and readiness |
| `PurchaseOrderService` | Manage approved-supplier purchasing, delivery and receipts |
| `ScheduleService` | Plan work and detect overlap/readiness conflicts |
| `DocumentService` | Authorise private R2 files and immutable document revisions |
| `JobCostSummaryService` | Aggregate job-level estimated and actual values, with source/basis |
| `BuildInfo` | Provide immutable frontend build metadata for version display |

If existing repository design uses different names, **adapt to it** instead of duplicating classes/modules with overlapping responsibilities. Authenticate before calling business operations; check authorisation at the route and data-access boundary.

## 12. Proposed data model additions

Extend, **do not replace**, v2 entities for `User`, `Job`, `JobAssignment`, `WorkNote`, `TimesheetEntry`, `TimesheetRevision`, `MediaAttachment` and their offline/sync structures. Suggested additional entities (finalise keys/types/constraints in `docs/DATA_MODEL.md`):

| Entity | Essential fields and constraints |
|---|---|
| `Customer` | ID, name, contact details, active flag |
| `Supplier` | ID, name, contact details, approved/active, normal lead time |
| `Subcontractor` | ID, name, trade, contact, approved/active |
| `CatalogItem` | ID, item code/name, category, UoM, standard sell rate, active |
| `SupplierPrice` | ID, item ID, supplier ID, effective date/version, cost, lead time, supplier item code |
| `ClientRateOverride` | ID, customer ID, item ID, sell price, effective range |
| `Quote` | ID/quote number, client ID, status, current revision, dates, NZD/tax config, site details |
| `QuoteRevision` | Quote ID, revision, immutable content snapshot, issue date/actor, hash or identifier |
| `QuoteLine` | Quote/revision linkage, sort position, type, item, description, UoM, decimal quantity, unit rates, snapshots |
| `TermTemplate` | ID, name (including Standard), revision, active/archived |
| `TermTemplateLine` | Template/revision, order, text |
| `QuoteTermLine` | Quote/revision, order, text snapshot, optional source template |
| `QuotePlannedInspection` | Quote/revision, type, notes, expected stage/date |
| `MaterialRequirement` | Job ID, quote-line origin, item, qty, required-by, supplier preference, status, quoted snapshots |
| `PurchaseOrder` | ID/number, supplier, job, order date, expected date, status, currency |
| `PurchaseOrderLine` | Order ID, requirement link, item, qty ordered/received, unit cost, UoM |
| `DeliveryReceipt` | Order line, received qty/date, receiver, note, document/photo links |
| `ScheduleActivity` | Job, title, dates, status, location, dependencies/notes |
| `ScheduleAssignment` | Activity, worker/subcontractor, assigned role, status |
| `Inspection` | Job, quote origin, stage, scheduled/outcome dates, status, attachments |
| `Variation` | Job, number, status, scope, pricing, revision, decision links |
| `Decision` | Job, title, text, date, author, responsible party, optional action |
| `Document` | Logical document ID, category, owner, job/related record, current version |
| `DocumentVersion` | Document ID, version, immutable R2 key, size, MIME, checksum, uploader, time |
| `AuditEvent` | Entity/type/id, operation, actor, timestamp, relevant before/after or snapshots |

**Integrity and history rules:**

- Use foreign keys/unique constraints, indexes for job/date/customer/status queries, parameterised SQL and migrations. Confirm D1 transaction capabilities and design atomic acceptance/revision operations accordingly; do not claim an operation is atomic without testing it.
- `Job.source_quote_id` should be unique where present. An accepted quote may create no more than one job, including under concurrent requests.
- Historical quote, approved variation, purchase order and document versions are immutable or append-only where appropriate; do not overwrite them to apply current price-book values.
- Model money in cents/fixed decimal and quantities with explicit decimal scale. Define cost/tax/rounding rules once; assert them with unit tests.
- Store original vs current schedule, quote and job-cost values separately; never infer one from a mutable lookup without an explicit snapshot.
- Use server-side timestamps for accepted/issued/change events; allow workers' locally captured times to remain separately labelled.
- Do not introduce company/tenant tables in this single-company phase.

## 13. REST API expansion (proposed resource contracts)

Preserve v2 endpoints. Add the following **version-neutral** routes under `/sitelog/api`; use JSON, proper status codes, pagination, authorisation, optimistic concurrency and idempotency where appropriate. Finalise request/response shapes before coding and record them in `docs/API.md`.

| Method(s) | Route | Purpose / permission |
|---|---|---|
| `GET, POST` | `/customers` | List/create clients — office |
| `GET, PATCH` | `/customers/{id}` | Read/change client — office |
| `GET, POST` | `/suppliers` | List/create suppliers — office |
| `GET, PATCH` | `/suppliers/{id}` | Read/change/approve supplier — office |
| `GET, POST` | `/subcontractors` | List/create subcontractors — office |
| `GET, PATCH` | `/subcontractors/{id}` | Read/change/approve subcontractor — office |
| `GET, POST` | `/catalog/items` | Search/create material/service items — office |
| `GET, PATCH` | `/catalog/items/{id}` | Read/change item details — office |
| `GET, POST` | `/catalog/items/{id}/supplier-prices` | Compare/add supplier cost records — office |
| `GET, POST` | `/customers/{id}/rates` | Client-specific sell rates — office |
| `GET, POST` | `/terms/templates` | List/create terms templates — office |
| `GET, PATCH` | `/terms/templates/{id}` | Read/update template draft — office |
| `GET, POST` | `/quotes` | List/create quotes — office |
| `GET, PATCH` | `/quotes/{id}` | Read/change eligible quote draft — office |
| `POST` | `/quotes/{id}/issue` | Issue a specific quote revision — office |
| `POST` | `/quotes/{id}/revise` | New revision of issued quote — office |
| `POST` | `/quotes/{id}/accept` | Accept quote and idempotently create linked job — office |
| `POST` | `/quotes/{id}/decline` | Record declined outcome — office |
| `GET` | `/quotes/{id}/export?format=pdf` | Branded quote download — office |
| `GET` | `/quotes/{id}/export?format=xlsx` | Licensed XLSX export — office |
| `GET, POST` | `/jobs/{id}/materials` | Job material requirements — office; limited worker read if appropriate |
| `GET, POST` | `/purchase-orders` | Search/create purchase orders — office |
| `GET, PATCH` | `/purchase-orders/{id}` | Read/change eligible order — office |
| `POST` | `/purchase-orders/{id}/receipts` | Record material deliveries — office/explicitly authorised site role |
| `GET, POST` | `/schedule` | Office planning; worker GET filtered to assigned jobs |
| `PATCH` | `/schedule/{id}` | Reschedule/change assigned activity — office |
| `GET, POST` | `/jobs/{id}/inspections` | Review/create inspections — office; worker GET authorised |
| `PATCH` | `/inspections/{id}` | Set booking/outcome and notes — office |
| `GET, POST` | `/jobs/{id}/variations` | List/create variations — office |
| `PATCH` | `/variations/{id}` | Change status/revision — office |
| `GET, POST` | `/jobs/{id}/decisions` | List/add decisions — office |
| `GET, POST` | `/jobs/{id}/documents` | List/create document/upload intent — authorised user |
| `POST` | `/documents/{id}/versions` | Add authorised immutable document version |
| `GET` | `/documents/{id}/versions` | List authorised document history |
| `GET` | `/documents/{id}/versions/{n}/download` | Authorised time-limited download |
| `GET` | `/jobs/{id}/cost-summary` | Estimated/actual job costs — office only |
| `GET` | `/reports/job-costs` | Job-level future-pricing analysis — office only |
| `GET` | `/about` | API version, UTC server time, safe deployment metadata |

API style constraints:

- Treat table as the **domain contract**, not a mandate to create every route immediately or a generic dynamic CRUD engine. The final REST contract may use more precise resource names/operations if documented.
- Deny by default. Protect individual job/customer/pricing/document records by session/role server-side. Restrict workers to assigned jobs and only necessary schedule/material information.
- Return consistent error bodies (`code`, `message`, `details` where safe) and validate all IDs, status transitions, money and quantities.
- Use `Idempotency-Key` on quote acceptance, issuing, PO receipts, exports that create records, and offline replay where applicable. Use `If-Match`/revision numbers for conflicting edits; return `409` when appropriate.
- Protect document/media endpoints exactly as required in v2; never grant generic R2 bucket access.
- Do not put OTP implementation, code validation or session creation inside business module routes; call SiteLog's independent auth service.

## 14. Worker and office UI requirements

### 14.1 Global shell

- **Compact header on every page**: SiteLog logo/name, visible `vX.Y.Z`, upload policy/queue icon, Settings/account action.
- Compact current-job selector under header **on worker pages**; no giant “My Day” hero. Office screens can use a concise navigation bar/sidebar rather than duplicating worker quick actions.
- Do not enlarge the mobile header to accommodate version/build details. Show only release version as visible microcopy; details in an accessible tap/click panel.
- All forms: clear labels, large touch targets, sensible defaults, inline validation, no excessive steps, keyboard accessibility. Show NZD, UoM, decimal quantities and clear status badges.

### 14.2 Office pages to add

1. **Jobs:** list/search/filter, edit job, source quote, site location, progress, records, materials/inspections, quote vs actual hours, photos/videos. Use first job photo as optional cover only if appropriate and safely available; never make it a mandatory large header.
2. **Quotes:** list, create/edit, select client, add/reorder line items, persistent quote total, choose approved supplier for material lines, choose/apply terms template, add/remove individual term lines with `X`, review, issue/export, accept -> job.
3. **Price Book:** catalog of items with category, name, UoM, cost/sell separation, supplier price comparison, client rate override.
4. **Suppliers and Subcontractors:** searchable approved list, detail, contact and basic lead-time/trade information.
5. **Materials:** per-job planning and ordering; purchase order list, expected deliveries and receipt progress.
6. **Schedule:** day/week view with labour, subcontractor, deliveries and inspections; conflict/readiness flags.
7. **Inspections:** planned/booked/completed/follow-up; job links and files.
8. **Variations and Decisions:** clear project records, status/history and attachments.
9. **Documents:** categories, secure upload/view/download, version history, links to other records.
10. **Job Cost Summary:** office-only estimated versus actual with explicit cost basis.
11. **Terms:** reusable templates, line-by-line editing, Standard template and versioning.

Avoid presenting all of these as equally prominent navigation tabs in the worker PWA. Office navigation can group related sections into **Jobs**, **Quotes**, **Planning**, **Purchasing**, **Records**, **Settings**.

## 15. Additional offline and privacy requirements

- Keep v2's robust offline recording/synchronisation and visible media upload policy unchanged. Larger office workflows **can require an online connection** initially; don't pretend offline quote issuance, purchase ordering or variation approvals are available if they are not implemented.
- Cache only worker-authorised read-only job schedule/instructions/inspection summaries needed on site. Sensitive quote costing, customer margins, supplier purchase costs and admin reports **must not** be exposed to the worker or cached in their browser.
- Enforce server permissions even for route reads, joins, exports and file access. A hidden office button is not an access control.
- Worker-submitted site photos/videos are for project records; use neutral naming. Private cloud storage with worker-controlled upload timing remains mandatory.
- No automatic continuous GPS tracking, employee productivity ranking or new surveillance telemetry. Opt-in job matching should not create a location trail.
- Record who changed commercial values/approval states for auditability; design logs for dispute resolution, not individual productivity scoring.
- Prior to production use, have commercial documents, contractual notices, records retention, data privacy and legal requirements reviewed by the appropriate business/legal stakeholders.

## 16. Open-source licence and operational requirements

- **Do not adopt a package merely because it is popular or free to download.** Confirm exact package version, licence, transitive dependencies and commercial-use permissions.
- Spreadsheet/PDF libraries and map/geocoding providers are particular licensing risk areas; do not add paid/unknown or noncommercial packages without explicit approval. Document generated spreadsheet security and potential formula injection.
- Prefer native HTML print styles for initial quote-to-PDF where feasible; if browser-generated PDF is used, describe it accurately. Use a reviewed tool for any server-produced PDF/XLSX.
- Use maintained APIs and clearly documented free-tier constraints, storage limits, email delivery pricing and data-processing terms for Cloudflare and any email provider.
- Pin dependency versions and lockfiles; maintain `THIRD_PARTY_LICENSES.md` including attribution and source locations.
- Keep test/stage/production data and media separate, use realistic **synthetic** test data, and require manual production release approval.

## 17. Implementation order — small, reviewable stages

**Do not expand the initial Stage 0–7 SiteLog baseline uncontrollably.** Implement missing functions in the following order, using a working site at every stage. The numbering below is for this addendum and does not replace the v2 baseline stages.

| Addendum phase | Scope | Evidence of completion |
|---|---|---|
| **A0 — Baseline audit** | Inspect repo, identify which v2 stages are finished, note deployment constraints, propose module/API/data migrations and approved package list. No code changes to production. | Updated stage plan + risk/compatibility report. |
| **A1 — Visible release version (P0)** | Version in compact header + login/offline/office; immutable build SHA/time details; API version; safe PWA update notification and tests. | Version shown in page; different build updates correctly without losing offline drafts. |
| **A2 — Customers, suppliers, subcontractors and price book** | Models, admin screens, permissions, supplier costs and client sell overrides. | Different supplier costs and client rates resolved precisely; unapproved supplier blocked. |
| **A3 — Terms and quoting** | Terms templates and editable lines; quote editor with item/UoM/decimal qty/NZD totals, quote lifecycle, export, snapshots. | Issue quote and preserve an immutable revision; terms editing works; quote total remains visible. |
| **A4 — Quote acceptance to job** | Atomic acceptance, source links, material requirements and planned inspection carry-over. | Repeated acceptance never creates duplicates; new job contains required records. |
| **A5 — Scheduling and materials** | Worker/subcontractor planner, job schedule, material orders, supplier approvals, deliveries/readiness. | Office sees missing order before work; workers see authorised upcoming schedule offline. |
| **A6 — Inspections, documents and decisions** | Inspection flow, private versioned R2 documents, categories, job links, decisions register. | Version history preserved; auth restricts files; planned inspection is schedulable. |
| **A7 — Variations and job costing** | Variation status/approval links; estimate vs actual hours/material/subcontractor totals; office reports. | Budget and approved/pending variation values distinct; totals reconcile; no worker rankings. |
| **A8 — Hardening and staged release** | E2E tests, security/licence/privacy checks, backup/restore, staging acceptance, regression on GitHub Pages paths. | Pass documented tests; **no production change without explicit approval**. |

If the repository is still empty, **finish the essential v2 baseline before relying on the larger modules**: basic auth, jobs, worker recording, media, offline sync. Implement A1 early regardless. When a stage depends on another unfinished stage, do the dependency first and explain the sequence; do not fake completed functionality.

### Per-stage discipline

1. Read both specifications and inspect the existing code; don't overwrite existing completed work.
2. Write a **short stage plan**: affected files, schema migrations, API surface, UI screens, licensing decisions, tests and rollback.
3. Implement **one** stage only. Keep components/modules narrowly responsible and avoid UI/business/database logic intermixing.
4. Run tests and licence checks that are actually available. Report exactly what passed, what failed and what could not run (including macOS Big Sur tooling constraints).
5. Update `docs/IMPLEMENTATION_STATUS.md`, `docs/API.md`, `docs/DATA_MODEL.md`, `docs/DECISIONS.md` and release notes as needed.
6. Expose any required manual Cloudflare, GitHub, email or DNS actions as instructions; **never perform destructive infrastructure changes or production deployments silently**.
7. Stop for review. Do not proceed to the next stage automatically.

## 18. End-to-end acceptance scenarios Copilot must test

### Scenario A — Accurate quotation and supplier pricing

- Create item "100 mm drainage pipe" sold by `m`, with a standard sell rate.
- Approved Supplier A and Approved Supplier B have **different** current unit purchase costs and lead times.
- A client has a special **sell** rate for that item.
- Create a quote with decimal quantity; select Supplier B. Verify the quote shows the correct **client sell rate**, while office-only cost calculations use Supplier B's selected purchase cost.
- Edit the price book later. Verify the **issued quote revision remains unchanged**.
- Select Standard terms, edit one line in the quote, remove another using the `X`, and add a job-specific exclusion. Verify the template remains unchanged.

### Scenario B — Quote acceptance without duplicates

- Create and issue a quote with two material lines, labour estimate and one planned inspection.
- Accept it using the office workflow. Confirm **one** job is created, with preserved quote baseline, client/site info, material requirements and one planned inspection.
- Retry the acceptance request with the same idempotency key and a new key after the job exists. Confirm no duplicate job/material/inspection is created.
- A separate direct-charge job can be created without a quote.

### Scenario C — Materials, scheduling and inspections

- Assign two workers and an approved subcontractor to a scheduled job activity.
- Flag an overlapping subcontractor booking, but let an authorised office user resolve/override with reason.
- Schedule work requiring an un-ordered material. Show an office warning; do not place an order automatically.
- Create a PO with an approved supplier, partially receive material and verify outstanding quantity remains.
- Book the planned inspection, link a versioned report document, and update completion status.
- Worker sees only relevant assigned schedule/inspection details, including offline after prior authorised download.

### Scenario D — Daily worker experience remains simple

- On a phone, the compact header shows **SiteLog vX.Y.Z** and the upload policy icon/queue count. The current job selector occupies only one compact row.
- Worker may decline GPS and still select a job by name/address; undeveloped sites work with coordinates.
- Worker records time using suggested hours, adds a note and takes multiple photos or a short video while offline.
- App compresses photos locally and stores the record before claiming "Saved on Device".
- Choose Wi-Fi-only, Mobile-only or Both. Upload policy is respected, including unknown connection type and manual override. Notes/time sync independently of media.
- Close/reopen the PWA; pending data survives. New app version is offered without discarding local records.

### Scenario E — Project record and commercial accuracy

- Change a timesheet; immutable old and new revisions are visible to authorised office users.
- Add a variation and a decision; **pending** variation does not increase approved variation value in revised budget.
- Add a revised document; older document version is retained and remains accessible to authorised staff.
- Job-cost report reconciles actual time, material receipts/cost basis and authorised estimates. Worker cannot see cost, margin, client rates, supplier pricing or another worker's private information.

### Scenario F — Release/version/hosting

- Preview build displays its correct release version, short commit ID and environment; backend version is separately accessible from `/sitelog/api/about`.
- After a new frontend deployment, installed app can offer update/reload; no unsynced records are lost. While offline, old version remains clearly identified as old **installed** build.
- Existing `https://tibbotts.com/` and `/family/` are unaffected by SiteLog routing.
- No actual production DNS or deployments occur without explicit approval.

## 19. Source links to check while implementing

- Cloudflare Workers path routes: https://developers.cloudflare.com/workers/configuration/routing/routes/
- Serving static assets from `/sitelog/`: https://developers.cloudflare.com/workers/static-assets/routing/advanced/serving-a-subdirectory/ (requires verifying Wrangler version; current docs describe `assets.base_path`)
- Workers static assets and Worker-first API handling: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- Cloudflare R2 objects: https://developers.cloudflare.com/r2/objects/
- Browser PWA Service Worker lifecycle: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update
- Web Storage persistence: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
- Open Source Initiative commercial use: https://opensource.org/faq
- New Zealand Construction Contracts Act 2002 (official): https://www.legislation.govt.nz/act/public/2002/46/en/latest/

## 20. Copy/paste instruction to start Copilot

```text
Read the existing SiteLog v2 implementation specification AND
SiteLog_Copilot_Expansion_Instructions_v3.md in full.

This v3 document is an additive expansion, not a replacement. The site must
remain at https://tibbotts.com/sitelog/ and the main GitHub Pages site must
remain unchanged.

The immediate priorities are:
1. Inspect the existing repository and report which v2 requirements are
   implemented versus missing.
2. Implement an always-visible SiteLog version label in the compact header,
   including the login/offline/office screens, immutable Git build details,
   and a safe PWA update process that preserves unsynchronised records.
3. Plan the missing office modules: clients, quotes, reusable editable terms,
   material price book with supplier costs and client sell rates, purchase
   orders, scheduling, subcontractors, inspections, variations, decisions,
   documents with version history and job costing.
4. Preserve small worker-facing screens, client-side compressed media,
   configurable Wi-Fi/Mobile/Both uploads, offline queues, security, privacy,
   and commercially permitted open-source licence rules.

Start with addendum Phase A0 (baseline audit) only and present the plan. If the
baseline supports it, propose Phase A1 (visible app version) as the next small
implementation. Do not deploy to production, change DNS, add unverified
packages or implement all modules in one step. Report tests and blockers
accurately and stop for my review after each stage.
```

---

**Success criterion:** SiteLog remains a fast, low-admin field recording tool while its office interface becomes a coherent quote-to-job, scheduling, materials and project recordkeeping system. Workers can see **which version of the app they are using** without opening a developer tool or settings page.
