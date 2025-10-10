import { LadrillosComponent } from "../types/LadrilloTypes";
import { logger } from "../utils/logger";
import { fetchComponentSource } from "./componentSource";
import { parseComponent } from "./componentParser";

class Ladrillos {
  // properties
  components: Record<string, LadrillosComponent>;

  constructor() {
    // Initialize the Ladrillos instance
    this.components = {};
  }

  async registerComponent(
    name: string,
    path: string,
    useShadowDOM: boolean = true
  ): Promise<void> {
    if (this.components[name]) {
      logger.warn(`Component with name "${name}" is already registered.`);
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
