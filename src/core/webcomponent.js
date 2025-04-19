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

  /**
   * Extracts all binding placeholders from the given HTML template.
   *
   * Scans the template's innerHTML for patterns like "{propertyName}" and
   * collects a unique, lowercase list of those property names. This list
   * is used to register the component's observedAttributes so that when
   * an attribute changes, the corresponding state key is updated.
   *
   * @param {HTMLTemplateElement} tpl - The template element containing bindings.
   * @returns {string[]} Array of unique binding names for observedAttributes.
   */
  const extractBindings = (tpl) => {
    const regex = /{(.*?)}/g;
    const attrs = new Set();
    let m;
    while ((m = regex.exec(tpl.innerHTML)) !== null) {
      attrs.add(m[1].trim().toLowerCase());
    }
    return Array.from(attrs);
  };

  const componentBindings = extractBindings(template);

  /**
   * Transforms the component script into state‑bound assignments.
   * - Replaces local declarations (const/let/var) with `state.<name> = …`
   * - Converts standalone function declarations into
   *   `state.<fnName> = function (…) { … }`
   *
   * This ensures that any data or methods defined in the component script
   * are attached directly to the reactive state object.
   */
  const cleanedScript = script
    .replace(/\b(?:const|let|var)\s+([\w$]+)\s*=/g, "state.$1 =")
    .replace(/function\s+([\w$]+)\s*\(/g, "state.$1 = function (");

  /**
   * Creates the component’s initialization function.
   * If a script is provided, it wraps `cleanedScript` in a `with(state){…}` block
   * so that property assignments and method definitions apply to the state.
   * If no script is supplied, returns a no‑op function.
   *
   * @type {(state: Record<string, any>) => void}
   */
  const initFn = script
    ? new Function("state", `with(state){${cleanedScript}}`)
    : () => {};

  // Process the template to extract event bindings
  const eventBindings = [];
  template.content.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (!attr.name.startsWith("on")) return;
      const evt = attr.name.slice(2);
      const m = attr.value.match(/{\s*([\w$]+)\(\)\s*}/);
      if (!m) return;
      const fnName = m[1];
      // mark the element in the template
      el.dataset._evtIndex = eventBindings.length;
      eventBindings.push({ evt, fnName });
      el.removeAttribute(attr.name);
    });
  });

  /**
   * Core class for all LadrillosJS components.
   * Extends HTMLElement to provide reactive state, templating and event binding.
   */
  class ComponentElement extends HTMLElement {
    constructor() {
      super();
      if (useShadowDOM) this.attachShadow({ mode: "open" });
      this.state = {}; // Initialize state
      this.styleElement = document.createElement("style");
      this.styleElement.textContent = style || "";

      // track text‐bindings
      this._textBindings = {};
      // store original template text for each node
      this._origText = new Map();
    }

    /**
     * Called when element is inserted into the DOM.
     * - Initializes reactive state
     * - Runs user script to populate state
     * - Processes template bindings
     * - Appends style + content to (shadow) root
     */
    connectedCallback() {
      // reset rendering state
      this._textBindings = {};
      this._origText = new Map();
      // Clone template content
      const templateContent = template.content.cloneNode(true);
      // empty state
      this.state = createReactiveState(this, {});

      this._initializing = true;

      // Run script to populate state
      try {
        initFn.call(this, this.state);
      } catch (e) {
        console.error("Error initializing component script:", e);
      } finally {
        this._initializing = false;
      }

      this._processTemplate(templateContent);

      if (this.shadowRoot) {
        // Add the style element first
        this.shadowRoot.appendChild(this.styleElement);
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

      // Iterate over all text nodes and replace bindings
      textNodes.forEach((node) => {
        const text = node.textContent;
        if (text.includes("{") && text.includes("}")) {
          this._origText.set(node, text);

          node.textContent = text.replace(/{([^}]+)}/g, (match, key) => {
            key = key.trim();
            this._textBindings[key] = this._textBindings[key] || [];
            this._textBindings[key].push(node);

            if (this.hasAttribute(key)) {
              return this.getAttribute(key);
            } else if (this.state[key] !== undefined) {
              return this.state[key];
            }
            return match;
          });
        }
      });

      // handle event bindings
      eventBindings.forEach((b, idx) => {
        const el = content.querySelector(`[data-_evt-index="${idx}"]`);
        el.removeAttribute("data-_evt-index");
        el.addEventListener(b.evt, (e) => {
          const fn = this.state[b.fnName];
          if (typeof fn === "function") {
            // call the handler with the element as `this`
            fn.call(el, e);
          }
        });
      });
    }

    /**
     * Retrieve all text nodes under a given root node.
     *
     * @param {Node} node
     * @returns {Text[]}
     */
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

    /**
     * clears previous DOM, re-processes template and styles.
     * Usually called by reactive state on mutation.
     */
    _update() {
      const tpl = template.content.cloneNode(true);
      this._processTemplate(tpl);

      if (this.shadowRoot) {
        this.shadowRoot.innerHTML = "";
        this.shadowRoot.appendChild(this.styleElement);
        this.shadowRoot.appendChild(tpl);
      } else {
        this.innerHTML = "";
        this.appendChild(this.styleElement);
        this.appendChild(tpl);
      }
    }

    // only update the nodes bound to a single key
    _updateBinding(key) {
      (this._textBindings[key] || []).forEach((node) => {
        const orig = this._origText.get(node) || "";
        node.textContent = orig.replace(/{([^}]+)}/g, (match, k) => {
          k = k.trim();
          if (this.hasAttribute(k)) {
            return this.getAttribute(k);
          }
          return this.state[k];
        });
      });
    }

    /**
     * Called when the element is removed from the DOM
     */
    disconnectedCallback() {
      logger.log("disconnectedCallback", this);
    }

    // property
    static get observedAttributes() {
      return componentBindings; // Return the attributes to be observed
    }

    /**
     * Called when one of the observed attributes changes.
     * Updates state and triggers a re-render via the reactive proxy.
     *
     * @param {string} name
     * @param {string} oldVal
     * @param {string} newVal
     */
    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal !== newVal) {
        this.state[name] = newVal;
      }
    }

    /**
     * Dispatch a custom event from the component.
     *
     * @param {string} name  Event name
     * @param {*} [detail]   Payload; defaults to full component state
     */
    emit(name, detail) {
      const data = detail ?? this.state;

      this.dispatchEvent(
        new CustomEvent(name, {
          detail: data,
          bubbles: true,
        })
      );
    }
  }

  customElements.define(tagName, ComponentElement);
  logger.log(`Web component defined: <${tagName}></${tagName}>`);
};
