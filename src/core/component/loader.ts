import { getCachedComponentSource, setCachedComponentSource } from "./cache";

/**
 * Resolves a component path, supporting folder-as-component pattern.
 * If the path doesn't end with .html, tries to resolve as:
 * 1. Direct path (in case it's a file without extension configured by server)
 * 2. path/index.html (folder-as-component convention)
 *
 * @example
 * // These are equivalent:
 * './components/header'        -> './components/header/index.html'
 * './components/header/'       -> './components/header/index.html'
 * './components/counter.html'  -> './components/counter.html' (unchanged)
 */
async function resolveComponentPath(
  basePath: string
): Promise<{ path: string; response: Response } | null> {
  // If path already has .html extension, use it directly
  if (basePath.endsWith(".html")) {
    const response = await fetch(basePath);
    if (response.ok) {
      return { path: basePath, response };
    }
    return null;
  }

  // Normalize path (remove trailing slash for consistent handling)
  const normalizedPath = basePath.endsWith("/")
    ? basePath.slice(0, -1)
    : basePath;

  // Try direct path first (some servers might serve HTML without extension)
  try {
    const directResponse = await fetch(normalizedPath);
    if (directResponse.ok) {
      const contentType = directResponse.headers.get("content-type") || "";
      // Only accept if it's actually HTML
      if (contentType.includes("text/html")) {
        return { path: normalizedPath, response: directResponse };
      }
    }
  } catch {
    // Ignore and try next resolution
  }

  // Try folder/index.html pattern (folder-as-component convention)
  const indexPath = `${normalizedPath}/index.html`;
  try {
    const indexResponse = await fetch(indexPath);
    if (indexResponse.ok) {
      return { path: indexPath, response: indexResponse };
    }
  } catch {
    // Ignore
  }

  return null;
}

export async function fetchComponentSource(
  path: string
): Promise<string | undefined> {
  if (!path) {
    throw new Error("Path cannot be null or empty");
  }

  // check cache for component source
  const cachedSource = getCachedComponentSource(path);
  if (cachedSource) return cachedSource;

  try {
    const resolved = await resolveComponentPath(path);

    if (!resolved) {
      throw new Error(
        `Failed to fetch component from ${path}: Could not resolve path. ` +
          `Tried: ${path}${
            !path.endsWith(".html") ? ` and ${path}/index.html` : ""
          }`
      );
    }

    const text = await resolved.response.text();

    // Cache with both the original path and resolved path
    setCachedComponentSource(path, text);
    if (resolved.path !== path) {
      setCachedComponentSource(resolved.path, text);
    }

    return text;
  } catch (error) {
    console.error(`Error fetching component from ${path}:`, error);
    return undefined;
  }
}
