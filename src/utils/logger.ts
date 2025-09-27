/**
 * Utility for conditional logging based on environment
 */

// Type guard for Vite environment
const isDevelopment = (): boolean => {
  try {
    return (import.meta as any).env?.DEV === true;
  } catch {
    return process.env.NODE_ENV === 'development';
  }
};

export const logger = {
  /**
   * Log a message only in development mode
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  log(message: string, ...args: any[]): void {
    if (isDevelopment()) {
      console.log(message, ...args);
    }
  },

  /**
   * Log an error (always logs in both dev and production)
   * @param message - The error message
   * @param args - Additional arguments to log
   */
  error(message: string, ...args: any[]): void {
    console.error(message, ...args);
  },

  /**
   * Log a warning only in development mode
   * @param message - The warning message
   * @param args - Additional arguments to log
   */
  warn(message: string, ...args: any[]): void {
    if (isDevelopment()) {
      console.warn(message, ...args);
    }
  },
};
