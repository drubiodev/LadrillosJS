/**
 * Expression Cache
 *
 * Caches compiled expression evaluators to avoid repeated Function() construction.
 *
 * Creating functions via new Function() is expensive:
 * - Parsing the function body
 * - JIT compilation
 * - Memory allocation
 *
 * By caching the compiled functions, we only pay this cost once per unique expression.
 */

import { warn } from "../../utils/devWarnings";

// ============================================================================
// Types
// ============================================================================

type ExpressionEvaluator = (context: Record<string, unknown>) => unknown;

// ============================================================================
// Caches
// ============================================================================

/**
 * Cache for compiled expression functions.
 * Key: expression string, Value: compiled function
 *
 * Using a Map with LRU-like behavior to prevent unbounded growth.
 * Max size is generous since expressions are typically reused heavily.
 */
const expressionCache = new Map<string, ExpressionEvaluator>();
const MAX_CACHE_SIZE = 1000;

/**
 * Cache for regex patterns (expressionDependsOn).
 * Creating regex objects is expensive - cache them.
 */
const regexCache = new Map<string, RegExp>();

/**
 * Cache for parsed binding paths.
 * e.g., "person.name" -> ["person", "name"]
 */
const pathCache = new Map<string, string[]>();

// ============================================================================
// Expression Caching
// ============================================================================

/**
 * Gets or creates a cached expression evaluator.
 *
 * @param expression - The expression to compile (e.g., "count + 1")
 * @param contextKeys - Variable names available in scope
 * @returns A function that evaluates the expression against a context
 *
 * @example
 * const evaluate = getCachedEvaluator("count * 2", ["count"]);
 * const result = evaluate({ count: 5 }); // 10
 */
export function getCachedEvaluator(
  expression: string,
  contextKeys: string[],
): ExpressionEvaluator {
  // Create a cache key that includes context keys
  // (same expression might need different context)
  const cacheKey = `${contextKeys.sort().join(",")}:${expression}`;

  let evaluator = expressionCache.get(cacheKey);

  if (!evaluator) {
    // Evict oldest entries if cache is full
    if (expressionCache.size >= MAX_CACHE_SIZE) {
      const firstKey = expressionCache.keys().next().value;
      if (firstKey) {
        expressionCache.delete(firstKey);
      }
    }

    evaluator = compileExpression(expression, contextKeys);
    expressionCache.set(cacheKey, evaluator);
  }

  return evaluator;
}

/**
 * Compiles an expression into an evaluator function.
 */
function compileExpression(
  expression: string,
  contextKeys: string[],
): ExpressionEvaluator {
  try {
    // Destructure all context keys for direct access in expression
    const destructure =
      contextKeys.length > 0
        ? `const { ${contextKeys.join(", ")} } = __ctx__;`
        : "";

    const fnBody = `
      "use strict";
      ${destructure}
      return (${expression});
    `;

    return new Function("__ctx__", fnBody) as ExpressionEvaluator;
  } catch (e) {
    // Return a function that returns undefined for invalid expressions
    warn(`Invalid expression: ${expression} — ${(e as Error).message}`);
    return () => undefined;
  }
}

/**
 * Clears all expression caches.
 * Useful for testing or when context shape changes dramatically.
 */
export function clearExpressionCache(): void {
  expressionCache.clear();
}

// ============================================================================
// Regex Caching
// ============================================================================

/**
 * Gets or creates a cached regex for variable boundary matching.
 *
 * @param variableName - The variable name to match
 * @returns A regex that matches the variable as a whole word
 */
export function getCachedVariableRegex(variableName: string): RegExp {
  let regex = regexCache.get(variableName);

  if (!regex) {
    // Escape special regex characters in the variable name
    const escaped = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    regex = new RegExp(`\\b${escaped}\\b`);
    regexCache.set(variableName, regex);
  }

  return regex;
}

/**
 * Cached check if an expression depends on a variable.
 *
 * @param expression - The expression to check
 * @param variableName - The variable to look for
 * @returns true if the expression references the variable
 */
export function expressionDependsOnCached(
  expression: string,
  variableName: string,
): boolean {
  return getCachedVariableRegex(variableName).test(expression);
}

// ============================================================================
// Path Caching
// ============================================================================

/**
 * Gets or creates a cached path array from a dot-notation string.
 *
 * @param pathString - The dot-notation path (e.g., "person.address.city")
 * @returns Array of path segments
 *
 * @example
 * getCachedPath("person.name") // ["person", "name"]
 */
export function getCachedPath(pathString: string): readonly string[] {
  let path = pathCache.get(pathString);

  if (!path) {
    path = pathString.split(".");
    pathCache.set(pathString, path);
  }

  // Return readonly to prevent mutation
  return path as readonly string[];
}

/**
 * Resolves a value from an object using a cached path.
 *
 * @param obj - The object to read from
 * @param pathString - Dot-notation path
 * @returns The value at the path, or undefined
 *
 * @example
 * getByPath({ person: { name: "John" } }, "person.name") // "John"
 */
export function getByPath(
  obj: Record<string, unknown>,
  pathString: string,
): unknown {
  const path = getCachedPath(pathString);
  let current: unknown = obj;

  for (const key of path) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Sets a value on an object using a cached path.
 *
 * @param obj - The object to write to
 * @param pathString - Dot-notation path
 * @param value - The value to set
 *
 * @example
 * const obj = { person: { name: "John" } };
 * setByPath(obj, "person.name", "Jane");
 * // obj.person.name === "Jane"
 */
export function setByPath(
  obj: Record<string, unknown>,
  pathString: string,
  value: unknown,
): void {
  const path = getCachedPath(pathString);

  if (path.length === 0) return;

  let current: Record<string, unknown> = obj;

  // Navigate to the parent of the target
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  // Set the value
  current[path[path.length - 1]] = value;
}
