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
  createError,
} from "../utils/devWarnings";

const CUSTOM_ELEMENT_NAME = /^[a-z][.0-9_a-z-]*-[.0-9_a-z-]*$/;
const RESERVED_CUSTOM_ELEMENT_NAMES = new Set([
  "annotation-xml",
  "color-profile",
  "font-face",
  "font-face-src",
  "font-face-uri",
  "font-face-format",
  "font-face-name",
  "missing-glyph",
]);

function validateComponentConfig(
  name: unknown,
  path: unknown,
): LadrillosError | null
{
  const context = {
    tagName: typeof name === "string" ? name : String(name ?? ""),
    sourcePath: typeof path === "string" ? path : String(path ?? ""),
  };

  if (
    typeof name !== "string" ||
    name !== name.trim() ||
    !CUSTOM_ELEMENT_NAME.test(name) ||
    RESERVED_CUSTOM_ELEMENT_NAMES.has(name)
  )
  {
    return createError(
      `Invalid component name "${context.tagName || "(empty)"}". Custom element names must contain a hyphen and use lowercase characters.`,
      ErrorCode.INVALID_COMPONENT_NAME,
      context,
      'Use a lowercase name with a hyphen, such as "user-card".',
    );
  }

  if (typeof path !== "string" || !path.trim())
  {
    return createError(
      "A component path is required.",
      ErrorCode.INVALID_COMPONENT_PATH,
      context,
      "Pass a URL or relative .html path as the component path.",
    );
  }

  return null;
}

function reportRegistrationError(diagnostic: LadrillosError): void
{
  error(
    diagnostic.diagnosticMessage,
    diagnostic.componentContext,
    diagnostic.cause,
    { code: diagnostic.code, hint: diagnostic.hint },
  );
}

function resolveComponentUrl(
  path: string,
  context: { tagName: string; sourcePath: string },
): string
{
  try
  {
    return new URL(path, window.location.href).href;
  } catch (cause)
  {
    throw createError(
      `Invalid component path "${path}".`,
      ErrorCode.INVALID_COMPONENT_PATH,
      context,
      "Pass a valid URL or relative .html path.",
      cause,
    );
  }
}

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
  private readonly registeredNames = new Set<string>();

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
    if (this.registeredNames.has(name) || this.components[name])
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

    const validationError = validateComponentConfig(name, path);
    if (validationError)
    {
      reportRegistrationError(validationError);
      return;
    }

    if (customElements.get(name))
    {
      reportRegistrationError(createError(
        `Custom element "<${name}>" is already defined outside this registration.`,
        ErrorCode.COMPONENT_ALREADY_REGISTERED,
        context,
        "Use a different component name or remove the existing custom element definition.",
      ));
      return;
    }

    try
    {
      // Resolve relative paths before loading so nested resources use the
      // component file as their base URL.
      const absolutePath = resolveComponentUrl(path, context);

      if (lazy)
      {
        const strategy = lazy === true ? defaultLazyStrategy : lazy;
        registerLazyComponent(name, absolutePath, useShadowDOM, strategy);
        this.registeredNames.add(name);
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
      this.registeredNames.add(name);
    } catch (e)
    {
      delete this.components[name];
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
  * - Defines each component as soon as its source and dependencies are ready
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
    const seenNames = new Set<string>();

    for (const config of componentConfigs)
    {
      if (
        this.registeredNames.has(config.name) ||
        this.components[config.name]
      )
      {
        result.skipped.push(config.name);
        continue;
      }

      const diagnostic = validateComponentConfig(config.name, config.path);
      if (diagnostic)
      {
        result.failed.push({ name: String(config.name ?? ""), error: diagnostic });
        reportRegistrationError(diagnostic);
        continue;
      }

      if (seenNames.has(config.name))
      {
        const duplicate = createError(
          `Component "<${config.name}>" appears more than once in the same batch.`,
          ErrorCode.COMPONENT_ALREADY_REGISTERED,
          { tagName: config.name, sourcePath: config.path },
          "Remove the duplicate batch entry or use a different component name.",
        );
        result.failed.push({ name: config.name, error: duplicate });
        reportRegistrationError(duplicate);
        continue;
      }
      seenNames.add(config.name);

      if (customElements.get(config.name))
      {
        const conflict = createError(
          `Custom element "<${config.name}>" is already defined outside this registration.`,
          ErrorCode.COMPONENT_ALREADY_REGISTERED,
          { tagName: config.name, sourcePath: config.path },
          "Use a different component name or remove the existing custom element definition.",
        );
        result.failed.push({ name: config.name, error: conflict });
        reportRegistrationError(conflict);
        continue;
      }

      let absolutePath: string;
      try
      {
        absolutePath = resolveComponentUrl(config.path, {
          tagName: config.name,
          sourcePath: config.path,
        });
      } catch (cause)
      {
        const pathError = cause instanceof Error
          ? cause
          : new Error(String(cause));
        result.failed.push({ name: config.name, error: pathError });
        if (pathError instanceof LadrillosError)
        {
          reportRegistrationError(pathError);
        }
        continue;
      }

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
        this.registeredNames.add(config.name);
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

    const registrationResults = await Promise.allSettled(
      eagerComponents.map(async (config) =>
      {
        const fetched = await fetchComponentSource(config.absolutePath);
        const { parseComponent } = await import("./component/extract");
        const component = await parseComponent(
          fetched.source,
          config.name,
          fetched.resolvedPath,
        );
        this.components[config.name] = component;
        try
        {
          createWebComponent(component, config.useShadowDOM ?? true);
          this.registeredNames.add(config.name);
        } catch (cause)
        {
          delete this.components[config.name];
          throw cause;
        }
      }),
    );

    for (const [index, registration] of registrationResults.entries())
    {
      const config = eagerComponents[index];

      if (registration.status === "rejected")
      {
        result.failed.push({
          name: config.name,
          error:
            registration.reason instanceof Error
              ? registration.reason
              : new Error(String(registration.reason)),
        });
        error(
          `Error registering component "${config.name}"`,
          { tagName: config.name, sourcePath: config.path },
          registration.reason,
        );
      }
      else
      {
        result.success.push(config.name);
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
