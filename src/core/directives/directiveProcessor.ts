/**
 * LadrillosJS Directive Processor
 *
 * Handles all template directives:
 * - $for: Loop rendering
 * - $if/$else-if/$else: Conditional rendering
 * - $show: CSS visibility toggle
 * - $bind: Two-way data binding
 * - $ref: Element references
 */

import {
  ConditionalDescriptor,
  LoopDescriptor,
  TwoWayBindingDescriptor,
} from "../../types";
import {
  FOR_DIRECTIVE,
  IF_DIRECTIVE,
  ELSE_DIRECTIVE,
  ELSE_IF_DIRECTIVE,
  SHOW_DIRECTIVE,
  BIND_DIRECTIVE,
  REF_DIRECTIVE,
  DIRECTIVE_PATTERNS,
  escapeCssSelector,
} from "../../utils/directives";
import { EVENT_ATTRIBUTES } from "../../utils/jsevents";
import {
  extractFunctionDefinitions,
  extractVariableNames,
} from "../js/scriptParser";

// ============================================================================
// Types
// ============================================================================

export type RefMap = Map<string, HTMLElement>;

export type DirectiveContext = {
  loops: LoopDescriptor[];
  conditionals: ConditionalDescriptor[][];
  twoWayBindings: TwoWayBindingDescriptor[];
  refs: RefMap;
  showElements: ShowDescriptor[];
};

/**
 * Registry for two-way bindings.
 * Maps state keys to the elements bound to them.
 */
export type TwoWayBindingRegistry = Map<
  string,
  Array<{
    element: HTMLElement;
    path: string[];
    isContentEditable?: boolean;
  }>
>;

