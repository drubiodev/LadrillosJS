import { logger } from "../utils/logger.js";

/**
 * @fileoverview Web component definition utilities
 * @typedef {import('../types/LadrilloTypes').LadrillosComponent} LadrillosComponent
 */

/**
 *
 * @param {LadrillosComponent} component
 * @param {boolean} useShadowDOM
 */
export const defineWebComponent = (component, useShadowDOM) => {
  if (!component) {
    logger.error("Component is not defined or invalid.");
    return;
  }

  // check if the component is already defined
  if (customElements.get(component.tagName)) {
    logger.warn(`Component ${component.tagName} is already defined.`);
    return;
  }

  const { tagName, template, script, style } = component;

  const extractBindings = (template) => {
    const regex = /{(.*?)}/g;
    const attributes = new Set();
    let match;
    while ((match = regex.exec(template)) !== null) {
      attributes.add(match[1].trim().toLocaleLowerCase());
    }
    return Array.from(attributes);
  };

  // Get bindings from the template
  const componentBindings = extractBindings(template);

  class ComponentElement extends HTMLElement {
    constructor() {
      super();

      if (useShadowDOM) {
        this.attachShadow({ mode: "open" });
      }

      this.template = document.createElement("template");
      this.styleElement = document.createElement("style");
      this.scriptElement = document.createElement("script");
      this.styleElement.textContent = style || "";
      this.scriptElement.textContent = script || "";
      this.template.innerHTML = template;
    }

    // Called when the element is first added to the DOM
    connectedCallback() {
      // Clone template content
      const templateContent = this.template.content.cloneNode(true);

      if (this.shadowRoot) {
        // Add the style element first
        this.shadowRoot.appendChild(this.styleElement); // Updated reference

        // Add the processed template content
        this.shadowRoot.appendChild(templateContent);

        // Handle script execution
        if (this.scriptElement.textContent) {
          const scriptFunction = new Function(this.scriptElement.textContent);
          scriptFunction.call(this); // Execute with 'this' as the component
        }
      } else {
        // Fallback for when not using shadow DOM
        this.appendChild(this.styleElement);
        this.appendChild(templateContent);

        if (this.scriptElement.textContent) {
          const scriptFunction = new Function(this.scriptElement.textContent);
          scriptFunction.call(this);
        }
      }
    }

    // Called when the element is removed from the DOM
    disconnectedCallback() {
      logger.log("disconnectedCallback", this);
    }

    // property
    static get observedAttributes() {
      return componentBindings; // Return the attributes to be observed
    }

    // Called when one of the element's watched attributes change.
    // For an attribute to be watched, you must add it to the component class's static
    attributeChangedCallback(name, oldValue, newValue) {
      logger.log(
        `🪵 ===> Attribute changed: ${name}, Old value: ${oldValue}, New value: ${newValue}`
      );
    }
  }

  customElements.define(tagName, ComponentElement);

  logger.log(`Web component defined: <${tagName}></${tagName}>`);
};
