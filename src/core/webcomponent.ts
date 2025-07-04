import {
  ComponentState,
  LadrillosComponent,
  ComponentBinding,
  EventBinding,
} from "../types/LadrilloTypes";
import { logger } from "../utils/logger";
import { scanBindings } from "./bindings";
import { loadComponentScript } from "./scriptHandler";

export const defineWebComponent = (
  component: LadrillosComponent,
  useShadowDOM: boolean
) => {
  const { tagName, template, scripts, externalScripts, style } = component;

  class ComponentElement extends HTMLElement {
    // properties
    public _bindings: ComponentBinding = new Map();
    public _eventBindings: EventBinding = new Map();

    root: ShadowRoot | HTMLElement;
    state: ComponentState;

    constructor() {
      super();
      if (useShadowDOM) this.attachShadow({ mode: "open" });

      this.root = useShadowDOM ? this.shadowRoot! : this;

      // initialize state and bindings
      const internalState: { [key: string]: any } = {};
      this.state = new Proxy(internalState, {
        set: (target, prop, value) => {
          if (typeof prop === "string") {
            // Only update if value actually changed
            if (target[prop] !== value) {
              target[prop] = value;
              this._render(prop, value);
            }
          }
          return true;
        },
      });
    }

    connectedCallback() {
      this._loadTemplate();
      scanBindings(this, scripts);
      loadComponentScript(this, scripts);
      this._loadStyles();

      this._eventBindings.clear();
    }

    disconnectedCallback() {
      this._bindings.clear();
    }

    // renders the component by replacing the bindings with their values
    _render(prop: string, value: any) {
      // Group bindings by their target node to handle multiple bindings in the same text/attribute
      const nodeBindings = new Map<Node | Element, any[]>();

      this._bindings.forEach((binding, bindingKey) => {
        if (binding.key === prop) {
          // Handle both TextBinding and AttributeBinding types
          const target = (binding as any).node || (binding as any).element;
          if (!nodeBindings.has(target)) {
            nodeBindings.set(target, []);
          }
          nodeBindings.get(target)!.push(binding);
        }
      });

      if (nodeBindings.size === 0) {
        logger.warn(`No binding found for property: ${prop}`);
        return;
      }

      // Update each node with all its bindings
      nodeBindings.forEach((bindings, target) => {
        const firstBinding = bindings[0];

        if (target.nodeType === Node.TEXT_NODE) {
          // For text nodes, start with the original template and replace all variables
          let updatedContent = (firstBinding as any).template;

          // Replace all state variables in the template
          Object.keys(this.state).forEach((stateKey) => {
            const stateValue = (this.state as any)[stateKey];
            updatedContent = updatedContent.replace(
              new RegExp(`\\{${stateKey}\\}`, "g"),
              stateValue
            );
          });

          (target as Text).textContent = updatedContent;
        } else if (target.nodeType === Node.ELEMENT_NODE) {
          // For attribute bindings, start with the original template and replace all variables
          let updatedValue = (firstBinding as any).template;

          // Replace all state variables in the template
          Object.keys(this.state).forEach((stateKey) => {
            const stateValue = (this.state as any)[stateKey];
            updatedValue = updatedValue.replace(
              new RegExp(`\\{${stateKey}\\}`, "g"),
              stateValue
            );
          });

          (target as Element).setAttribute(
            (firstBinding as any).attrName,
            updatedValue
          );
        }
      });
    }

    // sets template to innerHTML or shadowRoot.innerHTML
    _loadTemplate() {
      if (useShadowDOM && this.shadowRoot) {
        this.shadowRoot.innerHTML = template;
      } else {
        this.innerHTML = template;
      }
    }

    // loads the styles into the shadowRoot or document head
    _loadStyles() {
      if (!style) return;
      const styleId = `${tagName}-styles`;

      if (useShadowDOM) {
        if (!this.root.querySelector(`#${styleId}`)) {
          const styleElement = document.createElement("style");
          styleElement.id = styleId;
          styleElement.textContent = style;
          this.root.appendChild(styleElement);
        }
      } else {
        if (!document.head.querySelector(`#${styleId}`)) {
          const styleElement = document.createElement("style");
          styleElement.id = styleId;
          styleElement.textContent = style;
          document.head.appendChild(styleElement);
        }
      }
    }

    // initializes the state from the attributes
    _initializeStateFromAttributes() {
      this.getAttributeNames().forEach((name) => {
        const raw = this.getAttribute(name);
        console.log(raw);
        // re‑use your parsing logic
        // this._handleAttributeChange(name, raw);
      });
    }
  }

  customElements.define(tagName, ComponentElement);
  logger.log(`Web component defined: <${tagName}></${tagName}>`);
};
