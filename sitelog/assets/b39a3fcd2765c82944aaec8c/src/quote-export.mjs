import { escape as e } from "./ui.mjs";
import { csvCell } from "./domain.mjs";
import { money } from "./money.mjs";
export function quoteHTML(q) {
  return `<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${e(q.number)} — ${e(q.branding.name)}</title><style>body{font:15px/1.5 system-ui,sans-serif;color:#183d36;max-width:900px;margin:40px auto;padding:20px}h1{font-size:30px}header{border-bottom:3px solid #183d36;margin-bottom:24px}small{color:#536962}p,li{white-space:pre-wrap}table{width:100%;border-collapse:collapse;margin:24px 0}td,th{text-align:left;border-bottom:1px solid #cbd6d2;padding:10px 6px}td:last-child,th:last-child{text-align:right}.totals{margin-left:auto;width:320px}.totals p{display:flex;justify-content:space-between}footer{margin-top:32px;font-size:12px}@media print{body{margin:0;max-width:none}tr,li{break-inside:avoid}.screen-only{display:none}}</style></head><body><p class="screen-only">Use your browser’s Print → Save as PDF to save this exact issued snapshot.</p><header><h1>${e(q.branding.name)}</h1><p>${e(q.branding.details)}</p><h2>Quote ${e(q.number)} · Revision ${q.revision}</h2></header><p><strong>${e(q.recipient.name)}</strong><br>${e(q.recipient.contactPerson)}<br>${e(q.recipient.email)} ${e(q.recipient.phone)}</p><p>Issued ${e(q.issueDate)} · Valid until ${e(q.expiryDate)}</p><h2>${e(q.title)}</h2><p>${e(q.scope)}</p><p>Site: ${e(q.siteAddress)}${q.lat !== null ? ` (${q.lat}, ${q.lng})` : ""}</p><table><thead><tr><th>Description</th><th>Unit</th><th>Qty</th><th>Rate excl GST</th><th>Amount</th></tr></thead><tbody>${q.lines.map((l) => `<tr><td>${e(l.description)}${l.notes ? `<br><small>${e(l.notes)}</small>` : ""}</td><td>${e(l.uom)}</td><td>${e(l.quantity)}</td><td>${e(l.sellRate)}</td><td>${money(l.lineCents)}</td></tr>`).join("")}</tbody></table><div class="totals"><p>Subtotal <strong>${money(q.subtotalCents)}</strong></p><p>GST (${q.taxBps / 100}%) <strong>${money(q.taxCents)}</strong></p><p>Total NZD <strong>${money(q.totalCents)}</strong></p></div><h2>Terms & conditions</h2><ol>${q.terms.map((t) => `<li>${e(t)}</li>`).join("")}</ol>${q.exclusions.length ? `<h2>Exclusions</h2><ul>${q.exclusions.map((t) => `<li>${e(t)}</li>`).join("")}</ul>` : ""}<p>${e(q.comments)}</p><footer>${e(q.number)} · Revision ${q.revision} · NZD. This document records the issued quotation.</footer></body></html>`;
}
export function quoteCSV(q) {
  const rows = [
    [q.branding.name],
    [q.branding.details],
    ["Quote", q.number, "Revision", q.revision],
    ["Customer", q.recipient.name],
    ["Title", q.title],
    ["Scope", q.scope],
    ["Site", q.siteAddress],
    ["Issue date", q.issueDate, "Expiry", q.expiryDate],
    [
      "Description",
      "Type",
      "UOM",
      "Quantity",
      "Sell rate NZD excl GST",
      "Amount cents NZD",
    ],
    ...q.lines.map((l) => [
      l.description,
      l.type,
      l.uom,
      l.quantity,
      l.sellRate,
      l.lineCents,
    ]),
    ["Subtotal cents", q.subtotalCents],
    ["GST basis points", q.taxBps, "GST cents", q.taxCents],
    ["Total cents NZD", q.totalCents],
    ["Terms"],
    ...q.terms.map((t) => [t]),
    ["Exclusions"],
    ...q.exclusions.map((t) => [t]),
    ["Comments", q.comments],
  ];
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
