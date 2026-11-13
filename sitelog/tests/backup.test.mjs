import test from "node:test";
import assert from "node:assert/strict";
import {
  makeArchive,
  parseArchive,
  canonical,
  sha256,
} from "../src/backup-format.mjs";
const records = {
  meta: [
    { id: "session", value: { token: "EXCLUDED_SESSION" } },
    { id: "otp:test", value: "EXCLUDED_CODE" },
    { id: "uploadPolicy", value: "wifi" },
  ],
  drafts: [
    { id: "alex:note:new", userId: "alex", values: { text: "Kept draft" } },
  ],
  operations: [{ id: "op", state: "queued" }],
};
test("backup roundtrip retains drafts, operations and both original/thumbnail bytes", async () => {
  const archive = await makeArchive(records, [
    {
      id: "photo",
      userId: "alex",
      blob: new Blob(["original bytes"], { type: "image/jpeg" }),
      thumbnail: new Blob(["thumbnail bytes"], { type: "image/webp" }),
    },
  ]);
  const parsed = await parseArchive(JSON.stringify(archive));
  assert.equal(await parsed.blobRows[0].blob.text(), "original bytes");
  assert.equal(await parsed.blobRows[0].thumbnail.text(), "thumbnail bytes");
  assert.equal(parsed.records.drafts[0].values.text, "Kept draft");
  assert.equal(parsed.records.operations[0].state, "queued");
  assert.equal(JSON.stringify(archive).includes("EXCLUDED"), false);
  assert.deepEqual(archive.records.meta, [
    { id: "uploadPolicy", value: "wifi" },
  ]);
});
test("archive tampering and file-byte tampering fail separate checksum checks", async () => {
  const archive = await makeArchive(records, [
    { id: "doc", blob: new Blob(["private text"]), thumbnail: null },
  ]);
  const changed = structuredClone(archive);
  changed.records.drafts[0].values.text = "Changed";
  await assert.rejects(() => parseArchive(JSON.stringify(changed)), /checksum/);
  const altered = structuredClone(archive);
  altered.files[0].blob.base64 = btoa("changed text");
  const { checksum, ...body } = altered;
  altered.checksum = await sha256(new TextEncoder().encode(canonical(body)));
  await assert.rejects(() => parseArchive(JSON.stringify(altered)), /checksum/);
});
test("unknown tables, duplicate IDs and authentication imports reject even with a recomputed checksum", async () => {
  const initial = await makeArchive(records, []);
  for (const modify of [
    (a) => (a.records.unknown = []),
    (a) => a.records.drafts.push(a.records.drafts[0]),
    (a) => a.records.meta.push({ id: "session", value: "fake" }),
  ]) {
    const changed = structuredClone(initial);
    modify(changed);
    const { checksum, ...body } = changed;
    changed.checksum = await sha256(new TextEncoder().encode(canonical(body)));
    await assert.rejects(() => parseArchive(JSON.stringify(changed)));
  }
});

test("restore rejects unsafe identifiers/references and UI attributes remain escaped", async () => {
  const initial = await makeArchive(records, []),
    changed = structuredClone(initial);
  changed.records.drafts[0].values.jobId = 'x" onclick="bad';
  const { checksum, ...body } = changed;
  changed.checksum = await sha256(new TextEncoder().encode(canonical(body)));
  await assert.rejects(
    () => parseArchive(JSON.stringify(changed)),
    /identifier/,
  );
  const { button, statusBadge } = await import("../src/ui.mjs");
  const attack = 'x" onfocus="bad<svg>';
  const html =
    button("Safe label", "action:" + attack, "button " + attack) +
    statusBadge(attack);
  assert.ok(html.includes("&quot;"));
  assert.equal(html.includes("<svg>"), false);
  assert.equal(html.includes(' onfocus="bad'), false);
});
