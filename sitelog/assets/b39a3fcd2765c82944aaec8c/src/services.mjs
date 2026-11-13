// Composition root. The generated configuration is immutable within each build.
import { deploymentConfig } from "./deployment-config.mjs";
import { createServices } from "./service-factory.mjs";
export const services = await createServices(deploymentConfig);
