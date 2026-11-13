# Local v3 expansion — 13 November 2026

This extends the existing SiteLog concept under `/sitelog/`. It is not a production release. The application release version is sourced from `package.json`; the installed header/details identify its immutable Git/UTC/environment build. Generated artifacts remain local and ignored.

| Phase | Main implementation files | Local result |
| --- | --- | --- |
| A1 | `scripts/build.mjs`, `scripts/serve.mjs`, `src/release.mjs`, `service-worker.js`, shared shell/index/styles, sync quiescing | Installed version on all screens; safe two-build update, failure handling and rollback |
| A2 | `money.mjs`, `pricebook.mjs`, `commercial-service.mjs`, `commercial-transactions.mjs`, `commercial-ui.mjs` | Contacts/roles/approval, supplier costs/conversions, client/manual selling rates and history |
| A3 | `quote-domain.mjs`, `quote-service.mjs`, `quote-ui.mjs`, `quote-export.mjs` | Terms/standalone quotes, draft recovery, immutable issues, print/PDF-compatible and CSV snapshots |
| A4 | `job-authorisation.mjs`, existing job service/form | Recorded acceptance/direct authorisation, exactly-once job/material/inspection conversion |
| A5 | `planning-domain.mjs`, `planning-service.mjs`, `planning-ui.mjs`, `purchasing-service.mjs`, `purchasing-export.mjs` | Work/crew/subcontractor planning, readiness/dependencies, orders/manual issue and exact partial receipts |
| A6 | `document-domain.mjs`, `document-service.mjs`, `project-record-service.mjs`, `project-record-ui.mjs`, `job-photos.mjs` | Inspection outcomes/follow-ups, decisions, immutable files/access, covers and repeat photos |
| A7 | `variation-service.mjs`, `costing-domain.mjs`, `costing-service.mjs`, `finance-ui.mjs` | Recorded variations/approvals and distinct budget/actual/outstanding cost bases |
| A8 local | `backup-format.mjs`, `backup-service.mjs`, `backup-ui.mjs`, `database-open.mjs`, permissions and browser/unit suites | Complete local archive/integrity/rehearsal, missing-ID import, privacy, mobile and additive old-tab compatibility |

All feature changes remain under `sitelog/`; no packages were added. Schema upgrades 3–8 retain the database name, original records/IDs, files, worker drafts and queue. No reset/reseed is performed on an existing installation. Normal office workspace responses exclude other identities’ unsent drafts/queues. Worker projections and document download checks exclude commercial information. This is still a local simulation, not trusted server security.

Use `npm --prefix sitelog start`, then open `http://localhost:4173/sitelog/`. Switch to Morgan for the office modules. Configure your own synthetic contacts, branding, prices and terms; none are invented as approved business/legal configuration.

Remaining work before real use: independently deployed auth/API/D1/private R2 and trusted server permissions, supported Cloudflare tooling, real-device iOS/Android acceptance, reviewed commercial/legal/privacy/retention/backup policies, real staging/production acceptance and explicit manual production approval. Branded XLSX is the permitted staged follow-up in `XLSX_FOLLOW_UP.md`; current exports are correctly named HTML/CSV. Formal contract/payment/statutory workflows remain separately scoped. No external messages, orders, bookings, DNS/hosting changes, push or production deployment occurred.

Final verification: **69 unit tests**, **241 Chrome browser checks**, **73 JS syntax checks**, manifest/icon/dependency policy, local build and `git diff --check` passed. See `IMPLEMENTATION_STATUS.md` for the per-phase matrix and remaining external/manual gates. No source or infrastructure outside `sitelog/` changed.
