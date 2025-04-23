import { logger } from "../utils/logger.js";

const scriptsToIgnore = ["___vscode_livepreview_injected_script"];

/**
 * @fileoverview Ladrillos main module
 * @typedef {import('../types/LadrilloTypes').LadrillosComponent} LadrillosComponent
 */
class Ladrillos {
  #cache = new Map();

  constructor() {
    /** @type {Object.<string, LadrillosComponent>} */
    this.components = {};
  }

  static _SCRIPT_ALL = /<script>([\s\S]*?)<\/script>/g;
  static _STYLE_ALL = /<style>([\s\S]*?)<\/style>/g;
  static _SCRIPT_ONE = /<script>([\s\S]*?)<\/script>/;
  static _STYLE_ONE = /<style>([\s\S]*?)<\/style>/;

  /**
   * @param {string} name
   * @param {string} path
   * @param {boolean} [useShadowDOM=true]
   * @returns {Promise<void>}
   */
  async registerComponent(name, path, useShadowDOM = true) {
    // skip if already registered
    if (this.components[name]) {
      logger.log(`Component ${name} already registered, skipping.`);
      return;
    }

    try {
      const externalScripts = [];
      // fetch & cache component text
      let source = this.#cache.get(path);

      if (!source) {
        const res = await fetch(path);
        source = await res.text();
        this.#cache.set(path, source);
      }

      const noHtmlComments = source.replace(/<!--[\s\S]*?-->/g, "");

      // parse the HTML so we can handle multiple <script> (inline & external) and <style> tags
      const parser = new DOMParser();
      const doc = parser.parseFromString(noHtmlComments, "text/html");

      // 1) Handle <script external="true"> ➞ load globally, then remove
      Array.from(doc.querySelectorAll("script[external]")).forEach((extEl) => {
        const src = extEl.getAttribute("src");
        if (src) {
          externalScripts.push(src);
        }
        extEl.remove();
      });

      // extract and concatenate all scripts (inline & external)
      let script = "";
      // 2) Now grab only the local scripts for state‑injection
      const scriptEls = Array.from(
        doc.querySelectorAll("script:not([type='module']):not([external])")
      );

      for (const el of scriptEls) {
        const src = el.getAttribute("src");

        // skip anything whose src contains an entry from scriptsToIgnore
        if (src && scriptsToIgnore.some((ignore) => src.includes(ignore))) {
          logger.log(`Skipping ignored script "${src}"`);
          el.remove();
          continue;
        }

        if (src) {
          let scriptUrl;
          try {
            scriptUrl = src;
          } catch (urlErr) {
            console.error(
              `Invalid script URL "${src}" (base "${path}") - skipping:`,
              urlErr
            );
            el.remove();
            continue;
          }

          try {
            const res = await fetch(scriptUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            script += "\n" + (await res.text());
          } catch (fetchErr) {
            console.error(
              `Could not load script at ${scriptUrl} - skipping:`,
              fetchErr
            );
          }
        } else {
          script += "\n" + el.textContent;
        }

        el.remove();
      }

      // strip JS comments
      script = script
        .replace(/\/\*[\s\S]*?\*\//g, "")
        // preserve “://” but remove other //comments
        .replace(/(^|[^:])\/\/.*$/gm, "$1")
        .trim();

      // extract all styles
      let style = "";

      // find all <link rel="stylesheet">
      const linkEls = Array.from(
        doc.querySelectorAll("link[rel='stylesheet']")
      );

      for (const el of linkEls) {
        const href = el.getAttribute("href");
        let styleUrl;
        try {
          styleUrl = href + "?raw";
        } catch (urlErr) {
          console.error(
            `Invalid stylesheet URL "${href}" (base "${path}") - skipping:`,
            urlErr
          );
          el.remove();
          continue;
        }

        try {
          const res = await fetch(styleUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          style += "\n" + (await res.text());
        } catch (fetchErr) {
          console.error(
            `Could not load stylesheet at ${styleUrl} - skipping:`,
            fetchErr
          );
        }

        el.remove();
      }

      // find all <style> tags
      const styleEls = Array.from(doc.querySelectorAll("style"));
      for (const el of styleEls) {
        style += "\n" + el.textContent;
        el.remove();
      }
      style = style.trim();

      // the remaining HTML is your template
      const template = document.createElement("template");
      template.innerHTML = doc.body.innerHTML;

      this.components[name] = {
        tagName: name,
        template,
        script,
        style,
        externalScripts,
      };

      this._defineWebComponent(name, useShadowDOM);
      logger.log(`Component ${name} registered successfully`);
    } catch (err) {
      logger.error(`Failed to register component ${name}:`, err);
    }
  }

  /**
   * @private
   * @param {string} name
   * @param {boolean} useShadowDOM
   */
  async _defineWebComponent(name, useShadowDOM) {
    const { defineWebComponent } = await import("./webcomponent.js");
    defineWebComponent(this.components[name], useShadowDOM);
  }
}

export const ladrillos = new Ladrillos();
