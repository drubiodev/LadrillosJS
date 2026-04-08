import {
  BindingDescriptor,
  ConditionalDescriptor,
  LoopDescriptor,
  TwoWayBindingDescriptor,
} from "../../types";
import { REGEX_PATTERNS } from "../../utils/regex";
import { analyzeBinding } from "../component/bindingParser";

type TemplateLoadResult = {
  bindings: BindingDescriptor[];
  twoWayBindings: TwoWayBindingDescriptor[];
  conditionals: ConditionalDescriptor[][];
  loops: LoopDescriptor[];
};

/**
 * Injects the template HTML into the host element and scans for data bindings.
 * Returns a list of all bindings found in text nodes and attributes.
 */
export const loadTemplate = (
  host: HTMLElement | ShadowRoot,
  template: string,
): TemplateLoadResult => {
  host.innerHTML = template;
  // scan for data bindings (text nodes + attributes)
  const bindings = getBindings(host);
  // scan two way bindings
  // scan for loops
  // scan for conditionals

  return {
    bindings,
    twoWayBindings: [],
    conditionals: [],
    loops: [],
  };
};

function getBindings(host: HTMLElement | ShadowRoot) {
  const bindings: BindingDescriptor[] = [];

  // 1. Find text nodes with {} bindings
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    // Skip nodes that are inside loop elements or $no:bind elements
    if (isInsideLoopElement(node) || isInsideNoBind(node)) {
      continue;
    }

    const textContent = node.textContent;
    if (!textContent) continue;
    const matches = [...textContent.matchAll(REGEX_PATTERNS.bindings)];

    if (matches.length > 0) {
      const original = textContent;

      const nodeBindings = matches.map((match) => {
        const raw = match[1].trim();
        return analyzeBinding(raw);
      });

      bindings.push({
        node,
        bindings: nodeBindings,
        original,
      });
    }
  }

  // 2. Find attribute bindings
  const attrBindings = getAttributeBindings(host);
  bindings.push(...attrBindings);

  return bindings;
}

/**
 * Scan all elements for attributes containing {} bindings
 */
function getAttributeBindings(
  host: HTMLElement | ShadowRoot,
): BindingDescriptor[] {
  const bindings: BindingDescriptor[] = [];

  // Directive attributes that should NOT be treated as regular bindings
  // These are handled by the directive processor, not the binding system
  const directiveAttributes = [
    "$if",
    "$else",
    "$else-if",
    "$for",
    "$show",
    "$bind",
    "$ref",
    "$no:bind",
  ];

  // Get all elements in the host
  const elements = Array.from(host.querySelectorAll("*"));

  for (const element of elements) {
    // Skip elements inside loops or $no:bind elements
    if (element.hasAttribute("$for") || isInsideLoopElement(element)) {
      continue;
    }

    // Skip elements with $no:bind or inside $no:bind elements
    if (element.hasAttribute("$no:bind") || isInsideNoBind(element)) {
      continue;
    }

    // Check each attribute
    for (const attr of Array.from(element.attributes) as Attr[]) {
      // Skip directive attributes - they're handled separately
      if (directiveAttributes.includes(attr.name)) {
        continue;
      }

      const matches = [...attr.value.matchAll(REGEX_PATTERNS.bindings)];

      if (matches.length > 0) {
        // Create a placeholder text node to store binding info
        // (We need a Text node for the BindingDescriptor structure)
        const placeholderNode = document.createTextNode(attr.value);

        const attrBindings = matches.map((match) => {
          const raw = match[1].trim();
          return analyzeBinding(raw);
        });

        bindings.push({
          node: placeholderNode,
          bindings: attrBindings,
          original: attr.value,
          isAttribute: true,
          attributeName: attr.name,
          // Store reference to the element for attribute updates
          element: element as HTMLElement,
        } as BindingDescriptor & { element: HTMLElement });
      }
    }
  }

  return bindings;
}

function isInsideLoopElement(node: Node): boolean {
  let current = node.parentElement;
  while (current) {
    if (current.hasAttribute && current.hasAttribute("$for")) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/**
 * Check if a node is inside an element with $no:bind attribute.
 * Elements with $no:bind skip all binding processing - useful for
 * displaying literal template syntax like {name} in documentation.
 *
 * @example
 * <code $no:bind>{name}</code>  <!-- Renders literally as "{name}" -->
 */
function isInsideNoBind(node: Node): boolean {
  let current = node.parentElement;
  while (current) {
    if (current.hasAttribute && current.hasAttribute("$no:bind")) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}
