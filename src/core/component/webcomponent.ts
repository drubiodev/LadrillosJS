import { LadrillosComponent } from "../../types";

export function createWebComponent(
  component: LadrillosComponent,
  useShadowDOM: boolean
): void {
  const { tagName, template, scripts, styles } = component;

  class LadrillosWebComponent extends HTMLElement {
    constructor() {
      super();
    }

    async connectedCallback() {
      const root = useShadowDOM ? this.attachShadow({ mode: "open" }) : this;

      // html
      root.innerHTML = `
        <style>${styles}</style>
        ${template}
      `;
    }
  }

  // Only define if not already defined
  if (!customElements.get(tagName)) {
    customElements.define(tagName, LadrillosWebComponent);
    console.log(`Web component "${tagName}" defined.`);
  }
}
