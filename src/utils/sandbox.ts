/**
 * Globals that are explicitly injected into the scope.
 * These are passed as function parameters with their actual values.
 *
 * Note: With BLOCKED_GLOBALS now empty, most browser APIs are accessible
 * directly through the global scope (window). This list is for convenience
 * to ensure common APIs work without window. prefix.
 */
export const ALLOWED_GLOBALS = Object.freeze([
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
 * Blocked globals that are shadowed with undefined.
 *
 * Previously this list blocked many browser APIs (fetch, setTimeout, etc.)
 * but this was too restrictive. Developers should have full access to JS.
 *
 * Only truly dangerous APIs that could break the framework should be blocked.
 * Currently empty - we trust developers to write safe code.
 */
export const BLOCKED_GLOBALS = Object.freeze([
  // Currently no blocked globals - developers have full JS access
  // If you need to block something dangerous in the future, add it here
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
