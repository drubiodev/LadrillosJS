import {
  ExternalScriptElement,
  LadrillosComponent,
  ScriptElement,
} from "../types/LadrilloTypes";
import { logger } from "../utils/logger";
import { getCached, setCache } from "../cache";
import { REGEX_PATTERNS } from "../utils/regex";

class Ladrillos {
  #parser = new DOMParser();

  // properties
  components: Record<string, LadrillosComponent>;

  constructor() {
    // Initialize the Ladrillos instance
    this.components = {};
  }

  async registerComponent(
    name: string,
    path: string,
    useShadowDOM: boolean = true
  ): Promise<void> {
    if (this.components[name]) {
      logger.warn(`Component with name "${name}" is already registered.`);
      return;
    }

    try {
      const source = await this.#fetchComponentSource(path);
      const component = await this.#parseComponent(source!, name);

      console.log(component);
    } catch (error) {
      logger.error(
        `Failed to register component "${name}": ${(error as Error).message}`
      );
      return;
    }
  }

  // ======================
  // PRIVATE HELPER METHODS
  // ======================

  /**
   * Fetches component source with caching support
   * @param path - The file path to fetch
   * @returns The component source content
   */
  async #fetchComponentSource(path: string): Promise<string | undefined> {
    if (!path) {
      throw new Error("Path cannot be null or empty");
    }

    const cached = getCached(path);
    if (cached) return cached;

    // fetch and cache
    try {
      const response = await fetch(path);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch component from ${path}: ${response.statusText}`
        );
      }

      const text = await response.text();
      setCache(path, text);

      return text;
    } catch (error) {
      logger.error(
        `Error fetching component from ${path}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Parses component HTML and extracts scripts and styles
   * @param source - The HTML source of the component
   * @param name - The name of the component
   * @returns Parsed component object
   */
  async #parseComponent(source: string, name: string) {
    const doc = this.#parseComponentHTML(source);
    const { scripts, externalScripts } = this.#extractScripts(doc);
    const styles = await this.#extractStyles(doc);
    const template = doc.body.innerHTML.trim();

    return {
      tagName: name,
      template,
      scripts,
      externalScripts,
      styles,
    };
  }

  /**
   * Parses HTML content and removes comments
   * @param source - The HTML source to parse
   * @returns Parsed DOM document
   */
  #parseComponentHTML(source: string): Document {
    return this.#parser.parseFromString(
      source.replace(REGEX_PATTERNS.comments.html, ""),
      "text/html"
    );
  }

  /**
   * Extracts and processes script elements from the document
   * @param doc - The parsed document
   * @returns Object containing scripts and external scripts
   */
  #extractScripts(doc: Document): {
    scripts: ScriptElement[];
    externalScripts: ExternalScriptElement[];
  } {
    const scripts: ScriptElement[] = [];
    const externalScripts: ExternalScriptElement[] = [];

    for (const el of doc.querySelectorAll("script")) {
      if (el.src) {
        externalScripts.push({
          src: el.src,
          type: el.type ?? null,
          external: true,
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
  }

  /**
   * Extracts and processes style elements from the document
   * @param doc - The parsed document
   * @returns Concatenated CSS content
   */
  async #extractStyles(doc: Document): Promise<string> {
    let style = "";

    // Process styles in document order (inline styles and external stylesheets)
    const styleElements = doc.querySelectorAll("style, link[rel='stylesheet']");

    for (const element of styleElements) {
      if (element.tagName === "LINK") {
        const linkElement = element as HTMLLinkElement;
        style += "\n" + (await this.#safeFetch(`${linkElement.href}?raw`));
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
  }

  /**
   * Safe fetch helper that returns empty string on error
   * @param url - The URL to fetch
   * @returns The fetched content or empty string
   */
  async #safeFetch(url: string): Promise<string> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      logger.error(`Failed to fetch resource at ${url}:`, err);
      return "";
    }
  }
}

export const ladrillos = new Ladrillos();
