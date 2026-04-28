import { ScriptElement, ExternalScriptElement } from "../../types";
import {
  frameworkHelperNames,
  createFrameworkHelpers,
} from "../helpers/frameworkHelpers";
import { eventBusHelperNames, createEventBusHelpers } from "../events/eventBus";
import { createReactiveArray } from "./reactivity";
import {
  error,
  scriptError,
  getComponentContext,
  ErrorCode,
} from "../../utils/devWarnings";

/**
 * Executes module scripts at runtime with REACTIVITY support.
 *
 * Key features:
 * 1. Rewrites relative imports to absolute URLs
 * 2. Fetches and resolves ES module imports
 * 3. Extracts declared variables for reactive state integration
 * 4. Supports both side-effect execution AND variable extraction
 * 5. Wraps imported arrays in reactive proxies for automatic UI updates
 *
 * This allows <script type="module"> in components to:
 * - Import from other files
 * - Declare reactive variables (let name = "value")
 * - Import arrays that automatically trigger UI updates on mutation
 * - Work the same as regular scripts for template bindings
 *
 * @example
 * ```html
 * <script type="module">
 *   import { links } from "./links.js";
 *   let name = "Header";  // This becomes reactive state!
 *   console.log(links);
 * </script>
 * ```
 */

// Track created blob URLs for cleanup
const blobUrlRegistry = new Map<string, string[]>();

// Cache for fetched modules to avoid duplicate requests
const moduleCache = new Map<string, Promise<Record<string, unknown>>>();

/**
 * Regex patterns for import/export statements
 * Handles various forms:
 *   import { x } from "./file.js"
 *   import x from './file.js'
 *   import "./side-effect.js"
 *   export { x } from "./file.js"
 *   const x = await import("./dynamic.js")
 */
const STATIC_IMPORT_REGEX =
  /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_REGEX = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * TypeScript file extensions that need transpilation
 */
const TS_EXTENSIONS = [".ts", ".tsx", ".mts"];

/**
 * Checks if a path is relative (starts with ./ or ../)
 */
function isRelativePath(path: string): boolean {
  return path.startsWith("./") || path.startsWith("../");
}

/**
 * Checks if a path points to a TypeScript file
 */
