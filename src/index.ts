import {
  ladrillos,
  ComponentConfig,
  RegisterComponentsResult,
} from "./core/ladrillos";
import {
  $registerComponent,
  $registerComponents,
  $use,
} from "./core/helpers/frameworkHelpers";

// Export types for TypeScript users
export type { ComponentConfig, RegisterComponentsResult };

// Legacy export (for backwards compatibility)
export const registerComponent = (
  name: string,
  path: string,
  useShadowDOM?: boolean,
  lazy?: boolean
) => ladrillos.registerComponent(name, path, useShadowDOM, lazy);

// New batch registration export
export const registerComponents = (
  configs:
    | ComponentConfig[]
    | Record<string, string | Omit<ComponentConfig, "name">>
) => ladrillos.registerComponents(configs);

// $ prefixed exports - same syntax inside and outside components!
export { $registerComponent, $registerComponents, $use };

// Default export with all methods for CDN usage
// This allows: ladrillosjs.$registerComponent() in CDN mode
export default {
  registerComponent,
  registerComponents,
  $registerComponent,
  $registerComponents,
  $use,
};
