# Prototype privacy and retention

This mockup is intended for fictional concept testing. All demo identities, jobs, work records, file bytes and preferences stay in the browser's IndexedDB. Static app files are cached separately for offline reopening. No telemetry, analytics, remote fonts or third-party image services are used.

The app does not send email or transmit photos/videos. “Demo synced” means registered in the simulated office copy in this browser. Other browsers/devices do not share it.

A location request happens only after pressing Find nearby jobs. It is one-shot, used in memory to rank authorised job coordinates, and neither stored nor sent by SiteLog. Manual selection works without location. Browser/OS permission behaviour remains under platform control.

Pending work and drafts belong to their creating demo identity. Account switching/sign-out explains their retention. The UI only shows that account's pending work. Local browser data is not encrypted or protected from developer tools or other people with access to this browser profile; do not use it for real employee records.

There is no automatic deletion policy in the prototype. Reset demo data permanently clears only the SiteLog database and reseeds fixtures, after confirmation. Browser storage eviction or clearing site data may also remove everything. Download individual media/exports as needed. Office → Backup & restore can explicitly download a complete local archive; backups are manual, private and not automatically copied elsewhere.

Production must define access, retention periods, deletion exceptions, media-original handling, export, incident response, backup/restore, shared-device logout policy and review under applicable New Zealand privacy requirements before live use. Those policies are not implied by this concept mockup.

The v3 office modules retain immutable issued quotes, change submissions, receipt events, inspection outcomes and document bytes/history. Commercial data stays outside worker DTOs. Financial document categories are always office-only; permitted site documents require explicit sharing and current assigned-job access on download. Office workspace reads exclude other identities’ unsent drafts and queue entries. Current shared document downloads are attachment-only; prior versions are office-only. Revocation prevents later service downloads but cannot recall files already saved on a device.

Local backups contain private records and original file bytes, including pending drafts/uploads. Treat an exported archive as private. Sessions/one-time sign-in codes are excluded. SHA-256 checks detect corruption, not forgery or authorship. Rehearsal uses a disposable local database; import adds missing IDs and skips existing ones without overwriting them. This is not a reviewed production retention/legal-hold/backup regime. Production must use separate authenticated stores and reviewed recovery procedures.