function isTypeScriptFile(path: string): boolean {
  return TS_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/**
 * Checks if a path is a bare specifier (npm package)
 * These need special handling - they won't work without a bundler or import map
 */
function isBareSpecifier(path: string): boolean {
  return (
    !path.startsWith("/") &&
    !path.startsWith("./") &&
    !path.startsWith("../") &&
    !path.startsWith("http://") &&
    !path.startsWith("https://") &&
    !path.startsWith("data:") &&
    !path.startsWith("blob:")
  );
}

/**
 * Rewrites relative imports in module code to absolute URLs.
 *
 * NOTE: When using a dev server like Vite, TypeScript imports work because
 * the server transpiles .ts files on-the-fly. Without a dev server, you need
 * to use .js files or pre-compile your TypeScript.
 *
 * @param code - The module script content
 * @param baseUrl - The URL to resolve relative paths against (component's URL)
 * @returns The code with rewritten imports
 */
export function rewriteImports(code: string, baseUrl: string): string {
  let result = code;

  // Track issues for warnings
  const bareSpecifiers: string[] = [];
  const tsImports: string[] = [];

  // Rewrite static imports/exports
  result = result.replace(STATIC_IMPORT_REGEX, (match, importPath) => {
    if (isRelativePath(importPath)) {
      const absoluteUrl = new URL(importPath, baseUrl).href;
      if (isTypeScriptFile(importPath)) {
        tsImports.push(importPath);
      }
      return match.replace(importPath, absoluteUrl);
    }
    if (isBareSpecifier(importPath)) {
      bareSpecifiers.push(importPath);
    }
    return match;
  });

  // Rewrite dynamic imports
  result = result.replace(DYNAMIC_IMPORT_REGEX, (match, importPath) => {
    if (isRelativePath(importPath)) {
      const absoluteUrl = new URL(importPath, baseUrl).href;
      if (isTypeScriptFile(importPath)) {
        tsImports.push(importPath);
      }
      return `import("${absoluteUrl}")`;
    }
    if (isBareSpecifier(importPath)) {
      bareSpecifiers.push(importPath);
    }
    return match;
  });

  // Warn about TypeScript imports (they work with dev servers like Vite, but not in plain browser)
  if (tsImports.length > 0) {
    console.info(
      `[LadrillosJS] TypeScript imports detected: ${tsImports.join(", ")}. ` +
      `These work with dev servers (Vite, etc.) that transpile on-the-fly. ` +
      `For production without a bundler, use .js files.`,
    );
  }

  // Warn about bare specifiers
  if (bareSpecifiers.length > 0) {
    console.warn(
      `[LadrillosJS] Bare import specifiers found: ${bareSpecifiers.join(
        ", ",
      )}. ` +
      `These require an import map, bundler, or CDN URL to work at runtime.`,
    );
  }

  return result;
}

/**
 * Creates a blob URL from module code.
 * The blob URL can be dynamically imported.
 */
function createModuleBlobUrl(code: string): string {
  const blob = new Blob([code], { type: "text/javascript" });
  return URL.createObjectURL(blob);
}

/**
 * Executes a single inline module script.
 *
 * @param script - The script element containing module code
 * @param componentUrl - The component's URL for resolving relative imports
 * @param componentId - Unique ID for tracking blob URLs
 * @returns Promise that resolves when the module has executed
 */
export async function executeModuleScript(
  script: ScriptElement,
  componentUrl: string,
  componentId?: string,
): Promise<unknown> {
  if (script.type !== "module") {
    throw new Error('executeModuleScript only handles type="module" scripts');
  }

  // Rewrite relative imports to absolute URLs
  const rewrittenCode = rewriteImports(script.content, componentUrl);

  // Create a blob URL for the rewritten module
  const blobUrl = createModuleBlobUrl(rewrittenCode);

  // Track for cleanup
  if (componentId) {
    const urls = blobUrlRegistry.get(componentId) || [];
    urls.push(blobUrl);
    blobUrlRegistry.set(componentId, urls);
  }

  try {
    // Dynamically import the module
    // Using a comment to prevent bundlers from trying to resolve this
    const moduleExports = await (0, eval)(`import("${blobUrl}")`);
    return moduleExports;
  } catch (err) {
    scriptError(
      "Failed to execute module script",
      err as Error,
      getComponentContext() || { sourcePath: componentUrl },
    );
    throw err;
  }
}

/**
 * Regex to extract top-level variable declarations from module code.
 * Matches: let x, const y, var z (with optional = assignment)
 * Does NOT match declarations inside functions/blocks.
 */
const TOP_LEVEL_VAR_REGEX =
  /^(?:export\s+)?(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm;

/**
 * Extracts top-level variable names from module code.
 * Used to auto-export all declarations
 */
function extractTopLevelVariables(code: string): string[] {
  const variables: string[] = [];
  let match;

  // Reset regex state
  TOP_LEVEL_VAR_REGEX.lastIndex = 0;

  while ((match = TOP_LEVEL_VAR_REGEX.exec(code)) !== null) {
    variables.push(match[1]);
  }

  // Also extract function declarations: function foo() {}
  const funcRegex = /^(?:export\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm;
  while ((match = funcRegex.exec(code)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}

/**
 * Transforms module code to export all top-level declarations.
 * This enable "no export needed" behavior.
 *
 * Example:
 *   const suggestionItems = ['a', 'b'];
 * Becomes:
 *   const suggestionItems = ['a', 'b'];
 *   export { suggestionItems };  // Auto-added
 */
function autoExportAllDeclarations(code: string): string {
  const variables = extractTopLevelVariables(code);

  // Filter out variables that are already exported
  const alreadyExported = new Set<string>();
  const exportRegex =
    /export\s+(?:let|const|var|function)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  let match;
  while ((match = exportRegex.exec(code)) !== null) {
    alreadyExported.add(match[1]);
  }

  // Also check for `export { x, y }` style exports
  const namedExportRegex = /export\s*\{([^}]+)\}/g;
  while ((match = namedExportRegex.exec(code)) !== null) {
    const names = match[1].split(",").map((n) =>
      n
        .trim()
        .split(/\s+as\s+/)[0]
        .trim(),
    );
    names.forEach((n) => alreadyExported.add(n));
  }

  const toExport = variables.filter((v) => !alreadyExported.has(v));

  if (toExport.length === 0) {
    return code;
  }

  // Add export statement at the end
  return `${code}\nexport { ${toExport.join(", ")} };`;
}

/**
 * Transforms import statements to wrap imported values in reactive proxies.
 * This enables imported arrays to trigger UI updates when mutated.
 *
 * Transforms:
 *   import { foo, bar } from "./module.js";
 *
 * Into:
 *   import { foo as __raw_foo, bar as __raw_bar } from "./module.js";
 *   const foo = __wrapReactiveArray(__raw_foo, __ladrillos_componentId);
 *   const bar = __wrapReactiveArray(__raw_bar, __ladrillos_componentId);
 *
 * @param code - The module code with imports
 * @returns Transformed code with reactive import wrapping
 */
function transformImportsForReactivity(code: string): string {
  // Match named imports: import { a, b as c } from "..."
  const namedImportRegex =
    /import\s*\{([^}]+)\}\s*from\s*(['"][^'"]+['"])\s*;?/g;

  const wrapperStatements: string[] = [];
  let transformedCode = code;

  transformedCode = transformedCode.replace(
    namedImportRegex,
    (match, imports: string, specifier: string) => {
      const importList = imports.split(",").map((s) => s.trim());
      const newImports: string[] = [];

      for (const imp of importList) {
        if (!imp) continue;

        // Handle "foo as bar" syntax
        const asMatch = imp.match(/^(\w+)\s+as\s+(\w+)$/);
        if (asMatch) {
          const [, imported, local] = asMatch;
          const rawName = `__raw_${local}`;
          newImports.push(`${imported} as ${rawName}`);
          wrapperStatements.push(
            `const ${local} = __wrapReactiveArray(${rawName}, __ladrillos_componentId);`,
          );
        } else {
          // Simple import "foo"
          const rawName = `__raw_${imp}`;
          newImports.push(`${imp} as ${rawName}`);
          wrapperStatements.push(
            `const ${imp} = __wrapReactiveArray(${rawName}, __ladrillos_componentId);`,
          );
        }
      }

      return `import { ${newImports.join(", ")} } from ${specifier};`;
    },
  );

  // Insert wrapper statements after imports but before other code
  if (wrapperStatements.length > 0) {
    // Find the end of import statements
    const lines = transformedCode.split("\n");
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("import ") || line.startsWith("import{")) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex >= 0) {
      lines.splice(
        lastImportIndex + 1,
        0,
        "",
        "// === Reactive Import Wrappers ===",
        ...wrapperStatements,
        "// === End Reactive Import Wrappers ===",
        "",
      );
      transformedCode = lines.join("\n");
    }
  }

  return transformedCode;
}

/**
 * Generates JavaScript code that defines the framework helpers ($emit, $listen, etc.)
 * as module-level constants. This code is prepended to external module scripts
 * so they have access to the same helpers as inline scripts.
 *
 * @param componentId - Component ID for event bus cleanup
 * @param componentUrl - Component URL for path resolution
 * @returns JavaScript code string to prepend
 */
const INJECTABLE_HELPER_NAMES = [
  "$emit",
  "$listen",
  "$refs",
  "registerComponent",
  "registerComponents",
  "$use",
] as const;

/**
 * Scans module code for top-level declarations or imports whose names would
 * collide with framework helpers we plan to inject. Returns the set of
 * colliding names so the caller can skip those injected declarations.
 */
function detectHelperCollisions(code: string): Set<string> {
  const found = new Set<string>();
  for (const name of INJECTABLE_HELPER_NAMES) {
    // Match: import { name } / import { name as x } / import name from
    //        let/const/var name / function name(
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `(?:^|[\\s,{])${escaped}(?:\\s+as\\b|[\\s,}=;(])|` +
      `\\b(?:let|const|var|function)\\s+${escaped}\\b`,
      "m",
    );
    if (pattern.test(code)) found.add(name);
  }
  return found;
}