export type ShowDescriptor = {
  element: HTMLElement;
  expression: string;
  originalDisplay: string;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Strips curly braces from a binding expression.
 * e.g., "{!isLoggedIn}" -> "!isLoggedIn"
 *       "isLoggedIn" -> "isLoggedIn" (no change if no braces)
 */
function stripBindingBraces(expression: string): string {
  const trimmed = expression.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

// ============================================================================
// Main Directive Scanner
// ============================================================================

/**
 * Scans the template for all directives and returns descriptors for each.
 * This should be called after the template HTML is injected into the DOM.
 */
export function scanDirectives(
  host: HTMLElement | ShadowRoot
): DirectiveContext {
  const context: DirectiveContext = {
    loops: [],
    conditionals: [],
    twoWayBindings: [],
    refs: new Map(),
    showElements: [],
  };

  // Process in order: refs first, then loops (so we can skip loop internals),
  // then conditionals, then show, then bind
  scanRefs(host, context);
  scanLoops(host, context);
  scanConditionals(host, context);
  scanShow(host, context);
  scanTwoWayBindings(host, context);

  return context;
}

// ============================================================================
// $ref Directive
// ============================================================================

/**
 * Scans for $ref directives and creates element references.
 *
 * Usage: <input $ref="inputElement">
 * Access: $refs.inputElement (preferred) or $refs.get('inputElement')
 */
function scanRefs(
  host: HTMLElement | ShadowRoot,
  context: DirectiveContext
): void {
  const elements = Array.from(
    host.querySelectorAll(`[${escapeCssSelector(REF_DIRECTIVE)}]`)
  );

  for (const element of elements) {
    const refName = element.getAttribute(REF_DIRECTIVE);
    if (refName) {
      context.refs.set(refName, element as HTMLElement);
      // Remove the directive attribute from DOM
      element.removeAttribute(REF_DIRECTIVE);
    }
  }
}

// ============================================================================
// $for Directive
// ============================================================================

/**
 * Scans for $for directives and creates loop descriptors.
 *
 * Syntax:
 *   $for="item in items"
 *   $for="(item, index) in items"
 *   $for="(value, key, index) in object"
 */
function scanLoops(
  host: HTMLElement | ShadowRoot,
  context: DirectiveContext
): void {
  const elements = Array.from(
    host.querySelectorAll(`[${escapeCssSelector(FOR_DIRECTIVE)}]`)
  );

  for (const element of elements) {
    const expression = element.getAttribute(FOR_DIRECTIVE);
    if (!expression) continue;

    const parsed = parseForExpression(expression);
    if (!parsed) {
      console.warn(`Invalid $for expression: "${expression}"`);
      continue;
    }

    // Create a comment placeholder
    const placeholder = document.createComment(` $for: ${expression} `);
    const parent = element.parentElement || host;

    // Insert placeholder before the element
    parent.insertBefore(placeholder, element);

    // Remove the element from DOM (will be cloned for each item)
    element.remove();

    // Remove the $for attribute from the template
    element.removeAttribute(FOR_DIRECTIVE);

    const descriptor: LoopDescriptor = {
      template: element as Element,
      expression,
      itemName: parsed.item,
      indexName: parsed.index,
      arrayName: parsed.array,
      keyAttribute: parsed.key,
      placeholder,
      renderedElements: [],
      originalParent: parent as Element | ShadowRoot,
    };

    context.loops.push(descriptor);
  }
}

/**
 * Parses a $for expression into its components.
 *
 * Examples:
 *   "item in items" → { item: "item", array: "items" }
 *   "(item, index) in items" → { item: "item", index: "index", array: "items" }
 *   "{ id, name } in users" → { item: "{ id, name }", array: "users" }
 */
function parseForExpression(expression: string): {
  item: string;
  index?: string;
  key?: string;
  array: string;
} | null {
  const match = expression.match(DIRECTIVE_PATTERNS.forAlias);
  if (!match) return null;

  let [, lhs, rhs] = match;
  lhs = lhs.trim();
  rhs = rhs.trim();

  // Extract key if present: "item in items track by item.id"
  let key: string | undefined;
  const trackMatch = rhs.match(/\s+track\s+by\s+(.+)$/i);
  if (trackMatch) {
    key = trackMatch[1].trim();
    rhs = rhs.slice(0, trackMatch.index).trim();
  }

  // Strip parentheses: "(item, index)" → "item, index"
  const stripped = lhs.replace(DIRECTIVE_PATTERNS.stripParens, "").trim();

  // Check for index: "item, index"
  const iteratorMatch = stripped.match(DIRECTIVE_PATTERNS.forIterator);

  let item: string;
  let index: string | undefined;
  let thirdParam: string | undefined;

  if (iteratorMatch) {
    // Has comma-separated values
    item = stripped.replace(DIRECTIVE_PATTERNS.forIterator, "").trim();
    index = iteratorMatch[1]?.trim();
    thirdParam = iteratorMatch[2]?.trim();
  } else {
    item = stripped;
  }

  return {
    item,
    index: index || thirdParam, // Support both (item, index) and (value, key, index)
    key,
    array: rhs,
  };
}

// ============================================================================
// $if / $else-if / $else Directives
// ============================================================================

/**
 * Scans for conditional directives and groups them together.
 *
 * A conditional group is:
 *   <div $if="condition">...</div>
 *   <div $else-if="another">...</div>  (optional, multiple allowed)
 *   <div $else>...</div>               (optional, must be last)
 */
function scanConditionals(
  host: HTMLElement | ShadowRoot,
  context: DirectiveContext
): void {
  // Find all $if elements (these start conditional groups)
  const ifElements = Array.from(
    host.querySelectorAll(`[${escapeCssSelector(IF_DIRECTIVE)}]`)
  );

  for (const ifElement of ifElements) {
    // Skip if inside a loop template (will be processed when loop renders)
    if (isInsideUnprocessedLoop(ifElement, context)) continue;

    const group: ConditionalDescriptor[] = [];
    const rawCondition = ifElement.getAttribute(IF_DIRECTIVE)!;
    // Strip curly braces if present (e.g., "{!isLoggedIn}" -> "!isLoggedIn")
    const condition = stripBindingBraces(rawCondition);

    // Create placeholder for the group
    const placeholder = document.createComment(` $if: ${condition} `);
    const parent = ifElement.parentElement || host;
    const nextSibling = ifElement.nextSibling;

    // Insert placeholder before the if element
    parent.insertBefore(placeholder, ifElement);

    // Add $if to group
    group.push(
      createConditionalDescriptor(
        ifElement as Element,
        condition,
        "if",
        placeholder,
        parent as Element | ShadowRoot,
        nextSibling
      )
    );

    // Look for following $else-if and $else elements
    let current = ifElement.nextElementSibling;
    while (current) {
      if (current.hasAttribute(ELSE_IF_DIRECTIVE)) {
        const rawElseIfCondition = current.getAttribute(ELSE_IF_DIRECTIVE)!;
        const elseIfCondition = stripBindingBraces(rawElseIfCondition);
        const next = current.nextElementSibling;
        group.push(
          createConditionalDescriptor(
            current,
            elseIfCondition,
            "else-if",
            placeholder,
            parent as Element | ShadowRoot,
            current.nextSibling
          )
        );
        current.remove();
        current = next;
      } else if (current.hasAttribute(ELSE_DIRECTIVE)) {
        group.push(
          createConditionalDescriptor(
            current,
            "",
            "else",
            placeholder,
            parent as Element | ShadowRoot,
            current.nextSibling
          )
        );
        current.remove();
        break; // $else must be last
      } else {
        break; // Not part of this conditional group
      }
    }

    // Remove $if element from DOM
    ifElement.remove();

    // Store group reference in each descriptor
    for (const desc of group) {
      desc.group = group;
    }

    context.conditionals.push(group);
  }
}

function createConditionalDescriptor(
  element: Element,
  condition: string,
  type: "if" | "else-if" | "else",
  placeholder: Comment,
  parent: Element | ShadowRoot,
  nextSibling: Node | null
): ConditionalDescriptor {
  // Remove directive attribute
  element.removeAttribute(IF_DIRECTIVE);
  element.removeAttribute(ELSE_IF_DIRECTIVE);
  element.removeAttribute(ELSE_DIRECTIVE);

  return {
    element,
    condition,
    type,
    placeholder,
    group: [], // Will be filled in after
    originalParent: parent,
    nextSibling,
  };
}

// ============================================================================
// $show Directive
// ============================================================================

/**
 * Scans for $show directives.
 * Unlike $if, $show keeps the element in DOM and toggles CSS display.
 */
function scanShow(
  host: HTMLElement | ShadowRoot,
  context: DirectiveContext
): void {
  const elements = Array.from(
    host.querySelectorAll(`[${escapeCssSelector(SHOW_DIRECTIVE)}]`)
  );

  for (const element of elements) {
    const rawExpression = element.getAttribute(SHOW_DIRECTIVE);
    if (!rawExpression) continue;

    // Strip curly braces if present
    const expression = stripBindingBraces(rawExpression);

    // Skip if inside a loop template
    if (isInsideUnprocessedLoop(element, context)) continue;

    const htmlElement = element as HTMLElement;

    context.showElements.push({
      element: htmlElement,
      expression,
      originalDisplay: htmlElement.style.display || "",
    });

    // Remove directive attribute
    element.removeAttribute(SHOW_DIRECTIVE);
  }
}

// ============================================================================
// $bind Directive (Two-way Binding)
// ============================================================================

/**
 * Scans for $bind directives on form elements.
 * Creates two-way bindings between input values and reactive state.
 */
function scanTwoWayBindings(
  host: HTMLElement | ShadowRoot,
  context: DirectiveContext
): void {
  const elements = Array.from(
    host.querySelectorAll(`[${escapeCssSelector(BIND_DIRECTIVE)}]`)
  );

  for (const element of elements) {
    const expression = element.getAttribute(BIND_DIRECTIVE);
    if (!expression) continue;

    // Skip if inside a loop template
    if (isInsideUnprocessedLoop(element, context)) continue;

    const path = expression.split(".");
    const isContentEditable = element.hasAttribute("contenteditable");

    const descriptor: TwoWayBindingDescriptor = {
      element: element as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement,
      path,
      raw: expression,
      isContentEditable,
    };

    context.twoWayBindings.push(descriptor);

    // Remove directive attribute
    element.removeAttribute(BIND_DIRECTIVE);
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Checks if an element is inside a loop that hasn't been processed yet.
 */
function isInsideUnprocessedLoop(
  element: Element,
  context: DirectiveContext
): boolean {
  let current = element.parentElement;
  while (current) {
    if (current.hasAttribute(FOR_DIRECTIVE)) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

// ============================================================================
// Directive Executors
// ============================================================================

/**
 * Renders all loops with the current state.
 */
export function renderLoops(
  loops: LoopDescriptor[],
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>
  ) => unknown
): void {
  for (const loop of loops) {
    renderLoop(loop, state, evaluateExpression);
  }
}

/**
 * Renders a single loop.
 */
function renderLoop(
  loop: LoopDescriptor,
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>
  ) => unknown
): void {
  // Clear previously rendered elements
  for (const el of loop.renderedElements) {
    el.remove();
  }
  loop.renderedElements = [];

  // Get the array to iterate over
  const arrayValue = evaluateExpression(loop.arrayName, state);

  if (!arrayValue || !isIterable(arrayValue)) {
    return;
  }

  const items = Array.from(arrayValue as Iterable<unknown>);
  const fragment = document.createDocumentFragment();

  items.forEach((item, index) => {
    // Clone the template
    const clone = loop.template.cloneNode(true) as Element;

    const scriptContentFromState = (state as any).__scriptContent;

    // Create a scoped context with loop variables
    // Include __reactiveState__ reference so event handlers can sync back to it
    const loopContext: Record<string, unknown> = {
      ...state,
      [loop.itemName]: item,
      __reactiveState__: state, // Reference to the original reactive state for sync-back
      __scriptContent__: scriptContentFromState || "",
      __componentUrl__: (state as any).__componentUrl || "",
    };

    if (loop.indexName) {
      loopContext[loop.indexName] = index;
    }

    // Process bindings within the clone
    processElementBindings(clone, loopContext, evaluateExpression);

    fragment.appendChild(clone);
    loop.renderedElements.push(clone);
  });

  // Insert all elements after the placeholder
  loop.placeholder.parentNode?.insertBefore(
    fragment,
    loop.placeholder.nextSibling
  );
}

/**
 * Processes {bindings} within an element and its children.
 * Also transforms inline event handlers (onclick, etc.) to work with component scope.
 */
function processElementBindings(
  element: Element,
  context: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>
  ) => unknown
): void {
  // Process attributes - first replace bindings, then transform event handlers
  for (const attr of Array.from(element.attributes)) {
    if (attr.value.includes("{")) {
      const newValue = attr.value.replace(/\{([^}]+)\}/g, (_, expr) => {
        const result = evaluateExpression(expr.trim(), context);
        return String(result ?? "");
      });
      attr.value = newValue;
    }
  }

  // Transform inline event handlers (onclick, etc.) into proper event listeners
  // This makes onclick="sendMessage('{suggestion}')" work in loops
  transformLoopEventHandlers(element, context);

  // Process text nodes
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent?.includes("{")) {
      textNodes.push(node);
    }
  }

  for (const textNode of textNodes) {
    textNode.textContent = textNode.textContent!.replace(
      /\{([^}]+)\}/g,
      (_, expr) => {
        const result = evaluateExpression(expr.trim(), context);
        return String(result ?? "");
      }
    );
  }

  // Recursively process child elements
  for (const child of Array.from(element.children)) {
    processElementBindings(child, context, evaluateExpression);
  }
}

