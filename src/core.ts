/**
 * LadrillosJS Core - Minimal bundle
 *
 * This is the core module containing only essential functionality.
 * Use this for the smallest possible bundle size.
 *
 * @example
 * ```ts
 * import { $registerComponent } from 'ladrillosjs/core';
 * ```
 *
 * For additional features, import from:
 * - 'ladrillosjs/lazy' - Lazy loading strategies
 * - 'ladrillosjs/events' - Event bus for cross-component communication
 */

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

// Export types
export type { ComponentConfig, RegisterComponentsResult };

// Core registration functions
export const registerComponent = (
  name: string,
  path: string,
  useShadowDOM?: boolean
) => ladrillos.registerComponent(name, path, useShadowDOM, false);

export const registerComponents = (
  configs:
    | ComponentConfig[]
    | Record<string, string | Omit<ComponentConfig, "name">>
) => ladrillos.registerComponents(configs);

// $ prefixed exports
export { $registerComponent, $registerComponents, $use };

// Default export for CDN usage
export default {
  registerComponent,
  registerComponents,
  $registerComponent,
  $registerComponents,
  $use,
};
