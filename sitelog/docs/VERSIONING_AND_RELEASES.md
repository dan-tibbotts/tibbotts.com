> Current implementation: A1 is implemented and tested; the original proposed design below is retained for history. The implementation checkpoints at the end supersede its assessment-only/stop instructions.

# Proposed A1 — installed version, build identity and safe updates

**Design only, 13 November 2026. Not implemented or approved as completed.** This is the smallest recommended next milestone, ahead of commercial modules. The current runtime still has a hardcoded footer and no build/update UI.

## Scope and single source

Use **`sitelog/package.json` → `version`** as the authoritative SemVer. It is currently **0.1.0**. Do not use document v3, IndexedDB schema v2, SW cache `sitelog-shell-v2`, a Git hash, or the illustrative v0.3.0 as the release version. Keep the lockfile consistent when an intentional release bump is made; remove hardcoded runtime version copies during A1.

Proposed Node-only build command generates a closed, immutable static artifact and an imported build-info module containing an explicit allowlist: `frontendVersion`, `buildId`, `gitCommitShort`, `builtAtUtc`, `environment`, and optional `dirty`/source-unavailable marker. CI supplies or verifies the checkout commit; local builds read Git if available and label uncommitted or unknown sources honestly. Use explicit environment labels (local/preview/staging/production), not arbitrary environment-variable dumps.

Generate UTC time and metadata **once per build**. Include an artifact/content digest so two worktrees/builds cannot share a cache key accidentally. Do not manufacture a version on page load/request or fetch a mutable “latest” label to identify running code. Retain metadata with its artifact and release notes. Short commit IDs/build timestamps are public metadata; credentials, account IDs, private URLs, repository tokens and secrets are excluded.

Fingerprint JS/CSS using content-derived paths or filenames within a build-specific immutable asset directory. Native ESM imports, dynamic imports and CSS/icon/manifest links must resolve to the same artifact; verify the entire dependency graph with tests. Prefer the existing native module approach and Node APIs; a bundler is not justified solely by showing a version.

## Compact UI on every path

A shared shell/version control must cover worker home, records, jobs, media, all office tabs, login, initial boot and storage/offline error fallbacks. On mobile show **SiteLog v0.1.0**, upload policy/count and Settings without increasing header height or introducing horizontal scrolling. Desktop topbar must also show the release label, not merely a sidebar/footer.

The version control opens accessible **Build Details**: installed frontend release, short commit, build ID, UTC build time and environment; backend API version shown separately only when reachable. Offline or absent API must show “Unavailable/offline” or “Not connected”, never a guessed matching version. Version visibility must not depend on successful IndexedDB/auth initialisation. Keep contrast, labels, keyboard access and 320 px touch controls tested.

## Backend `/sitelog/api/about`

Production target: non-sensitive JSON with independent backend version, safe deployment label, dynamic **server** UTC time and optional short backend release ID; `Cache-Control: no-store`. No sessions, secrets, full configuration or account identifiers. It belongs to the business API, not the auth service. Never overwrite the frontend's installed identity with this response.

There is no backend today. For an authorised local A1, the existing Node preview server may expose an explicitly labelled local/mock API metadata response, with its own metadata and server time, and tests must distinguish that from a deployed Worker. Update the current test that intentionally expects 404 only when this route is actually introduced. A production Worker `/about` remains incomplete until a real business deployment exists; do not invent a live API or claim production acceptance from the local response. No account/DNS changes are needed for the frontend milestone.

## PWA update protocol