/**
 * Transforms inline event handlers (onclick, oninput, etc.) on an element
 * into proper event listeners with access to component scope.
 *
 * This is called during loop rendering to make syntax like:
 *   onclick="sendMessage('{suggestion}')"
 * work correctly - the binding is already replaced with the actual value.
 */
function transformLoopEventHandlers(
  element: Element,
  context: Record<string, unknown>
): void {
  for (const attrName of EVENT_ATTRIBUTES) {
    const handlerCode = element.getAttribute(attrName);

    if (handlerCode) {
      // Remove the attribute so browser doesn't try to eval it globally
      element.removeAttribute(attrName);

      // onclick → click
      const eventName = attrName.slice(2);

      // Create event listener with component context
      const handler = createLoopEventHandler(handlerCode, context);
      if (handler) {
        element.addEventListener(eventName, handler);
      }
    }
  }
}

/**
 * Creates an event handler function for loop-rendered elements.
 * The handler has access to the loop context (including loop variables and functions).
 *
 * IMPORTANT: Functions from the original script need to be re-created with access
 * to the reactive state, otherwise they operate on stale closure variables.
 */
function createLoopEventHandler(
  code: string,
  context: Record<string, unknown>
): ((event: Event) => void) | null {
  try {
    // Get reactive state and script content from context (set by renderLoop)
    const reactiveState = context.__reactiveState__ as
      | Record<string, unknown>
      | undefined;
    const scriptContent = (context.__scriptContent__ as string) || "";

    // Separate functions from variables in context (skip internal markers)
    const contextKeys = Object.keys(context).filter(
      (key) => !key.startsWith("__")
    );

    // Get list of state variable names (excluding loop variables and functions)
    const stateVarNames = reactiveState
      ? Object.keys(reactiveState).filter(
          (key) =>
            !key.startsWith("__") && typeof reactiveState[key] !== "function"
        )
      : [];

    // Get loop-specific variables (item, index, etc.) - these are in context but not in state
    const loopVarNames = contextKeys.filter(
      (key) =>
        !stateVarNames.includes(key) && typeof context[key] !== "function"
    );

    // All variable names for destructuring
    const allVarNames = [...stateVarNames, ...loopVarNames];

    // If we have script content, re-create functions so they work with reactive state
    // Otherwise, destructure functions from context (fallback for module scripts)
    const hasScriptContent = scriptContent.trim().length > 0;
    const funcNames = contextKeys.filter(
      (key) => typeof context[key] === "function"
    );

    // Check if we have module script functions (they manage state directly)
    const hasModuleScripts =
      reactiveState && (reactiveState as any).__hasModuleScripts === true;

    let funcDefs = "";
    let destructureFuncs = "";

    if (hasModuleScripts) {
      // Module script functions are reactive - just destructure them
      destructureFuncs =
        funcNames.length > 0
          ? `const { ${funcNames.join(", ")} } = context;`
          : "";
    } else if (hasScriptContent) {
      // Regular scripts: re-create functions from script content so they
      // work with the local variables that will be synced back to state
      funcDefs = extractFunctionDefinitions(scriptContent, []);
    } else {
      // Fallback: destructure functions from context
      destructureFuncs =
        funcNames.length > 0
          ? `const { ${funcNames.join(", ")} } = context;`
          : "";
    }

    // Destructure loop variables as const (they're read-only within the iteration)
    const destructureLoopVars =
      loopVarNames.length > 0
        ? `const { ${loopVarNames.join(", ")} } = context;`
        : "";

    // Destructure state variables as let (for sync-back)
    // Use reactiveState if available, otherwise fall back to context
    const stateSource =
      reactiveState && stateVarNames.length > 0 ? "reactiveState" : "context";
    const destructureStateVars =
      stateVarNames.length > 0
        ? `let { ${stateVarNames.join(", ")} } = ${stateSource};`
        : "";

    // Sync state variables back after execution (only for regular scripts)
    const syncBack =
      !hasModuleScripts && reactiveState && stateVarNames.length > 0
        ? stateVarNames.map((key) => `reactiveState.${key} = ${key};`).join(" ")
        : "";

    // Build function body
    const fnBody = `"use strict";
      ${destructureLoopVars}
      ${destructureStateVars}
      ${destructureFuncs}
      ${funcDefs}
      ${code};
      ${syncBack}`;

    // Create function with event, context, and reactiveState as parameters
    const fn = new Function("event", "context", "reactiveState", fnBody);

    return (event: Event) => {
      try {
        fn(event, context, reactiveState);
      } catch (e) {
        console.error(`Error in loop event handler: ${code}`, e);
      }
    };
  } catch (e) {
    console.warn(`Failed to create loop event handler: ${code}`, e);
    return null;
  }
}

