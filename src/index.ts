import { ladrillos } from "./core/main.js";

declare global {
  interface Window {
    ladrillosjs: {
      registerComponent: typeof registerComponent;
      registerComponents: typeof registerComponents;
    };
  }
}

export const registerComponent = (
  name: string,
  path: string,
  useShadowDOM?: boolean
) => ladrillos.registerComponent(name, path, useShadowDOM);

// TODO: Implement bulk component registration
export const registerComponents = (
  components: Array<{ name: string; path: string; useShadowDOM?: boolean }>
) => {
  // TODO: Register multiple components at once
  throw new Error("registerComponents not yet implemented");
};

// for a browser‑global via <script src="…ladrillosjs.js"></script>
if (typeof window !== "undefined") {
  window.ladrillosjs = {
    registerComponent,
    registerComponents,
  };
}
