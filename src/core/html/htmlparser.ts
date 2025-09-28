import { BindingDescriptor } from "../../types/LadrilloTypes";
import { REGEX_PATTERNS } from "../../utils/regex";

export const loadTemplate = (
  host: HTMLElement | ShadowRoot,
  template: string
): BindingDescriptor[] => {
  host.innerHTML = template;

  return scanBindings(host);
};

const scanBindings = (host: HTMLElement | ShadowRoot): BindingDescriptor[] => {
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
  const bindings: BindingDescriptor[] = [];

  let node: Text | null;

  // scan for text nodes with bindings
  // e.g. {name} or {name.first}
  while ((node = walker.nextNode() as Text | null)) {
    const matches = [...node.textContent.matchAll(REGEX_PATTERNS.bindings)];

    for (const match of matches) {
      const raw = match[1].trim();
      const path = raw.split(".").map((p) => p.trim());
      bindings.push({ node, raw, path });
    }
  }

  // scan for attributes with bindings
  // e.g. data-bind="{name}" or value="{name.first}"
  const elements = host.querySelectorAll("*");
  elements.forEach((el) => {
    for (const attr of el.attributes) {
      const matches = [...attr.value.matchAll(REGEX_PATTERNS.bindings)];
      for (const match of matches) {
        const raw = match[1].trim();
        const path = raw.split(".").map((p) => p.trim());
        bindings.push({ node: el as unknown as Text, raw, path });
      }
    }
  });

  return bindings;
};
