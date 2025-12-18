import { LadrillosComponent } from "../types";
import { parseComponent } from "./component/extract";
import { fetchComponentSource } from "./component/loader";
import { createWebComponent } from "./component/webcomponent";

/**
 * Component registration configuration
 */
export interface ComponentConfig {
  name: string;
  path: string;
  useShadowDOM?: boolean;
  lazy?: boolean;
}

/**
 * Result of a batch component registration
 */
export interface RegisterComponentsResult {
  /** Components that registered successfully */
  success: string[];
  /** Components that failed with their errors */
  failed: Array<{ name: string; error: Error }>;
  /** Components that were skipped (already registered) */
  skipped: string[];
}

class Ladrillos {
  components: Record<string, LadrillosComponent>;

  constructor() {
    this.components = {};
  }

  async registerComponent(
    name: string,
    path: string,
    useShadowDOM: boolean = true,
    lazy: boolean = false
  ): Promise<void> {
    // check if component is already registered
    if (this.components[name]) {
      console.warn(`Component with name "${name}" is already registered.`);
      return;
    }

    // TODO: Lazy components

    // Resolve relative path to absolute URL
    // This ensures script src paths inside components resolve correctly
    const absolutePath = new URL(path, window.location.href).href;

    // Fetch and define component
    try {
      const source = await fetchComponentSource(absolutePath);
      const component = await parseComponent(source || "", name, absolutePath);

      this.components[name] = component;

      createWebComponent(component, useShadowDOM);
    } catch (e) {
      console.error(`Error registering component "${name}":`, e);
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
      | Record<string, string | Omit<ComponentConfig, "name">>
  ): Promise<RegisterComponentsResult> {
    // Normalize input to array format
    const componentConfigs: ComponentConfig[] = Array.isArray(configs)
      ? configs
      : Object.entries(configs).map(([name, value]) =>
          typeof value === "string" ? { name, path: value } : { name, ...value }
        );

    const result: RegisterComponentsResult = {
      success: [],
      failed: [],
      skipped: [],
    };

    // Early deduplication - filter out already registered components
    const toRegister: Array<ComponentConfig & { absolutePath: string }> = [];

    for (const config of componentConfigs) {
      if (this.components[config.name]) {
        result.skipped.push(config.name);
        continue;
      }

      // Resolve path once
      const absolutePath = new URL(config.path, window.location.href).href;
      toRegister.push({ ...config, absolutePath });
    }

    if (toRegister.length === 0) {
      return result;
    }

    // Parallel fetch all component sources
    // Using Promise.allSettled for graceful error handling per component
    const fetchResults = await Promise.allSettled(
      toRegister.map(async (config) => {
        const source = await fetchComponentSource(config.absolutePath);
        return { config, source };
      })
    );

    // Parse components (can be done in parallel too)
    const parseResults = await Promise.allSettled(
      fetchResults.map(async (fetchResult, index) => {
        if (fetchResult.status === "rejected") {
          throw fetchResult.reason;
        }

        const { config, source } = fetchResult.value;
        if (!source) {
          throw new Error(
            `Failed to fetch component source from ${config.absolutePath}`
          );
        }

        const component = await parseComponent(
          source,
          config.name,
          config.absolutePath
        );
        return { config, component };
      })
    );

    // Batch register all successfully parsed components
    // This minimizes the number of customElements.define calls in tight succession
    for (let i = 0; i < parseResults.length; i++) {
      const parseResult = parseResults[i];
      const config = toRegister[i];

      if (parseResult.status === "rejected") {
        result.failed.push({
          name: config.name,
          error:
            parseResult.reason instanceof Error
              ? parseResult.reason
              : new Error(String(parseResult.reason)),
        });
        console.error(
          `Error registering component "${config.name}":`,
          parseResult.reason
        );
        continue;
      }

      const { component } = parseResult.value;
      const useShadowDOM = config.useShadowDOM ?? true;

      // Store in registry
      this.components[config.name] = component;

      // Define custom element
      try {
        createWebComponent(component, useShadowDOM);
        result.success.push(config.name);
      } catch (e) {
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
}

export const ladrillos = new Ladrillos();
