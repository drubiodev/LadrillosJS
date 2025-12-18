import { LadrillosComponent } from "../types";
import { parseComponent } from "./component/extract";
import { fetchComponentSource } from "./component/loader";
import { createWebComponent } from "./component/webcomponent";

class Ladrillos {
  components: Record<string, LadrillosComponent>;

  constructor() {
    this.components = {};
  }

  async registerComponent(
    name: string,
    path: string,
    useShadowDOM: boolean = true,
    lazy: boolean = false
  ): Promise<void> {
    // check if component is already registered
    if (this.components[name]) {
      console.warn(`Component with name "${name}" is already registered.`);
      return;
    }

    // TODO: Lazy components

    // Resolve relative path to absolute URL
    // This ensures script src paths inside components resolve correctly
    // (similar to how Vue's transformAssetUrl uses a base URL)
    const absolutePath = new URL(path, window.location.href).href;

    // Fetch and define component
    try {
      const source = await fetchComponentSource(absolutePath);
      const component = await parseComponent(source || "", name, absolutePath);

      this.components[name] = component;

      createWebComponent(component, useShadowDOM);
    } catch (e) {
      console.error(`Error registering component "${name}":`, e);
    }
  }
}

export const ladrillos = new Ladrillos();
