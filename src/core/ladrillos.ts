import { LadrillosComponent } from "../types";
import { fetchComponentSource } from "./component/loader";
import { createWebComponent } from "./component/webcomponent";
import
{
  LazyStrategy,
  defaultLazyStrategy,
  initLazyLoader,
  registerLazyComponent,
  forceLoadLazyComponent,
} from "./lazy";
import
{
  warn,
  error,
  ErrorCode,
  LadrillosError,
} from "../utils/devWarnings";

/**
 * Component registration configuration
 */
export interface ComponentConfig
{
  name: string;
  path: string;
  useShadowDOM?: boolean;
  /**
   * Lazy loading configuration:
   * - `false` (default): Load immediately
   * - `true`: Lazy load using default strategy (visible with 100px margin)
   * - `LazyStrategy`: Custom lazy loading strategy
   */
  lazy?: boolean | LazyStrategy;
}

/**
 * Result of a batch component registration
 */
export interface RegisterComponentsResult
{
  /** Components that registered successfully */
  success: string[];
  /** Components that failed with their errors */
  failed: Array<{ name: string; error: Error }>;
  /** Components that were skipped (already registered) */
  skipped: string[];
}

class Ladrillos
{
  components: Record<string, LadrillosComponent>;

  constructor()
  {
    this.components = {};
    // Initialize lazy loader with our components registry
    initLazyLoader(this.components);
  }

  async registerComponent(
    name: string,
    path: string,
    useShadowDOM: boolean = true,
    lazy: boolean | LazyStrategy = false,
  ): Promise<void>
  {
    // check if component is already registered
    if (this.components[name])
    {
      warn(
        `Component "<${name}>" is already registered.`,
        { tagName: name, sourcePath: path },
        {
          code: ErrorCode.COMPONENT_ALREADY_REGISTERED,
          hint: "Remove the duplicate registration call or use a different component name.",
        },
      );
      return;
    }

    const context = { tagName: name, sourcePath: path };

    if (!name?.trim() || !name.includes("-"))
    {
      error(
        `Invalid component name "${name || "(empty)"}". Custom element names must contain a hyphen.`,
        context,
        undefined,
        {
          code: ErrorCode.INVALID_COMPONENT_NAME,
          hint: 'Use a lowercase name with a hyphen, such as "user-card".',
        },
      );
      return;
    }

    if (!path?.trim())
    {
      error("A component path is required.", context, undefined, {
        code: ErrorCode.INVALID_COMPONENT_PATH,
        hint: "Pass a URL or relative .html path as the second argument to registerComponent().",
      });
      return;
    }

    try
    {
      // Resolve relative paths before loading so nested resources use the
      // component file as their base URL.
      const absolutePath = new URL(path, window.location.href).href;

      if (lazy)
      {
        const strategy = lazy === true ? defaultLazyStrategy : lazy;
        registerLazyComponent(name, absolutePath, useShadowDOM, strategy);
        return;
      }

      const fetchResult = await fetchComponentSource(absolutePath);
      // Loaded on demand so builds that only use precompiled components never
      // pull the HTML parser into their bundle.
      const { parseComponent } = await import("./component/extract");
      // Use the resolved path (e.g., /components/search/index.html instead of /components/search)
      const component = await parseComponent(
        fetchResult.source,
        name,
        fetchResult.resolvedPath,
      );

      this.components[name] = component;

      createWebComponent(component, useShadowDOM);
    } catch (e)
    {
      const diagnostic = e instanceof LadrillosError ? e : null;
      error(
        "Could not register the component.",
        context,
        e,
        {
          code:
            diagnostic?.code ?? ErrorCode.COMPONENT_REGISTRATION_FAILED,
          hint:
            diagnostic?.hint ??
            "Check the component template and the original error shown below.",
        },
      );
    }
  }

