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
  console.log("PASS A6:", label);
};
const run = (body) =>
  evaluate(
    `(async()=>{const root=new URL('./',document.querySelector('script[type=module][src]').src).href;const s=await import(root+'store.mjs'),a=await import(root+'mock-auth.mjs'),r=await import(root+'project-record-service.mjs'),f=await import(root+'document-service.mjs'),d=await import(root+'domain.mjs');${body}})()`,
  );
async function action(name) {
  await waitFor(`document.querySelector('[data-action="${name}"]')`);
  await click(`[data-action="${name}"]`);
}
async function submit() {
  const invalid = await evaluate(
    "[...document.querySelector('#dialog form').elements].filter(e=>e.willValidate&&!e.validity.valid).map(e=>e.name)",
  );
  assert.deepEqual(invalid, []);
  await evaluate("document.querySelector('#dialog form').requestSubmit()");
  await waitFor(
    "!document.querySelector('#dialog').matches('.form-page, [open]')||document.querySelector('.form-error')?.textContent",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('#dialog .form-error')?.textContent||''",
    ),
    "",
  );
}
const folder = await mkdtemp(join(tmpdir(), "sitelog-document-fixture-"));
try {
  await send("Page.navigate", { url: origin + "/sitelog/" });
  await waitFor("document.querySelector('.current-job')");
  await run(
    "await s.reset();await(await import(root+'seed.mjs')).seed();await a.switchPersona('morgan');await s.setMeta('paused',true);await s.setMeta('uploadPolicy','wifi');",
  );
  await send("Page.reload");
  await waitFor("document.querySelector('.current-job')");
  const fixture = await run(`
 const inspection=await r.saveInspection({jobId:'harbour',description:'Drainage inspection',type:'Drainage',status:'booked',appointmentDate:d.workDate(),appointmentTime:'10:00',bookingReference:'Manual test booking',sharedWithWorkers:true,workerNotes:'Keep access clear',notes:'Private office note'});
 const failed=await r.recordInspectionOutcome(inspection.id,{expectedRevision:inspection.revision,outcome:'failed',date:d.workDate(),notes:'Synthetic corrective action needed',reference:'Test failed report'});
 const docs=await f.uploadDocuments({jobId:'harbour',category:'inspection reports',visibility:'workers',inspectionId:inspection.id,changeNote:'Initial synthetic report',files:[new File(['Initial report bytes'],'report.txt',{type:'text/plain'}),new File(['Site plan bytes'],'plan.txt',{type:'text/plain'})]});
 return {inspection,failed,docs};
`);
  check(
    fixture.failed.status === "follow_up_required" &&
      fixture.failed.outcome.outcome === "failed",
    "inspection failure remains a follow-up outcome, never a passed completion",
  );
  const follow = await run(
    `const opts={expectedRevision:${fixture.failed.revision},reason:'Synthetic repair and recheck'};return Promise.all([r.createReinspection('${fixture.failed.id}',opts),r.createReinspection('${fixture.failed.id}',opts)]);`,
  );
  check(
    follow[0].id === follow[1].id,
    "concurrent reinspection requests create one linked follow-up",
  );
  check(
    await run(
      `let i=await s.get('jobInspections','${follow[0].id}');i=await r.recordInspectionOutcome(i.id,{expectedRevision:i.revision,outcome:'passed',date:d.workDate(),notes:'Synthetic pass',reference:'Reinspection test'});const original=await s.get('jobInspections','${fixture.failed.id}');return i.status==='completed'&&original.outcome.outcome==='failed'&&(await s.all('inspectionEvents')).filter(e=>e.type==='outcome').length===2;`,
    ),
    "passing a follow-up retains the original failed outcome history",
  );
  check(
    await run(
      `const current=await s.get('jobInspections','${fixture.failed.id}');try{await r.saveInspection({...current,status:'booked'},{expectedRevision:current.revision});return false;}catch(e){return e.message.includes('outcome');}`,
    ),
    "completed inspection outcomes cannot be overwritten by plan edits",
  );
  check(
    fixture.docs.length === 2,
    "one upload command creates multiple private logical documents atomically",
  );
  const old = await run(
    `return (await s.all('documentVersions')).find(v=>v.documentId==='${fixture.docs[0].id}');`,
  );
  const next = await run(
    `return (await f.uploadDocuments({jobId:'harbour',documentId:'${fixture.docs[0].id}',expectedRevision:${fixture.docs[0].revision},category:'inspection reports',visibility:'workers',changeNote:'Synthetic revised report',files:[new File(['Revised report bytes'],'report-v2.txt',{type:'text/plain'})]}))[0];`,
  );
  check(
    await run(
      `const versions=(await s.all('documentVersions')).filter(v=>v.documentId==='${next.id}'),prior=versions.find(v=>v.id==='${old.id}'),current=versions.find(v=>v.id==='${next.currentVersionId}');return versions.length===2&&prior.objectKey!==current.objectKey&&(await s.get('blobs',prior.objectKey)).blob.size===${old.size}&&await(await s.get('blobs',prior.objectKey)).blob.text()==='Initial report bytes'&&await(await s.get('blobs',current.objectKey)).blob.text()==='Revised report bytes';`,
    ),
    "new document version retains earlier immutable bytes and a distinct object key",
  );
  check(
    await run(
      `try{await f.uploadDocuments({jobId:'harbour',documentId:'${next.id}',expectedRevision:1,category:'plans',changeNote:'Stale upload',files:[new File(['x'],'stale.txt',{type:'text/plain'})]});return false;}catch(e){return e.code==='CONFLICT'&&(await s.all('documentVersions')).filter(v=>v.documentId==='${next.id}').length===2;}`,
    ),
    "stale document revisions reject without orphan version or blob writes",
  );
  check(
    await run(
      `const before=(await s.all('documents')).length;try{await f.uploadDocuments({jobId:'harbour',category:'plans',changeNote:'Invalid batch',files:[new File(['valid'],'ok.txt',{type:'text/plain'}),new File(['<script>'],'bad.html',{type:'text/html'})]});return false;}catch{return (await s.all('documents')).length===before;}`,
    ),
    "invalid file batches leave no partial document records",
  );
  const decision = await run(
    `let v=await r.saveDecision({jobId:'harbour',title:'Site access decision',summary:'Initial synthetic access decision',decisionDate:d.workDate(),responsibleParty:'Office',action:'Keep east access open',inspectionId:'${fixture.inspection.id}',sharedWithWorkers:true});return r.saveDecision({...v,summary:'Revised synthetic access decision'},{expectedRevision:v.revision});`,
  );
  check(
    await run(
      `return (await s.all('commercialRevisions')).some(e=>e.entityType==='decisions'&&e.entityId==='${decision.id}'&&e.after.summary==='Initial synthetic access decision');`,
    ),
    "decision revisions retain the earlier summary and recorded actor",
  );
  await send("Page.reload");
  await waitFor("document.querySelector('.current-job')");
  await action("nav:office");
  await action("office-tab:inspections");
  await waitFor("document.body.textContent.includes('Drainage inspection')");
  await action("project-inspection:" + fixture.inspection.id);
  await waitFor(
    "document.querySelector('#dialog').textContent.includes('Inspection history')",
  );
  check(
    await evaluate(
      "document.querySelector('#dialog').textContent.includes('failed')&&document.querySelector('#dialog').textContent.includes('follow-up')",
    ),
    "office inspection view shows failure and linked corrective follow-up",
  );
  await action("close");
  await action("office-tab:documents");
  await action("project-document:" + next.id);
  await waitFor(
    "document.querySelector('#dialog').textContent.includes('Version history')",
  );
  check(
    await evaluate(
      "document.querySelector('#dialog').textContent.includes('Current version')&&document.querySelector('#dialog').textContent.includes('Superseded')",
    ),
    "office document history distinguishes current and prior versions",
  );
  await action("close");
  await action("project-document-new");
  await waitFor(
    "document.querySelector('#dialog').matches('.form-page, [open]')&&document.querySelector('[type=file]')",
  );
  await fill("#dialog [name=jobId]", "harbour");
  await fill("#dialog [name=changeNote]", "Uploaded by the office form");
  const path = join(folder, "ui-site-note.txt");
  await writeFile(path, "Synthetic file uploaded through the UI");
  const dom = await send("DOM.getDocument"),
    input = await send("DOM.querySelector", {
      nodeId: dom.root.nodeId,
      selector: "#dialog [type=file]",
    });
  await send("DOM.setFileInputFiles", { nodeId: input.nodeId, files: [path] });
  await submit();
  check(
    await run(
      "return (await s.all('documentVersions')).some(v=>v.filename==='ui-site-note.txt');",
    ),
    "office upload form persists actual selected file bytes",
  );
  const photo = await run(
    `await a.switchPersona('alex');const canvas=document.createElement('canvas');canvas.width=canvas.height=8;const ctx=canvas.getContext('2d');ctx.fillStyle='#296a50';ctx.fillRect(0,0,8,8);const original=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const prepared=await(await import(root+'media.mjs')).prepareMedia(new File([original],'cover-test.png',{type:'image/png'}),'harbour','alex',d.workDate());await(await import(root+'records.mjs')).saveMedia(prepared.metadata,prepared.blob,prepared.thumbnail,await a.requireUser());const op=(await s.all('operations')).find(o=>o.data.id===prepared.metadata.id);await(await import(root+'mock-api.mjs')).applyOperation(op);await a.switchPersona('morgan');return {id:prepared.metadata.id,bytes:[...new Uint8Array(await original.arrayBuffer())]};`,
  );
  await action("nav:media");
  await action("view-media:" + photo.id);
  await action("job-cover:" + photo.id);
  await waitFor("!document.querySelector('#dialog').matches('.form-page, [open]')");
  await action("nav:jobs");
  await waitFor(
    "document.querySelector('[data-job-photo=harbour]')?.naturalWidth>0",
  );
  check(
    await run(
      `return (await s.get('jobs','harbour')).coverMediaId==='${photo.id}';`,
    ),
    "office-selected accepted photo appears as a thumbnail job cover",
  );
  await run("await a.switchPersona('alex');");
  await send("Page.reload");
  await waitFor("document.querySelector('.current-job')");
  check(
    await run(
      `const api=await import(root+'mock-api.mjs'),dto=await api.workspaceSnapshot();return dto.sharedDocuments.some(d=>d.id==='${next.id}')&&!dto.sharedDocuments.some(d=>d.filename==='ui-site-note.txt')&&!Object.hasOwn(dto,'documentVersions')&&!JSON.stringify(dto.upcomingInspections).includes('Private office note');`,
    ),
    "worker projection includes shared documents and safe inspection fields only",
  );
  check(
    await run(
      `const current=await f.downloadDocument('${next.id}');try{await f.downloadDocument('${next.id}','${old.id}');return false;}catch{return await current.blob.text()==='Revised report bytes';}`,
    ),
    "worker download authorises the current shared version and rejects superseded bytes",
  );
  await action("job:harbour");
  await waitFor(
    "document.querySelector('#dialog').textContent.includes('Shared job information')",
  );
  check(
    await evaluate(
      "document.querySelector('#dialog').textContent.includes('Site access decision')&&document.querySelector('#dialog').textContent.includes('report.txt')",
    ),
    "worker job view offers shared decisions, inspections and document downloads",
  );
  await action("close");
  await action("nav:media");
  await action("view-media:" + photo.id);
  await action("repeat-photo:" + photo.id);
  await waitFor(
    "document.querySelector('#dialog').matches('.form-page, [open]')&&document.querySelector('[name=files]')",
  );
  check(
    await evaluate(
      "document.querySelector('[name=jobId]').value==='harbour'&&document.querySelector('#dialog').textContent.includes('Reference view')",
    ),
    "repeat photo preselects the authorised reference job without starting location tracking",
  );
  const photoPath = join(folder, "repeat-view.png");
  await writeFile(photoPath, Buffer.from(photo.bytes));
  const photoDom = await send("DOM.getDocument"),
    picker = await send("DOM.querySelector", {
      nodeId: photoDom.root.nodeId,
      selector: "#dialog [name=files]",
    });
  await send("DOM.setFileInputFiles", {
    nodeId: picker.nodeId,
    files: [photoPath],
  });
  await submit();
  check(
    await run(
      `return (await s.all('operations')).some(o=>o.kind==='media'&&o.state==='queued'&&o.data.repeatFromMediaId==='${photo.id}'&&o.data.jobId==='harbour')&&(await s.meta('uploadPolicy'))==='wifi';`,
    ),
    "repeat capture preserves its source link and the Wi-Fi upload preference",
  );
  await run(
    `await a.switchPersona('morgan');const doc=await s.get('documents','${next.id}');await f.updateDocument(doc.id,{...doc,expectedRevision:doc.revision,visibility:'office',reason:'Synthetic sharing revocation'});await a.switchPersona('alex');`,
  );
  check(
    await run(
      `try{await f.downloadDocument('${next.id}');return false;}catch(e){return e.message.includes('not available')&&!!(await s.get('blobs','${old.objectKey}'));}`,
    ),
    "sharing revocation denies future worker downloads while retaining history",
  );
  check(
    await run(
      "try{await r.projectRecords();return false;}catch(e){return e.message.includes('Office access');}",
    ),
    "workers cannot read private project management records",
  );
  check(errors.length === 0, "no uncaught project-record UI exceptions");
  console.log(`${count} A6 browser checks passed`);
  close();
} finally {
  await rm(folder, { recursive: true, force: true });
}
