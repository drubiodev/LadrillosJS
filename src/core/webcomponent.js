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
      // set root
      this.root = useShadowDOM ? this.shadowRoot : document;
      // initialize state and bindings
      this.state = {};
      this._bindings = [];
      this._eventBindings = [];

      // Set up MutationObserver to watch all attribute changes
      this.observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "attributes") {
            const attributeName = mutation.attributeName;
            const newValue = this.getAttribute(attributeName);
            this._handleAttributeChange(attributeName, newValue);
          }
        });
      });

      this.observer.observe(this, {
        attributes: true, // Watch for attribute changes
        attributeOldValue: true, // Track old values too
      });
    }

    static #parseAttributeValue(raw) {
      if (raw === "") return null;
      if (raw === "undefined") return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }

    // Invoked when the custom element is first connected to the document's DOM.
    connectedCallback() {
      this._loadTemplate();
      this._loadStyles();
      this._loadScript();
      this._initializeStateFromAttributes();
      this._setupTwoWayBindings();
    }

    // Invoked when the custom element is disconnected from the document's DOM.
    disconnectedCallback() {
      // clean up the attribute observer
      this.observer.disconnect();
      // remove all event listeners we added
      this._eventBindings.forEach(({ element, event, listener }) => {
        element.removeEventListener(event, listener);
      });
      this._eventBindings = [];
    }

    // Invoked when attributes are changed.
    _handleAttributeChange(name, raw) {
      const value = ComponentElement.#parseAttributeValue(raw);
      this.state[name] = value;
      this._render();
    }

    // sets template to innerHTML or shadowRoot.innerHTML
    _loadTemplate() {
      if (useShadowDOM) {
        this.shadowRoot.innerHTML = template;
      } else {
        this.innerHTML = template;
      }
      this._scanBindings();
    }

    // scans the template for bindings and event handlers
    // and stores them in this._bindings and this._eventBindings
    _scanBindings() {
      const walker = document.createTreeWalker(
        this.root,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;

      // scan for text nodes with bindings
      // e.g. {name} or {name.first}
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

      // scan for attributes with bindings
      // e.g. data-bind="{name}" or value="{name.first}"
      this.root.querySelectorAll("*").forEach((el) => {
        Array.from(el.attributes).forEach((attr) => {
          const matches = [...attr.value.matchAll(/{([^}]+)}/g)];
          if (matches.length) {
            matches.forEach(([, key]) => {
              this._bindings.push({
                element: el,
                attrName: attr.name,
                template: attr.value,
                key: key.trim(),
              });
            });
          }
        });
      });

      this._getEventBindings();
    }

    // scans the template for event handlers and stores them in this._eventBindings
    // e.g. onclick="handleClick"
    _getEventBindings() {
      this.root.querySelectorAll("*").forEach((el) => {
        Array.from(el.attributes).forEach((attr) => {
          if (!attr.name.startsWith("on")) return;
          const eventType = attr.name.slice(2);
          const handlerCode = attr.value.trim();
          el.removeAttribute(attr.name);

          // create and keep a reference to the listener
          let listener;
          const code = handlerCode.trim();
          // arrow → (e) => …
          if (/^\([^)]*\)\s*=>/.test(code)) {
            const fn = new Function(`return (${code})`).call(this);
            listener = (e) => fn(e);
          } else if (code.includes("(")) {
            listener = () => new Function(`return ${code}`).call(this);
          } else {
            listener = (e) => {
              if (typeof this[code] === "function") {
                this[code](e);
              } else if (typeof this.state[code] === "function") {
                this.state[code](e);
              }
            };
          }

          el.addEventListener(eventType, listener);

          this._eventBindings.push({
            key: handlerCode,
            element: el,
            event: eventType,
            listener,
          });
        });
      });
    }

    // loads the styles into the shadowRoot or document head
    _loadStyles() {
      const styleElement = document.createElement("style");
      styleElement.textContent = style;
      if (useShadowDOM) {
        this.root.appendChild(styleElement);
      } else {
        this.root.head.appendChild(styleElement);
      }
    }

    // loads the external scripts and inline scripts
    // and binds them to the component context
    async _loadScript() {
      // external scripts
      for (const s of externalScripts) {
        const scriptURL = new URL(s.src, import.meta.url).href;
        if (s.type === "module" && s?.bind) {
          try {
            const mod = await import(scriptURL);

            if (typeof mod.default === "function") {
              mod.default.call(this);
            } else if (typeof mod.init === "function") {
              mod.init.call(this);
            } else {
              logger.error(
                `Module ${s.src} does not export a default function or init function.`
              );
            }
          } catch (err) {
            console.error(`Failed to load component module ${s.src}`, err);
          }
        } else if (s?.bind) {
          await fetch(scriptURL)
            .then((response) => response.text())
            .then((text) =>
              this._processScriptText(
                text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").trim()
              )
            );
        } else {
          await this._injectScriptTag(s.src, s.type);
        }
      }

      // inline scripts
      for (const s of scripts) {
        if (s.type === "module") {
          const moduleEl = document.createElement("script");
          moduleEl.type = "module";
          moduleEl.textContent = s.content;
          (this.shadowRoot ?? this).appendChild(moduleEl);
        } else {
          this._processScriptText(s.content);
        }
      }

      this._render();
    }

    // injects a script tag into the document head
    // and returns a promise that resolves when the script is loaded
    _injectScriptTag(src, type) {
      return new Promise((resolve, reject) => {
        const el = document.createElement("script");
        el.src = src;
        if (type) el.type = type;
        el.onload = resolve;
        el.onerror = reject;
        document.head.appendChild(el);
      });
    }

    // initializes the state from the attributes
    _initializeStateFromAttributes() {
      this.getAttributeNames().forEach((name) => {
        const raw = this.getAttribute(name);
        // re‑use your parsing logic
        this._handleAttributeChange(name, raw);
      });
    }

    // sets up two-way bindings for editable elements
    // e.g. <input data-bind="name" value="{name}">
    _setupTwoWayBindings() {
      const elems = this.root.querySelectorAll("[data-bind]");
      const initialState = {};

      elems.forEach((el) => {
        const key = el.getAttribute("data-bind");
        const isEditable = el.isContentEditable;
        const isFormEl = "value" in el;
        const eventType = isEditable || isFormEl ? "input" : "change";

        // keep state in sync with UI
        const listener = () => {
          const newVal = isEditable
            ? el.innerText
            : isFormEl
            ? el.value
            : el.textContent;
          this.setState({ [key]: newVal });
        };

        el.addEventListener(eventType, listener);
        this._eventBindings.push({ element: el, event: eventType, listener });

        // compute attrName & template so render() can replace
        const attrName = isFormEl ? "value" : undefined;
        const template = isFormEl
          ? el.getAttribute("value") || `{${key}}`
          : isEditable
          ? el.innerHTML
          : el.textContent;

        this._bindings.push({ element: el, key, attrName, template });

        initialState[key] = isFormEl
          ? el.value
          : isEditable
          ? el.innerText
          : el.textContent;
      });

      this.setState(initialState);
    }

    // renders the component by replacing the bindings with their values
    // and executing the event handlers
    _render() {
      this._bindings.forEach((binding) => {
        // unify array / single binding
        const items = Array.isArray(binding) ? binding : [binding];
        const { node, template } = items[0];
        if (!node) return;
        // collect data
        const data = {};
        items.forEach(({ key }) => {
          data[key] = this.state[key] ?? "";
        });
        const rendered = this._renderTemplate(template, data);
        const isHTML = /<[a-z][\s\S]*>/i.test(rendered);

        if (isHTML) {
          // build a fragment from the HTML string
          const frag = document
            .createRange()
            .createContextualFragment(rendered);
          if (node.nodeType === Node.TEXT_NODE) {
            // replace the placeholder text node with the fragment
            node.replaceWith(frag);
          } else {
            // if it was an element, just set innerHTML
            node.innerHTML = rendered;
          }
        } else {
          // plain text
          if (node?.nodeType === Node.TEXT_NODE) {
            node.textContent = rendered;
          } else {
            node.textContent = rendered;
          }
        }
      });

      this._bindings
        .filter((b) => b.element)
        .forEach(({ element, attrName, template, key }) => {
          const val = key.split(".").reduce((o, p) => o?.[p], this.state) ?? "";

          const regex = new RegExp(`\\{\\s*${key}\\s*\\}`, "g");
          element.setAttribute(attrName, template.replace(regex, val));
        });

      this.root.querySelectorAll("[data-bind]").forEach((el) => {
        const key = el.getAttribute("data-bind");
        const val = this.state[key] ?? "";
        if (el.isContentEditable) {
          if (el.innerText !== val) el.innerText = val;
        } else if ("value" in el) {
          if (el.value !== val) el.value = val;
        } else {
          if (el.textContent !== val) el.textContent = val;
        }
      });
    }

    // replaces the template with the data values
    // e.g. {name} → "John Doe"
    _renderTemplate(template, data) {
      return template.replace(/\{\s*([-\w.]+)\s*}/g, (_, key) => {
        let value = key
          .split(".")
          .reduce((acc, prop) => acc?.[prop], this.state);

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

    /**
     * Finds all top‑level vars in `srcText`, evaluates them into this.state
     * if they're bound, then execs the script in component context.
     */
    _processScriptText(srcText) {
      const varRegex =
        /(?:const|let|var)\s+([$_A-Za-z][$_A-Za-z0-9]*)\s*=\s*([\s\S]+?);/g;
      const arrowBodyRegex = /=>\s*{([\s\S]*?)};/g;

      // 1) Pull out all top‑level "function name(...) { ... }"
      const funcs = {};
      let scanIdx = 0;
      while ((scanIdx = srcText.indexOf("function ", scanIdx)) !== -1) {
        // match the "function name(...){"
        const sig =
          /^function\s+([$_A-Za-z][$_A-Za-z0-9]*)\s*\([^)]*\)\s*{/.exec(
            srcText.slice(scanIdx)
          );
        if (!sig) {
          scanIdx += 8;
          continue;
        }
        const name = sig[1];
        // find the matching closing brace
        let depth = 0,
          i = scanIdx + sig[0].length - 1;
        do {
          if (srcText[i] === "{") depth++;
          else if (srcText[i] === "}") depth--;
          i++;
        } while (i < srcText.length && depth > 0);
        funcs[name] = srcText.slice(scanIdx, i);
        scanIdx = i;
      }

      // bind any of those functions that are used in bindings/events
      for (const name in funcs) {
        if (this._isBound(name)) {
          try {
            const fn = new Function(`return (${funcs[name]});`)
              .call(this)
              .bind(this);
            this[name] = fn;
          } catch (e) {
            console.error("failed to eval function", name, e);
          }
        }
      }

      let match;
      while ((match = varRegex.exec(srcText))) {
        const [, name, expr] = match;

        if (!this._isBound(name)) continue;
        const value = this._evalExpression(
          expr.trim(),
          srcText,
          arrowBodyRegex,
          name
        );

        if (typeof value === "function") {
          this[name] = value.bind(this);
        } else {
          this.state[name] = value;
        }
      }

      new Function(srcText).call(this);
    }

    // evaluates the expression in the context of the component
    // and returns the result. If it fails, it tries to find the last arrow body
    _evalExpression(expr, fullText, arrowRe, name) {
      try {
        // try as normal JS expr
        return new Function(`return (${expr});`).call(this);
      } catch {
        let m, last;
        while ((m = arrowRe.exec(fullText))) {
          last = m[1].trim();
          if (last) {
            // try to eval the last arrow body as a function
            try {
              return new Function(`${last}`).bind(this);
            } catch (e) {
              console.error(e);
              return last;
            }
          }
        }

        return expr;
      }
    }

    // checks if the variable is bound in the template or event handlers
    // e.g. {name} or onclick="handleClick"
    // or data-bind="name" or value="{name}"
    _isBound(varName) {
      const inEvents = this._eventBindings.some((b) => b.key === varName);
      const inTemplates = this._bindings.some((b) =>
        Array.isArray(b) ? b.some((x) => x.key === varName) : b.key === varName
      );

      return inEvents || inTemplates;
    }

    // --- public APIs

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

    /**
     * Listen for a custom event from the component.
     * @param {string} name  Event name
     * @param {function} handler  Callback function to handle the event
     */
    listen(name, handler) {
      const listener = (e) => handler(e.detail);
      document.addEventListener(name, listener);
      this._eventBindings.push({
        element: document,
        event: name,
        listener,
      });
    }

    /**
     * Set the component state and re-render the component.
     * This method merges the new state with the existing state.
     * It does not replace the entire state object.
     * @param {*} partial
     */
    setState(partial) {
      Object.assign(this.state, partial);
      this._render();
    }

    querySelector(selector) {
      return this.root.querySelector(selector);
    }

    querySelectorAll(selector) {
      return this.root.querySelectorAll(selector);
    }
  }

  customElements.define(tagName, ComponentElement);
  logger.log(`Web component defined: <${tagName}></${tagName}>`);
};
