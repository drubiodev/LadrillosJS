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

  // Extract function names from the processed script content
  const extractFunctionNames = (content: string): Set<string> => {
    const functionNames = new Set<string>();

    // Regular function declarations: function name() {}
    const functionRegex = /function\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\(/g;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      functionNames.add(match[1]);
    }

    // Arrow functions: const name = () => {}
    const arrowFunctionRegex =
      /(?:const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*\([^)]*\)\s*=>/g;
    while ((match = arrowFunctionRegex.exec(content)) !== null) {
      functionNames.add(match[1]);
    }

    // Function expressions: const name = function() {}
    const functionExpressionRegex =
      /(?:const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*function\s*\(/g;
    while ((match = functionExpressionRegex.exec(content)) !== null) {
      functionNames.add(match[1]);
    }

    return functionNames;
  };

  const availableFunctions = extractFunctionNames(srcContent);

  // Get matching event handler keys
  const matchingHandlers = new Set<string>();
  if (component._eventHandlers) {
    component._eventHandlers.forEach((handler) => {
      if (availableFunctions.has(handler.key)) {
        matchingHandlers.add(handler.key);
      }
    });
  }

  const wrappedScript = `
           ${srcContent}
  
        // Set up event listeners for functions that match event handlers
        this._eventHandlers.forEach((handler) => {
          // Only process functions that are defined in the script content
          const isUserDefinedFunction = ${JSON.stringify(
            Array.from(availableFunctions)
          )}.includes(handler.key);
          
          if (isUserDefinedFunction) {
            // Handle user-defined functions with proper binding
            try {
              const func = eval(handler.key);
              if (typeof func === 'function') {
                handler.element?.removeAttribute(\`on\${handler.eventType}\`);
                handler.element?.addEventListener(handler.eventType, () => {
                  func.call(this, ...(handler.args || []));
                });
              }
            } catch (e) {
              console.warn('User-defined function not found:', handler.key);
            }
          } else {
            // Handle native functions and inline expressions normally
            handler.element?.removeAttribute(\`on\${handler.eventType}\`);
            handler.element?.addEventListener(handler.eventType, (event) => {
              try {
                // For native functions and inline expressions, execute in global context
                if (handler.args && handler.args.length > 0) {
                  // Function call with arguments
                  const func = eval(handler.key);
                  if (typeof func === 'function') {
                    func(...handler.args);
                  }
                } else {
                  // Direct evaluation (handles both function calls and inline expressions)
                  eval(handler.key);
                }
              } catch (e) {
                console.warn('Error executing handler:', handler.key, e);
              }
            });
          }
        });

        `;

  const scriptFunction = new Function("state", wrappedScript);
  scriptFunction.call(component);
};
