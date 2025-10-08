import {
  ExternalScriptElement,
  LadrillosComponent,
  ScriptElement,
} from "../types/LadrilloTypes";
import { REGEX_PATTERNS } from "../utils/regex";
import { safeFetch } from "./componentSource";

const parser = new DOMParser();

/**
 * Parses component HTML and extracts scripts and styles
 * @param source - The HTML source of the component
 * @param name - The name of the component
 * @returns Parsed component object
 */
export const parseComponent = async (
  source: string,
  name: string
): Promise<LadrillosComponent> => {
  const doc = parseComponentHTML(source);
  const { scripts, externalScripts } = extractScripts(doc);
  const styles = await extractStyles(doc);
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
        src: el.src,
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
 * Extracts and processes style elements from the document
 * @param doc - The parsed document
 * @returns Concatenated CSS content
 */
export const extractStyles = async (doc: Document): Promise<string> => {
  let style = "";

  // Process styles in document order (inline styles and external stylesheets)
  const styleElements = doc.querySelectorAll("style, link[rel='stylesheet']");

  for (const element of styleElements) {
    if (element.tagName === "LINK") {
      const linkElement = element as HTMLLinkElement;
      style += "\n" + (await safeFetch(`${linkElement.href}?raw`));
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
