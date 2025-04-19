/**
 * Creates a reactive state object for a component.
 * Wraps the provided state in a Proxy to intercept property reads and writes,
 * and automatically triggers the component's update routine when a property changes.
 *
 * @param {Object} component           - The component instance to observe.
 * @param {boolean} component._initializing - If true, suppresses update calls during initialization.
 * @param {Function} component._update - Method to invoke when a reactive property changes.
 * @param {Partial<S>} [initialState={}] - An object containing the initial state key/value pairs.
 * @returns {S} A Proxy wrapping the initial state, with reactive get/set handlers.
 */
export function createReactiveState(component, initialState = {}) {
  return new Proxy(initialState, {
    set(target, property, value) {
      const old = target[property];
      target[property] = value;

      if (old !== value && !component._initializing) {
        if (typeof component._updateBinding === "function") {
          component._updateBinding(property, value);
        } else {
          component._update();
        }
      }
      return true;
    },
    get(target, property) {
      return target[property];
    },
  });
}
