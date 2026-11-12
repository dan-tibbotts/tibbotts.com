# SiteLog local prototype

- The user's current scope is a fully interactive local mockup in this existing repository. The supplied specification guides product behaviour; cloud infrastructure, external databases and real authentication are deferred.
- Keep all implementation under `sitelog/`. Do not edit the homepage, `family/`, DNS, `CNAME`, root robots or hosting configuration for this work.
- Do not deploy, push, create external resources or connect external services without the user's instruction.
- Use native browser/Node APIs and zero application dependencies unless a specific need is reviewed.
- Separate UI, domain rules, browser storage, sync, mock identity and mock office services. Do not describe browser mocks as production security.
- Cache only the explicit public shell allowlist in `/sitelog/`. Never cache future API/auth responses. IndexedDB records are user-scoped in application behaviour.
- Retain queued blobs until accepted; protect destructive actions with clear handling of unsynced work.
- Keep neutral worker-facing language. Do not introduce analytics, worker rankings or continuous location tracking.
- Run `npm test`, `npm run check` and meaningful browser checks from this directory after functional changes. Update implementation status with exact limitations.
