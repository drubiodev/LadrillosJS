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
      this.root = useShadowDOM ? this.shadowRoot : document;
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

      // this._render();
    }

    connectedCallback() {
      this._loadTemplate();
      this._loadStyles();
      this._loadScript();
      this._initializeStateFromAttributes();
      // this._render();
    }

    handleAttributeChange(name, value) {
      // sync the changed attribute into state, then re‐render

      if (value && value.startsWith("{") && value.endsWith("}")) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          logger.error(`Failed to parse JSON for attribute ${name}`, e);
        }
      } else if (value && value.startsWith("[")) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          logger.error(`Failed to parse JSON for attribute ${name}`, e);
        }
      } else if (value === "true") {
        value = true;
      } else if (value === "false") {
        value = false;
      } else if (value === "null") {
        value = null;
      } else if (value === "undefined") {
        value = undefined;
      } else if (!isNaN(value)) {
        value = parseFloat(value);
      } else if (value === "") {
        value = null;
      } else if (value === "[]") {
        value = [];
      } else if (value === "{}") {
        value = {};
      }

      this.state[name] = value;
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
        this.root,
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

    _initializeStateFromAttributes() {
      this.getAttributeNames().forEach((name) => {
        const raw = this.getAttribute(name);
        // re‑use your parsing logic
        this.handleAttributeChange(name, raw);
      });
    }

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
    }

    _renderTemplate(template, data) {
      return template.replace(/\{\s*([-\w.]+)\s*}/g, (_, key) => {
        const value = key
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

    _loadStyles() {
      const styleElement = document.createElement("style");
      styleElement.textContent = style;
      if (useShadowDOM) {
        this.root.appendChild(styleElement);
      } else {
        this.root.head.appendChild(styleElement);
      }
    }

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

    _isBound(varName) {
      const inEvents = this._eventBindings.some((b) => b.key === varName);
      const inTemplates = this._bindings.some((b) =>
        Array.isArray(b) ? b.some((x) => x.key === varName) : b.key === varName
      );

      return inEvents || inTemplates;
    }

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
