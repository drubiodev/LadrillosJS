import { ScriptElement, BindingDescriptor } from "../../types/LadrilloTypes";

const getHostElement = (host: HTMLElement | ShadowRoot): HTMLElement =>
  host instanceof ShadowRoot ? (host.host as HTMLElement) : host;

// Store component states
const componentStates = new WeakMap<HTMLElement, Map<string, any>>();

export const loadScripts = async (
  host: HTMLElement | ShadowRoot,
  scripts: ScriptElement[],
  bindings?: BindingDescriptor[]
) => {
  if (!scripts?.length) return;

  const componentHost = getHostElement(host);

  // Initialize state storage
  if (!componentStates.has(componentHost)) {
    componentStates.set(componentHost, new Map());
  }
  const state = componentStates.get(componentHost)!;

  // Extract binding variable names
  const bindingVars = new Set<string>();
  if (bindings) {
    bindings.forEach((binding) => {
      const rootVar = binding.path[0];
      bindingVars.add(rootVar);
    });
  }

  for (const scriptDefinition of scripts) {
    if (scriptDefinition.content) {
      try {
        // Extract function names
        const functionRegex =
          /function\s+(\w+)|const\s+(\w+)\s*=\s*(?:\([^)]*\)|[\w\s]*)\s*=>/g;
        const functionNames: string[] = [];
        let match;

        while (
          (match = functionRegex.exec(scriptDefinition.content)) !== null
        ) {
          const functionName = match[1] || match[2];
          if (functionName) {
            functionNames.push(functionName);
          }
        }

        // Auto-attach functions
        const attachFunctions = functionNames
          .map(
            (name) =>
              `component.${name} = typeof ${name} !== 'undefined' ? ${name} : undefined;`
          )
          .join("\n            ");

        // Create getters/setters for binding variables
        const stateProxies = Array.from(bindingVars)
          .map(
            (varName) => `
            Object.defineProperty(component, '${varName}', {
              get() { return component.state.get('${varName}'); },
              set(value) { 
                component.state.set('${varName}', value);
                // Trigger re-render or update bindings here if needed
              },
              enumerable: true,
              configurable: true
            });
          `
          )
          .join("\n");

        // Wrap script with automatic state management
        const wrappedScript = `
          (function() {
            const component = this;
            
            // Add state management
            component.state = {
              get: (key) => arguments[1].get(key),
              set: (key, value) => arguments[1].set(key, value)
            };
            
            ${stateProxies}
            
            ${scriptDefinition.content}
            
            // Store variables as state
            ${Array.from(bindingVars)
              .map(
                (v) => `
              if (typeof ${v} !== 'undefined') {
                component.state.set('${v}', ${v});
              }
            `
              )
              .join("\n")}
            
            ${attachFunctions}
          }).call(arguments[0], arguments[0], arguments[1])
        `;

        const executor = new Function(wrappedScript);
        executor(componentHost, state);
      } catch (error) {
        console.error("Script execution failed:", error);
      }
    }
  }

  // Process onclick handlers
  const elements =
    host instanceof ShadowRoot
      ? host.querySelectorAll("[onclick]")
      : componentHost.querySelectorAll("[onclick]");

  const processedElements = new WeakSet<Element>();

  elements.forEach((element) => {
    if (processedElements.has(element)) return;

    const originalOnclick = element.getAttribute("onclick");
    if (originalOnclick) {
      element.removeAttribute("onclick");
      (element as HTMLElement).addEventListener("click", function (event) {
        const func = new Function(
          "event",
          "component",
          `
          with(component) {
            ${originalOnclick}
          }
        `
        );
        func.call(this, event, componentHost);
      });

      processedElements.add(element);
    }
  });
};

// Helper to get component state
export const getComponentState = (host: HTMLElement) => {
  return componentStates.get(host);
};
