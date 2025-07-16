/**
 * Script Handler - Processes and executes component scripts
 *
 * This module handles the loading and execution of both external scripts and inline scripts
 * within component contexts. It manages variable declarations, function definitions, and
 * their integration with the component's state and event system.
 */

import {
  ComponentElement,
  ExternalScriptElement,
  ScriptElement,
} from "../types/LadrilloTypes";
import { REGEX_PATTERNS } from "../utils/regex";

/**
 * Loads external script files for a component.
 * Currently a placeholder for future implementation of external script loading.
 *
 * @param component - The component that needs external scripts
 * @param externalScripts - Array of external script references to load
 */
export const loadExternalScripts = async (
  component: ComponentElement,
  externalScripts: ExternalScriptElement[]
) => {
  console.log(`Loading external scripts for component: ${component.tagName}`);
};

/**
 * Processes all inline scripts for a component.
 * This is the main entry point for script processing, handling variable declarations,
 * function definitions, and their integration with component state.
 *
 * @param component - The component that owns these scripts
 * @param scripts - Array of script elements to process
 */
export const loadComponentScript = (
  component: ComponentElement,
  scripts: ScriptElement[]
) => {
  for (const s of scripts) {
    processComponentScripts(component, s.content);
  }
};

/**
 * Processes the content of component scripts, handling different types of declarations.
 * Processes arrow functions, variable declarations, and regular function declarations
 * in order, integrating them with the component's state and event system.
 *
 * @param component - The component that owns this script
 * @param srcContent - The raw script content to process
 */
const processComponentScripts = (
  component: ComponentElement,
  srcContent: string
) => {
  // find const variables in the script
  const constRegex = /\bconst\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=/g;
  let match;

  while ((match = constRegex.exec(srcContent)) !== null) {
    component._constVariables.add(match[1]);
  }

  for (const state in component.state) {
    // Replace variable declarations (const, let, var)
    srcContent = srcContent.replace(
      new RegExp(`\\b(const|let|var)\\s+${state}\\s*=`, "g"),
      `this.state['${state}'] =`
    );

    // Replace standalone variable assignments (left side)
    srcContent = srcContent.replace(
      new RegExp(`\\b${state}\\s*=`, "g"),
      `this.state['${state}'] =`
    );
  }

  // Process each function individually to handle parameters correctly
  for (const state in component.state) {
    // Function regex that captures the entire function including its body
    const functionRegex =
      /((?:function\s+\w+\s*\(([^)]*)\)|(?:const|let|var)\s+\w+\s*=\s*\(([^)]*)\)\s*=>|(?:const|let|var)\s+\w+\s*=\s*function\s*\(([^)]*)\))\s*\{[^}]*\})/g;

    srcContent = srcContent.replace(
      functionRegex,
      (match, fullFunction, params1, params2, params3) => {
        const params = params1 || params2 || params3 || "";
        const functionParams = new Set<string>();

        // Extract parameters for this specific function
        if (params) {
          params.split(",").forEach((param: string) => {
            const cleanParam = param.trim().split("=")[0].trim();
            if (cleanParam) {
              functionParams.add(cleanParam);
            }
          });
        }

        // Only replace state variable if it's not a parameter in this function
        if (!functionParams.has(state)) {
          return fullFunction.replace(
            new RegExp(
              `(?<!this\\.state\\[['"])\\b${state}\\b(?!['"]])(?!\\s*[=:])`,
              "g"
            ),
            `this.state['${state}']`
          );
        }

        return fullFunction;
      }
    );
  }

  console.log(srcContent);
  const wrappedScript = `
           ${srcContent}
  
        const btn = this.shadowRoot?.querySelectorAll("button")[1];
        btn?.removeAttribute("onclick");
        btn?.addEventListener("click", sayHi.bind(this));
  
        const btn2 = this.shadowRoot?.querySelectorAll("button")[2];
        btn2?.removeAttribute("onclick");
        btn2?.addEventListener("click", sayHi2.bind(this,"YOYO"));
  
        const btn3 = this.shadowRoot?.querySelectorAll("button")[3];
        btn3?.removeAttribute("onclick");
        btn3?.addEventListener("click", sayHi3.bind(this));
       
        `;

  const scriptFunction = new Function("state", wrappedScript);
  scriptFunction.call(component);
};
