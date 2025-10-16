import {
  BindingDescriptor,
  ConditionalDescriptor,
  LoopDescriptor,
} from "../../types/LadrilloTypes";
import { getCachedFunction } from "../../cache/functionCache";
import {
  logBindingError,
  logEventHandlerError,
  logConditionalError,
  logLoopError,
  createErrorContext,
} from "../../utils/devErrors";

/**
 * Safely retrieves a nested value from an object using a path array.
 * Example: getValue({ user: { name: 'John' } }, ['user', 'name']) returns 'John'
 */
const getValue = (ctx: unknown, path: string[]): unknown => {
  return path.reduce<unknown>((acc: unknown, segment: string) => {
    // Stop traversal if we hit null/undefined or non-object
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, ctx);
};

/**
 * Safely sets a nested value in an object using a path array.
 * Example: setValue({ user: {} }, ['user', 'name'], 'John') sets user.name to 'John'
 * Creates intermediate objects if they don't exist.
 */
export const setValue = (ctx: any, path: string[], value: unknown): void => {
  if (path.length === 0) return;

  // Navigate to the parent object
  const lastKey = path[path.length - 1];
  const parentPath = path.slice(0, -1);

  let current = ctx;

  // Create intermediate objects if needed
  for (const segment of parentPath) {
    if (current[segment] === undefined || current[segment] === null) {
      current[segment] = {};
    }
    current = current[segment];
  }

  // Set the final value
  current[lastKey] = value;
};

/**
 * Updates all DOM bindings with values from the current state context.
 * Replaces {property.path} placeholders in text nodes and element attributes.
 * Always renders from the original template to support reactive updates.
 */
export const renderBindings = (
  bindings: BindingDescriptor[],
  context: unknown,
  component?: any
): void => {
  // Early exit if no bindings
  if (bindings.length === 0) return;

  for (const binding of bindings) {
    // Start with the original template
    let result = binding.original;
    let lastValue: unknown; // Track the last evaluated value for boolean attributes
    let hasUndefinedBinding = false; // Track if any binding is undefined

    // Replace all placeholders in this node
    for (const { raw, path, isFunction, isExpression } of binding.bindings) {
      let value: unknown;
      let skipReplacement = false;

      if (isExpression || isFunction) {
        // Execute JavaScript expressions like i + 1, name.toLowerCase(), MyName("Peter")
        // or !filename (negation), etc.
        try {
          // Use cached function to prevent memory leaks
          const evalFunc = getCachedFunction(raw);
          // Pass component directly (don't spread - we need the property descriptors)
          // The with(component) scope in getCachedFunction will access properties correctly
          value = evalFunc(component || context);
          // For expressions/functions, we always replace even if the result is undefined
          // because the expression was successfully evaluated
        } catch (error) {
          logBindingError(raw, error as Error, createErrorContext(component));
          value = undefined;
          skipReplacement = true;
        }
      } else {
        // Simple property access (e.g., {filename}, {user.name})
        value = getValue(context, path);

        // Only skip replacement if it's a simple property and the value is undefined
        // This preserves the {placeholder} for missing values
        if (value === undefined) {
          skipReplacement = true;
        }
      }

      // If we should skip replacement, mark it and continue
      if (skipReplacement) {
        hasUndefinedBinding = true;
        continue;
      }

      const replacement = String(value ?? "");

      // Track last value for boolean attribute handling
      lastValue = value;

      // Replace this specific placeholder
      result = result.replace(`{${raw}}`, replacement);
    }

    // If all bindings are undefined, show the original template with placeholders
    if (hasUndefinedBinding && result === binding.original) {
      // Don't modify - keep the original {placeholder} visible
    }

    // Apply the final result to the DOM
    if (binding.node.nodeType === Node.TEXT_NODE) {
      const textNode = binding.node as Text;
      const parentElement = textNode.parentElement;

      // Check if this looks like HTML content
      const isHTMLContent =
        result.trim().startsWith("<") && result.includes(">");

      // If parent element exists and content is HTML, render as HTML
      if (parentElement && isHTMLContent) {
        // Only update if content changed
        if (parentElement.innerHTML !== result) {
          parentElement.innerHTML = result;
        }
      } else {
        // Only update if content changed
        if (textNode.textContent !== result) {
          textNode.textContent = result;
        }
      }
    } else {
      // Handle attribute bindings (e.g., <img src="{imageUrl}">)
      const element = binding.node as unknown as Element;
      if (binding.isAttribute && binding.attributeName) {
        // Handle boolean attributes (disabled, checked, readonly, required, etc.)
        const booleanAttributes = [
          "disabled",
          "checked",
          "readonly",
          "required",
          "selected",
          "hidden",
          "open",
          "autofocus",
          "autoplay",
          "controls",
          "loop",
          "muted",
        ];

        if (booleanAttributes.includes(binding.attributeName.toLowerCase())) {
          // For boolean attributes: use the original value, not the stringified result
          const boolValue =
            typeof lastValue === "boolean"
              ? lastValue
              : lastValue === "true" || lastValue === "True";
          if (boolValue) {
            element.setAttribute(binding.attributeName, "");
          } else {
            element.removeAttribute(binding.attributeName);
          }
        } else {
          // For regular attributes, just set the value
          element.setAttribute(binding.attributeName, result);
        }
      }
    }
  }
};

/**
 * Evaluates a conditional expression in the context of the component.
 * Supports both simple boolean checks and complex expressions.
 * e.g. "isVisible", "{isVisible}", "count > 5", "{count} > 5"
 */
const evaluateCondition = (
  condition: string,
  context: unknown,
  component?: any
): boolean => {
  if (!condition) return true; // $else has no condition

  // Remove curly braces if present: {sending} -> sending
  let processedCondition = condition.trim();

  // Replace all {variable} with just variable
  processedCondition = processedCondition.replace(/\{([^}]+)\}/g, "$1");

  try {
    // Replace variable references in the condition with their values
    // This is a simple approach - for production, consider a proper expression parser
    const func = new Function(
      "context",
      "component",
      `
      with (context) {
        try {
          return Boolean(${processedCondition});
        } catch (e) {
          return false;
        }
      }
    `
    );

    return func(context, component);
  } catch (error) {
    logConditionalError(
      condition,
      error as Error,
      createErrorContext(component)
    );
    return false;
  }
};

