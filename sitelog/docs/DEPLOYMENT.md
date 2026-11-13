# Running now and deploying later

## Current iteration

Use `npm --prefix sitelog start` from the repository root. This is a loopback-only static server. It safely resolves files, rejects dotfile/path escapes, preserves `/sitelog` query parameters during its 308 trailing-slash redirect, and serves the existing website without edits.

There are no secrets, production routes, Cloudflare bindings, external databases, email integrations or automatic deployments. No change to GitHub Pages settings, nameservers, DNS records, MX/SPF/DKIM or the existing homepage is needed to try the mockup.

Service-worker scope and manifest start/scope remain `/sitelog/`. `npm start` first creates a complete immutable build under `.build/releases/<buildId>/`; `.build/active.json` switches only after artifact completion. Source modules/CSS live at build-specific immutable URLs. The stable service worker/root HTML are revalidated, and API/auth responses are never cached. Version/details identify the installed artifact, including offline. See `VERSIONING_AND_RELEASES.md` for metadata inputs, safe waiting-worker update and static rollback. Do not replace this with a static cache-name bump or network-first mutable module loading.

To preview another build locally, run `npm --prefix sitelog run build`, then Check for updates / Reload after finishing open forms. Back up local data first when experimenting with database/schema changes. This creates local files only. No Cloudflare infrastructure/configuration is generated or applied.

## Future production work — requires a separate implementation/review

- Create separate frontend, business API and authentication Worker deployments.
- Use independently bound auth/business D1 databases and private R2 buckets per environment.
- Use supported cloud builds and pinned Wrangler (the current Big Sur Mac is unsupported by current Wrangler).
- Configure frontend static assets under `/sitelog`; verify the pinned Wrangler's `assets.base_path` support.
- Inspect current Cloudflare routes, cache rules and GitHub Pages origin before proposing changes.
- Route `/sitelog/auth/*` and `/sitelog/api/*` more specifically than `/sitelog/*`. Reserve `/sitelog/mcp` with a 404. Handle `/sitelog` canonically without matching unrelated paths.
- Production auth needs invite-only OTP, keyed digests, durable throttling, atomic consumption, secure host-only cookies, origin/CSRF protection and private auth RPC.
- Production media needs private R2 authorisation, bounded streamed uploads, checksums, verified finalisation, abandoned-object cleanup and a multipart strategy for larger files.
- Review the shared-origin threat model. Cookie paths and service-worker scope do not isolate SiteLog from malicious scripts elsewhere on tibbotts.com.
- Add verified backup/restore, versioned SQL migrations, least-privilege secrets, retention policy and privacy/legal review before real employee data.
- Staging uses synthetic data by default; preview builds must have no production credentials.
- Capture and review the route/configuration delta, existing `/` and `/family/` regression checks, and rollback before changing infrastructure.
- Production release must be manual and explicitly authorised. A push to `main` must not automatically release SiteLog production services.

Do not promote this local authentication adapter or its dataset to production.
