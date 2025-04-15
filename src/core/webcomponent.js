import { logger } from "../utils/logger.js";
import { createReactiveState } from "./reactivity.js";

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

  // const extractBindings = (template) => {
  //   const regex = /{(.*?)}/g;
  //   const attributes = new Set();
  //   let match;
  //   while ((match = regex.exec(template)) !== null) {
  //     attributes.add(match[1].trim().toLocaleLowerCase());
  //   }
  //   return Array.from(attributes);
  // };

  // // Get bindings from the template
  // const componentBindings = extractBindings(template);

  class ComponentElement extends HTMLElement {
    constructor() {
      super();

      if (useShadowDOM) {
        this.attachShadow({ mode: "open" });
      }

      this.state = {}; // Initialize state

      this.styleElement = document.createElement("style");
      // this.scriptElement = document.createElement("script");
      this.styleElement.textContent = style || "";
      // this.scriptElement.textContent = script || "";
    }

    // Called when the element is first added to the DOM
    connectedCallback() {
      // Clone template content
      const templateContent = template.content.cloneNode(true);

      //hold all the script variables
      const componentContext = {};
      const scriptWithReturn = `
        ${script}
        
        // Return all declared variables and functions as an object
        return { 
          ${
            script
              .match(/\b(?:let|const|var)\s+(\w+)/g)
              ?.map((v) => v.replace(/\b(?:let|const|var)\s+/, ""))
              ?.join(", ") || ""
          },
          ${
            script
              .match(/function\s+(\w+)/g)
              ?.map((f) => f.replace(/function\s+/, ""))
              ?.join(", ") || ""
          }
        };
      `;

      try {
        // Execute script and capture all variables and functions
        const scriptResult = new Function(scriptWithReturn)();
        Object.assign(componentContext, scriptResult);
      } catch (error) {
        console.error("Error executing component script:", error);
      }

      // Create reactive state
      this.state = createReactiveState(this, componentContext);

      this._processTemplate(templateContent);

      if (this.shadowRoot) {
        // Add the style element first
        this.shadowRoot.appendChild(this.styleElement); // Updated reference

        // Add the processed template content
        this.shadowRoot.appendChild(templateContent);
      } else {
        // Fallback for when not using shadow DOM
        this.appendChild(this.styleElement);
        this.appendChild(templateContent);
      }
    }

    _processTemplate(content) {
      // Process text nodes for interpolation
      const textNodes = this._getAllTextNodes(content);

      textNodes.forEach((node) => {
        const text = node.textContent;
        if (text.includes("{") && text.includes("}")) {
          node.textContent = text.replace(/{([^}]+)}/g, (match, key) => {
            // First check component state
            if (this.state[key] !== undefined) {
              return this.state[key];
            }
            // Then check if it's an attribute from the parent
            else if (this.hasAttribute(key)) {
              return this.getAttribute(key);
            }
            // Otherwise return the original binding
            return match;
          });
        }
      });

      // Process attributes for event binding
      // TODO: work on events
      const elementsWithEvents = content.querySelectorAll("*[onclick]");
      elementsWithEvents.forEach((el) => {
        const onclickAttr = el.getAttribute("onclick");
        if (onclickAttr.includes("{") && onclickAttr.includes("}")) {
          // Extract just the function call from "{handleClick()}"
          const funcCall = onclickAttr.replace(/{([^}]+)}/g, "$1").trim();

          // Extract function name by removing parentheses and arguments
          const funcName = funcCall.split("(")[0].trim();

          el.removeAttribute("onclick");
          el.addEventListener("click", (event) => {
            console.log("Click handler for", funcName, "State:", this.state);

            // Check if function exists in state
            if (typeof this.state[funcName] === "function") {
              try {
                // Create a function context with state variables as local variables
                const fnContext = { ...this.state };
                const result = this.state[funcName].call(fnContext, event);

                // Update any modified values back to state
                for (const key in fnContext) {
                  if (fnContext[key] !== this.state[key]) {
                    this.state[key] = fnContext[key];
                  }
                }
              } catch (error) {
                console.error(`Error executing ${funcName}:`, error);
              }
            } else {
              console.error(
                `Function "${funcName}" not found in component state:`,
                this.state
              );
            }
          });
        }
      });
    }

    _getAllTextNodes(node) {
      const textNodes = [];
      const walker = document.createTreeWalker(
        node,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let currentNode;
      while ((currentNode = walker.nextNode())) {
        textNodes.push(currentNode);
      }

      return textNodes;
    }

    _update() {
      // Clone template content
      const templateContent = template.content.cloneNode(true);

      // Clear the shadowRoot
      if (this.shadowRoot) {
        while (this.shadowRoot.firstChild) {
          this.shadowRoot.removeChild(this.shadowRoot.firstChild);
        }

        // Process the template with updated state
        this._processTemplate(templateContent);

        // Add back to the DOM
        this.shadowRoot.appendChild(this.styleElement);
        this.shadowRoot.appendChild(templateContent);
      } else {
        // Non-shadow DOM case
        this.innerHTML = "";
        this._processTemplate(templateContent);
        this.appendChild(this.styleElement);
        this.appendChild(templateContent);
      }
    }

    // Called when the element is removed from the DOM
    // disconnectedCallback() {
    //   logger.log("disconnectedCallback", this);
    // }

    // property
    // static get observedAttributes() {
    //   return componentBindings; // Return the attributes to be observed
    // }

    // Called when one of the element's watched attributes change.
    // For an attribute to be watched, you must add it to the component class's static
    // attributeChangedCallback(name, oldValue, newValue) {
    //   logger.log(
    //     `🪵 ===> Attribute changed: ${name}, Old value: ${oldValue}, New value: ${newValue}`
    //   );
    //   // Update the DOM with the new attribute value
    //   this._updateBindings(name, newValue);
    // }
  }

  customElements.define(tagName, ComponentElement);

  logger.log(`Web component defined: <${tagName}></${tagName}>`);
};
