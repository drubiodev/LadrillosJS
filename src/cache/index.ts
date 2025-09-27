const cache = new Map<string, string>();
const maxCacheSize = 25; // TODO: make configurable for developer to set

/**
 * LRU Cache: Gets cached content and marks it as recently used
 * Moves the accessed item to the end of the Map (most recently used position)
 * This ensures frequently accessed components stay in cache longer
 * @param path - The file path to retrieve from cache
 * @returns The cached content or undefined if not found
 */
export const getCached = (path: string): string | undefined => {
  const cached = cache.get(path);
  if (cached) {
    // LRU: Move to end (most recently used position)
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
export const setCache = (path: string, content: string): void => {
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
  // Add/update as most recently used (end of Map)
  cache.set(path, content);
};
