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
  // Process arrow functions first to handle them before variable declarations
  const arrowFunctionRegex = new RegExp(
    REGEX_PATTERNS.declarations.arrowFunction,
    "g"
  );
  let match: RegExpExecArray | null;

  while ((match = arrowFunctionRegex.exec(srcContent)) !== null) {
    const functionName = match[2].trim();
    const params = match[3].trim();
    let body = match[4].trim();

    // Normalize arrow function body format for consistent processing
    const isBlockBody = body.startsWith("{") && body.endsWith("}");
    if (isBlockBody) {
      // Block body: remove outer braces for processing
      body = body.slice(1, -1).trim();
    } else {
      // Expression body: add explicit return statement
      body = `return ${body}`;
    }

    processArrowFunction(component, functionName, params, body);
  }

  // Process variable declarations, excluding arrow functions already handled above
  const variableRegex = new RegExp(REGEX_PATTERNS.declarations.variable, "g");

  while ((match = variableRegex.exec(srcContent)) !== null) {
    const stateBindings = Object.keys(component.state);
    const variableName = match[2].trim();
    const rawValue = match[3].trim();

    // Skip arrow functions since they were processed in the previous step
    if (REGEX_PATTERNS.arrowFunction.test(rawValue)) {
      continue;
    }

    // Convert string representation to actual JavaScript value
    const parsedValue = parseVariableValue(rawValue);

    // Only update component state if this variable is bound to state
    if (stateBindings.includes(variableName)) {
      component.state[variableName] = parsedValue;
    }
  }

  // Process traditional function declarations
  const functionRegex = new RegExp(REGEX_PATTERNS.declarations.function, "g");
  while ((match = functionRegex.exec(srcContent)) !== null) {
    const functionName = match[1].trim();
    const params = match[2].trim();
    let body = match[3].trim();

    // Generate unique parameter names to avoid conflicts with state variables
    const paramList = params
      .split(",")
      .map((param) => param.trim())
      .map((param) => generateUniqueParamName(param));

    // Track which parameters are assigned to state variables for proper handling
    const paramAssignments = new Map<string, string>(); // originalParam -> stateKey
    const stateKeys = Object.keys(component.state);

    // Analyze parameter usage in function body to detect state assignments
    paramList.forEach((param, index) => {
      const originalParam = params.split(",")[index].trim();
      stateKeys.forEach((key) => {
        // Look for assignments where parameters are assigned to state variables
        const assignmentRegex = new RegExp(
          `\\b(this\\.state\\.)?${key}\\s*=\\s*[^;]*\\b${originalParam}\\b`,
          "g"
        );
        if (assignmentRegex.test(body)) {
          paramAssignments.set(originalParam, key);
        }
      });
    });

    // Replace parameter names in function body with unique names to prevent conflicts
    paramList.forEach((param, index) => {
      const originalParam = params.split(",")[index].trim();
      const assignedStateKey = paramAssignments.get(originalParam);

      // Handle parameter replacement based on whether it's assigned to state
      if (!assignedStateKey) {
        // Parameter not assigned to state: replace everywhere
        const regex = new RegExp(`\\b${originalParam}\\b`, "g");
        body = body.replace(regex, param);
      } else {
        // Parameter assigned to state: only replace right-side usage and other references
        const regex = new RegExp(`\\b${originalParam}\\b(?!\\s*=(?!=))`, "g");

        body = body.replace(regex, (match, offset) => {
          // Check if this usage comes after the assignment to state
          if (assignedStateKey) {
            const beforeMatch = body.substring(0, offset);
            const assignmentPattern = new RegExp(
              `\\b(this\\.state\\.)?${assignedStateKey}\\s*=\\s*[^;]*\\b${originalParam}\\b`
            );
            if (assignmentPattern.test(beforeMatch)) {
              // Post-assignment usage: keep original name for state replacement
              return originalParam;
            }
          }
          // Use unique parameter name to prevent conflicts
          return param;
        });
      }
    });

    // Replace state variable references with proper this.state.key syntax
    stateKeys.forEach((key) => {
      // Handle left-hand side assignments: key = ... becomes this.state.key = ...
      const leftSideRegex = new RegExp(`\\b${key}\\s*=(?!=)`, "g");
      body = body.replace(leftSideRegex, `this.state.${key} =`);

      // Handle right-hand side usage: avoid replacing if already this.state.key
      const rightSideRegex = new RegExp(
        `(?<!this\\.state\\.)\\b${key}\\b(?!\\s*=(?!=))`,
        "g"
      );
      body = body.replace(rightSideRegex, `this.state.${key}`);
    });

    // Create and bind the function to the component context
    const eventBinding = component._eventBindings?.get(functionName);
    const fn = new Function(paramList.join(", "), body).bind(component);

    // Set up event listener if this function is bound to a DOM event
    if (eventBinding?.element && eventBinding.eventType) {
      eventBinding.element.addEventListener(eventBinding.eventType, () => {
        fn(...(eventBinding?.params || []));
      });
    }
  }
};