function generateHelperInjectionCode(
  componentId?: string,
  componentUrl?: string,
  exclude: ReadonlySet<string> = new Set(),
): string {
  const id = componentId || "anonymous";
  const url = componentUrl || "unknown";

  // Helper to conditionally include a `const NAME = ...;` declaration only
  // when the surrounding module hasn't already declared/imported NAME.
  const decl = (name: string, source: string) =>
    exclude.has(name) ? "" : source;  // We need to inline the event bus logic since external modules can't access our closures.
  // This creates standalone $emit and $listen functions that use a global event bus.
  // Also includes reactive array wrapping for imported arrays.
  return `
// === LadrillosJS Framework Helpers (auto-injected) ===
const __ladrillos_componentId = "${id}";
const __ladrillos_componentUrl = "${url}";

// Global event bus (shared across all components)
if (!globalThis.__ladrillosEventBus) {
  globalThis.__ladrillosEventBus = {
    listeners: new Map(),
    componentListeners: new Map()
  };
}

// Global state change callbacks (for reactive array updates)
if (!globalThis.__ladrillosStateCallbacks) {
  globalThis.__ladrillosStateCallbacks = new Map();
}

// Reactive array symbol
const __REACTIVE_ARRAY = Symbol.for("ladrillos-reactive-array");

// Array mutation methods to intercept
const __ARRAY_METHODS = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"];

// Wrap an array in a reactive proxy
const __wrapReactiveArray = (arr, componentId) => {
  if (!Array.isArray(arr) || arr[__REACTIVE_ARRAY]) return arr;
  
  const onMutate = () => {
    const callback = globalThis.__ladrillosStateCallbacks?.get(componentId);
    if (callback) callback();
  };
  
  return new Proxy(arr, {
    get(target, key) {
      if (key === __REACTIVE_ARRAY) return true;
      const value = target[key];
      if (typeof key === "string" && __ARRAY_METHODS.includes(key) && typeof value === "function") {
        return (...args) => {
          const result = value.apply(target, args);
          onMutate();
          return result;
        };
      }
      if (Array.isArray(value)) return __wrapReactiveArray(value, componentId);
      return value;
    },
    set(target, key, value) {
      const index = parseInt(key, 10);
      const isIndex = !isNaN(index);
      const isLength = key === "length";
      target[key] = Array.isArray(value) ? __wrapReactiveArray(value, componentId) : value;
      if (isIndex || isLength) onMutate();
      return true;
    }
  });
};

const __ladrillos_emit = (eventName, data) => {
  const listeners = globalThis.__ladrillosEventBus.listeners.get(eventName);
  if (!listeners || listeners.size === 0) return;
  for (const registration of listeners) {
    try {
      registration.callback(data);
    } catch (error) {
      console.error(\`[LadrillosJS] Error in event listener for "\${eventName}":\`, error);
    }
  }
};
${decl("$emit", "const $emit = __ladrillos_emit;")}

const __ladrillos_listen = (eventName, callback) => {
  const bus = globalThis.__ladrillosEventBus;
  let listeners = bus.listeners.get(eventName);
  if (!listeners) {
    listeners = new Set();
    bus.listeners.set(eventName, listeners);
  }
  const registration = { callback, componentId: __ladrillos_componentId };
  listeners.add(registration);

  // Track by component ID for cleanup
  let componentRegs = bus.componentListeners.get(__ladrillos_componentId);
  if (!componentRegs) {
    componentRegs = new Set();
    bus.componentListeners.set(__ladrillos_componentId, componentRegs);
  }
  componentRegs.add({ event: eventName, registration });

  // Return unsubscribe function
  return () => {
    listeners?.delete(registration);
    if (listeners?.size === 0) bus.listeners.delete(eventName);
    const compRegs = bus.componentListeners.get(__ladrillos_componentId);
    if (compRegs) {
      for (const reg of compRegs) {
        if (reg.registration === registration) {
          compRegs.delete(reg);
          break;
        }
      }
      if (compRegs.size === 0) bus.componentListeners.delete(__ladrillos_componentId);
    }
  };
};
${decl("$listen", "const $listen = __ladrillos_listen;")}

// Global refs registry (shared across all components)
// Each component gets its own Map, keyed by component ID
if (!globalThis.__ladrillosRefs) {
  globalThis.__ladrillosRefs = new Map();
}

// Helper to wrap refs Map in Proxy for cleaner dot notation access
const __createRefsProxy = (map) => new Proxy(map, {
  get(target, prop, receiver) {
    if (prop in target) {
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
    if (typeof prop === "string") return target.get(prop);
    return undefined;
  },
  set(target, prop, value) {
    if (typeof prop === "string") { target.set(prop, value); return true; }
    return false;
  },
  has(target, prop) {
    return typeof prop === "string" ? target.has(prop) || prop in target : prop in target;
  }
});

// Get or create refs Map for this component (wrapped in Proxy)
if (!globalThis.__ladrillosRefs.has(__ladrillos_componentId)) {
  globalThis.__ladrillosRefs.set(__ladrillos_componentId, __createRefsProxy(new Map()));
}

// $refs for this component - supports both $refs.inputEl and $refs.get("inputEl")
const __ladrillos_refs = globalThis.__ladrillosRefs.get(__ladrillos_componentId);
${decl("$refs", "const $refs = __ladrillos_refs;")}

// Helper to resolve relative paths against component URL
const __resolvePath = (path) => {
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
    return path.startsWith("/") ? new URL(path, window.location.origin).href : path;
  }
  return new URL(path, __ladrillos_componentUrl).href;
};

// Helper to convert filename to tag name
const __filenameToTagName = (path) => {
  const filename = path.split("/").pop()?.replace(/\\.[^.]+$/, "") || path;
  return filename.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[_\\s]+/g, "-").toLowerCase();
};

// registerComponent - Register a child component
const __ladrillos_registerComponent = async (name, path, useShadowDOM = true) => {
  const resolvedPath = __resolvePath(path);
  return globalThis.ladrillosjs.registerComponent({ name, path: resolvedPath, useShadowDOM });
};
${decl("registerComponent", "const registerComponent = __ladrillos_registerComponent;")}

// registerComponents - Register multiple components at once
const __ladrillos_registerComponents = async (configs) => {
  const resolvedConfigs = configs.map(config => ({
    ...config,
    path: __resolvePath(config.path)
  }));
  return globalThis.ladrillosjs.registerComponents(resolvedConfigs);
};
${decl("registerComponents", "const registerComponents = __ladrillos_registerComponents;")}

// $use - Shorthand for registerComponent with auto-derived tag name
const __ladrillos_use = async (path, useShadowDOM = true) => {
  const tagName = __filenameToTagName(path);
  return __ladrillos_registerComponent(tagName, path, useShadowDOM);
};
${decl("$use", "const $use = __ladrillos_use;")}

// === End Framework Helpers ===

`;
}

