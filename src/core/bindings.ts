import {
  AttributeBinding,
  ComponentElement,
  EventBinding,
  TextBinding,
} from "../types/LadrilloTypes";
import { REGEX_PATTERNS } from "../utils/regex";
import { logger } from "../utils/logger";

export const scanBindings = (component: ComponentElement) => {
  // Ensure root exists and is valid
  if (!component.root) return;

  // Initialize binding arrays if they don't exist
  if (!component._bindings) component._bindings = new Map();
  if (!component._eventBindings) component._eventBindings = [];

  // Single traversal for all binding types
  const walker = document.createTreeWalker(
    component.root,
    NodeFilter.SHOW_ALL,
    null
  );

  let node: Node | null;

  while ((node = walker.nextNode())) {
    // Handle text nodes with bindings
    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent;
      if (textContent && textContent.includes("{")) {
        processTextBindings(node, textContent, component);
      }
    }
    // Handle element nodes
    else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      processElementBindings(element, component);
    }
  }
};

const processTextBindings = (
  node: Node,
  textContent: string,
  component: ComponentElement
) => {
  // Create new regex instance to avoid state conflicts
  const bindingRegex = new RegExp(REGEX_PATTERNS.binding.source, "g");
  let match: RegExpExecArray | null;

  while ((match = bindingRegex.exec(textContent)) !== null) {
    const binding: TextBinding = {
      node,
      template: textContent,
      key: match[1].trim(),
    };
    component._bindings.set(match[1].trim(), binding);
    (component.state as any)[binding.key] = "";
  }
};

const processElementBindings = (
  element: Element,
  component: ComponentElement
) => {
  // Convert to array once to avoid repeated iteration
  const attributes = Array.from(element.attributes);

  for (const attr of attributes) {
    // Handle data bindings
    if (attr.value.includes("{")) {
      processAttributeBindings(element, attr, component);
    }

    // Handle event bindings inline
    if (attr.name.startsWith("on")) {
      processEventBinding(element, attr, component);
    }
  }
};

const processAttributeBindings = (
  element: Element,
  attr: Attr,
  component: ComponentElement
) => {
  // Create new regex instance to avoid state conflicts
  const bindingRegex = new RegExp(REGEX_PATTERNS.binding.source, "g");
  let match: RegExpExecArray | null;

  while ((match = bindingRegex.exec(attr.value)) !== null) {
    const binding: AttributeBinding = {
      element,
      attrName: attr.name,
      template: attr.value,
      key: match[1].trim(),
    };
    component._bindings.set(match[1].trim(), binding);
  }
};

const processEventBinding = (
  element: Element,
  attr: Attr,
  component: ComponentElement
) => {
  const eventType = attr.name.slice(2);
  const code = attr.value.trim();

  // Remove the attribute to prevent default handling
  element.removeAttribute(attr.name);

  // Create appropriate event listener
  const listener = createEventListener(component, code);

  // Attach the listener
  element.addEventListener(eventType, listener);

  // Store the binding for cleanup later
  const eventBinding: EventBinding = {
    key: code,
    element,
    event: eventType,
    listener,
  };

  if (!component._eventBindings) component._eventBindings = [];
  component._eventBindings.push(eventBinding);
};

const createEventListener = (
  component: ComponentElement,
  code: string
): EventListener => {
  // Case 1: Arrow function (e.g., "(e) => console.log(e)")
  if (REGEX_PATTERNS.arrowFunction.test(code)) {
    try {
      const funcCreator = new Function(`return (${code});`);
      const actualFunc = funcCreator.call(component);
      return (e: Event) => actualFunc(e);
    } catch (error) {
      logger.error(`Error parsing arrow function handler: ${code}`, error);
      return () => {};
    }
  }

  // Case 2: Inline expressions (e.g., "alert('hi')")
  return (e: Event) => {
    try {
      // Execute in component context, preserving event target
      const func = new Function("event", `with(this) { ${code}; }`);
      func.call(component, e);
    } catch (error) {
      logger.error(`Error in inline expression handler: ${code}`, error);
    }
  };
};

// /**
//  * Cleanup function to remove event listeners (call this when component is destroyed)
//  */
// export const cleanupBindings = (component: ComponentElement) => {
//   if (component._eventBindings) {
//     component._eventBindings.forEach((binding) => {
//       binding.element.removeEventListener(binding.event, binding.listener);
//     });
//     component._eventBindings = [];
//   }

//   if (component._bindings) {
//     component._bindings = [];
//   }
// };
