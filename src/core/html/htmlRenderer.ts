import { BindingDescriptor } from "../../types/LadrilloTypes";

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
 * Updates all DOM bindings with values from the current state context.
 * Replaces {property.path} placeholders in text nodes and element attributes.
 * Always renders from the original template to support reactive updates.
 */
export const renderBindings = (
  bindings: BindingDescriptor[],
  context: unknown
): void => {
  for (const binding of bindings) {
    // Resolve the value from state using dot notation (e.g., "user.name")
    const value = getValue(context, binding.path);
    if (value === undefined) continue;
    const replacement = String(value ?? "");

    // Handle text node bindings (e.g., <p>{message}</p>)
    if (binding.node.nodeType === Node.TEXT_NODE) {
      // Always replace from the original template to support multiple updates
      binding.node.textContent = binding.original.replace(
        `{${binding.raw}}`,
        replacement
      );
    } else {
      // Handle attribute bindings (e.g., <img src="{imageUrl}">)
      const element = binding.node as unknown as Element;
      if (binding.isAttribute && binding.attributeName) {
        // Always replace from the original attribute value
        const newValue = binding.original.replace(
          `{${binding.raw}}`,
          replacement
        );
        element.setAttribute(binding.attributeName, newValue);
      }
    }
  }
};
