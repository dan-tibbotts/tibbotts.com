export function jobClient(job, data) {
  const quote = data.quotes?.find((q) => q.id === job.sourceQuoteId || q.id === job.quoteId || q.id === job.acceptedQuoteId || (q.jobId === job.id && q.status === "accepted"));
  return data.contacts?.find((c) => c.id === (job.customerId || job.clientId || quote?.customerId))?.name || job.clientName || job.customerName || data.jobAuthorisations?.find((a) => a.id === job.authorisationId || a.jobId === job.id)?.customer || job.chargeUpAuthorisation?.customer || "Client not recorded";
}
export const jobSearchText = (job, data) => `${job.name} ${job.address} ${job.code || ""} ${jobClient(job, data)}`;
