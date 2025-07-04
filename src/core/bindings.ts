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

/**
 * Scans a component's DOM tree and script tags to identify and process all binding types.
 * This is the main entry point for binding detection and setup.
 *
 * @param component - The component element to scan for bindings
 * @param scripts - Array of script elements containing user-defined functions
 */
export const scanBindings = (
  component: ComponentElement,
  scripts: ScriptElement[]
) => {
  // Ensure component has a valid root element before processing
  if (!component.root) return;

  // Extract user-defined functions from script tags for event binding
  if (scripts && scripts.length > 0) {
    for (const script of scripts) {
      // Setup regex patterns for function detection
      const functionRegex = new RegExp(
        REGEX_PATTERNS.declarations.function,
        "g"
      );
      const arrowFunctionRegex = new RegExp(
        REGEX_PATTERNS.declarations.arrowFunction,
        "g"
      );

      let match: RegExpExecArray | null;

      // Process traditional function declarations: function name(params) { body }
      while ((match = functionRegex.exec(script.content)) !== null) {
        const functionName = match[1].trim();
        const params = match[2].trim();
        const body = match[3].trim();

        // Initialize event bindings map if it doesn't exist
        if (!component._eventBindings) component._eventBindings = new Map();

        // Store function metadata for later event binding
        component._eventBindings.set(functionName, {
          key: functionName,
          params: parseParameters(params),
          body,
          element: undefined,
          eventType: undefined,
        });
      }

      // Process arrow function declarations: const name = (params) => { body }
      while ((match = arrowFunctionRegex.exec(script.content)) !== null) {
        const functionName = match[2].trim();
        const params = match[3].trim();
        const body = match[4].trim();

        // Initialize event bindings map if it doesn't exist
        if (!component._eventBindings) component._eventBindings = new Map();

        // Store arrow function metadata for later event binding
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

  // Perform a single DOM traversal to identify all binding types efficiently
  const walker = document.createTreeWalker(
    component.root,
    NodeFilter.SHOW_ALL,
    null
  );

  let node: Node | null;

  while ((node = walker.nextNode())) {
    // Process text nodes that contain data binding expressions
    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent;
      if (textContent && textContent.includes("{")) {
        processTextBindings(node, textContent, component);
      }
    }
    // Process element nodes for attribute and event bindings
    else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      processElementBindings(element, component);
    }
  }
};

/**
 * Processes all bindings found within a DOM element.
 * Handles both data bindings in attributes and event bindings.
 *
 * @param element - The DOM element to process for bindings
 * @param component - The component that owns this element
 */
const processElementBindings = (
  element: Element,
  component: ComponentElement
) => {
  // Convert attributes to array once to avoid repeated iteration during processing
  const attributes = Array.from(element.attributes);

  for (const attr of attributes) {
    // Check for data binding expressions in attribute values
    if (attr.value.includes("{")) {
      processAttributeBindings(element, attr, component);
    }

    // Check for event handler attributes (onclick, onchange, etc.)
    if (attr.name.startsWith("on")) {
      processEventBinding(element, attr, component);
    }
  }
};

/**
 * Processes event binding attributes and connects them to user-defined functions.
 * Parses function calls with arguments and sets up event listeners.
 *
 * @param element - The DOM element with the event attribute
 * @param attr - The event attribute (e.g., onclick, onchange)
 * @param component - The component that owns this element
 */
const processEventBinding = (
  element: Element,
  attr: Attr,
  component: ComponentElement
) => {
  // Extract event type by removing 'on' prefix (onclick -> click)
  const eventType = attr.name.slice(2);
  const fullCall = attr.value.trim();

  // Parse the function call to extract function name and arguments
  const funcCallMatch = fullCall.match(/^([^(]+)(?:\(([^)]*)\))?$/);
  const funcName = funcCallMatch ? funcCallMatch[1].trim() : fullCall;
  const argsString = funcCallMatch ? funcCallMatch[2] || "" : "";

  // Convert argument string to array of parsed parameters
  const callArgs = argsString ? parseParameters(argsString) : [];

  // Look up the function in the component's event bindings
  const funcBinding = component._eventBindings?.get(funcName);

  if (!funcBinding) {
    // Function not found in user-defined functions, skip binding
    return;
  }

  // Clean up the DOM by removing the processed attribute
  element.removeAttribute(attr.name);

  // Complete the binding by connecting function to element and event
  funcBinding.eventType = eventType;
  funcBinding.element = element;
  funcBinding.params = callArgs; // Store parsed arguments for event execution
};

/**
 * Parses a single parameter string and converts it to its appropriate JavaScript type.
 * Handles strings, numbers, booleans, null, undefined, arrays, objects, and functions.
 *
 * @param param - The parameter string to parse
 * @returns The parsed parameter value with correct type
 */
const parseParameter = (param: string): any => {
  const trimmed = param.trim();

  if (!trimmed) return undefined;

  // Handle explicit null and undefined values
  if (trimmed === "null") return null;
  if (trimmed === "undefined") return undefined;

  // Handle boolean literals
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // Handle numeric values (integers, floats, negative numbers, scientific notation)
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    return isNaN(num) ? trimmed : num;
  }

  // Handle quoted strings - remove outer quotes and return inner content
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  // Handle array literals using JSON parsing
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed; // Return as string if JSON parsing fails
    }
  }

  // Handle object literals using JSON parsing
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed; // Return as string if JSON parsing fails
    }
  }

  // Handle function expressions (arrow functions or traditional functions)
  if (trimmed.includes("=>") || trimmed.startsWith("function")) {
    try {
      return new Function(`return (${trimmed});`)();
    } catch {
      return trimmed; // Return as string if function parsing fails
    }
  }

  // Default case: return as unquoted string
  return trimmed;
};

