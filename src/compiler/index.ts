/**
 * `ladrillosjs/compiler` — the ahead-of-time build-time API.
 *
 * Ships as a subpath of `ladrillosjs` rather than a separate package because
 * the emitter reuses the runtime's own parsing and code-transform helpers
 * (`scriptParser`, `moduleExecutor`, `stateTransform`). Splitting it out would
 * either duplicate those ~127 KB or take a version-locked dependency back on
 * `ladrillosjs`; a mismatched pair would emit artifacts the runtime silently
 * fails to find. A subpath makes the versions impossible to desynchronise.
 *
 * Nothing here is reachable from `ladrillosjs`, `ladrillosjs/core` or
 * `ladrillosjs/csp` — `scripts/verify-treeshaking.js` asserts that, so importing
 * the framework never pulls the compiler into an application bundle.
 *
 * Requires a DOM: Node builds need `happy-dom` or `jsdom` registered globally
 * before calling `parseComponent`.
 */
export { emitComponent } from "./emit";
export type { EmitResult, EmittedKeys } from "./emit";

export { parseComponent } from "../core/component/extract";

export type {
  LadrillosComponent,
  ScriptElement,
  ExternalScriptElement,
} from "../types";
