import assert from "node:assert/strict";
import { send, evaluate, waitFor, click, fill, errors, close } from "./cdp.mjs";
const origin = process.env.SITELOG_TEST_ORIGIN || "http://localhost:4173";
let count = 0;
const check = (v, label) => {
  assert.ok(v, label);
  count++;
  console.log("PASS A2:", label);
};
const run = (body) =>
  evaluate(
    `(async()=>{const root=new URL('./',document.querySelector('script[type=module][src]').src).href;const s=await import(root+'store.mjs'),a=await import(root+'mock-auth.mjs'),c=await import(root+'commercial-service.mjs'),d=await import(root+'domain.mjs');${body}})()`,
  );
async function action(name) {
  await waitFor(`document.querySelector('[data-action="${name}"]')`);
  await click(`[data-action="${name}"]`);
}
const submit = () =>
  evaluate("document.querySelector('#dialog form').requestSubmit()");
await send("Page.navigate", { url: origin + "/sitelog/" });
await waitFor("document.querySelector('.current-job')");
await run(
  "await s.reset();await(await import(root+'seed.mjs')).seed();await a.switchPersona('morgan');await s.setMeta('paused',true);",
);
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
await action("nav:office");
await waitFor("document.querySelector('h1').textContent==='Office admin'");
const fixture = await run(`
 const customer=await c.saveContact({name:'Fictional Customer',roles:['customer'],active:true});
 const supplierA=await c.saveContact({name:'Fictional Supplier A',roles:['supplier','subcontractor'],active:true,supplierState:'approved'});
 const pending=supplierA.supplierState;
 const approvedA=await c.decideApproval(supplierA.id,'supplier','approved',{expectedRevision:supplierA.revision,reason:'Demo review recorded'});
 const b=await c.saveContact({name:'Fictional Supplier B',roles:['supplier'],active:true});
 const approvedB=await c.decideApproval(b.id,'supplier','approved',{expectedRevision:b.revision,reason:'Demo supplier review'});
 const item=await c.saveCatalogItem({name:'100 mm drainage pipe',code:'TEST-PIPE',uom:'m',sellRate:'20',active:true});
 const pA=await c.saveSupplierPrice({itemId:item.id,supplierId:supplierA.id,purchaseUom:'m',purchaseRate:'10',effectiveFrom:'2026-01-01',active:true});
 const pB=await c.saveSupplierPrice({itemId:item.id,supplierId:b.id,purchaseUom:'pack',purchaseRate:'72',unitsPerPurchase:'6',effectiveFrom:'2026-01-01',leadTime:'Allow 3 days',active:true});
 const rate=await c.saveClientRate({itemId:item.id,customerId:customer.id,sellRate:'18',effectiveFrom:'2026-01-01',active:true});
 return {customer,supplierA:approvedA,supplierB:approvedB,item,pA,pB,rate,pending};
`);
check(
  fixture.pending === "pending",
  "new suppliers cannot inject an approved status",
);
check(
  fixture.supplierA.roles.length === 2,
  "one contact supports supplier and subcontractor roles",
);
const price = await run(
  `return c.priceSelection({itemId:'${fixture.item.id}',supplierId:'${fixture.supplierB.id}',customerId:'${fixture.customer.id}',date:'2026-11-13'});`,
);
check(
  price.sellRate === "18" &&
    price.procurement.costPerSellingUnit === "12" &&
    price.rateSource === "client",
  "client sell price and selected supplier buy cost stay distinct",
);
check(
  await run(
    `const m=await import(root+'money.mjs');return m.lineCents('2.5','${price.procurement.costPerSellingUnit}')===3000;`,
  ),
  "2.5 m requirement uses NZD 30 buy cost, not its sell total",
);
check(
  await run(
    `const p=await c.priceSelection({itemId:'${fixture.item.id}',customerId:'${fixture.customer.id}',manualRate:'17',manualReason:'Agreed office exception',date:'2026-11-13'});return p.sellRate==='17'&&p.rateSource==='manual'&&p.rateReason==='Agreed office exception';`,
  ),
  "manual override with a reason takes precedence",
);
check(
  await run(
    `try{await c.saveClientRate({itemId:'${fixture.item.id}',customerId:'${fixture.customer.id}',sellRate:'19',effectiveFrom:'2026-06-01',active:true});return false;}catch(e){return e.message.includes('overlap');}`,
  ),
  "overlapping client-rate periods are blocked",
);
check(
  await run(
    `try{await c.saveSupplierPrice({itemId:'${fixture.item.id}',supplierId:'${fixture.supplierB.id}',purchaseUom:'pack',purchaseRate:'70',effectiveFrom:'2026-02-01',active:true});return false;}catch(e){return e.message.includes('selling units');}`,
  ),
  "mismatched UOM needs an explicit conversion",
);
check(
  await run(
    `const old=await s.get('supplierPrices','${fixture.pB.id}');await c.saveSupplierPrice({...old,purchaseRate:'78'},{expectedRevision:old.revision});return (await s.all('commercialRevisions')).some(r=>r.entityId===old.id&&r.after.purchaseRate==='72');`,
  ),
  "price revisions retain previous purchase values",
);
check(
  await run(
    `const old=await s.get('catalogItems','${fixture.item.id}');const results=await Promise.allSettled([c.saveCatalogItem({...old,sellRate:'21'},{expectedRevision:old.revision}),c.saveCatalogItem({...old,sellRate:'22'},{expectedRevision:old.revision})]);return results.filter(r=>r.status==='fulfilled').length===1&&results.some(r=>r.reason?.code==='CONFLICT');`,
  ),
  "concurrent price-book edits require the expected revision",
);
check(
  await run(
    `const contact=await s.get('contacts','${fixture.supplierB.id}');await c.decideApproval(contact.id,'supplier','suspended',{expectedRevision:contact.revision,reason:'Pause new procurement'});try{await c.priceSelection({itemId:'${fixture.item.id}',supplierId:contact.id,date:'2026-11-13'});return false;}catch{return (await s.get('supplierPrices','${fixture.pB.id}')).purchaseRate==='78';}`,
  ),
  "suspended suppliers are blocked for new procurement; history remains readable",
);
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
await action("nav:office");
await action("office-tab:contacts");
await waitFor("document.body.innerText.includes('Fictional Supplier A')");
check(true, "contacts and approvals are discoverable in office navigation");
await fill("#commerce-search", "Supplier A");
await waitFor(
  "document.querySelector('table')&&!document.querySelector('table').textContent.includes('Fictional Customer')",
);
check(
  await evaluate(
    "document.querySelector('table').textContent.includes('Fictional Supplier A')&&!document.querySelector('table').textContent.includes('Fictional Customer')",
  ),
  "office contacts are searchable",
);
await action("office-tab:pricebook");
await fill("#commerce-search", "");
await waitFor("document.querySelector('[data-action^=\"commerce-item:\"]')");
await action("commerce-item:" + fixture.item.id);
await waitFor(
  "document.querySelector('#dialog').textContent.includes('Supplier comparison')",
);
check(
  await evaluate(
    "document.querySelector('#dialog').textContent.includes('gross profit')&&document.querySelector('#dialog').textContent.includes('margin')",
  ),
  "supplier comparison shows comparable costs and margin",
);
await action("close");
await action("office-tab:contacts");
await action("commerce-new-contact");
await waitFor("document.querySelector('[name=name]')");
await fill("[name=name]", "UI Fictional Client");
await evaluate(
  "document.querySelector('[name=roles][value=customer]').checked=true",
);
await submit();
await waitFor("!document.querySelector('#dialog').open");
check(
  await run(
    "return (await s.all('contacts')).some(c=>c.name==='UI Fictional Client');",
  ),
  "office contact form writes a persistent typed record",
);
await run("await a.switchPersona('alex');");
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
check(
  await run(
    "try{await c.commercialWorkspace();return false;}catch(e){const api=await import(root+'mock-api.mjs');const dto=await api.workspaceSnapshot();return e.message.includes('Office access')&&!Object.hasOwn(dto,'contacts')&&!Object.hasOwn(dto,'supplierPrices');}",
  ),
  "workers cannot read commercial service data or receive it in their workspace DTO",
);
check(errors.length === 0, "no uncaught commercial UI exceptions");
console.log(`${count} A2 browser checks passed`);
close();
