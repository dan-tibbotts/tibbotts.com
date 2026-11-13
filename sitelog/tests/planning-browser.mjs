import assert from "node:assert/strict";
import { send, evaluate, waitFor, click, fill, errors, close } from "./cdp.mjs";
const origin = process.env.SITELOG_TEST_ORIGIN || "http://localhost:4173";
let count = 0;
const check = (v, label) => {
  assert.ok(v, label);
  count++;
  console.log("PASS A5:", label);
};
const run = (body) =>
  evaluate(
    `(async()=>{const root=document.querySelector('script[type=module][src]').src.replace(/app.mjs$/,'');const s=await import(root+'store.mjs'),a=await import(root+'mock-auth.mjs'),c=await import(root+'commercial-service.mjs'),p=await import(root+'planning-service.mjs'),b=await import(root+'purchasing-service.mjs'),d=await import(root+'domain.mjs');${body}})()`,
  );
async function action(name) {
  await waitFor(`document.querySelector('[data-action="${name}"]')`);
  await click(`[data-action="${name}"]`);
}
async function submitAndClose() {
  const invalid = await evaluate(
    "[...document.querySelector('#dialog form').elements].filter(e=>e.willValidate&&!e.validity.valid).map(e=>({name:e.name,value:e.value,message:e.validationMessage}))",
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
const f = await run(`
 const sub=await c.saveContact({name:'Planning Supplier',roles:['supplier','subcontractor'],active:true});await c.decideApproval(sub.id,'supplier','approved',{expectedRevision:sub.revision,reason:'Test supplier approval'});
 const item=await c.saveCatalogItem({name:'Planning pipe',uom:'m',sellRate:'20',active:true});await c.saveSupplierPrice({itemId:item.id,supplierId:sub.id,purchaseUom:'pack',purchaseRate:'72',unitsPerPurchase:'6',effectiveFrom:'2026-01-01',active:true});
 const r=await b.addRequirement({jobId:'harbour',itemId:item.id,description:'Planning pipe requirement',quantity:'2.5',uom:'m',neededBy:d.workDate()});
 const input={jobId:'harbour',title:'Drainage crew plan',startDate:d.workDate(),endDate:d.workDate(),start:'08:00',end:'16:00',status:'planned',workerIds:['alex'],subcontractorIds:[],dependsOn:[],requirementIds:[r.id],sharedWithWorkers:true,notes:'Synthetic site plan'};
 return {sub,item,r,input,date:d.workDate()};
`);
check(
  await run(
    `try{await p.saveActivity(${JSON.stringify(f.input)});return false;}catch(e){return e.message.includes('Materials not ready');}`,
  ),
  "material readiness blocks an unexplained plan override",
);
const first = await run(
  `return p.saveActivity({...${JSON.stringify(f.input)},overrideReason:'Delivery arranged before this work starts'});`,
);
check(
  first.warnings.length === 1 && !!first.overrideReason,
  "readiness override records warnings and a reason",
);
check(
  await run(
    `try{await p.saveActivity({...${JSON.stringify(f.input)},requirementIds:[],title:'Conflicting crew',workerIds:['alex']});return false;}catch(e){return e.message.includes('Overlapping allocation');}`,
  ),
  "same-worker overlapping commitments are detected across plans",
);
check(
  await run(
    `try{await p.saveActivity({...${JSON.stringify(f.input)},workerIds:[],requirementIds:[],subcontractorIds:['${f.sub.id}'],title:'Subcontractor review'});return false;}catch(e){return e.message.includes('approval/insurance');}`,
  ),
  "unapproved subcontractor commitment warns and needs an override",
);
const order = await run(
  `return b.prepareOrder({jobId:'harbour',supplierId:'${f.sub.id}',requirementIds:['${f.r.id}'],expectedDelivery:d.workDate()});`,
);
check(
  order.status === "prepared" &&
    order.lines[0].unitCost === "12" &&
    order.lines[0].estimatedCents === 3000,
  "prepared order uses supplier buying cost, not the sell rate",
);
check(
  await run(
    `try{await b.prepareOrder({jobId:'harbour',supplierId:'${f.sub.id}',requirementIds:['${f.r.id}']});return false;}catch(e){return e.message.includes('already reserved');}`,
  ),
  "requirements cannot be double-ordered while reserved",
);
const issued = await run(
  `return b.orderDecision('${order.id}','manually_issued',{expectedRevision:${order.revision},reference:'Synthetic order arranged manually'});`,
);
check(
  issued.status === "manually_issued",
  "manual issue is recorded separately from preparing an internal order",
);
const receipt = await run(
  `const requestId=d.uuid(),input={requestId,expectedRevision:${issued.revision},date:d.workDate(),reference:'Partial delivery test',lines:[{lineId:'${order.lines[0].id}',quantity:'1',actualUnitCost:'11'}]};const first=await b.recordReceipt('${order.id}',input),second=await b.recordReceipt('${order.id}',input);return {first,second};`,
);
check(
  receipt.first.order.status === "partially_received" &&
    receipt.second.replayed &&
    receipt.first.receipts[0].actualCents === 1100,
  "partial receipt keeps outstanding quantity and idempotent actual costs",
);
check(
  await run(
    `return (await s.get('materialRequirements','${f.r.id}')).status==='partially_received'&&(await s.all('materialReceipts')).length===1;`,
  ),
  "a partial arrival never marks the complete requirement received",
);
check(
  await run(
    `try{await b.recordReceipt('${order.id}',{requestId:d.uuid(),expectedRevision:${receipt.first.order.revision},date:d.workDate(),reference:'Overdelivery test',lines:[{lineId:'${order.lines[0].id}',quantity:'2'}]});return false;}catch(e){return e.message.includes('Over-delivery');}`,
  ),
  "over-delivery requires a deliberate recorded reason",
);
const complete = await run(
  `return b.recordReceipt('${order.id}',{requestId:d.uuid(),expectedRevision:${receipt.first.order.revision},date:d.workDate(),reference:'Remaining delivery',lines:[{lineId:'${order.lines[0].id}',quantity:'1.5'}]});`,
);
check(
  complete.order.status === "received" &&
    (await run(
      `return (await s.get('materialRequirements','${f.r.id}')).receivedQuantity==='2.5';`,
    )),
  "only complete quantities produce received status",
);
const dep = await run(
  `return p.saveActivity({...${JSON.stringify(f.input)},title:'Dependent work',start:'16:00',end:'17:00',dependsOn:['${first.id}'],requirementIds:[]});`,
);
check(
  await run(
    `const before=JSON.stringify(await s.all('timesheets')),old=await s.get('activities','${first.id}');await p.saveActivity({...old,end:'15:00'},{expectedRevision:old.revision});return (await s.get('activities','${dep.id}')).needsReview&&JSON.stringify(await s.all('timesheets'))===before;`,
  ),
  "rescheduling flags dependent plans without rewriting actual worker times",
);
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
await action("nav:office");
await action("office-tab:planning");
await waitFor("document.body.textContent.includes('Drainage crew plan')");
check(true, "office week schedule displays planned work");
await action("plan-activity-new");
await waitFor(
  "document.querySelector('#dialog').open&&document.querySelector('[name=title]')",
);
await fill("[name=title]", "UI planned activity");
await fill("[name=start]", "17:00");
await fill("[name=end]", "18:00");
await fill("[name=overrideReason]", "UI test planning review");
await submitAndClose();
check(
  await run(
    "return (await s.all('activities')).some(a=>a.title==='UI planned activity');",
  ),
  "office schedule form persists a plan",
);
await action("office-tab:materials");
await waitFor("document.body.textContent.includes('Materials & purchasing')");
check(
  await evaluate(`document.body.textContent.includes('${order.number}')`),
  "office materials page links purchase-order history",
);
await action("plan-requirement-new");
await waitFor(
  "document.querySelector('#dialog').open&&document.querySelector('[name=quantity]')",
);
await fill("[name=jobId]", "harbour");
await fill("#dialog [name=description]", "UI material requirement");
await fill("[name=quantity]", "1");
await fill("[name=uom]", "ea");
await submitAndClose();
const uiRequirement = await run(
  "return (await s.all('materialRequirements')).find(r=>r.description==='UI material requirement');",
);
check(!!uiRequirement, "office material form adds a typed job requirement");
await action("plan-order-new:harbour");
await waitFor(
  "document.querySelector('#dialog').open&&document.querySelector('[name=requirementIds]')",
);
await evaluate(
  `document.querySelector('[name=requirementIds][value="${uiRequirement.id}"]').checked=true`,
);
await fill(`[name="cost:${uiRequirement.id}"]`, "5");
await fill(
  `[name="reason:${uiRequirement.id}"]`,
  "Synthetic agreed purchasing rate",
);
await submitAndClose();
const uiOrder = await run(
  `return (await s.all('purchaseOrders')).find(o=>o.lines.some(l=>l.requirementId==='${uiRequirement.id}'));`,
);
check(
  uiOrder.status === "prepared" && uiOrder.lines[0].unitCost === "5",
  "office purchase-order form preserves manual cost and its reason",
);
await action("plan-order:" + uiOrder.id);
await action("plan-order-issue:" + uiOrder.id);
await waitFor(
  "document.querySelector('#dialog').open&&document.querySelector('[name=reference]')",
);
await fill("[name=reference]", "UI manual arrangement");
await submitAndClose();
await action("plan-order:" + uiOrder.id);
await action("plan-receipt:" + uiOrder.id);
await waitFor(
  "document.querySelector('#dialog').open&&document.querySelector('[name=date]')",
);
await fill("[name=reference]", "UI partial delivery note");
await fill(`[name="qty:${uiOrder.lines[0].id}"]`, "0.4");
await submitAndClose();
check(
  await run(
    `return (await s.get('purchaseOrders','${uiOrder.id}')).status==='partially_received'&&(await s.get('materialRequirements','${uiRequirement.id}')).receivedQuantity==='0.4';`,
  ),
  "office delivery form records an exact partial receipt",
);
await run("await a.switchPersona('alex');");
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
await waitFor("document.body.textContent.includes('My schedule / upcoming')");
check(
  await run(
    `const api=await import(root+'mock-api.mjs'),dto=await api.workspaceSnapshot();return dto.upcomingActivities.some(a=>a.id==='${first.id}')&&!JSON.stringify(dto.upcomingActivities).includes('overrideReason')&&!JSON.stringify(dto.deliveries).includes('unitCost')&&!Object.hasOwn(dto,'purchaseOrders');`,
  ),
  "workers receive only permitted schedule/delivery summaries without commercial values",
);
await send("Network.enable");
await send("Network.emulateNetworkConditions", {
  offline: true,
  latency: 0,
  downloadThroughput: 0,
  uploadThroughput: 0,
});
await send("Page.reload");
await waitFor("document.body.textContent.includes('Drainage crew plan')");
check(true, "authorised schedule remains readable after an offline reload");
await send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});
check(
  await run(
    "try{await p.planningWorkspace();return false;}catch(e){return e.message.includes('Office access');}",
  ),
  "worker cannot read office planning and purchasing tables",
);
check(errors.length === 0, "no uncaught planning UI exceptions");
console.log(`${count} A5 browser checks passed`);
close();