/**
 * Updates all conditionals with the current state.
 */
export function updateConditionals(
  conditionals: ConditionalDescriptor[][],
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>
  ) => unknown
): void {
  for (const group of conditionals) {
    updateConditionalGroup(group, state, evaluateExpression);
  }
}

/**
 * Updates a single conditional group.
 */
function updateConditionalGroup(
  group: ConditionalDescriptor[],
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>
  ) => unknown
): void {
  // Remove all currently visible elements
  for (const desc of group) {
    if (desc.element.parentNode) {
      desc.element.remove();
    }
  }

  // Find the first matching condition
  for (const desc of group) {
    let shouldShow = false;

    if (desc.type === "else") {
      shouldShow = true; // $else always shows if we reach it
    } else {
      const result = evaluateExpression(desc.condition, state);
      shouldShow = Boolean(result);
    }

    if (shouldShow) {
      // Insert this element after the placeholder
      desc.placeholder.parentNode?.insertBefore(
        desc.element,
        desc.placeholder.nextSibling
      );
      break; // Only show the first matching condition
    }
  }
}

/**
 * Updates all $show elements with the current state.
 */
export function updateShowElements(
  showElements: ShowDescriptor[],
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>
  ) => unknown
): void {
  for (const desc of showElements) {
    const result = evaluateExpression(desc.expression, state);
    const shouldShow = Boolean(result);

    desc.element.style.display = shouldShow ? desc.originalDisplay : "none";
  }
}