/**
 * Processes arrow function declarations and integrates them with component state.
 * Handles parameter name conflicts, state variable integration, and event binding.
 *
 * @param component - The component that owns this arrow function
 * @param functionName - The name of the arrow function
 * @param params - The parameter list string
 * @param body - The function body content
 */
const processArrowFunction = (
  component: ComponentElement,
  functionName: string,
  params: string,
  body: string
) => {
  // Generate unique parameter names to prevent conflicts with state variables
  const paramList = params
    .split(",")
    .map((param) => param.trim())
    .map((param) => generateUniqueParamName(param));

  // Track which parameters are assigned to state variables for proper handling
  const paramAssignments = new Map<string, string>(); // originalParam -> stateKey
  const stateKeys = Object.keys(component.state);

  // Analyze parameter usage to detect state assignments
  paramList.forEach((param, index) => {
    const originalParam = params.split(",")[index].trim();
    stateKeys.forEach((key) => {
      // Look for assignments where parameters are assigned to state variables
      const assignmentRegex = new RegExp(
        `\\b(this\\.state\\.)?${key}\\s*=\\s*[^;]*\\b${originalParam}\\b`,
        "g"
      );
      if (assignmentRegex.test(body)) {
        paramAssignments.set(originalParam, key);
      }
    });
  });

  // Replace parameter names in function body with unique names to prevent conflicts
  paramList.forEach((param, index) => {
    const originalParam = params.split(",")[index].trim();
    const assignedStateKey = paramAssignments.get(originalParam);

    // Handle parameter replacement based on whether it's assigned to state
    if (!assignedStateKey) {
      // Parameter not assigned to state: replace everywhere
      const regex = new RegExp(`\\b${originalParam}\\b`, "g");
      body = body.replace(regex, param);
    } else {
      // Parameter assigned to state: only replace right-side usage and other references
      const regex = new RegExp(`\\b${originalParam}\\b(?!\\s*=(?!=))`, "g");

      body = body.replace(regex, (match, offset) => {
        // Check if this usage comes after the assignment to state
        if (assignedStateKey) {
          const beforeMatch = body.substring(0, offset);
          const assignmentPattern = new RegExp(
            `\\b(this\\.state\\.)?${assignedStateKey}\\s*=\\s*[^;]*\\b${originalParam}\\b`
          );
          if (assignmentPattern.test(beforeMatch)) {
            // Post-assignment usage: keep original name for state replacement
            return originalParam;
          }
        }
        // Use unique parameter name to prevent conflicts
        return param;
      });
    }
  });

  // Replace state variable references with proper this.state.key syntax
  stateKeys.forEach((key) => {
    // Handle left-hand side assignments: key = ... becomes this.state.key = ...
    const leftSideRegex = new RegExp(`\\b${key}\\s*=(?!=)`, "g");
    body = body.replace(leftSideRegex, `this.state.${key} =`);

    // Handle right-hand side usage: avoid replacing if already this.state.key
    const rightSideRegex = new RegExp(
      `(?<!this\\.state\\.)\\b${key}\\b(?!\\s*=(?!=))`,
      "g"
    );
    body = body.replace(rightSideRegex, `this.state.${key}`);
  });

  // Create and bind the arrow function to the component context
  const eventBinding = component._eventBindings?.get(functionName);
  const fn = new Function(paramList.join(", "), body).bind(component);

  // Set up event listener if this function is bound to a DOM event
  if (eventBinding?.element && eventBinding.eventType) {
    eventBinding.element.addEventListener(eventBinding.eventType, () => {
      fn(...(eventBinding?.params || []));
    });
  }
};

