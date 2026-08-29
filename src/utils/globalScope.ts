/**
 * Global scoping for component code.
 *
 * This module decides WHICH global names are visible to a component's script
 * and expression code, and under what names. It is a *scoping convenience* —
 * injecting these as function parameters is what lets component code read like
 * plain JS (`fetch(...)` instead of `window.fetch(...)`).
 *
 * IT IS NOT A SECURITY BOUNDARY. Component scripts run with full access to the
 * page (window, document, fetch, …) — see the "Security & Trust Model" section
 * of the README and docs/22-csp-and-security.md. Component HTML is trusted
 * code, exactly like a `.js` file you import. Do not rely on the lists below
 * to run untrusted component files.
 *
 * (This file was previously named `sandbox.ts`, which invited exactly the
 * wrong reading. The name was changed; the behaviour was not.)
 */

/**
 * Globals injected into component scope as function parameters, with their
 * real values.
 *
 * Since SHADOWED_GLOBALS is empty, most browser APIs would already be reachable
 * via the normal global scope chain. This list exists so the common ones
 * resolve as bare identifiers without a `window.` prefix.
 */
export const INJECTED_GLOBALS = Object.freeze([
  // User dialogs
  "alert",
  "confirm",
  "prompt",
  // Debugging
  "console",
  // Data & Types
  "JSON",
  "Math",
  "Date",
  "Array",
  "Object",
  "String",
  "Number",
  "Boolean",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Symbol",
  "BigInt",
  "Promise",
  "Proxy",
  "Reflect",
  // Number utilities
  "parseInt",
  "parseFloat",
  "isNaN",
  "isFinite",
  "Infinity",
  "NaN",
  // URL encoding
  "encodeURIComponent",
  "decodeURIComponent",
  "encodeURI",
  "decodeURI",
  // Timers
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  "queueMicrotask",
  // Network
  "fetch",
  "AbortController",
  "AbortSignal",
  "Headers",
  "Request",
  "Response",
  "URL",
  "URLSearchParams",
  // Browser APIs
  "navigator",
  "location",
  "history",
  "localStorage",
  "sessionStorage",
  "crypto",
  // DOM
  "document",
  "window",
  "globalThis",
  "Element",
  "HTMLElement",
  "Event",
  "CustomEvent",
  "EventTarget",
  // Text
  "TextEncoder",
  "TextDecoder",
  "Blob",
  "File",
  "FileReader",
  "FormData",
  // Error types
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  // Other utilities
  "atob",
  "btoa",
  "structuredClone",
]);

/**
 * Global names shadowed with `undefined` in component scope.
 *
 * This once blocked many browser APIs (fetch, setTimeout, …), which was too
 * restrictive — component code is your own application code and should have
 * full access to JS. It is intentionally empty.
 *
 * NOTE: this is a scoping list, not a security control. A name omitted here is
 * not "allowed" by a trust boundary; there is no trust boundary. Shadowing a
 * name only stops accidental use, never deliberate use (`globalThis.x` still
 * resolves).
 */
export const SHADOWED_GLOBALS = Object.freeze([
  // Intentionally empty — component code gets full JS access.
]);

// Reserved words and keywords that cannot be used as parameter names
// These are blocked via strict mode instead
export const RESERVED_WORDS = new Set([
  "with",
  "eval",
  "arguments",
  "constructor",
  "prototype",
  "break",
  "case",
  "catch",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "finally",
  "for",
  "function",
  "if",
  "in",
  "instanceof",
  "new",
  "return",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "class",
  "const",
  "enum",
  "export",
  "extends",
  "import",
  "super",
  "implements",
  "interface",
  "let",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "yield",
  "null",
  "true",
  "false",
]);

// ============================================================================
// Framework Helpers ($ prefixed)
// ============================================================================

/**
 * Framework helper names that are injected into component scripts.
 * These use the $ prefix convention
 */
export const FRAMEWORK_HELPERS = Object.freeze([
  "registerComponent",
  "$use", // Alias for registerComponent with auto-derived tag name
]);
