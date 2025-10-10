import {
  BindingDescriptor,
  ConditionalDescriptor,
} from "../../types/LadrilloTypes";
import { getCachedFunction } from "../../cache/functionCache";

/**
 * Safely retrieves a nested value from an object using a path array.
 * Example: getValue({ user: { name: 'John' } }, ['user', 'name']) returns 'John'
 */
const getValue = (ctx: unknown, path: string[]): unknown => {
  return path.reduce<unknown>((acc: unknown, segment: string) => {
    // Stop traversal if we hit null/undefined or non-object
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, ctx);
};

/**
 * Safely sets a nested value in an object using a path array.
 * Example: setValue({ user: {} }, ['user', 'name'], 'John') sets user.name to 'John'
 * Creates intermediate objects if they don't exist.
 */
export const setValue = (ctx: any, path: string[], value: unknown): void => {
  if (path.length === 0) return;

  // Navigate to the parent object
  const lastKey = path[path.length - 1];
  const parentPath = path.slice(0, -1);

  let current = ctx;

  // Create intermediate objects if needed
  for (const segment of parentPath) {
    if (current[segment] === undefined || current[segment] === null) {
      current[segment] = {};
    }
    current = current[segment];
  }

  // Set the final value
  current[lastKey] = value;
};

/**
 * Updates all DOM bindings with values from the current state context.
 * Replaces {property.path} placeholders in text nodes and element attributes.
 * Always renders from the original template to support reactive updates.
 */
export const renderBindings = (
  bindings: BindingDescriptor[],
  context: unknown,
  component?: any
): void => {
  for (const binding of bindings) {
    // Start with the original template
    let result = binding.original;

    // Replace all placeholders in this node
    for (const { raw, path, isFunction } of binding.bindings) {
      let value: unknown;

      if (isFunction) {
        // Execute function calls like MyName("Peter")
        try {
          // Get the function from the component
          const funcName = path[0];
          const func = component?.[funcName];

          if (typeof func === "function") {
            // Use cached function to prevent memory leaks
            const evalFunc = getCachedFunction(raw);
            value = evalFunc(component);
          } else {
            value = undefined;
          }
        } catch (error) {
          console.error(`Error executing function binding {${raw}}:`, error);
          value = undefined;
        }
      } else {
        // Regular property access
        value = getValue(context, path);
      }

      if (value === undefined) continue;
      const replacement = String(value ?? "");

      // Replace this specific placeholder
      result = result.replace(`{${raw}}`, replacement);
    }

    // Apply the final result to the DOM
    if (binding.node.nodeType === Node.TEXT_NODE) {
      // Handle text node bindings (e.g., <p>{message}</p>)
      binding.node.textContent = result;
    } else {
      // Handle attribute bindings (e.g., <img src="{imageUrl}">)
      const element = binding.node as unknown as Element;
      if (binding.isAttribute && binding.attributeName) {
        element.setAttribute(binding.attributeName, result);
      }
    }
  }
};

/**
 * Evaluates a conditional expression in the context of the component.
 * Supports both simple boolean checks and complex expressions.
 * e.g. "isVisible", "{isVisible}", "count > 5", "{count} > 5"
 */
const evaluateCondition = (
  condition: string,
  context: unknown,
  component?: any
): boolean => {
  if (!condition) return true; // $else has no condition

  // Remove curly braces if present: {sending} -> sending
  let processedCondition = condition.trim();

  // Replace all {variable} with just variable
  processedCondition = processedCondition.replace(/\{([^}]+)\}/g, "$1");

  try {
    // Replace variable references in the condition with their values
    // This is a simple approach - for production, consider a proper expression parser
    const func = new Function(
      "context",
      "component",
      `
      with (context) {
        try {
          return Boolean(${processedCondition});
        } catch (e) {
          return false;
        }
      }
    `
    );

    return func(context, component);
  } catch (error) {
    console.error(`Error evaluating condition "${condition}":`, error);
    return false;
  }
};

/**
 * Updates conditional rendering based on current state.
 * Shows/hides elements based on their $if, $else-if, $else conditions.
 */
export const renderConditionals = (
  conditionalGroups: ConditionalDescriptor[][],
  context: unknown,
  component?: any
): void => {
  // Process each conditional group (if/else-if/else chain)
  for (const group of conditionalGroups) {
    let conditionMet = false;

    // Evaluate each condition in the group
    for (const descriptor of group) {
      const { element, condition, type, placeholder, originalParent } =
        descriptor;

      // Check if this condition should be rendered
      let shouldRender = false;

      if (type === "else") {
        // $else renders if no previous condition was met
        shouldRender = !conditionMet;
      } else if (!conditionMet) {
        // $if or $else-if: evaluate condition
        shouldRender = evaluateCondition(condition, context, component);
        if (shouldRender) conditionMet = true;
      }

      // Update DOM based on shouldRender
      const isInDOM = element.parentNode !== null;

      if (shouldRender && !isInDOM) {
        // Insert element after its placeholder
        placeholder.parentNode?.insertBefore(element, placeholder.nextSibling);
      } else if (!shouldRender && isInDOM) {
        // Remove element from DOM
        element.remove();
      }
    }
  }
};
