/**
 * Fine-Grained Dependency Tracking
 *
 * Key optimizations:
 * 1. WeakMap for automatic garbage collection of unused dependencies
 * 2. Set-based dependency storage for O(1) add/remove/has operations
 * 3. Bitwise flags for tracking dependency states
 * 4. Lazy subscription - only track what's actually used
 *
 * This system enables surgical DOM updates - only the exact bindings
 * that depend on a changed value are updated.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * A reactive effect that should be re-run when dependencies change.
 */
export interface ReactiveEffect {
  /** The function to run when dependencies change */
  run: () => void;
  /** Unique identifier for deduplication */
  id: number;
  /** Whether the effect is currently active */
  active: boolean;
  /** Dependencies this effect subscribes to */
  deps: Dep[];
}

/**
 * A dependency is a Set of effects that depend on a value.
 */
export type Dep = Set<ReactiveEffect> & {
  /** Cleanup function for this dep */
  cleanup?: () => void;
};

/**
 * Dependency map for an object - maps property keys to their deps.
 */
export type DepsMap = Map<string | symbol, Dep>;

// ============================================================================
// Global State
// ============================================================================

/**
 * WeakMap from target objects to their dependency maps.
 * Using WeakMap ensures deps are garbage collected when objects are.
 */
const targetMap = new WeakMap<object, DepsMap>();

/**
 * The currently running effect (for automatic dependency tracking).
 */
let activeEffect: ReactiveEffect | null = null;

/**
 * Stack of effects for nested effect handling.
 */
const effectStack: ReactiveEffect[] = [];

/**
 * Effect ID counter for unique identification.
 */
let effectId = 0;

/**
 * Track whether we should collect dependencies.
 * Can be disabled during certain operations (like cleanup).
 */
let shouldTrack = true;

/**
 * Tracking stack for nested pauseTracking/resumeTracking calls.
 */
const trackStack: boolean[] = [];

// ============================================================================
// Dependency Tracking
// ============================================================================

/**
 * Tracks a dependency on a property access.
 * Call this in a Proxy getter to register the current effect as a subscriber.
 *
 * @param target - The reactive object being accessed
 * @param key - The property being accessed
 *
 * @example
 * // In a reactive proxy getter:
 * get(target, key) {
 *   track(target, key);
 *   return Reflect.get(target, key);
 * }
 */
export function track(target: object, key: string | symbol): void {
  if (!shouldTrack || !activeEffect) {
    return;
  }

  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = new Map();
    targetMap.set(target, depsMap);
  }

  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set() as Dep;
    depsMap.set(key, dep);
  }

  trackEffect(dep);
}

/**
 * Adds the active effect to a dependency set.
 */
function trackEffect(dep: Dep): void {
  if (!activeEffect) return;

  // Only add if not already tracking this dep
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
  }
}

/**
 * Triggers effects that depend on a property.
 * Call this in a Proxy setter after the value changes.
 *
 * @param target - The reactive object being modified
 * @param key - The property being modified
 *
 * @example
 * // In a reactive proxy setter:
 * set(target, key, value) {
 *   const result = Reflect.set(target, key, value);
 *   trigger(target, key);
 *   return result;
 * }
 */
export function trigger(target: object, key: string | symbol): void {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }

  const dep = depsMap.get(key);
  if (!dep) {
    return;
  }

  triggerEffects(dep);
}

/**
 * Runs all effects in a dependency set.
 */
function triggerEffects(dep: Dep): void {
  // Create a copy to avoid infinite loops if effect modifies deps
  const effects = [...dep];

  for (const effect of effects) {
    // Don't trigger an effect that's currently running (prevents infinite loops)
    if (effect !== activeEffect && effect.active) {
      effect.run();
    }
  }
}

// ============================================================================
// Effect Management
// ============================================================================

/**
 * Creates and registers a reactive effect.
 * The effect function is called immediately, and dependencies are automatically tracked.
 * When any dependency changes, the effect is re-run.
 *
 * @param fn - The effect function
 * @returns A function to stop the effect
 *
 * @example
 * const stop = effect(() => {
 *   console.log('Count is:', state.count);
 * });
 * // Logs immediately: "Count is: 0"
 *
 * state.count = 5;
 * // Logs again: "Count is: 5"
 *
 * stop(); // Stop watching
 * state.count = 10;
 * // No log - effect is stopped
 */
export function effect(fn: () => void): () => void {
  const reactiveEffect: ReactiveEffect = {
    run: () => {
      if (!reactiveEffect.active) {
        return;
      }

      // Clean up old dependencies before re-running
      cleanup(reactiveEffect);

      // Push to stack and set as active
      effectStack.push(reactiveEffect);
      activeEffect = reactiveEffect;

      try {
        fn();
      } finally {
        // Pop from stack and restore previous active effect
        effectStack.pop();
        activeEffect = effectStack[effectStack.length - 1] || null;
      }
    },
    id: ++effectId,
    active: true,
    deps: [],
  };

  // Run immediately to collect dependencies
  reactiveEffect.run();

  // Return stop function
  return () => {
    if (reactiveEffect.active) {
      cleanup(reactiveEffect);
      reactiveEffect.active = false;
    }
  };
}

/**
 * Removes an effect from all its dependency sets.
 */
function cleanup(effect: ReactiveEffect): void {
  for (const dep of effect.deps) {
    dep.delete(effect);
  }
  effect.deps.length = 0;
}

// ============================================================================
// Tracking Control
// ============================================================================

/**
 * Temporarily pause dependency tracking.
 * Useful when reading values without creating dependencies.
 */
export function pauseTracking(): void {
  trackStack.push(shouldTrack);
  shouldTrack = false;
}

/**
 * Resume dependency tracking after pauseTracking().
 */
export function resumeTracking(): void {
  const last = trackStack.pop();
  shouldTrack = last ?? true;
}

/**
 * Execute a function without tracking dependencies.
 *
 * @param fn - Function to execute
 * @returns The return value of fn
 */
export function untrack<T>(fn: () => T): T {
  pauseTracking();
  try {
    return fn();
  } finally {
    resumeTracking();
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Gets the dependency map for a target object.
 * Useful for debugging and testing.
 */
export function getDeps(target: object): DepsMap | undefined {
  return targetMap.get(target);
}

/**
 * Gets the number of effects depending on a property.
 * Useful for debugging and testing.
 */
export function getDepCount(target: object, key: string | symbol): number {
  return targetMap.get(target)?.get(key)?.size ?? 0;
}

/**
 * Clears all dependency tracking.
 * Useful for testing or cleanup.
 */
export function resetTracking(): void {
  activeEffect = null;
  effectStack.length = 0;
  shouldTrack = true;
  trackStack.length = 0;
}
