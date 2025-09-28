import { BindingDescriptor } from "../../types/LadrilloTypes";

const getValue = (ctx: unknown, path: string[]): unknown => {
  return path.reduce<unknown>((acc: unknown, segment: string) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, ctx);
};

export const renderBindings = (
  bindings: BindingDescriptor[],
  context: unknown
): void => {
  for (const binding of bindings) {
    const value = getValue(context, binding.raw.split("."));
    if (value === undefined) continue;
    const replacement = value ?? "";

    console.log("Rendering binding:", binding, "with value:", replacement);

    if (binding.node.nodeType === Node.TEXT_NODE) {
      binding.node.textContent = binding.node.textContent!.replace(
        `{${binding.raw}}`,
        String(replacement)
      );
    } else {
      const element = binding.node as unknown as Element;
      for (const attr of element.attributes) {
        if (attr.value.includes(`{${binding.raw}}`)) {
          element.setAttribute(
            attr.name,
            attr.value.replace(`{${binding.raw}}`, String(replacement))
          );
        }
      }
    }
  }
};
