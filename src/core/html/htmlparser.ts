import { BindingDescriptor } from "../../types/LadrilloTypes";
import { REGEX_PATTERNS } from "../../utils/regex";

/**
 * Injects the template HTML into the host element and scans for data bindings.
 * Returns a list of all bindings found in text nodes and attributes.
 */
export const loadTemplate = (
  host: HTMLElement | ShadowRoot,
  template: string
): BindingDescriptor[] => {
  host.innerHTML = template;

  return scanBindings(host);
};

/**
 * Traverses the DOM tree and collects all data binding expressions.
 * Looks for {property} placeholders in both text content and element attributes.
 */
const scanBindings = (host: HTMLElement | ShadowRoot): BindingDescriptor[] => {
  // TreeWalker efficiently traverses only text nodes
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
  const bindings: BindingDescriptor[] = [];
  let node: Text | null;

  // Scan for text nodes with bindings
  // e.g. <p>{name}</p> or <span>{user.firstName}</span>
  while ((node = walker.nextNode() as Text | null)) {
    const matches = [...node.textContent.matchAll(REGEX_PATTERNS.bindings)];

    if (matches.length > 0) {
      // Store the original template text before any replacements
      const original = node.textContent;

      // Create one binding descriptor per node with all its placeholders
      const nodeBindings = matches.map((match) => {
        const raw = match[1].trim();
        const isFunction = raw.includes("("); // Detect function calls like MyName("Peter")

        // For functions, extract the function name as the path
        // For properties, split by dot notation
        const path = isFunction
          ? [raw.split("(")[0].trim()] // Extract function name before (
          : raw.split(".").map((p) => p.trim());

        return { raw, path, isFunction };
      });

      bindings.push({ node, bindings: nodeBindings, original });
    }
  } // Scan for attributes with bindings
  // e.g. <img src="{imageUrl}"> or <input value="{user.email}">
  const elements = host.querySelectorAll("*");
  elements.forEach((el) => {
    for (const attr of el.attributes) {
      const matches = [...attr.value.matchAll(REGEX_PATTERNS.bindings)];
      if (matches.length > 0) {
        // Store the original attribute value
        const original = attr.value;

        // Create one binding descriptor per attribute with all its placeholders
        const attrBindings = matches.map((match) => {
          const raw = match[1].trim();
          const isFunction = raw.includes("(");

          const path = isFunction
            ? [raw.split("(")[0].trim()]
            : raw.split(".").map((p) => p.trim());

          return { raw, path, isFunction };
        });

        bindings.push({
          node: el as unknown as Text,
          bindings: attrBindings,
          original,
          isAttribute: true,
          attributeName: attr.name,
        });
      }
    }
  });

  return bindings;
};
