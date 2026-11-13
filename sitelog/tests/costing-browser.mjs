import assert from "node:assert/strict";
import { send, evaluate, waitFor, click, fill, errors, close } from "./cdp.mjs";
const origin = process.env.SITELOG_TEST_ORIGIN || "http://localhost:4173";
let count = 0;
const check = (v, label) => {
  assert.ok(v, label);
  count++;
  console.log("PASS A7:", label);
};
const run = (body) =>
  evaluate(
    `(async()=>{const root=new URL('./',document.querySelector('script[type=module][src]').src).href;const s=await import(root+'store.mjs'),a=await import(root+'mock-auth.mjs'),c=await import(root+'commercial-service.mjs'),q=await import(root+'quote-service.mjs'),j=await import(root+'job-authorisation.mjs'),v=await import(root+'variation-service.mjs'),f=await import(root+'costing-service.mjs'),p=await import(root+'purchasing-service.mjs'),d=await import(root+'domain.mjs');${body}})()`,
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
    "!document.querySelector('#dialog').open||document.querySelector('#dialog .form-error')?.textContent",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('#dialog .form-error')?.textContent||''",
    ),
    "",
  );
}
await send("Page.navigate", { url: origin + "/sitelog/" });
await waitFor("document.querySelector('.current-job')");
await run(
  "await s.reset();await(await import(root+'seed.mjs')).seed();await a.switchPersona('morgan');await s.setMeta('paused',true);",
);
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
const fixture = await run(`
 const client=await c.saveContact({name:'Costing Client',roles:['customer'],active:true}),supplier=await c.saveContact({name:'Costing Supplier',roles:['supplier'],active:true});await c.decideApproval(supplier.id,'supplier','approved',{expectedRevision:supplier.revision,reason:'Synthetic review'});await q.saveBranding({name:'Costing test company'});
 let quote=await q.saveQuote({title:'Costed drainage',scope:'Synthetic baseline',customerId:client.id,siteAddress:'Synthetic site',issueDate:d.workDate(),expiryDate:d.shiftDate(d.workDate(),30),taxBps:1500,terms:['Synthetic terms'],termsReviewed:true,lines:[{description:'Material',type:'material',uom:'m',quantity:'2.5',rateMode:'manual',manualRate:'20',manualReason:'Baseline test agreement',estimatedUnitCost:'12'},{description:'Labour',type:'labour',uom:'hour',quantity:'1.5',rateMode:'manual',manualRate:'80',manualReason:'Baseline test agreement',estimatedUnitCost:'40'}]});quote=await q.moveQuote(quote.id,'review',{expectedRevision:quote.revision});quote=await q.moveQuote(quote.id,'issued',{expectedRevision:quote.revision});const acceptance=await j.acceptQuote(quote.id,{issueId:quote.latestIssueId,expectedRevision:quote.revision,reference:'Synthetic baseline acceptance',acceptedBy:'Client',acceptedDate:d.workDate(),workerIds:['alex']});
 const job=acceptance.job,change={jobId:job.id,title:'Additional pipe',reason:'Synthetic pricing basis',scope:'Add pipe',originator:'Client test',date:d.workDate(),direction:'addition',taxBps:1500,lines:[{description:'Additional pipe',type:'material',uom:'m',quantity:'1',sellRate:'10',estimatedUnitCost:'6'}],inspectionPlans:[{description:'Additional inspection'}]};
 const variation=await v.saveVariation(change),submitted=await v.variationAction(variation.id,'submitted',{expectedRevision:variation.revision,reference:'Manual submission test'});
 return {client,supplier,quote,job,change,submitted};
`);
check(
  await run(
    `return (await f.costSummary('${fixture.job.id}')).pendingChanges.sellCents===1000&&(await s.all('materialRequirements')).filter(m=>m.sourceVariationId==='${fixture.submitted.id}').length===0;`,
  ),
  "submitted variation remains pending and generates no material order or requirement",
);
const approvals = await run(
  `const options={expectedRevision:${fixture.submitted.revision},reference:'Synthetic approved change',person:'Client test',date:d.workDate()};return Promise.all([v.variationAction('${fixture.submitted.id}','approved',options),v.variationAction('${fixture.submitted.id}','approved',options)]);`,
);
check(
  approvals.filter((v) => v.replayed).length === 1 &&
    approvals[0].generated.materialIds.length === 1 &&
    approvals[0].generated.inspectionIds.length === 1,
  "concurrent recorded approval generates requirements and inspections exactly once",
);
check(
  await run(
    `const job=await s.get('jobs','${fixture.job.id}');return job.origin.clientSnapshot.subtotalCents===17000&&(await s.all('materialRequirements')).filter(m=>m.sourceVariationId==='${fixture.submitted.id}').length===1;`,
  ),
  "approved variation preserves the original accepted quote baseline",
);
check(
  await run(
    `let pending=await v.saveVariation({...${JSON.stringify(fixture.change)},title:'Pending subcontractor change',lines:[{description:'Allowance',type:'subcontractor',uom:'sum',quantity:'1',sellRate:'50',estimatedUnitCost:'30'}],inspectionPlans:[]});await v.variationAction(pending.id,'submitted',{expectedRevision:pending.revision,reference:'Pending test'});const summary=await f.costSummary('${fixture.job.id}');return summary.original.sellCents===17000&&summary.revised.sellCents===18000&&summary.revised.costCents===9600&&summary.pendingChanges.sellCents===5000;`,
  ),
  "job budget separates original, approved, revised and pending values",
);
check(
  await run(
    `try{await v.saveVariation({...${JSON.stringify(fixture.change)},id:'${fixture.submitted.id}'},{expectedRevision:${approvals[0].revision}});return false;}catch(e){return e.message.includes('explicit revision');}`,
  ),
  "approved variation cannot be edited in place",
);
const actual = await run(`
 await f.saveJobCostRate({jobId:'${fixture.job.id}',hourlyCost:'40',effectiveFrom:'2026-01-01',reason:'Synthetic job-level cost basis'});
 await a.switchPersona('alex');const records=await import(root+'records.mjs');const op=await records.saveRecord('time',{id:d.uuid(),workerId:'alex',jobId:'${fixture.job.id}',date:d.workDate(),start:'18:00',end:'19:00',overnight:false,breakMinutes:0,status:'open',revision:0},await a.requireUser());await(await import(root+'mock-api.mjs')).applyOperation(op);await a.switchPersona('morgan');
 const r=(await s.all('materialRequirements')).find(r=>r.jobId==='${fixture.job.id}'&&!r.sourceVariationId);let order=await p.prepareOrder({jobId:'${fixture.job.id}',supplierId:'${fixture.supplier.id}',requirementIds:[r.id],manualCosts:{[r.id]:{unitCost:'12',reason:'Synthetic supplier confirmation'}}});order=await p.orderDecision(order.id,'manually_issued',{expectedRevision:order.revision,reference:'Manually arranged test order'});await p.recordReceipt(order.id,{requestId:d.uuid(),expectedRevision:order.revision,date:d.workDate(),reference:'Test partial delivery',lines:[{lineId:order.lines[0].id,quantity:'1'}]});
 const commitment=await f.saveCostCommitment({jobId:'${fixture.job.id}',title:'Subcontractor test',amount:'10',status:'committed',date:d.workDate(),reference:'Manual cost basis'});return {summary:await f.costSummary('${fixture.job.id}'),commitment};
`);
check(
  actual.summary.labour.minutes === 60 &&
    actual.summary.labour.knownCostCents === 4000,
  "actual job labour uses accepted current time and an explicit dated job cost rate",
);
check(
  actual.summary.receivedMaterialCents === 1200 &&
    actual.summary.outstandingMaterialCents === 1800 &&
    actual.summary.knownActualCents === 5200 &&
    actual.summary.outstandingCommittedCents === 2800 &&
    actual.summary.knownForecastCents === 8000,
  "received actuals and outstanding material/subcontractor commitments reconcile without double counting",
);
check(
  await run(
    `const old=await s.get('costCommitments','${actual.commitment.id}');await f.saveCostCommitment({...old,amount:'10',status:'completed',changeReason:'Synthetic completion recorded'},{expectedRevision:old.revision});const summary=await f.costSummary('${fixture.job.id}');return summary.knownActualCents===6200&&summary.outstandingCommittedCents===1800&&summary.knownForecastCents===8000;`,
  ),
  "completed subcontractor cost moves from commitment to actual once",
);
check(
  await run(
    `try{await f.saveJobCostRate({jobId:'${fixture.job.id}',hourlyCost:'50',effectiveFrom:'2026-06-01',reason:'Overlap test'});return false;}catch(e){return e.message.includes('overlap');}`,
  ),
  "overlapping labour-cost bases are rejected",
);
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
await action("nav:office");
await action("office-tab:costing");
await action("finance-cost:" + fixture.job.id);
await waitFor(
  "document.querySelector('#dialog').textContent.includes('Known actual subtotal')",
);
check(
  await evaluate(
    "document.querySelector('#dialog').textContent.includes('Pending changes (excluded)')&&document.querySelector('#dialog').textContent.includes('Outstanding ordered material commitment')",
  ),
  "office cost breakdown explains budget and actual/commitment bases",
);
await action("close");
await action("office-tab:variations");
await action("finance-variation-new");
await waitFor(
  "document.querySelector('#variation-editor')&&document.querySelector('#dialog').open",
);
await fill("#dialog [name=jobId]", fixture.job.id);
await fill("#dialog [name=title]", "UI variation");
await fill("#dialog [name=reason]", "Synthetic change basis");
await fill("#dialog [name=scope]", "Synthetic additional scope");
await fill("#dialog [name=originator]", "Client test");
await fill("#dialog [name=description]", "UI material change");
await fill("#dialog [name=sellRate]", "25");
await fill("#dialog [name=estimatedUnitCost]", "15");
await submit();
const ui = await run(
  "return (await s.all('variations')).find(v=>v.title==='UI variation');",
);
check(
  ui.estimate.sellCents === 2500,
  "office variation form saves exact detailed change pricing",
);
await action("finance-variation:" + ui.id);
await action("finance-variation-submit:" + ui.id);
await waitFor(
  "document.querySelector('#dialog').open&&document.querySelector('[name=reference]')",
);
await fill("#dialog [name=reference]", "UI submission record");
await submit();
await action("finance-variation:" + ui.id);
await action("finance-variation-approve:" + ui.id);
await waitFor(
  "document.querySelector('#dialog').open&&document.querySelector('[name=person]')",
);
await fill("#dialog [name=reference]", "UI approval record");
await fill("#dialog [name=person]", "Test client");
await submit();
check(
  await run(
    `return (await s.get('variations','${ui.id}')).status==='approved';`,
  ),
  "office can record submission and approval through the UI",
);
await run("await a.switchPersona('alex');");
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
check(
  await run(
    "try{await f.costingWorkspace();return false;}catch(e){const api=await import(root+'mock-api.mjs'),dto=await api.workspaceSnapshot();return e.message.includes('Office access')&&!Object.hasOwn(dto,'variations')&&!Object.hasOwn(dto,'jobCostRates')&&!Object.hasOwn(dto,'costCommitments');}",
  ),
  "workers cannot read variation pricing, labour cost rates or job costs",
);
check(errors.length === 0, "no uncaught variation or costing UI exceptions");
console.log(`${count} A7 browser checks passed`);
close();
