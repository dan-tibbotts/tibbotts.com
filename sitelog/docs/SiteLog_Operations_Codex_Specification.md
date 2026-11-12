# SiteLog — Operations Expansion Specification for Codex

Version 1.0 · 13 November 2026

## 1. Purpose and authority

Extend the user's **existing SiteLog application** with the drainage-contractor operations functionality specified in the Flo-rite project conversation. Keep the product name **SiteLog**, its existing site records and its simple field-worker experience. Flo-rite is the operating business/use case, not a replacement product name. Company branding on quotes must be configurable independently of the SiteLog name.

This is an implementation brief, not a description of verified repository functionality. The existing SiteLog source has **not** been inspected for this document. Inspect it first. The Flo-rite prototype demonstrates some workflows but is not the target architecture or a complete production implementation. In particular, the recent timesheet changes were under development, not confirmed published. Implement and verify the requirements below against the actual SiteLog repository.

Source baseline: `SiteLog_Copilot_Implementation_Instructions_v2.md` (read in preparing this brief; its internal heading says version 1.0). Preserve that brief's authentication, permissions, offline operation, media handling, licensing and deployment constraints. This specification expands its functional scope: quoting, material prices, orders, inspections, scheduling, variations, decisions and contract administration are now required stages rather than unspecified future possibilities. Existing working architecture should be extended, not recreated just to match illustrative names in this document.

**Conflict order:** current user instructions and repository AGENTS.md rules; this expansion's functional rules; baseline SiteLog brief for retained technical requirements; existing conventions. Explain concrete conflicts before making irreversible decisions. Do not replace a sound implementation because it differs cosmetically from a prototype.

### Non-negotiable constraints

- Product name: **SiteLog**. Canonical prefix: **`https://tibbotts.com/sitelog/`**. Never substitute `/jobdiary/`.
- Single company initially; no speculative multi-tenancy or company switcher.
- Preserve unrelated `tibbotts.com` routes, including the homepage and `/family/`.
- Preserve separate frontend, business REST API and SiteLog-specific authentication responsibilities/deployments. Keep existing invite-only email-code authentication and private auth-service integration if already implemented.
- Keep development, staging and production data, credentials and storage separate. **Production deployment remains a manual action requiring explicit approval.** Committing or merging must not automatically publish production.
- Do not alter DNS, nameservers, email settings or production routing as part of feature implementation.
- Do not discard existing jobs, media, time entries, accounts, assignments or offline queues. Use additive, reversible migrations and documented backfills.
- Prefer standard platform APIs and current project dependencies. New packages/assets require verified commercial-use-compatible licences, recorded notices and transitive-dependency review. No unknown, noncommercial-only or restrictive dependency added silently.
- Keep supportive language: “site photos”, “daily record”, “site progress”, “time on this job”. No worker rankings, continuous GPS tracking or surveillance dashboards.

## 2. Product experience

### Field workers

Keep the compact mobile SiteLog screen: current job and readable site address; **Record Time**, **Add Photos**, **Add Video**, **Add Note**; today's records; compact upload/sync status. Use authenticated worker identity automatically. Do not make workers select their name each time or navigate office menus to log time.

Workers see assigned jobs and authorised site instructions/documents. Commercial prices, profit margins, claims, supplier administration and contract configuration belong in the office interface and must not be returned by worker API responses without permission.

Design for narrow iPhone screens, touch operation and weak connectivity. Persistent actions must remain usable above the keyboard and safe-area inset. No horizontal page scrolling, tiny delete targets or placeholder-only labels. Keep optional detail collapsed. Save local drafts before displaying success.

### Office interface

Provide discoverable navigation for Overview, Enquiries, Quotes, Jobs, Schedule, People & Companies, Material Price Book, Materials & Orders, Council Inspections, Documents & Media, Timesheets, Decisions, Variations, Terms Templates and Contract/Payment Controls. Job detail consolidates relevant records; users should not repeatedly re-enter the job association.

An overview identifies actions requiring attention: unaccepted quotes, unapproved suppliers, items to order, late deliveries, unconfirmed contractors, inspections to book, unresolved decisions, proposed variations and reviewed payment deadlines. Keep worker-facing screens free of this administrative density.

## 3. Lifecycle: potential work is not a job

| Record | Purpose | Suggested states |
|---|---|---|
| Enquiry | Potential work and scoping | New, Scoping, Quoted, Closed |
| Quote | Priced offer; job link is optional | Draft, Issued, Accepted, Declined, Expired, Superseded |
| Job | Authorised work only | Accepted, Scheduled, In progress, On hold, Completed, Cancelled |
| Charge-up authorisation | Agreed scope and charging basis without an accepted fixed quote | Draft, Recorded |

