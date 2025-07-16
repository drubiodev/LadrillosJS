import { ComponentElement } from "../types/LadrilloTypes";

export const scanEventHandlers = (component: ComponentElement) => {
  const walker = document.createTreeWalker(
    component.root,
    NodeFilter.SHOW_ALL,
    null
  );

  let node: Node | null;

  while ((node = walker.nextNode())) {
    // Processevent bindings
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const attributes = Array.from(element.attributes);
      for (const attr of attributes) {
        // Check for event handler attributes (onclick, onchange, etc.)
        if (attr.name.startsWith("on")) {
          processEventHandlers(element, attr, component);
        }
      }
    }
  }
};

/**
 * Processes event handler attributes and connects them to user-defined functions.
 * Parses function calls with arguments and sets up event listeners.
 *
 * @param element - The DOM element with the event attribute
 * @param attr - The event attribute (e.g., onclick, onchange)
 * @param component - The component that owns this element
 */
const processEventHandlers = (
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

  // Initialize _eventHandlers if it doesn't exist
  if (!component._eventHandlers) {
    component._eventHandlers = new Map();
  }

  // Generate a unique key for each event handler registration
  let uniqueKey: string;
  if (element instanceof HTMLElement && element.id) {
    uniqueKey = `${funcName}_${element.id}`;
  } else {
    // Assign a unique data attribute if not present
    if (!(element as HTMLElement).dataset.eventKey) {
      (element as HTMLElement).dataset.eventKey = `${funcName}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;
    }
    uniqueKey = (element as HTMLElement).dataset.eventKey!;
  }

  // Store the handler using the unique key
  component._eventHandlers.set(uniqueKey, {
    key: funcName,
    args: callArgs,
    element: element,
    eventType: eventType,
  });

  // Clean up the DOM by removing the processed attribute
  element.removeAttribute(attr.name);
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
 * @param argsString - The parameter string to parse (e.g., "name, 42, true, [1,2,3]")
 * @returns Array of parsed parameter values with correct types
 */
const parseParameters = (argsString: string): any[] => {
  if (!argsString || !argsString.trim()) return [];

  const args: any[] = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let stringChar = "";

  // Character-by-character parsing to handle nested structures correctly
  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];
    const prevChar = i > 0 ? argsString[i - 1] : "";

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
        args.push(parseParameter(current));
        current = "";
        continue;
      }
    }

    current += char;
  }

  // Process the final parameter
  if (current.trim()) {
    args.push(parseParameter(current));
  }

  return args;
};
