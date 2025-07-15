import { ComponentElement, TextBinding } from "../types/LadrilloTypes";
import { REGEX_PATTERNS } from "../utils/regex";

export const scanBindings = (component: ComponentElement) => {
  // Ensure component has a valid root element before processing
  if (!component.root) return;

  // Perform a single DOM traversal to identify all binding types efficiently
  const walker = document.createTreeWalker(
    component.root,
    NodeFilter.SHOW_ALL,
    null
  );

  let node: Node | null;

  while ((node = walker.nextNode())) {
    // Process text nodes that contain data binding expressions
    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent;
      if (textContent && textContent.includes("{")) {
        processTextBindings(node, textContent, component);
      }
    }
  }
};

/**
 * Processes text nodes that contain data binding expressions.
 * Identifies {variableName} patterns and creates text bindings for reactive updates.
 *
 * @param node - The text node containing binding expressions
 * @param textContent - The text content to scan for bindings
 * @param component - The component that owns this text node
 */
const processTextBindings = (
  node: Node,
  textContent: string,
  component: ComponentElement
) => {
  // Create fresh regex instance to avoid state conflicts between calls
  const bindingRegex = new RegExp(REGEX_PATTERNS.binding.source, "g");
  let match: RegExpExecArray | null;

  // Find all data binding expressions in the text content
  while ((match = bindingRegex.exec(textContent)) !== null) {
    const variableKey = match[1].trim();

    // Create unique binding key to handle multiple bindings for same variable
    const bindingKey = `${variableKey}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    const binding: TextBinding = {
      node,
      template: textContent,
      key: variableKey, // Keep original variable name for state lookup
    };

    // Initialize bindings map if needed
    if (!component._bindings) component._bindings = new Map();

    // Register the binding with unique key for reactive updates
    component._bindings.set(bindingKey, binding);

    // Initialize the state property with empty string as default
    (component.state as any)[binding.key] = "";
  }
};
