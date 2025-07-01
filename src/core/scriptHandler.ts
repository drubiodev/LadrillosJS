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
    processComponentUserDefineFunctionScripts(component, s.content);
  }
  console.log(scripts);
  // const functionRegex = new RegExp(REGEX_PATTERNS.declarations.function, "g");
  //    while ((match = functionRegex.exec(srcContent)) !== null) {
  //     const functionName = match[1].trim();
  //     const params = match[2].trim();
  //     const body = match[3].trim();
  //     console.log(component._eventBindings);
  //   }
};

const processComponentUserDefineFunctionScripts = (
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
    const body = match[3].trim();
    // TODO: implement function binding logic
    // console.log("============================");
    // console.log(params);
    // console.log(body);
    const eventBinding = component._eventBindings?.get(functionName);
    const fn = new Function(params, body).bind(component);

    eventBinding?.element.addEventListener(eventBinding.eventType, () => {
      fn(...(eventBinding?.params || []));
    });

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
