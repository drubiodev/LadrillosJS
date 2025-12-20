/**
 * Lazy Placeholder Web Component
 *
 * A lightweight placeholder that observes for lazy loading triggers
 * and upgrades to the real component when activated.
 */

import { LadrillosComponent } from "../../types";
import { parseComponent } from "../component/extract";
import { fetchComponentSource } from "../component/loader";
import { createWebComponentClass } from "../component/webcomponent";
import { LazyStrategy } from "./lazyStrategies";

/** Shared loading promises to dedupe fetches for same component */
const loadingPromises = new Map<string, Promise<LadrillosComponent>>();

/** Components registry reference (injected from main Ladrillos instance) */
let componentsRegistry: Record<string, LadrillosComponent>;

/** Loaded component data for creating instances */
interface LoadedComponentData {
  component: LadrillosComponent;
  useShadowDOM: boolean;
}
const loadedComponents = new Map<string, LoadedComponentData>();

/** Track which real components have been defined */
const definedRealComponents = new Set<string>();

/** Pending lazy component configs */
interface LazyComponentConfig {
  name: string;
  absolutePath: string;
  useShadowDOM: boolean;
  strategy: LazyStrategy;
}

const lazyConfigs = new Map<string, LazyComponentConfig>();

/**
 * Get the internal tag name for the real component
 */
function getRealTagName(name: string): string {
  return `${name}--loaded`;
}

/**
 * Initialize the lazy loading system with the components registry
 */
export function initLazyLoader(
  registry: Record<string, LadrillosComponent>
): void {
  componentsRegistry = registry;
}

/**
 * Register a component for lazy loading
 */
export function registerLazyComponent(
  name: string,
  absolutePath: string,
  useShadowDOM: boolean,
  strategy: LazyStrategy
): void {
  // Store config for lazy loading
  lazyConfigs.set(name, {
    name,
    absolutePath,
    useShadowDOM,
    strategy,
  });

  // Define a placeholder custom element
  if (!customElements.get(name)) {
    customElements.define(name, createPlaceholderClass(name));
  }
}

/**
 * Load a lazy component (shared across all instances)
 */
async function loadLazyComponent(name: string): Promise<string> {
  const realTagName = getRealTagName(name);

  // Already loaded and defined?
  if (definedRealComponents.has(name)) {
    return realTagName;
  }

  // Already loading? Return shared promise
  if (loadingPromises.has(name)) {
    await loadingPromises.get(name)!;
    return realTagName;
  }

  const config = lazyConfigs.get(name);
  if (!config) {
    throw new Error(`Lazy component "${name}" not registered`);
  }

  // Create shared loading promise
  const loadPromise = (async () => {
    const source = await fetchComponentSource(config.absolutePath);
    if (!source) {
      throw new Error(`Failed to fetch component source for "${name}"`);
    }

    const component = await parseComponent(source, name, config.absolutePath);

    // Store in registry
    componentsRegistry[name] = component;

    // Create and register the real component with a different tag name
    const ComponentClass = createWebComponentClass(
      component,
      config.useShadowDOM
    );

    // Define the real component with the internal tag name
    if (!customElements.get(realTagName)) {
      customElements.define(realTagName, ComponentClass);
    }

    definedRealComponents.add(name);
    loadedComponents.set(name, {
      component,
      useShadowDOM: config.useShadowDOM,
    });

    return component;
  })();

  loadingPromises.set(name, loadPromise);

  try {
    await loadPromise;
    return realTagName;
  } finally {
    // Clean up loading promise after completion
    loadingPromises.delete(name);
  }
}

/**
 * Create a placeholder class for a lazy component
 */
function createPlaceholderClass(componentName: string) {
  return class LazyPlaceholder extends HTMLElement {
    private teardown?: () => void;
    private isLoading = false;
    private isUpgraded = false;

    connectedCallback() {
      // Check for eager attribute - load immediately
      if (this.hasAttribute("eager")) {
        this.triggerLoad();
        return;
      }

      const config = lazyConfigs.get(componentName);
      if (!config) {
        // Component already loaded, upgrade immediately
        this.triggerLoad();
        return;
      }

      // Start observing with the configured strategy
      this.teardown = config.strategy(() => this.triggerLoad(), this) as
        | (() => void)
        | undefined;
    }

    disconnectedCallback() {
      this.teardown?.();
      this.teardown = undefined;
    }

    private async triggerLoad() {
      if (this.isLoading || this.isUpgraded) return;
      this.isLoading = true;

      // Clean up observer
      this.teardown?.();
      this.teardown = undefined;

      try {
        const realTagName = await loadLazyComponent(componentName);
        this.isUpgraded = true;

        // Create real component instance and replace placeholder
        this.upgradeToRealComponent(realTagName);
      } catch (error) {
        console.error(
          `Failed to load lazy component "${componentName}":`,
          error
        );
        this.isLoading = false;
      }
    }

    private upgradeToRealComponent(realTagName: string) {
      // Create real component using document.createElement (requires it to be defined)
      const realElement = document.createElement(realTagName);

      // Copy attributes (except internal ones)
      for (const attr of Array.from(this.attributes)) {
        if (attr.name !== "eager" && attr.name !== "tabindex") {
          realElement.setAttribute(attr.name, attr.value);
        }
      }

      // Don't move children - the real component has its own template
      // The placeholder children were just for showing a loading state

      // Replace in DOM
      if (this.parentNode) {
        this.parentNode.replaceChild(realElement, this);
      } else {
        console.error(`❌ No parent node for placeholder`);
      }
    }
  };
}

/**
 * Check if a component is registered for lazy loading
 */
export function isLazyComponent(name: string): boolean {
  return lazyConfigs.has(name) || definedRealComponents.has(name);
}

/**
 * Force load a lazy component (for programmatic loading)
 */
export async function forceLoadLazyComponent(
  name: string
): Promise<LadrillosComponent | undefined> {
  if (lazyConfigs.has(name)) {
    await loadLazyComponent(name);
  }
  return componentsRegistry[name];
}

/**
 * Get the real tag name for a loaded lazy component
 */
export function getLazyComponentTagName(name: string): string | undefined {
  if (definedRealComponents.has(name)) {
    return getRealTagName(name);
  }
  return undefined;
}
