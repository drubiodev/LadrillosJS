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
 * Symbol exposing the set of mutation subscribers on a reactive array.
 * When the same array is shared across owners (e.g. a parent passes it to a
 * child component as a prop), each owner registers its own onMutate callback
 * here so a single mutation (push/splice/index assignment) re-renders every
 * component that depends on the array — not just the one that created it.
 */
const REACTIVE_ARRAY_SUBSCRIBERS = Symbol("reactive-array-subscribers");

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
export function createReactiveArray<T>(arr: T[], onMutate: () => void): T[]
{
  // Already reactive: register this additional subscriber instead of
  // re-wrapping. This lets multiple owners (parent + child sharing the array
  // as a prop) all be notified when the SAME array reference mutates.
  if ((arr as any)[REACTIVE_ARRAY])
  {
    const subscribers = (arr as any)[REACTIVE_ARRAY_SUBSCRIBERS] as
      | Set<() => void>
      | undefined;
    if (subscribers && onMutate)
    {
      subscribers.add(onMutate);
    }
    return arr;
  }

  // Each reactive array owns a set of mutation callbacks. `notify` fans a
  // single mutation out to every registered subscriber.
  const subscribers = new Set<() => void>();
  if (onMutate)
  {
    subscribers.add(onMutate);
  }
  const notify = () =>
  {
    for (const subscriber of subscribers)
    {
      subscriber();
    }
  };

  const reactiveArray = new Proxy(arr, {
    get(target, key: string | symbol)
    {
      // Mark this array as reactive
      if (key === REACTIVE_ARRAY)
      {
        return true;
      }

      // Expose the subscriber set so additional owners can register.
      if (key === REACTIVE_ARRAY_SUBSCRIBERS)
      {
        return subscribers;
      }

      const value = target[key as keyof typeof target];

      // Intercept mutation methods
      if (
        typeof key === "string" &&
        ARRAY_MUTATION_METHODS.includes(key as any) &&
        typeof value === "function"
      )
      {
        return (...args: unknown[]) =>
        {
          // Wrap any array arguments (e.g., for splice adding new items)
          const wrappedArgs = args.map((arg) =>
            Array.isArray(arg) ? createReactiveArray(arg, notify) : arg
          );

          // Call the original method
          const result = (value as Function).apply(target, wrappedArgs);

          // Trigger reactivity update for every subscriber
          notify();

          return result;
        };
      }

      // Recursively wrap nested arrays
      if (Array.isArray(value))
      {
        return createReactiveArray(value, notify);
      }

      return value;
    },

    set(target, key: string | symbol, value)
    {
      const index = typeof key === "string" ? parseInt(key, 10) : NaN;
      const isIndexAssignment = !isNaN(index);
      const isLengthChange = key === "length";

      // Wrap array values being assigned
      const wrappedValue = Array.isArray(value)
        ? createReactiveArray(value, notify)
        : value;

      // Check if value actually changed
      const oldValue = target[key as keyof typeof target];
      if (oldValue === wrappedValue)
      {
        return true;
      }

      // Set the value
      (target as any)[key] = wrappedValue;

      // Trigger reactivity for index assignments or length changes
      if (isIndexAssignment || isLengthChange)
      {
        notify();
      }

      return true;
    },

    deleteProperty(target, key: string | symbol)
    {
      const result = delete (target as any)[key];
      if (result)
      {
        notify();
      }
      return result;
    },
  });

  return reactiveArray;
}

/**
 * Checks whether a value is a plain object (created via `{}` literal or
 * `Object.create(null)`). Dates, Maps, DOM nodes, class instances, and
 * arrays are excluded — only plain objects get deep reactive wrapping.
 */
