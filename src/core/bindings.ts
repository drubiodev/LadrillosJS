import { match } from "assert";
import {
  AttributeBinding,
  ComponentElement,
  EventBinding,
  ScriptElement,
  TextBinding,
} from "../types/LadrilloTypes";
import { logger } from "../utils/logger";
import { REGEX_PATTERNS } from "../utils/regex";

export const scanBindings = (
  component: ComponentElement,
  scripts: ScriptElement[]
) => {
  // Ensure root exists and is valid
  if (!component.root) return;

  // get User defined function names from scripts
  if (scripts && scripts.length > 0) {
    // Process each script to extract function declarations
    for (const script of scripts) {
      // Extract function names and parameters from script content
      const functionRegex = new RegExp(
        REGEX_PATTERNS.declarations.function,
        "g"
      );
      let match: RegExpExecArray | null;

      while ((match = functionRegex.exec(script.content)) !== null) {
        // Extract function name, parameters,
        const functionName = match[1].trim();
        const params = match[2].trim();
        const body = match[3].trim();

        if (!component._eventBindings) component._eventBindings = new Map();
        component._eventBindings.set(functionName, {
          key: functionName,
          params: parseParameters(params),
          body,
          element: undefined,
          eventType: undefined,
        });
      }
    }
  }

  // Single traversal for all binding types
  const walker = document.createTreeWalker(
    component.root,
    NodeFilter.SHOW_ALL,
    null
  );

  let node: Node | null;

  while ((node = walker.nextNode())) {
    // Handle text nodes with bindings
    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent;
      if (textContent && textContent.includes("{")) {
        processTextBindings(node, textContent, component);
      }
    }
    // Handle element nodes
    else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      processElementBindings(element, component);
    }
  }
};

const processElementBindings = (
  element: Element,
  component: ComponentElement
) => {
  // Convert to array once to avoid repeated iteration
  const attributes = Array.from(element.attributes);

  for (const attr of attributes) {
    // Handle data bindings
    if (attr.value.includes("{")) {
      // TODO: attribute bindings
      processAttributeBindings(element, attr, component);
    }

    // Handle event bindings inline
    if (attr.name.startsWith("on")) {
      processEventBinding(element, attr, component);
    }
  }
};

const processEventBinding = (
  element: Element,
  attr: Attr,
  component: ComponentElement
) => {
  const eventType = attr.name.slice(2);
  const fullCall = attr.value.trim();

  // Extract function name and arguments
  const funcCallMatch = fullCall.match(/^([^(]+)(?:\(([^)]*)\))?$/);
  const funcName = funcCallMatch ? funcCallMatch[1].trim() : fullCall;
  const argsString = funcCallMatch ? funcCallMatch[2] || "" : "";

  // Parse the arguments from the function call
  const callArgs = argsString ? parseParameters(argsString) : [];

  const funcBinding = component._eventBindings?.get(funcName);

  if (!funcBinding) {
    // no function binding so not a user defined function
    return;
  }

  // Remove the attribute to prevent default handling
  element.removeAttribute(attr.name);
  funcBinding.eventType = eventType;
  funcBinding.element = element;

  // Store the actual call arguments to use when the event fires
  funcBinding.params = callArgs;
};

/**
 * Parses a parameter string and converts it to its appropriate JavaScript type
 */
const parseParameter = (param: string): any => {
  const trimmed = param.trim();

  if (!trimmed) return undefined;

  // Handle null and undefined
  if (trimmed === "null") return null;
  if (trimmed === "undefined") return undefined;

  // Handle boolean values
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // Handle numbers (including negative numbers, decimals, and scientific notation)
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    return isNaN(num) ? trimmed : num;
  }

  // Handle strings (remove outer quotes if present)
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  // Handle arrays
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed; // Return as string if parsing fails
    }
  }

  // Handle objects
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed; // Return as string if parsing fails
    }
  }

  // Handle functions (arrow functions or function expressions)
  if (trimmed.includes("=>") || trimmed.startsWith("function")) {
    try {
      return new Function(`return (${trimmed});`)();
    } catch {
      return trimmed; // Return as string if parsing fails
    }
  }

  // Default: return as string (unquoted)
  return trimmed;
};

/**
 * Splits parameters string and converts each to its appropriate type
 */
const parseParameters = (paramsString: string): any[] => {
  if (!paramsString || !paramsString.trim()) return [];

  const params: any[] = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < paramsString.length; i++) {
    const char = paramsString[i];
    const prevChar = i > 0 ? paramsString[i - 1] : "";

    // Handle string boundaries
    if ((char === '"' || char === "'") && prevChar !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = "";
      }
    }

    if (!inString) {
      // Track nesting depth for objects and arrays
      if (char === "{" || char === "[" || char === "(") {
        depth++;
      } else if (char === "}" || char === "]" || char === ")") {
        depth--;
      }

      // Split on comma only when not inside nested structures
      if (char === "," && depth === 0) {
        params.push(parseParameter(current));
        current = "";
        continue;
      }
    }

    current += char;
  }

  // Add the last parameter
  if (current.trim()) {
    params.push(parseParameter(current));
  }

  return params;
};

const processTextBindings = (
  node: Node,
  textContent: string,
  component: ComponentElement
) => {
  // Create new regex instance to avoid state conflicts
  const bindingRegex = new RegExp(REGEX_PATTERNS.binding.source, "g");
  let match: RegExpExecArray | null;

  while ((match = bindingRegex.exec(textContent)) !== null) {
    const binding: TextBinding = {
      node,
      template: textContent,
      key: match[1].trim(),
    };
    if (!component._bindings) component._bindings = new Map();
    component._bindings.set(match[1].trim(), binding);
    (component.state as any)[binding.key] = ""; // sets initial value
  }
};

const processAttributeBindings = (
  element: Element,
  attr: Attr,
  component: ComponentElement
) => {
  // Create new regex instance to avoid state conflicts
  const bindingRegex = new RegExp(REGEX_PATTERNS.binding.source, "g");
  let match: RegExpExecArray | null;

  while ((match = bindingRegex.exec(attr.value)) !== null) {
    const binding: AttributeBinding = {
      element,
      attrName: attr.name,
      template: attr.value,
      key: match[1].trim(),
    };

    if (!component._bindings) component._bindings = new Map();
    component._bindings.set(match[1].trim(), binding);
  }
};