1. Create an enquiry or standalone quote with client, site address/location and scope, without creating a job.
2. An office user records acceptance of a specific issued quote revision, including accepted-by person, date, acceptance method/reference and supporting attachment where available.
3. Alternatively record charge-up authorisation: client, site, agreed scope, rates/pricing basis, terms, authorising person/date and supporting record.
4. Only successful acceptance/authorisation creates a job. Scheduling potential work must not silently convert it into an accepted job.
5. Quote acceptance must atomically create the job, acceptance snapshot, material requirements and inspection requirements. Retried or concurrent requests must return the same result, with no duplicate job or requirements.
6. Preserve the accepted revision, terms and prices. Later catalogue/template edits must never mutate it. Changes to accepted scope use a variation or explicit additional agreement.
7. New quotes for additional work on an existing job may link to it; their acceptance creates approved additional scope/variation, **not a second job by accident**. Make this acceptance mode explicit.
8. Import existing SiteLog jobs as historical authorised jobs with their original IDs. If acceptance detail is missing, mark “Acceptance details need review”; do not invent approvals or remove workers' access to existing records. Apply new-job gates prospectively and document the migration policy.

## 4. Quoting

### Quote editor

Use clear clickable steps/tabs: **Items & Planning → Terms & Conditions → Review**. Allow navigation back and forth without losing entries. Do not require all fields to be valid merely to inspect another step; validate at save/issue boundaries and focus the failing field.

Header: quote number, revision, client, contact, site address, scope, issue/expiry dates, pricing basis, optional enquiry/job link. Date and worker data must never be confused with quote acceptance.

Each quote line supports:

- Client-facing description.
- Decimal quantity, visibly labelled and accepting values such as `2.5`.
- Explicit unit of measure: each, m, m², m³, hour, day, tonne, load, sum, or validated custom unit.
- Selling unit rate, line amount and optional lead-time text.
- Internal line type (material, labour, subcontract, other), product/catalogue link, supplier, purchase unit cost, supplier SKU and price date where relevant.
- Internal estimated labour hours where useful for later job-level estimate-versus-actual analysis.

Use **NZD** explicitly on all currency displays/exports. Show whether amounts exclude/include GST. Quantity and rate are distinct fields. Calculate line totals using defined decimal arithmetic and round monetary totals consistently to cents; do not accumulate binary floating-point errors. Store rate precision separately from display precision if necessary. Snapshot the tax rate on issued revisions; GST changes must not rewrite history.

Keep subtotal, GST and grand total persistently visible at the bottom of the quote editor, including on mobile and on the terms step. Keep the last field reachable above the fixed summary. The user can override a suggested sell rate; show that it is customised without overwriting it when another supplier is selected.

### Client document versus internal data

Generate a branded, stable client quote with descriptions, quantity/UOM, selling prices, totals, lead times, scope, terms and acceptance instructions. A collapsed “item and price” presentation may be offered; internal supplier choices, buy costs, margin and procurement notes must never leak into client documents, client API projections or downloadable metadata.

Provide printable/PDF output and a spreadsheet-compatible export. Preserve working export facilities; CSV is acceptable for the first spreadsheet export if no XLSX implementation exists. Clearly label CSV as CSV; branded XLSX formatting is an optional later enhancement, not a reason to introduce an unreviewed package. Issued documents must be stored against their quote revision so that what was sent remains reproducible.

Issuing/exporting a quote is not client acceptance. An ordinary quote or invoice must not be labelled a statutory payment claim automatically.

## 5. Terms and conditions

Provide a top-level **Terms Templates** office page to create, view, duplicate, edit, archive and configure templates. A template has a name, ordered term text rows, revision, active/default status and review metadata. **Standard** is the default selection for new quotes.

- In the quote terms step, each term is a plain editable text field/auto-growing text area with an **× button at the end** to remove that row. No separate title/body editor for each clause.
- Support inline edits, one-tap removal, adding custom terms and accessible reordering.
- The top Terms & Conditions step is directly clickable.
- Selecting a template actually loads its terms. If quote-specific edits would be replaced, explain the replacement and let the user confirm or cancel. Provide an explicit “Reload template” action so selecting the already-selected Standard template is not a no-op.
- New quotes copy template content; quotes hold independent ordered term snapshots. Editing/removing a term on one quote never changes the template or another quote.
- Editing a template affects future applications, not existing issued/accepted quotes. Accepted terms are immutable.
- If Standard is not configured, say so and link to configuration. Do not silently issue an empty or invented legal template.
- Validate blank rows, duplicate template names and obviously duplicated clauses. Optional incompatible-term groups can flag known conflicts; do not claim automatic detection of all legal contradictions.
- Contractual wording comes from the business's reviewed templates. Do not generate production legal terms and label them “approved”.

