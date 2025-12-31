import { BindingDescriptor } from "../../types";
import { getCachedVariableRegex } from "../cache/expressionCache";

// ============================================================================
// Types
// ============================================================================

/**
 * Maps state keys to the bindings that depend on them.
 * When a key changes, all its dependent bindings need to be re-evaluated.
 */
type BindingRegistry = Map<string, Set<BindingDescriptor>>;

/**
 * Function signature for updating a single binding with new state
 */
type UpdateBindingFn = (
  binding: BindingDescriptor,
  state: Record<string, unknown>
) => void;

/**
 * Symbol to mark arrays that have already been wrapped with reactivity.
 * Prevents double-wrapping and allows identification of reactive arrays.
 */
const REACTIVE_ARRAY = Symbol("reactive-array");

/**
 * Array methods that mutate the array and should trigger reactivity updates.
 */
const ARRAY_MUTATION_METHODS = [
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
] as const;

// ============================================================================
// Reactive Arrays
// ============================================================================

/**
 * Wraps an array in a Proxy that intercepts mutation methods.
 * When any mutation method is called, the onMutate callback is triggered,
 * which updates all directives (like $for loops).
 *
 * Example:
 *   const items = createReactiveArray(['a', 'b'], () => console.log('changed!'));
 *   items.push('c');  // Logs: "changed!"
 *   items[0] = 'x';   // Also triggers reactivity (index assignment)
 *
 * @param arr - The array to make reactive
 * @param onMutate - Callback to trigger when the array is mutated
 * @returns A reactive proxy of the array
 */
export function createReactiveArray<T>(arr: T[], onMutate: () => void): T[] {
  // Don't double-wrap arrays that are already reactive
  if ((arr as any)[REACTIVE_ARRAY]) {
    return arr;
  }

  const reactiveArray = new Proxy(arr, {
    get(target, key: string | symbol) {
      // Mark this array as reactive
      if (key === REACTIVE_ARRAY) {
        return true;
      }

      const value = target[key as keyof typeof target];

      // Intercept mutation methods
      if (
        typeof key === "string" &&
        ARRAY_MUTATION_METHODS.includes(key as any) &&
        typeof value === "function"
      ) {
        return (...args: unknown[]) => {
          // Wrap any array arguments (e.g., for splice adding new items)
          const wrappedArgs = args.map((arg) =>
            Array.isArray(arg) ? createReactiveArray(arg, onMutate) : arg
          );

          // Call the original method
          const result = (value as Function).apply(target, wrappedArgs);

          // Trigger reactivity update
          onMutate();

          return result;
        };
      }

      // Recursively wrap nested arrays
      if (Array.isArray(value)) {
        return createReactiveArray(value, onMutate);
      }

      return value;
    },

    set(target, key: string | symbol, value) {
      const index = typeof key === "string" ? parseInt(key, 10) : NaN;
      const isIndexAssignment = !isNaN(index);
      const isLengthChange = key === "length";

      // Wrap array values being assigned
      const wrappedValue = Array.isArray(value)
        ? createReactiveArray(value, onMutate)
        : value;

      // Check if value actually changed
      const oldValue = target[key as keyof typeof target];
      if (oldValue === wrappedValue) {
        return true;
      }

      // Set the value
      (target as any)[key] = wrappedValue;

      // Trigger reactivity for index assignments or length changes
      if (isIndexAssignment || isLengthChange) {
        onMutate();
      }

      return true;
    },

    deleteProperty(target, key: string | symbol) {
      const result = delete (target as any)[key];
      if (result) {
        onMutate();
      }
      return result;
    },
  });

  return reactiveArray;
}

/**
 * Recursively wraps all arrays in an object with reactive proxies.
 * This ensures nested arrays also trigger reactivity updates.
 *
 * @param obj - Object containing potential arrays to wrap
 * @param onMutate - Callback when any array is mutated
 * @returns The object with all arrays wrapped
 */
function wrapArraysInObject(
  obj: Record<string, unknown>,
  onMutate: () => void
): Record<string, unknown> {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (Array.isArray(value)) {
      obj[key] = createReactiveArray(value, onMutate);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      // Recursively wrap arrays in nested objects
      wrapArraysInObject(value as Record<string, unknown>, onMutate);
    }
  }
  return obj;
}

// ============================================================================
// Reactive State
// ============================================================================

/**
 * Creates a reactive state object that automatically updates the DOM
 * when properties change.
 *
 * How it works:
 *   1. Wraps the initial state in a Proxy
 *   2. When a property is set, finds all bindings that depend on it
 *   3. Re-evaluates those bindings and updates the DOM
 *
 * Supports dynamically adding new state keys (e.g., from module scripts).
 * When a new key is added, it automatically finds bindings that depend on it.
 *
 * Example:
 *   const state = createReactiveState({ count: 0 }, bindings, updateFn);
 *   state.count++;  // Automatically updates all {count} bindings in the DOM
 *   state.name = "hello"; // New key - finds and updates {name} bindings
 *
 * @param initialState - Initial state values extracted from component script
 * @param bindings - All template bindings that might depend on state
 * @param updateBinding - Function to re-evaluate and update a single binding
 * @param onStateChange - Optional callback when any state property changes (for directives)
 */
