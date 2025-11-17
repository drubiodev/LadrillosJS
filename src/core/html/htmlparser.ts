import {
  BindingDescriptor,
  TwoWayBindingDescriptor,
  ConditionalDescriptor,
  LoopDescriptor,
} from "../../types/LadrilloTypes";
import { REGEX_PATTERNS } from "../../utils/regex";
import { logParseError } from "../../utils/devErrors";

/**
 * Injects the template HTML into the host element and scans for data bindings.
 * Returns a list of all bindings found in text nodes and attributes.
 */
export const loadTemplate = (
  host: HTMLElement | ShadowRoot,
  template: string
): {
  bindings: BindingDescriptor[];
  twoWayBindings: TwoWayBindingDescriptor[];
  conditionals: ConditionalDescriptor[][];
  loops: LoopDescriptor[];
} => {
  host.innerHTML = template;

  const bindings = scanBindings(host);
  const twoWayBindings = scanTwoWayBindings(host);
  // IMPORTANT: scanLoops must run BEFORE scanConditionals
  // because scanConditionals removes elements from the DOM,
  // and any $for loops inside $if elements would be lost otherwise
  const loops = scanLoops(host);
  const conditionals = scanConditionals(host);

  return { bindings, twoWayBindings, conditionals, loops };
};

/**
 * Extracts variable names from function arguments.
 * e.g., "formatPrice(price)" → ["price"]
 * e.g., "add(x, y)" → ["x", "y"]
 * e.g., "format(user.name)" → ["user"]
 */
