import { SERVICE_CONTRACT } from "../service-contract.mjs";
export class ProductionNotConfiguredError extends Error {
  constructor(operation = "initialize") {
    super(
      `Production services are not configured (${operation}). Implement the authenticated production adapters before enabling live use.`,
    );
    this.name = "ProductionNotConfiguredError";
    this.code = "PRODUCTION_NOT_CONFIGURED";
  }
}
// An explicit, fail-closed strategy: no seed, mock auth, fallback or network calls.
// Implement these ports against the separately deployed auth/business API per docs.
export class ProductionServices {
  constructor() {
    this.target = "production";
    this.capabilities = Object.freeze({ demo: false, remote: true });
    this.databaseName = "sitelog-production-cache-v1";
    for (const [port, methods] of Object.entries(SERVICE_CONTRACT))
      this[port] = Object.freeze(
        Object.fromEntries(
          methods.map((method) => [
            method,
            async () => {
              throw new ProductionNotConfiguredError(`${port}.${method}`);
            },
          ]),
        ),
      );
  }
  async resetDemo() {
    throw new ProductionNotConfiguredError("resetDemo");
  }
  async initialize() {
    throw new ProductionNotConfiguredError();
  }
}
