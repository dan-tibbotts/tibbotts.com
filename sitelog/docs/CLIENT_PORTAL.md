# Client portal implementation

The existing `/sitelog/` application now contains an interactive local client portal, shared domain rules and an authenticated REST boundary. The GitHub Pages strategy remains a clearly labelled, browser-local demonstration. Production still stops with `PRODUCTION_NOT_CONFIGURED`; the new screens do not turn browser storage or demo sign-in into production security.

## Try the local workflows

Run `npm start` from `sitelog/`. In the office account, open **Commercial → Parties & representatives** and select **Create portal demo quotes**. This uses the existing quote save/review/issue services to create two fictional quotes. Switch to **Casey Wilson** through settings, or use Casey's demo sign-in button after signing out.

Casey can select both quotes, inspect their issued scopes/prices/GST/terms/exclusions, and approve their combined financial commitment for the fictional paying party. Acceptance creates one immutable batch, individual acceptance and work-authorisation evidence, and jobs through the original quote conversion. Submission and approval require a connected local demo state.

Client navigation contains Dashboard, Quotes, Jobs and Account. Jobs have overview, requirements, instructions, questions/RFIs, variations, issues, documents and activity. Office navigation adds Client actions, Requirements & authority and Parties & representatives. Client users can be created with the existing demo invite form; they receive no party access until office staff grant it. A user can represent several parties with different permissions and limits.

There is no general messaging, chat, direct employee inbox, invoice placeholder or emergency approval bypass. Approval confirmations are retained in the batch ledger; this repository has no external notification delivery infrastructure.

## Data and compatibility

IndexedDB version 9 adds `parties`, `partyContacts`, `partyRepresentatives`, `quoteAcceptanceBatches`, `quoteAcceptances`, `workAuthorisations`, `jobInstructions`, `jobRFIs`, `jobIssues`, `variationRequests` and `jobActivity`. Existing stores, IDs, customers, job records, media and unsynced work remain. Contacts are copied to Parties with their original IDs and a legacy link. No representative authority is inferred during migration.

Party relationships are independent values: prospect, quote recipient, client and paying party. The legacy customer contact model remains a compatibility surface for quotes, rate books and existing records. New prospects can receive quotes without first being classified as clients. Acceptance adds the client/payer relationships without removing existing ones.

Quote/job party links distinguish requester, client, payer, authorised representative and site contact. Set these through the office Party screen before issuing a quote. Saved quote drafts retain these links. Legacy jobs can be linked to parties without fabricating approval evidence. An already authorised paying-party relationship requires a fresh authorisation workflow rather than silent reassignment.

The original conversion and variation approval logic were extracted into transaction functions and are shared by the old staff services, portal services and server handlers. The existing `jobAuthorisations` records remain intact for compatibility; the richer immutable `workAuthorisations` ledger records party authority, exact scope, amount/cap/rates, terms, approval method, supporting document versions and audit identity. New readiness checks require a current work-authorisation record. Legacy authorisation references alone do not silently satisfy the new Ready to Start gate.

Only reviewed and accepted instructions become requirements. Scope/price changes require an approved linked variation; scheduling changes require a linked job activity. A formal RFI response cannot authorise work. Issues enter the site requirements view when staff mark them as affecting current work. Team ownership remains when an assignee leaves; assignments can be changed without replacing the originating record or its history. Staff can separately share formal decisions with clients.

## Server boundary

`server/portal-http.mjs` exports `createPortalHandler({ repository, authenticate, allowedOrigin })`. The existing development server mounts it under `/sitelog/api/portal/`. Without configuration it returns HTTP 503 and performs no authentication fallback, database creation or business mutation.

To mount a configured server adapter, set `SITELOG_PORTAL_ADAPTER` to an absolute path to an ES module with these named exports:

- `repository`: asynchronous `read()` and serialisable `transaction(callback)` operations. The callback receives the current data and transaction stores.
- `authenticate(req)`: verifies the server-side session and returns its immutable user ID, or null. It must not trust a request email, user ID, role or arbitrary identity header.
- `allowedOrigin`: the exact trusted origin used for mutation requests.

