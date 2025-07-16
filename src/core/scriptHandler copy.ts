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
  // Extract function names using existing regex patterns
  const functionNames = new Set<string>();

  // Use your existing regex patterns
  const functionRegex = new RegExp(REGEX_PATTERNS.declarations.function, "g");
  const arrowFunctionRegex = new RegExp(
    REGEX_PATTERNS.declarations.arrowFunction,
    "g"
  );

  let match;

  // Find traditional function declarations
  while ((match = functionRegex.exec(srcContent)) !== null) {
    functionNames.add(match[1]);
  }

  // Find arrow function declarations
  while ((match = arrowFunctionRegex.exec(srcContent)) !== null) {
    functionNames.add(match[2]);
  }

  // Extract variable declarations to initialize state
  const extractVariables = (content: string) => {
    const variables = new Set<string>();
    const varRegex = /(?:let|const|var)\s+(\w+)/g;
    let match;
    while ((match = varRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }
    return variables;
  };

  // Initialize state for any variables that don't exist yet
  const declaredVariables = extractVariables(srcContent);
  declaredVariables.forEach((varName) => {
    if (!(varName in component.state)) {
      component.state[varName] = undefined;
    }
  });

  // Also ensure 'name' is in state if it's used in bindings but not declared
  if (!("name" in component.state)) {
    component.state.name = "";
  }

  // Create a reusable function that executes the script and returns updated state
  const executeScript = () => {
    const functionNamesArray = Array.from(functionNames);
    const stateVars = Object.keys(component.state);

    // Separate state variables into those declared in script vs those that aren't
    const declaredInScript = Array.from(declaredVariables);
    const stateOnlyVars = stateVars.filter(
      (varName) => !declaredInScript.includes(varName)
    );

    const wrappedScript = `
        // Only destructure state variables that are NOT declared in the user script
        ${
          stateOnlyVars.length > 0
            ? `let {${stateOnlyVars.join(", ")}} = state;`
            : ""
        }
        
        // User's script executes with direct variable access
        ${srcContent}
        
        // Auto-bind detected functions
        const capturedFunctions = {};
        [${functionNamesArray
          .map((name) => `'${name}'`)
          .join(", ")}].forEach(name => {
          try {
            if (typeof eval(name) === 'function') {
              this[name] = eval(name);
              capturedFunctions[name] = eval(name);
            }
          } catch (e) {
            // Function not found, skip
          }
        });
        
        // Return both captured functions and updated state variables
        return {
          capturedFunctions,
          state: {${stateVars.join(", ")}}
        };
      `;

    const scriptFunction = new Function("state", wrappedScript);

    try {
      const result = scriptFunction.call(component, component.state) || {
        capturedFunctions: {},
        state: {},
      };

      // Apply state changes back to the proxy
      Object.keys(result.state).forEach((key) => {
        if (component.state[key] !== result.state[key]) {
          component.state[key] = result.state[key];
        }
      });

      return result.capturedFunctions;
    } catch (error) {
      console.error(`Error executing script for ${component.tagName}:`, error);
      return {};
    }
  };

  // Initial execution to capture functions
  const capturedFunctions = executeScript();

  // Wrap each function to re-execute the script context before calling
  Object.keys(capturedFunctions).forEach((funcName) => {
    (component as any)[funcName] = function (...args: any[]) {
      // Filter out any Event objects from the arguments
      // When called from onclick, the browser automatically adds the event as the last argument
      const functionArgs = args.filter((arg) => !(arg instanceof Event));
      console.log(`${funcName} called with:`, functionArgs);
      // Execute the function within a fresh script context
      const stateVars = Object.keys(component.state);

      // Separate state variables into those declared in script vs those that aren't
      const declaredInScript = Array.from(declaredVariables);
      const stateOnlyVars = stateVars.filter(
        (varName) => !declaredInScript.includes(varName)
      );

      const wrappedScript = `
          // Only destructure state variables that are NOT declared in the user script
          ${
            stateOnlyVars.length > 0
              ? `let {${stateOnlyVars.join(", ")}} = state;`
              : ""
          }
          
          // User's script executes with direct variable access
          ${srcContent}
          
          // Now call the specific function with the passed arguments
          ${funcName}(...functionArgs);
          
          // Return updated state variables
          return {${stateVars.join(", ")}};
        `;

      const scriptFunction = new Function(
        "state",
        "functionArgs",
        wrappedScript
      );

      try {
        const result =
          scriptFunction.call(component, component.state, functionArgs) || {};

        // Apply state changes back to the proxy
        Object.keys(result).forEach((key) => {
          if (component.state[key] !== result[key]) {
            component.state[key] = result[key];
          }
        });
      } catch (error) {
        console.error(`Error executing function ${funcName}:`, error);
      }
    };
  });

  // for each component._eventBindings
  if (component._eventBindings) {
    component._eventBindings.forEach((eventBinding) => {
      if (eventBinding?.element && eventBinding.eventType) {
        eventBinding.element.addEventListener(
          eventBinding.eventType,
          (event) => {
            const func = (component as any)[eventBinding.key];
            if (typeof func === "function") {
              func.call(component, event);
            }
          }
        );
      }
    });
  }
};