/**
 * Sets up two-way bindings and returns a registry for state→input sync.
 *
 * Returns a function that should be called when state changes to update
 * all bound input elements with the new state values.
 */
export function setupTwoWayBindings(
  bindings: TwoWayBindingDescriptor[],
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>
  ) => unknown
): (changedKey?: string) => void {
  // Registry mapping state keys to bound elements
  const registry: TwoWayBindingRegistry = new Map();

  for (const binding of bindings) {
    setupTwoWayBinding(binding, state, evaluateExpression, registry);
  }

  // Return a function that updates all bound inputs when state changes
  return (changedKey?: string) => {
    updateBoundInputs(registry, state, evaluateExpression, changedKey);
  };
}

/**
 * Sets up a single two-way binding and registers it for state→input sync.
 */
function setupTwoWayBinding(
  binding: TwoWayBindingDescriptor,
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>
  ) => unknown,
  registry: TwoWayBindingRegistry
): void {
  const element = binding.element;
  const { raw, path, isContentEditable } = binding;

  // Get initial value from state and set on element
  const initialValue = evaluateExpression(raw, state);
  setElementValue(element, initialValue, isContentEditable);

  // Register this binding for state→input sync
  // The key is the first part of the path (top-level state key)
  const stateKey = path[0];
  if (!registry.has(stateKey)) {
    registry.set(stateKey, []);
  }
  registry.get(stateKey)!.push({
    element: element as HTMLElement,
    path,
    isContentEditable,
  });

  // Also register for the full raw expression (handles nested paths)
  if (raw !== stateKey && !registry.has(raw)) {
    registry.set(raw, []);
  }
  if (raw !== stateKey) {
    registry.get(raw)!.push({
      element: element as HTMLElement,
      path,
      isContentEditable,
    });
  }

  // Determine event type based on element
  const eventType = getInputEventType(element);

  // Track if we're currently updating from state to prevent feedback loops
  let isUpdatingFromState = false;

  // Store the flag on the element so updateBoundInputs can set it
  (element as any).__isUpdatingFromState = () => isUpdatingFromState;
  (element as any).__setUpdatingFromState = (val: boolean) => {
    isUpdatingFromState = val;
  };

  // Listen for changes and update state
  element.addEventListener(eventType, () => {
    // Skip if this change was triggered by state→input sync
    if (isUpdatingFromState) return;

    const newValue = getElementValue(element, isContentEditable);
    setNestedValue(state, path, newValue);
  });
}

