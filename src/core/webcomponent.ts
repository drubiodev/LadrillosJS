import {
  BindingDescriptor,
  LadrillosComponent,
  TwoWayBindingDescriptor,
  ConditionalDescriptor,
} from "../types/LadrilloTypes";
import { logger } from "../utils/logger";
import { loadStyles } from "./css/cssParser";
import { loadTemplate, extractConditionalVariables } from "./html/htmlparser";
import {
  renderBindings,
  setValue,
  renderConditionals,
} from "./html/htmlRenderer";
import { loadExternalScripts, loadScripts } from "./js/scriptParser";

export const defineWebComponent = (
  component: LadrillosComponent,
  useShadowDOM: boolean
) => {
  const { tagName, template, scripts, externalScripts, styles, sourcePath } =
    component;

  class ComponentElement extends HTMLElement {
    state: any;
    #bindings: BindingDescriptor[] = [];
    #twoWayBindings: TwoWayBindingDescriptor[] = [];
    #conditionals: ConditionalDescriptor[][] = [];
    #twoWayBindingCleanups: Array<() => void> = [];
    #sourcePath: string | undefined = sourcePath;

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

          // Auto-create property descriptor on component for direct access in with() scope
          if (!Object.getOwnPropertyDescriptor(this, prop)) {
            Object.defineProperty(this, prop, {
              get() {
                return this.state[prop];
              },
              set(val) {
                this.state[prop] = val;
              },
              enumerable: true,
              configurable: true,
            });
          }

          // Re-render all bindings with the updated state
          renderBindings(this.#bindings, this.state, this);
          // Re-render conditionals
          renderConditionals(this.#conditionals, this.state, this);
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
      const { bindings, twoWayBindings, conditionals } = loadTemplate(
        host,
        template
      );
      this.#bindings = bindings;
      this.#twoWayBindings = twoWayBindings;
      this.#conditionals = conditionals;

      // Extract variables used in conditional expressions
      const conditionalVars = extractConditionalVariables(conditionals);

      // Inject component styles
      loadStyles(host, styles, useShadowDOM);

      // Sync initial state from HTML attributes (e.g., <my-component name="value">)
      this._initializeStateFromAttributes();

      // Setup two-way bindings
      this._setupTwoWayBindings();

      // Load external scripts first (e.g., CDN libraries like highlight.js)
      // so they're available when inline scripts execute
      await loadExternalScripts(
        host,
        externalScripts,
        this.#bindings,
        this.#twoWayBindings,
        conditionalVars,
        this.#sourcePath
      );

      // Execute component scripts (event handlers, methods, etc.)
      // Pass conditional variables so they get mapped to state
      await loadScripts(
        host,
        scripts,
        this.#bindings,
        this.#twoWayBindings,
        conditionalVars
      );

      // Perform initial render with current state values (after scripts are ready)
      renderBindings(this.#bindings, this.state, this);
      renderConditionals(this.#conditionals, this.state, this);

      // Set up MutationObserver to watch for attribute changes
      this._setupAttributeObserver();
    }

    // Invoked when element is removed from the DOM
    disconnectedCallback() {
      // Clean up MutationObserver
      if ((this as any).__attributeObserver) {
        (this as any).__attributeObserver.disconnect();
        (this as any).__attributeObserver = null;
      }

      // Clean up two-way binding event listeners
      this.#twoWayBindingCleanups.forEach((cleanup) => {
        try {
          cleanup();
        } catch (error) {
          console.error("Error cleaning up two-way binding:", error);
        }
      });
      this.#twoWayBindingCleanups = [];

      // Clean up EventBus subscriptions
      const unsubscribers = (this as any).__eventUnsubscribers;
      if (unsubscribers && Array.isArray(unsubscribers)) {
        unsubscribers.forEach((unsub: () => void) => {
          try {
            unsub();
          } catch (error) {
            console.error("Error unsubscribing from event:", error);
          }
        });
        (this as any).__eventUnsubscribers = [];
      }
    }

    // Set up observer to watch for attribute changes
    _setupAttributeObserver() {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "attributes" && mutation.attributeName) {
            const newValue = this.getAttribute(mutation.attributeName);
            this._handleAttributeChange(mutation.attributeName, newValue);
          }
        });
      });

      observer.observe(this, {
        attributes: true,
        attributeOldValue: true,
      });

      (this as any).__attributeObserver = observer;
    }

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
      this.#twoWayBindings.forEach(
        ({ element, path, raw, isContentEditable }) => {
          // Initialize state property if it doesn't exist
          const currentValue = this._getNestedValue(path);
          if (currentValue === undefined) {
            setValue(this.state, path, "");
          }

          if (isContentEditable) {
            // Handle contenteditable elements
            const contentEditableEl = element as HTMLElement;

            // Initial sync from state to element
            contentEditableEl.textContent = this._getNestedValue(path) ?? "";

            // Listen for input changes and update state
            const handleInput = (e: Event) => {
              const target = e.target as HTMLElement;
              const newValue = target.textContent || "";

              // Update state using setValue to handle nested paths
              setValue(this.state, path, newValue);
            };

            contentEditableEl.addEventListener("input", handleInput);

            // Store cleanup function
            const cleanup = () => {
              contentEditableEl.removeEventListener("input", handleInput);
            };
            this.#twoWayBindingCleanups.push(cleanup);
          } else {
            // Handle form input elements
            const inputEl = element as
              | HTMLInputElement
              | HTMLTextAreaElement
              | HTMLSelectElement;

            // Initial sync from state to element
            inputEl.value = this._getNestedValue(path) ?? "";

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

            inputEl.addEventListener("input", handleInput);

            // Store cleanup function for 'input' listener
            const cleanupInput = () => {
              inputEl.removeEventListener("input", handleInput);
            };
            this.#twoWayBindingCleanups.push(cleanupInput);

            // For select and certain input types, also listen to 'change'
            if (
              inputEl instanceof HTMLSelectElement ||
              (inputEl instanceof HTMLInputElement &&
                ["checkbox", "radio", "file"].includes(inputEl.type))
            ) {
              inputEl.addEventListener("change", handleInput);

              // Store cleanup function for 'change' listener
              const cleanupChange = () => {
                inputEl.removeEventListener("change", handleInput);
              };
              this.#twoWayBindingCleanups.push(cleanupChange);
            }
          }
        }
      );
    }

    // Update two-way bound elements when state changes
    #updateTwoWayBindings() {
      this.#twoWayBindings.forEach(({ element, path, isContentEditable }) => {
        const value = this._getNestedValue(path);

        if (isContentEditable) {
          const contentEditableEl = element as HTMLElement;
          if (contentEditableEl.textContent !== value) {
            contentEditableEl.textContent = value ?? "";
          }
        } else {
          const inputEl = element as
            | HTMLInputElement
            | HTMLTextAreaElement
            | HTMLSelectElement;
          if (inputEl.value !== value) {
            inputEl.value = value ?? "";
          }
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