/**
 * Executes an external module script.
 * For external scripts, we fetch the content, auto-export all declarations,
 * and execute it via blob URL with injected framework helpers.
 *
 * If the script has the 'external' attribute, it's loaded as a plain
 * external script without any framework processing (no helpers, no auto-exports).
 *
 * @param script - The external script element
 * @param componentId - Optional component ID for event bus cleanup
 * @param componentUrl - Optional component URL for path resolution
 * @returns Promise that resolves with the module exports
 */
export async function executeExternalScript(
  script: ExternalScriptElement,
  componentId?: string,
  componentUrl?: string,
): Promise<unknown> {
  // Scripts with 'external' attribute are loaded as plain scripts
  // without any framework processing (no helpers, no auto-exports, no reactivity)
  // This is useful for loading third-party libraries like highlight.js
  if (script.external) {
    // Check if this script is already loaded
    const existing = document.querySelector(`script[src="${script.src}"]`);
    if (existing) return Promise.resolve(undefined);

    return new Promise((resolve, reject) => {
      const scriptEl = document.createElement("script");
      scriptEl.src = script.src;
      if (script.type) {
        scriptEl.type = script.type;
      }
      scriptEl.onload = () => resolve(undefined);
      scriptEl.onerror = (e) =>
        reject(new Error(`Failed to load external script: ${script.src}`));
      document.head.appendChild(scriptEl);
    });
  }

  if (script.type !== "module") {
    // For non-module external scripts, create a script tag
    // Check if this script is already loaded
    const existing = document.querySelector(`script[src="${script.src}"]`);
    if (existing) return Promise.resolve(undefined);

    return new Promise((resolve, reject) => {
      const scriptEl = document.createElement("script");
      scriptEl.src = script.src;
      if (script.type) {
        scriptEl.type = script.type;
      }
      scriptEl.onload = () => resolve(undefined);
      scriptEl.onerror = (e) =>
        reject(new Error(`Failed to load script: ${script.src}`));
      document.head.appendChild(scriptEl);
    });
  }

  try {
    // Fetch the module content
    const response = await fetch(script.src);
    if (!response.ok) {
      throw new Error(`Failed to fetch module: ${script.src}`);
    }
    const code = await response.text();

    // Rewrite relative imports to absolute URLs (based on script's location)
    const rewrittenCode = rewriteImports(code, script.src);

    // Transform imports to wrap values in reactive proxies
    const reactiveCode = transformImportsForReactivity(rewrittenCode);

    // Auto-export all top-level declarations
    const exportedCode = autoExportAllDeclarations(reactiveCode);

    // Inject framework helpers at the top of the module.
    // If the fetched module already declares (e.g. via import) any of the
    // helper names we plan to inject, skip injecting those names to avoid
    // "Identifier 'X' has already been declared" SyntaxErrors.
    const collisions = detectHelperCollisions(rewrittenCode);
    const helpersCode = generateHelperInjectionCode(
      componentId,
      componentUrl || script.src,
      collisions,
    );
    const finalCode = helpersCode + exportedCode;

    // Create blob URL and import
    const blob = new Blob([finalCode], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);

    try {
      const moduleExports = await (0, eval)(`import("${blobUrl}")`);
      return moduleExports;
    } finally {
      // Clean up blob URL
      URL.revokeObjectURL(blobUrl);
    }
  } catch (error) {
    console.error(
      `[LadrillosJS] Failed to load external module: ${script.src}`,
      error,
    );
    throw error;
  }
}

/**
 * Loads external scripts marked with the 'external' attribute.
 * These are third-party libraries (like highlight.js) that need to be loaded
 * BEFORE the component's inline scripts run, since they may depend on globals
 * provided by these libraries.
 *
 * @param externalScripts - External scripts from the component
 * @returns Promise that resolves when all external scripts are loaded
 */
export async function loadPlainExternalScripts(
  externalScripts: ExternalScriptElement[],
): Promise<void> {
  // Filter to only scripts with the 'external' attribute
  const plainExternalScripts = externalScripts.filter((s) => s.external);

  // Load them sequentially to maintain order (some may depend on others)
  for (const script of plainExternalScripts) {
    try {
      await executeExternalScript(script);
    } catch (error) {
      console.error(
        `[LadrillosJS] Failed to load external script: ${script.src}`,
        error,
      );
    }
  }
}

// Cache for fetched external CSS (shared across all component instances)
const externalCssCache = new Map<string, string>();

/**
 * Loads external stylesheets (<link rel="stylesheet">) into the component.
 * For Shadow DOM components, fetches CSS content and injects directly into shadow root.
 * For light DOM components, adds <link> to document head.
 *
 * @param externalStyles - External stylesheets from the component
 * @param root - The component's root (shadow root or element itself)
 * @param useShadowDOM - Whether the component uses Shadow DOM
 * @returns Promise that resolves when all stylesheets are loaded
 */
