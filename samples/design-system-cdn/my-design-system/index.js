// my-design-system — a shareable design system built on LadrillosJS.
//
// LadrillosJS is a *peer dependency*: the consuming app provides it (via npm
// or an import map), so exactly one copy of the framework ever runs.
import { registerComponents } from "ladrillosjs";

// Resolve component URLs against this module, not against the page.
// `new URL(..., import.meta.url)` is the one pattern that works everywhere:
// bundlers (Vite/Rollup) statically detect it and emit the .html files as
// build assets, and in a plain browser it resolves against wherever this
// package is hosted (e.g. a CDN). A plain relative path would resolve
// against the consumer's page URL and 404.
const components = {
  "ds-button": new URL("./components/ds-button.html", import.meta.url),
  "ds-card": new URL("./components/ds-card.html", import.meta.url),
  "ds-badge": new URL("./components/ds-badge.html", import.meta.url),
};

/** Register every design-system component. Call once at app startup. */
export function defineDesignSystem() {
  return registerComponents(
    Object.entries(components).map(([name, url]) => ({
      name,
      path: url.href,
    }))
  );
}
