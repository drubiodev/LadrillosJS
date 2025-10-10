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

export const registerComponents = async (
  components: Array<{ name: string; path: string; useShadowDOM?: boolean }>
): Promise<void> => {
  await Promise.all(
    components.map(({ name, path, useShadowDOM }) =>
      ladrillos.registerComponent(name, path, useShadowDOM)
    )
  );
};

// for a browser‑global via <script src="…ladrillosjs.js"></script>
if (typeof window !== "undefined") {
  window.ladrillosjs = {
    registerComponent,
    registerComponents,
  };
}
