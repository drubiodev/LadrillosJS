import { ScriptElement, ExternalScriptElement } from "../../types";
import {
  frameworkHelperNames,
  createFrameworkHelpers,
} from "../helpers/frameworkHelpers";

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
        .trim()
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
 * Executes an external module script.
 * For external scripts, we fetch the content, auto-export all declarations,
 * and execute it via blob URL
 *
 * @param script - The external script element
 * @returns Promise that resolves with the module exports
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
    // Fetch the module content
    const response = await fetch(script.src);
    if (!response.ok) {
      throw new Error(`Failed to fetch module: ${script.src}`);
    }
    const code = await response.text();

    // Rewrite relative imports to absolute URLs (based on script's location)
    const rewrittenCode = rewriteImports(code, script.src);

    // Auto-export all top-level declarations
    const exportedCode = autoExportAllDeclarations(rewrittenCode);

    // Create blob URL and import
    const blob = new Blob([exportedCode], { type: "text/javascript" });
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
      error
    );
    throw error;
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
  componentId?: string
): Promise<Map<number, unknown>> {
  const results = new Map<number, unknown>();

  // Separate module scripts from regular scripts
  const moduleScripts = scripts.filter((s) => s.type === "module");
  const externalModuleScripts = externalScripts.filter(
    (s) => s.type === "module"
  );
  const externalRegularScripts = externalScripts.filter(
    (s) => s.type !== "module"
  );

  // Execute external NON-module scripts first (they may set up globals)
  for (const script of externalRegularScripts) {
    try {
      await executeExternalScript(script);
    } catch (error) {
      console.error(`[LadrillosJS] External script failed:`, script.src, error);
    }
  }

  // Execute external module scripts (they may export things inline scripts need)
  for (const script of externalModuleScripts) {
    try {
      await executeExternalScript(script);
    } catch (error) {
      console.error(
        `[LadrillosJS] External module script failed:`,
        script.src,
        error
      );
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
 * 1. Resolves all imports
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
 */
export async function executeModuleScriptWithReactivity(
  script: ScriptElement,
  componentUrl: string,
  refs?: Map<string, HTMLElement>,
  reactiveState?: Record<string, unknown>
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

  // 4. Transform code so variable access goes through __state__ object
  //    This is the key to making module scripts reactive like regular scripts
  const transformedCode = transformToStateAccess(executableCode, variables);

  // 5. Build and execute the sandboxed function
  const importNames = Object.keys(importedValues);
  const importValues = Object.values(importedValues);

  // Return all functions (they have closure over __state__ which is the reactive state)
  const returnStatement =
    functions.length > 0 ? `return { ${functions.join(", ")} };` : `return {};`;

  const wrappedCode = `
    "use strict";
    ${transformedCode}
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

    // Inject refs Map so functions can access element references
    // The refs Map is populated later by scanDirectives, but the
    // reference is captured by functions defined in the module
    //
    // __state__ is the reactive state object - functions write directly to it
    // for full reactivity support
    const injectedVars = ["refs", "__state__"];
    const injectedValues = [refs || new Map(), reactiveState || {}];

    // Create framework helpers bound to component's URL for correct path resolution
    // This ensures $registerComponent("./child.html") resolves relative to THIS component
    const helpers = createFrameworkHelpers(componentUrl);
    const frameworkHelperValues = [helpers.$registerComponent, helpers.$use];

    // Add framework helpers ($registerComponent, $use, etc.)
    const allParamNames = [
      ...importNames,
      ...safeGlobals,
      ...frameworkHelperNames,
      ...injectedVars,
    ];
    const allParamValues = [
      ...importValues,
      ...safeGlobalValues,
      ...frameworkHelperValues,
      ...injectedValues,
    ];

    const fn = new Function(...allParamNames, wrappedCode);

    const result = fn(...allParamValues);

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

  let transformed = code;

  // Step 1: Transform top-level variable declarations
  // `let x = value;` → `__state__.x = value;`
  for (const varName of variables) {
    const declRegex = new RegExp(
      `\\b(let|const|var)\\s+(${escapeRegex(varName)})\\s*=`,
      "g"
    );
    transformed = transformed.replace(declRegex, `__state__.${varName} =`);
  }

  // Step 2: Replace all standalone variable references with __state__.varName
  // Do this iteratively to handle all occurrences
  for (const varName of variables) {
    // This regex matches the variable name that is:
    // - NOT preceded by a dot (so foo.bar won't match bar)
    // - NOT preceded by __state__. (already transformed)
    // - IS a word boundary on both sides
    // - NOT followed by : (object key) or ( (function declaration)

    // We'll use a simpler approach: split by the pattern and rejoin
    const pattern = new RegExp(
      `(?<!\\.)(?<!__state__\\.)\\b${escapeRegex(varName)}\\b(?!\\s*[:(])`,
      "g"
    );

    transformed = transformed.replace(pattern, `__state__.${varName}`);
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
 */
export async function executeModuleScriptsWithReactivity(
  scripts: ScriptElement[],
  externalScripts: ExternalScriptElement[],
  componentUrl: string,
  componentId?: string,
  refs?: Map<string, HTMLElement>,
  reactiveState?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const mergedState: Record<string, unknown> = {};

  // Filter to only module scripts (inline)
  const moduleScripts = scripts.filter((s) => s.type === "module");

  // Separate external scripts by type
  const externalModuleScripts = externalScripts.filter(
    (s) => s.type === "module"
  );
  const externalRegularScripts = externalScripts.filter(
    (s) => s.type !== "module"
  );

  // Execute external NON-module scripts first (they may set up globals needed by modules)
  for (const script of externalRegularScripts) {
    try {
      await executeExternalScript(script);
    } catch (error) {
      console.error(`[LadrillosJS] External script failed:`, script.src, error);
    }
  }

  // Execute external module scripts and merge their exports into state
  for (const script of externalModuleScripts) {
    try {
      const moduleExports = await executeExternalScript(script);
      // Merge module exports into state (functions, variables, etc.)
      if (moduleExports && typeof moduleExports === "object") {
        for (const [key, value] of Object.entries(
          moduleExports as Record<string, unknown>
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
        error
      );
    }
  }

  // Execute inline module scripts and collect their state
  for (const script of moduleScripts) {
    try {
      const state = await executeModuleScriptWithReactivity(
        script,
        componentUrl,
        refs,
        reactiveState
      );
      Object.assign(mergedState, state);
    } catch (error) {
      console.error(`[LadrillosJS] Module script failed:`, error);
    }
  }

  return mergedState;
}