/**
 * Parses a variable value string and converts it to its appropriate JavaScript type.
 * Handles various data types including strings, numbers, booleans, objects, arrays,
 * and JavaScript expressions. Provides safe evaluation of complex expressions.
 *
 * @param rawValue - The raw string value to parse
 * @returns The parsed value with correct JavaScript type
 */
const parseVariableValue = (rawValue: string): any => {
  const trimmed = rawValue.trim();

  // Skip arrow functions - they should be handled by processArrowFunction
  if (REGEX_PATTERNS.arrowFunction.test(trimmed)) {
    console.warn(
      `Arrow function detected in variable value, skipping: ${trimmed}`
    );
    return trimmed; // Return as string, don't try to evaluate
  }

  // Handle simple string literals (quoted strings without method calls)
  if (
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) &&
    !trimmed.includes(".") &&
    !trimmed.includes("(")
  ) {
    return trimmed.slice(1, -1); // Remove quotes
  }

  // Handle simple numeric values (without method calls or property access)
  if (
    !isNaN(Number(trimmed)) &&
    trimmed !== "" &&
    !trimmed.includes(".") &&
    !trimmed.includes("(")
  ) {
    return Number(trimmed);
  }

  // Handle boolean literals
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // Handle null and undefined literals
  if (trimmed === "null") return null;
  if (trimmed === "undefined") return undefined;

  // Handle simple objects and arrays using JSON parsing (without method calls)
  if (
    (trimmed.startsWith("{") || trimmed.startsWith("[")) &&
    !trimmed.includes("(")
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fall through to JavaScript evaluation if JSON parsing fails
    }
  }

  // Handle complex JavaScript expressions (method calls, operations, etc.)
  try {
    const evalResult = evaluateJavaScript(trimmed);
    return evalResult;
  } catch (error) {
    console.warn(`Failed to evaluate JavaScript expression: ${trimmed}`, error);
    // Fallback: return as string to prevent breaking the application
    return trimmed;
  }
};

/**
 * Safely evaluates JavaScript expressions in a controlled context.
 * Provides access to common JavaScript built-ins while preventing access to
 * potentially dangerous global objects.
 *
 * @param expression - The JavaScript expression to evaluate
 * @returns The result of the evaluated expression
 */
const evaluateJavaScript = (expression: string): any => {
  // Create a safe evaluation context with common JavaScript methods
  const safeContext = {
    // String constructor and methods
    String: String,
    // Math operations and constants
    Math: Math,
    // Array constructor and methods
    Array: Array,
    // Object constructor and methods
    Object: Object,
    // Date constructor
    Date: Date,
    // Number constructor and methods
    Number: Number,
    // Boolean constructor
    Boolean: Boolean,
  };

  // Use Function constructor for safer evaluation than eval()
  // This prevents access to the global scope and local variables
  const func = new Function(
    ...Object.keys(safeContext),
    `"use strict"; return (${expression});`
  );

  return func(...Object.values(safeContext));
};

/**
 * Generates a unique parameter name to avoid conflicts with state variables.
 * Creates a randomized parameter name that's unlikely to conflict with
 * existing variable names in the component.
 *
 * @param originalName - The original parameter name
 * @returns A unique parameter name with random suffix
 */
const generateUniqueParamName = (originalName: string) => {
  return `__param_${originalName}_${Math.random()
    .toString(36)
    .substring(2, 9)}`;
};