export async function loadExternalStyles(
  externalStyles: Array<{ href: string; rel: string }>,
  root?: ShadowRoot | HTMLElement,
  useShadowDOM?: boolean,
): Promise<void> {
  for (const style of externalStyles) {
    if (useShadowDOM && root) {
      // For Shadow DOM: fetch CSS and inject as <style> element
      // This ensures styles penetrate the shadow boundary
      try {
        let cssText = externalCssCache.get(style.href);

        if (!cssText) {
          const response = await fetch(style.href);
          if (!response.ok) {
            console.error(
              `[LadrillosJS] Failed to load stylesheet: ${style.href}`,
            );
            continue;
          }
          cssText = await response.text();
          externalCssCache.set(style.href, cssText);
        }

        const styleEl = document.createElement("style");
        styleEl.textContent = cssText;
        styleEl.setAttribute("data-external-href", style.href);
        // Insert at the beginning so component styles can override if needed
        root.insertBefore(styleEl, root.firstChild);
      } catch (error) {
        console.error(
          `[LadrillosJS] Failed to load stylesheet: ${style.href}`,
          error,
        );
      }
    } else {
      // For light DOM: add <link> to document head (if not already present)
      const existing = document.querySelector(`link[href="${style.href}"]`);
      if (existing) continue;

      await new Promise<void>((resolve) => {
        const link = document.createElement("link");
        link.rel = style.rel || "stylesheet";
        link.href = style.href;
        link.onload = () => resolve();
        link.onerror = () => {
          console.error(
            `[LadrillosJS] Failed to load stylesheet: ${style.href}`,
          );
          resolve(); // Don't block on CSS errors
        };
        document.head.appendChild(link);
      });
    }
  }
}

/**
 * Executes all module scripts for a component.
 * Handles both inline and external scripts (module and non-module).
 *
 * @param scripts - Inline scripts from the component
 * @param externalScripts - External scripts from the component
 * @param componentUrl - The component's URL for resolving imports
 * @param componentId - Unique ID for cleanup tracking
 * @returns Promise that resolves when all modules have executed
 */
export async function executeAllModuleScripts(
  scripts: ScriptElement[],
  externalScripts: ExternalScriptElement[],
  componentUrl: string,
  componentId?: string,
): Promise<Map<number, unknown>> {
  const results = new Map<number, unknown>();

  // Separate module scripts from regular scripts
  const moduleScripts = scripts.filter((s) => s.type === "module");
  const externalModuleScripts = externalScripts.filter(
    (s) => s.type === "module",
  );
  const externalRegularScripts = externalScripts.filter(
    (s) => s.type !== "module",
  );

  // Execute external NON-module scripts first (they may set up globals)
  for (const script of externalRegularScripts) {
    try {
      await executeExternalScript(script, componentId, componentUrl);
    } catch (error) {
      console.error(`[LadrillosJS] External script failed:`, script.src, error);
    }
  }

  // Execute external module scripts (they may export things inline scripts need)
  for (const script of externalModuleScripts) {
    try {
      await executeExternalScript(script, componentId, componentUrl);
    } catch (error) {
      console.error(
        `[LadrillosJS] External module script failed:`,
        script.src,
        error,
      );
    }
  }

  // Execute inline module scripts
  for (let i = 0; i < moduleScripts.length; i++) {
    try {
      const exports = await executeModuleScript(
        moduleScripts[i],
        componentUrl,
        componentId,
      );
      results.set(i, exports);
    } catch (error) {
      console.error(`[LadrillosJS] Module script ${i} failed:`, error);
    }
  }

  return results;
}

/**
 * Cleans up blob URLs created for a component.
 * Call this when a component is disconnected to prevent memory leaks.
 *
 * @param componentId - The component's unique ID
 */
export function cleanupModuleScripts(componentId: string): void {
  const urls = blobUrlRegistry.get(componentId);
  if (urls) {
    for (const url of urls) {
      URL.revokeObjectURL(url);
    }
    blobUrlRegistry.delete(componentId);
  }
}

/**
 * Extracts import specifiers from module code.
 * Useful for debugging or pre-fetching dependencies.
 *
 * @param code - The module script content
 * @returns Array of import specifiers found in the code
 */
export function extractImportSpecifiers(code: string): string[] {
  const specifiers: string[] = [];

  // Static imports
  let match;
  const staticRegex =
    /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  while ((match = staticRegex.exec(code)) !== null) {
    specifiers.push(match[1]);
  }

  // Dynamic imports
  const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicRegex.exec(code)) !== null) {
    specifiers.push(match[1]);
  }

  return specifiers;
}

// ============================================================================
// Reactive Module Execution
// ============================================================================

/**
 * Represents a parsed import statement
 */
interface ParsedImport {
  statement: string; // Full import statement
  specifier: string; // Module specifier (path)
  imports: ImportBinding[]; // What's being imported
  isDefault: boolean; // Is this a default import?
  isNamespace: boolean; // Is this import * as X?
  isSideEffect: boolean; // Is this just import "module"?
}

interface ImportBinding {
  imported: string; // Name in the source module
  local: string; // Name in the importing module
}

/**
 * Parses import statements from module code.
 * Returns structured info about each import.
 */
