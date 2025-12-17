import { ScriptElement, ExternalScriptElement } from "../../types";

/**
 * Executes module scripts at runtime with REACTIVITY support.
 *
 * Key features:
 * 1. Rewrites relative imports to absolute URLs
 * 2. Fetches and resolves ES module imports
 * 3. Extracts declared variables for reactive state integration
 * 4. Supports both side-effect execution AND variable extraction
 *
 * This allows <script type="module"> in components to:
 * - Import from other files
 * - Declare reactive variables (let name = "value")
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
        `For production without a bundler, use .js files.`
    );
  }

  // Warn about bare specifiers
  if (bareSpecifiers.length > 0) {
    console.warn(
      `[LadrillosJS] Bare import specifiers found: ${bareSpecifiers.join(
        ", "
      )}. ` +
        `These require an import map, bundler, or CDN URL to work at runtime.`
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
  componentId?: string
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
  } catch (error) {
    console.error(`[LadrillosJS] Failed to execute module script:`, error);
    console.error("Component URL:", componentUrl);
    console.error("Original code:", script.content);
    throw error;
  }
}

/**
 * Executes an external module script.
 * For external scripts, we don't need to rewrite imports - the browser handles it.
 *
 * @param script - The external script element
 * @returns Promise that resolves when the module has loaded
 */
export async function executeExternalScript(
  script: ExternalScriptElement
): Promise<unknown> {
  if (script.type !== "module") {
    // For non-module external scripts, create a script tag
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
    // For module scripts, use dynamic import
    const moduleExports = await (0, eval)(`import("${script.src}")`);
    return moduleExports;
  } catch (error) {
    console.error(
      `[LadrillosJS] Failed to load external module: ${script.src}`,
      error
    );
    throw error;
  }
}

/**
 * Executes all module scripts for a component.
 * Handles both inline and external module scripts.
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
  componentId?: string
): Promise<Map<number, unknown>> {
  const results = new Map<number, unknown>();

  // Separate module scripts from regular scripts
  const moduleScripts = scripts.filter((s) => s.type === "module");
  const externalModuleScripts = externalScripts.filter(
    (s) => s.type === "module"
  );

  // Execute external module scripts first (they may export things inline scripts need)
  for (const script of externalModuleScripts) {
    try {
      await executeExternalScript(script);
    } catch (error) {
      console.error(`[LadrillosJS] External script failed:`, script.src, error);
    }
  }

  // Execute inline module scripts
  for (let i = 0; i < moduleScripts.length; i++) {
    try {
      const exports = await executeModuleScript(
        moduleScripts[i],
        componentUrl,
        componentId
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
 * Resolves all imports in a module script and returns the imported values.
 */
async function resolveImports(
  code: string,
  baseUrl: string
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
        if (binding.imported === "*") {
          // Namespace import
          resolved[binding.local] = moduleExports;
        } else if (binding.imported === "default") {
          // Default import
          resolved[binding.local] = moduleExports.default;
        } else {
          // Named import
          resolved[binding.local] = moduleExports[binding.imported];
        }
      }
    } catch (error) {
      console.warn(
        `[LadrillosJS] Could not resolve import "${imp.specifier}":`,
        error
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
      ""
    )
    .trim();
}

/**
 * Extracts variable and function names from code (for reactive state).
 */
function extractDeclaredNames(code: string): {
  variables: string[];
  functions: string[];
} {
  const variables: string[] = [];
  const functions: string[] = [];

  // Match variable declarations
  const varRegex = /(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;
  let match;
  while ((match = varRegex.exec(code)) !== null) {
    variables.push(match[1]);
  }

  // Match function declarations
  const funcRegex = /(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  while ((match = funcRegex.exec(code)) !== null) {
    functions.push(match[1]);
  }

  return { variables, functions };
}

/**
 * Executes a module script and extracts declared variables for reactive state.
 *
 * This is the KEY function for reactivity support in module scripts.
 * It:
 * 1. Resolves all imports
 * 2. Strips import statements from the code
 * 3. Executes the remaining code in a sandbox with imports available
 * 4. Returns all declared variables and functions
 */
export async function executeModuleScriptWithReactivity(
  script: ScriptElement,
  componentUrl: string
): Promise<Record<string, unknown>> {
  if (script.type !== "module") {
    throw new Error(
      'executeModuleScriptWithReactivity only handles type="module" scripts'
    );
  }

  const code = script.content;

  // 1. Resolve all imports
  const importedValues = await resolveImports(code, componentUrl);

  // 2. Strip import statements from the code
  const executableCode = stripImports(code);

  // 3. Extract names of declared variables/functions
  const { variables, functions } = extractDeclaredNames(executableCode);
  const allNames = [...variables, ...functions];

  // 4. Build and execute the sandboxed function
  const importNames = Object.keys(importedValues);
  const importValues = Object.values(importedValues);

  // Create the sandbox function
  // It receives imports as parameters and returns declared variables
  const returnStatement =
    allNames.length > 0 ? `return { ${allNames.join(", ")} };` : "return {};";

  const wrappedCode = `
    "use strict";
    ${executableCode}
    ${returnStatement}
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
      (name) => (globalThis as any)[name]
    );

    const fn = new Function(...importNames, ...safeGlobals, wrappedCode);

    const result = fn(...importValues, ...safeGlobalValues);

    return result || {};
  } catch (error) {
    console.error(`[LadrillosJS] Failed to execute module script:`, error);
    console.error("Code:", executableCode);
    console.error("Imports:", importedValues);
    throw error;
  }
}

/**
 * Executes all module scripts with reactivity support.
 * Returns merged state from all module scripts.
 */
export async function executeModuleScriptsWithReactivity(
  scripts: ScriptElement[],
  externalScripts: ExternalScriptElement[],
  componentUrl: string,
  componentId?: string
): Promise<Record<string, unknown>> {
  const mergedState: Record<string, unknown> = {};

  // Filter to only module scripts
  const moduleScripts = scripts.filter((s) => s.type === "module");
  const externalModuleScripts = externalScripts.filter(
    (s) => s.type === "module"
  );

  // Execute external module scripts first (for side effects)
  for (const script of externalModuleScripts) {
    try {
      await executeExternalScript(script);
    } catch (error) {
      console.error(`[LadrillosJS] External script failed:`, script.src, error);
    }
  }

  // Execute inline module scripts and collect their state
  for (const script of moduleScripts) {
    try {
      const state = await executeModuleScriptWithReactivity(
        script,
        componentUrl
      );
      Object.assign(mergedState, state);
    } catch (error) {
      console.error(`[LadrillosJS] Module script failed:`, error);
    }
  }

  return mergedState;
}
