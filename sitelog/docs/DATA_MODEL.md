# Local data model

The IndexedDB database is `sitelog-mockup-v1`, schema version 1. Every object store uses `id` as its key.

| Store        | Purpose                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta`       | Seed version, selected job per user, demo session, per-device upload/network settings, time defaults, demo codes and applied-operation markers |
| `users`      | Fictional active identities, display name, email and role                                                                                      |
| `jobs`       | Name, readable location, optional coordinates, radius, instructions, estimated minutes, stage/status and assigned worker IDs                   |
| `timesheets` | Accepted office-copy entries, work date, timezone, UTC start/end, break/worked integer minutes and current revision                            |
| `revisions`  | Application-append-only before/after snapshots, editor, sequence, reason and receipt timestamp                                                 |
| `notes`      | Accepted office-copy site notes                                                                                                                |
| `media`      | Accepted media metadata: type, sizes, dimensions/duration when readable, checksum, import/modification/receipt times                           |
| `operations` | UUID operation, user, entity snapshot, expected revision, queue state, attempt count, retry time and error                                     |
| `blobs`      | Actual media and thumbnail blobs, linked by media UUID and creating user                                                                       |
| `drafts`     | User-scoped unfinished form values with autosave timestamp                                                                                     |
| `invites`    | Local invitation records and inviter; no outbound delivery                                                                                     |

User-created entity and operation IDs are UUIDs. Seed IDs are readable fixture identifiers. Production must validate UUIDs, use separate auth/business stores, normalise assignments into their own table and index job/date and worker/date lookups.

Business dates use Pacific/Auckland. Timezone resolution rejects nonexistent/ambiguous local DST times rather than choosing silently. Overnight work is explicit, limited to 24 elapsed hours. Overlap checks span dates and jobs for the same worker.

Original image capture time is not inferred from filesystem metadata. `fileModifiedAt` and `importedAt` have distinct meanings. Photos are processed, so their checksum describes the saved compressed bytes, not the original source. Local “receivedAt” values are a device-clock simulation, not trusted server time.

There is no Company/Tenant table. There is no production migration or production dataset.

## Operations Stage 1 — schema version 2

The database name above is preserved; `src/migrations.mjs` upgrades its **schema version to 2**. See `MIGRATIONS.md` for backfill, backup, verification and rollback limitations.

| Added store         | Purpose                                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workSchedules`     | Worker ID, effective-from business date, NZ timezone, weekday start/end/break/overnight values, expected revision and editor. Legacy personal preferences are separate review-only records with no inferred effective date/days. |
| `scheduleRevisions` | Immutable application snapshots of each central schedule change, prior/after values, editor and timestamp.                                                                                                                       |
| `auditEvents`       | Time/schedule command actor, worker/record IDs, revision and timestamp. No movement/location logs.                                                                                                                               |

Time revisions now also record whether a locked-record correction was explicitly administrative. Time operations can carry `adminCorrection` and `conflictType`. Existing rows are not rewritten on upgrade; new/changed timed entries are recomputed from actual endpoints. The working date and timezone stay distinct from UTC receipt/edit timestamps.

Known hours-only values are displayed without assigning invented start/end times. New accepted timed corrections retain the previous hours-only snapshot in history. No acceptance details, real business hours, prices or coordinates are invented.
