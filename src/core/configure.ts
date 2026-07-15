/**
 * Framework-level configuration API for LadrillosJS.
 *
 * Exposed to consumers via `import { configure } from 'ladrillosjs'`.
 * All options are optional; unspecified keys retain their defaults.
 */

import { setCacheSize } from "./component/cache";
import {
  setErrorHandler,
  type LadrillosErrorHandler,
} from "../utils/devWarnings";

/**
 * Options accepted by `configure()`.
 */
export interface LadrillosConfig {
  /**
   * Maximum number of component source files retained in the LRU cache.
   * Defaults to 25. Must be a positive integer.
   */
  cacheSize?: number;

  /**
   * Custom error handler. Called in addition to the framework's built-in
   * console logging so embedders can route framework errors to telemetry.
   *
   * @example
   * configure({
   *   onError: (err) => telemetry.capture(err),
   * });
   */
  onError?: LadrillosErrorHandler | null;

  /**
   * Opt-in event delegation for `<for>` loop rows. When enabled, eligible
   * inline handlers (onclick, $on:… on bubbling events) inside loop rows
   * share ONE listener per event type on the loop's container instead of
   * one listener per element — faster bulk row creation and less memory on
   * large lists. Handler code and template syntax are unchanged.
   *
   * Two observable differences versus direct listeners:
   *   1. `event.currentTarget` inside a loop handler is the list container,
   *      not the row element (`event.target` is unaffected).
   *   2. A manual `stopPropagation()` call from a listener you attach
   *      yourself between the row and the container stops delegated
   *      handlers from firing.
   *
   * Non-bubbling events (focus, blur, mouseenter, …) and handlers using
   * the `.self`, `.capture`, `.once`, or `.passive` modifiers automatically
   * keep per-element listeners.
   *
   * Set this before components render; templates already rendered keep the
   * mode they were created with. Defaults to false.
   */
  delegateLoopEvents?: boolean;
}

let loopDelegationEnabled = false;

/** Whether opt-in loop event delegation is active (see LadrillosConfig). */
export function isLoopDelegationEnabled(): boolean {
  return loopDelegationEnabled;
}

/**
 * Configure framework-level options.
 *
 * Safe to call at any time; subsequent calls override prior values. Pass
 * `onError: null` to clear a previously registered handler.
 */
export function configure(config: LadrillosConfig): void {
  if (config.cacheSize !== undefined) {
    setCacheSize(config.cacheSize);
  }
  if (config.onError !== undefined) {
    setErrorHandler(config.onError);
  }
  if (config.delegateLoopEvents !== undefined) {
    loopDelegationEnabled = config.delegateLoopEvents;
  }
}
