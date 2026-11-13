# Deployment strategies and GitHub Pages handoff

14 November 2026. This is the implementation contract for future AI/developer work. The current application is a mockup; no backend, credentials or external service has been connected.

## One explicit selector

The committed `sitelog/deployment.json` currently contains:

```json
{"target":"GitHubPages"}
```

Supported values are `GitHubPages` and `Production`. Build scripts normalize these to `github-pages` / `production` and generate immutable `src/deployment-config.mjs` inside each artifact. `SITELOG_TARGET` can override the target for a separate build; `SITELOG_ENV=production` also selects Production when no target override is supplied. A production environment with an explicit mock target is rejected. Unknown targets fail, with no fallback. Hostname, URL query parameters and local storage cannot change the selected strategy.

`src/service-factory.mjs` loads one strategy class; `src/services.mjs` is the composition root. The UI and sync engine call its service ports instead of importing concrete mock services. Existing pure domain rules, local capture/drafts/outbox, media processing and permission projections remain reusable. The generated selector is public configuration and contains no secrets.

| Target | Class | Storage / startup |
| --- | --- | --- |
| GitHubPages | `GitHubPagesServices` | Existing `sitelog-mockup-v1` browser database, fictional seed only when unconfigured; native offline capture and local mock business services. No Node/API server required. |
| Production | `ProductionServices` | Explicit fail-closed extension point, with `sitelog-production-cache-v1` reserved for its client cache. Currently raises `PRODUCTION_NOT_CONFIGURED` before any database access, demo seed, app initialization or remote call. |

Changing the target selects a different class, **not a completed production backend**. Do not remove the Production startup gate until every port is implemented/tested and the real server-side security/data infrastructure is ready. Never reuse the mock adapter as a fallback on an HTTP, authentication, configuration or network error. An older offline mock artifact remains visibly a mock build; its local outbox must never be automatically submitted to a real backend.

## Commit-to-main GitHub Pages workflow

The repository already publishes its root through GitHub Pages. This change keeps that workflow and does not add Actions, alter Pages settings or edit files outside `sitelog/`.

1. Edit application source under `sitelog/src/`, assets under `sitelog/public/`, and the source HTML/SW under **`sitelog/templates/`**. Root `sitelog/index.html` and `sitelog/service-worker.js` are generated hosting entrypoints; do not hand-edit them.
2. Run:

   ```sh
   npm --prefix sitelog test
   npm --prefix sitelog run build:pages
   npm --prefix sitelog run check:pages
   npm --prefix sitelog run test:browser
   ```

3. Review and commit **all relevant `sitelog/` changes**, including `index.html`, `service-worker.js`, `pages-build.json`, the new `assets/<buildId>/` directory, configuration, source and templates. The Pages files are deliberately not ignored. `.build/` stays ignored.
4. Push/merge to `main` using your existing workflow. That user action causes GitHub Pages to publish the committed files. The build commands themselves never commit, push or deploy.

`check:pages` verifies the active entrypoints, every generated asset and the source/configuration fingerprint. It fails on stale sources, target mismatches, tampering or missing build/config modules. Re-run `build:pages` after changing source. The Pages build uses a `github-pages` environment label and the package version/Git/build UTC information. Git identifies the checkout used to generate the artifact; pre-commit source changes are honestly marked dirty. Its immutable build ID identifies the actual artifact, independently of the later commit that includes generated output.

The output uses ordinary `assets/` directories without leading underscores and HTML/JS/CSS without Jekyll front matter, so the existing branch-based Pages publishing can copy these files. No root `.nojekyll`, DNS, CNAME or homepage/family changes are needed. GitHub describes branch publication and static build output here: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

Keep earlier generated asset directories that may be required by installed/offline clients. Do not automatically delete them on each build. Cleanup is a separately reviewed retention change; static rollback must retain its referenced assets. Never clear IndexedDB as a cache/update fix.

## Preview and Production builds

`npm --prefix sitelog start` builds/serves the configured strategy locally. With GitHubPages selected, it uses the same mock adapter but a local preview environment label; it does not overwrite the committed Pages entrypoints.

`npm --prefix sitelog run build:production` creates an ignored, reviewable Production static tree under `.build/static/sitelog/`. It does not overwrite the committed Pages files or publish anything. Today that build intentionally shows the Production-not-configured startup screen. Alternatively change `deployment.json` to Production for general builds; `build:pages` then refuses to generate a mock publication by accident.

## Port contracts for the production implementer

`src/service-contract.mjs` lists every required method. `assertServiceContract` validates the selected class. Keep the same method signatures/results/error semantics used by the UI and tests. Implement cohesive feature adapters behind ProductionServices, rather than spreading environment checks through screens.

| Port | Implementation requirements |
| --- | --- |
| `auth` | Separate invite-only SiteLog auth at `/sitelog/auth/*`. Current user/session, request/verify OTP and logout; no OTP codes/session secrets in API responses, build files or IndexedDB. `switchPersona` and `resetDemo` must remain unavailable in production. Server sessions and CSRF/origin protections remain authoritative. |
| `workspace` | Merge authorised remote DTOs with the current user's local drafts/outbox. `/sitelog/api/*` returns worker-safe data, not a raw database dump. `applyOperation` carries UUID idempotency, expected revision and permission context; acknowledge only durable acceptance. |
| `commercial`, `quotes`, `jobs` | Authenticated office commands, exact server money/quantity rules, approval/state/revision checks, immutable issue/acceptance snapshots. Quote conversion is atomic and uniquely linked; retry never duplicates jobs/materials/inspections. |
| `planning`, `purchasing` | Office-only central plans/orders/receipts with conflict/readiness reasons, immutable history, partial/excess receipts and idempotency. No external sends/bookings merely because an internal status changes. |
| `project`, `documents` | Permissions on metadata and every download/version. Private immutable R2 keys and verified uploads/finalisation. Short-lived authorised downloads; exact supporting file versions; financial categories excluded from worker access. |
| `variations`, `costing` | Explicit approval and immutable submitted/approved changes; original/approved/pending/actual/committed bases kept distinct. Trusted server rates/calculation, no worker financial data or rankings. |
| `backup` | Separate reviewed server backup/restore and privacy/retention policy. Local drafts/outbox archive is a separate concern. Do not send a local mock archive to production as trusted data. |

Before initializing a real client cache, call `configureStore` with the Production namespace **before opening a store**, or supply a separately reviewed production cache implementation. Never seed fictional users/jobs, restore demo sessions or migrate the mock outbox into production automatically. Local client capture remains recoverable offline and respects Wi-Fi/mobile/any media preferences. `quotes.saveEditorDraft` and backup/update barriers remain local durability operations; they are not blind REST calls.

Use same-origin auth/API paths; reserve `/sitelog/mcp`. Keep independent auth/business service deployments and stores. The strategy selects transports; it is not an authorization boundary. D1 transactions/constraints, private auth RPC, R2 access, session security, CSRF, idempotency, exact server calculations and audit/retention must be implemented server-side. Never trust browser roles, prices, total values or receipt timestamps as authoritative.

Before removing the startup gate, also audit mock-only UI copy/capabilities and demo actions, implement real session expiry/reauthorisation without losing local work, and run permission/concurrency/migration/export/update/device tests against synthetic staging. Production is a separate manual release requiring approval; no real resources or deployment are created by this work.
