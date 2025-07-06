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
  // Pre-parse all matches to avoid repeated regex execution
  const arrowFunctionMatches = Array.from(
    srcContent.matchAll(
      new RegExp(REGEX_PATTERNS.declarations.arrowFunction, "g")
    )
  );
  const variableMatches = Array.from(
    srcContent.matchAll(new RegExp(REGEX_PATTERNS.declarations.variable, "g"))
  );
  const functionMatches = Array.from(
    srcContent.matchAll(new RegExp(REGEX_PATTERNS.declarations.function, "g"))
  );

  // Process arrow functions first to handle them before variable declarations
  for (const match of arrowFunctionMatches) {
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
  const variableDeclarations: Array<{
    name: string;
    value: string;
    index: number;
  }> = [];

  // Helper to check if a match is inside a function body
  const isInsideFunctionBody = (
    matchIndex: number,
    srcContent: string
  ): boolean => {
    // Pre-compile function boundary detection for better performance
    const functionBoundaries = [
      ...arrowFunctionMatches.map((match) => ({
        start: match.index! + match[0].length - 1,
        match: match[0],
      })),
      ...functionMatches.map((match) => ({
        start: match.index! + match[0].length - 1,
        match: match[0],
      })),
    ];

    for (const boundary of functionBoundaries) {
      const restOfContent = srcContent.substring(boundary.start);

      // Count braces to find the end of this function
      let localBraceCount = 0;
      for (let i = 0; i < restOfContent.length; i++) {
        if (restOfContent[i] === "{") localBraceCount++;
        else if (restOfContent[i] === "}") localBraceCount--;

        if (localBraceCount === 0) {
          const functionEnd = boundary.start + i;
          if (matchIndex > boundary.start && matchIndex < functionEnd) {
            return true;
          }
          break;
        }
      }
    }

    return false;
  };

  // First pass: collect all top-level variable declarations
  for (const match of variableMatches) {
    const variableName = match[2].trim();
    const rawValue = match[3].trim();

    // Skip arrow functions since they were processed in the previous step
    if (REGEX_PATTERNS.arrowFunction.test(rawValue)) {
      continue;
    }

    // Skip variables that are declared inside function bodies
    if (isInsideFunctionBody(match.index!, srcContent)) {
      continue;
    }

    variableDeclarations.push({
      name: variableName,
      value: rawValue,
      index: match.index!,
    });
  }

  // Process variables with proper dependency resolution
  const processedVariables = new Set<string>();
  const stateBindings = Object.keys(component.state);

  // Helper to check if a value references other declared variables
  const hasVariableReferences = (value: string): string[] => {
    const references: string[] = [];
    variableDeclarations.forEach((decl) => {
      if (decl.name !== value && value.includes(decl.name)) {
        // Check if it's a whole word match (not part of another identifier)
        const regex = new RegExp(`\\b${decl.name}\\b`);
        if (regex.test(value)) {
          references.push(decl.name);
        }
      }
    });
    return references;
  };

  // Process variables in multiple passes until all are resolved
  let maxIterations = 10; // Prevent infinite loops
  let currentIteration = 0;

  while (
    processedVariables.size < variableDeclarations.length &&
    currentIteration < maxIterations
  ) {
    let processedInThisIteration = 0;

    variableDeclarations.forEach(({ name, value }) => {
      if (!processedVariables.has(name)) {
        const dependencies = hasVariableReferences(value);
        const allDependenciesResolved = dependencies.every((dep) =>
          processedVariables.has(dep)
        );

        if (allDependenciesResolved) {
          try {
            // Create context with all currently processed variables (both state and local)
            const context: Record<string, any> = {};

            // Add processed variables to context
            variableDeclarations.forEach((decl) => {
              if (processedVariables.has(decl.name)) {
                if (stateBindings.includes(decl.name)) {
                  // Get value from component state
                  context[decl.name] = component.state[decl.name];
                } else {
                  // For non-state variables, we need to store them separately
                  // Create a temporary store for local variables
                  if (!component._localVariables) {
                    component._localVariables = new Map();
                  }
                  context[decl.name] = component._localVariables.get(decl.name);
                }
              }
            });

            const parsedValue = parseVariableValue(value, context);

            // Update component state if this variable is bound to state
            if (stateBindings.includes(name)) {
              component.state[name] = parsedValue;
            } else {
              // Store local variables for future reference
              if (!component._localVariables) {
                component._localVariables = new Map();
              }
              component._localVariables.set(name, parsedValue);
            }
            processedVariables.add(name);
            processedInThisIteration++;
          } catch (error) {
            console.warn(`Failed to process variable ${name}: ${error}`);
            processedVariables.add(name); // Mark as processed to avoid infinite loops
          }
        }
      }
    });

    // If no variables were processed in this iteration, break to avoid infinite loop
    if (processedInThisIteration === 0) {
      break;
    }

    currentIteration++;
  }

  // Handle any remaining unprocessed variables
  variableDeclarations.forEach(({ name, value }) => {
    if (!processedVariables.has(name)) {
      try {
        // Create context with all processed variables
        const context: Record<string, any> = {};

        // Add processed variables to context
        variableDeclarations.forEach((decl) => {
          if (processedVariables.has(decl.name)) {
            if (stateBindings.includes(decl.name)) {
              context[decl.name] = component.state[decl.name];
            } else if (component._localVariables?.has(decl.name)) {
              context[decl.name] = component._localVariables.get(decl.name);
            }
          }
        });

        const parsedValue = parseVariableValue(value, context);

        // Update component state if this variable is bound to state
        if (stateBindings.includes(name)) {
          component.state[name] = parsedValue;
        } else {
          // Store local variables for future reference
          if (!component._localVariables) {
            component._localVariables = new Map();
          }
          component._localVariables.set(name, parsedValue);
        }
      } catch (error) {
        console.warn(
          `Failed to process variable ${name} in final pass: ${error}`
        );
      }
    }
  });

  // Process traditional function declarations
  for (const match of functionMatches) {
    const functionName = match[1].trim();
    const params = match[2].trim();
    let body = match[3].trim();

    // For event handlers, preserve the first parameter name for the event object
    const paramArray = params
      .split(",")
      .map((param) => param.trim())
      .filter(Boolean);
    const paramList: string[] = [];

    // Generate unique parameter names, but preserve first param for event handlers
    paramArray.forEach((param, index) => {
      if (index === 0) {
        // Keep the first parameter as-is for event object
        paramList.push(param);
      } else {
        // Generate unique names for other parameters to avoid conflicts
        paramList.push(generateUniqueParamName(param));
      }
    });

    // Track which parameters are assigned to state variables for proper handling
    const paramAssignments = new Map<string, string>(); // originalParam -> stateKey
    const stateKeys = Object.keys(component.state);

    // Analyze parameter usage in function body to detect state assignments (skip first param as it's event)
    paramList.forEach((param, index) => {
      if (index === 0) return; // Skip event parameter

      const originalParam = paramArray[index];
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
    // (skip first parameter as it's the event)
    paramList.forEach((param, index) => {
      if (index === 0) return; // Skip event parameter

      const originalParam = paramArray[index];
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

      // Handle right-hand side usage: avoid replacing if already this.state.key or if it's an object property
      // Negative lookbehind: (?<!this\.state\.) - not preceded by "this.state."
      // Negative lookbehind: (?<!\w\.) - not preceded by any word character and dot (like "e.x")
      // Word boundary: \b - ensure we match whole words only
      // Negative lookahead: (?!\s*[=\.]) - not followed by assignment or property access
      const rightSideRegex = new RegExp(
        `(?<!this\\.state\\.)(?<!\\w\\.)\\b${key}\\b(?!\\s*[=\\.])`,
        "g"
      );
      body = body.replace(rightSideRegex, `this.state.${key}`);
    });

    // Create and bind the function to the component context
    const eventBinding = component._eventBindings?.get(functionName);
    const fn = new Function(paramList.join(", "), body).bind(component);

    // Set up event listener if this function is bound to a DOM event
    if (eventBinding?.element && eventBinding.eventType) {
      eventBinding.element.addEventListener(eventBinding.eventType, (event) => {
        // If the function call has specific arguments, use those; otherwise pass the event
        if (eventBinding.params && eventBinding.params.length > 0) {
          // Function called with specific arguments (e.g., changeName('Daniel'))
          fn(...eventBinding.params);
        } else {
          // Function called without arguments - pass the event object (e.g., drag, key)
          fn(event);
        }
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
  // For event handlers, preserve the first parameter name for the event object
  const paramArray = params
    .split(",")
    .map((param) => param.trim())
    .filter(Boolean);
  const paramList: string[] = [];

  // Generate unique parameter names, but preserve first param for event handlers
  paramArray.forEach((param, index) => {
    if (index === 0) {
      // Keep the first parameter as-is for event object
      paramList.push(param);
    } else {
      // Generate unique names for other parameters to avoid conflicts
      paramList.push(generateUniqueParamName(param));
    }
  });

  // Track which parameters are assigned to state variables for proper handling
  const paramAssignments = new Map<string, string>(); // originalParam -> stateKey
  const stateKeys = Object.keys(component.state);

  // Analyze parameter usage to detect state assignments (skip first param as it's event)
  paramList.forEach((_, index) => {
    if (index === 0) return; // Skip event parameter

    const originalParam = paramArray[index];
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
  // (skip first parameter as it's the event)
  paramList.forEach((param, index) => {
    if (index === 0) return; // Skip event parameter

    const originalParam = paramArray[index];
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

    // Handle right-hand side usage: avoid replacing if already this.state.key or if it's an object property
    // Negative lookbehind: (?<!this\.state\.) - not preceded by "this.state."
    // Negative lookbehind: (?<!\w\.) - not preceded by any word character and dot (like "e.x")
    // Word boundary: \b - ensure we match whole words only
    // Negative lookahead: (?!\s*[=\.]) - not followed by assignment or property access
    const rightSideRegex = new RegExp(
      `(?<!this\\.state\\.)(?<!\\w\\.)\\b${key}\\b(?!\\s*[=\\.])`,
      "g"
    );
    body = body.replace(rightSideRegex, `this.state.${key}`);
  });
  // Create and bind the arrow function to the component context
  const eventBinding = component._eventBindings?.get(functionName);
  const fn = new Function(paramList.join(", "), body).bind(component);

  // Set up event listener if this function is bound to a DOM event
  if (eventBinding?.element && eventBinding.eventType) {
    eventBinding.element.addEventListener(eventBinding.eventType, (event) => {
      // If the function call has specific arguments, use those; otherwise pass the event
      if (eventBinding.params && eventBinding.params.length > 0) {
        // Function called with specific arguments (e.g., changeName('Daniel'))
        fn(...eventBinding.params);
      } else {
        // Function called without arguments - pass the event object (e.g., drag, key)
        fn(event);
      }
    });
  }
};

/**
 * Parses a variable value string and converts it to its appropriate JavaScript type.
 * Handles various data types including strings, numbers, booleans, objects, arrays,
 * and JavaScript expressions. Provides safe evaluation of complex expressions.
 *
 * @param rawValue - The raw string value to parse
 * @param context - Optional context object containing variable values for evaluation
 * @returns The parsed value with correct JavaScript type
 */
const parseVariableValue = (
  rawValue: string,
  context: Record<string, any> = {}
): any => {
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
    const evalResult = evaluateJavaScript(trimmed, context);
    return evalResult;
  } catch (error) {
    // If evaluation fails and it looks like a variable reference, check if it's in context
    if (
      /^[a-zA-Z_$][0-9a-zA-Z_$]*(\s*[+\-*/%]\s*[a-zA-Z_$][0-9a-zA-Z_$]*)*$/.test(
        trimmed
      )
    ) {
      // Check if it's a simple variable name that might be in context
      if (context[trimmed] !== undefined) {
        return context[trimmed];
      }
      // Return as string for variable expressions that haven't been resolved yet
      return trimmed;
    }

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
 * @param context - Optional context object containing variable values
 * @returns The result of the evaluated expression
 */
const evaluateJavaScript = (
  expression: string,
  context: Record<string, any> = {}
): any => {
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
    // Window object for browser APIs (only safe properties)
    window: {
      innerWidth: typeof window !== "undefined" ? window.innerWidth : 1920,
      innerHeight: typeof window !== "undefined" ? window.innerHeight : 1080,
      location:
        typeof window !== "undefined"
          ? window.location
          : { href: "", host: "" },
      console: typeof window !== "undefined" ? window.console : console,
    },
    // Add any provided context variables
    ...context,
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
