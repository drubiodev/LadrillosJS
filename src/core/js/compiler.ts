/**
 * The single place in the runtime where JavaScript source text becomes a
 * callable function.
 *
 * WHY THIS MODULE EXISTS
 *
 * LadrillosJS has no build step: a component is an `.html` file the browser
 * fetches at runtime, so template expressions, event handlers, and `<script>`
 * bodies have to be turned into functions *in the browser*. That is done with
 * the `Function` constructor, which CSP treats exactly like `eval()` — a page
 * running LadrillosJS needs `script-src 'unsafe-eval'`.
 *
 * Previously the `new Function` calls were scattered across three modules and
 * seven call sites. Funnelling them through one interface means an alternative
 * backend can supply functions that were compiled ahead of time, so a build
 * that never imports `runtimeBackend` contains no `Function` constructor at
 * all. That property is verifiable by grepping the bundle rather than being a
 * promise in a README.
 *
 * This module holds only the seam: it deliberately does NOT import a backend,
 * or every bundle would inherit `Function` through it. Entry points install
 * one — `runtimeBackend` for the normal builds, `precompiledBackend` for
 * `ladrillosjs/csp`.
 *
 * @see docs/22-csp-and-security.md
 */

/** A function produced by a codegen backend. Arguments are positional. */
export type CompiledFn = (...args: any[]) => any;

/**
 * Turns component source into callable functions.
 *
 * Implementations must treat `params` as positional: callers build a matching
 * argument array and rely on the order. The three methods exist separately
 * because a precompiled backend needs to know what kind of source it is
 * looking at — an expression, an event handler, or a script body — in order to
 * find the matching build-time artifact.
 *
 * Callers cache the results, keyed by source text. A backend does not need to
 * memoize.
 */
export interface CodegenBackend {
  /** Identifies the backend in diagnostics. */
  readonly name: string;

  /**
   * Compiles a template binding expression such as `count * 2`.
   * The expression is a *value*, not a statement list.
   */
  compileEvaluator(
    params: readonly string[],
    expression: string
  ): CompiledFn;

  /**
   * Compiles an event handler body such as `count++`.
   * `isAsync` selects the `AsyncFunction` constructor so the body may `await`.
   *
   * `key` identifies the handler for a precompiled backend. It is the source
   * the user actually wrote, because `body` is a runtime-built wrapper
   * containing destructuring, sync-back and a `//# sourceURL` derived from the
   * component URL — none of which a build-time compiler can reproduce.
   */
  compileHandler(
    params: readonly string[],
    body: string,
    isAsync: boolean,
    key: string
  ): CompiledFn;

  /**
   * Compiles a component `<script>` body, already wrapped by the caller
   * (`"use strict"`, any `return` of declared members, `//# sourceURL`).
   *
   * `key` must be unique per (call site, authored source): the same script is
   * compiled by several call sites with different wrappers and different
   * parameter lists, so the authored source alone would collide.
   */
  compileSetup(
    params: readonly string[],
    body: string,
    key: string
  ): CompiledFn;
}

/**
 * Compiling before an entry point has installed a backend is a wiring bug, not
 * a user error, so it fails loudly rather than silently falling back to
 * `Function` — a silent fallback would reintroduce `eval` into a CSP build.
 */
const uninstalledBackend: CodegenBackend = {
  name: "uninstalled",
  compileEvaluator: () => {
    throw new Error(noBackend());
  },
  compileHandler: () => {
    throw new Error(noBackend());
  },
  compileSetup: () => {
    throw new Error(noBackend());
  },
};

function noBackend(): string {
  // The guidance is worth ~250 bytes of the CDN bundle and is only actionable
  // while developing, so production ships the short form.
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    return (
      "[LadrillosJS] No codegen backend installed. Import the framework from " +
      "'ladrillosjs', 'ladrillosjs/core' or 'ladrillosjs/csp' rather than " +
      "from a deep internal path such as 'ladrillosjs/dist/core/...'. " +
      "('ladrillosjs/lazy' only adds loading strategies and does not install " +
      "a backend on its own.)"
    );
  }
  return "[LadrillosJS] No codegen backend installed.";
}

let activeBackend: CodegenBackend = uninstalledBackend;

const invalidators = new Set<() => void>();

/**
 * Registers a cache to be dropped whenever the backend changes.
 *
 * Compiled functions are memoised across components, so without this a swap
 * would keep serving functions built by the previous backend.
 */
export function onBackendChange(invalidate: () => void): void {
  invalidators.add(invalidate);
}

/** Replaces the active backend. Used by the precompiled/CSP build. */
export function setCodegenBackend(backend: CodegenBackend): void {
  if (backend === activeBackend) return;
  activeBackend = backend;
  for (const invalidate of invalidators) invalidate();
}

export function getCodegenBackend(): CodegenBackend {
  return activeBackend;
}

export function compileEvaluator(
  params: readonly string[],
  expression: string
): CompiledFn {
  return activeBackend.compileEvaluator(params, expression);
}

export function compileHandler(
  params: readonly string[],
  body: string,
  isAsync = false,
  key: string = body
): CompiledFn {
  return activeBackend.compileHandler(params, body, isAsync, key);
}

export function compileSetup(
  params: readonly string[],
  body: string,
  key: string = body
): CompiledFn {
  return activeBackend.compileSetup(params, body, key);
}
