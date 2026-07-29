/**
 * LadrillosJS Core - Minimal bundle
 *
 * This is the core module containing only essential functionality.
 * Use this for the smallest possible bundle size.
 *
 * @example
 * ```ts
 * import { registerComponent } from 'ladrillosjs/core';
 * ```
 *
 * For additional features, import from:
 * - 'ladrillosjs/lazy' - Lazy loading strategies
 * - 'ladrillosjs/events' - Event bus for cross-component communication
 */

import { ComponentConfig, RegisterComponentsResult } from "./core/ladrillos";
import { setCodegenBackend } from "./core/js/compiler";
import { runtimeBackend } from "./core/js/runtimeBackend";
import
{
  registerComponent,
  registerComponents,
  $use,
} from "./core/helpers/frameworkHelpers";
import { configure, LadrillosConfig } from "./core/configure";
import
{
  ErrorCode,
  LadrillosError,
  type LadrillosErrorHandler,
} from "./utils/devWarnings";

// This build compiles component code in the browser, so it needs the
// `Function` constructor and therefore `script-src 'unsafe-eval'`.
// `ladrillosjs/csp` installs the precompiled backend instead.
setCodegenBackend(runtimeBackend);

// Export public types
export type {
  ComponentConfig,
  RegisterComponentsResult,
  LadrillosConfig,
  LadrillosErrorHandler,
};
export type { LadrillosComponent } from "./types";

// Export error code enum
export { ErrorCode, LadrillosError };

// Public exports
export { registerComponent, registerComponents, $use, configure };

// Default export for CDN usage
export default {
  registerComponent,
  registerComponents,
  $use,
  configure,
};
