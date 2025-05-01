export function createStore(initialState = {}) {
  let state = initialState;
  const listeners = new Set();

  return {
    // read-only access
    getState() {
      return state;
    },

    // update state by merging partial, then notify
    setState(partial) {
      state = { ...state, ...partial };
      listeners.forEach((fn) => fn(state));
    },

    // subscribe: fn will be called immediately and on every change
    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    },

    // clear store
    reset() {
      state = initialState;
      listeners.forEach((fn) => fn(state));
    },
  };
}
