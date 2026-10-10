import
{
  clearCachedComponents,
  deleteCachedComponent,
  getCachedComponent,
  setCachedComponentSource,
} from "./cache";
import { createError, ErrorCode } from "../../utils/devWarnings";

const pendingFetches = new Map<string, Promise<FetchComponentResult>>();
const activeFetchCounts = new Map<string, number>();
const pathRevisions = new Map<string, number>();
let cacheRevision = 0;

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

async function loadComponentSource(path: string): Promise<FetchComponentResult>
{
  const requestCacheRevision = cacheRevision;
  const requestPathRevision = pathRevisions.get(path) ?? 0;
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

  if (
    requestCacheRevision === cacheRevision &&
    requestPathRevision === (pathRevisions.get(path) ?? 0)
  )
  {
    setCachedComponentSource(path, text, resolved.path);
  }

  return { source: text, resolvedPath: resolved.path };
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

  const cached = getCachedComponent(path);
  if (cached)
  {
    return cached;
  }

  const pending = pendingFetches.get(path);
  if (pending)
  {
    return pending;
  }

  const request = loadComponentSource(path);
  activeFetchCounts.set(path, (activeFetchCounts.get(path) ?? 0) + 1);
  pendingFetches.set(path, request);

  try
  {
    return await request;
  } finally
  {
    if (pendingFetches.get(path) === request)
    {
      pendingFetches.delete(path);
    }

    const activeCount = (activeFetchCounts.get(path) ?? 1) - 1;
    if (activeCount === 0)
    {
      activeFetchCounts.delete(path);
      pathRevisions.delete(path);
    } else
    {
      activeFetchCounts.set(path, activeCount);
    }
  }
}

/**
 * Removes all settled component sources from the cache. Requests already in
 * flight still resolve for their callers but cannot repopulate the cache.
 */
export function clearComponentCache(): void
{
  cacheRevision++;
  pendingFetches.clear();
  pathRevisions.clear();
  clearCachedComponents();
}

/**
 * Removes one component source from the cache.
 *
 * Relative paths use the page URL as their base, matching registerComponent().
 * Returns true when a settled cache entry existed.
 */
export function invalidateComponentCache(path: string): boolean
{
  if (!path?.trim())
  {
    throw createError(
      "A component path is required.",
      ErrorCode.INVALID_COMPONENT_PATH,
      null,
      "Pass the same URL or relative path used to register the component.",
    );
  }

  let absolutePath: string;
  try
  {
    absolutePath = new URL(path, window.location.href).href;
  } catch (cause)
  {
    throw createError(
      `Invalid component path "${path}".`,
      ErrorCode.INVALID_COMPONENT_PATH,
      { sourcePath: path },
      "Pass the same valid URL or relative path used to register the component.",
      cause,
    );
  }

  if (activeFetchCounts.has(absolutePath))
  {
    pathRevisions.set(
      absolutePath,
      (pathRevisions.get(absolutePath) ?? 0) + 1,
    );
  }
  pendingFetches.delete(absolutePath);
  return deleteCachedComponent(absolutePath);
}
