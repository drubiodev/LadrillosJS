/**
 * LadrillosJS — eval-free entry point.
 *
 * Identical to `ladrillosjs/core`, except that component code is served from
 * artifacts emitted at build time instead of being compiled in the browser.
 * This entry never imports `runtimeBackend`, so the bundle contains no
 * `Function` constructor and the page does not need `script-src 'unsafe-eval'`.
 *
 * @example
 * ```ts
 * import { registerComponent, registerArtifacts } from "ladrillosjs/csp";
 * import artifacts from "./components/counter.artifacts.js";
 *
 * registerArtifacts(artifacts);
 * registerComponent("my-counter", "./components/counter.html");
 * ```
 *
 * The `@ladrillosjs/vite-plugin` wires those two lines up for you.
 *
 * IMPORTANT: do not mix this entry with `ladrillosjs` or `ladrillosjs/core` in
 * the same bundle. Both install a codegen backend at module-evaluation time, so
 * whichever runs last wins — and pulling in a non-CSP entry would put the
 * `Function` constructor back into the bundle anyway.
 *
 * @see docs/22-csp-and-security.md
 */
import { ComponentConfig, RegisterComponentsResult } from "./core/ladrillos";
import { setCodegenBackend } from "./core/js/compiler";
import { precompiledBackend } from "./core/js/precompiled";
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

setCodegenBackend(precompiledBackend);

// Export public types
export type {
  ComponentConfig,
  RegisterComponentsResult,
  LadrillosConfig,
  LadrillosErrorHandler,
};
export type { LadrillosComponent } from "./types";
export type {
  ArtifactTable,
  EvaluatorArtifact,
  FunctionArtifact,
} from "./core/js/precompiled";

// Export error code enum
export { ErrorCode, LadrillosError };

// Artifact registration — the build-time counterpart to this entry
export {
  registerArtifacts,
  clearArtifacts,
  hasArtifact,
  MissingArtifactError,
} from "./core/js/precompiled";

// Public exports
export { registerComponent, registerComponents, $use, configure };

export default {
  registerComponent,
  registerComponents,
  $use,
  configure,
};
