import { LadrillosComponent, StringifyFunction } from "../types/LadrilloTypes";
import { logger } from "../utils/logger";
import { stringify } from "../utils/stringify";
import { scanBindings } from "./bindings";
import { loadComponentScript, loadExternalScripts } from "./scriptHandler";

export const defineWebComponent = (
  component: LadrillosComponent,
  useShadowDOM: boolean
) => {
  const { tagName, template, scripts, externalScripts, style } = component;

  class ComponentElement extends HTMLElement {
    // properties
    public _bindings: unknown[] = [];
    public _eventBindings: unknown[] = [];
    public _conditionals: unknown[] = [];

    stringify: StringifyFunction;
    root: ShadowRoot | HTMLElement;
    state: {};

    constructor() {
      super();
      if (useShadowDOM) this.attachShadow({ mode: "open" });

      this.root = useShadowDOM ? this.shadowRoot! : this;
      this.stringify = stringify;

      // initialize state and bindings
      const internalState: { [key: string]: any } = {};
      this.state = new Proxy(internalState, {
        set: (target, prop, value) => {
          if (typeof prop === "string") {
            target[prop] = value;
            // automatically re-render on any direct assignment
            this._render();
          }
          return true;
        },
      });
    }

    connectedCallback() {
      this._loadTemplate();
      scanBindings(this);
      // this._loadStyles();
      // this._initializeStateFromAttributes();

      // loadExternalScripts(this, externalScripts);
      loadComponentScript(this, scripts);
    }

    // renders the component by replacing the bindings with their values
    _render() {
      console.log(`Rendering component: <${tagName}>`);
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
      const styleElement = document.createElement("style");
      styleElement.textContent = style;
      if (useShadowDOM) {
        this.root.appendChild(styleElement);
      } else {
        document.head.appendChild(styleElement);
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
