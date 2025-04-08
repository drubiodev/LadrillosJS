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
      if (this.shadowRoot) {
        // Add the style element first
        this.shadowRoot.appendChild(this.styleElement); // Updated reference

        // Add the template content
        this.shadowRoot.appendChild(this.template.content.cloneNode(true));

        // Handle script execution
        if (this.scriptElement.textContent) {
          const scriptElement = document.createElement("script");
          scriptElement.textContent = this.scriptElement.textContent;
          this.shadowRoot.appendChild(scriptElement);
        }
      } else {
        // Fallback for when not using shadow DOM
        this.appendChild(this.styleElement); // Updated reference
        this.appendChild(this.template.content.cloneNode(true));

        if (this.scriptElement.textContent) {
          const scriptElement = document.createElement("script");
          scriptElement.textContent = this.scriptElement.textContent;
          this.appendChild(scriptElement);
        }
      }
    }

    // Called when the element is removed from the DOM
    disconnectedCallback() {
      logger.log("disconnectedCallback", this);
    }

    // property
    static get observedAttributes() {
      return ["checked"];
    }

    // Called when one of the element's watched attributes change.
    // For an attribute to be watched, you must add it to the component class's static
    attributeChangedCallback(name, oldValue, newValue) {
      logger.log(
        `🪵 ===> Attribute changed: ${name}, Old value: ${oldValue}, New value: ${newValue}`
      );
    }
  }

  customElements.define(component.tagName, ComponentElement);

  logger.log(
    `Web component defined: <${component.tagName}></${component.tagName}>`
  );
};
