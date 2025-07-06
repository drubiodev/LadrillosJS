import {
  ExternalScriptElement,
  LadrillosComponent,
  ScriptElement,
} from "../types/LadrilloTypes";
import { logger } from "../utils/logger";
import { REGEX_PATTERNS } from "../utils/regex";

class Ladrillos {
  #cache = new Map<string, string>();
  #maxCacheSize = 25; // TODO: make configurable for developer to set
  #parser = new DOMParser();

  // properties
  components: Record<string, LadrillosComponent>;

  constructor() {
    // Initialize the Ladrillos instance
    this.components = {};
  }

  // ======================
  // PUBLIC API METHODS
  // ======================

  /**
   * Registers a component by fetching its HTML, scripts, and styles.
   * @param name - The name of the component.
   * @param path - The path to the component's HTML file.
   * @param useShadowDOM - Whether to use Shadow DOM for the component (default: true).
   */
  async registerComponent(
    name: string,
    path: string,
    useShadowDOM: boolean = true
  ): Promise<void> {
    if (this.components[name]) {
      logger.warn(`Component ${name} is already registered.`);
      return;
    }

    try {
      // Fetch component source with caching
      const source = await this.#fetchComponentSource(path);

      // Parse and process the component
      const doc = this.#parseComponentHTML(source);
      const { scripts, externalScripts } = this.#extractScripts(doc);
      const style = await this.#extractStyles(doc);

      // Store the component
      this.components[name] = {
        tagName: name,
        template: doc.body.innerHTML.trim(),
        scripts,
        externalScripts,
        style,
      };

      // Define the web component
      await this.#defineWebComponent(name, useShadowDOM);
      logger.log(`Component ${name} registered successfully`);
    } catch (error) {
      logger.error(`Error registering component ${name}:`, error);
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
  async #fetchComponentSource(path: string): Promise<string> {
    const cached = this.#getCached(path);
    if (cached) return cached;

    const res = await fetch(path);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch component at ${path}: ${res.statusText}`
      );
    }

    const text = await res.text();
    this.#setCache(path, text);
    return text;
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

    // Process external stylesheets
    for (const link of doc.querySelectorAll("link[rel='stylesheet']")) {
      const linkElement = link as HTMLLinkElement;
      style += "\n" + (await this.#safeFetch(`${linkElement.href}?raw`));
      link.remove();
    }

    // Process inline styles
    for (const styleEl of doc.querySelectorAll("style")) {
      if (styleEl.textContent) {
        let css = styleEl.textContent.trim();
        // strip CSS comments
        css = css.replace(REGEX_PATTERNS.comments.css, "").trim();
        style += "\n" + css;
      }
      styleEl.remove();
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

  /**
   * Defines the web component using the webcomponent module
   * @param name - Component name
   * @param useShadowDOM - Whether to use Shadow DOM
   */
  async #defineWebComponent(
    name: string,
    useShadowDOM: boolean
  ): Promise<void> {
    const { defineWebComponent } = await import("./webcomponent");

    // safety check
    if (this.components[name]) {
      defineWebComponent(this.components[name], useShadowDOM);
    }
  }

  // ======================
  // CACHE MANAGEMENT
  // ======================

  /**
   * LRU Cache: Gets cached content and marks it as recently used
   * Moves the accessed item to the end of the Map (most recently used position)
   * This ensures frequently accessed components stay in cache longer
   * @param path - The file path to retrieve from cache
   * @returns The cached content or undefined if not found
   */
  #getCached(path: string): string | undefined {
    const cached = this.#cache.get(path);
    if (cached) {
      // LRU: Move to end (most recently used position)
      this.#cache.delete(path);
      this.#cache.set(path, cached);
    }
    return cached;
  }

  /**
   * LRU Cache: Stores content with automatic eviction of least recently used items
   * Maintains cache size limit by removing oldest items when full
   * Updates existing items without affecting cache size
   * @param path - The file path to cache
   * @param content - The content to store
   */
  #setCache(path: string, content: string): void {
    if (this.#cache.has(path)) {
      // Update existing: remove and re-add to mark as most recent
      this.#cache.delete(path);
    } else if (this.#cache.size >= this.#maxCacheSize) {
      // Cache full: remove least recently used (first item in Map)
      const firstKey = this.#cache.keys().next().value;
      if (firstKey) {
        this.#cache.delete(firstKey);
      }
    }
    // Add/update as most recently used (end of Map)
    this.#cache.set(path, content);
  }
}

export const ladrillos = new Ladrillos();
