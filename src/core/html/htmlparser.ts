import { BindingDescriptor } from "../../types";
import { REGEX_PATTERNS } from "../../utils/regex";
import { analyzeBinding } from "../component/bindingParser";

type TemplateLoadResult = {
  bindings: BindingDescriptor[];
};

/**
 * Injects the template HTML into the host element and scans for data bindings.
 * Returns a list of all bindings found in text nodes and attributes.
 *
 * Directive scanning ($for / $if / $show / $bind) is performed separately
 * by `scanDirectivesWithRefs` in the web component lifecycle.
 */
export const loadTemplate = (
  host: HTMLElement | ShadowRoot,
  template: string,
): TemplateLoadResult => {
  host.innerHTML = template;
  const bindings = getBindings(host);
  return { bindings };
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
  // These are handled by the directive processor, not the binding system.
  // Built-in elements (<if>, <else-if>, <for>, <show>, <lazy>) are handled
  // separately at the element level (see scanLoops/scanConditionals/etc.).
  const directiveAttributes = [
    "$bind",
    "$ref",
    "$no:bind",
    "condition", // <if condition="…">, <show condition="…">
    "each", // <for each="…">
    "key", // <for key="…">
    "track-by", // <for track-by="…">
  ];

  // Get all elements in the host
  const elements = Array.from(host.querySelectorAll("*"));

  for (const element of elements) {
    // Skip elements inside <for> templates – the loop renderer handles their
    // bindings per-iteration.
    if (element.tagName === "FOR" || isInsideLoopElement(element)) {
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
  let current: Element | null =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element).parentElement
      : node.parentElement;
  while (current) {
    if (current.tagName === "FOR") {
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
