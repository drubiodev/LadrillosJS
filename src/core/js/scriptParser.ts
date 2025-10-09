import {
  ScriptElement,
  BindingDescriptor,
  ExternalScriptElement,
  TwoWayBindingDescriptor,
} from "../../types/LadrilloTypes";
import { eventBus } from "../eventBus";

const getHostElement = (host: HTMLElement | ShadowRoot): HTMLElement =>
  host instanceof ShadowRoot ? (host.host as HTMLElement) : host;

/**
 * Injects $bind variables into the script scope and validates no conflicts exist.
 * Creates property descriptors that proxy to component.state for reactive access.
 */
const injectBindVariables = (
  scriptContent: string,
  twoWayBindings: TwoWayBindingDescriptor[]
): {
  injectedCode: string;
  componentInjections: string;
  bindVarNames: Set<string>;
  errors: string[];
} => {
  const bindVarNames = new Set<string>();
  const errors: string[] = [];

  // Extract all $bind variable names (root-level only, e.g., "person" from "person.name")
  twoWayBindings.forEach(({ path }) => {
    const rootVar = path[0];
    bindVarNames.add(rootVar);
  });

  // Check for conflicts - devs trying to redeclare $bind variables
  bindVarNames.forEach((varName) => {
    const redeclarationRegex = new RegExp(
      `(?:const|let|var)\\s+${varName}\\s*=`,
      "g"
    );

    if (redeclarationRegex.test(scriptContent)) {
      errors.push(
        `⚠️  Variable "${varName}" is already bound via $bind and cannot be redeclared. Remove the declaration or use a different variable name.`
      );
    }
  });

  // Create proxy getters/setters for each $bind variable in script scope
  const injections: string[] = [];
  const componentInjections: string[] = [];

  bindVarNames.forEach((varName) => {
    // Define on component object for event handler access via with(component)
    componentInjections.push(`
      if (!Object.getOwnPropertyDescriptor(component, '${varName}')) {
        Object.defineProperty(component, '${varName}', {
          get() { return this.state.${varName}; },
          set(val) { this.state.${varName} = val; },
          enumerable: true,
          configurable: true
        });
      }
    `);
  });

  return {
    injectedCode: "", // No longer needed in script scope
    componentInjections: componentInjections.join("\n"),
    bindVarNames,
    errors,
  };
};

/**
 * Extracts variable declarations (const, let, var) from script content
 * that match the template bindings, and returns code to bind them to state.
 * Only binds variables that are actually used in the template.
 */
const extractStateBindings = (
  scriptContent: string,
  bindings: BindingDescriptor[]
): { stateBindings: string[]; boundVarNames: Set<string> } => {
  const stateBindings: string[] = [];

  // Create a Set of all binding names used in the template for fast lookup
  const bindingNames = new Set<string>();
  bindings.forEach((binding) => {
    binding.bindings.forEach((b) => {
      // Extract the root property name (e.g., "user.name" → "user", "count" → "count")
      const rootName = b.path[0];
      bindingNames.add(rootName);
    });
  });

  // Match: const name = value; | let count = 0; | var items = [];
  const variableRegex = /(?:const|let|var)\s+(\w+)\s*=\s*([^;]+);?/g;

  let match;
  while ((match = variableRegex.exec(scriptContent)) !== null) {
    const varName = match[1];

    // Only auto-bind if this variable is used in a template binding
    if (bindingNames.has(varName)) {
      stateBindings.push(`component.state.${varName} = ${varName};`);
    }
  }

  return { stateBindings, boundVarNames: bindingNames };
};

/**
 * Transforms script content to redirect bound variable assignments to state.
 * Handles assignments, increments, decrements, and compound assignments.
 * Examples:
 *   - "name = value" → "component.state.name = value"
 *   - "count++" → "component.state.count++"
 *   - "count += 5" → "component.state.count += 5"
 * This makes reactivity transparent - users don't need to know about state.
 */
