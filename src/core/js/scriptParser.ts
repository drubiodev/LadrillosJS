import { BindingDescriptor, ScriptElement } from "../../types";
import { EVENT_ATTRIBUTES } from "../../utils/jsevents";
import {
  ALLOWED_GLOBALS,
  BLOCKED_GLOBALS,
  RESERVED_WORDS,
} from "../../utils/sandbox";
import { createReactiveState } from "./reactivity";

/**
 * Gets the actual HTMLElement from either a direct element or a ShadowRoot.
 */
const getHostElement = (host: HTMLElement | ShadowRoot): HTMLElement =>
  host instanceof ShadowRoot ? (host.host as HTMLElement) : host;

/**
 * Main entry point for processing component scripts.
 *
 * 1. Extracts all variables and functions from <script> tags
 * 2. Applies attribute overrides (attributes take precedence over defaults)
 * 3. Creates attribute-only state entries (for attributes without script vars)
 * 4. Creates a reactive state that auto-updates DOM on changes
 * 5. Binds inline event handlers (onclick, etc.) to work with reactive state
 * 6. Evaluates and applies template bindings like {name} or {greet()}
 *
 * @param host - The component's root element or shadow root
 * @param scripts - Script elements from the component
 * @param bindings - Template bindings to connect to state
 * @param attributeOverrides - Attributes from HTML that override script defaults
 * @param onStateChange - Optional callback when state changes (for directive updates)
 * @param deferBindings - If true, don't apply bindings immediately (for module script support)
 * @returns The reactive state object - changes trigger automatic DOM updates
 */
export async function loadScripts(
  host: HTMLElement | ShadowRoot,
  scripts: ScriptElement[],
  bindings: BindingDescriptor[],
  attributeOverrides: Record<string, unknown> = {},
  onStateChange?: () => void,
  deferBindings: boolean = false
): Promise<Record<string, unknown>> {
  const componentHost = getHostElement(host);
  const initialState: Record<string, unknown> = {};

  // Collect all script content for re-execution in event handlers
  const allScriptContent = scripts.map((s) => s.content).join("\n");

  // Extract all declared variables and functions from component scripts
  // These serve as DEFAULT values
  for (const script of scripts) {
    const members = extractScriptMembers(script.content);
    for (const [key, value] of members) {
      initialState[key] = value;
    }
  }

  // Apply attribute overrides - ATTRIBUTES WIN over script defaults
  // Also creates state entries for attributes that don't have script defaults
  // This allows: <my-component count="5"> without needing `let count` in script
  for (const [key, value] of Object.entries(attributeOverrides)) {
    initialState[key] = value;
  }

  // Create reactive state - changes automatically update the DOM!
  const reactiveState = createReactiveState(
    initialState,
    bindings,
    (binding, state) => updateSingleBinding(binding, state),
    onStateChange
  );

  // Store reactive state on host element (for debugging and event handlers)
  (componentHost as any).__state = reactiveState;
  // Store script content for event handlers that need to be set up later
  (componentHost as any).__scriptContent = allScriptContent;

  // Make onclick="handleClick()" work by binding to reactive state
  // Pass script content so functions can be re-created with current state
  // NOTE: We defer this until after module scripts are loaded
  if (!deferBindings) {
    transformInlineEventHandlers(
      host,
      reactiveState,
      allScriptContent,
      componentHost
    );

    // Apply initial bindings with current state values
    applyBindings(bindings, reactiveState);
  }

  return reactiveState;
}

/**
 * Apply bindings after all state is ready (including module scripts).
 * This should be called after module scripts have been executed.
 */
export function applyBindingsDeferred(
  host: HTMLElement | ShadowRoot,
  bindings: BindingDescriptor[],
  state: Record<string, unknown>
): void {
  const componentHost = getHostElement(host);
  const allScriptContent = (componentHost as any).__scriptContent || "";

  // Set up event handlers now that all state is available
  transformInlineEventHandlers(host, state, allScriptContent, componentHost);

  // Apply bindings with complete state
  applyBindings(bindings, state);
}

// ============================================================================
// Event Handler Processing
// ============================================================================

/**
 * Finds all inline event handlers (onclick, oninput, etc.) and replaces them
 * with proper event listeners that have access to the component's scope.
 *
 * This is what makes vanilla HTML syntax work:
 *   <button onclick="handleClick()">  →  just works!
 */
function transformInlineEventHandlers(
  host: HTMLElement | ShadowRoot,
  state: Record<string, unknown>,
  scriptContent: string,
  componentHost: HTMLElement
): void {
  const elements = Array.from(host.querySelectorAll("*"));

  for (const element of elements) {
    for (const attrName of EVENT_ATTRIBUTES) {
      const handlerCode = element.getAttribute(attrName);

      if (handlerCode) {
        // Remove attribute so the browser doesn't try to eval it globally
        element.removeAttribute(attrName);

        // onclick → click
        const eventName = attrName.slice(2);

        // Create a real event listener with component context
        const handler = createVanillaEventHandler(
          handlerCode,
          state,
          scriptContent,
          componentHost
        );
        if (handler) {
          element.addEventListener(eventName, handler);
        }
      }
    }
  }
}

