import { logger } from "../utils/logger.js";
/** @typedef {import('../types/LadrilloTypes').LadrillosComponent} LadrillosComponent */

class Ladrillos {
  #cache = new Map();
  #parser = new DOMParser();

  // private helper to fetch text or return empty string on error
  static async #safeFetch(url) {
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
    /** @type {Record<string, LadrillosComponent>} */
    this.components = {};
  }

  /**
   * Registers a web‐component by fetching its HTML, scripts, and styles.
   * @param {string} name
   * @param {string} path
   * @param {boolean} [useShadowDOM=true]
   */
  async registerComponent(name, path, useShadowDOM = true) {
    if (this.components[name]) {
      logger.log(`Component ${name} already registered.`);
      return;
    }

    // mark in‐progress to prevent duplicate calls
    this.components[name] = { __registering: true };

    try {
      // fetch & cache source
      const source = await (async () => {
        const cached = this.#cache.get(path);
        if (cached) return cached;
        const res = await fetch(path);
        const text = await res.text();
        this.#cache.set(path, text);
        return text;
      })();

      // strip comments & parse
      const doc = this.#parser.parseFromString(
        source.replace(/<!--[\s\S]*?-->/g, ""),
        "text/html"
      );

      // extract scripts
      const scripts = [];
      const externalScripts = [];
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
          content = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").trim();
          scripts.push({
            content,
            type: el.type ?? null,
          });
        }
        el.remove();
      }

      // extract styles from <link> and <style>
      let style = "";
      for (const link of doc.querySelectorAll("link[rel='stylesheet']")) {
        style += "\n" + (await Ladrillos.#safeFetch(`${link.href}?raw`));
        link.remove();
      }
      for (const styleEl of doc.querySelectorAll("style")) {
        if (styleEl.textContent) {
          let css = styleEl.textContent.trim();
          // strip CSS comments
          css = css.replace(/\/\*[\s\S]*?\*\//g, "").trim();
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

      await this._defineWebComponent(name, useShadowDOM);
      logger.log(`Component ${name} registered successfully`);
    } catch (err) {
      logger.error(`Failed to register component ${name}:`, err);
      delete this.components[name];
    }
  }

  /**
   * Registers multiple components with optional concurrency throttling.
   * @param {{name: string, path: string,useShadowDOM:boolean}[]} components
   * @param {number} [concurrency=5] max simultaneous registrations
   */
  async registerComponents(components, concurrency = 5) {
    console.log(components);
    const tasks = components.map(
      ({ name, path, useShadowDOM }) =>
        () =>
          this.registerComponent(name, path, useShadowDOM)
    );

    const results = await this._runWithConcurrency(tasks, concurrency);

    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const { name } = components[i];
        logger.error(`registration failed for ${name}:`, r.reason);
      }
    });

    return results;
  }

  /** @private */
  async _runWithConcurrency(tasks, limit) {
    const results = [];
    const executing = [];
    for (const fn of tasks) {
      let tracker;
      // start the task
      const p = fn();
      results.push(p);

      // when it settles, remove from the executing pool
      tracker = p.then(() => {
        executing.splice(executing.indexOf(tracker), 1);
      });
      executing.push(tracker);

      //if limit hit, then wait for one to finish
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }

    return Promise.allSettled(results);
  }

  /** @private */
  async _defineWebComponent(name, useShadowDOM) {
    const { defineWebComponent } = await import("./webcomponent.js");
    defineWebComponent(this.components[name], useShadowDOM);
  }
}

export const ladrillos = new Ladrillos();
