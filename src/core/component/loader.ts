import { getCachedComponentSource, setCachedComponentSource } from "./cache";
import { createError, ErrorCode } from "../../utils/devWarnings";

/**
 * Resolves a component path, supporting folder-as-component pattern.
 * If the path doesn't end with .html, tries to resolve as:
 * 1. path/index.html (folder-as-component convention) - tried first to avoid 404 console noise
 * 2. Direct path (in case it's a file without extension configured by server)
 *
 * @example
 * // These are equivalent:
 * './components/header'        -> './components/header/index.html'
 * './components/header/'       -> './components/header/index.html'
 * './components/counter.html'  -> './components/counter.html' (unchanged)
 */
async function resolveComponentPath(
  basePath: string
): Promise<{ path: string; response: Response } | null>
{
  // If path already has .html extension, use it directly
  if (basePath.endsWith(".html"))
  {
    const response = await fetch(basePath);
    if (response.ok)
    {
      return { path: basePath, response };
    }
    return null;
  }

  // Normalize path (remove trailing slash for consistent handling)
  const normalizedPath = basePath.endsWith("/")
    ? basePath.slice(0, -1)
    : basePath;

  // Try folder/index.html pattern FIRST (folder-as-component convention)
  // This avoids 404 console errors from trying the direct path first
  const indexPath = `${normalizedPath}/index.html`;
  try
  {
    const indexResponse = await fetch(indexPath);
    if (indexResponse.ok)
    {
      return { path: indexPath, response: indexResponse };
    }
  } catch
  {
    // Ignore and try next resolution
  }

  // Fallback: Try direct path (some servers might serve HTML without extension)
  try
  {
    const directResponse = await fetch(normalizedPath);
    if (directResponse.ok)
    {
      const contentType = directResponse.headers.get("content-type") || "";
      // Only accept if it's actually HTML
      if (contentType.includes("text/html"))
      {
        return { path: normalizedPath, response: directResponse };
      }
    }
  } catch
  {
    // Ignore
  }

  return null;
}

/**
 * Result of fetching a component source
 */
export interface FetchComponentResult
{
  /** The HTML source content */
  source: string;
  /** The actual resolved path (may differ from input for folder-as-component) */
  resolvedPath: string;
}

export async function fetchComponentSource(
  path: string
): Promise<FetchComponentResult>
{
  if (!path?.trim())
  {
    throw createError(
      "A component path is required.",
      ErrorCode.INVALID_COMPONENT_PATH,
      null,
      "Pass a URL or relative .html path to registerComponent().",
    );
  }

  // check cache for component source
  const cachedSource = getCachedComponentSource(path);
  if (cachedSource)
  {
    // Return cached source with the original path
    // (we can't know the resolved path from cache alone, but the caller
    // should use the resolvedPath from the first fetch)
    return { source: cachedSource, resolvedPath: path };
  }

  const resolved = await resolveComponentPath(path);

  if (!resolved)
  {
    const attemptedPaths = path.endsWith(".html")
      ? path
      : `${path}/index.html and ${path}`;
    throw createError(
      `Could not load the component file. Tried ${attemptedPaths}.`,
      ErrorCode.COMPONENT_LOAD_FAILED,
      { sourcePath: path },
      "Check the path, serve the app over HTTP, and make sure the server returns an HTML response.",
    );
  }

  const text = await resolved.response.text();

  // Cache with both the original path and resolved path
  setCachedComponentSource(path, text);
  if (resolved.path !== path)
  {
    setCachedComponentSource(resolved.path, text);
  }

  return { source: text, resolvedPath: resolved.path };
}