const extractFunctionArguments = (functionCall: string): string[] => {
  const variables: string[] = [];

  // Extract the part between parentheses
  const argsMatch = functionCall.match(/\((.*)\)/);
  if (!argsMatch) return variables;

  const argsString = argsMatch[1].trim();
  if (!argsString) return variables;

  // Split by commas, but respect nested function calls
  const args = argsString.split(",").map((arg) => arg.trim());

  args.forEach((arg) => {
    // Remove string literals (both single and double quotes)
    if (/^['"]/.test(arg)) return;

    // Remove numeric literals
    if (/^\d+/.test(arg)) return;

    // Extract variable name (handle dot notation, just get root)
    const identifierMatch = arg.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (identifierMatch) {
      variables.push(identifierMatch[1]);
    }
  });

  return variables;
};

/**
 * Traverses the DOM tree and collects all data binding expressions.
 * Looks for {property} placeholders in both text content and element attributes.
 */
const scanBindings = (host: HTMLElement | ShadowRoot): BindingDescriptor[] => {
  // TreeWalker efficiently traverses only text nodes
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
  const bindings: BindingDescriptor[] = [];
  let node: Text | null;

  // Helper function to check if a node is inside a $for loop element
  const isInsideLoopElement = (node: Node): boolean => {
    let current = node.parentElement;
    while (current) {
      if (current.hasAttribute && current.hasAttribute("$for")) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  };

  // Scan for text nodes with bindings
  // e.g. <p>{name}</p> or <span>{user.firstName}</span>
  while ((node = walker.nextNode() as Text | null)) {
    // Skip bindings inside $for loop elements - they'll be handled by processClonedElement
    if (isInsideLoopElement(node)) {
      continue;
    }

    const matches = [...node.textContent.matchAll(REGEX_PATTERNS.bindings)];

    if (matches.length > 0) {
      // Store the original template text before any replacements
      const original = node.textContent;

      // Create one binding descriptor per node with all its placeholders
      const nodeBindings = matches.map((match) => {
        const raw = match[1].trim();
        const isFunction = raw.includes("(") && raw.includes(")"); // Detect function calls like MyName("Peter")

        // Detect if this is a JavaScript expression (contains operators, method calls, etc.)
        // Note: We need to be careful with hyphens - they could be part of property names (data-note)
        // or subtraction operators. We check if hyphen is surrounded by word characters.
        const hasOperator =
          /[+*/%<>=!&|]/.test(raw) || // Math or logical operators (excluding hyphen)
          /\s-\s/.test(raw); // Hyphen with spaces around it (likely subtraction)

        // Check if starts with an operator (like !variable or typeof variable)
        const startsWithOperator = /^(!|typeof\s|void\s|delete\s)/.test(raw);

        const isExpression =
          hasOperator ||
          startsWithOperator || // Expressions starting with operators
          /\.(?![\s}])[a-zA-Z_$][\w]*\(/.test(raw) || // Method calls like name.toLowerCase()
          /\bnew\s+/.test(raw) || // Object instantiation like new Date()
          /\b(typeof|instanceof|void|delete)\b/.test(raw); // Other JS operators

        // For functions, extract the function name as the path
        // For properties, split by dot notation
        const path = isFunction
          ? [raw.split("(")[0].trim()] // Extract function name before (
          : raw.split(".").map((p) => p.trim());

        // Extract variables from function arguments
        const functionArgs = isFunction ? extractFunctionArguments(raw) : [];

        return { raw, path, isFunction, isExpression, functionArgs };
      });

      bindings.push({ node, bindings: nodeBindings, original });
    }
  } // Scan for attributes with bindings
  // e.g. <img src="{imageUrl}"> or <input value="{user.email}">
  const elements = host.querySelectorAll("*");
  elements.forEach((el) => {
    // Skip bindings on $for loop elements - they'll be handled by processClonedElement
    if (el.hasAttribute("$for") || isInsideLoopElement(el)) {
      return;
    }

    for (const attr of el.attributes) {
      // Skip conditional and special directive attributes
      if (
        attr.name === "$if" ||
        attr.name === "$else-if" ||
        attr.name === "$else" ||
        attr.name === "$bind"
      ) {
        continue;
      }

      const matches = [...attr.value.matchAll(REGEX_PATTERNS.bindings)];
      if (matches.length > 0) {
        // Store the original attribute value
        const original = attr.value;

        // Create one binding descriptor per attribute with all its placeholders
        const attrBindings = matches.map((match) => {
          const raw = match[1].trim();
          const isFunction = raw.includes("(") && raw.includes(")");

          // Detect if this is a JavaScript expression
          // Note: We need to be careful with hyphens - they could be part of property names
          const hasOperator =
            /[+*/%<>=!&|]/.test(raw) || // Math or logical operators (excluding hyphen)
            /\s-\s/.test(raw); // Hyphen with spaces around it (likely subtraction)

          // Check if starts with an operator (like !variable or typeof variable)
          const startsWithOperator = /^(!|typeof\s|void\s|delete\s)/.test(raw);

          const isExpression =
            hasOperator ||
            startsWithOperator || // Expressions starting with operators
            /\.(?![\s}])[a-zA-Z_$][\w]*\(/.test(raw) || // Method calls like name.toLowerCase()
            /\bnew\s+/.test(raw) || // Object instantiation like new Date()
            /\b(typeof|instanceof|void|delete)\b/.test(raw); // Other JS operators

          const path = isFunction
            ? [raw.split("(")[0].trim()]
            : raw.split(".").map((p) => p.trim());

          // Extract variables from function arguments
          const functionArgs = isFunction ? extractFunctionArguments(raw) : [];

          return { raw, path, isFunction, isExpression, functionArgs };
        });

        bindings.push({
          node: el as unknown as Text,
          bindings: attrBindings,
          original,
          isAttribute: true,
          attributeName: attr.name,
        });
      }
    }
  });

  return bindings;
};

/**
 * Scans for elements with $bind attribute for two-way data binding.
 * e.g. <input $bind="inputText"> or <input $bind="person.name">
 * Now also supports contenteditable elements: <div contenteditable $bind="text">
 */
const scanTwoWayBindings = (
  host: HTMLElement | ShadowRoot
): TwoWayBindingDescriptor[] => {
  const twoWayBindings: TwoWayBindingDescriptor[] = [];
  const elements = host.querySelectorAll("[\\$bind]");

  elements.forEach((el) => {
    const bindValue = el.getAttribute("$bind");
    if (!bindValue) return;

    const raw = bindValue.trim();
    const path = raw.split(".").map((p) => p.trim());

    // Support form inputs (input, textarea, select)
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      twoWayBindings.push({
        element: el,
        path,
        raw,
        isContentEditable: false,
        initialValue: el.value || "",
      });
      el.removeAttribute("$bind");
    }
    // Support contenteditable elements (including those with contenteditable="false" initially)
    else if (el instanceof HTMLElement && el.hasAttribute("contenteditable")) {
      twoWayBindings.push({
        element: el,
        path,
        raw,
        isContentEditable: true,
        initialValue: el.textContent?.trim() || "",
      });
      el.removeAttribute("$bind");
    }
  });

  return twoWayBindings;
};

/**
 * Scans for elements with $if, $else-if, and $else attributes for conditional rendering.
 * Groups related conditionals together (if → else-if → else chains).
 * e.g. <div $if="isVisible">...</div> or <div $else-if="count > 5">...</div>
 */
const scanConditionals = (
  host: HTMLElement | ShadowRoot
): ConditionalDescriptor[][] => {
  const allConditionals: ConditionalDescriptor[][] = [];
  const processedElements = new Set<Element>();

  // Find all $if elements (start of conditional chains)
  const ifElements = host.querySelectorAll("[\\$if]");

  ifElements.forEach((element) => {
    if (processedElements.has(element)) return;

    const group: ConditionalDescriptor[] = [];
    let currentElement: Element | null = element;

    // Process the $if and all following $else-if and $else siblings
    while (currentElement) {
      const hasIf = currentElement.hasAttribute("$if");
      const hasElseIf = currentElement.hasAttribute("$else-if");
      const hasElse = currentElement.hasAttribute("$else");

      if (!hasIf && !hasElseIf && !hasElse) break;

      processedElements.add(currentElement);

      let type: "if" | "else-if" | "else";
      let condition = "";

      if (hasIf) {
        type = "if";
        condition = currentElement.getAttribute("$if") || "";
        currentElement.removeAttribute("$if");
      } else if (hasElseIf) {
        type = "else-if";
        condition = currentElement.getAttribute("$else-if") || "";
        currentElement.removeAttribute("$else-if");
      } else {
        type = "else";
        currentElement.removeAttribute("$else");
      }

      // Create a comment placeholder to mark the position
      const placeholder = document.createComment(
        `conditional:${type}:${condition}`
      );

      const parent = currentElement.parentElement || host;
      const nextSibling = currentElement.nextSibling;

      // Insert placeholder before the element
      parent.insertBefore(placeholder, currentElement);

      const descriptor: ConditionalDescriptor = {
        element: currentElement as Element,
        condition: condition.trim(),
        type,
        placeholder,
        group: [], // Will be set after the group is complete
        originalParent: parent as Element | ShadowRoot,
        nextSibling,
      };

      group.push(descriptor);

      // Move to the next sibling to check for $else-if or $else
      const next: Element | null = currentElement.nextElementSibling;

      // Remove element from DOM initially
      currentElement.remove();

      currentElement = next;

      // If next element isn't $else-if or $else, stop the chain
      if (
        next &&
        !next.hasAttribute("$else-if") &&
        !next.hasAttribute("$else")
      ) {
        break;
      }
    }

    // Set the group reference for all descriptors in this chain
    group.forEach((desc) => {
      desc.group = group;
    });

    allConditionals.push(group);
  });

  return allConditionals;
};

/**
 * Extracts variable names from conditional expressions.
 * Removes curly braces and extracts identifiers.
 * e.g., "{sending}" → ["sending"], "{count > 5}" → ["count"]
 */
export const extractConditionalVariables = (
  conditionalGroups: ConditionalDescriptor[][]
): Set<string> => {
  const variables = new Set<string>();

  conditionalGroups.forEach((group) => {
    group.forEach((descriptor) => {
      let condition = descriptor.condition;

      // Remove curly braces: {sending} → sending
      condition = condition.replace(/\{([^}]+)\}/g, "$1");

      // Extract variable names (identifiers)
      // Match JavaScript identifiers but exclude keywords and literals
      const identifierRegex =
        /\b([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\b/g;
      const keywords = new Set([
        "true",
        "false",
        "null",
        "undefined",
        "typeof",
        "instanceof",
        "new",
        "return",
        "if",
        "else",
        "for",
        "while",
        "do",
        "switch",
        "case",
        "break",
        "continue",
      ]);

      let match;
      while ((match = identifierRegex.exec(condition)) !== null) {
        const identifier = match[1];
        const rootVar = identifier.split(".")[0]; // Get root variable name

        // Skip keywords and literals
        if (!keywords.has(rootVar)) {
          variables.add(rootVar);
        }
      }
    });
  });

  return variables;
};

/**
 * Scans for elements with $for attribute for list rendering.
 * Supports syntax: "item in items" or "(item, index) in items"
 * e.g. <li $for="item in items">{item}</li>
 * e.g. <div $for="(user, index) in users">{index}: {user.name}</div>
 */
const scanLoops = (host: HTMLElement | ShadowRoot): LoopDescriptor[] => {
  const loops: LoopDescriptor[] = [];
  const loopElements = host.querySelectorAll("[\\$for]");

  loopElements.forEach((element) => {
    const forExpression = element.getAttribute("$for");
    if (!forExpression) return;

    const keyAttribute = element.getAttribute("$key") || undefined;

    // Parse the expression: "item in items" or "(item, index) in items"
    const match = forExpression.match(
      /^\s*(?:\(([^,]+),\s*([^)]+)\)|([^\s]+))\s+(?:in|of)\s+(.+)\s*$/
    );

    if (!match) {
      logParseError(`Invalid $for expression: "${forExpression}"`, {
        expression: forExpression,
        lineHint: "$for attribute parsing",
      });
      return;
    }

    const itemName = (match[1] || match[3]).trim();
    const indexName = match[2]?.trim();
    const arrayName = match[4].trim();

    // Create a comment placeholder
    const placeholder = document.createComment(`loop:${forExpression}`);

    const parent = element.parentElement || host;
    parent.insertBefore(placeholder, element);

    // Remove the $for and $key attributes
    element.removeAttribute("$for");
    if (keyAttribute) element.removeAttribute("$key");

    // Remove the element from DOM (it will be cloned for each iteration)
    element.remove();

    const descriptor: LoopDescriptor = {
      template: element as Element,
      expression: forExpression,
      itemName,
      indexName,
      arrayName,
      keyAttribute,
      placeholder,
      renderedElements: [],
      originalParent: parent as Element | ShadowRoot,
    };

    loops.push(descriptor);
  });

  return loops;
};

/**
 * Extracts variable names from loop expressions.
 * e.g., "item in items" → ["items"], "(user, index) in users" → ["users"]
 */
export const extractLoopVariables = (loops: LoopDescriptor[]): Set<string> => {
  const variables = new Set<string>();

  loops.forEach((loop) => {
    // Add the array name as a variable to watch
    const rootVar = loop.arrayName.split(".")[0];
    variables.add(rootVar);
  });

  return variables;
};
