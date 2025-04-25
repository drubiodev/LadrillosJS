import { ladrillos } from "./core/main.js";

/**
 * ES‑module export
 * import { registerComponent } from "ladrillosjs";
 */
export const registerComponent = (...args) =>
  ladrillos.registerComponent(...args);

// for a browser‑global via <script src="…ladrillosjs.js"></script>
if (typeof window !== "undefined") {
  window.ladrillosjs = {
    registerComponent,
  };
}
