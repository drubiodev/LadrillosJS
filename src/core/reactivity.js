export function createReactiveState(component, initialState = {}) {
  return new Proxy(initialState, {
    set(target, property, value) {
      const oldValue = target[property];
      target[property] = value;

      // Only trigger update if value actually changed
      if (oldValue !== value) {
        component._update();
      }
      return true;
    },
    get(target, property) {
      return target[property];
    },
  });
}