/**
 * Processes event handlers on an element and its descendants.
 * Converts inline event attributes to proper event listeners with component scope access.
 */
const processElementEventHandlers = (
  element: Element,
  component: any
): void => {
  const eventTypes = [
    "click",
    "dblclick",
    "mousedown",
    "mouseup",
    "mouseover",
    "mouseout",
    "mousemove",
    "mouseenter",
    "mouseleave",
    "keydown",
    "keyup",
    "keypress",
    "focus",
    "blur",
    "change",
    "input",
    "submit",
    "reset",
    "scroll",
    "resize",
    "load",
    "unload",
    "touchstart",
    "touchend",
    "touchmove",
    "touchcancel",
    "dragstart",
    "drag",
    "dragend",
    "dragenter",
    "dragover",
    "dragleave",
    "drop",
  ];

  // Process the element itself and all descendants
  const elementsToProcess = [element, ...element.querySelectorAll("*")];

  elementsToProcess.forEach((el) => {
    eventTypes.forEach((eventType) => {
      const attributeName = `on${eventType}`;
      const handlerCode = el.getAttribute(attributeName);

      if (handlerCode) {
        // Skip if already processed
        const key = `__processed_${attributeName}`;
        if ((el as any)[key]) return;

        // Remove the attribute
        el.removeAttribute(attributeName);

        // Add event listener with component scope
        (el as HTMLElement).addEventListener(
          eventType,
          function (this: HTMLElement, event: Event) {
            try {
              const func = new Function(
                "event",
                "component",
                `
                with(component) {
                  ${handlerCode}
                }
              `
              );
              func.call(this, event, component);
            } catch (error) {
              logEventHandlerError(
                eventType,
                handlerCode,
                error as Error,
                createErrorContext(component, {
                  elementTag: el.tagName.toLowerCase(),
                })
              );
            }
          }
        );

        // Mark as processed
        (el as any)[key] = true;
      }
    });
  });
};

/**
 * Updates conditional rendering based on current state.
 * Shows/hides elements based on their $if, $else-if, $else conditions.
 */
export const renderConditionals = (
  conditionalGroups: ConditionalDescriptor[][],
  context: unknown,
  component?: any
): void => {
  // Process each conditional group (if/else-if/else chain)
  for (const group of conditionalGroups) {
    let conditionMet = false;

    // Evaluate each condition in the group
    for (const descriptor of group) {
      const { element, condition, type, placeholder, originalParent } =
        descriptor;

      // Check if this condition should be rendered
      let shouldRender = false;

      if (type === "else") {
        // $else renders if no previous condition was met
        shouldRender = !conditionMet;
      } else if (!conditionMet) {
        // $if or $else-if: evaluate condition
        shouldRender = evaluateCondition(condition, context, component);
        if (shouldRender) conditionMet = true;
      }

      // Update DOM based on shouldRender
      const isInDOM = element.parentNode !== null;

      if (shouldRender && !isInDOM) {
        // Insert element after its placeholder
        placeholder.parentNode?.insertBefore(element, placeholder.nextSibling);

        // Process event handlers on newly inserted element
        if (component) {
          processElementEventHandlers(element, component);
        }
      } else if (!shouldRender && isInDOM) {
        // Remove element from DOM
        element.remove();
      }
    }
  }
};

/**
 * Renders loop elements based on array data.
 * Creates clones of the template for each item in the array.
 */
