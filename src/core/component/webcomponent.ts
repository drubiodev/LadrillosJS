import { LadrillosComponent } from "../../types";
import { loadStyles } from "../css/cssParser/cssParser";
import { loadTemplate } from "../html/htmlparser";
import { loadScripts } from "../js/scriptParser";

export function createWebComponent(
  component: LadrillosComponent,
  useShadowDOM: boolean
): void {
  const { tagName, template, scripts, externalScripts, styles, sourcePath } =
    component;

  class LadrillosWebComponent extends HTMLElement {
    // Reactive state - changes automatically update the DOM
    state: Record<string, unknown> = {};

    constructor() {
      super();
    }

    async connectedCallback() {
      const root = useShadowDOM ? this.attachShadow({ mode: "open" }) : this;
      const { bindings, twoWayBindings, conditionals, loops } = loadTemplate(root, template);

      // Load styles
      loadStyles(root, styles, useShadowDOM);
      
      // Load scripts and create reactive state
      // State changes will automatically update {bindings} in the DOM
      this.state = await loadScripts(root, scripts, bindings);
    }
  }

  // Only define if not already defined
  if (!customElements.get(tagName)) {
    customElements.define(tagName, LadrillosWebComponent);
    console.log(`Web component "${tagName}" defined.`);
  }
}
