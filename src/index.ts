import { ladrillos } from "./core/ladrillos";

export const registerComponent = (
  name: string,
  path: string,
  useShadowDOM?: boolean,
  lazy?: boolean
) => ladrillos.registerComponent(name, path, useShadowDOM, lazy);
