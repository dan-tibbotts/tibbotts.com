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
