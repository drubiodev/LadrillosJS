type StyleTarget = HTMLElement | ShadowRoot;

/**
 * One CSSStyleSheet per unique CSS text, shared by every instance that adopts
 * it. The browser parses a component's CSS once no matter how many instances
 * exist, instead of once per injected <style>.
 */
const sheetCache = new Map<string, CSSStyleSheet>();

let adoptable: boolean | undefined;

const canAdopt = (): boolean => {
  if (adoptable === undefined) {
    try {
      adoptable = typeof new CSSStyleSheet().replaceSync === "function";
    } catch {
      adoptable = false;
    }
  }
  return adoptable;
};

/**
 * Constructed stylesheets drop `@import` rules, so those keep the <style> path
 * rather than losing their imports silently.
 */
const hasImport = (cssText: string): boolean => cssText.includes("@import");

const getSheet = (cssText: string): CSSStyleSheet | null => {
  let sheet = sheetCache.get(cssText);
  if (sheet) return sheet;

  try {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
  } catch {
    return null;
  }

  sheetCache.set(cssText, sheet);
  return sheet;
};

const adopt = (
  root: DocumentOrShadowRoot,
  sheet: CSSStyleSheet,
  first: boolean,
): void => {
  const current = root.adoptedStyleSheets;
  if (current.includes(sheet)) return;
  // Assignment rather than push(): the mutable-array form of
  // adoptedStyleSheets shipped later than the property itself.
  root.adoptedStyleSheets = first ? [sheet, ...current] : [...current, sheet];
};

/**
 * Applies a component's own `<style>` block.
 *
 * Adopting a constructed stylesheet instead of injecting `<style>` keeps this
 * off the `style-src` fetch directive entirely, so components render under a
 * CSP that does not allow `'unsafe-inline'`.
 */
export const loadStyles = (
  target: StyleTarget,
  cssText: string | undefined,
  useShadowDOM: boolean,
): void => {
  if (!cssText) return;

  if (canAdopt() && !hasImport(cssText)) {
    const sheet = getSheet(cssText);
    if (sheet) {
      adopt(useShadowDOM ? (target as ShadowRoot) : document, sheet, false);
      return;
    }
  }

  const styleEl = document.createElement("style");
  styleEl.textContent = cssText;

  if (useShadowDOM) {
    target.appendChild(styleEl);
  } else {
    document.head.appendChild(styleEl);
  }
};

/**
 * Applies a stylesheet fetched for a `<link>` inside a shadow root, which
 * cannot see document styles. Ordered ahead of the component's own styles so
 * those still win.
 */
export const loadExternalStyleText = (
  root: ShadowRoot,
  cssText: string,
  href: string,
): void => {
  if (canAdopt() && !hasImport(cssText)) {
    const sheet = getSheet(cssText);
    if (sheet) {
      adopt(root, sheet, true);
      return;
    }
  }

  const styleEl = document.createElement("style");
  styleEl.textContent = cssText;
  styleEl.setAttribute("data-external-href", href);
  root.insertBefore(styleEl, root.firstChild);
};
