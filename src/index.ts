import {
  ladrillos,
  ComponentConfig,
  RegisterComponentsResult,
} from "./core/ladrillos";
import {
  registerComponent,
  registerComponents,
  $use,
} from "./core/helpers/frameworkHelpers";
import { $emit, $listen, EventCallback } from "./core/events/eventBus";
import { configure, LadrillosConfig } from "./core/configure";
import { ErrorCode, type LadrillosErrorHandler } from "./utils/devWarnings";

// Import lazy loading strategies
import {
  LazyStrategy,
  lazyOnIdle,
  lazyOnVisible,
  lazyOnMedia,
  lazyOnInteraction,
  lazyOnDelay,
} from "./core/lazy";

// Export public types
export type {
  ComponentConfig,
  RegisterComponentsResult,
  EventCallback,
  LazyStrategy,
  LadrillosConfig,
  LadrillosErrorHandler,
};
export type { LadrillosComponent } from "./types";

// Export error code enum for consumers to branch on
export { ErrorCode };

// Export lazy loading strategies
export {
  lazyOnIdle,
  lazyOnVisible,
  lazyOnMedia,
  lazyOnInteraction,
  lazyOnDelay,
};

// Force load a lazy component
export const loadLazyComponent = (name: string) =>
  ladrillos.loadLazyComponent(name);

// Framework configuration
export { configure };

// Component registration + $use alias + event bus helpers
export { registerComponent, registerComponents, $use, $emit, $listen };

// Default export with all methods for CDN usage
// This allows: ladrillosjs.registerComponent() in CDN mode
export default {
  registerComponent,
  registerComponents,
  $use,
  $emit,
  $listen,
  loadLazyComponent,
  configure,
  // Lazy loading strategies
  lazyOnIdle,
  lazyOnVisible,
  lazyOnMedia,
  lazyOnInteraction,
  lazyOnDelay,
};
