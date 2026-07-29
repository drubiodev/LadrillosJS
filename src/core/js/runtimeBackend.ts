/**
 * The only module in the codebase that contains the `Function` constructor.
 *
 * It is deliberately isolated so that a bundle which never imports it provably
 * contains no runtime code generation — a property `scripts/verify-no-eval.js`
 * checks mechanically against the built output. Nothing in the framework core
 * imports this module; the entry points install it, and the `ladrillosjs/csp`
 * entry installs `precompiledBackend` instead.
 *
 * @see docs/22-csp-and-security.md
 */
import type { CodegenBackend, CompiledFn } from "./compiler";

/**
 * `AsyncFunction` is not a global binding, so it has to be reached through the
 * prototype of an async function.
 */
const AsyncFunction = Object.getPrototypeOf(async function () { })
    .constructor as new (...args: string[]) => CompiledFn;

/**
 * Compiles in the browser with the `Function` constructor. Requires
 * `script-src 'unsafe-eval'`.
 */
export const runtimeBackend: CodegenBackend = {
    name: "runtime",

    compileEvaluator(params, expression)
    {
        return new Function(
            ...params,
            `"use strict"; return ${expression};`
        ) as CompiledFn;
    },

    compileHandler(params, body, isAsync)
    {
        return isAsync
            ? new AsyncFunction(...params, body)
            : (new Function(...params, body) as CompiledFn);
    },

    compileSetup(params, body)
    {
        return new Function(...params, body) as CompiledFn;
    },
};
