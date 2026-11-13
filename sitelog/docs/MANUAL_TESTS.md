# Manual device acceptance checklist

Run only with fictional information. Automated Chrome results do not replace these tests on actual phones.

- [ ] Load over localhost/HTTPS; install on iPhone Safari and Android where offered. Confirm icon, standalone layout and scope.
- [ ] Complete first load, close, then reopen offline. Cached jobs, drafts, queued notes/time and media remain available.
- [ ] Background/terminate the PWA, reopen it and verify unsynced work survives. Observe that uploads are not promised while closed.
- [ ] Capture portrait/landscape photos, gallery-select multiple photos, and try large/unsupported image files. Check orientation, 1920 px maximum and actual compressed file dimensions.
- [ ] Record a short video through the camera input; import an existing clip. Confirm size, playback or honest unsupported-codec behaviour. Files over 50 MB are rejected; videos over 10 MB require opt-in.
- [ ] Simulate Wi-Fi, mobile, unknown and offline. All three upload preferences behave correctly. A manual override retains the saved preference. Notes and time sync while media waits.
- [ ] Pause/resume, interrupt/reload during sync, retry, and verify no duplicates. Resolve a seeded edit conflict both ways.
- [ ] Expire demo session, save new offline work, then renew. Pending work remains intact and sync resumes.
- [ ] Switch between Alex, Sam and Morgan. Pending drafts stay with their author, worker jobs are assignment-filtered, and office reports use the accepted copy.
- [ ] Sign out with pending media and drafts. Read the retention notice, sign back in, and verify work is retained.
- [ ] Correct a time entry as worker and admin; compare before/after history. Test overlap, overnight and NZ daylight-saving edge cases.
- [ ] Create/edit jobs, including undeveloped-land descriptions and coordinates. Assign the second worker and create a local invite. Confirm no email is sent.
- [ ] Deny geolocation; manual selection works. Try inaccurate/adjacent locations and confirm a site is never selected automatically.
- [ ] Test storage denial/full quota. The UI must not claim a save succeeded. Test persistent-storage denial without losing existing work.
- [ ] Use keyboard, visible focus, screen reader labels, zoom and a narrow viewport. Check dialog scrolling and large touch controls.
- [ ] Export CSV, including commas/quotes/formula-like content; download local media.
- [ ] Reset with pending work, cancel once, then confirm. Only SiteLog demo data resets; family page local data is preserved.
- [ ] Confirm `/`, `/family/` and their existing behaviour remain unchanged. The service worker does not intercept those routes, API/auth routes or unknown media paths.

## Operations Stage 1 additions

- [ ] Back up a copied v1 profile; compare all record counts/IDs and media bytes after v2 upgrade. Confirm old personal defaults remain review-only and no jobs/queues are reset.
- [ ] Configure different weekday patterns and future effective dates in Office → Usual hours. Test Monday copy, revision conflicts and an unconfigured/non-working day.
- [ ] Confirm the split-day example (07:30–11:00, then 11:00–16:00 with one 30-minute break) totals 480 minutes. Choose earlier/intermediate gaps explicitly.
- [ ] Change date/worker after typing actual values, close/reopen offline and resolve the context prompt. Check that the selected job is retained and never silently replaced following lost assignment.
- [ ] Correct an entry offline, interrupt/reopen, reconnect and verify one new revision. Race two overlapping saves and ensure one remains locally correctable.
- [ ] Confirm workers cannot correct locked entries or retrieve office-only fields. Office locked corrections require a reason/explicit intent and retain lock/history.
- [ ] Check gap selection, collapsed optional note, keyboard and safe-area behaviour on real iPhone/Android; save remains reachable and there is no horizontal scrolling.
- [ ] Try denied/poor/adjacent/no-match GPS with saved and missing site coordinates. Confirm manual choice remains available and no location is stored.

## v3 expansion local acceptance

Run the automated suites first. Explore with synthetic inputs only:

- Header/Build Details on login, worker, every office tab, offline and storage error; installed version must match its artifact. Build another local artifact, defer, finish forms, reload, then rehearse a verified static rollback while retained work survives.
- Client/supplier approval and two supplier prices/conversions; client rate then reasoned manual override. Try stale edits, suspended suppliers, expired prices and missing costs.
- Configure branding and your own Standard terms; edit/remove/reload ordered clauses and confirm replacements. Issue a quote, change a template/catalogue, verify the original print/CSV snapshot is unchanged. Record acceptance twice and check one linked job/material/inspection set.
- Plan a crew/subcontractor activity, record a conflict/readiness override, change a dependency, prepare/manual-issue a PO and receive a partial delivery. No external party is contacted. Worker schedules reopen offline without financial data.
- Fail an inspection, create/pass its follow-up, retain the original failure. Upload multiple files/new versions and revoke worker sharing. Compare old bytes/checksums; financial categories remain office-only. Repeat a site photo and select an accepted thumbnail cover.
- Submit/approve a variation and compare original/approved/pending/revised cost bases. Enter a dated job labour-cost basis and completed subcontractor cost; reconcile received actual costs against outstanding order balances. Missing values must remain unknown.
- Download/inspect a local archive, run the isolated restore rehearsal, then test missing-ID import using a disposable profile. Existing records, sessions, queue and file bytes must remain intact. Protect the archive as private.

Real-device gates remain open: iPhone/Safari and Android installed-PWA capture, keyboard/dialog scrolling, offline termination/storage pressure, multi-window update, failed-install/legacy profile recovery, download handling and accessibility/contrast/touch review. Real service/auth/storage/backup restore, infrastructure staging and reviewed legal/retention configuration require their own acceptance; Chrome synthetic tests do not establish them.