## 6. People, suppliers and material price book

Maintain clients, staff, suppliers and subcontractors with stable IDs, contact information and applicable roles. A company may supply materials and subcontract labour; avoid duplicating its identity unnecessarily.

### Supplier approval

Supplier state: Pending, Approved, Suspended, Archived. Store approver, approval date and optional notes/documents. Only **Approved** suppliers are selectable for new quote procurement lines and new orders. Enforce this on the server, including a fresh check at quote acceptance/order creation. Historical references remain visible if a supplier is suspended; unresolved requirements must be reassigned explicitly, never silently substituted.

### Material price book

One material/product has code, description, category, selling UOM, default selling unit price in NZD excluding GST, active/archive status and revision. It has multiple supplier-price records containing supplier ID, supplier SKU, purchase UOM, purchase unit cost, conversion to selling UOM where relevant, lead time and price-as-at date. Optional validity/expiry date identifies stale prices.

Default commercial model: **one standard selling price per material; purchase cost varies by supplier**. Do not make selling price automatically equal to cost plus a fixed markup. Explicit client-specific selling-price overrides, if present or implemented, take precedence over standard prices and have validity/review metadata. A manual quote rate takes precedence over both. Keep the selected rate's source visible internally.

Display comparable purchase costs, selling price, gross profit per selling unit and gross margin percentage. Margin = `(sell − buy) / sell × 100`; handle zero selling price without division errors. Markup is a different measure and must not be labelled margin.

Do not compare “one pack” to “one metre” without conversion. Require an explicit conversion or matching units; block incomplete conversion rather than guessing. Archive referenced materials/prices instead of deleting history. Record changes with editor and date.

### Quote integration

Selecting a material copies description, UOM and applicable sell rate. Selecting an approved supplier copies its buy cost, SKU, lead time, price date and conversion snapshot. Supplier changes update procurement values, preserving an explicitly overridden sell rate. Let the user deliberately refresh from the price book; never silently refresh issued/accepted prices. If a supplier has no recorded cost, show “Not priced”, not a misleading zero.

## 7. Procurement and job readiness

At quote stage mark material requirements and choose approved suppliers upfront. A line may have one requirement initially; model requirements separately enough to support a client-facing lump-sum item with multiple internal materials without exposing a bill of materials to the client.

Acceptance creates **To order** material requirements with quantity/UOM, chosen supplier, purchase cost snapshot, originating quote revision/line, lead time, required-by date if known and job. Do not invent a delivery date from vague text. Total expected purchase cost comes from buy cost, not the client sell rate.

Office workflow: To order → Ordered → Part delivered → Delivered; also Cancelled where necessary. Record order reference, ordered date, expected delivery, received quantities/dates, delivery notes and responsible person. Group requirements into supplier purchase orders when supported. Keep requirement-to-order links and prevent duplicate ordering. Subsequent partial deliveries must not mark an entire requirement complete prematurely.

Creating requirements does **not** send an order or spend money. Sending an order requires an explicit office action and a configured integration, otherwise generate a document for manual issue. Show the distinction between prepared, sent and supplier-confirmed.

Job readiness should show materials ordered/delivery due, contractor bookings confirmed, required inspections planned and contract checks outstanding. Checks are relative to the stage of work: some products/inspections are needed later, not before any work starts. Allow documented admin exceptions for operational readiness where appropriate; never bypass legal or acceptance rules by silently changing a badge.

## 8. Council inspections and scheduling

### Inspection planning

Quote inspection requirements include type/name, council/authority if known, consent/reference, required work stage, booking lead time if known, prerequisite tasks, responsible person and internal notes. An exact appointment is optional at quote stage. Internal planning remains separate from client-visible pricing or exclusions.

Acceptance creates **To book** inspection records linked to the source revision. Support To book, Requested, Booked, Passed, Failed, Reinspection required, Cancelled. Record appointment, inspector/contact, booking reference, outcomes and report/document versions. Failed inspections create visible corrective actions and reinspection links; do not erase earlier outcomes. Relevant work stages remain flagged until required inspection outcomes are recorded.

