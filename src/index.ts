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
import { $emit, $listen, EventCallback } from "./core/events/eventBus";

// Import lazy loading strategies
import {
  LazyStrategy,
  lazyOnIdle,
  lazyOnVisible,
  lazyOnMedia,
  lazyOnInteraction,
  lazyOnDelay,
} from "./core/lazy";

// Import dev warning utilities for users who want to customize error handling
import {
  setComponentContext,
  getComponentContext,
  ComponentContext,
  warn,
  error,
  expressionError,
  scriptError,
  deprecate,
  ErrorCode,
  getErrorDocsUrl,
  __DEV__,
} from "./utils/devWarnings";

// Export types for TypeScript users
export type {
  ComponentConfig,
  RegisterComponentsResult,
  EventCallback,
  LazyStrategy,
  ComponentContext,
};

// Export lazy loading strategies
export {
  lazyOnIdle,
  lazyOnVisible,
  lazyOnMedia,
  lazyOnInteraction,
  lazyOnDelay,
};

// Export dev warning utilities for advanced users
export {
  setComponentContext,
  getComponentContext,
  warn,
  error,
  expressionError,
  scriptError,
  deprecate,
  ErrorCode,
  getErrorDocsUrl,
  __DEV__,
};

// Legacy export (for backwards compatibility)
export const registerComponent = (
  name: string,
  path: string,
  useShadowDOM?: boolean,
  lazy?: boolean | LazyStrategy
) => ladrillos.registerComponent(name, path, useShadowDOM, lazy);

// New batch registration export
export const registerComponents = (
  configs:
    | ComponentConfig[]
    | Record<string, string | Omit<ComponentConfig, "name">>
) => ladrillos.registerComponents(configs);

// Force load a lazy component
export const loadLazyComponent = (name: string) =>
  ladrillos.loadLazyComponent(name);

// $ prefixed exports - same syntax inside and outside components!
export { $registerComponent, $registerComponents, $use, $emit, $listen };

// Default export with all methods for CDN usage
// This allows: ladrillosjs.$registerComponent() in CDN mode
export default {
  registerComponent,
  registerComponents,
  loadLazyComponent,
  $registerComponent,
  $registerComponents,
  $use,
  $emit,
  $listen,
  // Lazy loading strategies
  lazyOnIdle,
  lazyOnVisible,
  lazyOnMedia,
  lazyOnInteraction,
  lazyOnDelay,
  // Dev warning utilities
  setComponentContext,
  getComponentContext,
  warn,
  error,
  expressionError,
  scriptError,
  deprecate,
  ErrorCode,
  getErrorDocsUrl,
  __DEV__,
};
