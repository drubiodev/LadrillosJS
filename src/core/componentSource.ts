import { getCached, setCache } from "../cache";
import { logger } from "../utils/logger";

/**
 * Fetches component source with caching support
 * @param path - The file path to fetch
 * @returns The component source content
 */
export const fetchComponentSource = async (
  path: string
): Promise<string | undefined> => {
  if (!path) {
    throw new Error("Path cannot be null or empty");
  }

  const cached = getCached(path);
  if (cached) return cached;

  // fetch and cache
  try {
    const response = await fetch(path);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch component from ${path}: ${response.statusText}`
      );
    }

    const text = await response.text();
    setCache(path, text);

    return text;
  } catch (error) {
    logger.error(
      `Error fetching component from ${path}: ${(error as Error).message}`
    );
  }
};

/**
 * Safe fetch helper that returns empty string on error
 * @param url - The URL to fetch
 * @returns The fetched content or empty string
 */
export const safeFetch = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    logger.error(`Failed to fetch resource at ${url}:`, err);
    return "";
  }
};
