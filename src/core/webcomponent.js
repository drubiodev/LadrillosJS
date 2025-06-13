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
      // this._functions = new Map();

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
      this._initializeStateFromAttributes();
      this._loadScript();
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
      if (name) {
        // remove "this.state." prefix if it exists
        const STATE_PREFIX = "this.state.";
        if (name.startsWith(STATE_PREFIX)) {
          name = name.slice(STATE_PREFIX.length);
        }
      }
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

          // Case 1: Inline arrow function e.g., onclick="(event) => console.log(event.target)"
          if (/^\([^)]*\)\s*=>/.test(code)) {
            try {
              const funcCreator = new Function("event", `return (${code});`);
              const actualFunc = funcCreator.call(this);
              listener = (e) => actualFunc(e);
            } catch (e) {
              logger.error(
                `Error parsing inline arrow function handler: ${code}`,
                e
              );
              listener = () => {};
            }
          }
          // Case 2: Function call expression e.g., onclick="myFunction(arg1, event)" or "alert('hello')"
          else if (code.includes("(") && code.includes(")")) {
            listener = (event) => {
              try {
                // Parse function call to extract name and arguments
                const match = code.match(
                  /^([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\((.*)\)$/
                );

                if (match) {
                  const [, funcName, argsString] = match;

                  // Check if function exists in component context
                  const fn = this[funcName] || this.state[funcName];

                  if (typeof fn === "function") {
                    // Parse arguments safely
                    let args = [];
                    if (argsString.trim()) {
                      try {
                        // Create a function that returns the arguments as an array
                        args = new Function(
                          "event",
                          `return [${argsString}]`
                        ).call(this, event);
                      } catch (e) {
                        logger.error(
                          `Error parsing arguments for ${funcName}:`,
                          e
                        );
                        args = [];
                      }
                    }

                    // Call the function with parsed arguments
                    return fn.apply(this, args);
                  } else {
                    logger.warn(
                      `Function "${funcName}" not found in component context. Available functions:`,
                      Object.keys(this)
                        .filter((k) => typeof this[k] === "function")
                        .concat(
                          Object.keys(this.state).filter(
                            (k) => typeof this.state[k] === "function"
                          )
                        )
                    );
                  }
                } else {
                  // Fallback for other expressions (like alert('hello'))
                  new Function("event", code).call(this, event);
                }
              } catch (e) {
                logger.error(
                  `Error executing inline event handler: ${code}`,
                  e
                );
              }
            };
          } // Case 3: Named handler e.g., onclick="myFunction"
          else {
            listener = (event) => {
              const fn = this[code]; // 'code' is the handlerName e.g. "myFunction""
              if (typeof fn === "function") {
                try {
                  return fn.call(this, event);
                } catch (e) {
                  logger.error(
                    `Error executing event handler method: ${code}`,
                    e
                  );
                }
              } else {
                logger.warn(
                  `Event handler method "${code}" not found on component. Available methods on 'this':`,
                  Object.keys(this).filter((k) => typeof this[k] === "function")
                );
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
      if (!style) return;
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
            logger.error(`Failed to load component module ${s.src}`, err);
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
        // Use the key to look up the value in state, supporting nested paths
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
     * 1. Identifies top-level function declarations (e.g., `function foo(){}` or `const foo = ()=>{}`).
     * 2. Identifies top-level variable declarations (e.g., `const bar = 123;`).
     * 3. Transforms increment/decrement operations on bound variables to use this.state
     * 4. Transforms references to attribute-based state variables
     * 5. Appends assignments to `this` for bound functions (e.g., `this.foo = foo;`).
     * 6. Appends initialization for `this.state` for bound variables if not already set in state (e.g., `if(typeof this.state.bar === 'undefined') this.state.bar = bar;`).
     * 7. Executes the combined script in the component's context (`this`).
     */
    _processScriptText(srcText) {
      const declaredIdentifiers = new Set();
      const boundVariables = new Set();
      const stateVariables = new Set();

      // Helper function to check if a position is inside a string literal
      const isInsideString = (text, position) => {
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let inTemplateLiteral = false;
        let isEscaped = false;

        for (let i = 0; i < position; i++) {
          const char = text[i];
          if (isEscaped) {
            isEscaped = false;
            continue;
          }
          if (char === "\\") {
            isEscaped = true;
            continue;
          }
          // Only toggle if not within other quote types for simplicity,
          // assuming non-nested differing quotes for this check.
          if (char === "'" && !inDoubleQuote && !inTemplateLiteral) {
            inSingleQuote = !inSingleQuote;
          } else if (char === '"' && !inSingleQuote && !inTemplateLiteral) {
            inDoubleQuote = !inDoubleQuote;
          } else if (char === "`" && !inSingleQuote && !inDoubleQuote) {
            // Basic template literal check, doesn't handle nested expressions within templates perfectly for this context.
            inTemplateLiteral = !inTemplateLiteral;
          }
        }
        return inSingleQuote || inDoubleQuote || inTemplateLiteral;
      };

      // Helper function for context-aware replacement
      const replaceWithContext = (currentText, regex, replacerCallback) => {
        let newText = currentText;
        const matches = [];
        let matchResult;

        // Reset regex state for global regexes before each new pass
        regex.lastIndex = 0;

        while ((matchResult = regex.exec(newText)) !== null) {
          matches.push({
            index: matchResult.index,
            length: matchResult[0].length,
            originalContent: matchResult[0],
            groups: matchResult.slice(1), // Capture groups
          });
        }

        // Iterate backwards to avoid index shifting issues during replacement
        for (let i = matches.length - 1; i >= 0; i--) {
          const m = matches[i];
          if (!isInsideString(newText, m.index)) {
            // Pass original match, capture groups, index, and the current state of newText
            const replacement = replacerCallback(
              m.originalContent,
              ...m.groups,
              m.index,
              newText
            );
            newText =
              newText.substring(0, m.index) +
              replacement +
              newText.substring(m.index + m.length);
          }
        }
        return newText;
      };

      // Collect variables that are already in state (from attributes)
      Object.keys(this.state).forEach((key) => {
        if (this._isBound(key)) {
          stateVariables.add(key);
        }
      });

      // Regex for: function funcName(...)
      const classicFuncRegex = /\bfunction\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\(/g;
      let match;
      while ((match = classicFuncRegex.exec(srcText)) !== null) {
        declaredIdentifiers.add(match[1]);
      }

      // Regex for: const/let/var identifier = ...
      const varDeclRegex =
        /\b(const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=/g;
      while ((match = varDeclRegex.exec(srcText)) !== null) {
        declaredIdentifiers.add(match[2]);
      }

      // Check which variables are bound (non-functions)
      declaredIdentifiers.forEach((name) => {
        if (this._isBound(name)) {
          const funcPattern = new RegExp(
            `\\b${name}\\s*=\\s*(?:function|\\([^)]*\\)\\s*=>|[^=]+=>)`,
            "g"
          );
          const isFunctionDecl =
            funcPattern.test(srcText) ||
            new RegExp(`\\bfunction\\s+${name}\\s*\\(`).test(srcText);

          if (!isFunctionDecl) {
            boundVariables.add(name);
          }
        }
      });

      let transformedSrc = srcText;
      const allStateVarsToTransform = new Set([
        ...boundVariables,
        ...stateVariables,
      ]);

      allStateVarsToTransform.forEach((varName) => {
        // Pre-increment/decrement: ++varName, --varName
        // Added (^|\\W) to ensure varName is a whole word, not part of another.
        transformedSrc = replaceWithContext(
          transformedSrc,
          new RegExp(`(^|\\W)(\\+\\+|\\-\\-)\\s*${varName}\\b`, "g"),
          (original, prefix, op) => `${prefix}${op}this.state.${varName}`
        );

        // Post-increment/decrement: varName++, varName--
        transformedSrc = replaceWithContext(
          transformedSrc,
          new RegExp(`\\b${varName}\\s*(\\+\\+|\\-\\-)(?!\\.)`, "g"), // (?!\\.) to avoid issues if varName itself could be part of obj.prop++
          (original, op) => `this.state.${varName}${op}`
        );

        // Compound assignments: varName += value, etc.
        // Using (^|\\W) to ensure varName is standalone.
        transformedSrc = replaceWithContext(
          transformedSrc,
          new RegExp(
            `(^|\\W)${varName}\\s*([+\\-*/%&|^]|<<|>>|>>>)?=(?!=)`,
            "g"
          ),
          (original, prefix, opStr, index, currentFullText) => {
            const effectiveMatchStart = index + prefix.length;
            let lookbehind = currentFullText.substring(
              Math.max(0, effectiveMatchStart - 10),
              effectiveMatchStart
            );
            if (/\b(const|let|var)\s+$/.test(lookbehind)) {
              return original;
            }
            return `${prefix}this.state.${varName} ${opStr || ""}=`;
          }
        );

        // References in expressions (but not on left side of assignment and not in declarations)
        // This is your existing complex regex and callback, now wrapped.
        const referenceRegex = new RegExp(
          `\\b${varName}\\b(?!\\s*[+\\-*/%&|^]?=)`,
          "g"
        );
        transformedSrc = replaceWithContext(
          transformedSrc,
          referenceRegex,
          (originalMatch, index, currentFullText) => {
            // Check if this is already part of this.state.varName
            const before = currentFullText.substring(
              Math.max(0, index - 11),
              index
            );
            if (before.endsWith("this.state.")) {
              return originalMatch; // Already transformed
            }

            // *** IMPROVED: Check if this is inside function parameters ***
            // More comprehensive function parameter detection
            const checkIfInsideFunctionParams = (text, position) => {
              // Look for the pattern: (...params...) before =>
              // or function name(...params...)
              // or (...params...) { (for function expressions)

              let openParenPos = -1;
              let closeParenPos = -1;
              let parenDepth = 0;

              // Find the enclosing parentheses
              for (let i = position - 1; i >= 0; i--) {
                const char = text[i];
                if (char === ")") parenDepth++;
                else if (char === "(") {
                  if (parenDepth === 0) {
                    openParenPos = i;
                    break;
                  }
                  parenDepth--;
                }
              }

              if (openParenPos === -1) return false;

              // Find the matching closing parenthesis
              parenDepth = 0;
              for (let i = openParenPos; i < text.length; i++) {
                const char = text[i];
                if (char === "(") parenDepth++;
                else if (char === ")") {
                  parenDepth--;
                  if (parenDepth === 0) {
                    closeParenPos = i;
                    break;
                  }
                }
              }

              if (
                closeParenPos === -1 ||
                position < openParenPos ||
                position > closeParenPos
              ) {
                return false;
              }

              // Check what comes before the opening parenthesis
              const beforeParen = text
                .substring(Math.max(0, openParenPos - 50), openParenPos)
                .trim();

              // Check what comes after the closing parenthesis
              const afterParen = text
                .substring(
                  closeParenPos + 1,
                  Math.min(text.length, closeParenPos + 20)
                )
                .trim();

              // Function declaration: function name(
              if (/\bfunction\s+\w*\s*$/.test(beforeParen)) {
                return true;
              }

              // Arrow function: = ( or const name = (
              if (/[=:]\s*$/.test(beforeParen) && /^\s*=>/.test(afterParen)) {
                return true;
              }

              // Method definition: methodName(
              if (
                /\w\s*$/.test(beforeParen) &&
                /^\s*(\{|=>)/.test(afterParen)
              ) {
                return true;
              }

              return false;
            };

            if (checkIfInsideFunctionParams(currentFullText, index)) {
              return originalMatch; // Don't transform function parameters
            }

            // Check if this is part of a class declaration
            const classBefore = currentFullText.substring(
              Math.max(0, index - 10),
              index
            );
            if (/\bclass\s+$/.test(classBefore)) {
              return originalMatch;
            }

            // Check if this is after 'extends' keyword
            const extendsBefore = currentFullText.substring(
              Math.max(0, index - 20),
              index
            );
            if (/\bextends\s+$/.test(extendsBefore)) {
              return originalMatch;
            }

            const jsKeywords = [
              "break",
              "case",
              "catch",
              "class",
              "const",
              "continue",
              "debugger",
              "default",
              "delete",
              "do",
              "else",
              "export",
              "extends",
              "finally",
              "for",
              "function",
              "if",
              "import",
              "in",
              "instanceof",
              "let",
              "new",
              "return",
              "super",
              "switch",
              "this",
              "throw",
              "try",
              "typeof",
              "var",
              "void",
              "while",
              "with",
              "yield",
            ];
            if (jsKeywords.includes(originalMatch)) {
              return originalMatch;
            }

            const contextBefore = currentFullText.substring(
              Math.max(0, index - 20),
              index
            );
            const contextAfter = currentFullText.substring(
              index + originalMatch.length,
              Math.min(
                currentFullText.length,
                index + originalMatch.length + 10
              )
            );

            if (
              /\.state\[['"]\s*$/.test(contextBefore) ||
              /state\[['"]\s*$/.test(contextBefore) ||
              /^\s*-/.test(contextAfter) // Example: data-test-id
            ) {
              return originalMatch;
            }

            const extendedBefore = currentFullText.substring(
              Math.max(0, index - 50),
              index
            );
            if (/\]\s*\.\s*$/.test(extendedBefore)) {
              return originalMatch;
            }

            const lineStart = currentFullText.lastIndexOf("\n", index) + 1;
            const beforeMatchText = currentFullText.substring(lineStart, index);
            if (/\b(?:const|let|var)\s+$/.test(beforeMatchText)) {
              return originalMatch; // This is the declaration name itself
            }
            // Ensure it's not a property access like obj.varName
            if (index > 0 && currentFullText[index - 1] === ".") {
              return originalMatch;
            }
            // Ensure it's not a function call varName()
            let k = index + originalMatch.length;
            while (k < currentFullText.length && /\s/.test(currentFullText[k]))
              k++;
            if (k < currentFullText.length && currentFullText[k] === "(") {
              return originalMatch;
            }

            return `this.state.${varName}`;
          }
        );
      });

      let assignments = "";
      if (declaredIdentifiers.size > 0) {
        assignments =
          "\n\n// --- Auto-processed by LadrillosJS Framework ---\n";
        declaredIdentifiers.forEach((name) => {
          assignments += `if (this._isBound('${name}')) {\n`;
          assignments += `  if (typeof ${name} === 'function') {\n`;
          assignments += `    try { this.${name} = ${name}; } catch(e) { console.warn('LadrillosJS: Failed to assign function ${name} to component context.', e); }\n`;
          assignments += ` } else if (typeof ${name} !== 'undefined' && ${boundVariables.has(
            name
          )}) {\n`;
          assignments += `    if(typeof this.state.${name} === 'undefined') { try { this.state.${name} = ${name}; } catch(e) { console.warn('LadrillosJS: Failed to initialize state for ${name} from script.', e); } }\n`;
          assignments += `  }\n`;
          assignments += `}\n`;
        });
      }

      const scriptToExecute = transformedSrc + assignments;
      try {
        new Function(scriptToExecute).call(this);
      } catch (e) {
        logger.error("Error executing component script:", e);
        console.error(
          "LadrillosJS: Error executing component script. Processed script was:\n---\n" +
            scriptToExecute +
            "\n---\nError details:",
          e
        );
      }
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
          this._functions.set(name, m[0]);
          last = m[1].trim();
          if (last) {
            // try to eval the last arrow body as a function
            try {
              return new Function(`${last}`).bind(this);
            } catch (e) {
              logger.error(e);
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
    // or if it's an attribute that exists in state
    _isBound(varName) {
      // Check if this variable exists in state (from attributes)
      if (varName in this.state) {
        return true;
      }

      const inEvents = this._eventBindings.some((b) => {
        if (!b.key) return false;

        if (b.key === varName) return true;

        const functionCallMatch = b.key.match(
          /^([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\(/
        );
        return functionCallMatch && functionCallMatch[1] === varName;
      });

      const inTemplates = this._bindings.some((b) => {
        if (Array.isArray(b)) {
          return b.some((x) => {
            // Check if varName is used directly or as root of a nested path
            return x.key === varName || x.key.startsWith(varName + ".");
          });
        } else {
          // Check if varName is used directly or as root of a nested path
          return b.key === varName || b.key.startsWith(varName + ".");
        }
      });

      // Check conditionals for variable usage
      const inConditionals = this._conditionals.some((group) =>
        group.some(({ expr }) => {
          if (!expr) return false;
          // Check if the variable name appears in the expression
          // This regex looks for the variable as a whole word
          const regex = new RegExp(`\\b${varName}\\b`);
          return regex.test(expr);
        })
      );

      return inEvents || inTemplates || inConditionals;
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
