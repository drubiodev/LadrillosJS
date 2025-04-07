/**
 * Utility for conditional logging based on environment
 */
export const logger = {
  /**
   * Log a message only in development mode
   * @param {string} message - The message to log
   * @param {any[]} args - Additional arguments to log
   */
  log(message, ...args) {
    if (import.meta.env.DEV) {
      console.log(message, ...args);
    }
  },

  /**
   * Log an error (always logs in both dev and production)
   * @param {string} message - The error message
   * @param {any[]} args - Additional arguments to log
   */
  error(message, ...args) {
    console.error(message, ...args);
  },

  /**
   * Log a warning only in development mode
   * @param {string} message - The warning message
   * @param {any[]} args - Additional arguments to log
   */
  warn(message, ...args) {
    if (import.meta.env.DEV) {
      console.warn(message, ...args);
    }
  },
};