/**
 * Updates all bound input elements when state changes.
 * Called by the reactivity system when a state property is modified.
 *
 * @param registry - Map of state keys to bound elements
 * @param state - Current reactive state
 * @param evaluateExpression - Function to evaluate expressions against state
 * @param changedKey - The key that changed (optional, updates all if not provided)
 */
function updateBoundInputs(
  registry: TwoWayBindingRegistry,
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>
  ) => unknown,
  changedKey?: string
): void {
  // If a specific key changed, only update elements bound to that key
  const keysToUpdate = changedKey ? [changedKey] : Array.from(registry.keys());

  for (const key of keysToUpdate) {
    const bindings = registry.get(key);
    if (!bindings) continue;

    for (const binding of bindings) {
      const { element, path, isContentEditable } = binding;

      // Get the current value from state
      const rawExpression = path.join(".");
      const currentValue = evaluateExpression(rawExpression, state);

      // Set flag to prevent feedback loop (input event → state update → input update)
      const setFlag = (element as any).__setUpdatingFromState;
      if (setFlag) setFlag(true);

      // Update the element with the new value
      setElementValue(element, currentValue, isContentEditable);

      // Clear the flag after a microtask to ensure the event handler sees it
      if (setFlag) {
        queueMicrotask(() => setFlag(false));
      }
    }
  }
}