const transformBoundAssignments = (
  scriptContent: string,
  boundVarNames: Set<string>
): string => {
  if (boundVarNames.size === 0) return scriptContent;

  let transformed = scriptContent;

  boundVarNames.forEach((varName) => {
    // 1. Transform increment/decrement: count++ or count-- or ++count or --count
    const incrementRegex = new RegExp(
      `(?<!const\\s|let\\s|var\\s|\\.)\\b(\\+\\+|\\-\\-)${varName}\\b|\\b${varName}(\\+\\+|\\-\\-)`,
      "g"
    );
    transformed = transformed.replace(incrementRegex, (match) => {
      if (match.startsWith("++") || match.startsWith("--")) {
        // Prefix: ++count or --count
        const op = match.substring(0, 2);
        return `${op}component.state.${varName}`;
      } else {
        // Postfix: count++ or count--
        const op = match.substring(match.length - 2);
        return `component.state.${varName}${op}`;
      }
    });

    // 2. Transform compound assignments: count += 5, count -= 3, count *= 2, etc.
    const compoundRegex = new RegExp(
      `(?<!const\\s|let\\s|var\\s|\\.)\\b${varName}\\s*(\\+=|\\-=|\\*=|\\/=|%=|\\*\\*=|<<=|>>=|>>>=|&=|\\|=|\\^=)`,
      "g"
    );
    transformed = transformed.replace(
      compoundRegex,
      `component.state.${varName}$1`
    );

    // 3. Transform simple assignments: name = value
    // Must come last to avoid interfering with compound assignments
    const assignmentRegex = new RegExp(
      `(?<!const\\s|let\\s|var\\s|\\.|\\+|\\-|\\*|\\/|%|<|>|&|\\||\\^)\\b${varName}\\s*=\\s*([^=])`,
      "g"
    );
    transformed = transformed.replace(
      assignmentRegex,
      `component.state.${varName} = $1`
    );
  });

  return transformed;
};

/**
 * Processes script content: extracts functions, binds state variables, and transforms assignments.
 * This is the core script processing logic that can be reused for both inline and external scripts.
 * @param scriptContent - The raw script content to process
 * @param bindings - Template bindings to determine which variables should be reactive
 * @param twoWayBindings - Two-way bound variables from $bind attributes
 * @param host - The host element or shadow root (for querySelector)
 * @param componentHost - The component element to execute the script on
 */
const processScript = (
  scriptContent: string,
  bindings: BindingDescriptor[],
  twoWayBindings: TwoWayBindingDescriptor[],
  host: HTMLElement | ShadowRoot,
  componentHost: HTMLElement
): void => {
  try {
    // Inject $bind variables and check for conflicts
    const { injectedCode, componentInjections, bindVarNames, errors } =
      injectBindVariables(scriptContent, twoWayBindings);

    // Log errors if any conflicts found
    if (errors.length > 0) {
      console.error("❌ $bind Variable Conflicts Detected:");
      errors.forEach((err) => console.error(err));
    }

    // Extract function names from the script content
    const functionRegex =
      /function\s+(\w+)|const\s+(\w+)\s*=\s*(?:\([^)]*\)|[\w\s]*)\s*=>/g;
    const functionNames: string[] = [];
    let match;

    while ((match = functionRegex.exec(scriptContent)) !== null) {
      const functionName = match[1] || match[2];
      if (functionName) {
        functionNames.push(functionName);
      }
    }

    // Auto-attach detected functions
    // Wrap functions to bind them to component and maintain variable access
    const attachFunctions = functionNames
      .map(
        (name) =>
          `component.${name} = typeof ${name} !== 'undefined' ? ${name}.bind(component) : undefined;`
      )
      .join("\n            ");

    // Extract and auto-bind variables to state (only those used in template bindings)
    const { stateBindings, boundVarNames } = extractStateBindings(
      scriptContent,
      bindings
    );

    // Merge bindVarNames with boundVarNames for transformation
    const allBoundVars = new Set([...boundVarNames, ...bindVarNames]);

    const attachStateBindings = stateBindings.join("\n            ");

    // Transform the script to make bound variable assignments reactive
    const transformedContent = transformBoundAssignments(
      scriptContent,
      allBoundVars
    );

    // Create a wrapper that captures functions and variables in component scope
    const wrappedScript = `
      (function() {
        // Create component scope with direct access to state
        const component = this;
        const $state = component.state;
        
        // Define $bind variables on component object for event handler access
        ${componentInjections}
        
        // Provide framework utilities with $ prefix to avoid naming conflicts
        const $setState = (updates) => component.setState(updates);
        
        // Event bus methods for component communication
        const $emit = (eventName, data) => arguments[2].emit(eventName, data);
        const $listen = (eventName, callback) => {
          const unsubscribe = arguments[2].listen(eventName, callback);
          // Store unsubscribe function for cleanup on disconnect
          if (!component.__eventUnsubscribers) {
            component.__eventUnsubscribers = [];
          }
          component.__eventUnsubscribers.push(unsubscribe);
          return unsubscribe;
        };
        
        // Also attach to component for event handler access
        component.$emit = $emit;
        component.$listen = $listen;
        
        // Override querySelector/querySelectorAll to query within the component's host
        const host = arguments[1];
        const $querySelector = (selector) => host.querySelector(selector);
        const $querySelectorAll = (selector) => host.querySelectorAll(selector);
        
        // Execute script content within component scope so $bind variables are accessible
        with(component) {
          ${transformedContent}
          
          // Auto-bind variables to component state (e.g., const name = "value" → this.state.name = "value")
          ${attachStateBindings}
          
          // Auto-attach all detected functions to component for onclick access
          ${attachFunctions}
        }
      }).call(arguments[0], arguments[0], arguments[1], arguments[2])
    `;

    const executor = new Function(wrappedScript);
    executor(componentHost, host, eventBus);
  } catch (error) {
    console.error("Script execution failed:", error);
  }
};