export function createReactiveState(
  initialState: Record<string, unknown>,
  bindings: BindingDescriptor[],
  updateBinding: UpdateBindingFn,
  onStateChange?: () => void
): Record<string, unknown> {
  // Build dependency map: which bindings depend on which state keys
  const registry = buildBindingRegistry(bindings, Object.keys(initialState));

  // Helper to trigger all updates for a key
  const triggerUpdate = (key: string, target: Record<string, unknown>) => {
    const dependentBindings = registry.get(key);
    if (dependentBindings) {
      for (const binding of dependentBindings) {
        updateBinding(binding, target);
      }
    }
    if (onStateChange) {
      onStateChange();
    }
  };

  // Wrap any arrays in initialState with reactive proxies
  // This enables array.push(), array.splice(), etc. to trigger updates
  wrapArraysInObject(initialState, () => {
    if (onStateChange) {
      onStateChange();
    }
  });

  // Create a Proxy that intercepts property changes
  const reactiveState = new Proxy(initialState, {
    get(target, key: string) {
      return target[key];
    },

    set(target, key: string, value) {
      // Check if this is a NEW key being added
      const isNewKey = !(key in target);

      // Skip if value hasn't actually changed (for existing keys)
      if (!isNewKey && target[key] === value) return true;

      // Wrap arrays with reactive proxies before storing
      const wrappedValue = Array.isArray(value)
        ? createReactiveArray(value, () => {
            if (onStateChange) {
              onStateChange();
            }
          })
        : value;

      // Update the underlying value
      target[key] = wrappedValue;

      // If new key, register bindings that depend on it
      if (isNewKey) {
        registerNewKey(key, bindings, registry);
      }

      // Find and update all bindings that depend on this key
      triggerUpdate(key, target);

      return true;
    },
  });

  return reactiveState;
}

// ============================================================================
// Dependency Tracking
// ============================================================================

/**
 * Analyzes bindings to determine which state keys they depend on.
 *
 * Creates a reverse mapping from state keys to bindings:
 *   "name" → [binding for "{name}", binding for "{name.toUpperCase()}"]
 *   "count" → [binding for "{count}", binding for "{count + 1}"]
 *
 * This allows O(1) lookup when a state key changes to find which
 * bindings need to be updated.
 */
function buildBindingRegistry(
  bindings: BindingDescriptor[],
  stateKeys: string[]
): BindingRegistry {
  const registry: BindingRegistry = new Map();

  // Initialize empty sets for each state key
  for (const key of stateKeys) {
    registry.set(key, new Set());
  }

  // For each binding, figure out which state keys it references
  for (const descriptor of bindings) {
    for (const binding of descriptor.bindings) {
      // Check if any state key appears in the expression
      for (const key of stateKeys) {
        if (expressionDependsOn(binding.raw, key)) {
          registry.get(key)!.add(descriptor);
        }
      }
    }
  }

  return registry;
}

/**
 * Registers bindings for a newly added state key.
 * Called when a new property is added to the reactive state
 * (e.g., from module scripts loaded after initial setup).
 */
function registerNewKey(
  key: string,
  bindings: BindingDescriptor[],
  registry: BindingRegistry
): void {
  // Create a new set for this key
  registry.set(key, new Set());

  // Find all bindings that depend on this key
  for (const descriptor of bindings) {
    for (const binding of descriptor.bindings) {
      if (expressionDependsOn(binding.raw, key)) {
        registry.get(key)!.add(descriptor);
      }
    }
  }
}

/**
 * Checks if an expression depends on a variable name.
 * Uses word boundary matching to avoid false positives.
 * Caches regex patterns for performance.
 *
 * Examples:
 *   - expressionDependsOn("name.toUpperCase()", "name") → true
 *   - expressionDependsOn("username", "name") → false (part of another word)
 *   - expressionDependsOn("count + 1", "count") → true
 *   - expressionDependsOn("counter", "count") → false
 */
function expressionDependsOn(
  expression: string,
  variableName: string
): boolean {
  // Use cached regex for performance (avoids creating new RegExp each call)
  const regex = getCachedVariableRegex(variableName);
  return regex.test(expression);
}

// ============================================================================
// Binding Update Helper
// ============================================================================

/**
 * Creates the update function that re-evaluates a binding and updates the DOM.
 * This should be called once when setting up reactivity, then passed to
 * createReactiveState.
 *
 * @param evaluateExpression - Function to evaluate {expression} against state
 */
export function createBindingUpdater(
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>
  ) => unknown
): UpdateBindingFn {
  return (descriptor: BindingDescriptor, state: Record<string, unknown>) => {
    let result = descriptor.original;

    // Re-evaluate each {expression} in the binding
    for (const binding of descriptor.bindings) {
      const evaluated = evaluateExpression(binding.raw, state);
      const stringValue = String(evaluated ?? "");
      result = result.replace(`{${binding.raw}}`, stringValue);
    }

    // Update the DOM
    if (descriptor.isAttribute && descriptor.attributeName) {
      const element =
        (descriptor as any).element ?? descriptor.node.parentElement;
      if (element) {
        element.setAttribute(descriptor.attributeName, result);
      }
    } else {
      descriptor.node.textContent = result;
    }
  };
}
