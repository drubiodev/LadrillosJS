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
 * Injects $bind variables into the script scope.
 * Creates property descriptors that proxy to component.state for reactive access.
 */
const injectBindVariables = (
  scriptContent: string,
  twoWayBindings: TwoWayBindingDescriptor[]
): {
  injectedCode: string;
  componentInjections: string;
  bindVarNames: Set<string>;
} => {
  const bindVarNames = new Set<string>();

  // Extract all $bind variable names (root-level only, e.g., "person" from "person.name")
  twoWayBindings.forEach(({ path }) => {
    const rootVar = path[0];
    bindVarNames.add(rootVar);
  });

  // Create proxy getters/setters for each $bind variable in script scope
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
  };
};

/**
 * Extracts variable declarations (const, let, var) from script content
 * that match the template bindings or conditionals, and returns code to bind them to state.
 * Only binds variables that are actually used in the template or conditionals.
 */
const extractStateBindings = (
  scriptContent: string,
  bindings: BindingDescriptor[],
  conditionalVars: Set<string> = new Set()
): { stateBindings: string[]; boundVarNames: Set<string> } => {
  const stateBindings: string[] = [];

  // Create a Set of all binding names used in the template for fast lookup
  const bindingNames = new Set<string>();
  bindings.forEach((binding) => {
    binding.bindings.forEach((b) => {
      // Extract the root property name (e.g., "user.name" → "user", "count" → "count")
      const rootName = b.path[0];
      bindingNames.add(rootName);

      // Also add function arguments (e.g., formatPrice(price) → "price")
      if (b.isFunction && b.functionArgs) {
        b.functionArgs.forEach((arg) => {
          bindingNames.add(arg);
        });
      }
    });
  });

  // Add conditional variables to binding names
  conditionalVars.forEach((varName) => {
    bindingNames.add(varName);
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
 * Handles assignments, increments, decrements, compound assignments, and nested property access.
 * Examples:
 *   - "name = value" → "component.state.name = value"
 *   - "count++" → "component.state.count++"
 *   - "count += 5" → "component.state.count += 5"
 *   - "user.name = value" → "component.state.user.name = value"
 * This makes reactivity transparent - users don't need to know about state.
 */
const transformBoundAssignments = (
  scriptContent: string,
  boundVarNames: Set<string>
): string => {
  if (boundVarNames.size === 0) return scriptContent;

  let transformed = scriptContent;

  boundVarNames.forEach((varName) => {
    // 1. Transform array/object index access with assignment: items[0].name = value, items[0]++, etc.
    // Match: varName[index].property or varName[index][index2] followed by =, +=, etc.
    const arrayIndexWriteRegex = new RegExp(
      `\\b${varName}((?:\\[[^\\]]+\\])(?:\\.[\\w]+|\\[[^\\]]+\\])*)\\s*([=+\\-*/%&|^]|\\+\\+|\\-\\-)`,
      "g"
    );
    transformed = transformed.replace(
      arrayIndexWriteRegex,
      `component.state.${varName}$1 $2`
    );

    // 2. Transform array/object index access in expressions (reads)
    const arrayIndexReadRegex = new RegExp(
      `(?<!component\\.state\\.)\\b${varName}((?:\\[[^\\]]+\\])(?:\\.[\\w]+|\\[[^\\]]+\\])*)(?![=+\\-*/%&|^]|\\+\\+|\\-\\-)`,
      "g"
    );
    transformed = transformed.replace(
      arrayIndexReadRegex,
      `component.state.${varName}$1`
    );

    // 3. Transform property access with assignment/operators: user.name = value, user.count++, etc.
    // Match: varName.property followed by =, +=, -=, ++, --, etc.
    const propertyWriteRegex = new RegExp(
      `\\b${varName}\\.(\\w+(?:\\.\\w+)*)\\s*([=+\\-*/%&|^]|\\+\\+|\\-\\-)`,
      "g"
    );
    transformed = transformed.replace(
      propertyWriteRegex,
      `component.state.${varName}.$1 $2`
    );

    // 4. Transform property access in expressions: user.name (reads)
    // But NOT if it's part of an already transformed component.state.varName
    // And NOT if it's in a variable declaration
    const propertyReadRegex = new RegExp(
      `(?<!component\\.state\\.)(?<!const\\s${varName}\\s*=\\s*{[^}]*)\\b${varName}\\.(\\w+(?:\\.\\w+)*)(?![=+\\-*/%&|^]|\\+\\+|\\-\\-)`,
      "g"
    );
    transformed = transformed.replace(
      propertyReadRegex,
      `component.state.${varName}.$1`
    );

    // 3. Transform increment/decrement on the variable itself: count++ or ++count
    const incrementRegex = new RegExp(
      `(?<!\\.)\\b(\\+\\+|\\-\\-)${varName}\\b|\\b${varName}(\\+\\+|\\-\\-)`,
      "g"
    );
    transformed = transformed.replace(incrementRegex, (match) => {
      if (match.startsWith("++") || match.startsWith("--")) {
        const op = match.substring(0, 2);
        return `${op}component.state.${varName}`;
      } else {
        const op = match.substring(match.length - 2);
        return `component.state.${varName}${op}`;
      }
    });

    // 4. Transform compound assignments on the variable itself: count += 5
    const compoundRegex = new RegExp(
      `(?<!\\.)\\b${varName}\\s*(\\+=|\\-=|\\*=|\\/=|%=|\\*\\*=|<<=|>>=|>>>=|&=|\\|=|\\^=)`,
      "g"
    );
    transformed = transformed.replace(
      compoundRegex,
      `component.state.${varName}$1`
    );

    // 5. Transform simple assignments: name = value (but not in declarations)
    const assignmentRegex = new RegExp(
      `(?<!const\\s)(?<!let\\s)(?<!var\\s)(?<!\\.)\\b${varName}\\s*=\\s*([^=])`,
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
 * @param conditionalVars - Variables used in conditional expressions ($if, $else-if)
 */
const processScript = (
  scriptContent: string,
  bindings: BindingDescriptor[],
  twoWayBindings: TwoWayBindingDescriptor[],
  host: HTMLElement | ShadowRoot,
  componentHost: HTMLElement,
  conditionalVars: Set<string> = new Set()
): void => {
  try {
    // Inject $bind variables
    const { injectedCode, componentInjections, bindVarNames } =
      injectBindVariables(scriptContent, twoWayBindings);

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

    // Extract and auto-bind variables to state (only those used in template bindings or conditionals)
    const { stateBindings, boundVarNames } = extractStateBindings(
      scriptContent,
      bindings,
      conditionalVars
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

/**
 * Transforms a module script to make variable bindings reactive.
 * Detects variables used in template bindings and wraps assignments to update component state.
 * @param scriptContent - The module script content
 * @param bindings - Template bindings to determine which variables should be reactive
 * @param componentId - The component ID for accessing the context
 * @returns Transformed script content
 */
const transformModuleScript = (
  scriptContent: string,
  bindings: BindingDescriptor[],
  componentId: string
): string => {
  // Extract variable names used in bindings
  const bindingVarNames = new Set<string>();
  bindings.forEach((binding) => {
    binding.bindings.forEach((b) => {
      if (!b.isFunction) {
        const rootName = b.path[0];
        bindingVarNames.add(rootName);
      }
    });
  });

  if (bindingVarNames.size === 0) {
    return scriptContent; // No transformations needed
  }

  // Add helper code at the beginning to get component context
  const helperCode = `
// Auto-generated: Get component context for reactive bindings
const __getContext = () => window.__ladrilloContexts?.get('${componentId}');
const __component = __getContext()?.element;
`;

  let transformed = scriptContent;

  // Transform variable declarations to initialize state
  bindingVarNames.forEach((varName) => {
    // Match: let varName = value; or const varName = value;
    const declRegex = new RegExp(
      `(let|const|var)\\s+${varName}\\s*=\\s*([^;]+);`,
      "g"
    );

    transformed = transformed.replace(declRegex, (match, keyword, value) => {
      return `${keyword} ${varName} = ${value};\nif (__component?.setState) __component.setState({ ${varName}: ${varName} });`;
    });

    // Transform assignments: varName = value
    // Make sure we don't match declarations (let/const/var) or object properties (obj.varName)
    const assignRegex = new RegExp(
      `(?<!let\\s|const\\s|var\\s|\\.)\\b${varName}\\s*=\\s*([^;]+);`,
      "g"
    );

    transformed = transformed.replace(assignRegex, (match, value) => {
      return `${varName} = ${value};\nif (__component?.setState) __component.setState({ ${varName}: ${varName} });`;
    });

    // Transform increment/decrement operators
    const incDecRegex = new RegExp(`\\b${varName}(\\+\\+|\\-\\-)`, "g");

    transformed = transformed.replace(incDecRegex, (match, op) => {
      return `${varName}${op};\nif (__component?.setState) __component.setState({ ${varName}: ${varName} });`;
    });

    // Transform compound assignments
    const compoundRegex = new RegExp(
      `\\b${varName}\\s*(\\+=|\\-=|\\*=|\\/=)\\s*([^;]+);`,
      "g"
    );

    transformed = transformed.replace(compoundRegex, (match, op, value) => {
      return `${varName} ${op} ${value};\nif (__component?.setState) __component.setState({ ${varName}: ${varName} });`;
    });
  });

  return helperCode + transformed;
};

export const loadScripts = async (
  host: HTMLElement | ShadowRoot,
  scripts: ScriptElement[],
  bindings: BindingDescriptor[],
  twoWayBindings: TwoWayBindingDescriptor[] = [],
  conditionalVars: Set<string> = new Set()
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
        componentHost,
        conditionalVars
      );
    }
  }

  // Process all event handlers to bind them to the component
  processEventHandlers(host, componentHost);
};

/**
 * Loads a global external script (e.g., from CDN) and returns a promise that resolves when loaded.
 * Prevents duplicate script tags by checking if the script is already loaded.
 * @param src - The script URL
 * @param type - The script type (e.g., 'module', 'text/javascript')
 * @returns Promise that resolves when the script is loaded
 */
const loadGlobalScript = (src: string, type: string | null): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if script is already loaded and ready
    const existingScript = document.querySelector(
      `script[src="${src}"]`
    ) as HTMLScriptElement;
    if (existingScript) {
      // If script already loaded, check if it's ready
      if (existingScript.dataset.loaded === "true") {
        resolve();
        return;
      }

      // If it's loading, wait for it
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error(`Failed to load external script: ${src}`)),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    if (type) {
      script.type = type;
    }

    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () =>
      reject(new Error(`Failed to load external script: ${src}`));

    document.head.appendChild(script);
  });
};

export const loadExternalScripts = async (
  host: HTMLElement | ShadowRoot,
  externalScripts: ExternalScriptElement[],
  bindings: BindingDescriptor[],
  twoWayBindings: TwoWayBindingDescriptor[] = [],
  conditionalVars: Set<string> = new Set(),
  componentSourcePath?: string
) => {
  const componentHost = getHostElement(host);

  for (const s of externalScripts) {
    // Resolve script URL relative to the component's HTML file location
    // Convert relative path to absolute URL if needed
    let baseURL: string;
    if (componentSourcePath) {
      // If it's already an absolute URL, use it directly
      if (
        componentSourcePath.startsWith("http://") ||
        componentSourcePath.startsWith("https://")
      ) {
        baseURL = componentSourcePath;
      } else {
        // Convert relative path to absolute URL using window.location
        // Ensure the base URL ends with the component path including filename
        // so that relative paths like '../js/app.js' resolve correctly
        const fullComponentURL = new URL(
          componentSourcePath,
          window.location.href
        ).href;
        baseURL = fullComponentURL;
      }
    } else {
      baseURL = window.location.href;
    }

    const scriptURL = new URL(s.src, baseURL).href;

    if (s.external) {
      // Inject script tag to document for external CDN scripts (e.g., highlight.js, three.js)
      // These scripts load globally and don't need component-specific processing
      await loadGlobalScript(scriptURL, s.type);
    } else if (s.type === "module") {
      // For module scripts, load them normally as ES modules
      // The bind attribute is a signal that the user wants reactive bindings,
      // but ES modules can't be transformed the same way as regular scripts
      // So we store the context and let the module use helper functions
      const componentId = componentHost.tagName.toLowerCase();

      if (!(window as any).__ladrilloContexts) {
        (window as any).__ladrilloContexts = new Map();
      }

      // Store the component context so the module can access it
      (window as any).__ladrilloContexts.set(componentId, {
        host,
        shadowRoot: host instanceof ShadowRoot ? host : null,
        element: componentHost,
        state: (componentHost as any).state,
        setState: (componentHost as any).setState?.bind(componentHost),
      });

      // Load the module script normally
      const script = document.createElement("script");
      script.type = "module";
      script.src = scriptURL;
      script.setAttribute("data-component", componentId);
      document.head.appendChild(script);
    } else {
      // Fetch and process local non-module scripts through reactive processing
      await fetch(scriptURL)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const contentType = response.headers.get("content-type");
          if (
            contentType &&
            !contentType.includes("javascript") &&
            !contentType.includes("text/plain")
          ) {
            throw new Error(`Expected JavaScript but got ${contentType}`);
          }
          return response.text();
        })
        .then((scriptContent) => {
          // Reuse the same processing logic as inline scripts
          processScript(
            scriptContent,
            bindings,
            twoWayBindings,
            host,
            componentHost,
            conditionalVars
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
