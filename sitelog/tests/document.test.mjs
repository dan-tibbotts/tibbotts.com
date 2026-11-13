import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  validateDocument,
  MAX_DOCUMENT_BYTES,
} from "../src/document-domain.mjs";
test("document validation preserves original bytes and checksum under a safe filename", async () => {
  const bytes = "A UTF-8 site instruction.\n";
  const file = await validateDocument(
    new File([bytes], "folder/site.txt", { type: "text/plain" }),
  );
  assert.equal(file.filename, "folder_site.txt");
  assert.equal(await file.blob.text(), bytes);
  assert.equal(file.checksum, createHash("sha256").update(bytes).digest("hex"));
});
test("executable types, forged signatures, mismatched MIME and oversized files reject", async () => {
  await assert.rejects(() =>
    validateDocument(
      new File(["<svg/>"], "image.svg", { type: "image/svg+xml" }),
    ),
  );
  await assert.rejects(
    () =>
      validateDocument(
        new File(["fake"], "plan.pdf", { type: "application/pdf" }),
      ),
    /signature/,
  );
  await assert.rejects(
    () =>
      validateDocument(
        new File(["%PDF-1.4"], "plan.pdf", { type: "text/html" }),
      ),
    /MIME/,
  );
  await assert.rejects(
    () =>
      validateDocument(
        new File([new Uint8Array(MAX_DOCUMENT_BYTES + 1)], "big.txt", {
          type: "text/plain",
        }),
      ),
    /25 MB/,
  );
});
test("plain text rejects binary bytes and invalid UTF-8", async () => {
  await assert.rejects(
    () =>
      validateDocument(
        new File([new Uint8Array([0, 1])], "binary.txt", {
          type: "text/plain",
        }),
      ),
    /NUL/,
  );
  await assert.rejects(
    () =>
      validateDocument(
        new File([new Uint8Array([255])], "invalid.txt", {
          type: "text/plain",
        }),
      ),
    /UTF-8/,
  );
});

test('commercial documents remain office-only even with a worker visibility flag',async()=>{
 const {workerDocumentAllowed}=await import('../src/document-domain.mjs');
 for(const category of ['quotes','purchase orders','variations','contract'])assert.equal(workerDocumentAllowed({active:true,visibility:'workers',category}),false);
 assert.equal(workerDocumentAllowed({active:true,visibility:'workers',category:'plans'}),true);
});