/**
 * Creates an event handler function that executes the original handler code
 * with access to component variables, functions, and safe globals like alert().
 *
 * The handler has access to the REACTIVE state, so assignments like:
 *   onclick="count++"
 * will automatically update the DOM.
 *
 * Functions are RE-CREATED each time with current state values, so:
 *   onclick="handleClick()" will see the latest `name` value, not the original.
 */
function createVanillaEventHandler(
  code: string,
  state: Record<string, unknown>,
  scriptContent: string,
  componentHost?: HTMLElement
): ((event: Event) => void) | null {
  try {
    // Include safe globals like alert, console, Math, JSON, etc.
    const allowed = getAllowedGlobalsWithValues();

    // Block dangerous globals like window, document, fetch, etc.
    const safeBlocked = getSafeBlockedGlobals();

    // Build the function parameters: event + blocked + allowed + "state" reference + "refs"
    const allKeys = ["event", "state", "refs", ...safeBlocked, ...allowed.keys];

    // Get ALL state keys (includes both script variables AND attribute values)
    const allStateKeys = Object.keys(state);

    // Separate functions from variables in state
    const funcNames = allStateKeys.filter(
      (key) => typeof state[key] === "function"
    );
    const varNames = allStateKeys.filter(
      (key) => typeof state[key] !== "function"
    );

    // Check if we have module script functions (reactive functions that manage state directly)
    // Module script functions use __state__ which is the same as state, so they
    // modify state directly. We should NOT sync local copies back or we'll overwrite!
    const hasModuleScriptFunctions = funcNames.length > 0;

    // For module scripts: use const (read-only access, functions manage state)
    // For regular scripts: use let (local copies that get synced back)
    const destructureVars = hasModuleScriptFunctions
      ? varNames.length > 0
        ? `const { ${varNames.join(", ")} } = state;`
        : ""
      : varNames.length > 0
      ? `let { ${varNames.join(", ")} } = state;`
      : "";

    // Destructure functions from state (includes module script functions)
    // This makes functions like drawOnCanvas() available in event handlers
    const destructureFuncs =
      funcNames.length > 0 ? `const { ${funcNames.join(", ")} } = state;` : "";

    // Extract function definitions from script content to re-create them
    // with current variable values (not original closure values).
    // BUT: Skip functions that already exist in state - those are reactive
    // functions from module scripts that should NOT be shadowed!
    const funcDefs = extractFunctionDefinitions(scriptContent, funcNames);

    // Only sync back for regular scripts (no module functions)
    // Module script functions modify state directly via __state__, so syncing
    // local copies back would OVERWRITE their changes!
    const syncBack = hasModuleScriptFunctions
      ? ""
      : varNames.map((key) => `state.${key} = ${key};`).join(" ");

    const fn = new Function(
      ...allKeys,
      `"use strict"; ${destructureVars} ${destructureFuncs} ${funcDefs} ${code}; ${syncBack}`
    );

    return (event: Event) => {
      try {
        // Get refs from component host dynamically (they're set after script load)
        const refs = componentHost
          ? (componentHost as any).__refs || new Map()
          : new Map();

        const allValues = [
          event,
          state, // Pass reactive state
          refs, // Pass refs Map
          ...safeBlocked.map(() => undefined), // Shadow dangerous globals
          ...allowed.values, // Inject safe globals
        ];
        fn(...allValues);
      } catch (e) {
        console.error(`Error in event handler: ${code}`, e);
      }
    };
  } catch (e) {
    console.warn(`Failed to create event handler: ${code}`, e);
    return null;
  }
}

/**
 * Extracts function definitions from script content.
 * These will be re-created in the event handler context with current state values.
 *
 * @param content - The script content to extract functions from
 * @param skipFunctions - Function names to skip (already in state as reactive functions)
 */
