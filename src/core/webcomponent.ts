import { LadrillosComponent } from "../types/LadrilloTypes";
import { logger } from "../utils/logger";
import { loadStyles } from "./css/cssParser";
import { loadTemplate } from "./html/htmlparser";

export const defineWebComponent = (
  component: LadrillosComponent,
  useShadowDOM: boolean
) => {
  const { tagName, template, scripts, externalScripts, styles } = component;

  class ComponentElement extends HTMLElement {
    constructor() {
      super();
      if (useShadowDOM) this.attachShadow({ mode: "open" });
    }

    // Invoked when element is added to the DOM
    connectedCallback() {
      const host = useShadowDOM ? this.shadowRoot! : this;

      loadTemplate(host, template);
      loadStyles(host, styles, useShadowDOM);
    }
    // Invoked when element is removed from the DOM
    disconnectedCallback() {}
    // Invoked when attributes are changed
    attributechangedCallback() {}
  }

  customElements.define(tagName, ComponentElement);
  logger.log(`Web component defined: <${tagName}></${tagName}>`);
};
