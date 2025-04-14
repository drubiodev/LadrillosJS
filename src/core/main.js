import { logger } from "../utils/logger.js";

/**
 * @fileoverview Ladrillos main module
 * @typedef {import('../types/LadrilloTypes').LadrillosComponent} LadrillosComponent
 */

class Ladrillos {
  constructor() {
    /**
     * Registered components collection
     * @type {Object.<string, LadrillosComponent>}
     * @private
     */
    this.components = {};
  }

  /**
   * Registers a component by loading it from a file path
   * @param {string} name - Component name/tag
   * @param {string} path - Path to the component file
   * @param {boolean} [useShadowDOM=true] - Whether to use Shadow DOM
   * @returns {Promise<void>}
   */
  async registerComponent(name, path, useShadowDOM = true) {
    try {
      const component = await fetch(path).then((res) => res.text());

      const template = document.createElement("template");
      template.innerHTML = component
        .replace(/<script.*?<\/script>/g, "")
        .replace(/<style.*?<\/style>/g, "");

      // Parse the template, script and style
      const scriptMatch = component.match(/<script>([\s\S]*?)<\/script>/);
      const styleMatch = component.match(/<style>([\s\S]*?)<\/style>/);

      const scriptContent = scriptMatch ? scriptMatch[1].trim() : "";
      const styleContent = styleMatch ? styleMatch[1].trim() : "";

      this.components[name] = {
        tagName: name,
        template: template.innerHTML, // TODO: extract text nodes
        script: scriptContent,
        style: styleContent,
      };

      this._defineWebComponent(name, useShadowDOM);
      logger.log(`Component ${name} registered successfully`);
    } catch (error) {
      logger.error(`Failed to register component ${name}:`, error);
    }
  }

  /**
   * Defines a registered component as a web component
   * @param {string} name - Name of the component to define
   * @param {boolean} useShadowDOM - Whether to use Shadow DOM
   * @returns {Promise<void>}
   * @private
   */
  async _defineWebComponent(name, useShadowDOM) {
    const { defineWebComponent } = await import("./webcomponent.js");
    const component = this.components[name];

    defineWebComponent(component, useShadowDOM);
  }
}

export const ladrillos = new Ladrillos();
