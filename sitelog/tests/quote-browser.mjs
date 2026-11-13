import assert from "node:assert/strict";
import { send, evaluate, waitFor, click, fill, errors, close } from "./cdp.mjs";
const origin = process.env.SITELOG_TEST_ORIGIN || "http://localhost:4173";
let count = 0;
const check = (v, label) => {
  assert.ok(v, label);
  count++;
  console.log("PASS A3:", label);
};
const run = (body) =>
  evaluate(
    `(async()=>{const root=document.querySelector('script[type=module][src]').src.replace(/app.mjs$/,'');const s=await import(root+'store.mjs'),a=await import(root+'mock-auth.mjs'),c=await import(root+'commercial-service.mjs'),q=await import(root+'quote-service.mjs'),d=await import(root+'domain.mjs');${body}})()`,
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
const fixture = await run(`
 const customer=await c.saveContact({name:'Quote Test Client',roles:['customer'],active:true});
 const supplier=await c.saveContact({name:'Quote Supplier',roles:['supplier'],active:true});
 await c.decideApproval(supplier.id,'supplier','approved',{expectedRevision:supplier.revision,reason:'Test review'});
 const item=await c.saveCatalogItem({name:'Quote Pipe',uom:'m',sellRate:'20',active:true});
 await c.saveSupplierPrice({itemId:item.id,supplierId:supplier.id,purchaseUom:'pack',purchaseRate:'72',unitsPerPurchase:'6',effectiveFrom:'2026-01-01',active:true});
 await q.saveBranding({name:'Fictional Trade Ltd',details:'Test only'});
 const template=await q.saveTerms({name:'Standard',lines:['Demonstration term one','Demonstration term two'],exclusions:['Excluded scope demonstration'],reviewNote:'Synthetic test wording',active:true});
 const input={title:'Standalone drainage',scope:'Install test drainage',customerId:customer.id,siteAddress:'Synthetic test site',lat:null,lng:null,issueDate:d.workDate(),expiryDate:d.shiftDate(d.workDate(),30),taxBps:1500,terms:[...template.lines],exclusions:[...template.exclusions],termsReviewed:true,termsTemplateId:template.id,termsTemplateRevision:template.revision,lines:[{type:'material',itemId:item.id,description:'Pipe',uom:'m',quantity:'2.5',rateMode:'automatic',supplierId:supplier.id}],inspections:[{description:'Drainage test',type:'Drainage',notes:'Test only'}]};
 const quote=await q.saveQuote(input);return {customer,supplier,item,template,quote,input};
`);
check(
  fixture.quote.amounts.totalCents === 5750 &&
    fixture.quote.lines[0].procurement.costPerSellingUnit === "12",
  "standalone quote totals and buy snapshots are exact",
);
check(
  await run(
    `return !(await s.all('jobs')).some(j=>j.sourceQuoteId==='${fixture.quote.id}');`,
  ),
  "draft quote creates no job",
);
check(
  await run(
    `const t=await s.get('termsTemplates','${fixture.template.id}');await q.saveTerms({...t,lines:['Changed template']},{expectedRevision:t.revision});return (await s.get('quotes','${fixture.quote.id}')).terms[0]==='Demonstration term one';`,
  ),
  "template revision does not alter independent quote terms",
);
const issued = await run(
  `let v=await s.get('quotes','${fixture.quote.id}');v=await q.moveQuote(v.id,'review',{expectedRevision:v.revision});return q.moveQuote(v.id,'issued',{expectedRevision:v.revision});`,
);
check(
  issued.status === "issued" && issued.issueRevision === 1,
  "reviewed quote produces its first issued snapshot",
);
check(
  await run(
    `const issue=(await s.all('quoteIssues'))[0];const raw=JSON.stringify(issue.client);return !raw.includes('purchaseRate')&&!raw.includes('procurement')&&!raw.includes('estimatedUnitCost')&&!raw.includes('manualReason')&&issue.client.totalCents===5750;`,
  ),
  "client snapshot excludes costs, supplier selections and private override reasons",
);
check(
  await run(
    `const v=await s.get('quotes','${issued.id}');try{await q.saveQuote({...v,title:'Illegal edit'},{expectedRevision:v.revision});return false;}catch(e){return e.message.includes('revision');}`,
  ),
  "issued quotes reject in-place editing",
);
check(
  await run(
    `const i=await s.get('catalogItems','${fixture.item.id}');await c.saveCatalogItem({...i,sellRate:'99'},{expectedRevision:i.revision});const v=await s.get('quotes','${issued.id}');await q.reviseQuote(v.id,{expectedRevision:v.revision,reason:'Scope review'});const draft=await s.get('quotes',v.id);await q.saveQuote({...draft,termsReviewed:true,lines:draft.lines.map(l=>({...l,supplierId:l.procurement?.supplierId}))},{expectedRevision:draft.revision});const after=await s.get('quotes',v.id);return after.lines[0].sellRate==='20'&&(await s.all('quoteIssues'))[0].client.totalCents===5750;`,
  ),
  "explicit quote revision retains old issued document and existing line prices",
);
check(
  await run(
    `const copies=await Promise.all([q.duplicateQuote('${issued.id}'),q.duplicateQuote('${issued.id}')]);return copies[0].number!==copies[1].number&&copies.every(v=>v.status==='draft'&&v.issueRevision===0);`,
  ),
  "concurrent duplicate-as-draft uses distinct quote numbers",
);
check(
  await run(
    `const t=await s.get('termsTemplates','${fixture.template.id}');const r=await Promise.allSettled([q.saveTerms({...t,name:'Standard A'},{expectedRevision:t.revision}),q.saveTerms({...t,name:'Standard B'},{expectedRevision:t.revision})]);return r.filter(v=>v.status==='fulfilled').length===1;`,
  ),
  "terms revisions enforce optimistic concurrency",
);
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
await action("nav:office");
await action("office-tab:quotes");
await waitFor("document.querySelector('[data-action=quote-new]')");
await action("quote-new");
await waitFor("document.querySelector('#quote-editor')");
await fill("[name=title]", "Recover this quote draft");
await action("quote-editor-tab:terms");
check(
  await evaluate("!document.querySelector('[data-quote-panel=terms]').hidden"),
  "quote tabs navigate without validating unfinished items",
);
await action("quote-add-clause:terms");
await fill("[name=terms]", "A local clause");
await action("quote-editor-tab:review");
check(
  await evaluate(
    "document.querySelector('#quote-totals').textContent.includes('Total')",
  ),
  "quote totals remain present across tabs",
);
await run("await(await import(root+'quote-ui.mjs')).flushQuoteDraft();");
await action("close");
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
await action("nav:office");
await action("office-tab:quotes");
await waitFor("document.querySelector('[data-action^=\"quote-resume:\"]')");
check(
  await evaluate(
    "document.body.textContent.includes('Recover this quote draft')",
  ),
  "unfinished office quote draft survives reload",
);
const draftKey = await run(
  "return (await q.quoteWorkspace()).quoteDrafts.find(d=>d.value.title==='Recover this quote draft').key;",
);
await action("quote-resume:" + draftKey);
await waitFor("document.querySelector('#quote-editor')");
check(
  await evaluate(
    "document.querySelector('[name=terms]').value==='A local clause'",
  ),
  "reopened quote draft preserves independent clauses",
);
await send("Emulation.setDeviceMetricsOverride", {
  width: 320,
  height: 800,
  deviceScaleFactor: 1,
  mobile: true,
});
await action("quote-editor-tab:terms");
check(
  await evaluate(
    "document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('#dialog').scrollWidth<=document.querySelector('#dialog').clientWidth+1",
  ),
  "quote editor fits a 320 px mobile screen",
);
await action("close");
await send("Emulation.clearDeviceMetricsOverride");
await action("office-tab:terms");
await action("quote-new-template");
await waitFor("document.querySelector('#terms-editor')");
await fill("[name=name]", "UI terms");
await fill("[name=templateLines]", "UI reviewed demonstration clause");
await action("quote-add-clause:templateLines");
check(
  await evaluate(
    "document.querySelectorAll('[name=templateLines]').length===2",
  ),
  "template editor adds separate plain-text clause rows",
);
await evaluate("window.savedConfirm=window.confirm;window.confirm=()=>false");
await action("quote-remove-clause");
check(
  await evaluate(
    "document.querySelectorAll('[name=templateLines]').length===2",
  ),
  "removing a populated clause requires confirmation",
);
await evaluate("window.confirm=()=>true");
await action("quote-remove-clause");
await evaluate("window.confirm=window.savedConfirm");
await fill("[name=templateLines]", "UI replacement demonstration term");
await submit();
await waitFor("!document.querySelector('#dialog').open");
await action("quote-return");
await action("quote-new");
await waitFor("document.querySelector('#quote-editor')");
await fill("[name=title]", "UI complete quote");
await fill("[name=scope]", "Synthetic scope");
await fill("[name=siteAddress]", "Synthetic location");
await fill("[name=customerId]", fixture.customer.id);
await fill("[name=expiryDate]", fixture.input.expiryDate);
await action("quote-add-line");
await fill("[data-line-id] [name=description]", "Manual demonstration");
await fill("[data-line-id] [name=manualRate]", "20");
await fill("[data-line-id] [name=manualReason]", "Agreed office demonstration");
await fill("[data-line-id] [name=quantity]", "2.5");
await action("quote-editor-tab:terms");
await fill("[name=termsTemplateId]", fixture.template.id);
await action("quote-copy-template");
await evaluate(
  "document.querySelector('[name=termsReviewed]').checked=true;document.querySelector('[name=termsReviewed]').dispatchEvent(new Event('input',{bubbles:true}))",
);
await submit();
await waitFor(
  "document.querySelector('#dialog').textContent.includes('UI complete quote')&&!document.querySelector('#quote-editor')",
);
const uiQuote = await run(
  "return (await s.all('quotes')).find(v=>v.title==='UI complete quote');",
);
check(
  uiQuote.amounts.totalCents === 5750 && uiQuote.terms.length === 1,
  "office quote editor saves items, terms and exact totals through its form",
);
await action("quote-review:" + uiQuote.id);
await waitFor(
  "document.querySelector('[data-action=\"quote-issue:" + uiQuote.id + "\"]')",
);
await action("quote-issue:" + uiQuote.id);
await waitFor(
  "document.querySelector('[data-action=\"quote-revise:" + uiQuote.id + "\"]')",
);
check(
  await run(
    "return (await s.all('quotes')).find(v=>v.title==='UI complete quote').status==='issued';",
  ),
  "office can review and issue a snapshot through the UI",
);
await action("close");
await run("await s.setMeta('network','offline');");
check(
  await run(
    "try{await q.saveBranding({name:'Offline mutation'});return false;}catch(e){await q.saveEditorDraft('offline-test',{title:'Offline editor draft'});return (await q.quoteWorkspace()).quoteDrafts.some(d=>d.key==='offline-test');}",
  ),
  "central quote mutations block offline while local editor drafts persist",
);
await run("await s.setMeta('network','online');await a.switchPersona('alex');");
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
check(
  await run(
    "try{await q.quoteWorkspace();return false;}catch{const api=await import(root+'mock-api.mjs');const dto=await api.workspaceSnapshot();return !Object.hasOwn(dto,'quotes')&&!Object.hasOwn(dto,'quoteIssues')&&!Object.hasOwn(dto,'termsTemplates');}",
  ),
  "workers cannot read quotes, issued snapshots or terms-management tables",
);
check(errors.length === 0, "no uncaught quote UI exceptions");
console.log(`${count} A3 browser checks passed`);
close();
