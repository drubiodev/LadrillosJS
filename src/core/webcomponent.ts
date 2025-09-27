import { LadrillosComponent } from "../types/LadrilloTypes";

export const defineWebComponent = (
  component: LadrillosComponent,
  useShadowDOM: boolean
) => {
  console.log("Defining web component:", component.tagName);
};
