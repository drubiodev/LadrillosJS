import { BindingDescriptor, LadrillosComponent } from "../types/LadrilloTypes";
import { logger } from "../utils/logger";
import { loadStyles } from "./css/cssParser";
import { loadTemplate } from "./html/htmlParser";
import { renderBindings } from "./html/htmlRenderer";
import { loadScripts } from "./js/scriptParser";

export const defineWebComponent = (
  component: LadrillosComponent,
  useShadowDOM: boolean
) => {
  const { tagName, template, scripts, externalScripts, styles } = component;

  class ComponentElement extends HTMLElement {
    state: any;
    #bindings: BindingDescriptor[] = [];

    constructor() {
      super();
      if (useShadowDOM) this.attachShadow({ mode: "open" });

      const internalState: any = {};
      this.state = new Proxy(internalState, {
        set: (target, prop, value) => {
          const prev = target[prop as keyof typeof target];
          if (Object.is(prev, value)) return true;

          target[prop as keyof typeof target] = value;
          renderBindings(this.#bindings, this.state);
          return true;
        },
      });
    }

    static #parseAttributeValue(raw: string | null) {
      if (raw === null || raw === "") return null;
      if (raw === "undefined") return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }

    // Invoked when element is added to the DOM
    connectedCallback() {
      const host = useShadowDOM ? this.shadowRoot! : this;

      this.#bindings = loadTemplate(host, template);
      loadStyles(host, styles, useShadowDOM);
      this._initializeStateFromAttributes();
      renderBindings(this.#bindings, this.state);

      loadScripts(host, scripts);
    }
    // Invoked when element is removed from the DOM
    disconnectedCallback() {}
    // Invoked when attributes are changed
    attributechangedCallback() {}

    // initializes the state from the attributes
    _initializeStateFromAttributes() {
      this.getAttributeNames().forEach((name) => {
        const raw = this.getAttribute(name);
        this._handleAttributeChange(name, raw);
      });
    }

    // Invoked when attributes are changed.
    _handleAttributeChange(name: string, raw: string | null) {
      if (name) {
        // remove "this.state." prefix if it exists
        const STATE_PREFIX = "this.state.";
        if (name.startsWith(STATE_PREFIX)) {
          name = name.slice(STATE_PREFIX.length);
        }
      }
      const value = ComponentElement.#parseAttributeValue(raw);
      this.state[name] = value;
    }
  }

  customElements.define(tagName, ComponentElement);
  logger.log(`Web component defined: <${tagName}></${tagName}>`);
};
