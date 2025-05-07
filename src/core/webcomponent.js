import { logger } from "../utils/logger.js";
import { stringify } from "../utils/stringify.js";

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
      this.stringify = stringify;
      // initialize state and bindings
      const internalState = {};
      this.state = new Proxy(internalState, {
        set: (target, prop, value) => {
          target[prop] = value;
          // automatically re-render on any direct assignment
          this._render();
          return true;
        },
      });
      this._bindings = [];
      this._eventBindings = [];
      this._conditionals = [];

      this._initObservers();
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
      console.log("Component disconnected:", this.tagName);
      // clean up the attribute observer
      this.observer.disconnect();
      // remove all event listeners we added
      this._eventBindings.forEach(({ element, event, listener }) => {
        element.removeEventListener(event, listener);
      });
      this._eventBindings = [];
    }

    _initObservers() {
      // attribute observer
      this.observer = this._createObserver(
        (mutations) => {
          mutations.forEach((m) => {
            if (m.type === "attributes") {
              const name = m.attributeName;
              const value = this.getAttribute(name);
              this._handleAttributeChange(name, value);
            }
          });
        },
        this,
        { attributes: true, attributeOldValue: true }
      );

      // contenteditable observer
      this.elementObserver = this._createObserver(
        (mutations) => {
          for (const m of mutations) {
            if (m.attributeName === "contenteditable") {
              const el = /** @type {HTMLElement} */ (m.target);
              if (el.isContentEditable && el.hasAttribute("data-bind")) {
                this._bindTwoWayForElement(el);
              }
            }
          }
        },
        this.root,
        {
          attributes: true,
          subtree: true,
          attributeFilter: ["contenteditable"],
        }
      );
    }

    // creates a MutationObserver and binds it to the target element
    _createObserver(callback, target, options) {
      const obs = new MutationObserver(callback.bind(this));
      obs.observe(target, options);
      return obs;
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
      this._scanConditionals();
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
          // arrow => (e) => …
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

    // scans the template for conditional elements and stores them in this._conditionals
    // e.g. data-if, data-else-if, data-else
    _scanConditionals() {
      // clear and prepare placeholders
      this._conditionals = [];
      const nodes = Array.from(
        this.root.querySelectorAll("[data-if], [data-else-if], [data-else]")
      );
      let group = [];
      nodes.forEach((el) => {
        const isIf = el.hasAttribute("data-if");
        if (isIf && group.length) {
          this._conditionals.push(group);
          group = [];
        }
        const type = isIf
          ? "if"
          : el.hasAttribute("data-else-if")
          ? "else-if"
          : "else";

        const expr =
          type === "else"
            ? null
            : el.getAttribute(type === "if" ? "data-if" : "data-else-if");
        const placeholder = document.createComment(`ladrillos-${type}`);
        // insert placeholder, detach the real node
        el.parentNode.insertBefore(placeholder, el);
        el.remove();
        group.push({ el, type, expr, placeholder });
      });
      if (group.length) {
        this._conditionals.push(group);
      }
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

    /**
     * Set a nested value on this.state and re-render.
     * @param {string} path  dot-delimited path
     * @param {*} value
     */
    _setNestedState(path, value) {
      const keys = path.split(".");
      let target = this.state;

      // walk/create intermediate objects
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (typeof target[k] !== "object" || target[k] === null) {
          target[k] = {};
        }
        target = target[k];
      }
      // set the leaf
      target[keys[keys.length - 1]] = value;
      this._render();
    }

    _bindTwoWayForElement(el) {
      const key = el.getAttribute("data-bind");
      const isEditable = el.isContentEditable;
      const isFormEl = "value" in el;
      const eventType = isEditable || isFormEl ? "input" : "change";

      // listener to sync UI → state
      const listener = () => {
        const newVal = isEditable
          ? el.innerText
          : isFormEl
          ? el.value
          : el.textContent;
        this._setNestedState(key, newVal);
      };

      el.addEventListener(eventType, listener);
      this._eventBindings.push({ element: el, event: eventType, listener });

      // add a binding so render() keeps it in sync
      const attrName = isFormEl ? "value" : undefined;
      const template = isFormEl
        ? el.getAttribute("value") || `{${key}}`
        : isEditable
        ? el.innerHTML
        : el.textContent;
      this._bindings.push({ element: el, key, attrName, template });

      // initialize the state for that key if not already set
      const initVal = isFormEl
        ? el.value
        : isEditable
        ? el.innerText
        : el.textContent;
      this.state = Object.assign({}, this.state, {}); // force proxy
      this._setNestedState(key, initVal);
    }

    // sets up two-way bindings for editable elements
    // e.g. <input data-bind="name" value="{name}">
    _setupTwoWayBindings() {
      const elems = this.root.querySelectorAll("[data-bind]");
      const initialState = {};

      // helper to build nested objects by path
      const assignNested = (obj, path, value) => {
        const keys = path.split(".");
        let target = obj;
        for (let i = 0; i < keys.length - 1; i++) {
          const k = keys[i];
          if (typeof target[k] !== "object" || target[k] === null) {
            target[k] = {};
          }
          target = target[k];
        }
        target[keys[keys.length - 1]] = value;
      };

      // 1) collect all initial values from the DOM
      elems.forEach((el) => {
        const key = el.getAttribute("data-bind");
        const isEditable = el.isContentEditable;
        const isFormEl = "value" in el;
        const initVal = isEditable
          ? el.innerText.trim()
          : isFormEl
          ? el.value
          : el.textContent.trim();
        assignNested(initialState, key, initVal);
      });

      // 2) seed state once (this.render() will pick up these values)
      this.setState(initialState);

      // 3) now hook up two-way binding on each element
      elems.forEach((el) => {
        this._bindTwoWayForElement(el);
      });
    }

    // renders the component by replacing the bindings with their values
    // and executing the event handlers
    _render() {
      this._applyConditionals();

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
        // support nested paths like "test.user.name"
        const val =
          key.split(".").reduce((obj, segment) => obj?.[segment], this.state) ??
          "";

        if (el.isContentEditable) {
          if (el.innerText !== val) el.innerText = val;
        } else if ("value" in el) {
          if (el.value !== val) el.value = val;
        } else {
          if (el.textContent !== val) el.textContent = val;
        }
      });
    }

    // applies the conditionals to the elements
    _applyConditionals() {
      this._conditionals.forEach((group) => {
        let matched = false;
        group.forEach(({ el, type, expr, placeholder }) => {
          let shouldShow = false;
          if (type === "else") {
            shouldShow = !matched;
          } else {
            try {
              shouldShow = Function(
                "state",
                `with(state){return(${expr})}`
              )(this.state);
            } catch {
              shouldShow = false;
            }
          }
          if (shouldShow && !matched) {
            // mount
            if (!el.isConnected && placeholder.parentNode) {
              placeholder.parentNode.insertBefore(el, placeholder.nextSibling);
            }
            placeholder.remove();
            matched = true;
          } else {
            // unmount
            if (el.isConnected && el.parentNode) {
              el.parentNode.insertBefore(placeholder, el);
              el.remove();
            }
          }
        });
      });
    }

    // replaces the template with the data values
    // e.g. {name} => "John Doe"
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
          composed: true,
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
