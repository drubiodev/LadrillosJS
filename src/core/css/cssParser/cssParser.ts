type StyleTarget = HTMLElement | ShadowRoot;

export const loadStyles = (
  target: StyleTarget,
  cssText: string | undefined,
  useShadowDOM: boolean
): void => {
  if (!cssText) return;

  const styleEl = document.createElement("style");
  styleEl.textContent = cssText;

  if (useShadowDOM) {
    target.appendChild(styleEl);
  } else {
    document.head.appendChild(styleEl);
  }
};