/**
 * Gets the appropriate event type for an input element.
 */
function getInputEventType(element: HTMLElement): string {
  if (element instanceof HTMLSelectElement) {
    return "change";
  }
  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    if (type === "checkbox" || type === "radio") {
      return "change";
    }
  }
  return "input";
}

/**
 * Gets the value from an input element.
 */
function getElementValue(
  element: HTMLElement,
  isContentEditable?: boolean
): unknown {
  if (isContentEditable) {
    return element.textContent || "";
  }

  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    if (type === "checkbox") {
      return element.checked;
    }
    if (type === "number" || type === "range") {
      return element.valueAsNumber;
    }
    return element.value;
  }

  if (element instanceof HTMLSelectElement) {
    if (element.multiple) {
      return Array.from(element.selectedOptions).map((o) => o.value);
    }
    return element.value;
  }

  if (element instanceof HTMLTextAreaElement) {
    return element.value;
  }

  return (element as any).value ?? "";
}

/**
 * Sets the value on an input element.
 */
function setElementValue(
  element: HTMLElement,
  value: unknown,
  isContentEditable?: boolean
): void {
  if (isContentEditable) {
    element.textContent = String(value ?? "");
    return;
  }

  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    if (type === "checkbox") {
      element.checked = Boolean(value);
    } else {
      element.value = String(value ?? "");
    }
    return;
  }

  if (element instanceof HTMLSelectElement) {
    element.value = String(value ?? "");
    return;
  }

  if (element instanceof HTMLTextAreaElement) {
    element.value = String(value ?? "");
    return;
  }

  (element as any).value = value;
}

/**
 * Sets a nested value in an object using a path array.
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown
): void {
  let current: any = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }

  current[path[path.length - 1]] = value;
}

/**
 * Checks if a value is iterable.
 */
function isIterable(value: unknown): boolean {
  return (
    value !== null &&
    value !== undefined &&
    (Array.isArray(value) ||
      typeof (value as any)[Symbol.iterator] === "function" ||
      typeof value === "object")
  );
}
