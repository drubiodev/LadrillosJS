import { TIMEOUT } from "dns";
import {
  ComponentState,
  LadrillosComponent,
  ComponentBinding,
  EventHandler,
} from "../types/LadrilloTypes";
import { logger } from "../utils/logger";
import { scanBindings } from "../bindings";

export const defineWebComponent = (
  component: LadrillosComponent,
  useShadowDOM: boolean
) => {
  const { tagName, template, scripts, externalScripts, style } = component;

  class ComponentElement extends HTMLElement {
    // properties
    public _bindings: ComponentBinding = new Map();
    public _eventHandlers: EventHandler = new Map();
    public _constVariables: Set<string> = new Set();

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
            const previousValue = target[prop];

            // Skip constant variable check if previous value is empty, whitespace, null, or undefined
            const isFirstTimeAssignment =
              previousValue === undefined ||
              previousValue === null ||
              previousValue === "" ||
              (typeof previousValue === "string" &&
                previousValue.trim() === "");

            if (!isFirstTimeAssignment && this._constVariables.has(prop)) {
              const error = new TypeError(
                `Assignment to constant variable. '${String(prop)}'`
              );
              error.name = "TypeError";
              throw error;
            }

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
      // this._loadStyles();
      // this._initializeStateFromAttributes();

      // this._eventHandlers.clear();

      console.log(scripts[0].content || "");
    }

    disconnectedCallback() {
      this._bindings.clear();
      this._constVariables.clear();
    }

    // renders the component by replacing the bindings with their values
    _render(prop: string, value: any) {
      this._bindings.forEach((binding) => {
        if (binding.key === prop) {
          if (binding.node && binding.template) {
            // Replace the binding in the template with the value
            const newText = binding.template.replace(
              new RegExp(`{${binding.key}}`, "g"),
              String(value)
            );
            binding.node.textContent = newText;
          }
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

      this._bindings = scanBindings(this.root).bindings;
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
        this.state[name] = raw ? raw.trim() : "";
      });
    }
  }

  customElements.define(tagName, ComponentElement);
  logger.log(`Web component defined: <${tagName}></${tagName}>`);
};
