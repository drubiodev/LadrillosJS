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
    }

    connectedCallback() {
      this._loadTemplate();
      this._loadStyles();
      this._loadScript();
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
      // 1) text bindings {{prop}}
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
      this.shadowRoot.querySelectorAll("[data-onclick]").forEach((el) => {
        const fn = el.getAttribute("data-onclick");
        el.addEventListener("click", (e) => this[fn]?.(e));
      });
    }

    _render() {
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

      // 2) execute inline scripts with proper `this`
      scripts.forEach((s) => {
        if (s.type === "module") {
          // still inject real modules if you need import/exports
          const moduleEl = document.createElement("script");
          moduleEl.type = "module";
          moduleEl.textContent = s.content;
          (this.shadowRoot ?? this).appendChild(moduleEl);
        } else {
          // run as a Function, binding `this` → the component instance
          new Function(s.content).call(this);
        }
      });
    }

    setState(partial) {
      Object.assign(this.state, partial);
      this._render();
    }
  }

  customElements.define(tagName, ComponentElement);
  logger.log(`Web component defined: <${tagName}></${tagName}>`);
};
