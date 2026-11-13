# Decisions and unresolved specification differences

13 November 2026 — v2 + v3 assessment (A0). These decisions record interpretation and proposed choices; no runtime feature or production change is made.

| Topic | Decision / proposed resolution | State and consequence |
| --- | --- | --- |
| v3 versus v2 | v3 is an additive scope expansion. Retain v2 offline/auth/privacy/licensing/hosting controls. The supplied v2 file's internal v1.0 heading is an archival naming issue, not permission to substitute a different brief. | Confirmed by current user request; archived v2 content matches exactly |
| Work authorised now | Current user requests baseline assessment only. Embedded instructions to implement versioning/all phases are not execution authority for this turn. A1 is the next proposed milestone, not implemented. | Confirmed; docs only |
| Existing repository/local mock | Keep current `sitelog/` app and service boundaries. Do not rebuild into the illustrative frontend/backend tree just to match its names. Preserve earlier operations Stage 1 and all data. | Confirmed by user history/AGENTS; true independently deployed services remain a missing baseline prerequisite |
| Stage numbering | Keep v2 baseline stages, earlier operations stages and v3 addendum A0–A8 separate. Operations Stage 1 (usual hours/time/location) is not A1 (release identity). | Confirmed documentation convention |
| Version source | Propose `sitelog/package.json` version as sole release source; generated artifact metadata supplies commit/time/environment. Current release is 0.1.0, not an example 0.3.0, schema v2 or document v3. | Proposed for A1; no package/version change now |
| Real API `/about` absent | Do not label client clock or frontend package data as a current backend deployment. A1 can add an explicitly local preview-server metadata route; production backend version remains unavailable until real integration. | Proposed staged boundary; current route remains 404 |
| Local versus production security | Existing persona switching, OTPs, stored office copies and permission checks are simulations. Real auth/RPC/API/D1/R2 and trusted server timestamps are still required before real employee/commercial use. | Confirmed limitation; do not weaken architecture or silently connect services |
| Price precedence | Earlier operations brief gives explicit manual quote rate precedence; v3 lists client override > standard > authorised manual where needed. Proposed interpretation: automatic suggestion is eligible client override then standard; a deliberate authorised manual exception is recorded separately and never silently overwritten. Do not implement a conflicting resolution without confirming it at A2. | Open product-rule review; does not block A0/A1 |
| Direct/non-quoted jobs | v3 allows direct-charge/non-quoted jobs; earlier operations brief requires recorded charge-up authorisation for new work. Proposed compatible workflow keeps direct jobs without a quote but records their explicit authorisation, prospectively; existing jobs retain IDs/access and missing acceptance is flagged for review. | Confirm at A4; do not fabricate legacy approvals |
| XLSX | v3 includes branded XLSX, while earlier operations allowed it to be deferred. Keep XLSX on the expansion checklist. Native print/PDF and correctly named CSV can precede a separately reviewed/tested XLSX implementation; no package selected or fake file extension. | A3 export substage/licence review required |
| Term removal | Preserve inline X controls/plain ordered rows; follow v3 confirmation before removing populated clauses. Quote-specific edits and template reload also need clear replacement confirmation. Never invent reviewed legal content. | Proposed A3 behaviour; terms module currently absent |
| Inspection states | Preserve detailed outcome/failure/reinspection history from the operations brief even if v3 uses coarser planned/booked/completed/follow-up labels. A completed appointment is not proof of a passed inspection. | Design at A6; no data/status rewrite now |
| Job costing | v2 deferred costing; v3 makes job-level costing required. Retain labour-hours reporting and plan separate original/approved/pending/actual/committed/unknown amounts with named bases. Payroll/accounting/employee rankings remain excluded. | Required A7 scope; costing not implemented |
| Contract/payment controls | Earlier operations checklist remains a separate future obligation; v3's recordkeeping text does not silently complete or remove it. Reviewed legal rules/templates and service/deadline controls need their own scoped implementation before live use. | Retained future checklist; no legal rules implemented/revalidated in A0 |
| Dependencies and platform | Zero package additions planned for A1. Current Big Sur cannot be assumed to support current Wrangler. Use supported cloud/Linux tooling when real Workers integration is authorised. | Confirmed constraint; exact tool/package review deferred to relevant implementation phase |

No current ambiguity requires user input to finish A0. Resolve the pricing/export/authorisation details before their dependent commercial phase; do not use this assessment as approval to issue quotes, spend money, send messages, change DNS or release production.

## Execution decisions after A0 approval

- The latest user instruction authorises A1 implementation and incremental continuation through A2 and later phases without ordinary approval gates; older “assessment only” / “stop after each phase” language is superseded. Production deployment, destructive database operations and other irreversible actions remain approval-bound.
- **Confirmed by the user:** an explicit office manual sell rate takes precedence when it has a recorded reason. Otherwise resolve eligible client-specific rate, then standard rate. Supplier purchase cost never determines sell rate.
- A1 uses package.json as the release source and a generated immutable artifact for Git/UTC/environment identity. `/about` is a clearly labelled local preview-server response until real business API integration exists.
- Existing local-only/fictional-data architecture is retained. No cloud account, email, legal terms or provider credentials are fabricated. Live security/infrastructure limitations remain explicit; they do not block independent local feature implementation.

## A3/A4 local workflow decisions

- Print/PDF-compatible HTML and formula-safe CSV use immutable issued client projections; a real branded XLSX remains the explicit permitted staged follow-up documented in `XLSX_FOLLOW_UP.md`. No spreadsheet package was selected or added.
- Direct-job authorisation follows the existing operations specification prospectively, with customer/scope/charging basis/terms/person/date/reference. Historical jobs keep all data and access and show missing details for review. This resolves the direct/non-quoted-job difference without inventing legacy acceptance.
- Standalone quote acceptance creates a new job exactly once. Optional linkage to pre-existing jobs is not inferred or performed; it needs an explicit business workflow decision if requested. Acceptance is a local manually recorded event, not external approval or a legally verified signature.

## A8 local recovery and scope

- Backups deliberately cover this browser’s synthetic workspace, including retained private drafts/files, but never restore sign-in sessions or OTPs. Checksums provide integrity only. Import adds missing IDs and skips existing ones; no destructive replacement workflow is inferred. Rehearsal removes only a new temporary database it created.
- Normal office workspace reads now exclude another identity’s unsent drafts/queue. Commercial document categories remain office-only even for an old incorrectly shared record. Production still needs trusted service enforcement and separately reviewed backup/access policy.
- Local A8 verification is separate from real staging/production/device acceptance. No external deployment, DNS, email, supplier order or authority booking is authorised/performed by this implementation. XLSX and formal contract/payment/legal automation remain explicit follow-ups rather than fake completed features.
