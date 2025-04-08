import { logger } from "../utils/logger.js";
import { createComponentModel } from "./reactivity.js";

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
        // if (this.scriptElement.textContent) {
        //   const scriptFunction = new Function(this.scriptElement.textContent);
        //   scriptFunction.call(this); // Execute with 'this' as the component
        // }
      } else {
        // Fallback for when not using shadow DOM
        this.appendChild(this.styleElement);
        this.appendChild(templateContent);

        // if (this.scriptElement.textContent) {
        //   const scriptFunction = new Function(this.scriptElement.textContent);
        //   scriptFunction.call(this);
        // }
      }

      // Initialize data model with attributes
      const initialData = {};
      for (const attr of componentBindings) {
        if (this.hasAttribute(attr)) {
          initialData[attr] = this.getAttribute(attr);
        }
      }

      // Create reactive data model
      this.data = createComponentModel(this, initialData);

      // Handle script execution with access to data model
      if (this.scriptElement.textContent) {
        const scriptFunction = new Function(
          "data",
          this.scriptElement.textContent
        );
        scriptFunction.call(this, this.data); // Pass data model to the component script
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
      // Update the DOM with the new attribute value
      this._updateBindings(name, newValue);
    }

    _findBindingNodes(root, propName) {
      const nodes = [];

      // First, check for already tracked bindings
      const trackedElements = root.querySelectorAll(`[data-bind-${propName}]`);
      trackedElements.forEach((element) => {
        const textNode = Array.from(element.childNodes).find(
          (node) => node.nodeType === Node.TEXT_NODE
        );
        if (textNode) {
          nodes.push(textNode);
        }
      });

      // If we found tracked bindings, return them
      if (nodes.length > 0) {
        return nodes;
      }

      // Otherwise, search for new bindings
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.includes(`{${propName}}`)) {
          // Store original content on the first encounter
          if (!node.parentElement.hasAttribute("data-original")) {
            node.parentElement.setAttribute("data-original", node.textContent);
          }

          // Mark this element as containing a binding for this property
          node.parentElement.setAttribute(`data-bind-${propName}`, "true");

          nodes.push(node);
        }
      }

      return nodes;
    }

    _updateBindings(propName, value) {
      const root = this.shadowRoot || this;
      const bindingNodes = this._findBindingNodes(root, propName);

      bindingNodes.forEach((node) => {
        // Get original template content with bindings
        const originalContent =
          node.parentElement.getAttribute("data-original") || node.textContent;

        // Make a copy to work with
        let newContent = originalContent;

        // Create a map of all active property values
        const propertyValues = {};
        if (this.data) {
          Object.keys(this.data).forEach((key) => {
            propertyValues[key] = this.data[key];
          });
        }

        // Override with the property being updated
        propertyValues[propName] = value;

        // Replace all binding expressions
        for (const [prop, val] of Object.entries(propertyValues)) {
          newContent = newContent.replace(
            new RegExp(`{${prop}}`, "g"),
            val ?? ""
          );
        }

        // Update the text content
        node.textContent = newContent;
      });
    }
  }

  customElements.define(tagName, ComponentElement);

  logger.log(`Web component defined: <${tagName}></${tagName}>`);
};
