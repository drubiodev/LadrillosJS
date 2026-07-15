/**
 * LadrillosJS Events Module
 *
 * Provides the event bus for cross-component communication.
 * Import this module only if you need $emit/$listen.
 *
 * @example
 * ```ts
 * import { $emit, $listen } from 'ladrillosjs/events';
 *
 * // Emit an event
 * $emit('user-login', { userId: 123 });
 *
 * // Listen for events
 * const unsubscribe = $listen('user-login', (data) => {
 *   console.log('User logged in:', data.userId);
 * });
 * ```
 */

export {
  $emit,
  $listen,
  type EventCallback,
  type Unsubscribe,
} from "./core/events/eventBus";
