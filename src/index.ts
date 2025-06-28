import { ladrillos } from "./core/main.js";

declare global {
  interface Window {
    ladrillosjs: {
      registerComponent: typeof registerComponent;
    };
  }
}

export const registerComponent = (name: string, path: string, useShadowDOM?: boolean) =>
  ladrillos.registerComponent(name, path, useShadowDOM);

// for a browser‑global via <script src="…ladrillosjs.js"></script>
if (typeof window !== "undefined") {
  window.ladrillosjs = {
    registerComponent
  };
}
