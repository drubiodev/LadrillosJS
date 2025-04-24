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
      // this._scanBindings();
      // this._render();
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
        console.log("external script", s);
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
        console.log("script", s);
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
  }

  customElements.define(tagName, ComponentElement);
  logger.log(`Web component defined: <${tagName}></${tagName}>`);
};
