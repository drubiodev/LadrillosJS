import { BindingDescriptor, ScriptElement } from "../../types";
import { EVENT_ATTRIBUTES } from "../../utils/jsevents";
import { ALLOWED_GLOBALS, BLOCKED_GLOBALS, RESERVED_WORDS } from "../../utils/sandbox";

/**
 * Gets the actual HTMLElement from either a direct element or a ShadowRoot.
 */
const getHostElement = (host: HTMLElement | ShadowRoot): HTMLElement =>
  host instanceof ShadowRoot ? (host.host as HTMLElement) : host;

/**
 * Main entry point for processing component scripts.
 * 
 * 1. Extracts all variables and functions from <script> tags
 * 2. Makes them available as component context
 * 3. Binds inline event handlers (onclick, etc.) to work with that context
 * 4. Evaluates and applies template bindings like {name} or {greet()}
 */
export async function loadScripts(
  host: HTMLElement | ShadowRoot,
  scripts: ScriptElement[],
  bindings: BindingDescriptor[]
): Promise<Map<string, unknown>> {
  const componentHost = getHostElement(host);
  const context = new Map<string, unknown>();

  // Extract all declared variables and functions from component scripts
  for (const script of scripts) {
    const members = extractScriptMembers(script.content);
    for (const [key, value] of members) {
      context.set(key, value);
    }
  }

  // Store context on host element (useful for debugging)
  (componentHost as any).__ctx = Object.fromEntries(context);

  // Make onclick="handleClick()" work by binding to component scope
  transformInlineEventHandlers(host, context);

  // Replace {expression} bindings in the template with actual values
  applyBindings(bindings, context);

  return context;
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
  context: Map<string, unknown>
): void {
  const elements = Array.from(host.querySelectorAll('*'));

  for (const element of elements) {
    for (const attrName of EVENT_ATTRIBUTES) {
      const handlerCode = element.getAttribute(attrName);

      if (handlerCode) {
        // Remove attribute so the browser doesn't try to eval it globally
        element.removeAttribute(attrName);

        // onclick → click
        const eventName = attrName.slice(2);

        // Create a real event listener with component context
        const handler = createVanillaEventHandler(handlerCode, context);
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
 * Example: onclick="handleClick()" will call the component's handleClick function.
 */
function createVanillaEventHandler(
  code: string,
  context: Map<string, unknown>
): ((event: Event) => void) | null {
  try {
    const keys = Array.from(context.keys());
    const values = Array.from(context.values());

    // Include safe globals like alert, console, Math, JSON, etc.
    const allowed = getAllowedGlobalsWithValues();
    
    // Block dangerous globals like window, document, fetch, etc.
    const safeBlocked = getSafeBlockedGlobals();
    
    // Build the function parameters: event + blocked + allowed + component context
    const allKeys = ['event', ...safeBlocked, ...allowed.keys, ...keys];

    const fn = new Function(
      ...allKeys,
      `"use strict"; ${code}`
    );

    return (event: Event) => {
      try {
        const allValues = [
          event,
          ...safeBlocked.map(() => undefined), // Shadow dangerous globals
          ...allowed.values,                    // Inject safe globals
          ...values,                            // Inject component context
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

    if (allNames.length === 0) return members;

    // Wrap script to return an object containing all declared members
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
      ...allowed.values,                    // Inject safe globals
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
 */
function extractVariableNames(content: string): string[] {
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
  return BLOCKED_GLOBALS.filter(name => !RESERVED_WORDS.has(name));
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
  context: Map<string, unknown>
): unknown {
  try {
    const keys = Array.from(context.keys());
    const values = Array.from(context.values());

    const safeBlocked = getSafeBlockedGlobals();
    const allKeys = [...safeBlocked, ...keys];
    const allValues = [
      ...safeBlocked.map(() => undefined),
      ...values,
    ];

    const fn = new Function(...allKeys, `"use strict"; return ${expression};`);
    return fn(...allValues);
  } catch (e) {
    console.warn(`Failed to evaluate expression: ${expression}`, e);
    return `{${expression}}`; // Return original on error
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
  context: Map<string, unknown>
): void {
  for (const descriptor of bindings) {
    let result = descriptor.original;

    // Evaluate and replace each {expression} in the text
    for (const binding of descriptor.bindings) {
      const evaluated = evaluateExpression(binding.raw, context);
      const stringValue = String(evaluated ?? "");
      result = result.replace(`{${binding.raw}}`, stringValue);
    }

    if (descriptor.isAttribute && descriptor.attributeName) {
      // Update element attribute
      const element = (descriptor as any).element ?? descriptor.node.parentElement;
      if (element) {
        element.setAttribute(descriptor.attributeName, result);
      }
    } else {
      // Update text node content
      descriptor.node.textContent = result;
    }
  }
}