### Schedule

Day/week calendar with a practical mobile agenda. Schedule jobs, crews, subcontractors, delivery events and inspections. Use New Zealand local timezone and display it. Show overlapping assignments, unavailable contractors, late materials and unconfirmed appointments. Rescheduling a job identifies dependent bookings/orders that need review; it must not claim to have rescheduled external parties automatically.

Contractor bookings: Proposed, Requested, Confirmed, Completed, Cancelled; job, company/person, dates/times, scope, contact, reference and confirmation details. A calendar entry is an internal plan until confirmation is recorded. External council bookings, supplier orders and contractor messages are manual unless an explicit authorised integration exists.

## 9. Streamlined worker time entry

### Standard hours

Store a worker's usual schedule centrally: working days, start, finish, unpaid break minutes, timezone and effective-from date. Support per-weekday values where schedules differ; a copy-to-weekdays shortcut avoids repetitive setup. Office admins configure defaults; worker self-service is subject to existing permissions. Never use Daniel's personal working hours as company defaults.

Use authenticated identity and current job automatically; remember the explicit current job per user/device. Default work date to today in Pacific/Auckland. Show a short summary with editable Start, Finish and Unpaid break. Calculate worked minutes and displayed hours; title, narrative and activity code are not mandatory. One clear save action. Preserve the current-job selection when reopening the form.

### Same-day calculation rules

1. With no entries, suggest that date's effective usual start/finish/break. Label suggestions; workers confirm actual work.
2. With timed entries, calculate remaining intervals within the usual shift for that worker across **all jobs**, excluding the record being edited.
3. Prefer the next available interval after the latest completed recorded interval if it lies within the shift; if only earlier/intermediate gaps remain, show them as explicit choices. Never silently extend a previous entry.
4. A new entry's start may equal another entry's finish. For a gap before a later entry, its finish must not exceed that entry's start. Prevent overlap even across different jobs.
5. Deduct unpaid breaks once. Suggest only the unallocated portion of the day's usual break; do not repeat a full lunch deduction for every job. The worker can correct when and whether the break occurred. Never infer a gap between jobs is automatically an unpaid break.
6. Fully covered shift: show “Usual hours already recorded”; extra time requires explicit actual times. Non-working day or missing defaults: ask for actual times without inventing a normal shift.
7. Legacy hours-only entries: preserve them, show the amount and require actual times/review before auto-calculating a remaining interval. Do not guess their position in the day.
8. Changing worker (admin only), date or schedule context recalculates suggestions only with clear handling of unsaved manual edits. Editing an existing record initially preserves its saved times.
9. Store integer worked minutes, work date, timezone and enough time information to resolve DST. Server recomputes totals. Reject invalid dates, negative/excessive breaks and overlapping intervals. Cross-midnight work must be deliberately supported with dated endpoints or explicitly split across dates; never infer a 24-hour shift from a mistaken end time.
10. Enforce overlap and revision checks atomically server-side so two offline/concurrent submissions cannot both pass. Return a recoverable conflict, preserve the local draft and offer correction.

Example: normal shift 07:30–16:00 with 30-minute unpaid break. Job A already records 07:30–11:00 with no break. Job B suggests 11:00–16:00 with 30 minutes remaining break: A = 210 worked minutes, B = 270, daily total = 480. If A already contains the 30-minute break, B suggests zero break. If a later job is already 12:00–16:00, an earlier gap can be recorded as 07:30–12:00 without overlapping it.

### Nearby job suggestion

Use optional saved site coordinates and readable site addresses. “Find my job”/“Find nearby jobs” requests one-time location permission and ranks **authorised assigned** sites using distance, accuracy and configured radius; schedule and recent explicit choice can assist ranking. Calculate on device where practical. Do not transmit/store worker GPS by default.

Suggest the closest credible site and its address with an obvious confirm/change action. Do not silently change the current job due to GPS, especially for adjacent sites, old records or an already-started draft. Poor accuracy, denied permission, no nearby match or absent coordinates must retain quick name/address search and manual selection. Office can enter coordinates or set a site location once while on site. Postal address lookup/map pin is optional and must use a reviewed provider; an address string alone is not a usable GPS coordinate.

### Worker correction and offline operation

Autosave drafts locally. Clearly distinguish Saved on Device, Queued, Synced, Conflict and Needs attention. Workers correct their own eligible entries; approved/locked entries use an explicit office correction process. Preserve all server revisions and actor timestamps. Never use a worker dropdown as a substitute for authentication/authorisation.

