// loads the external scripts and inline scripts
// and binds them to the component context

import {
  ComponentElement,
  ExternalScriptElement,
  ScriptElement,
} from "../types/LadrilloTypes";
import { REGEX_PATTERNS } from "../utils/regex";

export const loadExternalScripts = async (
  component: ComponentElement,
  externalScripts: ExternalScriptElement[]
) => {
  console.log(`Loading external scripts for component: ${component.tagName}`);
};

export const loadComponentScript = (
  component: ComponentElement,
  scripts: ScriptElement[]
) => {
  for (const s of scripts) {
    processComponentScript(component, s.content);
  }
};

const processComponentScript = (
  component: ComponentElement,
  srcContent: string
) => {
  // console.log(component.state);
  // console.log(srcContent);
  component.state["name"] = "Daniel";
};
