/**
 * LadrillosJS Framework Helpers
 *
 * These are $ prefixed helper functions injected into component scripts.
 *
 * Available helpers:
 * - registerComponent(name, path, useShadowDOM?) - Register a child component
 * - registerComponents(configs) - Register multiple components at once (parallel)
 * - $use(path) - Shorthand for registerComponent with auto-derived tag name
 * - createRefsProxy(map) - Wrap a Map in a Proxy for cleaner dot notation access
 */

import type {
  ComponentConfig,
  RegisterComponentsResult,
} from "../ladrillos";
import type { LazyStrategy } from "../lazy";
import { createRefsProxy } from "./refsProxy";

export { createRefsProxy };

// Loaded on demand. A static import closes a cycle — ladrillos imports the lazy
// loader, which reaches back here via webcomponent -> scriptParser — and under
// transforms that evaluate modules in dependency order (Vite's SSR transform,
// so Vitest) the singleton's constructor then sees `initLazyLoader` undefined.
const framework = () => import("../ladrillos").then((m) => m.ladrillos);

/**
 * Resolves a relative path against a base URL.
 * Used to resolve "./buttons.html" relative to the parent component's URL.
 */
function resolvePath(path: string, baseUrl: string): string
{
  // If path is already absolute, return as-is
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("/")
  )
  {
    return path.startsWith("/")
      ? new URL(path, window.location.origin).href
      : path;
  }

  // Resolve relative path against base URL
  return new URL(path, baseUrl).href;
}

/**
 * Converts a filename to a kebab-case tag name.
 * "./HeaderButtons.html" → "header-buttons"
 */
function filenameToTagName(path: string): string
{
  const filename =
    path
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "") || path;

  return filename
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Creates framework helpers bound to a specific component's base URL.
 * This ensures relative paths like "./buttons.html" resolve correctly
 * relative to the component that calls registerComponent.
 *
 * @param componentUrl - The absolute URL of the component (e.g., "http://localhost/header/header.html")
 * @returns Object containing bound helper functions
 */
export function createFrameworkHelpers(componentUrl: string)
{
  /**
   * Registers a child component from within a component's script.
   * Paths are resolved relative to the calling component's location.
   *
   * @example
   * ```html
   * <!-- In /header/header.html -->
   * <script>
   *   registerComponent("header-buttons", "./buttons.html");
   *   // Resolves to /header/buttons.html
   * </script>
   * ```
   */
  function registerComponent(
    name: string,
    path: string,
    useShadowDOM: boolean = true,
    lazy: boolean | LazyStrategy = false,
  ): Promise<void>
  {
    const resolvedPath = resolvePath(path, componentUrl);
    return framework().then((l) =>
      l.registerComponent(name, resolvedPath, useShadowDOM, lazy),
    );
  }

  /**
   * Register multiple components at once with parallel fetching.
   *
   * Benefits:
   * - Parallel network requests (faster than sequential registerComponent calls)
   * - Shared fetch cache
   * - Detailed error reporting
   *
   * @example
   * ```html
   * <script>
   *   // Array syntax
   *   await registerComponents([
   *     { name: 'nav-item', path: './nav-item.html' },
   *     { name: 'nav-dropdown', path: './nav-dropdown.html', useShadowDOM: false }
   *   ]);
   *
   *   // Object syntax
   *   await registerComponents({
   *     'nav-item': './nav-item.html',
   *     'nav-dropdown': { path: './nav-dropdown.html', useShadowDOM: false }
   *   });
   * </script>
   * ```
   */
  function registerComponents(
    configs:
      | ComponentConfig[]
      | Record<string, string | Omit<ComponentConfig, "name">>,
  ): Promise<RegisterComponentsResult>
  {
    // Normalize and resolve paths relative to component
    const normalizedConfigs: ComponentConfig[] = Array.isArray(configs)
      ? configs.map((config) => ({
        ...config,
        path: resolvePath(config.path, componentUrl),
      }))
      : Object.entries(configs).map(([name, value]) =>
        typeof value === "string"
          ? { name, path: resolvePath(value, componentUrl) }
          : { name, ...value, path: resolvePath(value.path, componentUrl) },
      );

    return framework().then((l) => l.registerComponents(normalizedConfigs));
  }

  /**
   * Shorthand for registering a component with auto-derived tag name.
   * "./HeaderButtons.html" → registers as <header-buttons>
   */
  function $use(
    path: string,
    useShadowDOM: boolean = true,
    lazy: boolean | LazyStrategy = false,
  ): Promise<void>
  {
    const tagName = filenameToTagName(path);
    const resolvedPath = resolvePath(path, componentUrl);
    return framework().then((l) =>
      l.registerComponent(tagName, resolvedPath, useShadowDOM, lazy),
    );
  }

  return { registerComponent, registerComponents, $use };
}

/**
 * Names of all framework helpers (for Function parameter lists)
 */
export const frameworkHelperNames = [
  "registerComponent",
  "registerComponents",
  "$use",
];

/**
 * Default helpers for entry point usage (resolve relative to page URL).
 * Inside components, use createFrameworkHelpers(componentUrl) instead.
 */
export function getFrameworkHelperValues(): ((...args: any[]) => any)[]
{
  const helpers = createFrameworkHelpers(window.location.href);
  return [helpers.registerComponent, helpers.registerComponents, helpers.$use];
}

// For entry point / CDN usage - resolve relative to current page.
// Built on first call rather than at import time: build tools pull this module
// into Node, where `window` only exists once a DOM shim has been installed.
let defaultHelpers: ReturnType<typeof createFrameworkHelpers> | undefined;
const page = () =>
  (defaultHelpers ??= createFrameworkHelpers(window.location.href));

type Helpers = ReturnType<typeof createFrameworkHelpers>;

export const registerComponent = (...args: Parameters<Helpers["registerComponent"]>) =>
  page().registerComponent(...args);

export const registerComponents = (...args: Parameters<Helpers["registerComponents"]>) =>
  page().registerComponents(...args);

export const $use = (...args: Parameters<Helpers["$use"]>) => page().$use(...args);
