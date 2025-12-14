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

    // Fetch and define component
    try {
      const source = await fetchComponentSource(path);
      const component = await parseComponent(source || "", name, path);

      this.components[name] = component;

      createWebComponent(component, useShadowDOM);
    } catch (e) {
      console.error(`Error registering component "${name}":`, e);
    }
  }
}

// const parser = new DOMParser();

// export const parseComponentHTML = (source: string): Document => {
//   return parser.parseFromString(source, "text/html");
// };

export const ladrillos = new Ladrillos();
