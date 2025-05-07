import { ladrillos } from "./core/main.js";

/**
 * @type {typeof ladrillos.registerComponent}
 */
export const registerComponent = (...args) =>
  ladrillos.registerComponent(...args);

/**
 * @type {typeof ladrillos.registerComponents}
 */
export const registerComponents = (...args) =>
  ladrillos.registerComponents(...args);

export { createStore } from "./core/store.js";

// for a browser‑global via <script src="…ladrillosjs.js"></script>
if (typeof window !== "undefined") {
  window.ladrillosjs = {
    registerComponent,
    registerComponents, // changed code
  };
}
