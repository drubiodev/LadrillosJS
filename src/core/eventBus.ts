/**
 * Global Event Bus for component-to-component communication
 * Allows components to emit events and listen to events from other components
 */

type EventCallback = (data?: any) => void | Promise<void>;
type EventListeners = Map<string, Set<EventCallback>>;

class EventBus {
  private listeners: EventListeners = new Map();

  /**
   * Emit an event with optional data
   * @param eventName - The name of the event to emit
   * @param data - Optional data to pass to listeners
   * @returns Promise that resolves when all listeners have been called
   */
  emit(eventName: string, data?: any): Promise<void> {
    // Also dispatch as a native DOM CustomEvent so document.addEventListener works
    const customEvent = new CustomEvent(eventName, {
      detail: data,
      bubbles: true,
      composed: true,
    });
    document.dispatchEvent(customEvent);

    const callbacks = this.listeners.get(eventName);

    if (!callbacks || callbacks.size === 0) {
      // No listeners, resolve immediately
      return Promise.resolve();
    }

    // Execute all callbacks and collect promises
    const promises: Promise<void>[] = [];

    callbacks.forEach((callback) => {
      try {
        const result = callback(data);
        // If callback returns a promise, add it to promises array
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        console.error(`Error in event listener for "${eventName}":`, error);
        promises.push(Promise.reject(error));
      }
    });

    // If any callbacks returned promises, wait for all of them
    if (promises.length > 0) {
      return Promise.all(promises).then(() => undefined);
    }

    return Promise.resolve();
  }

  /**
   * Listen to an event
   * @param eventName - The name of the event to listen for
   * @param callback - Function to call when event is emitted
   * @returns Function to remove the listener
   */
  listen(eventName: string, callback: EventCallback): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    this.listeners.get(eventName)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.off(eventName, callback);
    };
  }

  /**
   * Remove a specific event listener
   * @param eventName - The name of the event
   * @param callback - The callback to remove
   */
  off(eventName: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(eventName);
    if (callbacks) {
      callbacks.delete(callback);
      // Clean up empty sets
      if (callbacks.size === 0) {
        this.listeners.delete(eventName);
      }
    }
  }

  /**
   * Remove all listeners for an event, or all listeners if no event specified
   * @param eventName - Optional event name to clear listeners for
   */
  clear(eventName?: string): void {
    if (eventName) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get count of listeners for an event
   * @param eventName - The event name
   * @returns Number of listeners
   */
  listenerCount(eventName: string): number {
    return this.listeners.get(eventName)?.size ?? 0;
  }
}

// Export singleton instance
export const eventBus = new EventBus();
