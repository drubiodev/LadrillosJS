import { BindingDescriptor } from "../../types/LadrilloTypes";
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
