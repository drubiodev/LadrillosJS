// ============================================================================
// Compile-Time Feature Flags
// ============================================================================
//
// These global constants are replaced at build time by the bundler.
// This enables complete dead code elimination - any code wrapped in
// `if (__DEV__)` will be completely removed from production builds.
//
// Usage:
//   if (__DEV__) {
//     console.warn('This warning only appears in development');
//   }
//
// In production builds, the above becomes:
//   if (false) { ... }
//
// Which is then eliminated entirely by the minifier.
// ============================================================================

/**
 * Development mode flag.
 *
 * - `true` in development builds (default when not defined)
 * - `false` in production builds (set via Vite define)
 *
 * Use this to wrap dev-only code like warnings, validation, and debug logging.
 * All code inside `if (__DEV__)` blocks is removed in production.
 */
declare const __DEV__: boolean;
