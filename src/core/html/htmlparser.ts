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

      for (const match of matches) {
        const raw = match[1].trim();
        const path = raw.split(".").map((p) => p.trim());
        bindings.push({ node, raw, path, original });
      }
    }
  }

  // Scan for attributes with bindings
  // e.g. <img src="{imageUrl}"> or <input value="{user.email}">
  const elements = host.querySelectorAll("*");
  elements.forEach((el) => {
    for (const attr of el.attributes) {
      const matches = [...attr.value.matchAll(REGEX_PATTERNS.bindings)];
      if (matches.length > 0) {
        // Store the original attribute value
        const original = attr.value;

        for (const match of matches) {
          const raw = match[1].trim();
          const path = raw.split(".").map((p) => p.trim());
          bindings.push({
            node: el as unknown as Text,
            raw,
            path,
            original,
            isAttribute: true,
            attributeName: attr.name,
          });
        }
      }
    }
  });

  return bindings;
};