MDN documents that `registration.update()` checks the worker script for changes; `skipWaiting()` can force waiting-worker activation, and `clients.claim()` can change control of existing clients. These are tools for a controlled protocol, not permission to force a reload while a form is being edited. [Update](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update), [skipWaiting](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting), [claim](https://developer.mozilla.org/en-US/docs/Web/API/Clients/claim)

Proposed flow:

1. Cache a complete verified **public static artifact** under a SiteLog build-specific cache name. Keep the stable SW registration at `/sitelog/service-worker.js` and scope `/sitelog/`. Use immutable build asset paths; stop replacing individual active-release modules with newer files through network-first unversioned requests. Never cache API/auth/private responses or intercept other projects.
2. Install a complete candidate without replacing the running page. Detect an existing waiting worker as well as future `updatefound`/state changes. Show unobtrusive **Update available — Reload** and a defer option. Settings/Build Details offers **Check for updates**, with honest offline/error/up-to-date feedback.
3. When the user requests reload, await pending draft writes and inspect all account-scoped pending operations and in-progress forms. Verify notes/time drafts, selected photo/video bytes and context state are durably stored. The current file picker holds unsaved selection only in memory: persist it or explicitly let the user finish/cancel before update. Do not falsely claim that checking the outbox protects an unqueued file selection.
4. Quiesce syncing at a recoverable boundary while retaining queued/syncing/failed/conflict state and blobs. Pending uploads do **not** have to finish before update, particularly offline. Explain what will be retained; abort reload if persistence fails or a capture/form cannot be saved safely. A version update never resets data, signs a different user in or changes upload preferences.
5. Coordinate other open tabs/PWA windows before activation. A waiting worker and `claim()` affect the scope, not just the clicked tab. Defer if another client has unsaved memory-only work or is on an unknown legacy protocol. Never broadcast an unconditional forced reload. Keep old artifact assets available until no old client needs them.
6. Activate only through the explicit safe update path (or normal browser lifecycle once prior clients close), then perform one acknowledged reload for the consenting client. Verify running frontend build metadata belongs to the selected artifact; no reload loop or reliance on a mutable latest JSON. A stale offline client keeps its own installed release/build label.
7. On activation, clean obsolete **static SiteLog** caches only when not needed by active old clients. Never clear IndexedDB, drafts, operations, blobs, identity caches or another project's caches. Retain/recover the prior valid artifact if candidate install/validation fails. Handle the transition from the current legacy `sitelog-shell-v2` separately and test it.

A1 should require no IndexedDB schema migration. If retaining currently memory-only media selections needs a data change, split and document an additive compatibility migration rather than smuggling a destructive change into cache cleanup.

## Proposed affected files and rollback

- Extend `package.json` scripts without adding dependencies; add a focused `scripts/build.mjs` and generated, immutable output under `sitelog/` (exact directory/ignore policy chosen during implementation).
- Add small build-info/shell/update modules consumed by `app.mjs` and the boot/error/login markup; adjust `styles.css` and `index.html` while retaining current forms/media/queue modules.
- Generate the build-specific SW precache manifest and adapt `service-worker.js`; preserve API/auth exclusions and current `/sitelog/` scope.
- Extend the local preview server for artifact serving and, if included, clearly labelled local `/about`. No auth code goes into that route.
- Extend tests with two complete packaged artifacts and disposable browser profiles, and update API/release/architecture documentation once implementation is real.
- Roll back static artifacts/routing to the previous verified artifact without dropping database v2. Retain old build assets needed by old clients; test SW rollback separately. Never use Reset demo data as an update remedy. Production release/rollback remains a separate approved action.

## A1 acceptance gates

- Version visible on every worker/office/login/offline/boot/error page at desktop, 390 px and 320 px; clear accessibility/contrast/focus.
- Package release and generated artifact/build details match. Same release with different source/build IDs remains distinguishable. Local, unknown-Git, dirty-source and CI environment fixtures are honest; no private environment variables appear.
- Two built artifacts **A → B** demonstrate update prompt, deferral, explicit safe reload and correct post-update identity. Offline A continues to report A, even if B's API is current.
- Draft/queued time and notes, compressed photos/video blobs, failed/conflict records, current job, user isolation and upload policy survive the update; compare IDs/counts/checksums and confirm no duplicates after reconnect.
- Unsaved form, unsaved picker files, ongoing save/upload, quota failure and another dirty tab prevent unsafe reload or are safely persisted. No unsolicited reload mid-entry.
- Interrupted/failed install, absent backend, offline check, controller change, old cache cleanup, legacy-SW transition and static rollback leave a usable old artifact and retained data.
- Backend metadata is independent, safe/no-store and excluded from public CacheStorage. Actual production API/environment claims require real deployments; use local fixtures for previews/staging/production labels without deploying production.
- Existing 31 unit + 78 browser checks remain green, plus new build/update tests. Real installed iOS/Android update/keyboard/termination tests remain explicit manual gates.

Stop for review after A1. Do not start A2 or deploy production automatically.

## A1 implementation checkpoint (supersedes design-only status above)

The current user authorised implementation and continuation. A1 is implemented using the architecture described here; this document's original plan is retained for traceability, not as a renewed approval requirement.

Run `npm --prefix sitelog start` to build and serve a complete immutable local artifact. Run `npm --prefix sitelog run build` to build a new artifact while the server is running, then use Build Details → Check for updates and Reload. Generated files are ignored under `sitelog/.build/`; they are not a production deployment. Old release directories are retained for open clients/rollback. The immutable static artifact, not the source tree, is the deployment input for future hosting.

CI/local inputs are `SITELOG_ENV` (local/preview/staging/production), optional `SITELOG_GIT_COMMIT` or `GITHUB_SHA`, and optional `SITELOG_BUILD_TIME` in UTC. Normal local builds derive Git and dirty state and generate time once. Unknown Git is labelled unknown. No version is hardcoded into the UI; package.json remains authoritative. Backend about metadata remains independent and is marked `local-mock`.

Updates pause at open forms rather than discarding unsaved file selections. Finish/save or deliberately cancel the form before updating. Candidate-cache cleanup is deferred while any install/waiting worker exists, and active old clients keep their static assets. Older clients without the update protocol must be closed/reopened; they cannot be forced to confirm a protocol they never implemented. Real iOS/Android installation, failed-install/legacy-profile and production infrastructure checks remain manual/future gates; they are not claimed by the Chrome tests.

## Implemented release and compatibility verification

A1 now tests failed candidate installation, quota/draft-write refusal, unsaved media and another dirty tab, explicit A→B activation, retained drafts/time/note/photo/video/conflict/upload settings, honest offline identity and storage-error headers. A8 adds additive database compatibility: older tabs may reopen a higher schema only while all required stores remain; no old downgrade migration runs. Concurrent connection requests share one opening promise. Incompatible stores fail with data retained.

The update protocol awaits worker/quote draft and backup writes before activation; it never clears user records. Local preview retains immutable release directories for rollback. Re-selecting a prior verified artifact through the local active pointer offers the same explicit safe update path; browser tests verify the rolled-back frontend reports its own identity and keeps local work. This is static artifact rollback, not a database downgrade. No live production route or cache was changed.

Real installed iOS/Android behaviour and transition from an unknown legacy client still require manual device/profile review. Unknown legacy tabs must be finished and closed before the new protocol can safely activate; no forced reload is claimed.

## GitHub Pages build handoff

`build:pages` emits a `github-pages` label and `deploymentTarget: github-pages`, with the public immutable service selector in the asset tree. `Production` is a separate adapter selection, not just a label on the mock. The target/config is included in the source fingerprint and build ID. Track the generated Pages entries/assets with your source commit; run `check:pages` to catch stale/incomplete output. Build from `templates/`, never regenerate from already compiled root HTML/SW. Retain published old asset folders for installed clients. The complete workflow is in `DEPLOYMENT_STRATEGIES.md`.