/**
 * Processes inline event handlers (onclick, onkeyup, oninput, etc.) to bind them to the component context.
 * Removes inline event attributes and converts them to proper event listeners
 * that have access to the component scope.
 * @param host - The host element or shadow root
 * @param componentHost - The component element
 */
const processEventHandlers = (
  host: HTMLElement | ShadowRoot,
  componentHost: HTMLElement
): void => {
  // All standard DOM events that can be handled as attributes
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

  // Add a WeakSet to track processed elements
  const processedElements = new WeakSet<Element>();

  eventTypes.forEach((eventType) => {
    const attributeName = `on${eventType}`;
    const elements =
      host instanceof ShadowRoot
        ? host.querySelectorAll(`[${attributeName}]`)
        : componentHost.querySelectorAll(`[${attributeName}]`);

    elements.forEach((element) => {
      // Create a unique key for this element + event combination
      const key = `${attributeName}`;
      if ((element as any)[`__processed_${key}`]) return; // Skip if already processed

      const handlerCode = element.getAttribute(attributeName);
      if (handlerCode) {
        element.removeAttribute(attributeName);
        (element as HTMLElement).addEventListener(
          eventType,
          function (this: HTMLElement, event: Event) {
            const func = new Function(
              "event",
              "component",
              `
            with(component) {
              ${handlerCode}
            }
          `
            );
            func.call(this, event, componentHost);
          }
        );

        // Mark as processed for this specific event
        (element as any)[`__processed_${key}`] = true;
      }
    });
  });
};

export const loadScripts = async (
  host: HTMLElement | ShadowRoot,
  scripts: ScriptElement[],
  bindings: BindingDescriptor[],
  twoWayBindings: TwoWayBindingDescriptor[] = []
) => {
  if (!scripts?.length) return;

  const componentHost = getHostElement(host);

  for (const scriptDefinition of scripts) {
    if (scriptDefinition.content) {
      processScript(
        scriptDefinition.content,
        bindings,
        twoWayBindings,
        host,
        componentHost
      );
    }
  }

  // Process all event handlers to bind them to the component
  processEventHandlers(host, componentHost);
};

export const loadExternalScripts = async (
  host: HTMLElement | ShadowRoot,
  externalScripts: ExternalScriptElement[],
  bindings: BindingDescriptor[],
  twoWayBindings: TwoWayBindingDescriptor[] = []
) => {
  const componentHost = getHostElement(host);

  for (const s of externalScripts) {
    const scriptURL = new URL(s.src, import.meta.url).href;

    if (s.external) {
      // TODO: inject script tag to document for external CDN scripts
    } else if (s.type === "module") {
      // TODO: work on module type scripts
    } else {
      // Fetch and process local scripts
      await fetch(scriptURL)
        .then((response) => response.text())
        .then((scriptContent) => {
          // Reuse the same processing logic as inline scripts
          processScript(
            scriptContent,
            bindings,
            twoWayBindings,
            host,
            componentHost
          );
        })
        .catch((error) => {
          console.error(`Failed to load external script: ${s.src}`, error);
        });
    }
  }

  // Process all event handlers to bind them to the component
  processEventHandlers(host, componentHost);
};
