# Branded XLSX staged follow-up

A3 provides branded HTML print/Save as PDF and correctly named CSV snapshots. There is no XLSX file disguised as CSV and no spreadsheet dependency yet.

The next export slice must first review and record an exact commercially permitted library/version and its transitive licences, or implement a narrowly scoped native OOXML writer with an independently reviewed ZIP/CRC/XML implementation. Package size and maintenance cost must justify the dependency. It must consume the same `quoteIssues.client` projection as print/CSV, never mutable price-book rows or office snapshots.

Acceptance tests: an independent spreadsheet parser opens the workbook; company/client identity, quote number/revision, NZD quantities/rates/GST/totals and ordered terms match the saved issue exactly; cells starting with =, +, -, @, tabs or newlines remain literal strings; no supplier costs, margins, override reasons or private contact fields occur anywhere in the ZIP; hostile XML text is escaped; filename and MIME match real XLSX; later template/catalogue edits never affect the workbook. Test LibreOffice and Excel rendering and long clauses before marking this follow-up complete. No external service is required.
