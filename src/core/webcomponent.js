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
      this._render();
    }

    handleAttributeChange(name, value) {
      this._render();
    }

    disconnectedCallback() {
      // clean up the attribute observer
      this.observer.disconnect();
      // remove all event listeners we added
      this._eventBindings.forEach(({ element, event, listener }) => {
        element.removeEventListener(event, listener);
      });
      this._eventBindings = [];
    }

    _loadTemplate() {
      if (useShadowDOM) {
        this.shadowRoot.innerHTML = template;
      } else {
        this.innerHTML = template;
      }
      this._scanBindings();
    }

    _scanBindings() {
      const walker = document.createTreeWalker(
        this.shadowRoot,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      let node;
      while ((node = walker.nextNode())) {
        const matches = [...node.textContent.matchAll(/{([^}]+)}/g)];
        if (matches.length) {
          const group = matches.map(([, key]) => ({
            node,
            template: node.textContent,
            key: key.trim(),
          }));
          this._bindings.push(group);
        }
      }

      this._getEventBindings();
    }

    _getEventBindings() {
      const root = this.shadowRoot ?? this;
      root.querySelectorAll("*").forEach((el) => {
        Array.from(el.attributes).forEach((attr) => {
          if (!attr.name.startsWith("on")) return;
          const eventType = attr.name.slice(2);
          const handlerCode = attr.value;
          el.removeAttribute(attr.name);

          // create and keep a reference to the listener
          const listener = (event) => {
            if (handlerCode.includes("(")) {
              new Function(`return ${handlerCode}`).call(this);
            } else {
              if (typeof this[handlerCode] === "function") {
                this[handlerCode](event);
              } else if (typeof this.state[handlerCode] === "function") {
                this.state[handlerCode](event);
              }
            }
          };

          el.addEventListener(eventType, listener);

          // store the element, event type and listener reference
          this._eventBindings.push({
            key: handlerCode,
            element: el,
            event: eventType,
            listener,
          });
        });
      });
    }

    _render() {
      this.getAttributeNames().forEach((name) => {
        this.state[name] = this.getAttribute(name);
      });

      this._bindings.forEach((binding) => {
        if (Array.isArray(binding)) {
          const { node, template } = binding[0];
          const data = {};
          binding.forEach(({ key }) => {
            data[key] = this.state[key] ?? "";
          });
          node.textContent = this._renderTemplate(template, data);
        } else {
          // backwards‑compat single key (if any)
          const { node, template, key } = binding;
          const data = { [key]: this.state[key] ?? "" };
          node.textContent = this._renderTemplate(template, data);
        }
      });
    }

    _renderTemplate(template, data) {
      return template.replace(/\{\s*([\w.]+)\s*}/g, (_, key) => {
        let value = data[key];

        // if the data value is a function, call it (in component context)
        if (typeof value === "function") {
          try {
            value = value.call(this);
          } catch (e) {
            value = "";
          }
        }

        // fall back to empty string for null/undefined
        return value != null ? value : "";
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
      for (const s of externalScripts) {
        if (s.type === "component") {
          const res = await fetch(s.src);
          const srcText = await res.text();
          const varRegex =
            /(?:const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*([\s\S]+?);/g;
          const arrowBodyRegex = /=>\s*{([\s\S]*)};/g;
          let match;
          let varName;
          while ((match = varRegex.exec(srcText)) !== null) {
            varName = match[1].trim();
            const varValueExpr = match[2].trim();
            let varValue;

            // evaluate the variable value expression in the component context
            try {
              varValue = new Function(`return (${varValueExpr});`).call(this);
            } catch (e) {
              // fallback to the raw string if evaluation fails
              while ((match = arrowBodyRegex.exec(srcText)) !== null) {
                const varValueExpr = match[1].trim();

                try {
                  varValue = new Function(`${varValueExpr}`).bind(this);
                } catch (e) {
                  console.error(e);
                  varValue = varValueExpr;
                }
              }
            }

            if (this._eventBindings.some(({ key }) => key === varName)) {
              this.state[varName] = varValue;
            }

            if (
              this._bindings.some((b) =>
                Array.isArray(b)
                  ? b.some(({ key }) => key === varName)
                  : b.key === varName
              )
            ) {
              this.state[varName] = varValue;
            }
          }

          new Function(srcText).call(this);
        } else {
          await new Promise((resolve, reject) => {
            const ext = document.createElement("script");
            ext.src = s.src;
            if (s.type) ext.type = s.type;
            ext.onload = () => {
              resolve();
            };
            ext.onerror = reject;
            document.head.appendChild(ext);
          });
        }
      }

      scripts.forEach((s) => {
        if (s.type === "module") {
          const moduleEl = document.createElement("script");
          moduleEl.type = "module";
          moduleEl.textContent = s.content;
          (this.shadowRoot ?? this).appendChild(moduleEl);
        } else {
          // extract all variables from the script and bindings along with there values
          const varRegex =
            /(?:const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*([\s\S]+?);/g;
          const arrowBodyRegex = /=>\s*{([\s\S]*)};/g;
          let match;
          while ((match = varRegex.exec(s.content)) !== null) {
            const varName = match[1];
            const varValueExpr = match[2].trim();
            let varValue;

            // evaluate the variable value expression in the component context
            try {
              varValue = new Function(`return (${varValueExpr});`).call(this);
            } catch (e) {
              // fallback to the raw string if evaluation fails
              while ((match = arrowBodyRegex.exec(srcText)) !== null) {
                const varValueExpr = match[1].trim();

                try {
                  varValue = new Function(`${varValueExpr}`).bind(this);
                } catch (e) {
                  console.error(e);
                  varValue = varValueExpr;
                }
              }
            }

            if (this._eventBindings.some(({ key }) => key === varName)) {
              this.state[varName] = varValue;
            }

            if (
              this._bindings.some((b) =>
                Array.isArray(b)
                  ? b.some(({ key }) => key === varName)
                  : b.key === varName
              )
            ) {
              this.state[varName] = varValue;
            }
          }

          new Function(s.content).call(this);
        }
      });

      this._render();
    }

    // --- public APIs
    setState(partial) {
      Object.assign(this.state, partial);
      this._render();
    }

    querySelector(selector) {
      if (useShadowDOM) {
        return this.shadowRoot.querySelector(selector);
      } else {
        return this.querySelector(selector);
      }
    }

    querySelectorAll(selector) {
      if (useShadowDOM) {
        return this.shadowRoot.querySelectorAll(selector);
      } else {
        return this.querySelectorAll(selector);
      }
    }
  }

  customElements.define(tagName, ComponentElement);
  logger.log(`Web component defined: <${tagName}></${tagName}>`);
};