## 10. Daily records, photos, videos and documents

Preserve SiteLog's existing notes, photos, videos, offline queue and upload-policy behaviour. Record actual versus estimated labour hours at **job level** for estimating improvements, not worker performance rankings.

### Job header and photo workflow

If a job has a photo, use an authorised photo as its header background with a readable overlay. Initially choose the first successfully available job photo; allow an office-selected cover. Use a thumbnail/resized asset, not an entire original file. Use a plain branded fallback for no photo, missing access or load failure. Refresh/revoke private access appropriately.

Offer gallery multi-select and a repeat-capture flow that retains a session's selected photos, previews/count and per-photo removal before saving/uploading. Workers must not re-enter job/date/description for each image. Browser camera pickers do not universally permit burst capture: use supported camera features with fallback and honest labels. Preserve individual upload progress and retry only failed items.

Preserve photo orientation correction, best-effort resize/compression, thumbnails, video limits/fallback, capture/import metadata and private R2 access. Keep Wi-Fi-only, mobile-only and any-network policies and the visible queue count. When network type cannot be determined reliably, do not silently upload restricted media; offer an explicit “Upload now using this connection” override. Notes/time may sync independently of queued media.

### Versioned documents

Logical document ID plus immutable versions: filename, MIME, size, checksum, storage reference, version number, uploader, timestamp, change note and Current/Superseded status. A new upload must not overwrite earlier bytes. Show current version, history and authorised downloads. Categories include plans, consent, council inspection, contract, quote, variation, delivery note, completion and general; allow office-managed categories.

Associate documents with enquiry/quote before job acceptance and with jobs, inspections, orders, decisions or variations as appropriate. Preserve associations through conversion. Distinguish internal, worker-visible and client-issued documents; enforce access in the API/storage layer. Exported/accepted records reference exact versions, not mutable “latest” links.

## 11. Decisions and variations

### Decisions

Record a concise decision/question, job, date, person responsible, who decided, rationale, alternatives where useful, impact, follow-up owner/due date and linked notes/photos/document versions. States Open, Decided, Superseded. Superseding links to the earlier record; history remains accessible. A decision about location or method must not silently become authority for extra cost.

### Variations

Track scope change, reason, requester, source decision/document, detailed pricing and cost impact, time/programme impact, exclusions, approval requirements and supporting attachments. States Draft/Proposed, Submitted, Approved, Declined, Withdrawn, Superseded. Require an authorised approval record before treating additional price as agreed. Keep emergency/instructed work explicit and awaiting commercial resolution; do not forge client approval.

Approved variations create required additional material/inspection/schedule tasks idempotently. Keep original accepted contract value separate from approved variation value and revised agreed value. Show pending variation exposure separately; do not include unapproved variations in the agreed total. Never edit the original accepted quote to conceal a change.

## 12. Contract and payment controls

The correct statute name is the **Construction Contracts Act 2002 (NZ)**. Build consistent recordkeeping, validation and review gates; **do not promise that software guarantees legal compliance**. These are office functions. Retain simple field-worker language even where office records contain acceptance or service documentation.

### Contract setup and starting work

Record contracting parties, relationship (direct homeowner, commercial client, subcontract to main contractor), scope, site, acceptance, price/rates, contract/terms version, payment terms, addresses for notices, consent responsibilities, start/completion expectations and reviewer/date. Maintain applicability and outstanding-action flags.

Residential consumer-protection checks are a separate Building Act requirement, not simply “CCA checks”. For applicable direct residential contracts, the current MBIE guidance uses NZD 30,000 including GST for written-contract requirements; disclosure/checklist requirements also apply on request. Track actual delivery/signing dates and document versions. Missing pre-contract delivery must be flagged for review; do not fix history by backdating. Revalidate applicability and thresholds against official sources at implementation/release.

### Claims and schedules

- Keep quotes, ordinary invoices, statutory payment claims and payment schedules as distinct records/types.
- Claims: direction, payer/payee, contract/job, claim number, work/period, calculation, amount, GST treatment, due date, statutory statement, associated prescribed notice, review and exact issued/received documents.
- Schedules: source claim, scheduled amount (including zero), calculation, reasons for differences/withholding where applicable, response deadline, reviewer and exact served document.
- Store actual service/receipt date, method, recipient/address and supporting record. A document download is not proof that it was served. Lock the issued/served snapshot; corrections create a linked later record.
- Configure deadlines from the actual contract and applicable legislation. Store calculation basis, calendar/version, service-date assumptions and reviewer. Use legally applicable working-day rules, including exclusions/holidays; never hardcode every due date as “20 calendar days”. When rules are unresolved, require a reviewed manual date and show “Needs review”.
- Track retentions as an applicability/review item. A retention checkbox is not a trust/accounting compliance system. Do not imply substantive retention obligations are met without implementing and reviewing them separately.
- Do not automate debt escalation, suspension of work or legal notices merely because a dashboard date is overdue.

