/**
 * Wraps a Map in a Proxy to allow cleaner dot notation access.
 * Supports both $refs.inputEl and $refs.get("inputEl") syntax.
 *
 * Kept out of `frameworkHelpers` because that module instantiates the
 * framework singleton, which pins the HTML parser into every bundle that
 * touches it. The web component runtime needs only this proxy.
 *
 * @example
 * const $refs = createRefsProxy(new Map());
 * $refs.set("input", document.querySelector("input"));
 * $refs.input.focus();  // Works!
 * $refs.get("input").focus();  // Also works!
 */
export function createRefsProxy<T extends HTMLElement = HTMLElement>(
  map: Map<string, T>,
): Map<string, T> & Record<string, T> {
  return new Proxy(map, {
    get(target, prop, receiver) {
      // If the property exists on Map (get, set, has, etc.), use it
      if (prop in target) {
        const value = Reflect.get(target, prop, receiver);
        // Bind methods to the target Map
        return typeof value === "function" ? value.bind(target) : value;
      }
      // Otherwise, treat it as a ref name lookup
      if (typeof prop === "string") {
        return target.get(prop);
      }
      return undefined;
    },
    set(target, prop, value) {
      // Allow setting refs via dot notation: $refs.myEl = element
      if (typeof prop === "string") {
        target.set(prop, value);
        return true;
      }
      return false;
    },
    has(target, prop) {
      if (typeof prop === "string") {
        return target.has(prop) || prop in target;
      }
      return prop in target;
    },
  }) as Map<string, T> & Record<string, T>;
}
