// Transport for a configured authenticated backend. No demo identity or fallback.
export function createPortalHttpClient({ baseUrl = "/sitelog/api/portal", fetchImpl = globalThis.fetch } = {}) {
  async function request(path, { method = "GET", body } = {}) {
    const response = await fetchImpl(baseUrl + path, { method, credentials: "same-origin", cache: "no-store", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.message || detail.error || `Portal request failed (${response.status}).`); }
    return response;
  }
  return {
    workspace: async () => (await request("/workspace")).json(),
    async command(name, input = {}) {
      const id = encodeURIComponent(input.id || ""), jobId = encodeURIComponent(input.jobId || "");
      const routes = {
        saveParty: ["/parties", "POST"], savePartyContact: ["/party-contacts", "POST"], saveRepresentative: ["/representatives", "POST"], linkCommercialParties: ["/commercial-parties", "POST"], acceptQuotes: ["/quotes/accept", "POST"], declineQuote: [`/quotes/${id}/decline`, "POST"], authoriseWork: [`/jobs/${jobId}/authorisations`, "POST"], setJobReadiness: [`/jobs/${jobId}/readiness`, "POST"], reviewRecord: [`/records/${encodeURIComponent(input.kind || "")}/${id}`, "PATCH"], acknowledgeInstruction: [`/instructions/${id}/acknowledge`, "POST"], decideVariation: [`/variations/${id}/decision`, "POST"], shareClientDocument: [`/documents/${id}/sharing`, "PATCH"], uploadClientDocument: ["/documents/upload", "POST"],
      };
      if (name === "submitRecord") {
        const kinds = { instruction: "instructions", rfi: "rfis", issue: "issues", variation: "variation-requests" };
        if (!kinds[input.kind]) throw new Error("Unsupported formal record.");
        routes.submitRecord = [`/jobs/${jobId}/${kinds[input.kind]}`, "POST"];
      }
      if (!routes[name]) throw new Error("Unsupported portal operation.");
      let body = input;
      if (name === "uploadClientDocument") {
        if (!(input.file instanceof Blob) || input.file.size > 25 * 1024 * 1024) throw new Error("Choose a file up to 25 MB.");
        const bytes = new Uint8Array(await input.file.arrayBuffer()); let binary = "";
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        const { file, ...metadata } = input;
        body = { ...metadata, filename: file.name, mime: file.type, base64: btoa(binary) };
      }
      const [path, method] = routes[name];
      return (await request(path, { method, body })).json();
    },
    async downloadDocument(id, versionId) {
      const response = await request(`/documents/${encodeURIComponent(id)}/download${versionId ? `?versionId=${encodeURIComponent(versionId)}` : ""}`);
      const filename = response.headers.get("Content-Disposition")?.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      return { filename: filename ? decodeURIComponent(filename) : "document", blob: await response.blob(), mime: "application/octet-stream" };
    },
    async createDemoQuotes() { throw new Error("Demo data is unavailable on the authenticated backend."); },
  };
}
