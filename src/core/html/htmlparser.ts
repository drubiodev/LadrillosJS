import { BindingDescriptor, ConditionalDescriptor, LoopDescriptor, TwoWayBindingDescriptor } from "../../types";
import { REGEX_PATTERNS } from "../../utils/regex";
import { analyzeBinding } from "../component/bindingParser";

type TemplateLoadResult = {
  bindings: BindingDescriptor[];
  twoWayBindings: TwoWayBindingDescriptor[];
  conditionals: ConditionalDescriptor[][];
  loops: LoopDescriptor[];
}

/**
 * Injects the template HTML into the host element and scans for data bindings.
 * Returns a list of all bindings found in text nodes and attributes.
 */
export const loadTemplate = (
  host: HTMLElement | ShadowRoot,
  template: string
) :TemplateLoadResult=> {
  host.innerHTML = template;
  console.log("Template loaded into host.");
  // scan for data bindings
  const bindings = getBindings(host);
  // scan two way bindings
  // scan for loops
  // scan for conditionals

  return{
    bindings,
    twoWayBindings: [],
    conditionals: [],
    loops: []
  }
};

function getBindings(host: HTMLElement | ShadowRoot) {
  // find text nodes with {} bindings
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
  const bindings: BindingDescriptor[] = [];
  let node: Text | null;

  console.log("Starting to walk text nodes for bindings.");

  while ((node = walker.nextNode() as Text | null)) {
    // Skip nodes that are inside loop elements
    if (isInsideLoopElement(node)) {
      continue;
    }

    const matches = [...node.textContent.matchAll(REGEX_PATTERNS.bindings)];

    if (matches.length > 0) {
      const original = node.textContent;

      const nodeBindings = matches.map((match) => {
        const raw = match[1].trim();
        return analyzeBinding(raw);
      });

      console.log(nodeBindings);

      bindings.push({
        node,
        bindings: nodeBindings,
        original,
      });
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
