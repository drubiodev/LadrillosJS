/**
 * Variable Regex Cache
 *
 * Building a `RegExp` is comparatively expensive, and the reactivity layer
 * checks the same variable names against many binding expressions when working
 * out which bindings depend on which state keys. Caching the compiled regex per
 * variable name avoids recreating it on every check.
 */

// ============================================================================
// Caches
// ============================================================================

/**
 * Cache for regex patterns used to test whether an expression references a
 * given variable as a whole word.
 */
const regexCache = new Map<string, RegExp>();

// ============================================================================
// Regex Caching
// ============================================================================

/**
 * Gets or creates a cached regex for variable boundary matching.
 *
 * @param variableName - The variable name to match
 * @returns A regex that matches the variable as a whole word
 */
export function getCachedVariableRegex(variableName: string): RegExp
{
  let regex = regexCache.get(variableName);

  if (!regex)
  {
    // Escape special regex characters in the variable name
    const escaped = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    regex = new RegExp(`\\b${escaped}\\b`);
    regexCache.set(variableName, regex);
  }

  return regex;
}

