import {
  ExternalScriptElement,
  LadrillosComponent,
  ScriptElement,
} from "../types/LadrilloTypes";
import { REGEX_PATTERNS } from "../utils/regex";
import { logger } from "../utils/logger";
import { safeFetch } from "./componentSource";

const parser = new DOMParser();

/**
 * Parses component HTML and extracts scripts and styles
 * @param source - The HTML source of the component
 * @param name - The name of the component
 * @param componentUrl - The URL/path of the component file (used for resolving relative CSS paths)
 * @returns Parsed component object
 */
export const parseComponent = async (
  source: string,
  name: string,
  componentUrl?: string
): Promise<LadrillosComponent> => {
  const doc = parseComponentHTML(source);
  const { scripts, externalScripts } = extractScripts(doc);
  const styles = await extractStyles(doc, componentUrl);
  const template = doc.body.innerHTML.trim();

  return {
    tagName: name,
    template,
    scripts,
    externalScripts,
    styles,
  };
};

/**
 * Parses HTML content and removes comments
 * @param source - The HTML source to parse
 * @returns Parsed DOM document
 */
export const parseComponentHTML = (source: string): Document => {
  return parser.parseFromString(
    source.replace(REGEX_PATTERNS.comments.html, ""),
    "text/html"
  );
};

/**
 * Checks if a script URL is a development server script that should be ignored.
 * Dev server scripts (Vite, Webpack HMR, etc.) are injected by the dev environment
 * and should not be processed as part of the component.
 */
const isDevServerScript = (src: string): boolean => {
  const devPatterns = [
    "/@vite/", // Vite dev client
    "/__vite", // Vite internal
    "/webpack-dev-server", // Webpack dev server
    "/hot-update", // Webpack HMR
    "/__webpack_hmr", // Webpack HMR
    "/browser-sync/", // Browser Sync
    "/livereload.js", // LiveReload
  ];

  return devPatterns.some((pattern) => src.includes(pattern));
};

/**
 * Extracts and processes script elements from the document
 * @param doc - The parsed document
 * @returns Object containing scripts and external scripts
 */
export const extractScripts = (
  doc: Document
): {
  scripts: ScriptElement[];
  externalScripts: ExternalScriptElement[];
} => {
  const scripts: ScriptElement[] = [];
  const externalScripts: ExternalScriptElement[] = [];

  for (const el of doc.querySelectorAll("script")) {
    if (el.src) {
      // Skip dev server scripts (Vite, Webpack, etc.)
      if (isDevServerScript(el.src)) {
        el.remove();
        continue;
      }

      // Only mark as external if the 'external' attribute is explicitly present
      const isExternal = el.hasAttribute("external");

      externalScripts.push({
        src: el.getAttribute("src") || el.src, // Use getAttribute to preserve relative paths
        type: el.type ?? null,
        external: isExternal,
      });
    } else if (el.textContent) {
      let content = el.textContent.trim();
      // strip JavaScript comments (single‑line and block)
      content = content.replace(REGEX_PATTERNS.comments.js, "").trim();
      scripts.push({
        content,
        type: el.type ?? null,
      });
    }
    el.remove();
  }

  return { scripts, externalScripts };
};

/**
 * Resolves CSS href intelligently based on path format
 * - Relative paths (./style.css, ../style.css) resolve from component location
 * - Absolute/implicit paths (style.css, /style.css) resolve from /public folder
 * - Full URLs (http://, https://) pass through unchanged
 * @param href - The original href from link tag
 * @param componentUrl - The component file URL/path (used as base for relative resolution)
 * @returns The resolved CSS path
 */
const resolveCSSPath = (href: string, componentUrl?: string): string => {
  // Full URLs pass through unchanged
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  // Relative paths (./style.css, ../style.css) resolve from component location
  if (href.startsWith("./") || href.startsWith("../")) {
    if (componentUrl) {
      try {
        // Resolve relative to component URL
        const componentBase = componentUrl.endsWith("/")
          ? componentUrl
          : componentUrl.substring(0, componentUrl.lastIndexOf("/") + 1);
        const resolved = new URL(href, componentBase).href;
        return resolved;
      } catch (e) {
        logger.warn(
          `Failed to resolve relative CSS path "${href}" from component "${componentUrl}"`
        );
        return href;
      }
    }
    return href;
  }

  // Absolute paths (/style.css) or implicit public paths (style.css) resolve from /public
  return href.startsWith("/") ? href : "/" + href;
};

/**
 * Extracts CSS content from various response formats
 * Handles:
 * - Vite dev server (wrapped in __vite__css variable)
 * - Plain CSS files (production/CDN)
 * - Other build tool formats
 */
const extractCSSFromResponse = (response: string): string => {
  // Check if this is a Vite HMR response (contains __vite__css)
  // Use a regex that properly handles escaped quotes within the string
  const viteMatch = response.match(/const __vite__css = "((?:[^"\\]|\\.)*)"/);
  if (viteMatch && viteMatch[1]) {
    // Unescape the CSS string
    return viteMatch[1]
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  // Check for other module formats (e.g., "export default ...")
  const exportMatch = response.match(/export\s+default\s+"((?:[^"\\]|\\.)*)"/);
  if (exportMatch && exportMatch[1]) {
    return exportMatch[1]
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  // If it looks like JavaScript (not CSS), warn and return empty
  if (response.includes("import") || response.includes("export")) {
    logger.warn(
      "CSS file returned JavaScript module format. CSS may not load correctly."
    );
    return "";
  }

  // If not a module format, assume it's plain CSS (production or direct file)
  return response;
};

/**
 * Extracts and processes style elements from the document
 * @param doc - The parsed document
 * @param componentUrl - The component file URL/path (used for resolving relative CSS paths)
 * @returns Concatenated CSS content
 *
 * CSS path resolution rules:
 * - ./style.css or ../style.css → resolved relative to component location
 * - style.css or /style.css → resolved from /public folder
 * - http://... or https://... → used as-is (absolute URLs)
 */
export const extractStyles = async (
  doc: Document,
  componentUrl?: string
): Promise<string> => {
  let style = "";

  // Process styles in document order (inline styles and external stylesheets)
  const styleElements = doc.querySelectorAll("style, link[rel='stylesheet']");

  for (const element of styleElements) {
    if (element.tagName === "LINK") {
      const linkElement = element as HTMLLinkElement;
      const href = linkElement.getAttribute("href");
      if (!href) continue;

      // Resolve CSS path intelligently
      const resolvedPath = resolveCSSPath(href, componentUrl);
      const response = await safeFetch(resolvedPath);
      const cssContent = extractCSSFromResponse(response);
      if (cssContent) {
        style += "\n" + cssContent;
      }
    } else if (element.tagName === "STYLE") {
      const styleEl = element as HTMLStyleElement;
      if (styleEl.textContent) {
        let css = styleEl.textContent.trim();
        // strip CSS comments
        css = css.replace(REGEX_PATTERNS.comments.css, "").trim();
        style += "\n" + css;
      }
    }
    element.remove();
  }

  return style.trim();
};
