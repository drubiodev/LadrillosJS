import { ScriptElement, BindingDescriptor } from "../../types/LadrilloTypes";

const getHostElement = (host: HTMLElement | ShadowRoot): HTMLElement =>
  host instanceof ShadowRoot ? (host.host as HTMLElement) : host;

export const loadScripts = async (
  host: HTMLElement | ShadowRoot,
  scripts: ScriptElement[]
) => {
  if (!scripts?.length) return;

  const componentHost = getHostElement(host);

  for (const scriptDefinition of scripts) {
    if (scriptDefinition.content) {
      try {
        // Extract function names from the script content
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

        // Auto-attach detected functions
        const attachFunctions = functionNames
          .map(
            (name) =>
              `component.${name} = typeof ${name} !== 'undefined' ? ${name} : undefined;`
          )
          .join("\n            ");

        // Create a wrapper that captures functions and variables in component scope
        const wrappedScript = `
          (function() {
            // Create component scope
            const component = this;
            
            ${scriptDefinition.content}
            
            // Auto-attach all detected functions to component for onclick access
            ${attachFunctions}
          }).call(arguments[0])
        `;

        const executor = new Function(wrappedScript);
        executor(componentHost);
      } catch (error) {
        console.error("Script execution failed:", error);
      }
    }
  }

  // Fix onclick handlers to look for functions on the component
  const elements =
    host instanceof ShadowRoot
      ? host.querySelectorAll("[onclick]")
      : componentHost.querySelectorAll("[onclick]");
  // Add a WeakSet to track processed elements
  const processedElements = new WeakSet<Element>();

  elements.forEach((element) => {
    if (processedElements.has(element)) return; // Skip if already processed

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

      processedElements.add(element); // Mark as processed
    }
  });
};
