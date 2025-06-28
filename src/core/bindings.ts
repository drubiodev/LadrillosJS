import { ComponentElement } from "../types/LadrilloTypes";
import { REGEX_PATTERNS } from "../utils/regex";

export const scanBindings = (component: ComponentElement) => {
  // Ensure root exists and is valid
  if (!component.root) return;

  const walker = document.createTreeWalker(
    component.root,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node: Node | null;

  // scan for text nodes with bindings
  // e.g. {name} or {name.first}
  while ((node = walker.nextNode())) {
    const textContent = node.textContent;
    if (!textContent) continue;

    const matches = [...textContent.matchAll(/{([^}]+)}/g)];
    if (matches.length) {
      const group = matches.map(([, key]) => ({
        node,
        template: textContent,
        key: key.trim(),
      }));
      component._bindings.push(group);
    }
  }

  // scan for attributes with bindings
  // e.g. data-bind="{name}" or value="{name.first}"
  component.root.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes)
      .filter((attr) => attr.value.includes("{"))
      .forEach((attr) => {
        const matches = [...attr.value.matchAll(REGEX_PATTERNS.binding)];
        if (matches.length) {
          matches.forEach(([, key]) => {
            component._bindings.push({
              element: el,
              attrName: attr.name,
              template: attr.value,
              key: key.trim(),
            });
          });
        }
      });
  });
};
