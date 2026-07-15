/**
 * LadrillosJS Global Event Bus
 *
 * Provides cross-component communication without prop drilling.
 *
 * Usage:
 * - $emit("event-name", data) - Emit an event to all listeners
 * - $listen("event-name", callback) - Listen for events from any component
 *
 * @example
 * ```html
 * <!-- Component A: Emitting events -->
 * <script>
 *   const login = () => {
 *     $emit("user-logged-in", { userId: 123, username: "john" });
 *   };
 * </script>
 *
 * <!-- Component B: Listening for events -->
 * <script>
 *   let isLoggedIn = false;
 *   let username = "";
 *
 *   $listen("user-logged-in", (user) => {
 *     isLoggedIn = true;
 *     username = user.username;
 *   });
 * </script>
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Event listener callback function type
 */
export type EventListener<T = unknown> = (data: T) => void;

/**
 * Public alias for EventListener (for external API)
 */
export type EventCallback<T = unknown> = EventListener<T>;

/**
 * Internal listener registration with metadata for cleanup
 */
interface ListenerRegistration {
  callback: EventListener;
  componentId?: string; // Track which component registered this listener
}

/**
 * Unsubscribe function returned by $listen
 */
export type Unsubscribe = () => void;

// ============================================================================
// Global Event Bus (Singleton)
// ============================================================================

/**
 * Global event bus interface for type safety
 */
interface GlobalEventBus {
  listeners: Map<string, Set<ListenerRegistration>>;
  componentListeners: Map<
    string,
    Set<{ event: string; registration: ListenerRegistration }>
  >;
}

/**
 * Extend globalThis to include our event bus
 */
declare global {
  var __ladrillosEventBus: GlobalEventBus | undefined;
}

/**
 * Initialize or get the global event bus.
 * This is shared with external module scripts that inject their own $emit/$listen.
 */
function getEventBus(): GlobalEventBus {
  if (!globalThis.__ladrillosEventBus) {
    globalThis.__ladrillosEventBus = {
      listeners: new Map(),
      componentListeners: new Map(),
    };
  }
  return globalThis.__ladrillosEventBus;
}

/**
 * Get the listeners map (uses global storage)
 */
function getEventListeners(): Map<string, Set<ListenerRegistration>> {
  return getEventBus().listeners;
}

/**
 * Get the component listeners map (uses global storage)
 */
function getComponentListeners(): Map<
  string,
  Set<{ event: string; registration: ListenerRegistration }>
> {
  return getEventBus().componentListeners;
}

/**
 * Emit an event to all registered listeners.
 *
 * @param eventName - The name of the event to emit
 * @param data - Optional data to pass to listeners
 *
 * @example
 * ```js
 * $emit("user-logged-in", { userId: 123, username: "john" });
 * $emit("show-modal");
 * $emit("item-added", { id: 1, name: "Product" });
 * ```
 */
export function $emit<T = unknown>(eventName: string, data?: T): void {
  const eventListeners = getEventListeners();
  const listeners = eventListeners.get(eventName);
  if (!listeners || listeners.size === 0) {
    // No listeners for this event - that's fine, just return
    return;
  }

  // Call all listeners with the data
  for (const registration of listeners) {
    try {
      registration.callback(data as T);
    } catch (error) {
      console.error(
        `[LadrillosJS] Error in event listener for "${eventName}":`,
        error
      );
    }
  }
}

/**
 * Listen for events from any component.
 *
 * @param eventName - The name of the event to listen for
 * @param callback - Function to call when the event is emitted
 * @param componentId - Optional component ID for automatic cleanup
 * @returns Unsubscribe function to remove the listener
 *
 * @example
 * ```js
 * // Basic usage
 * $listen("user-logged-in", (user) => {
 *   console.log(`Welcome, ${user.username}!`);
 *   isLoggedIn = true;
 * });
 *
 * // With unsubscribe
 * const unsubscribe = $listen("notifications", handleNotification);
 * // Later: unsubscribe();
 * ```
 */
export function $listen<T = unknown>(
  eventName: string,
  callback: EventListener<T>,
  componentId?: string
): Unsubscribe {
  const eventListeners = getEventListeners();
  const componentListeners = getComponentListeners();

  // Get or create the listener set for this event
  let listeners = eventListeners.get(eventName);
  if (!listeners) {
    listeners = new Set();
    eventListeners.set(eventName, listeners);
  }

  // Create registration object
  const registration: ListenerRegistration = {
    callback: callback as EventListener,
    componentId,
  };

  // Add to event listeners
  listeners.add(registration);

  // Track by component ID for cleanup
  if (componentId) {
    let componentRegs = componentListeners.get(componentId);
    if (!componentRegs) {
      componentRegs = new Set();
      componentListeners.set(componentId, componentRegs);
    }
    componentRegs.add({ event: eventName, registration });
  }

  // Return unsubscribe function
  return () => {
    const eventListeners = getEventListeners();
    const componentListeners = getComponentListeners();

    listeners?.delete(registration);

    // Clean up empty listener sets
    if (listeners?.size === 0) {
      eventListeners.delete(eventName);
    }

    // Remove from component tracking
    if (componentId) {
      const componentRegs = componentListeners.get(componentId);
      if (componentRegs) {
        for (const reg of componentRegs) {
          if (reg.registration === registration) {
            componentRegs.delete(reg);
            break;
          }
        }
        if (componentRegs.size === 0) {
          componentListeners.delete(componentId);
        }
      }
    }
  };
}

/**
 * Remove all listeners registered by a specific component.
 * Called automatically when a component is disconnected from the DOM.
 *
 * @param componentId - The component's unique ID
 */
export function cleanupComponentListeners(componentId: string): void {
  const eventListeners = getEventListeners();
  const componentListeners = getComponentListeners();

  const componentRegs = componentListeners.get(componentId);
  if (!componentRegs) return;

  for (const { event, registration } of componentRegs) {
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.delete(registration);
      if (listeners.size === 0) {
        eventListeners.delete(event);
      }
    }
  }

  componentListeners.delete(componentId);
}

/**
 * Remove all event listeners (useful for testing)
 */
export function clearAllListeners(): void {
  getEventListeners().clear();
  getComponentListeners().clear();
}

/**
 * Get the count of listeners for an event (useful for debugging)
 */
export function getListenerCount(eventName: string): number {
  return getEventListeners().get(eventName)?.size ?? 0;
}

/**
 * Check if an event has any listeners
 */
export function hasListeners(eventName: string): boolean {
  return (getEventListeners().get(eventName)?.size ?? 0) > 0;
}

// ============================================================================
// Factory for Component-Bound Helpers
// ============================================================================

/**
 * Creates event bus helpers bound to a specific component.
 * This enables automatic cleanup when the component is disconnected.
 *
 * @param componentId - The unique ID of the component
 * @returns Object containing bound $emit and $listen functions
 */
export function createEventBusHelpers(componentId: string) {
  /**
   * Emit an event (same as global $emit)
   */
  function boundEmit<T = unknown>(eventName: string, data?: T): void {
    $emit(eventName, data);
  }

  /**
   * Listen for an event with automatic component tracking
   */
  function boundListen<T = unknown>(
    eventName: string,
    callback: EventListener<T>
  ): Unsubscribe {
    return $listen(eventName, callback, componentId);
  }

  return {
    $emit: boundEmit,
    $listen: boundListen,
  };
}

/**
 * Names of event bus helpers (for Function parameter lists)
 */
export const eventBusHelperNames = ["$emit", "$listen"];