export const renderLoops = (
  loops: LoopDescriptor[],
  context: unknown,
  component?: any
): void => {
  for (const loop of loops) {
    const {
      template,
      itemName,
      indexName,
      arrayName,
      placeholder,
      renderedElements,
    } = loop;

    // Get the array data from context
    const arrayData = getValue(context, arrayName.split("."));

    // Validate array - only warn if the value exists but is not an array
    // (undefined values are expected during initial render before scripts execute)
    if (arrayData !== undefined && !Array.isArray(arrayData)) {
      logLoopError(
        `${itemName} in ${arrayName}`,
        new Error(`"${arrayName}" is not an array, got: ${typeof arrayData}`),
        createErrorContext(component, {
          lineHint: `$for loop in template`,
        })
      );
      // Clear any existing rendered elements
      renderedElements.forEach((el) => el.remove());
      renderedElements.length = 0;
      return;
    }

    // If array doesn't exist yet, don't render anything (wait for state initialization)
    if (!arrayData) {
      return;
    }

    // Remove all currently rendered elements
    renderedElements.forEach((el) => el.remove());
    renderedElements.length = 0;

    // Render each item
    arrayData.forEach((item, index) => {
      // Clone the template
      const clone = template.cloneNode(true) as Element;

      // Create a scoped context for this iteration
      const scopedContext: Record<string, any> = {
        ...(context as Record<string, any>),
        [itemName]: item,
      };

      if (indexName) {
        scopedContext[indexName] = index;
      }

      // Process bindings in the cloned element
      processClonedElement(clone, scopedContext, component);

      // Insert after placeholder (or after the last rendered element)
      const insertAfter =
        renderedElements.length > 0
          ? renderedElements[renderedElements.length - 1]
          : placeholder;

      insertAfter.parentNode?.insertBefore(clone, insertAfter.nextSibling);

      // Track rendered element
      renderedElements.push(clone);

      // Process event handlers
      if (component) {
        processElementEventHandlers(clone, component);
      }
    });
  }
};

/**
 * Processes bindings in a cloned element for loop rendering.
 * Replaces {variable} placeholders with actual values.
 */
const processClonedElement = (
  element: Element,
  context: unknown,
  component?: any
): void => {
  // Process text nodes
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent && node.textContent.includes("{")) {
      let result = node.textContent;
      const matches = [...node.textContent.matchAll(/\{([^}]+)\}/g)];

      matches.forEach((match) => {
        const raw = match[1].trim();

        // Detect if this is a JavaScript expression
        const isFunction = raw.includes("(") && raw.includes(")");
        const hasOperator = /[+*/%<>=!&|]/.test(raw) || /\s-\s/.test(raw);
        const isExpression =
          hasOperator ||
          /\.(?![\s}])[a-zA-Z_$][\w]*\(/.test(raw) || // Method calls
          /\bnew\s+/.test(raw) || // Object instantiation like new Date()
          /\b(typeof|instanceof|void|delete)\b/.test(raw); // Other JS operators

        let value: unknown;

        if (isExpression || isFunction) {
          // Execute JavaScript expressions
          try {
            const evalFunc = getCachedFunction(raw);
            const scope =
              typeof context === "object" && context !== null
                ? { ...context, ...(component || {}) }
                : component || {};
            value = evalFunc(scope);
          } catch (error) {
            logBindingError(
              raw,
              error as Error,
              createErrorContext(component, {
                lineHint: `$for loop template binding`,
              })
            );
            value = undefined;
          }
        } else {
          // Simple property access
          const path = raw.split(".").map((p) => p.trim());
          value = getValue(context, path);
        }

        if (value !== undefined) {
          result = result.replace(`{${raw}}`, String(value ?? ""));
        }
      });

      node.textContent = result;
    }
  }

  // Process attributes (including event handlers with loop variables)
  const elementsWithBindings = [element, ...element.querySelectorAll("*")];
  elementsWithBindings.forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.value.includes("{")) {
        let result = attr.value;
        const matches = [...attr.value.matchAll(/\{([^}]+)\}/g)];

        matches.forEach((match) => {
          const raw = match[1].trim();

          // Detect if this is a JavaScript expression
          const isFunction = raw.includes("(") && raw.includes(")");
          const hasOperator = /[+*/%<>=!&|]/.test(raw) || /\s-\s/.test(raw);
          const isExpression =
            hasOperator ||
            /\.(?![\s}])[a-zA-Z_$][\w]*\(/.test(raw) || // Method calls
            /\bnew\s+/.test(raw) || // Object instantiation like new Date()
            /\b(typeof|instanceof|void|delete)\b/.test(raw); // Other JS operators

          let value: unknown;

          if (isExpression || isFunction) {
            // Execute JavaScript expressions
            try {
              const evalFunc = getCachedFunction(raw);
              const scope =
                typeof context === "object" && context !== null
                  ? { ...context, ...(component || {}) }
                  : component || {};
              value = evalFunc(scope);
            } catch (error) {
              logBindingError(
                raw,
                error as Error,
                createErrorContext(component, {
                  attributeName: attr.name,
                  lineHint: `$for loop attribute binding`,
                })
              );
              value = undefined;
            }
          } else {
            // Simple property access
            const path = raw.split(".").map((p) => p.trim());
            value = getValue(context, path);
          }

          if (value !== undefined) {
            result = result.replace(`{${raw}}`, String(value ?? ""));
          }
        });

        el.setAttribute(attr.name, result);
      }
    });
  });
};
