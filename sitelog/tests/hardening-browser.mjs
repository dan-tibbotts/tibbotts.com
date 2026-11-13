import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { send, evaluate, waitFor, click, fill, errors, close } from "./cdp.mjs";
const origin = process.env.SITELOG_TEST_ORIGIN || "http://localhost:4173";
let count = 0;
const check = (v, label) => {
  assert.ok(v, label);
  count++;
  console.log("PASS A8:", label);
};
const run = (body) =>
  evaluate(
    `(async()=>{const root=new URL('./',document.querySelector('script[type=module][src]').src).href;const s=await import(root+'store.mjs'),a=await import(root+'mock-auth.mjs'),b=await import(root+'backup-service.mjs'),d=await import(root+'domain.mjs');${body}})()`,
  );
async function action(name) {
  await waitFor(`document.querySelector('[data-action="${name}"]')`);
  await click(`[data-action="${name}"]`);
}
const folder = await mkdtemp(join(tmpdir(), "sitelog-backup-fixture-"));
try {
  await send("Page.navigate", { url: origin + "/sitelog/" });
  await waitFor("document.querySelector('.current-job')");
  await run(
    "await s.reset();await(await import(root+'seed.mjs')).seed();await a.switchPersona('morgan');await s.setMeta('paused',true);await s.setMeta('uploadPolicy','wifi');await s.setMeta('otp:backup-test',{code:'EXCLUDE_BACKUP_CODE'});await s.put('drafts',{id:'backup-draft',userId:'alex',kind:'note',values:{jobId:'harbour',date:d.workDate(),text:'Keep this draft'}});await(await import(root+'document-service.mjs')).uploadDocuments({jobId:'harbour',category:'plans',visibility:'office',changeNote:'Synthetic backup fixture',files:[new File(['Private plan bytes'],'site-plan.txt',{type:'text/plain'})]});await s.put('blobs',{id:'backup-video',userId:'alex',blob:new Blob(['Original queued video bytes'],{type:'video/webm'}),thumbnail:null});await s.put('operations',{id:'backup-op',userId:'alex',kind:'media',state:'queued',attempts:0,createdAt:new Date().toISOString(),data:{id:'backup-video',jobId:'harbour',uploaderId:'alex',kind:'video',name:'backup-video.webm',size:27,mimeType:'video/webm',date:d.workDate(),createdAt:new Date().toISOString()}});",
  );
  await send("Page.reload");
  await waitFor("document.querySelector('.current-job')");
  const info = await run(
    "window.hardeningArchive=await b.createBackup();window.hardeningJSON=JSON.stringify(window.hardeningArchive);return {meta:window.hardeningArchive.records.meta,files:window.hardeningArchive.files,hasCode:window.hardeningJSON.includes('EXCLUDE_BACKUP_CODE')};",
  );
  check(
    !info.hasCode &&
      !info.meta.some((m) => m.id === "session") &&
      info.files.some((f) => f.id === "backup-video"),
    "complete backup includes private file bytes and excludes sessions/one-time codes",
  );
  check(
    await run(
      "const before=JSON.stringify(await s.snapshot()),result=await b.rehearseRestore(window.hardeningJSON);return result.verified&&result.fileCount===2&&JSON.stringify(await s.snapshot())===before;",
    ),
    "restore rehearsal verifies records and original bytes without changing the active workspace",
  );
  check(
    await evaluate(
      "(async()=>!(await indexedDB.databases()).some(db=>db.name.startsWith('sitelog-restore-rehearsal-')))()",
    ),
    "disposable restore database is removed after verification",
  );
  check(
    await run(
      "const changed=JSON.parse(window.hardeningJSON);changed.records.drafts[0].values.text='Corrupted';try{await b.inspectBackup(JSON.stringify(changed));return false;}catch(e){return e.message.includes('checksum');}",
    ),
    "corrupt archives are rejected before import",
  );
  check(
    await run(
      "const job=await s.get('jobs','harbour');await s.put('jobs',{...job,instructions:'Preserve this newer instruction'});await s.remove('drafts','backup-draft');const session=JSON.stringify(await s.meta('session'));const result=await b.importMissingRecords(window.hardeningJSON);return result.added===1&&result.conflicting>=1&&(await s.get('drafts','backup-draft')).values.text==='Keep this draft'&&(await s.get('jobs','harbour')).instructions==='Preserve this newer instruction'&&JSON.stringify(await s.meta('session'))===session&&(await s.get('operations','backup-op')).state==='queued'&&await(await s.get('blobs','backup-video')).blob.text()==='Original queued video bytes';",
    ),
    "missing-record import restores a draft while preserving newer records, identity, queue and bytes",
  );
  check(
    await run(
      "const result=await b.importMissingRecords(window.hardeningJSON);return result.added===0;",
    ),
    "import replay does not duplicate records",
  );
  check(
    await run(
      "const {openCompatibleDatabase}=await import(root+'database-open.mjs'),m=await import(root+'migrations.mjs');const db=await openCompatibleDatabase({name:m.DATABASE_NAME,version:m.DATABASE_VERSION-1,upgrade:()=>{throw new Error('An older tab must not run a downgrade migration');},requiredStores:['jobs','drafts','blobs']});const version=db.version;db.close();return version===m.DATABASE_VERSION&&(await s.get('drafts','backup-draft')).values.text==='Keep this draft';",
    ),
    "older open tabs can reopen retained stores after additive upgrades without downgrading data",
  );
  check(
    await run(
      "const {openCompatibleDatabase}=await import(root+'database-open.mjs'),m=await import(root+'migrations.mjs');try{await openCompatibleDatabase({name:m.DATABASE_NAME,version:m.DATABASE_VERSION-1,upgrade:()=>{},requiredStores:['missing-incompatible-store']});return false;}catch(e){return e.message.includes('compatible application');}",
    ),
    "incompatible older clients fail safely without recreating the database",
  );
  await send("Page.reload");
  await waitFor("document.querySelector('.current-job')");
  await action("nav:office");
  await action("office-tab:backup");
  await action("backup-review");
  await waitFor(
    "document.querySelector('#dialog').open&&document.querySelector('[name=archive]')",
  );
  const archivePath = join(folder, "test-backup.json");
  await writeFile(
    archivePath,
    (await evaluate("window.hardeningJSON")) ||
      (await run("return JSON.stringify(await b.createBackup());")),
  );
  const dom = await send("DOM.getDocument"),
    input = await send("DOM.querySelector", {
      nodeId: dom.root.nodeId,
      selector: "#dialog [name=archive]",
    });
  await send("DOM.setFileInputFiles", {
    nodeId: input.nodeId,
    files: [archivePath],
  });
  await evaluate("document.querySelector('#dialog form').requestSubmit()");
  await waitFor(
    "document.querySelector('#dialog').textContent.includes('Verified backup archive')",
  );
  await action("backup-rehearse");
  await waitFor(
    "document.querySelector('#dialog').textContent.includes('Restore rehearsal passed')",
  );
  check(
    true,
    "office can verify an actual backup file and run its restore rehearsal through the UI",
  );
  await action("close");
  check(
    await run(
      "const api=await import(root+'mock-api.mjs'),dto=await api.workspaceSnapshot();return !dto.drafts.some(d=>d.userId==='alex')&&!dto.operations.some(o=>o.userId==='alex');",
    ),
    "office workspace excludes another identity’s unsent drafts and private queue",
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 800,
    deviceScaleFactor: 1,
    mobile: true,
  });
  for (const tab of [
    "overview",
    "timesheets",
    "people",
    "hours",
    "contacts",
    "pricebook",
    "quotes",
    "terms",
    "planning",
    "materials",
    "inspections",
    "documents",
    "decisions",
    "variations",
    "costing",
    "backup",
  ]) {
    await action("office-tab:" + tab);
    await waitFor(
      `document.querySelector('[data-action="office-tab:${tab}"]').classList.contains('active')`,
    );
    check(
      await evaluate(
        "document.documentElement.scrollWidth<=innerWidth+1&&!!document.querySelector('header .version-label')",
      ),
      "320 px office " + tab + " fits and retains the version header",
    );
  }
  await action("office-tab:documents");
  const doc = await run("return (await s.all('documents'))[0];");
  await action("project-document:" + doc.id);
  await waitFor(
    "document.querySelector('#dialog').textContent.includes('SHA-256')",
  );
  check(
    await evaluate(
      "document.querySelector('#dialog').scrollWidth<=document.querySelector('#dialog').clientWidth+1&&document.querySelector('.dialog-content').scrollWidth<=document.querySelector('.dialog-content').clientWidth+1",
    ),
    "document version checksums fit the mobile dialog",
  );
  await action("close");
  await send("Emulation.clearDeviceMetricsOverride");
  check(
    await run(
      `const f=await import(root+'document-service.mjs');try{await f.updateDocument('${doc.id}',{...await s.get('documents','${doc.id}'),expectedRevision:${doc.revision},visibility:'workers',category:'quotes',reason:'Invalid financial sharing test'});return false;}catch(e){return e.message.includes('office only');}`,
    ),
    "financial document categories cannot be shared through an office command",
  );
  await run(
    `const doc=await s.get('documents','${doc.id}');await s.put('documents',{...doc,visibility:'workers',category:'quotes'});`,
  );
  await run("await a.switchPersona('alex');");
  await send("Page.reload");
  await waitFor("document.querySelector('.current-job')");
  check(
    await run(
      "try{await b.createBackup();return false;}catch(e){return e.message.includes('Office access');}",
    ),
    "worker cannot export an office workspace backup",
  );
  check(
    await run(
      `const f=await import(root+'document-service.mjs'),api=await import(root+'mock-api.mjs');try{await f.downloadDocument('${doc.id}');return false;}catch(e){return e.message.includes('not available')&&!(await api.workspaceSnapshot()).sharedDocuments.some(d=>d.id==='${doc.id}');}`,
    ),
    "legacy financial sharing flags cannot bypass worker projections or downloads",
  );
  check(errors.length === 0, "no uncaught hardening workflow exceptions");
  console.log(`${count} A8 browser checks passed`);
  close();
} finally {
  await rm(folder, { recursive: true, force: true });
}
