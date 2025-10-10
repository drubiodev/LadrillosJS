import { ladrillos } from "./core/main.js";
import { eventBus } from "./core/eventBus.js";

declare global {
  interface Window {
    ladrillosjs: {
      registerComponent: typeof registerComponent;
      registerComponents: typeof registerComponents;
    };
    $listen: typeof $listen;
    $emit: typeof $emit;
    $querySelector: typeof $querySelector;
    $querySelectorAll: typeof $querySelectorAll;
    $component: typeof $component;
  }
}

export const registerComponent = (
  name: string,
  path: string,
  useShadowDOM?: boolean
) => ladrillos.registerComponent(name, path, useShadowDOM);

export const registerComponents = async (
  components: Array<{ name: string; path: string; useShadowDOM?: boolean }>
): Promise<void> => {
  await Promise.all(
    components.map(({ name, path, useShadowDOM }) =>
      ladrillos.registerComponent(name, path, useShadowDOM)
    )
  );
};

// Event bus helper functions
export const $listen = (event: string, callback: (data?: any) => void) => {
  return eventBus.listen(event, callback);
};

export const $emit = (event: string, data?: any) => {
  eventBus.emit(event, data);
};

// Component context management
// Maps script URLs to their component contexts for persistent association
const scriptContextMap = new Map<
  string,
  { shadowRoot?: ShadowRoot; element?: HTMLElement }
>();
const activeContext: { shadowRoot?: ShadowRoot; element?: HTMLElement } | null =
  null;

/**
 * Internal: Set component context for a script
 * Called by the framework when loading scripts from components
 */
export const __setComponentContext = (
  shadowRoot?: ShadowRoot,
  element?: HTMLElement
) => {
  // Store in the global registry by component tag name
  if (element) {
    const tagName = element.tagName.toLowerCase();
    if (!(window as any).__ladrilloContexts) {
      (window as any).__ladrilloContexts = new Map();
    }
    (window as any).__ladrilloContexts.set(tagName, { shadowRoot, element });
  }
};

/**
 * Internal: Get component context for the current script
 */
const getComponentContext = () => {
  const registry = (window as any).__ladrilloContexts as Map<string, any>;
  if (registry && registry.size > 0) {
    // For now, return the last registered context
    // In the future, we could track which script belongs to which component
    const contexts = Array.from(registry.values());
    return contexts[contexts.length - 1];
  }
  return null;
};

// DOM query helpers with smart component context detection
// Automatically searches within component context when appropriate
export const $querySelector = (
  selector: string,
  root?: Element | Document | ShadowRoot
): Element | null => {
  if (root) {
    return root.querySelector(selector);
  }

  // Try to get component context
  const ctx = getComponentContext();
  if (ctx) {
    const searchRoot = ctx.shadowRoot || ctx.element;
    if (searchRoot) {
      const result = searchRoot.querySelector(selector);
      if (result) return result;
    }
  }

  // Fallback to document
  return document.querySelector(selector);
};

export const $querySelectorAll = (
  selector: string,
  root?: Element | Document | ShadowRoot
): NodeListOf<Element> => {
  if (root) {
    return root.querySelectorAll(selector);
  }

  // Try to get component context
  const ctx = getComponentContext();
  if (ctx) {
    const searchRoot = ctx.shadowRoot || ctx.element;
    if (searchRoot) {
      const result = searchRoot.querySelectorAll(selector);
      if (result.length > 0) return result;
    }
  }

  // Fallback to document
  return document.querySelectorAll(selector);
};
/**
 * Get a component element and create scoped query helpers for it
 * Useful for external module scripts that need to query within a specific component
 * @param componentSelector - Selector to find the component (e.g., "side-nav")
 * @returns Object with scoped query helpers, or null if component not found
 */
export const $component = (componentSelector: string) => {
  const component = document.querySelector(componentSelector);
  if (!component) return null;

  // Check for shadow root or use the element itself
  const root = (component as any).shadowRoot || component;

  return {
    element: component,
    shadowRoot: (component as any).shadowRoot,
    querySelector: (selector: string) => root.querySelector(selector),
    querySelectorAll: (selector: string) => root.querySelectorAll(selector),
  };
};

// for a browser‑global via <script src="…ladrillosjs.js"></script>
if (typeof window !== "undefined") {
  window.ladrillosjs = {
    registerComponent,
    registerComponents,
  };

  // Expose helper functions globally for non-module scripts
  window.$listen = $listen;
  window.$emit = $emit;
  window.$querySelector = $querySelector;
  window.$querySelectorAll = $querySelectorAll;
  window.$component = $component;
}
