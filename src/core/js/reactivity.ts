import { BindingDescriptor } from "../../types";

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

// ============================================================================
// Reactive State (Vue-style Proxy)
// ============================================================================

/**
 * Creates a reactive state object that automatically updates the DOM
 * when properties change.
 *
 * Inspired by Vue 3's reactivity system using JavaScript Proxy.
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
 */
export function createReactiveState(
  initialState: Record<string, unknown>,
  bindings: BindingDescriptor[],
  updateBinding: UpdateBindingFn
): Record<string, unknown> {
  // Build dependency map: which bindings depend on which state keys
  const registry = buildBindingRegistry(bindings, Object.keys(initialState));

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

      // Update the underlying value
      target[key] = value;

      // If new key, register bindings that depend on it
      if (isNewKey) {
        registerNewKey(key, bindings, registry);
      }

      // Find and update all bindings that depend on this key
      const dependentBindings = registry.get(key);
      if (dependentBindings) {
        for (const binding of dependentBindings) {
          updateBinding(binding, target);
        }
      }

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
  const regex = new RegExp(`\\b${escapeRegex(variableName)}\\b`);
  return regex.test(expression);
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