function extractFunctionDefinitions(
  content: string,
  skipFunctions: string[] = []
): string {
  // Match both regular and async function declarations
  const funcRegex =
    /(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/g;
  const functions: string[] = [];
  let match;

  while ((match = funcRegex.exec(content)) !== null) {
    const funcName = match[1];

    // Skip functions that already exist in state (reactive module script functions)
    if (skipFunctions.includes(funcName)) {
      continue;
    }

    // Find the matching closing brace
    const startIndex = match.index;
    let braceCount = 0;
    let endIndex = startIndex;
    let inString = false;
    let stringChar = "";

    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : "";

      // Handle string detection (skip braces inside strings)
      if ((char === '"' || char === "'" || char === "`") && prevChar !== "\\") {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      if (!inString) {
        if (char === "{") braceCount++;
        if (char === "}") braceCount--;

        if (braceCount === 0 && char === "}") {
          endIndex = i + 1;
          break;
        }
      }
    }

    functions.push(content.slice(startIndex, endIndex));
  }

  return functions.join("\n");
}

// ============================================================================
// Script Parsing & Variable Extraction
// ============================================================================

/**
 * Executes script content in a sandboxed environment and extracts
 * all declared variables and functions.
 *
 * Example script:
 *   let name = 'LadrillosJS';
 *   function greet() { return `Hello ${name}`; }
 *
 * Returns: Map { 'name' => 'LadrillosJS', 'greet' => [Function] }
 */
function extractScriptMembers(content: string): Map<string, unknown> {
  const members = new Map<string, unknown>();

  try {
    const variableNames = extractVariableNames(content);
    const functionNames = extractFunctionNames(content);
    const allNames = [...variableNames, ...functionNames];

    // Always execute the script content (for side effects like console.log)
    // Only return members if there are any to extract
    const wrappedScript = `
      "use strict";
      ${content}
      return { ${allNames.join(", ")} };
    `;

    // Set up the sandboxed execution environment
    const allowed = getAllowedGlobalsWithValues();
    const safeBlocked = getSafeBlockedGlobals();

    const allKeys = [...safeBlocked, ...allowed.keys];
    const allValues = [
      ...safeBlocked.map(() => undefined), // Shadow dangerous globals
      ...allowed.values, // Inject safe globals
    ];

    const fn = new Function(...allKeys, wrappedScript);
    const result = fn(...allValues);

    for (const [key, value] of Object.entries(result)) {
      members.set(key, value);
    }
  } catch (e) {
    console.error("Error extracting script members:", e);
  }

  return members;
}

/**
 * Finds variable declarations: let x = ..., const y = ..., var z = ...
 * Exported so webcomponent.ts can use it for observedAttributes.
 */
export function extractVariableNames(content: string): string[] {
  const names: string[] = [];
  const regex = /(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    names.push(match[1]);
  }

  return names;
}

/**
 * Finds function declarations: function foo() {}, async function bar() {}
 */
function extractFunctionNames(content: string): string[] {
  const names: string[] = [];
  const regex = /(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    names.push(match[1]);
  }

  return names;
}

// ============================================================================
// Security & Sandboxing Helpers
// ============================================================================

/**
 * Returns blocked globals, excluding JS reserved words that can't be
 * used as function parameter names (like 'with', 'class', etc.)
 */
function getSafeBlockedGlobals(): readonly string[] {
  return BLOCKED_GLOBALS.filter((name) => !RESERVED_WORDS.has(name));
}

/**
 * Gets safe globals (alert, console, Math, JSON, etc.) with their actual values.
 * These are passed into the sandbox so component code feels like vanilla JS.
 */
function getAllowedGlobalsWithValues(): { keys: string[]; values: unknown[] } {
  const keys: string[] = [];
  const values: unknown[] = [];

  for (const name of ALLOWED_GLOBALS) {
    if (name in globalThis) {
      keys.push(name);
      values.push((globalThis as any)[name]);
    }
  }

  return { keys, values };
}

// ============================================================================
// Template Binding Evaluation
// ============================================================================

/**
 * Evaluates a binding expression like {name} or {name.toUpperCase()}
 * in the component's context.
 */
function evaluateExpression(
  expression: string,
  state: Record<string, unknown>
): unknown {
  try {
    const keys = Object.keys(state);
    const values = Object.values(state);

    const safeBlocked = getSafeBlockedGlobals();
    const allKeys = [...safeBlocked, ...keys];
    const allValues = [...safeBlocked.map(() => undefined), ...values];

    const fn = new Function(...allKeys, `"use strict"; return ${expression};`);
    return fn(...allValues);
  } catch (e) {
    console.warn(`Failed to evaluate expression: ${expression}`, e);
    return `{${expression}}`; // Return original on error
  }
}

/**
 * Updates a single binding with new state values.
 * Called by the reactive system when a dependency changes.
 */
function updateSingleBinding(
  descriptor: BindingDescriptor,
  state: Record<string, unknown>
): void {
  let result = descriptor.original;

  // Evaluate and replace each {expression} in the text
  for (const binding of descriptor.bindings) {
    const evaluated = evaluateExpression(binding.raw, state);
    const stringValue = String(evaluated ?? "");
    result = result.replace(`{${binding.raw}}`, stringValue);
  }

  if (descriptor.isAttribute && descriptor.attributeName) {
    // Update element attribute
    const element =
      (descriptor as any).element ?? descriptor.node.parentElement;
    if (element) {
      element.setAttribute(descriptor.attributeName, result);
    }
  } else {
    // Update text node content
    descriptor.node.textContent = result;
  }
}

/**
 * Replaces all {expression} bindings in the template with their evaluated values.
 *
 * Handles both:
 *   - Text nodes: <h1>Hello {name}!</h1>
 *   - Attributes: <img src="{imageUrl}" alt="{name} logo">
 */
function applyBindings(
  bindings: BindingDescriptor[],
  state: Record<string, unknown>
): void {
  for (const descriptor of bindings) {
    updateSingleBinding(descriptor, state);
  }
}

// ============================================================================
// Expression Evaluator Export
// ============================================================================

/**
 * Creates and returns an expression evaluator function for use by directives.
 * This allows directives to evaluate expressions like "item.name" or "count > 5"
 * in the context of the component's state.
 */
export function createExpressionEvaluator(): (
  expr: string,
  context: Record<string, unknown>
) => unknown {
  return evaluateExpression;
}