function parseImports(code: string): ParsedImport[] {
  const imports: ParsedImport[] = [];

  // Match various import forms
  const importRegex =
    /import\s+(?:(\{[^}]+\})|(\*\s+as\s+\w+)|(\w+)(?:\s*,\s*(\{[^}]+\}))?)?\s*(?:from\s+)?['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const [
      statement,
      namedImports,
      namespaceImport,
      defaultImport,
      additionalNamed,
      specifier,
    ] = match;

    const parsed: ParsedImport = {
      statement,
      specifier,
      imports: [],
      isDefault: false,
      isNamespace: false,
      isSideEffect: false,
    };

    // Side effect import: import "module"
    if (!namedImports && !namespaceImport && !defaultImport) {
      parsed.isSideEffect = true;
    }

    // Default import: import X from "module"
    if (defaultImport) {
      parsed.isDefault = true;
      parsed.imports.push({ imported: "default", local: defaultImport });
    }

    // Namespace import: import * as X from "module"
    if (namespaceImport) {
      parsed.isNamespace = true;
      const localName = namespaceImport.replace(/\*\s+as\s+/, "").trim();
      parsed.imports.push({ imported: "*", local: localName });
    }

    // Named imports: import { a, b as c } from "module"
    const namedPart = namedImports || additionalNamed;
    if (namedPart) {
      const inner = namedPart.slice(1, -1); // Remove { }
      const parts = inner
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      for (const part of parts) {
        const asMatch = part.match(/(\w+)\s+as\s+(\w+)/);
        if (asMatch) {
          parsed.imports.push({ imported: asMatch[1], local: asMatch[2] });
        } else {
          parsed.imports.push({ imported: part, local: part });
        }
      }
    }

    imports.push(parsed);
  }

  return imports;
}

/**
 * Fetches a module and returns its exports.
 * Uses dynamic import() for proper ES module loading.
 */
async function fetchModule(url: string): Promise<Record<string, unknown>> {
  // Check cache first
  if (moduleCache.has(url)) {
    return moduleCache.get(url)!;
  }

  const promise = (async () => {
    try {
      // Use dynamic import to load the module
      const module = await (0, eval)(`import("${url}")`);
      return module as Record<string, unknown>;
    } catch (error) {
      console.error(`[LadrillosJS] Failed to fetch module: ${url}`, error);
      throw error;
    }
  })();

  moduleCache.set(url, promise);
  return promise;
}

/**
 * Recursively wraps arrays in an object with reactive proxies.
 * This ensures imported arrays trigger reactivity updates when mutated.
 *
 * @param value - The value to potentially wrap
 * @param onMutate - Callback when any array is mutated
 * @returns The value with arrays wrapped in reactive proxies
 */
function wrapImportedValue(value: unknown, onMutate?: () => void): unknown {
  if (!onMutate) return value;

  if (Array.isArray(value)) {
    return createReactiveArray(value, onMutate);
  }

  // Don't deeply wrap objects - just arrays at the top level
  // This avoids issues with complex imported objects
  return value;
}

/**
 * Resolves all imports in a module script and returns the imported values.
 * If onMutate is provided, imported arrays will be wrapped in reactive proxies.
 *
 * @param code - The module script code containing imports
 * @param baseUrl - Base URL for resolving relative imports
 * @param onMutate - Optional callback to trigger when imported arrays are mutated
 */
async function resolveImports(
  code: string,
  baseUrl: string,
  onMutate?: () => void,
): Promise<Record<string, unknown>> {
  const imports = parseImports(code);
  const resolved: Record<string, unknown> = {};

  for (const imp of imports) {
    if (imp.isSideEffect) {
      // Just execute the side effect
      const url = isRelativePath(imp.specifier)
        ? new URL(imp.specifier, baseUrl).href
        : imp.specifier;
      await fetchModule(url);
      continue;
    }

    // Resolve the URL
    const url = isRelativePath(imp.specifier)
      ? new URL(imp.specifier, baseUrl).href
      : imp.specifier;

    try {
      const moduleExports = await fetchModule(url);

      for (const binding of imp.imports) {
        let importedValue: unknown;

        if (binding.imported === "*") {
          // Namespace import
          importedValue = moduleExports;
        } else if (binding.imported === "default") {
          // Default import
          importedValue = moduleExports.default;
        } else {
          // Named import
          importedValue = moduleExports[binding.imported];
        }

        // Wrap arrays in reactive proxies if onMutate is provided
        resolved[binding.local] = wrapImportedValue(importedValue, onMutate);
      }
    } catch (error) {
      console.warn(
        `[LadrillosJS] Could not resolve import "${imp.specifier}":`,
        error,
      );
    }
  }

  return resolved;
}

/**
 * Removes import statements from code, leaving just the executable code.
 */
function stripImports(code: string): string {
  // Remove all import statements
  return code
    .replace(
      /import\s+(?:(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*\{[^}]+\})?\s+from\s+)?['"][^'"]+['"]\s*;?/g,
      "",
    )
    .trim();
}

/**
 * Extracts ONLY top-level variable and function names from code.
 *
 * This is critical for reactive state - we must NOT extract variables
 * declared inside functions (like `const myCanvas = refs.get(...)`).
 *
 * The approach: Track brace depth and only extract declarations at depth 0.
 */