Official reference anchors verified while preparing this document; Codex must recheck current primary sources before implementing legal rules:

1. [Construction Contracts Act 2002](https://www.legislation.govt.nz/act/public/2002/46/en/latest/) — primary legislation, including payment claims/schedules.
2. [MBIE: Other Construction Contracts Act requirements](https://www.building.govt.nz/projects-and-consents/why-contracts-are-valuable/construction-contracts-act-2002/other-requirements) — payment framework and Form 1 guidance.
3. [MBIE: prescribed Form 1](https://www.building.govt.nz/assets/Uploads/projects-and-consents/forms/Form-1-Information-that-must-accompany-all-payment-claims.pdf) — retain the official notice with applicable claims; do not paraphrase it as a replacement.
4. [MBIE: consumer disclosure and checklist](https://www.building.govt.nz/projects-and-consents/why-contracts-are-valuable/consumer-protection-disclosure-and-checklist) — threshold/request triggers and direct contracting applicability.
5. [MBIE: before building work starts](https://www.building.govt.nz/getting-started/your-rights-and-obligations/homeowner-rights-and-obligations/know-your-rights-consumers/before-building-work-starts) — residential written contract and pre-contract information guidance.

Legal rules, approved term content and production claim templates require a competent business/legal reviewer before live use. Codex should implement review controls without inventing approved content.

## 13. Data, services and REST boundaries

Adapt to the existing schema; do not create a generic unvalidated JSON bucket merely to imitate the prototype. Keep stable IDs and explicit relationships, constraints/indexes and revision history. The following are logical responsibilities, not mandatory class names or one-table-per-item instructions.

| Responsibility | Main records / behaviour |
|---|---|
| Identity/access | Existing User, Invite, Session; workers versus office permissions |
| Contacts | Client, Supplier approval, Subcontractor, staff profile linked to User |
| Workforce | Effective-dated WorkSchedule, JobAssignment, TimesheetEntry/Revision |
| Sales | Enquiry, Quote/Revision/Line, client rate overrides, acceptance snapshot |
| Terms | Template/Revision, ordered quote-specific term snapshots |
| Catalogue | Material, supplier purchase prices, UOM conversion, price history |
| Job conversion | Atomic accepted job creation and linked requirements |
| Procurement | MaterialRequirement, PurchaseOrder/Line, Delivery |
| Planning | Booking, InspectionRequirement, Inspection/Outcome, dependencies |
| Work records | Existing notes, media, DailyRecord; cover-photo reference |
| Documents | Document, DocumentVersion, category and visibility |
| Change control | Decision, Variation/Revision/Approval |
| Contract administration | ContractReview, Claim, Schedule, ServiceRecord, deadline basis |
| Reliability | AuditEvent, idempotency receipt, sync operation/conflict |

Prefer focused services: QuotePricing calculates decimal totals and rate precedence; QuoteAcceptance coordinates atomic conversion; MaterialPricing resolves supplier/UOM snapshots; TimeSuggestion finds candidate gaps; TimesheetService validates and persists revisions; DocumentService preserves immutable file versions; ReadinessService evaluates stage prerequisites. Reuse existing equivalents. Keep HTTP parsing, business rules and storage access separate; avoid speculative patterns or unnecessary generics.

Extend existing `/sitelog/api/` routes for these resources, using consistent errors, pagination, filters, idempotency and expected revision/version. Typical command endpoints include quote issue, quote acceptance, charge-up authorisation, supplier approval, variation approval and document-version upload. These commands must enforce state transitions, not simply accept arbitrary client-supplied status changes.

Return role-specific DTOs. Client quote rendering uses an explicit allowed-field projection. Do not send internal costs to the browser and merely hide them with CSS. Worker identity comes from validated sessions; office “record on behalf of” retains both worker and actual editor. All files remain private and authorisation is rechecked on access.

Every mutation needs server validation, permissions, timestamps, revision handling and audit history proportionate to the record. Cross-record business commands are transactional; retries cannot duplicate side effects. Immutable snapshots reference exact source versions. Decimal money and integer worked minutes are server-authoritative.

## 14. Offline, security and migration requirements

Retain the original SiteLog offline-first contract: public app shell only in service-worker CacheStorage; user-scoped authorised records/drafts/media in IndexedDB; persistent outbox; idempotent replay; safe logout handling of unsynchronised work; no unconfirmed server-success claims. The service worker remains scoped to `/sitelog/`.

Worker time, notes and media creation must remain usable offline after initial login/download. Office commercial drafts may be local if existing facilities support it; acceptance, supplier approval, quote issue, purchase-order issue and legal service recording require online validation. Do not introduce a second conflicting sync engine.

Migrations must preserve baseline jobs, timesheets, documents and media links. Introduce missing optional data as Unknown/Needs review, never fabricated acceptance dates, supplier approval, buy costs or coordinates. Keep old hours-only entries readable. Migrate quote amounts/terms into version snapshots without changing values. Back up before staging a migration; verify counts, representative values and file access. Document restore/recovery rather than assuming every destructive database migration can be reversed automatically.

Protect against CSRF, unauthorised object access, upload/path abuse, stale concurrent edits, formula injection in spreadsheets and secret leakage. Validate MIME/size and use safe content disposition. Do not add unrequested public customer portals, payment processing, payroll, Xero integrations, continuous geolocation or MCP services. Preserve a future MCP adapter boundary but do not build it as part of this expansion.

## 15. Acceptance tests

Each requirement must be demonstrable in staging with synthetic data. Add automated tests at the business-rule and API boundaries, plus real-device manual checks where browser support matters.

| ID | Scenario and pass condition |
|---|---|
| SL-01 | Existing SiteLog login, assigned-job access, media and offline queue work after migration; unrelated site routes unchanged. |
| SL-02 | Create and issue a quote without a job. No job exists until recorded acceptance/charge-up authorisation. |
| SL-03 | Accept the same revision twice/concurrently: one job and one set of requirements; no partial conversion. |
| SL-04 | Quote 2.5 m at NZD 20/m gives NZD 50 excl GST and, with 15% snapshot GST, NZD 57.50 incl GST. Total remains visible on a narrow phone. |
| SL-05 | Terms tab works immediately; Standard loads actual configured rows; edits/removals persist; reload prompts before replacement; another quote/template is unaffected. |
| SL-06 | Material with supplier A cost NZD 10/m and B cost NZD 12/m retains sell NZD 20/m. B on 2.5 m gives expected order cost NZD 30, not NZD 50. |
| SL-07 | Suspended supplier is excluded from new selections and rejected by acceptance/order API; historical records remain readable. |
| SL-08 | Update a catalogue price/template after issue/acceptance: saved quote and client document do not change. Manual and client-specific rate precedence is correct. |
| SL-09 | Client quote exports/API never contain supplier buy costs, margin or internal planning notes. |
| SL-10 | Acceptance creates To order and To book requirements. No external order/booking is reported as sent/confirmed. |
| SL-11 | Partial delivery and failed inspection leave readiness outstanding; rescheduling flags dependent records. |
| SL-12 | Worker opens Record Time: correct authenticated worker, current job and NZ date; usual hours populate, notes optional. |
| SL-13 | Split-day example in section 9 totals 480 minutes; break allocated once; earlier gaps and fully covered days handled. |
| SL-14 | Overlap rejected across jobs, including concurrent/offline submissions; adjacent intervals allowed; own-record correction excludes itself. |
| SL-15 | Worker cannot change another worker's time, approve own locked entries or retrieve commercial data. Corrections retain history. |
| SL-16 | Denied/poor GPS, adjacent sites and missing coordinates retain manual choice; no continuous location record; unauthorised sites never appear. |
| SL-17 | Batch photos/repeated camera capture retain selected files; failed items retry individually; job cover uses an authorised thumbnail with fallback. |
| SL-18 | Upload v2 of a plan: v1 still downloadable by authorised users; issued quote/inspection references remain on the correct version. |
| SL-19 | Approved variation updates agreed totals and requirements once; proposed variation and decision alone do not change contract value. |
| SL-20 | Payment claim/schedule gates require applicable fields and exact reviewed attachments; service date is explicit; unresolved deadline rules cannot silently produce a definitive due date. |
| SL-21 | Existing hours-only entries, unconfigured Standard, unknown costs and missing historical acceptance display honest review states. |
| SL-22 | Offline drafts survive close/reopen, sync once, preserve conflicts and obey media-network preference. Test iOS Safari/installed PWA and Android where available. |
| SL-23 | DST/date boundaries, invalid dates, unpaid-break limits, UOM conversions, decimal rounding and zero sell-price margin have focused tests. |
| SL-24 | Dev/staging/prod secrets and data are distinct; deployment to production requires manual approval; migration recovery and licence checks documented. |

## 16. Implementation sequence for Codex

Do not attempt a wholesale replacement. Work in vertical slices with working persistence, permissions, tests and UI together. Keep all required stages on the checklist; a stage being later does not make it optional.

0. **Repository discovery and gap analysis.** Read AGENTS.md, baseline brief, this specification, migrations, auth, API, offline code and deployment configuration. Produce `docs/SITELOG_GAP_ANALYSIS.md`, mapping sections and SL acceptance IDs to existing/missing/partial functionality and actual file paths. Record any blocking decisions. Preserve local uncommitted work.
1. **Low-effort time and job location.** Central usual-hours data, gap suggestions, secure identity defaults, nearby/manual selection, revised worker form, offline corrections and atomic overlaps. Keep existing worker functionality intact.
2. **Commercial foundations.** Contacts and approvals, material catalogue/supplier prices, client rate precedence and terms-template management.
3. **Quote flow.** Standalone quotes, decimal UOM/rates, persistent totals, internal plans, terms snapshots and safe client output.
4. **Authorisation and conversion.** Quote/charge-up acceptance, immutable snapshots, idempotent job/material/inspection generation and legacy migration policy.
5. **Delivery planning.** Orders/receipts, inspections/results, contractor bookings, agenda/calendar and readiness dependencies.
6. **Job record completion.** Versioned/categorised documents, photo cover and batch improvements, decisions and variations. Reuse existing media/notes features.
7. **Contract/payment administration.** Reviewed rule configuration, applicability gates, claims/schedules and immutable service records. Keep unreviewed legal automation disabled and visibly incomplete.
8. **Hardening and staging.** End-to-end permissions, offline/concurrency, migrations, exports, devices, accessibility, licences, backups and deployment runbook. Prepare production release for explicit approval.

For each stage, report implemented behaviour, tests actually run, limitations and remaining SL IDs. Update `docs/IMPLEMENTATION_STATUS.md`. Do not claim passing tests or device verification without running them. Commit coherent work according to repository rules. Do not fabricate provider credentials, approved legal wording or real company data. If external setup blocks one task, continue independent authorised tasks and report the specific blocker.

### Definition of completion

All required stages and SL tests are implemented or explicitly documented as blocked for a concrete external reason. The office can move from enquiry through quote/terms to accepted job, planned orders/inspections, work records and approved changes. A worker can log time and capture site progress quickly, including offline. Accepted commercial records remain stable, authorisation is enforced server-side, and staged deployment is reviewable without affecting production.

## 17. Copy/paste prompt for Codex in VS Code

Place this file in your repository as `docs/SiteLog_Operations_Codex_Specification.md`, then paste:

```text
Read docs/SiteLog_Operations_Codex_Specification.md in full, all applicable AGENTS.md files, and the existing SiteLog documentation. Extend my existing SiteLog application; do not replace it or rename it to Flo-rite. Keep /sitelog/, current authentication, assigned-job permissions, offline/media features and unrelated website routes working.

Start with Stage 0: inspect the actual code and schema, map each requirement and SL acceptance-test ID to what already exists, and write docs/SITELOG_GAP_ANALYSIS.md plus a staged checklist in docs/IMPLEMENTATION_STATUS.md. Then implement Stage 1 end-to-end, including migrations, API validation, permissions, mobile UI, offline behaviour and tests. Continue independently where choices are routine; ask only about genuinely blocking product decisions or missing external configuration.

Keep changes focused and maintainable. Use native APIs and existing approved dependencies where practical. Preserve all existing data and uncommitted work. No fabricated legal terms, approvals, prices, coordinates or credentials. Treat legal compliance as reviewed workflow controls, not a guarantee.

Run relevant checks and report exact results, limitations and the next stage. Do not change production DNS, deploy production, send external orders/bookings, or weaken security. Production publication requires my explicit approval.
```

After reviewing the first stage, continue with:

```text
Continue with the next incomplete stage in docs/SiteLog_Operations_Codex_Specification.md. Use the gap analysis and implementation status to avoid rebuilding completed features. Implement the stage end-to-end, run its relevant tests, update the status and report remaining blockers. Keep production unchanged.
```
