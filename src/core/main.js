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
      const cleanHTML = noHtmlComments
        .replace(Ladrillos._SCRIPT_ALL, "")
        .replace(Ladrillos._STYLE_ALL, "");

      const template = document.createElement("template");
      template.innerHTML = cleanHTML;

      const scriptMatch = Ladrillos._SCRIPT_ONE.exec(source);
      const rawScript = scriptMatch?.[1] || "";
      const script = rawScript
        // strip JS block and line comments
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "")
        .trim();

      const styleMatch = Ladrillos._STYLE_ONE.exec(source);
      const style = styleMatch?.[1].trim() || "";

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
