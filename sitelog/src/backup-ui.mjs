import { escape as e, button } from "./ui.mjs";
import { workDate } from "./domain.mjs";
import {
  createBackup,
  inspectBackup,
  rehearseRestore,
  importMissingRecords,
} from "./backup-service.mjs";
let reviewed = null;
export function backupView() {
  return `<section class="panel"><div class="panel-header"><div><h2>Local backup & restore checks</h2><p class="sub">Records, drafts, queues and private file bytes stay under your control.</p></div></div><p>Download a complete local archive before clearing browser data. Archives contain private workspace records and files. Keep them in a trusted location. Sessions and one-time sign-in codes are excluded.</p><div class="quote-actions">${button("Download local backup", "backup-export", "button primary", "download")}${button("Review backup / restore", "backup-review", "button", "history")}</div><p class="form-help">Review verifies checksums. A restore rehearsal reads back records and original bytes in a disposable database. Import adds missing IDs only and leaves existing records unchanged; it does not replace the current workspace or switch accounts. This prototype archive is limited to 256 MB.</p></section>`;
}
export async function backupAction(action, context) {
  if (action === "backup-export") {
    const archive = await createBackup(),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(archive)], { type: "application/json" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `sitelog-local-backup-${workDate()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    context.toast("Local backup downloaded");
    return;
  }
  if (action === "backup-review") {
    reviewed = null;
    context.modal(
      "Review a local backup",
      "Validation does not change your active workspace.",
      `<form><label class="field"><span>SiteLog backup JSON</span><input name="archive" type="file" accept="application/json,.json" required></label>${context.footer("Verify archive")}</form>`,
      async (f) => {
        const file = f.get("archive");
        if (file.size > 256 * 1024 * 1024)
          throw new Error("This prototype supports archives up to 256 MB.");
        const json = await file.text(),
          info = await inspectBackup(json);
        reviewed = json;
        context.modal(
          "Verified backup archive",
          `${info.recordCount} records · ${info.fileCount} files · schema ${info.schemaVersion}`,
          `<form><p>Created ${e(info.createdAt)}. Checksums match; they detect corruption but are not a signature of authorship.</p><div class="quote-actions">${button("Run isolated restore rehearsal", "backup-rehearse", "button primary")}${button("Import missing records only", "backup-import", "button")}</div><p>Existing record IDs and file bytes will be retained. Records with matching IDs are skipped, including differing existing records. Unique source/version conflicts abort the import. Review the source before importing new identities or pending operations.</p></form>`,
        );
      },
    );
    return;
  }
  if (!reviewed) throw new Error("Review a backup archive first.");
  if (action === "backup-rehearse") {
    const result = await rehearseRestore(reviewed);
    context.modal(
      "Restore rehearsal passed",
      "Active workspace unchanged.",
      `<p>Verified ${result.recordCount} records and ${result.fileCount} original file objects after restoring into an isolated disposable database.</p>`,
    );
    return;
  }
  if (action === "backup-import") {
    const result = await importMissingRecords(reviewed);
    reviewed = null;
    context.close();
    await context.onChanged();
    context.toast(
      `Imported ${result.added}; retained ${result.skipped} existing IDs (${result.conflicting} differing records).`,
    );
    return;
  }
  throw new Error("Backup action unavailable.");
}