  /**
   * Register multiple components at once with parallel fetching.
   *
   * Benefits over sequential registration:
   * - Parallel network requests via Promise.allSettled
   * - Early deduplication check (skips already registered)
   * - Batched custom element definitions
   * - Returns detailed results for error handling
   *
   * @example
   * ```js
   * // Array syntax
   * await ladrillos.registerComponents([
   *   { name: 'my-header', path: './header.html' },
   *   { name: 'my-footer', path: './footer.html', useShadowDOM: false }
   * ]);
   *
   * // Object syntax
   * await ladrillos.registerComponents({
   *   'my-header': './header.html',
   *   'my-footer': { path: './footer.html', useShadowDOM: false }
   * });
   * ```
   */
  async registerComponents(
    configs:
      | ComponentConfig[]
      | Record<string, string | Omit<ComponentConfig, "name">>,
  ): Promise<RegisterComponentsResult>
  {
    // Normalize input to array format
    const componentConfigs: ComponentConfig[] = Array.isArray(configs)
      ? configs
      : Object.entries(configs).map(([name, value]) =>
        typeof value === "string"
          ? { name, path: value }
          : { name, ...value },
      );

    const result: RegisterComponentsResult = {
      success: [],
      failed: [],
      skipped: [],
    };

    // Separate lazy and eager components
    const lazyComponents: Array<ComponentConfig & { absolutePath: string }> =
      [];
    const eagerComponents: Array<ComponentConfig & { absolutePath: string }> =
      [];

    for (const config of componentConfigs)
    {
      if (this.components[config.name])
      {
        result.skipped.push(config.name);
        continue;
      }

      // Resolve path once
      const absolutePath = new URL(config.path, window.location.href).href;
      const configWithPath = { ...config, absolutePath };

      if (config.lazy)
      {
        lazyComponents.push(configWithPath);
      } else
      {
        eagerComponents.push(configWithPath);
      }
    }

    // Register lazy components immediately (no network request yet)
    for (const config of lazyComponents)
    {
      try
      {
        const strategy =
          config.lazy === true
            ? defaultLazyStrategy
            : (config.lazy as LazyStrategy);
        const useShadowDOM = config.useShadowDOM ?? true;
        registerLazyComponent(
          config.name,
          config.absolutePath,
          useShadowDOM,
          strategy,
        );
        result.success.push(config.name);
      } catch (e)
      {
        result.failed.push({
          name: config.name,
          error: e instanceof Error ? e : new Error(String(e)),
        });
      }
    }

    // Process eager components with parallel fetching
    if (eagerComponents.length === 0)
    {
      return result;
    }

    // Parallel fetch all eager component sources
    const fetchResults = await Promise.allSettled(
      eagerComponents.map(async (config) =>
      {
        const result = await fetchComponentSource(config.absolutePath);
        return { config, result };
      }),
    );

    // Parse components in parallel
    const parseResults = await Promise.allSettled(
      fetchResults.map(async (fetchResult, index) =>
      {
        if (fetchResult.status === "rejected")
        {
          throw fetchResult.reason;
        }

        const { config, result } = fetchResult.value;

        const { parseComponent } = await import("./component/extract");
        // Use the resolved path for correct relative path resolution in child components
        const component = await parseComponent(
          result.source,
          config.name,
          result.resolvedPath,
        );
        return { config, component };
      }),
    );

    // Batch register all successfully parsed components
    for (let i = 0; i < parseResults.length; i++)
    {
      const parseResult = parseResults[i];
      const config = eagerComponents[i];

      if (parseResult.status === "rejected")
      {
        result.failed.push({
          name: config.name,
          error:
            parseResult.reason instanceof Error
              ? parseResult.reason
              : new Error(String(parseResult.reason)),
        });
        error(
          `Error registering component "${config.name}"`,
          { tagName: config.name, sourcePath: config.path },
          parseResult.reason,
        );
        continue;
      }

      const { component } = parseResult.value;
      const useShadowDOM = config.useShadowDOM ?? true;

      // Store in registry
      this.components[config.name] = component;

      // Define custom element
      try
      {
        createWebComponent(component, useShadowDOM);
        result.success.push(config.name);
      } catch (e)
      {
        result.failed.push({
          name: config.name,
          error: e instanceof Error ? e : new Error(String(e)),
        });
        // Remove from registry on failure
        delete this.components[config.name];
      }
    }

    return result;
  }

  /**
   * Force load a lazy component programmatically.
   * Useful for preloading components before they're visible.
   */
  async loadLazyComponent(
    name: string,
  ): Promise<LadrillosComponent | undefined>
  {
    return forceLoadLazyComponent(name);
  }
}

export const ladrillos = new Ladrillos();