/**
 * Parses a comma-separated parameter string into an array of typed values.
 * Handles nested structures (arrays, objects) and properly quoted strings.
 *
 * @param paramsString - The parameter string to parse (e.g., "name, 42, true, [1,2,3]")
 * @returns Array of parsed parameter values with correct types
 */
const parseParameters = (paramsString: string): any[] => {
  if (!paramsString || !paramsString.trim()) return [];

  const params: any[] = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let stringChar = "";

  // Character-by-character parsing to handle nested structures correctly
  for (let i = 0; i < paramsString.length; i++) {
    const char = paramsString[i];
    const prevChar = i > 0 ? paramsString[i - 1] : "";

    // Track string boundaries (handle escaped quotes)
    if ((char === '"' || char === "'") && prevChar !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = "";
      }
    }

    // Only process structural characters when not inside strings
    if (!inString) {
      // Track nesting depth for proper comma separation
      if (char === "{" || char === "[" || char === "(") {
        depth++;
      } else if (char === "}" || char === "]" || char === ")") {
        depth--;
      }

      // Split parameters only at top level (depth === 0)
      if (char === "," && depth === 0) {
        params.push(parseParameter(current));
        current = "";
        continue;
      }
    }

    current += char;
  }

  // Process the final parameter
  if (current.trim()) {
    params.push(parseParameter(current));
  }

  return params;
};

/**
 * Processes text nodes that contain data binding expressions.
 * Identifies {variableName} patterns and creates text bindings for reactive updates.
 *
 * @param node - The text node containing binding expressions
 * @param textContent - The text content to scan for bindings
 * @param component - The component that owns this text node
 */
const processTextBindings = (
  node: Node,
  textContent: string,
  component: ComponentElement
) => {
  // Create fresh regex instance to avoid state conflicts between calls
  const bindingRegex = new RegExp(REGEX_PATTERNS.binding.source, "g");
  let match: RegExpExecArray | null;

  // Find all data binding expressions in the text content
  while ((match = bindingRegex.exec(textContent)) !== null) {
    const binding: TextBinding = {
      node,
      template: textContent,
      key: match[1].trim(),
    };

    // Initialize bindings map if needed
    if (!component._bindings) component._bindings = new Map();

    // Register the binding for reactive updates
    component._bindings.set(match[1].trim(), binding);

    // Initialize the state property with empty string as default
    (component.state as any)[binding.key] = "";
  }
};

/**
 * Processes attribute values that contain data binding expressions.
 * Identifies {variableName} patterns in attribute values and creates attribute bindings.
 *
 * @param element - The DOM element with the binding attribute
 * @param attr - The attribute containing binding expressions
 * @param component - The component that owns this element
 */
const processAttributeBindings = (
  element: Element,
  attr: Attr,
  component: ComponentElement
) => {
  // Create fresh regex instance to avoid state conflicts between calls
  const bindingRegex = new RegExp(REGEX_PATTERNS.binding.source, "g");
  let match: RegExpExecArray | null;

  // Find all data binding expressions in the attribute value
  while ((match = bindingRegex.exec(attr.value)) !== null) {
    const binding: AttributeBinding = {
      element,
      attrName: attr.name,
      template: attr.value,
      key: match[1].trim(),
    };

    // Initialize bindings map if needed
    if (!component._bindings) component._bindings = new Map();

    // Register the binding for reactive updates
    component._bindings.set(match[1].trim(), binding);
  }
};
