import { ladrillos } from "./core/ladrillos";

// Export module executor utilities for advanced use cases
export {
  rewriteImports,
  executeModuleScript,
  executeAllModuleScripts,
  cleanupModuleScripts,
  extractImportSpecifiers,
  executeModuleScriptWithReactivity,
  executeModuleScriptsWithReactivity,
} from "./core/js/moduleExecutor";

export const registerComponent = (
  name: string,
  path: string,
  useShadowDOM?: boolean,
  lazy?: boolean
) => ladrillos.registerComponent(name, path, useShadowDOM, lazy);
