import { assertServiceContract } from "./service-contract.mjs";
export async function createServices(config) {
  if (config?.target === "github-pages") {
    const { GitHubPagesServices } = await import(
      "./adapters/github-pages-services.mjs"
    );
    return assertServiceContract(new GitHubPagesServices());
  }
  if (config?.target === "production") {
    const { ProductionServices } = await import(
      "./adapters/production-services.mjs"
    );
    return assertServiceContract(new ProductionServices());
  }
  throw new Error(
    "Unknown service deployment target. Refusing to select a fallback.",
  );
}
