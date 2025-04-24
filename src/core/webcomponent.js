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
  const { tagName, template, scripts, externalScripts, style } = component;

  /**
   * Core class for all LadrillosJS components.
   * Extends HTMLElement to provide reactive state, templating and event binding.
   */
  class ComponentElement extends HTMLElement {
    constructor() {
      super();
      if (useShadowDOM) this.attachShadow({ mode: "open" });
      this.state = {};
      this._bindings = [];
      this._eventBindings = [];

      // Set up MutationObserver to watch all attribute changes
      this.observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "attributes") {
            const attributeName = mutation.attributeName;
            const newValue = this.getAttribute(attributeName);
            this.handleAttributeChange(attributeName, newValue);
          }
        });
      });

      // Start observing with configuration
      this.observer.observe(this, {
        attributes: true, // Watch for attribute changes
        attributeOldValue: true, // Track old values too
      });

      this._render();
    }

    connectedCallback() {
      this._loadTemplate();
      this._loadStyles();
      this._loadScript();
    }

    handleAttributeChange(name, value) {
      this._render();
    }

    disconnectedCallback() {
      // Clean up the observer when element is removed
      this.observer.disconnect();
    }

    _loadTemplate() {
      if (useShadowDOM) {
        this.shadowRoot.innerHTML = template;
      } else {
        this.innerHTML = template;
      }
      this._scanBindings();
      this._render();
    }

    _scanBindings() {
      // 1) text bindings {prop}
      const walker = document.createTreeWalker(
        this.shadowRoot,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      let node;
      while ((node = walker.nextNode())) {
        const m = node.textContent.match(/{\s*([\w.]+)\s*}/);
        if (m) {
          this._bindings.push({
            node,
            template: node.textContent,
            key: m[1],
          });
        }
      }
      // 2) event bindings data-on<event>="handler"
      this._getEventBindings();
    }

    _getEventBindings() {
      const root = this.shadowRoot ?? this;
      root.querySelectorAll("*").forEach((el) => {
        Array.from(el.attributes).forEach((attr) => {
          if (!attr.name.startsWith("on")) return;

          const eventType = attr.name.slice(2); // "onclick" -> "click"
          const handlerCode = attr.value;

          // Remove the original attribute
          el.removeAttribute(attr.name);

          // Handle both function references and function calls
          el.addEventListener(eventType, (event) => {
            // Check if it's a direct function reference or a function call
            if (handlerCode.includes("(")) {
              // It's a function call like "hola()" or "setName('Daniel')"
              // Create a function that executes the code in component context
              new Function(`return ${handlerCode}`).call(this);
            } else {
              // It's a function reference like "increment" or "sayHello"
              if (typeof this[handlerCode] === "function") {
                this[handlerCode](event);
              } else if (typeof this.state[handlerCode] === "function") {
                this.state[handlerCode](event);
              }
            }
          });

          this._eventBindings.push({
            element: el,
            event: eventType,
            handler: handlerCode,
          });
        });
      });
    }

    _render() {
      this.getAttributeNames().forEach((name) => {
        this.state[name] = this.getAttribute(name);
      });

      this._bindings.forEach(({ node, template, key }) => {
        const val = this.state[key] ?? "";
        node.textContent = template.replace(/{\s*[\w.]+\s*}/, val);
      });
    }

    _loadStyles() {
      const styleElement = document.createElement("style");
      styleElement.textContent = style;
      if (useShadowDOM) {
        this.shadowRoot.appendChild(styleElement);
      } else {
        this.appendChild(styleElement);
      }
    }

    async _loadScript() {
      // 1) load external scripts sequentially
      for (const s of externalScripts) {
        if (s.type === "component") {
          // fetch and run in the context of this component
          const res = await fetch(s.src);
          const srcText = await res.text();
          new Function(srcText).call(this);
          logger.log(`Executed component‑scoped script: ${s.src}`);
        } else {
          await new Promise((resolve, reject) => {
            const ext = document.createElement("script");
            ext.src = s.src;
            if (s.type) ext.type = s.type;
            ext.onload = () => {
              logger.log(`Loaded external script: ${s.src}`);
              resolve();
            };
            ext.onerror = reject;
            document.head.appendChild(ext);
          });
        }
      }

      // 2) execute inline scripts with proper `this`
      scripts.forEach((s) => {
        if (s.type === "module") {
          const moduleEl = document.createElement("script");
          moduleEl.type = "module";
          moduleEl.textContent = s.content;
          (this.shadowRoot ?? this).appendChild(moduleEl);
        } else {
          new Function(s.content).call(this);
        }
      });
    }

    // --- public APIs
    setState(partial) {
      Object.assign(this.state, partial);
      this._render();
    }

    bindMethod(name, fn) {
      this[name] = fn.bind(this);
      return this;
    }
  }

  customElements.define(tagName, ComponentElement);
  logger.log(`Web component defined: <${tagName}></${tagName}>`);
};
