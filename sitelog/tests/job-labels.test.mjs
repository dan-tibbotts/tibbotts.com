import test from "node:test";
import assert from "node:assert/strict";
import { jobClient, jobSearchText } from "../src/job-labels.mjs";

test("job search resolves clients from contacts, accepted quotes and direct authorisations", () => {
  const data = {
    contacts: [{ id: "customer", name: "Harbour Homes" }],
    quotes: [{ id: "quote", customerId: "customer" }],
    jobAuthorisations: [{ id: "auth", jobId: "direct", customer: "Hill Trust" }],
  };
  assert.equal(jobClient({ customerId: "customer" }, data), "Harbour Homes");
  assert.equal(jobClient({ sourceQuoteId: "quote" }, data), "Harbour Homes");
  assert.equal(jobClient({ id: "direct", authorisationId: "auth" }, data), "Hill Trust");
  assert.equal(jobClient({ clientName: "Worker-visible client" }, {}), "Worker-visible client");
  assert.equal(jobClient({}, {}), "Client not recorded");
  const text = jobSearchText({ name: "Renovation", address: "1 Bay Rd", code: "SL-1", customerId: "customer" }, data);
  for (const term of ["Renovation", "1 Bay Rd", "SL-1", "Harbour Homes"]) assert.ok(text.includes(term));
});
