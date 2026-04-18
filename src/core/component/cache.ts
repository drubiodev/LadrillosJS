const cache = new Map<string, string>();
let maxCacheSize = 25;

/**
 * Set the maximum number of component sources retained in the LRU cache.
 * When the new size is smaller than the current cache, the least-recently
 * used entries are evicted until the limit is satisfied.
 */
export const setCacheSize = (size: number): void => {
  if (!Number.isFinite(size) || size < 1) {
    throw new Error(
      `[LadrillosJS] configure({ cacheSize }) requires a positive integer, got ${size}`,
    );
  }
  maxCacheSize = Math.floor(size);
  // Evict to respect new limit
  while (cache.size > maxCacheSize) {
    const firstKey = cache.keys().next().value;
    if (!firstKey) break;
    cache.delete(firstKey);
  }
};

/**
 * LRU Cache: Gets cached content and marks it as recently used
 * Moves the accessed item to the end of the Map (most recently used position)
 * This ensures frequently accessed components stay in cache longer
 * @param path - The file path to retrieve from cache
 * @returns The cached content or undefined if not found
 */
export const getCachedComponentSource = (path: string): string | undefined => {
  const cached = cache.get(path);

  if (cached) {
    // Move to end to mark as recently used
    cache.delete(path);
    cache.set(path, cached);
  }

  return cached;
};

/**
 * LRU Cache: Stores content with automatic eviction of least recently used items
 * Maintains cache size limit by removing oldest items when full
 * Updates existing items without affecting cache size
 * @param path - The file path to cache
 * @param content - The content to store
 */
export const setCachedComponentSource = (
  path: string,
  content: string,
): void => {
  if (cache.has(path)) {
    // Update existing: remove and re-add to mark as most recent
    cache.delete(path);
  } else if (cache.size >= maxCacheSize) {
    // Cache full: remove least recently used (first item in Map)
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }
  // Add/update as most recently used
  cache.set(path, content);
};