`npm start` loads that module explicitly. Configuration/import errors stop startup. No provider or credentials are selected automatically. `server/portal-repository.mjs` includes a transactional memory repository for integration tests and an atomic private-file repository for a **single local Node process**. File persistence is not a production multi-process database. Production database transactions must enforce the same unique source/version/request constraints and immutable approval records.

`src/adapters/portal-http-client.mjs` supplies the corresponding credentialed, no-store frontend transport. It has no demo fallback. It is ready for the authenticated Production service adapter; the existing Production composition root remains blocked until its authentication, business and persistence ports are actually configured. The static GitHub Pages demo continues to use its explicitly local adapter.

Main endpoints:

| Method | Path under `/sitelog/api/portal` | Workflow |
| --- | --- | --- |
| GET | `/workspace` | Permission-filtered portal data |
| GET | `/quotes/:id`, `/jobs/:id` | Party-authorised records |
| GET | `/jobs/:id/requirements`, `/jobs/:id/activity` | Current requirements / formal events |
| POST | `/parties`, `/party-contacts`, `/representatives` | Office Party administration |
| POST | `/commercial-parties` | Office quote/job party links |
| POST | `/quotes/accept` | Atomic bulk approval with idempotency key |
| POST | `/quotes/:id/decline` | Authorised decline of current issue |
| POST | `/jobs/:id/instructions`, `/rfis`, `/issues`, `/variation-requests` | Structured submissions (each suffix follows the job ID) |
| PATCH | `/records/:kind/:id` | Office review / response / assignment |
| POST | `/instructions/:id/acknowledge` | Explicit accepted-instruction acknowledgement |
| POST | `/jobs/:id/authorisations`, `/jobs/:id/readiness` | T&M authorisation / office readiness |
| POST | `/variations/:id/decision` | Current priced-variation approval/rejection |
| POST | `/documents/upload` | Validated bytes into existing document/version models |
| PATCH | `/documents/:id/sharing` | Office sharing review or revocation |
| GET | `/documents/:id/download` | Current shared version as a private attachment |

Every command resolves the authenticated actor from stored users, checks active party grants independently of UI state and validates the current business version inside the transaction. Viewing grants do not confer approval. Approval requires a verified representative, a matching payer, explicit acknowledgement and an adequate combined authority limit. Batches reject any invalid selected quote; late failures roll back all generated records. An exact replay returns the original batch, while changed payloads and new acceptance attempts are rejected.

Portal projections explicitly exclude supplier costs, margins, private staff notes, internal documents, private events and draft variations. JSON and download responses use `no-store`; mutations validate the exact Origin and JSON content type. Existing shell service-worker allowlists do not include API/auth routes. Client uploads reuse file limits, MIME/signature validation, immutable document versions and attachment downloads. Revocation and cross-job/party checks also apply to original bytes and older versions. Staff must review document content before sharing; purchase orders cannot be shared with clients.

## Remaining production work

Real external sign-in/session issuance, identity-to-party provisioning, production database/object storage adapters, a production host and the rest of the existing Production service ports are not configured in this repository. No live client account or external service has been created. Attachment malware scanning and operational retention/backups require the chosen production infrastructure. Authority records and explicit acknowledgement preserve evidence; they do not establish legal authority merely because someone logged in, or certify legal compliance. Real authority-verification and contractual/privacy review remain part of deployment preparation.

## Validation

`npm test`, `npm run check` and `npm run test:browser` cover the existing application plus Party migration, grant scoping, separate payer authority, atomic/replayed approval, immutable individual evidence, Ready to Start gating, structured review and acknowledgement, staff reassignment, document revocation, safe projections and formal activity. HTTP integration tests use an actual local server with a trusted test-session resolver; production REST remains unconfigured by default. `portal-browser.mjs` exercises the client/office/worker handoff at mobile size. `build:pages` and `check:pages` prepare and verify the static demo only; they do not publish it.
