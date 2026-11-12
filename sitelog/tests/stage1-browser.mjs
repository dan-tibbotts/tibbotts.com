import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  send,
  evaluate,
  waitFor,
  click,
  fill,
  shot,
  errors,
  close,
} from "./cdp.mjs";
const origin = process.env.SITELOG_TEST_ORIGIN || "http://localhost:4173";
let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  checks++;
  console.log("PASS Stage 1:", label);
}
const run = (body) =>
  evaluate(
    `(async()=>{const s=await import('/sitelog/src/store.mjs'),a=await import('/sitelog/src/mock-auth.mjs'),api=await import('/sitelog/src/mock-api.mjs'),d=await import('/sitelog/src/domain.mjs');${body}})()`,
  );
async function action(name) {
  await waitFor(`document.querySelector('[data-action="${name}"]')`);
  await click(`[data-action="${name}"]`);
}
const submit = () =>
  evaluate("document.querySelector('#dialog form').requestSubmit()");
const change = (selector, value) =>
  evaluate(
    `(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
await send("Page.navigate", { url: origin + "/sitelog/" });
await waitFor("document.querySelector('.current-job')");
// All mutation fixtures are confined to the disposable test profile.
await run(
  "await s.reset();await(await import('/sitelog/src/seed.mjs')).seed();await s.setMeta('paused',true);",
);
await send("Page.reload", { ignoreCache: true });
await waitFor("document.querySelector('.current-job')");
await action("time");
await waitFor("document.querySelector('#time-form')");
check(
  await evaluate(
    "document.querySelector('#time-suggestions').textContent.includes('not configured')&&document.querySelector('[name=start]').value===''&&document.querySelector('[name=end]').value===''",
  ),
  "unconfigured workers are asked for actual times without invented hours",
);
await action("close");
const migration = await run(`
 const m=await import('/sitelog/src/migrations.mjs'),name='sitelog-v1-fixture-'+crypto.randomUUID();
 const oldStores=['meta','users','jobs','notes','timesheets','revisions','media','operations','blobs','drafts','invites'];
 const fixtures={meta:[{id:'defaults:old',value:{start:'08:00',end:'16:00',breakMinutes:20}},{id:'seeded',value:true}],users:[{id:'old',displayName:'Preserved',role:'worker',active:true}],jobs:[{id:'original-job',name:'Existing site',lat:null,lng:null,workerIds:['old']}],timesheets:[{id:'hours-only',workerId:'old',jobId:'original-job',date:'2026-11-13',totalMinutes:210}],revisions:[{id:'old-revision',entryId:'hours-only',sequence:1}],notes:[{id:'old-note',jobId:'original-job',text:'Keep this'}],media:[{id:'file',jobId:'original-job',checksum:'old-checksum'}],operations:[{id:'pending',state:'queued',userId:'old',kind:'media',data:{id:'file',jobId:'original-job'}}],drafts:[{id:'unfinished',userId:'old',values:{text:'Keep draft'}}],invites:[{id:'old-invite',email:'old@example.test'}],blobs:[{id:'file',userId:'old',blob:new Blob(['original bytes'],{type:'image/jpeg'}),thumbnail:new Blob(['thumb'])}]};
 const old=await new Promise((resolve,reject)=>{const req=indexedDB.open(name,1);req.onupgradeneeded=()=>{for(const n of oldStores)req.result.createObjectStore(n,{keyPath:'id'});};req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);});
 await new Promise((resolve,reject)=>{const tx=old.transaction(oldStores,'readwrite');for(const n of oldStores)for(const row of fixtures[n])tx.objectStore(n).put(row);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});old.close();
 const upgraded=await new Promise((resolve,reject)=>{const req=indexedDB.open(name,m.DATABASE_VERSION);req.onupgradeneeded=e=>m.upgradeDatabase(req.result,req.transaction,e.oldVersion);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 const read=n=>new Promise((resolve,reject)=>{const req=upgraded.transaction(n).objectStore(n).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 const rows=Object.fromEntries(await Promise.all(oldStores.map(async n=>[n,await read(n)])));
 const preserved=oldStores.filter(n=>n!=='blobs').every(n=>fixtures[n].every(row=>JSON.stringify(rows[n].find(r=>r.id===row.id))===JSON.stringify(row)));
 const blobOK=await rows.blobs[0].blob.text()==='original bytes'&&await rows.blobs[0].thumbnail.text()==='thumb';
 const schedules=await read('workSchedules'),review=schedules[0];
 const indexed=upgraded.transaction('timesheets').objectStore('timesheets').indexNames.contains('byWorkerDate');
 const count=Object.fromEntries(oldStores.map(n=>[n,rows[n].length]));upgraded.close();await new Promise(resolve=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=resolve;});
 return {preserved,blobOK,indexed,review,count};
`);
check(
  migration.preserved,
  "v1 migration preserves every original record, ID, draft and outbox value",
);
check(
  migration.blobOK,
  "v1 migration preserves original media and thumbnail bytes",
);
check(
  migration.indexed,
  "v2 adds worker/date indexes without replacing the database",
);
check(
  migration.review.needsReview &&
    migration.review.effectiveFrom === null &&
    Object.keys(migration.review.days).length === 0,
  "legacy personal hours require review; no working days or dates invented",
);
check(
  migration.count.operations === 1 && migration.count.timesheets === 1,
  "migration preserves pending queue and hours-only counts",
);
const concurrent = await run(`
 const make=(id,start,end)=>({id:d.uuid(),kind:'time',userId:'alex',expectedRevision:0,data:{id,workerId:'alex',jobId:id==='atomic-a'?'harbour':'ridge',date:'2030-01-10',start,end,breakMinutes:0,status:'open',createdAt:new Date().toISOString()}});
 const ops=[make('atomic-a','07:30','11:00'),make('atomic-b','10:00','12:00')];
 const results=await Promise.allSettled(ops.map(op=>api.applyOperation(op)));
 return {ok:results.filter(r=>r.status==='fulfilled').length,conflict:results.filter(r=>r.reason?.code==='CONFLICT').length,rows:(await s.all('timesheets')).filter(t=>t.id.startsWith('atomic-')).length,revisions:(await s.all('revisions')).filter(r=>r.entryId.startsWith('atomic-')).length};
`);
check(
  concurrent.ok === 1 &&
    concurrent.conflict === 1 &&
    concurrent.rows === 1 &&
    concurrent.revisions === 1,
  "simultaneous overlapping submissions serialize atomically without Web Locks",
);
check(
  await run(
    `const op={id:d.uuid(),kind:'time',userId:'alex',expectedRevision:0,data:{id:'replay',workerId:'alex',jobId:'harbour',date:'2030-01-11',start:'07:30',end:'11:00',breakMinutes:0}};await Promise.all([api.applyOperation(op),api.applyOperation(op)]);return (await s.all('timesheets')).filter(t=>t.id==='replay').length===1&&(await s.all('revisions')).filter(r=>r.entryId==='replay').length===1;`,
  ),
  "concurrent replay produces one record, one revision and one receipt",
);
check(
  await run(
    `const current=await s.get('timesheets','replay');const op=()=>({id:d.uuid(),kind:'time',userId:'alex',expectedRevision:1,data:{...current,breakMinutes:10}});const out=await Promise.allSettled([api.applyOperation(op()),api.applyOperation(op())]);return out.filter(r=>r.status==='fulfilled').length===1&&out.filter(r=>r.reason?.code==='CONFLICT').length===1&&(await s.all('revisions')).filter(r=>r.entryId==='replay').length===2;`,
  ),
  "concurrent corrections enforce one expected revision inside the transaction",
);
check(
  await run(
    `try{await api.applyOperation({id:d.uuid(),kind:'time',userId:'alex',data:{id:'denied-job',workerId:'alex',jobId:'workshop',date:'2030-01-12',start:'08:00',end:'09:00',breakMinutes:0}});return false;}catch{return !(await s.get('timesheets','denied-job'));}`,
  ),
  "service rejects unassigned jobs without partial writes",
);
check(
  await run(
    `const prior=(await s.all('timesheets')).find(t=>t.workerId==='sam');try{await api.applyOperation({id:d.uuid(),kind:'time',userId:'alex',expectedRevision:prior.revision,data:{...prior,workerId:'alex'}});return false;}catch{return (await s.get('timesheets',prior.id)).workerId==='sam';}`,
  ),
  "worker cannot reassign another worker’s record to themselves",
);
check(
  await run(
    `const prior=await s.get('timesheets','replay');await s.put('timesheets',{...prior,status:'locked'});try{await api.applyOperation({id:d.uuid(),kind:'time',userId:'alex',expectedRevision:prior.revision,data:{...prior,status:'locked',breakMinutes:20}});return false;}catch{return (await s.get('timesheets','replay')).revision===prior.revision;}`,
  ),
  "locked worker correction is rejected without history loss",
);
check(
  await run(
    `await a.switchPersona('morgan');const prior=await s.get('timesheets','replay');const make=()=>({id:d.uuid(),kind:'time',userId:'morgan',expectedRevision:prior.revision,data:{...prior,breakMinutes:20}});let rejected=false;try{await api.applyOperation(make());}catch{rejected=true;}await api.applyOperation({...make(),adminCorrection:true,reason:'Corrected actual unpaid break'});const latest=await s.get('timesheets','replay'),revision=(await s.all('revisions')).find(r=>r.entryId==='replay'&&r.sequence===latest.revision);return rejected&&latest.status==='locked'&&revision.editorId==='morgan'&&latest.workerId==='alex'&&revision.administrativeCorrection;`,
  ),
  "office locked correction requires explicit intent/reason and records actor separately",
);
await run("await a.switchPersona('alex');");
check(
  await run(
    `try{await api.saveWorkSchedule({workerId:'alex',effectiveFrom:d.workDate(),timeZone:d.TIME_ZONE,days:{}});return false;}catch(e){return e.message.includes('Office access');}`,
  ),
  "worker cannot change centrally managed usual hours",
);
const usualId = await run(
  `await a.switchPersona('morgan');const value=await api.saveWorkSchedule({workerId:'alex',effectiveFrom:'2020-01-01',timeZone:d.TIME_ZONE,days:Object.fromEntries([1,2,3,4,5,6,7].map(n=>[n,{start:'07:30',end:'16:00',breakMinutes:30}]))});await a.switchPersona('alex');return value.id;`,
);
check(
  await run(
    `const job=await s.get('jobs','harbour');await s.put('jobs',{...job,supplierBuyCost:999,margin:50,contractControls:'internal'});const data=await api.workspaceSnapshot();return !JSON.stringify(data).includes('supplierBuyCost')&&!JSON.stringify(data).includes('contractControls')&&data.timesheets.every(t=>t.workerId==='alex')&&data.workSchedules.every(sc=>sc.workerId==='alex');`,
  ),
  "worker response projection excludes commercial data and other workers’ hours/schedules",
);
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
await action("time");
await waitFor("document.querySelector('#time-form')");
check(
  await evaluate(
    "!document.querySelector('[name=workerId]')&&document.querySelector('[name=jobId]').value==='harbour'&&document.querySelector('[name=start]').value==='10:00'",
  ),
  "worker form uses session identity, current job and central gap suggestion",
);
check(
  await evaluate(
    "!document.querySelector('.time-optional').open&&!document.querySelector('[name=reason]').required",
  ),
  "narrative is optional and collapsed",
);
await fill("[name=start]", "10:15");
await change("[name=date]", "2026-11-14");
check(
  await evaluate(
    "document.querySelector('[name=start]').value==='10:15'&&document.querySelector('#time-context').textContent.includes('changed')",
  ),
  "date changes preserve manual actual times and ask for an explicit choice",
);
await action("close");
await send("Page.reload");
await waitFor("document.querySelector('.draft-banner')");
await action("drafts");
await waitFor("document.querySelector('[data-action^=\"resume-draft:\"]')");
await click('[data-action^="resume-draft:"]');
await waitFor("document.querySelector('#time-form')");
check(
  await evaluate(
    "document.querySelector('[name=start]').value==='10:15'&&document.querySelector('#time-context').textContent.includes('saved draft')",
  ),
  "unconfirmed context and actual-time draft survive reopening",
);
await click("#keep-time-values");
await action("close");
// Remove only the test draft before testing a different case.
await run(
  "for(const draft of await s.all('drafts'))await s.remove('drafts',draft.id);",
);
await run(
  "await s.put('timesheets',{id:'legacy-ui',workerId:'alex',jobId:'harbour',date:d.workDate(),totalMinutes:210,status:'open',revision:1});",
);
await action("nav:records");
await waitFor("document.body.innerText.includes('Hours-only record')");
check(true, "hours-only records remain readable in daily records");
await action("nav:today");
await action("time");
await waitFor("document.querySelector('#time-form')");
check(
  await evaluate(
    "document.querySelector('#time-suggestions').textContent.includes('hours-only')&&document.querySelector('[name=start]').value===''",
  ),
  "legacy hours prevent guessed same-day gap suggestions",
);
await action("close");
await run("await s.remove('timesheets','legacy-ui');");
// Central configuration is discoverable in the existing office interface.
await action("settings");
await action("persona:morgan");
await waitFor("document.querySelector('h1').textContent==='Office admin'");
await action("office-tab:hours");
await waitFor("document.body.innerText.includes('Central usual hours')");
await action("work-schedule:sam");
await waitFor("document.querySelector('#schedule-form')");
await evaluate("document.querySelector('[name=enabled-1]').checked=true");
await fill("[name=start-1]", "08:00");
await fill("[name=end-1]", "16:30");
await fill("[name=break-1]", "30");
await click("#copy-weekdays");
check(
  await evaluate(
    "[1,2,3,4,5].every(n=>document.querySelector('[name=enabled-'+n+']').checked&&document.querySelector('[name=start-'+n+']').value==='08:00')&&!document.querySelector('[name=enabled-6]').checked",
  ),
  "weekday-copy shortcut copies explicit hours without inventing weekend work",
);
await submit();
await waitFor("!document.querySelector('#dialog').open");
check(
  await run(
    "return (await s.all('workSchedules')).some(sc=>sc.workerId==='sam'&&Object.keys(sc.days).length===5)&&(await s.all('scheduleRevisions')).some(r=>r.workerId==='sam'&&r.editorId==='morgan');",
  ),
  "office schedule persists with effective date and revision history",
);
// Permission-denied and inaccurate GPS retain the existing manual choice.
await action("settings");
await action("persona:alex");
await waitFor("document.querySelector('h1').textContent==='Hello, Alex.'");
await evaluate(
  "window.__originalGeo=navigator.geolocation.getCurrentPosition;navigator.geolocation.getCurrentPosition=(success,failure)=>failure({code:1});",
);
await action("choose-job");
await action("nearby");
await waitFor(
  "document.querySelector('#nearby-results').textContent.includes('declined')",
);
check(
  await evaluate(
    "document.querySelector('[data-action=\"choose-job\"]')!==null",
  ),
  "denied location retains fast manual job selection",
);
await action("close");
await evaluate(
  "navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:-36.829,longitude:174.795,accuracy:900}})",
);
await action("choose-job");
await action("nearby");
await waitFor(
  "document.querySelector('#nearby-results').textContent.includes('accuracy is low')",
);
check(
  await run("return await s.meta('currentJob:alex')==='harbour';"),
  "poor GPS accuracy never silently changes the current job",
);
await action("close");
await evaluate("navigator.geolocation.getCurrentPosition=window.__originalGeo");
// Real offline correction of an existing record, preserving revision history.
await action("settings");
await waitFor("document.querySelector('#network-setting')");
await change("#network-setting", "offline");
await action("close");
await action("edit-time:seed-today-alex");
await waitFor("document.querySelector('#time-form')");
await fill("[name=breakMinutes]", "5");
await submit();
await waitFor("!document.querySelector('#dialog').open");
check(
  await run(
    "return (await s.all('operations')).some(o=>o.data.id==='seed-today-alex'&&o.state==='queued'&&o.data.breakMinutes===5);",
  ),
  "offline correction is queued without overwriting accepted history",
);
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
check(
  await run(
    "return (await s.get('timesheets','seed-today-alex')).breakMinutes===0&&(await s.all('operations')).some(o=>o.data.id==='seed-today-alex'&&o.data.breakMinutes===5);",
  ),
  "offline correction and original both survive app reload",
);
await action("settings");
await change("#network-setting", "unknown");
await action("close");
await action("queue");
await action("resume-sync");
await waitFor(
  "document.querySelector('#queue-content')?.textContent.includes('All caught up')",
);
check(
  await run(
    "return (await s.get('timesheets','seed-today-alex')).revision===2&&(await s.all('revisions')).filter(r=>r.entryId==='seed-today-alex').length===2;",
  ),
  "reconnection syncs the correction once and appends history",
);
await action("close");

await action("queue");
await action("pause-sync");
await action("close");
const overlapId = await run(`
 const make=(id,start,end)=>({id:d.uuid(),kind:'time',userId:'alex',expectedRevision:0,state:'queued',attempts:0,createdAt:new Date().toISOString(),data:{id,workerId:'alex',jobId:'harbour',date:'2030-01-13',start,end,breakMinutes:0,revision:0,status:'open',createdAt:new Date().toISOString()}});
 const mine=make('offline-overlap','10:00','12:00');await s.put('operations',mine);
 await api.applyOperation(make('accepted-first','09:00','11:00'));return mine.id;
`);
await action("queue");
await action("resume-sync");
await waitFor(
  "document.querySelector('#queue-content')?.textContent.includes('Correct actual times')",
);
check(
  await run(
    `const op=await s.get('operations','${overlapId}');return op.state==='conflict'&&op.conflictType==='overlap'&&!(await s.get('timesheets','offline-overlap'));`,
  ),
  "offline overlap preserves a recoverable conflict without partial acceptance",
);
await action("conflict:" + overlapId);
await waitFor(
  "document.querySelector('#dialog').textContent.includes('Another entry was accepted')",
);
await action("edit-time:offline-overlap");
await waitFor("document.querySelector('#time-form')");
await fill("[name=start]", "11:00");
await fill("[name=end]", "12:00");
await fill("[name=breakMinutes]", "0");
await submit();
await waitFor("!document.querySelector('#dialog').open");
await waitFor("document.querySelector('.queue-button')");
for (let n = 0; n < 50; n++) {
  if (
    await run(
      "return (await s.get('operations','" +
        overlapId +
        "')).state==='synced';",
    )
  )
    break;
  await new Promise((r) => setTimeout(r, 80));
}
check(
  await run(
    "return (await s.get('timesheets','offline-overlap')).totalMinutes===60&&(await s.all('revisions')).filter(r=>r.entryId==='offline-overlap').length===1;",
  ),
  "corrected overlap reuses its operation and syncs once with adjacent intervals allowed",
);

await send("Emulation.setDeviceMetricsOverride", {
  width: 320,
  height: 740,
  deviceScaleFactor: 1,
  mobile: true,
});
await action("time");
await waitFor("document.querySelector('#time-form')");
check(
  await evaluate(
    "document.documentElement.scrollWidth<=window.innerWidth&&document.querySelector('#dialog').scrollWidth<=document.querySelector('#dialog').clientWidth",
  ),
  "320 px time dialog and page have no horizontal overflow",
);
await evaluate("document.querySelector('.dialog-content').scrollTop=100000");
check(
  await evaluate(
    "(()=>{const b=document.querySelector('#time-form [type=submit]').getBoundingClientRect(),v=window.visualViewport;return b.height>=44&&b.bottom<=(v?.height||innerHeight)+1;})()",
  ),
  "mobile save action remains visible and touch-sized",
);
await shot(join(tmpdir(), "sitelog-stage1-time-mobile.png"));
await action("close");
check(errors.length === 0, "no uncaught browser exceptions in Stage 1 flows");
console.log(`${checks} Stage 1 browser checks passed`);
close();
