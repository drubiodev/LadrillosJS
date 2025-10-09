import {
  BindingDescriptor,
  LadrillosComponent,
  TwoWayBindingDescriptor,
} from "../types/LadrilloTypes";
import { logger } from "../utils/logger";
import { loadStyles } from "./css/cssParser";
import { loadTemplate } from "./html/htmlparser";
import { renderBindings, setValue } from "./html/htmlRenderer";
import { loadExternalScripts, loadScripts } from "./js/scriptParser";

export const defineWebComponent = (
  component: LadrillosComponent,
  useShadowDOM: boolean
) => {
  const { tagName, template, scripts, externalScripts, styles } = component;

  class ComponentElement extends HTMLElement {
    state: any;
    #bindings: BindingDescriptor[] = [];
    #twoWayBindings: TwoWayBindingDescriptor[] = [];

    constructor() {
      super();
      if (useShadowDOM) this.attachShadow({ mode: "open" });

      const internalState: any = {};

      // Wrap state in a Proxy to detect changes and trigger re-renders
      this.state = new Proxy(internalState, {
        set: (target, prop, value) => {
          const prev = target[prop as keyof typeof target];
          // Skip update if value hasn't changed (avoids unnecessary re-renders)
          if (Object.is(prev, value)) return true;

          target[prop as keyof typeof target] = value;
          // Re-render all bindings with the updated state
          renderBindings(this.#bindings, this.state, this);
          // Update two-way bound elements
          this.#updateTwoWayBindings();
          return true;
        },
      });
    }
    /**
     * Updates component state with one or more key-value pairs
     * @param updates - Object containing state updates
     * @example
     * component.setState({ count: 5, name: 'John' })
     */
    setState(updates: Record<string, any>): void {
      Object.assign(this.state, updates);
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
    async connectedCallback() {
      const host = useShadowDOM ? this.shadowRoot! : this;

      // Parse template and collect all data binding locations
      const { bindings, twoWayBindings } = loadTemplate(host, template);
      this.#bindings = bindings;
      this.#twoWayBindings = twoWayBindings;

      // Inject component styles
      loadStyles(host, styles, useShadowDOM);

      // Sync initial state from HTML attributes (e.g., <my-component name="value">)
      this._initializeStateFromAttributes();

      // Setup two-way bindings
      this._setupTwoWayBindings();

      // Execute component scripts (event handlers, methods, etc.)
      // Pass twoWayBindings so scripts can access $bind variables directly
      await loadScripts(host, scripts, this.#bindings, this.#twoWayBindings);
      await loadExternalScripts(
        host,
        externalScripts,
        this.#bindings,
        this.#twoWayBindings
      );

      // Perform initial render with current state values (after scripts are ready)
      renderBindings(this.#bindings, this.state, this);
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

    // Setup two-way data bindings for input elements with $bind
    _setupTwoWayBindings() {
      this.#twoWayBindings.forEach(({ element, path, raw }) => {
        // Initialize state property if it doesn't exist
        const currentValue = this._getNestedValue(path);
        if (currentValue === undefined) {
          setValue(this.state, path, "");
        }

        // Initial sync from state to element
        element.value = this._getNestedValue(path) ?? "";

        // Listen for input changes and update state
        const handleInput = (e: Event) => {
          const target = e.target as
            | HTMLInputElement
            | HTMLTextAreaElement
            | HTMLSelectElement;
          const newValue = target.value;

          // Update state using setValue to handle nested paths
          setValue(this.state, path, newValue);
        };

        element.addEventListener("input", handleInput);

        // For select and certain input types, also listen to 'change'
        if (
          element instanceof HTMLSelectElement ||
          (element instanceof HTMLInputElement &&
            ["checkbox", "radio", "file"].includes(element.type))
        ) {
          element.addEventListener("change", handleInput);
        }
      });
    }

    // Update two-way bound elements when state changes
    #updateTwoWayBindings() {
      this.#twoWayBindings.forEach(({ element, path }) => {
        const value = this._getNestedValue(path);
        if (element.value !== value) {
          element.value = value ?? "";
        }
      });
    }

    // Helper to get nested value from state
    _getNestedValue(path: string[]): any {
      return path.reduce((acc, key) => {
        return acc?.[key];
      }, this.state);
    }
  }

  customElements.define(tagName, ComponentElement);
  logger.log(`Web component defined: <${tagName}></${tagName}>`);
};
