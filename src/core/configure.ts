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
}
