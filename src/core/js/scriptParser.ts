import { BindingDescriptor, ScriptElement } from "../../types";
import { BLOCKED_GLOBALS, RESERVED_WORDS } from "../../utils/sandbox";

const getHostElement = (host: HTMLElement | ShadowRoot): HTMLElement =>
  host instanceof ShadowRoot ? (host.host as HTMLElement) : host;

export async function loadScripts(
  host: HTMLElement | ShadowRoot,
  scripts: ScriptElement[],
  bindings: BindingDescriptor[]
): Promise<Map<string, unknown>> {
  const componentHost = getHostElement(host);
  // Collect all variables and functions from all scripts into one context
  const context = new Map<string, unknown>();

  for (const script of scripts) {
    const members = extractScriptMembers(script.content);
    for (const [key, value] of members) {
      context.set(key, value);
    }
  }

  applyBindings(bindings, context);

  return context;
}

/**
 * Filter out reserved words that can't be used as parameter names
 */
function getSafeBlockedGlobals(): readonly string[] {
  return BLOCKED_GLOBALS.filter(name => !RESERVED_WORDS.has(name));
}

/**
 * Extract variables AND functions from script content
 * Uses sandboxed execution with blocked globals
 */
function extractScriptMembers(content: string): Map<string, unknown> {
  const members = new Map<string, unknown>();

  try {
    const variableNames = extractVariableNames(content);
    const functionNames = extractFunctionNames(content);
    const allNames = [...variableNames, ...functionNames];

    if (allNames.length === 0) return members;

    // Wrap script to return an object with all declared members
    const wrappedScript = `
      "use strict";
      ${content}
      return { ${allNames.join(", ")} };
    `;

    // Create sandboxed function with blocked globals (excluding reserved words)
    const safeBlocked = getSafeBlockedGlobals();
    const allKeys = [...safeBlocked];
    const allValues = safeBlocked.map(() => undefined);

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
 * Extract variable names from script content using regex
 */
function extractVariableNames(content: string): string[] {
  const names: string[] = [];
  // Match let, const, var declarations
  const regex = /(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    names.push(match[1]);
  }

  return names;
}

/**
 * Extract function names from script content using regex
 * Handles: function foo() {}, async function bar() {}
 */
function extractFunctionNames(content: string): string[] {
  const names: string[] = [];
  // Match function declarations (including async)
  const regex = /(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    names.push(match[1]);
  }

  return names;
}

/**
 * Safely evaluate a binding expression against the context
 * Blocks access to dangerous globals while allowing component-defined members
 */
function evaluateExpression(
  expression: string,
  context: Map<string, unknown>
): unknown {
  try {
    const keys = Array.from(context.keys());
    const values = Array.from(context.values());

    // Shadow blocked globals with undefined, then add context
    const safeBlocked = getSafeBlockedGlobals();
    const allKeys = [...safeBlocked, ...keys];
    const allValues = [
      ...safeBlocked.map(() => undefined),
      ...values,
    ];

    // Use strict mode for additional safety (blocks 'with', 'eval' as statement, etc.)
    const fn = new Function(...allKeys, `"use strict"; return ${expression};`);
    return fn(...allValues);
  } catch (e) {
    console.warn(`Failed to evaluate expression: ${expression}`, e);
    return `{${expression}}`;
  }
}

/**
 * Apply all bindings by evaluating expressions and updating DOM
 */
function applyBindings(
  bindings: BindingDescriptor[],
  context: Map<string, unknown>
): void {
  for (const descriptor of bindings) {
    let result = descriptor.original;

    // Replace each binding in the original text
    for (const binding of descriptor.bindings) {
      const evaluated = evaluateExpression(binding.raw, context);
      const stringValue = String(evaluated ?? "");

      // Replace {expression} with the evaluated value
      result = result.replace(`{${binding.raw}}`, stringValue);
    }

    if (descriptor.isAttribute && descriptor.attributeName) {
      // Update attribute - use element reference if available
      const element =
        (descriptor as any).element ?? descriptor.node.parentElement;
      if (element) {
        element.setAttribute(descriptor.attributeName, result);
      }
    } else {
      // Update text node
      descriptor.node.textContent = result;
    }
  }
}