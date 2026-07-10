import { BindingDescriptor } from "../../types";
import { REGEX_PATTERNS } from "../../utils/regex";
import { analyzeBinding } from "../component/bindingParser";
import {
  scanLazyElements,
  getPendingLazyContent,
} from "../builtins/lazyElement";
import {
  escapeControlTags,
  restoreControlTags,
} from "./controlTagEscape";

type TemplateLoadResult = {
  bindings: BindingDescriptor[];
};

/**
 * Injects the template HTML into the host element and scans for data bindings.
 * Returns a list of all bindings found in text nodes and attributes.
 *
 * Directive scanning ($for / $if / $show / $bind) is performed separately
 * by `scanDirectivesWithRefs` in the web component lifecycle.
 *
 * <lazy> elements are preprocessed here in a detached <template> fragment so
 * their children never get connected (and thus never fire connectedCallback /
 * drain their light DOM) before lazy detaches them. Without this, components
 * inside <lazy> that read `$host.__originalHTML` would see an empty string on
 * the second connect after lazy reveals them.
 */
export const loadTemplate = (
  host: HTMLElement | ShadowRoot,
  template: string,
): TemplateLoadResult => {
  // Parse into a detached <template> first. Its .content is a DocumentFragment
  // that is NOT connected to the document, so custom-element connectedCallback
  // will not fire for any children inside.
  //
  // <lazy> is processed here while children are still detached: it moves its
  // children into a closure-held DocumentFragment (also detached) so inner
  // custom elements never fire connectedCallback prematurely. The fragment is
  // stashed on a sentinel inside `tpl.content` so subsequent scanners can
  // still find and wire its contents (bindings, listeners, directives).
  const tpl = document.createElement("template");
  // Escape control elements (<for>, <if>, …) to <template> placeholders
  // before parsing so table insertion modes cannot foster-parent them out
  // of <table>/<tbody>/<tr>, then rebuild them with DOM APIs.
  tpl.innerHTML = escapeControlTags(template);
  restoreControlTags(tpl.content);
  scanLazyElements(tpl.content);
  host.innerHTML = "";
  host.appendChild(tpl.content);

  // Scan bindings on host AND on each pending <lazy> content fragment.
  // Lazy-content fragments are detached, but binding descriptors hold direct
  // node references that survive the later DOM move into the host tree, so
  // {} text and attribute bindings inside <lazy> work the same as inline.
  const bindings = getBindings(host);
  for (const frag of getPendingLazyContent(host)) {
    bindings.push(...getBindings(frag));
  }
  return { bindings };
};

function getBindings(host: HTMLElement | ShadowRoot | DocumentFragment) {
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
  host: HTMLElement | ShadowRoot | DocumentFragment,
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
