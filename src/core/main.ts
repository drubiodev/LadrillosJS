import { LadrillosComponent } from "../types/LadrilloTypes";
import { logger } from "../utils/logger";
import { fetchComponentSource } from "./componentSource";
import { parseComponent } from "./componentParser";

class Ladrillos {
  // properties
  components: Record<string, LadrillosComponent>;
  private lazyComponents: Set<string>;
  private intersectionObserver: IntersectionObserver | null;

  constructor() {
    // Initialize the Ladrillos instance
    this.components = {};
    this.lazyComponents = new Set();
    this.intersectionObserver = null;
  }

  async registerComponent(
    name: string,
    path: string,
    useShadowDOM: boolean = true,
    lazy: boolean = false
  ): Promise<void> {
    if (this.components[name]) {
      logger.warn(`Component with name "${name}" is already registered.`);
      return;
    }

    // For lazy components, register a placeholder and defer actual loading
    if (lazy) {
      this.lazyComponents.add(name);
      this.#defineLazyPlaceholder(name, path, useShadowDOM);
      logger.log(`Component ${name} registered as lazy-loaded`);
      return;
    }

    try {
      const source = await fetchComponentSource(path);
      const component = await parseComponent(source!, name);

      this.components[name] = {
        tagName: name,
        template: component.template,
        scripts: component.scripts,
        externalScripts: component.externalScripts,
        styles: component.styles,
        sourcePath: path,
        lazy: false,
      };

      // Define the web component
      logger.log(`Component ${name} registered successfully`);
      await this.#defineWebComponent(name, useShadowDOM);
    } catch (error) {
      logger.error(
        `Failed to register component "${name}": ${(error as Error).message}`
      );
      return;
    }
  }

  /**
   * Defines a lazy-loading placeholder component
   * @param name - Component name
   * @param path - Component path
   * @param useShadowDOM - Whether to use Shadow DOM
   */
  #defineLazyPlaceholder(
    name: string,
    path: string,
    useShadowDOM: boolean
  ): void {
    const self = this;

    class LazyPlaceholder extends HTMLElement {
      private loaded = false;
      private observer: IntersectionObserver | null = null;

      constructor() {
        super();

        // Show a minimal loading indicator
        if (useShadowDOM) {
          this.attachShadow({ mode: "open" });
          if (this.shadowRoot) {
            this.shadowRoot.innerHTML = `
              <style>
                :host { display: block; min-height: 1px; }
              </style>
            `;
          }
        }
      }

      connectedCallback() {
        if (this.loaded) return;

        // Check if 'eager' attribute is present - if so, load immediately
        if (this.hasAttribute("eager")) {
          this.loaded = true;
          this.loadComponent();
          return;
        }

        // Set up intersection observer for lazy loading
        this.observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && !this.loaded) {
                this.loaded = true;
                this.loadComponent();
              }
            });
          },
          {
            rootMargin: "50px", // Load 50px before entering viewport
          }
        );

        this.observer.observe(this);
      }

      disconnectedCallback() {
        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }
      }

      async loadComponent() {
        try {
          logger.log(`Lazy loading component: ${name}`);

          // Store reference to this placeholder element
          const placeholder = this;
          const parent = this.parentNode;
          const nextSibling = this.nextSibling;

          if (!parent) {
            logger.error(`Placeholder for ${name} has no parent node`);
            return;
          }

          // Fetch and parse the component
          const source = await fetchComponentSource(path);
          const component = await parseComponent(source!, name);

          logger.log(`Component ${name} parsed successfully`);

          self.components[name] = {
            tagName: name,
            template: component.template,
            scripts: component.scripts,
            externalScripts: component.externalScripts,
            styles: component.styles,
            sourcePath: path,
            lazy: true,
          };

          // Create a unique temporary name for the real component
          const tempName = `${name}-real`;

          logger.log(`Defining real component with temp name: ${tempName}`);

          // Store original name and temporarily use temp name
          const originalTagName = self.components[name].tagName;
          self.components[name].tagName = tempName;

          // Import and define the real component with temp name
          const { defineWebComponent } = await import("./webcomponent");
          defineWebComponent(self.components[name], useShadowDOM);

          logger.log(`Real component ${tempName} defined`);

          // Restore original tag name
          self.components[name].tagName = originalTagName;

          // Create instance of the real component
          const realComponent = document.createElement(tempName);

          logger.log(`Created real component instance: ${tempName}`);

          // Copy attributes from placeholder to real component
          Array.from(placeholder.attributes).forEach((attr) => {
            realComponent.setAttribute(attr.name, attr.value);
          });

          // Copy child nodes (slot content)
          while (placeholder.firstChild) {
            realComponent.appendChild(placeholder.firstChild);
          }

          // Replace placeholder in DOM
          if (nextSibling) {
            parent.insertBefore(realComponent, nextSibling);
            logger.log(`Inserted real component before next sibling`);
          } else {
            parent.appendChild(realComponent);
            logger.log(`Appended real component to parent`);
          }

          parent.removeChild(placeholder);
          logger.log(`Removed placeholder element`);

          self.lazyComponents.delete(name);
          logger.log(`Component ${name} lazy-loaded successfully`);
        } catch (error) {
          logger.error(
            `Failed to lazy load component "${name}": ${
              (error as Error).message
            }`
          );
          console.error(error);
        }
      }
    }

    // Define the placeholder component
    if (!customElements.get(name)) {
      customElements.define(name, LazyPlaceholder);
    }
  }

  /**
   * Defines the web component using the webcomponent module
   * @param name - Component name
   * @param useShadowDOM - Whether to use Shadow DOM
   */
  async #defineWebComponent(
    name: string,
    useShadowDOM: boolean
  ): Promise<void> {
    const { defineWebComponent } = await import("./webcomponent");

    // safety check
    if (this.components[name]) {
      defineWebComponent(this.components[name], useShadowDOM);
    }
  }
}

export const ladrillos = new Ladrillos();
