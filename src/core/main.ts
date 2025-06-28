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

  // private helper to fetch text or return empty string on error
  static async #safeFetch(url: string): Promise<string> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      logger.error(`Failed to fetch resource at ${url}:`, err);
      return "";
    }
  }

  constructor() {
    // Initialize the Ladrillos instance
    this.components = {};
  }

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
      // fetch and cache source using cache
      const source = await (async () => {
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
      })();

      // Remove HTML comments and parse the HTML
      const doc = this.#parser.parseFromString(
        source.replace(REGEX_PATTERNS.comments.html, ""),
        "text/html"
      );

      // Remove JS commenets and extract scripts
      const scripts: ScriptElement[] = [];
      const externalScripts: ExternalScriptElement[] = [];

      for (const el of doc.querySelectorAll("script")) {
        if (el.src) {
          externalScripts.push({
            src: el.src,
            type: el.type ?? null,
            bind: el.hasAttribute("bind"),
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

      // Remove css comments and extract styles
      let style = "";
      for (const link of doc.querySelectorAll("link[rel='stylesheet']")) {
        const linkElement = link as HTMLLinkElement;
        style += "\n" + (await Ladrillos.#safeFetch(`${linkElement.href}?raw`));
        link.remove();
      }
      for (const styleEl of doc.querySelectorAll("style")) {
        if (styleEl.textContent) {
          let css = styleEl.textContent.trim();
          // strip CSS comments
          css = css.replace(REGEX_PATTERNS.comments.css, "").trim();
          style += "\n" + css;
        }
        styleEl.remove();
      }
      style = style.trim();

      // finalize component
      this.components[name] = {
        tagName: name,
        template: doc.body.innerHTML.trim(),
        scripts,
        externalScripts,
        style,
      };

      await this.#defineWebComponent(name, useShadowDOM);
      logger.log(`Component ${name} registered successfully`);
    } catch (error) {
      logger.error(`Error registering component ${name}:`, error);
      return;
    }
  }

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

  /** @private */
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
}

export const ladrillos = new Ladrillos();
