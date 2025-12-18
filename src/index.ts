import { ladrillos } from "./core/ladrillos";
import { $registerComponent, $use } from "./core/helpers/frameworkHelpers";

// Legacy export (for backwards compatibility)
export const registerComponent = (
  name: string,
  path: string,
  useShadowDOM?: boolean,
  lazy?: boolean
) => ladrillos.registerComponent(name, path, useShadowDOM, lazy);

// $ prefixed exports - same syntax inside and outside components!
export { $registerComponent, $use };

// Default export with all methods for CDN usage
// This allows: ladrillosjs.$registerComponent() in CDN mode
export default {
  registerComponent,
  $registerComponent,
  $use,
};
