import { LadrillosComponent } from "../../types";
import { loadTemplate } from "../html/htmlparser";

export function createWebComponent(
  component: LadrillosComponent,
  useShadowDOM: boolean
): void {
  const { tagName, template, scripts, externalScripts, styles, sourcePath } =
    component;

  class LadrillosWebComponent extends HTMLElement {
    state: Record<string, any> = {};

    constructor() {
      super();
    }

    async connectedCallback() {
      const root = useShadowDOM ? this.attachShadow({ mode: "open" }) : this;
      const test = loadTemplate(root, template);
    }
  }

  // Only define if not already defined
  if (!customElements.get(tagName)) {
    customElements.define(tagName, LadrillosWebComponent);
    console.log(`Web component "${tagName}" defined.`);
  }
}