function extractDeclaredNames(code: string): {
  variables: string[];
  functions: string[];
} {
  const variables: string[] = [];
  const functions: string[] = [];

  // Remove string literals and comments to avoid false matches
  // Replace them with spaces to preserve positions
  const cleanedCode = code
    // Remove template literals (backticks)
    .replace(/`[^`]*`/g, (m) => " ".repeat(m.length))
    // Remove double-quoted strings
    .replace(/"(?:[^"\\]|\\.)*"/g, (m) => " ".repeat(m.length))
    // Remove single-quoted strings
    .replace(/'(?:[^'\\]|\\.)*'/g, (m) => " ".repeat(m.length))
    // Remove multi-line comments
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    // Remove single-line comments
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));

  // Track brace depth: only extract at depth 0 (top level)
  let braceDepth = 0;
  let i = 0;

  while (i < cleanedCode.length) {
    const char = cleanedCode[i];

    // Track brace depth
    if (char === "{") {
      braceDepth++;
      i++;
      continue;
    }
    if (char === "}") {
      braceDepth--;
      i++;
      continue;
    }

    // Only extract at top level (braceDepth === 0)
    if (braceDepth === 0) {
      // Check for function declarations: function name( or async function name(
      const funcMatch = cleanedCode
        .slice(i)
        .match(/^(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
      if (funcMatch) {
        functions.push(funcMatch[1]);
        i += funcMatch[0].length;
        continue;
      }

      // Check for variable declarations: let/const/var name =
      const varMatch = cleanedCode
        .slice(i)
        .match(/^(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/);
      if (varMatch) {
        variables.push(varMatch[1]);
        i += varMatch[0].length;
        continue;
      }
    }

    i++;
  }

  return { variables, functions };
}

/**
 * Executes a module script and extracts declared variables for reactive state.
 *
 * This is the KEY function for reactivity support in module scripts.
 * It:
 * 1. Resolves all imports (wrapping arrays in reactive proxies)
 * 2. Strips import statements from the code
 * 3. Transforms variable access to go through the reactive state object
 * 4. Executes the remaining code in a sandbox with imports available
 * 5. Functions read/write directly to the reactive state for full reactivity
 *
 * The transformation ensures that functions declared in module scripts
 * read/write from the reactive state, not from local closure variables.
 * This makes `let x = 0; function inc() { x++; }` work reactively.
 *
 * @param reactiveState - The component's reactive state object. Module script
 *                        functions will read/write directly to this object.
 * @param onStateChange - Optional callback when imported arrays are mutated.
 *                        This triggers directive updates (like $for loops).
 */
export async function executeModuleScriptWithReactivity(
  script: ScriptElement,
  componentUrl: string,
  componentId?: string,
  refs?: Map<string, HTMLElement>,
  reactiveState?: Record<string, unknown>,
  onStateChange?: () => void,
  hostElement?: HTMLElement,
): Promise<Record<string, unknown>> {
  if (script.type !== "module") {
    throw new Error(
      'executeModuleScriptWithReactivity only handles type="module" scripts',
    );
  }

  const code = script.content;

  // 1. Resolve all imports (wrap arrays in reactive proxies for automatic UI updates)
  const importedValues = await resolveImports(
    code,
    componentUrl,
    onStateChange,
  );

  // 2. Strip import statements from the code
  const executableCode = stripImports(code);

  // 3. Extract names of declared variables/functions
  const { variables, functions } = extractDeclaredNames(executableCode);

  // 4. Transform code so variable access goes through __state__ object
  //    This is the key to making module scripts reactive like regular scripts
  const transformedCode = transformToStateAccess(executableCode, variables);

  // 5. Build and execute the sandboxed function
  const importNames = Object.keys(importedValues);
  const importValues = Object.values(importedValues);

  // Return all functions (they have closure over __state__ which is the reactive state)
  const returnStatement =
    functions.length > 0 ? `return { ${functions.join(", ")} };` : `return {};`;

  // Wrap in an async IIFE to support top-level await in module scripts
  // This allows users to write: await ladrillosjs.registerComponents([...])
  // without needing to wrap it in an async function themselves
  const wrappedCode = `
    "use strict";
    return (async () => {
      ${transformedCode}
      ${returnStatement}
    })();
  `;

  try {
    // Include console, alert, etc. as safe globals
    const safeGlobals = [
      "console",
      "alert",
      "Math",
      "JSON",
      "Date",
      "Array",
      "Object",
      "String",
      "Number",
      "Boolean",
      "Promise",
      "setTimeout",
      "setInterval",
      "clearTimeout",
      "clearInterval",
    ];
    const safeGlobalValues = safeGlobals.map(
      (name) => (globalThis as any)[name],
    );

    // Inject $refs Map so functions can access element references
    // The $refs Map is populated later by scanDirectives, but the
    // reference is captured by functions defined in the module
    //
    // __state__ is the reactive state object - functions write directly to it
    // for full reactivity support
    const injectedVars = ["$refs", "__state__", "$host"];
    const injectedValues = [refs || new Map(), reactiveState || {}, hostElement];

    // Create framework helpers bound to component's URL for correct path resolution
    // This ensures registerComponent("./child.html") resolves relative to THIS component
    const helpers = createFrameworkHelpers(componentUrl);
    const frameworkHelperValues = [
      helpers.registerComponent,
      helpers.registerComponents,
      helpers.$use,
    ];

    // Create event bus helpers bound to component ID for automatic cleanup
    const eventBusHelpers = createEventBusHelpers(componentId || "anonymous");
    const eventBusHelperValues = [
      eventBusHelpers.$emit,
      eventBusHelpers.$listen,
    ];

    // Create a context-aware ladrillosjs object that resolves paths relative to this component
    // This allows users to use either ladrillosjs.registerComponents() or registerComponents()
    // We spread the global object FIRST, then override with context-aware versions
    const globalLadrillos = (globalThis as any).ladrillosjs || {};
    const contextAwareLadrillosjs = {
      ...globalLadrillos,
      // Override with context-aware versions that resolve paths relative to THIS component
      registerComponent: helpers.registerComponent,
      registerComponents: helpers.registerComponents,
    };

    // Add framework helpers (registerComponent, $use, $emit, $listen, etc.)
    // Deduplicate: if the user explicitly imported a name that collides with a
    // framework-injected name (e.g. `import { registerComponent } from "ladrillosjs"`),
    // the user's import wins and we skip the injected version to avoid
    // "Duplicate parameter name" errors when building the Function.
    //
    // BUT: For framework helpers specifically, the imported value resolves
    // relative paths against window.location, not the component URL. So we
    // override the user's imported value with the context-aware version,
    // making `import { registerComponent } from "ladrillosjs"` behave the
    // same as the auto-injected `registerComponent`.
    const helperOverrides: Record<string, unknown> = {
      registerComponent: helpers.registerComponent,
      registerComponents: helpers.registerComponents,
      $use: helpers.$use,
      $emit: eventBusHelpers.$emit,
      $listen: eventBusHelpers.$listen,
      ladrillosjs: contextAwareLadrillosjs,
    };

    const importNameSet = new Set(importNames);
    const allParamNames: string[] = [...importNames];
    const allParamValues: unknown[] = importNames.map((name, i) =>
      name in helperOverrides ? helperOverrides[name] : importValues[i],
    );

    const appendUnique = (names: readonly string[], values: readonly unknown[]) => {
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (importNameSet.has(name)) continue;
        importNameSet.add(name);
        allParamNames.push(name);
        allParamValues.push(values[i]);
      }
    };

    appendUnique(safeGlobals, safeGlobalValues);
    appendUnique(frameworkHelperNames, frameworkHelperValues);
    appendUnique(eventBusHelperNames, eventBusHelperValues);
    appendUnique(injectedVars, injectedValues);
    appendUnique(["ladrillosjs"], [contextAwareLadrillosjs]);

    const fn = new Function(...allParamNames, wrappedCode);

    // The function now returns a Promise due to the async IIFE wrapper
    const result = await fn(...allParamValues);

    // Return both the initial values (from __state__) and functions
    // The reactiveState object now contains all variables set by the module script
    return { ...(reactiveState || {}), ...(result || {}) };
  } catch (error) {
    console.error(`[LadrillosJS] Failed to execute module script:`, error);
    console.error("Original code:", executableCode);
    console.error("Transformed code:", transformedCode);
    console.error("Imports:", importedValues);
    throw error;
  }
}

/**
 * Transforms variable declarations and accesses to use a __state__ object.
 *
 * This transformation allows module script functions to read/write from
 * the reactive state instead of local closure variables.
 *
 * Transforms:
 *   let isLoggedIn = false;
 *   function login() { isLoggedIn = !isLoggedIn; }
 *
 * Into:
 *   __state__.isLoggedIn = false;
 *   function login() { __state__.isLoggedIn = !__state__.isLoggedIn; }
 *
 * This is similar to what Svelte's compiler does, but at runtime.
 */
function transformToStateAccess(code: string, variables: string[]): string {
  if (variables.length === 0) return code;

  // Step 1: Protect string literals by replacing them with placeholders
  const strings: string[] = [];
  let protected_code = code.replace(
    /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
    (match) => {
      strings.push(match);
      return `__STRING_PLACEHOLDER_${strings.length - 1}__`;
    },
  );

  // Step 2: Transform top-level variable declarations
  // `let x = value;` → `__state__.x = value;`
  for (const varName of variables) {
    const declRegex = new RegExp(
      `\\b(let|const|var)\\s+(${escapeRegex(varName)})\\s*=`,
      "g",
    );
    protected_code = protected_code.replace(
      declRegex,
      `__state__.${varName} =`,
    );
  }

  // Step 3: Replace all standalone variable references with __state__.varName
  // Do this iteratively to handle all occurrences
  for (const varName of variables) {
    // This regex matches the variable name that is:
    // - NOT preceded by a single dot (property access like foo.bar)
    //   but IS allowed after spread operator (...)
    // - NOT preceded by __state__. (already transformed)
    // - IS a word boundary on both sides
    // - NOT followed by : (object key) or ( (function declaration)
    //
    // The lookbehind (?<![^.]\\.) means: not preceded by a dot that itself
    // is not preceded by a dot. This allows ...varName but blocks .varName
    const pattern = new RegExp(
      `(?<![^.]\\.)(?<!__state__\\.)\\b${escapeRegex(varName)}\\b(?!\\s*[:(])`,
      "g",
    );

    protected_code = protected_code.replace(pattern, `__state__.${varName}`);
  }

  // Step 4: Restore string literals
  let transformed = protected_code;
  for (let i = 0; i < strings.length; i++) {
    transformed = transformed.replace(
      `__STRING_PLACEHOLDER_${i}__`,
      strings[i],
    );
  }

  return transformed;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Executes all module scripts with reactivity support.
 * Returns merged state from all module scripts.
 * @param refs - Optional refs Map that will be populated by scanDirectives later.
 *               Functions in module scripts can capture this reference.
 * @param reactiveState - The component's reactive state object. Module script
 *                        functions will read/write directly to this object.
 * @param onStateChange - Optional callback when imported arrays are mutated.
 *                        This triggers directive updates (like $for loops).
 */
export async function executeModuleScriptsWithReactivity(
  scripts: ScriptElement[],
  externalScripts: ExternalScriptElement[],
  componentUrl: string,
  componentId?: string,
  refs?: Map<string, HTMLElement>,
  reactiveState?: Record<string, unknown>,
  onStateChange?: () => void,
  hostElement?: HTMLElement,
): Promise<Record<string, unknown>> {
  const mergedState: Record<string, unknown> = {};

  // Filter to only module scripts (inline)
  const moduleScripts = scripts.filter((s) => s.type === "module");

  // Separate external scripts by type
  const externalModuleScripts = externalScripts.filter(
    (s) => s.type === "module",
  );
  const externalRegularScripts = externalScripts.filter(
    (s) => s.type !== "module",
  );

  // Execute external NON-module scripts first (they may set up globals needed by modules)
  for (const script of externalRegularScripts) {
    try {
      await executeExternalScript(script, componentId, componentUrl);
    } catch (error) {
      console.error(`[LadrillosJS] External script failed:`, script.src, error);
    }
  }

  // Execute external module scripts and merge their exports into state
  for (const script of externalModuleScripts) {
    try {
      const moduleExports = await executeExternalScript(
        script,
        componentId,
        componentUrl,
      );
      // Merge module exports into state (functions, variables, etc.)
      if (moduleExports && typeof moduleExports === "object") {
        for (const [key, value] of Object.entries(
          moduleExports as Record<string, unknown>,
        )) {
          // Skip default export key, merge named exports
          if (key !== "default") {
            mergedState[key] = value;
            // Also write to reactive state if provided
            if (reactiveState) {
              reactiveState[key] = value;
            }
          }
        }
      }
    } catch (error) {
      console.error(
        `[LadrillosJS] External module script failed:`,
        script.src,
        error,
      );
    }
  }

  // Execute inline module scripts and collect their state
  for (const script of moduleScripts) {
    try {
      const state = await executeModuleScriptWithReactivity(
        script,
        componentUrl,
        componentId,
        refs,
        reactiveState,
        onStateChange,
        hostElement,
      );
      Object.assign(mergedState, state);
    } catch (error) {
      console.error(`[LadrillosJS] Module script failed:`, error);
    }
  }

  return mergedState;
}
