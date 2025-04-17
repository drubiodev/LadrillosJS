export function createReactiveState(component, initialState = {}) {
  return new Proxy(initialState, {
    set(target, property, value) {
      const old = target[property];
      target[property] = value;

      if (old !== value && !component._initializing) {
        component._update();
      }
      return true;
    },
    get(target, property) {
      return target[property];
    },
  });
}
