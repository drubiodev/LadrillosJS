/**
 * Cache for compiled function expressions used in template bindings.
 * Prevents memory leaks by reusing Function objects for identical expressions.
 * Example: {MyName("Peter")} compiles once and is reused on every render.
 */
const functionCache = new Map<string, Function>();
const maxFunctionCacheSize = 100; // Functions are small, can cache more

/**
 * Gets or creates a cached function for evaluating template expressions.
 * Uses LRU pattern to limit cache size and prevent unbounded growth.
 * @param expression - The JavaScript expression to compile (e.g., 'MyName("Peter")')
 * @returns Compiled Function object that can be executed with a component context
 */
export const getCachedFunction = (expression: string): Function => {
  const cached = functionCache.get(expression);

  if (cached) {
    // LRU: Move to end (most recently used position)
    functionCache.delete(expression);
    functionCache.set(expression, cached);
    return cached;
  }

  // Cache miss: compile new function
  // Include common globals in the function scope
  const compiledFunc = new Function(
    "component",
    `
    const { Date, Array, Math, String, Number, Boolean, Object, JSON, RegExp } = globalThis;
    with(component) { 
      return ${expression}; 
    }
    `
  );

  // Check cache size and evict least recently used if needed
  if (functionCache.size >= maxFunctionCacheSize) {
    const firstKey = functionCache.keys().next().value;
    if (firstKey) {
      functionCache.delete(firstKey);
    }
  }

  // Add as most recently used
  functionCache.set(expression, compiledFunc);
  return compiledFunc;
};

/**
 * Clears the function cache. Useful for testing or memory management.
 */
export const clearFunctionCache = (): void => {
  functionCache.clear();
};

/**
 * Gets the current function cache size for debugging/monitoring.
 */
export const getFunctionCacheSize = (): number => {
  return functionCache.size;
};
