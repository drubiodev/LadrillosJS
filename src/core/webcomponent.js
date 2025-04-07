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

      // Tracking instances for debugging and cleanup
      this.constructor._instances = this.constructor._instances || [];
      this.constructor._instances.push(this);

      if (useShadowDOM) {
        this.attachShadow({ mode: "open" });
      }

      // Store bound event handlers for proper cleanup
      this._boundEventHandlers = [];
    }

    /**
     * Called when the element is added to DOM
     */
    connectedCallback() {
      const { componentTemplate } = this._prepareComponent();
      const fragment = document.createDocumentFragment();
      const tempContainer = document.createElement("div");
      tempContainer.innerHTML = componentTemplate.html;

      while (tempContainer.firstChild) {
        fragment.appendChild(tempContainer.firstChild);
      }

      // Apply styles
      if (this._componentStyle) {
        if (this.shadowRoot) {
          if (window.ShadowRoot && "adoptedStyleSheets" in document) {
            if (!this.constructor._styleSheet) {
              this.constructor._styleSheet = new CSSStyleSheet();
              this.constructor._styleSheet.replaceSync(this._componentStyle);
            }
            this.shadowRoot.adoptedStyleSheets = [this.constructor._styleSheet];
          } else {
            // Fallback to style element
            const styleEl = document.createElement("style");
            styleEl.textContent = this._componentStyle;
            this.shadowRoot.appendChild(styleEl);
          }
        }
      }

      // Append content to appropriate root
      if (this.shadowRoot) {
        this.shadowRoot.appendChild(fragment);
      } else {
        this.appendChild(fragment);
      }

      // Execute mounting lifecycle hook synchronously
      if (this._hooks && typeof this._hooks.onMounted === "function") {
        this._hooks.onMounted(this.shadowRoot || this);
      }

      // Register disconnection cleanup with error handling
      if (this._hooks && typeof this._hooks.onUnmounted === "function") {
        this._cleanup = () => {
          try {
            this._hooks.onUnmounted();
          } catch (err) {
            console.error(`Error in onUnmounted hook for <${tagName}>:`, err);
          }
        };
      }
    }
    catch(error) {
      console.error(`Error rendering component <${tagName}>:`, error);
    }

    _prepareComponent() {
      // Cache the processed template and component scope
      if (!this._processedTemplate) {
        // Process the template once with reactive bindings
        this._processedTemplate = this._processTemplate();
      }

      return { componentTemplate: this._processedTemplate };
    }

    _processTemplate() {
      const rawTemplate = template;
      this._componentStyle = style;

      // Process for event bindings - identify and prepare event handlers
      // Example: <button @click="handleClick"> becomes prepared for binding
      const processedTemplate = rawTemplate.replace(
        /@([a-zA-Z]+)="([^"]+)"/g,
        (match, event, handlerName) => {
          return `data-event-${event}="${handlerName}"`;
        }
      );

      return {
        html: processedTemplate,
        bindingPoints: this._extractBindingPoints(processedTemplate),
      };
    }

    // Process the template and extract binding points {{expression}}
    _extractBindingPoints(template) {
      const bindingRegex = /\{\{([^}]+)\}\}/g;
      const bindingPoints = [];
      let match;

      while ((match = bindingRegex.exec(template)) !== null) {
        bindingPoints.push({
          expression: match[1].trim(),
          fullMatch: match[0],
        });
      }

      return bindingPoints;
    }
  }

  customElements.define(component.tagName, ComponentElement);

  logger.log(
    `Web component defined: <${component.tagName}></${component.tagName}>`
  );
};
