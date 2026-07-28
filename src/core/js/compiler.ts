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
 * This module changes no behavior on its own. `runtimeBackend` is the default
 * and is the previous code, moved verbatim.
 *
 * @see docs/22-csp-and-security.md
 */

/** A function produced by a codegen backend. Arguments are positional. */
export type CompiledFn = (...args: any[]) => any;

/**
 * `AsyncFunction` is not a global binding, so it has to be reached through the
 * prototype of an async function.
 */
const AsyncFunction = Object.getPrototypeOf(async function () {})
  .constructor as new (...args: string[]) => CompiledFn;

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
 * Compiles in the browser with the `Function` constructor. Requires
 * `script-src 'unsafe-eval'`.
 */
export const runtimeBackend: CodegenBackend = {
  name: "runtime",

  compileEvaluator(params, expression) {
    return new Function(
      ...params,
      `"use strict"; return ${expression};`
    ) as CompiledFn;
  },

  compileHandler(params, body, isAsync) {
    return isAsync
      ? new AsyncFunction(...params, body)
      : (new Function(...params, body) as CompiledFn);
  },

  compileSetup(params, body) {
    return new Function(...params, body) as CompiledFn;
  },
};

let activeBackend: CodegenBackend = runtimeBackend;

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
