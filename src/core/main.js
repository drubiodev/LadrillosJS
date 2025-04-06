/**
 * @fileoverview Ladrillos main module
 * @typedef {import('../types/LadrilloTypes').LadrillosComponent} LadrillosComponent
 */

export class Ladrillos {
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

      // Parse the template, script and style
      const templateMatch = component.match(/<template>([\s\S]*?)<\/template>/);
      const scriptMatch = component.match(/<script>([\s\S]*?)<\/script>/);
      const styleMatch = component.match(/<style>([\s\S]*?)<\/style>/);

      if (!templateMatch) {
        console.error(`No template found in component: ${name}`);
        return;
      }
      const templateContent = templateMatch[1].trim();
      let scriptContent = scriptMatch ? scriptMatch[1].trim() : "";
      let styleContent = styleMatch ? styleMatch[1].trim() : "";

      this.components[name] = {
        template: templateContent,
        script: scriptContent,
        style: styleContent,
      };

      // TODO: Convert to web component
      this._defineWebComponent(name, useShadowDOM);
      console.log(`Component ${name} registered successfully`);
    } catch (error) {
      console.error(`Failed to register component ${name}:`, error);
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