function isPlainObject(value: unknown): value is Record<string, unknown>
{
  if (value === null || typeof value !== "object" || Array.isArray(value))
  {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
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
): Record<string, unknown>
{
  for (const key of Object.keys(obj))
  {
    const value = obj[key];
    if (Array.isArray(value))
    {
      obj[key] = createReactiveArray(value, onMutate);
    } else if (value && typeof value === "object" && !Array.isArray(value))
    {
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
): Record<string, unknown>
{
  // Build dependency map: which bindings depend on which state keys
  const registry = buildBindingRegistry(bindings, initialState);

  // Helper to trigger all updates for a key
  const triggerUpdate = (key: string, target: Record<string, unknown>) =>
  {
    const dependentBindings = registry.get(key);
    if (dependentBindings)
    {
      for (const binding of dependentBindings)
      {
        updateBinding(binding, target);
      }
    }
    if (onStateChange)
    {
      onStateChange();
    }
  };

  // Key-aware mutation handler for reactive arrays. A push/splice/index
  // assignment must update the same bindings a reassignment of the key
  // would (e.g. {items.length}), not just the directives — so it routes
  // through triggerUpdate for the owning top-level key. During script
  // bootstrap (__suspendReactivity) bindings can't be evaluated yet, so
  // only the (batched) directive callback runs.
  const arrayOnMutate = (key: string) => () =>
  {
    if ((initialState as any).__suspendReactivity)
    {
      if (onStateChange)
      {
        onStateChange();
      }
      return;
    }
    triggerUpdate(key, initialState);
  };

  // External mutation channel: module-script arrays wrapped OUTSIDE this
  // closure (e.g. the __wrapReactiveArray helper injected into external
  // modules) can't reach triggerUpdate directly. The state proxy exposes
  // this function as `__notifyKeyChanged` so those wrappers can request
  // the same per-key binding updates a reassignment would produce.
  const notifyKeyChanged = (key: string): void =>
  {
    arrayOnMutate(key)();
  };

  // Wrap any arrays in initialState with reactive proxies, each tied to its
  // top-level key. This enables array.push(), array.splice(), etc. to
  // trigger updates for the bindings that depend on that key.
  for (const key of Object.keys(initialState))
  {
    const value = initialState[key];
    if (Array.isArray(value))
    {
      initialState[key] = createReactiveArray(value, arrayOnMutate(key));
    } else if (value && typeof value === "object")
    {
      wrapArraysInObject(value as Record<string, unknown>, arrayOnMutate(key));
    }
  }

  // Deep reactivity: nested plain objects read off the state are wrapped in
  // proxies (lazily, on property access) so writes like
  // `user.profile.name = "x"` — from scripts or $bind's setNestedValue —
  // trigger the bindings that depend on the ROOT key ("user"). The binding
  // registry is keyed by top-level state keys, so any nested write updates
  // everything that references that root. Proxies are cached per
  // (object, rootKey) pair to keep identity stable across reads.
  const deepProxyCache = new WeakMap<object, Map<string, object>>();

  const wrapDeep = (
    obj: Record<string, unknown>,
    rootKey: string
  ): Record<string, unknown> =>
  {
    let byRoot = deepProxyCache.get(obj);
    const cached = byRoot?.get(rootKey);
    if (cached)
    {
      return cached as Record<string, unknown>;
    }

    const proxy = new Proxy(obj, {
      get(target, key)
      {
        const value = target[key as keyof typeof target];
        if (typeof key === "string" && isPlainObject(value))
        {
          return wrapDeep(value, rootKey);
        }
        return value;
      },

      set(target, key, value)
      {
        if (typeof key !== "string")
        {
          (target as any)[key] = value;
          return true;
        }

        // Skip if value hasn't actually changed
        if (key in target && target[key] === value) return true;

        // Arrays assigned into nested objects become reactive, tied to
        // the same root key so mutations re-render its dependents.
        target[key] = Array.isArray(value)
          ? createReactiveArray(value, arrayOnMutate(rootKey))
          : value;

        if (!(initialState as any).__suspendReactivity)
        {
          triggerUpdate(rootKey, initialState);
        }
        return true;
      },

      deleteProperty(target, key)
      {
        const existed = key in target;
        delete (target as any)[key];
        if (
          existed &&
          typeof key === "string" &&
          !(initialState as any).__suspendReactivity
        )
        {
          triggerUpdate(rootKey, initialState);
        }
        return true;
      },
    });

    if (!byRoot)
    {
      byRoot = new Map();
      deepProxyCache.set(obj, byRoot);
    }
    byRoot.set(rootKey, proxy);
    return proxy;
  };

  // Create a Proxy that intercepts property changes
  const reactiveState = new Proxy(initialState, {
    get(target, key: string)
    {
      // Not an own property (get-trap only), so it never appears in
      // Object.keys(state) or event-handler destructuring.
      if (key === "__notifyKeyChanged")
      {
        return notifyKeyChanged;
      }

      const value = target[key];
      if (typeof key === "string" && isPlainObject(value))
      {
        return wrapDeep(value, key);
      }
      return value;
    },

    set(target, key: string, value)
    {
      // Check if this is a NEW key being added
      const isNewKey = !(key in target);

      // Skip if value hasn't actually changed (for existing keys)
      if (!isNewKey && target[key] === value) return true;

      // Wrap arrays with reactive proxies before storing, tied to this key
      // so mutations update the bindings that depend on it.
      const wrappedValue = Array.isArray(value)
        ? createReactiveArray(value, arrayOnMutate(key))
        : value;

      // Update the underlying value
      target[key] = wrappedValue;

      // If new key, register bindings that depend on it
      if (isNewKey)
      {
        registerNewKey(key, bindings, registry, target);
      }

      // Skip binding updates while reactivity is suspended (e.g. during
      // module-script bootstrap). Callers re-apply bindings once all state
      // is populated, avoiding spurious ReferenceErrors for variables that
      // are declared later in the same script.
      if ((target as any).__suspendReactivity)
      {
        return true;
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
  state: Record<string, unknown>
): BindingRegistry
{
  const registry: BindingRegistry = new Map();
  const stateKeys = Object.keys(state);

  // Initialize empty sets for each state key
  for (const key of stateKeys)
  {
    registry.set(key, new Set());
  }

  // For each binding, figure out which state keys it references
  for (const descriptor of bindings)
  {
    for (const binding of descriptor.bindings)
    {
      // Check if any state key appears in the expression
      for (const key of stateKeys)
      {
        if (expressionDependsOn(binding.raw, key))
        {
          registry.get(key)!.add(descriptor);
        }
      }
    }
  }

  linkCallDependencies(bindings, registry, state);

  return registry;
}

/**
 * Source text of a state function, cached. Empty for natives.
 */
const functionSourceCache = new WeakMap<Function, string>();

function functionSource(fn: Function): string
{
  let source = functionSourceCache.get(fn);
  if (source === undefined)
  {
    try
    {
      source = Function.prototype.toString.call(fn);
    } catch
    {
      source = "";
    }
    if (source.includes("[native code]")) source = "";
    functionSourceCache.set(fn, source);
  }
  return source;
}

/**
 * State keys an expression reaches by *calling into* a state function.
 *
 * The registry matches key names against expression text, so `{shout()}` looks
 * independent of everything `shout` reads and would never be invalidated.
 * Script transformation rewrites those reads to `__state__.name`, so the
 * function's own source names them — follow calls to other state functions too.
 *
 * Static, like the rest of the dependency model: dynamic access such as
 * `state[key]` is invisible here, exactly as it is in a template expression.
 */
function keysReachedThroughCalls(
  expression: string,
  state: Record<string, unknown>,
  stateKeys: string[]
): Set<string>
{
  const reached = new Set<string>();
  const pending: string[] = [];
  const visited = new Set<string>();

  for (const key of stateKeys)
  {
    if (
      typeof state[key] === "function" &&
      expressionDependsOn(expression, key)
    )
    {
      pending.push(key);
    }
  }

  while (pending.length > 0)
  {
    const fnKey = pending.pop()!;
    if (visited.has(fnKey)) continue;
    visited.add(fnKey);

    const source = functionSource(state[fnKey] as Function);
    if (!source) continue;

    for (const key of stateKeys)
    {
      if (key === fnKey || !expressionDependsOn(source, key)) continue;
      reached.add(key);
      if (typeof state[key] === "function") pending.push(key);
    }
  }

  return reached;
}

/**
 * Adds each binding to the key sets it reaches only by calling a function.
 *
 * Re-run whenever a key is added, because a function can be registered after
 * the state it reads, or before it.
 */
function linkCallDependencies(
  bindings: BindingDescriptor[],
  registry: BindingRegistry,
  state: Record<string, unknown>
): void
{
  const stateKeys = Object.keys(state);
  if (!stateKeys.some((key) => typeof state[key] === "function")) return;

  for (const descriptor of bindings)
  {
    for (const binding of descriptor.bindings)
    {
      for (const key of keysReachedThroughCalls(binding.raw, state, stateKeys))
      {
        registry.get(key)?.add(descriptor);
      }
    }
  }
}

/**
 * Registers bindings for a newly added state key.
 * Called when a new property is added to the reactive state
 * (e.g., from module scripts loaded after initial setup).
 */
function registerNewKey(
  key: string,
  bindings: BindingDescriptor[],
  registry: BindingRegistry,
  state: Record<string, unknown>
): void
{
  // Create a new set for this key
  registry.set(key, new Set());

  // Find all bindings that depend on this key
  for (const descriptor of bindings)
  {
    for (const binding of descriptor.bindings)
    {
      if (expressionDependsOn(binding.raw, key))
      {
        registry.get(key)!.add(descriptor);
      }
    }
  }

  linkCallDependencies(bindings, registry, state);
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
): boolean
{
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
): UpdateBindingFn
{
  return (descriptor: BindingDescriptor, state: Record<string, unknown>) =>
  {
    let result = descriptor.original;

    // Re-evaluate each {expression} in the binding
    for (const binding of descriptor.bindings)
    {
      const evaluated = evaluateExpression(binding.raw, state);
      const stringValue = String(evaluated ?? "");
      result = result.replace(`{${binding.raw}}`, stringValue);
    }

    // Update the DOM
    if (descriptor.isAttribute && descriptor.attributeName)
    {
      const element =
        (descriptor as any).element ?? descriptor.node.parentElement;
      if (element)
      {
        element.setAttribute(descriptor.attributeName, result);
      }
    } else
    {
      descriptor.node.textContent = result;
    }
  };
}
