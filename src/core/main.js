import { logger } from "../utils/logger.js";

/**
 * @fileoverview Ladrillos main module
 * @typedef {import('../types/LadrilloTypes').LadrillosComponent} LadrillosComponent
 */
class Ladrillos {
  #cache = new Map();

  constructor() {
    /** @type {Object.<string, LadrillosComponent>} */
    this.components = {};
  }

  static _SCRIPT_ALL = /<script>([\s\S]*?)<\/script>/g;
  static _STYLE_ALL = /<style>([\s\S]*?)<\/style>/g;
  static _SCRIPT_ONE = /<script>([\s\S]*?)<\/script>/;
  static _STYLE_ONE = /<style>([\s\S]*?)<\/style>/;

  /**
   * @param {string} name
   * @param {string} path
   * @param {boolean} [useShadowDOM=true]
   * @returns {Promise<void>}
   */
  async registerComponent(name, path, useShadowDOM = true) {
    // skip if already registered
    if (this.components[name]) {
      logger.log(`Component ${name} already registered, skipping.`);
      return;
    }

    try {
      // fetch & cache component text
      let source = this.#cache.get(path);

      if (!source) {
        const res = await fetch(path);
        source = await res.text();
        this.#cache.set(path, source);
      }

      const noHtmlComments = source.replace(/<!--[\s\S]*?-->/g, "");

      // parse the HTML so we can handle multiple <script> (inline & external) and <style> tags
      const parser = new DOMParser();
      const doc = parser.parseFromString(noHtmlComments, "text/html");

      // extract and concatenate all scripts (inline & external)
      let script = "";
      const scriptEls = Array.from(
        doc.querySelectorAll("script:not([type='module'])")
      );

      for (const el of scriptEls) {
        if (el.src) {
          const src = el.getAttribute("src");
          let scriptUrl;
          try {
            console.log(`Loading script from ${src}`);
            console.log(`Base URL: ${path}`);
            // scriptUrl = new URL(src, path).href;
            scriptUrl = src;
          } catch (urlErr) {
            console.error(
              `Invalid script URL "${src}" (base "${path}") - skipping:`,
              urlErr
            );
            el.remove();
            continue;
          }

          try {
            const res = await fetch(scriptUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            script += "\n" + (await res.text());
          } catch (fetchErr) {
            console.error(
              `Could not load script at ${scriptUrl} - skipping:`,
              fetchErr
            );
          }
        } else {
          script += "\n" + el.textContent;
        }

        el.remove();
      }

      // strip JS comments
      script = script
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "")
        .trim();

      // extract all styles
      let style = "";
      const styleEls = Array.from(doc.querySelectorAll("style"));
      for (const el of styleEls) {
        style += "\n" + el.textContent;
        el.remove();
      }
      style = style.trim();

      // the remaining HTML is your template
      const template = document.createElement("template");
      template.innerHTML = doc.body.innerHTML;

      this.components[name] = {
        tagName: name,
        template,
        script,
        style,
      };

      this._defineWebComponent(name, useShadowDOM);
      logger.log(`Component ${name} registered successfully`);
    } catch (err) {
      logger.error(`Failed to register component ${name}:`, err);
    }
  }

  /**
   * @private
   * @param {string} name
   * @param {boolean} useShadowDOM
   */
  async _defineWebComponent(name, useShadowDOM) {
    const { defineWebComponent } = await import("./webcomponent.js");
    defineWebComponent(this.components[name], useShadowDOM);
  }
}

export const ladrillos = new Ladrillos();
