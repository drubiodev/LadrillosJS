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
    processComponentScripts(component, s.content);
  }
  // const functionRegex = new RegExp(REGEX_PATTERNS.declarations.function, "g");
  //    while ((match = functionRegex.exec(srcContent)) !== null) {
  //     const functionName = match[1].trim();
  //     const params = match[2].trim();
  //     const body = match[3].trim();
  //     console.log(component._eventBindings);
  //   }
};

const processComponentScripts = (
  component: ComponentElement,
  srcContent: string
) => {
  // Update the component's state with variable declarations
  // TODO: handle arrow functions
  const variableRegex = new RegExp(REGEX_PATTERNS.declarations.variable, "g");
  let match: RegExpExecArray | null;

  while ((match = variableRegex.exec(srcContent)) !== null) {
    const stateBindings = Object.keys(component.state);
    const variableName = match[2].trim();
    const rawValue = match[3].trim();
    // Parse the value to handle strings, numbers, objects, etc.
    const parsedValue = parseVariableValue(rawValue);

    if (stateBindings.includes(variableName)) {
      component.state[variableName] = parsedValue;
    }
  }

  // Process function declarations
  const functionRegex = new RegExp(REGEX_PATTERNS.declarations.function, "g");
  while ((match = functionRegex.exec(srcContent)) !== null) {
    const functionName = match[1].trim();
    const params = match[2].trim();
    let body = match[3].trim();

    // for each param split by comma generate a unique name
    const paramList = params
      .split(",")
      .map((param) => param.trim())
      .map((param) => generateUniqueParamName(param));

    // First, track which parameters are assigned to state variables
    const paramAssignments = new Map<string, string>(); // originalParam -> stateKey
    const stateKeys = Object.keys(component.state);

    // Find assignments where parameters are assigned to state variables
    paramList.forEach((param, index) => {
      const originalParam = params.split(",")[index].trim();
      stateKeys.forEach((key) => {
        // Look for assignments like: key = originalParam or this.state.key = originalParam
        const assignmentRegex = new RegExp(
          `\\b(this\\.state\\.)?${key}\\s*=\\s*\\b${originalParam}\\b`,
          "g"
        );
        if (assignmentRegex.test(body)) {
          paramAssignments.set(originalParam, key);
        }
      });
    });

    // update each param to be a unique name in the body (right side of assignments and other usages)
    paramList.forEach((param, index) => {
      const originalParam = params.split(",")[index].trim();
      const assignedStateKey = paramAssignments.get(originalParam);

      // If parameter is NOT assigned to a state variable, replace it everywhere (left and right side)
      if (!assignedStateKey) {
        const regex = new RegExp(`\\b${originalParam}\\b`, "g");
        body = body.replace(regex, param);
      } else {
        // If parameter IS assigned to a state variable, only replace right side and other usages
        // Match parameter name on right side of assignments OR anywhere else it's used (but not on left side of assignments)
        const regex = new RegExp(`\\b${originalParam}\\b(?!\\s*=(?!=))`, "g");

        // Replace with unique name only if not assigned to state, or use original if it will be replaced by state
        body = body.replace(regex, (match, offset) => {
          // If this parameter was assigned to a state variable, we'll let the state replacement handle it
          if (assignedStateKey) {
            // Check if this usage comes after the assignment
            const beforeMatch = body.substring(0, offset);
            const assignmentPattern = new RegExp(
              `\\b(this\\.state\\.)?${assignedStateKey}\\s*=\\s*\\b${originalParam}\\b`
            );
            if (assignmentPattern.test(beforeMatch)) {
              // This usage comes after assignment, keep original name for now (will be replaced by state logic)
              return originalParam;
            }
          }
          // Use unique parameter name
          return param;
        });
      }
    });

    // update body , if the body contains keys from the state, replace them with this.state.key
    stateKeys.forEach((key) => {
      const regex = new RegExp(`\\b${key}\\b`, "g");
      body = body.replace(regex, `this.state.${key}`);
    });

    console.log(body);

    const eventBinding = component._eventBindings?.get(functionName);
    const fn = new Function(paramList.join(", "), body).bind(component);

    if (eventBinding?.element && eventBinding.eventType) {
      eventBinding.element.addEventListener(eventBinding.eventType, () => {
        fn(...(eventBinding?.params || []));
      });
    }

    // process functions
  }
};

const parseVariableValue = (rawValue: string): any => {
  const trimmed = rawValue.trim();

  // Handle simple string literals (single or double quotes) without method calls
  if (
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) &&
    !trimmed.includes(".") &&
    !trimmed.includes("(")
  ) {
    return trimmed.slice(1, -1); // Remove quotes
  }

  // Handle simple numbers (without method calls)
  if (
    !isNaN(Number(trimmed)) &&
    trimmed !== "" &&
    !trimmed.includes(".") &&
    !trimmed.includes("(")
  ) {
    return Number(trimmed);
  }

  // Handle simple booleans
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // Handle null and undefined
  if (trimmed === "null") return null;
  if (trimmed === "undefined") return undefined;

  // Handle simple objects and arrays (try JSON parse first)
  if (
    (trimmed.startsWith("{") || trimmed.startsWith("[")) &&
    !trimmed.includes("(")
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fall through to JavaScript evaluation
    }
  }

  // Handle JavaScript expressions (method calls, operations, etc.)
  try {
    // Create a safe evaluation context
    const evalResult = evaluateJavaScript(trimmed);
    return evalResult;
  } catch (error) {
    console.warn(`Failed to evaluate JavaScript expression: ${trimmed}`, error);
    // Fallback: return as string
    return trimmed;
  }
};

const evaluateJavaScript = (expression: string): any => {
  // Create a safe evaluation context with common JavaScript methods
  const safeContext = {
    // String methods
    String: String,
    // Math operations
    Math: Math,
    // Array methods
    Array: Array,
    // Object methods
    Object: Object,
    // Date
    Date: Date,
    // Number
    Number: Number,
    // Boolean
    Boolean: Boolean,
  };

  // using Function constructor for safer evaluation than eval
  const func = new Function(
    ...Object.keys(safeContext),
    `"use strict"; return (${expression});`
  );

  return func(...Object.values(safeContext));
};

// Helper function to generate unique parameter names
const generateUniqueParamName = (originalName: string) => {
  return `__param_${originalName}_${Math.random()
    .toString(36)
    .substring(2, 9)}`;
};
