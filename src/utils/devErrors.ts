/**
 * Developer-friendly error handling utilities
 * Provides contextual error messages with component names, file paths, and code references
 */

import { logger } from "./logger";

export type ErrorContext = {
  componentName?: string;
  componentPath?: string;
  expression?: string;
  attributeName?: string;
  eventType?: string;
  elementTag?: string;
  lineHint?: string;
};

export class LadrillosError extends Error {
  public readonly componentName?: string;
  public readonly componentPath?: string;
  public readonly expression?: string;
  public readonly context?: ErrorContext;

  constructor(message: string, context?: ErrorContext) {
    super(message);
    this.name = "LadrillosError";
    this.componentName = context?.componentName;
    this.componentPath = context?.componentPath;
    this.expression = context?.expression;
    this.context = context;

    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LadrillosError);
    }
  }
}

/**
 * Formats an error message with component context for developers
 */
const formatErrorMessage = (
  message: string,
  context?: ErrorContext
): string => {
  const parts: string[] = [message];

  if (context) {
    if (context.componentName) {
      parts.push(`\n  Component: <${context.componentName}>`);
    }

    if (context.componentPath) {
      parts.push(`\n  File: ${context.componentPath}`);
    }

    if (context.expression) {
      parts.push(`\n  Expression: ${context.expression}`);
    }

    if (context.attributeName) {
      parts.push(`\n  Attribute: ${context.attributeName}`);
    }

    if (context.eventType) {
      parts.push(`\n  Event: ${context.eventType}`);
    }

    if (context.elementTag) {
      parts.push(`\n  Element: <${context.elementTag}>`);
    }

    if (context.lineHint) {
      parts.push(`\n  Location: ${context.lineHint}`);
    }
  }

  return parts.join("");
};

/**
 * Logs a binding error with component context
 */
export const logBindingError = (
  expression: string,
  error: Error,
  context?: ErrorContext
): void => {
  const errorMessage = formatErrorMessage(
    `⚠️ Binding Error: Failed to evaluate expression`,
    {
      ...context,
      expression,
      lineHint: context?.lineHint || "Template binding expression",
    }
  );

  logger.error(errorMessage);
  logger.error(`  Error details: ${error.message}`);

  // Log stack trace in development for debugging
  if (error.stack) {
    console.debug("  Stack trace:", error.stack);
  }
};

/**
 * Logs an event handler error with component context
 */
export const logEventHandlerError = (
  eventType: string,
  handlerCode: string,
  error: Error,
  context?: ErrorContext
): void => {
  const errorMessage = formatErrorMessage(
    `⚠️ Event Handler Error: Failed to execute handler`,
    {
      ...context,
      eventType,
      expression: handlerCode,
      lineHint: context?.lineHint || `on${eventType} handler`,
    }
  );

  logger.error(errorMessage);
  logger.error(`  Error details: ${error.message}`);

  if (error.stack) {
    console.debug("  Stack trace:", error.stack);
  }
};

/**
 * Logs a conditional rendering error with component context
 */
export const logConditionalError = (
  condition: string,
  error: Error,
  context?: ErrorContext
): void => {
  const errorMessage = formatErrorMessage(
    `⚠️ Conditional Error: Failed to evaluate condition`,
    {
      ...context,
      expression: condition,
      lineHint: context?.lineHint || "$if/$else-if condition",
    }
  );

  logger.error(errorMessage);
  logger.error(`  Error details: ${error.message}`);

  if (error.stack) {
    console.debug("  Stack trace:", error.stack);
  }
};

/**
 * Logs a loop rendering error with component context
 */
export const logLoopError = (
  loopExpression: string,
  error: Error,
  context?: ErrorContext
): void => {
  const errorMessage = formatErrorMessage(
    `⚠️ Loop Error: Failed to process loop`,
    {
      ...context,
      expression: loopExpression,
      lineHint: context?.lineHint || "$for loop expression",
    }
  );

  logger.error(errorMessage);
  logger.error(`  Error details: ${error.message}`);

  if (error.stack) {
    console.debug("  Stack trace:", error.stack);
  }
};

/**
 * Logs a component registration error
 */
export const logRegistrationError = (
  componentName: string,
  componentPath: string,
  error: Error
): void => {
  const errorMessage = formatErrorMessage(
    `⚠️ Registration Error: Failed to register component`,
    {
      componentName,
      componentPath,
    }
  );

  logger.error(errorMessage);
  logger.error(`  Error details: ${error.message}`);

  if (error.stack) {
    console.debug("  Stack trace:", error.stack);
  }
};

/**
 * Logs a fetch error with context
 */
export const logFetchError = (
  url: string,
  error: Error,
  context?: ErrorContext
): void => {
  const errorMessage = formatErrorMessage(
    `⚠️ Fetch Error: Failed to load resource`,
    {
      ...context,
      componentPath: url,
    }
  );

  logger.error(errorMessage);
  logger.error(`  Error details: ${error.message}`);
};

/**
 * Logs a parsing error with context
 */
export const logParseError = (
  message: string,
  context?: ErrorContext
): void => {
  const errorMessage = formatErrorMessage(
    `⚠️ Parse Error: ${message}`,
    context
  );

  logger.error(errorMessage);
};

/**
 * Logs a script execution error
 */
export const logScriptError = (error: Error, context?: ErrorContext): void => {
  const errorMessage = formatErrorMessage(
    `⚠️ Script Error: Failed to execute component script`,
    context
  );

  logger.error(errorMessage);
  logger.error(`  Error details: ${error.message}`);

  if (error.stack) {
    console.debug("  Stack trace:", error.stack);
  }
};

/**
 * Logs a two-way binding error
 */
export const logTwoWayBindingError = (
  expression: string,
  error: Error,
  context?: ErrorContext
): void => {
  const errorMessage = formatErrorMessage(
    `⚠️ Two-Way Binding Error: Failed to setup binding`,
    {
      ...context,
      expression,
      lineHint: context?.lineHint || "$model binding",
    }
  );

  logger.error(errorMessage);
  logger.error(`  Error details: ${error.message}`);
};

/**
 * Creates an error context from component metadata
 */
export const createErrorContext = (
  component: any,
  additionalContext?: Partial<ErrorContext>
): ErrorContext => {
  return {
    componentName: component?.tagName || component?.constructor?.name,
    componentPath: component?.sourcePath || component?._sourcePath,
    ...additionalContext,
  };
};
