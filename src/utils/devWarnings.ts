/**
 * Developer-friendly warning and error utilities for LadrillosJS.
 *
 * - Consistent prefix for easy filtering
 * - Component name and file context
 * - Code frame generation for templates
 * - Console styling for better readability
 * - Error codes with documentation links
 *
 * Bundle size optimization:
 * The global `__DEV__` constant is replaced at build time by the bundler.
 * All dev-only code wrapped in `if (__DEV__)` is completely eliminated
 * from production builds via dead code elimination.
 */

// Ensure __DEV__ is recognized by TypeScript
// This is a compile-time constant defined by the bundler
declare const __DEV__: boolean;

// ============================================================================
// Configuration
// ============================================================================

const PREFIX = "[LadrillosJS]";
const DOCS_BASE_URL = "https://ladrillosjs.dev/errors";

// ============================================================================
// Console Styling
// ============================================================================

/**
 * CSS styles for console output (browser only)
 *
 * Color scheme optimized for readability:
 * - Orange prefix (brand identity)
 * - White/bright error text (high contrast)
 * - Cyan for component names (distinct, cool color)
 * - Green for file paths (easy to spot)
 * - Dim gray for less important info
 */
const styles = {
  prefix: "color: #ff6b35; font-weight: bold", // LadrillosJS orange, bold
  component: "color: #4fc3f7; font-weight: bold", // Light cyan, bold
  file: "color: #81c784", // Light green
  expression: "color: #fff176; font-weight: bold", // Yellow, bold (stands out)
  error: "color: #ffffff; font-weight: bold", // White, bold (high contrast)
  reset: "color: inherit; font-weight: normal",
  dim: "color: #9e9e9e", // Lighter gray for better visibility
};

/**
 * Check if we're in a browser environment with styled console support
 */
const supportsStyledConsole = (): boolean => {
  return (
    typeof window !== "undefined" &&
    typeof console !== "undefined" &&
    typeof console.log === "function"
  );
};

// ============================================================================
// Component Context Tracking
// ============================================================================

/**
 * Context information about the current component being processed.
 * This is set by the framework during component initialization.
 */
export interface ComponentContext {
  /** The component tag name (e.g., "my-counter") */
  tagName?: string;
  /** The source file path (e.g., "components/counter.html") */
  sourcePath?: string;
  /** The unique instance ID */
  instanceId?: string;
}

/**
 * Current component context - set during component processing
 */
let currentContext: ComponentContext | null = null;

/**
 * Set the current component context for error reporting.
 * Call this at the start of component initialization.
 */
export function setComponentContext(context: ComponentContext | null): void {
  currentContext = context;
}

/**
 * Get the current component context.
 */
export function getComponentContext(): ComponentContext | null {
  return currentContext;
}

/**
 * Run a function with a specific component context.
 * Automatically restores previous context after execution.
 */
export function withComponentContext<T>(
  context: ComponentContext,
  fn: () => T
): T {
  const previousContext = currentContext;
  currentContext = context;
  try {
    return fn();
  } finally {
    currentContext = previousContext;
  }
}

/**
 * Async version of withComponentContext
 */
export async function withComponentContextAsync<T>(
  context: ComponentContext,
  fn: () => Promise<T>
): Promise<T> {
  const previousContext = currentContext;
  currentContext = context;
  try {
    return await fn();
  } finally {
    currentContext = previousContext;
  }
}

// ============================================================================
// Code Frame Generation
// ============================================================================

/**
 * Generate a code frame showing the error location in source code.
 *
 * @param source - The source code
 * @param start - Start position of the error
 * @param end - End position of the error
 * @returns Formatted code frame string
 */
export function generateCodeFrame(
  source: string,
  start: number = 0,
  end: number = source.length
): string {
  const lines = source.split("\n");
  let count = 0;
  const res: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1; // +1 for newline
    const lineNumber = i + 1;

    if (count + lineLength >= start) {
      // Show 2 lines before and after
      for (
        let j = Math.max(0, i - 2);
        j <= Math.min(lines.length - 1, i + 2);
        j++
      ) {
        const ln = j + 1;
        const lineContent = lines[j];
        const linePrefix = `${ln}`.padStart(4) + " │ ";

        res.push(`${linePrefix}${lineContent}`);

        // Add underline for the error line
        if (j === i) {
          const pad = start - (count - lineLength);
          const length = Math.min(
            end > count ? end - start : lineLength - pad,
            lineContent.length - pad
          );
          res.push(
            `     │ ${"".padStart(Math.max(0, pad))}${"^".repeat(
              Math.max(1, length)
            )}`
          );
        }
      }
      break;
    }
    count += lineLength;
  }

  return res.join("\n");
}

/**
 * Find the position of an expression in template source.
 */
export function findExpressionPosition(
  template: string,
  expression: string
): { start: number; end: number } | null {
  // Look for {expression} pattern
  const searchPattern = `{${expression}}`;
  const index = template.indexOf(searchPattern);

  if (index !== -1) {
    return {
      start: index,
      end: index + searchPattern.length,
    };
  }

  // Also try without braces for attribute values
  const exprIndex = template.indexOf(expression);
  if (exprIndex !== -1) {
    return {
      start: exprIndex,
      end: exprIndex + expression.length,
    };
  }

  return null;
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format component info for error messages.
 * If context is explicitly passed (even null), uses that.
 * Only falls back to currentContext if context is undefined.
 */
function formatComponentInfo(context?: ComponentContext | null): string {
  const ctx = context !== undefined ? context : currentContext;
  if (!ctx) return "";

  const parts: string[] = [];

  if (ctx.tagName) {
    parts.push(`<${ctx.tagName}>`);
  }

  if (ctx.sourcePath) {
    // Extract just the filename for brevity
    const fileName = ctx.sourcePath.split("/").pop() || ctx.sourcePath;
    parts.push(`(${fileName})`);
  }

  return parts.length > 0 ? ` in ${parts.join(" ")}` : "";
}

/**
 * Format error message with context
 */
function formatMessage(
  message: string,
  context?: ComponentContext | null
): string {
  const componentInfo = formatComponentInfo(context);
  return `${message}${componentInfo}`;
}

// ============================================================================
// Warning & Error Functions
// ============================================================================

/**
 * Error codes for documentation linking
 */
export enum ErrorCode {
  // Expression evaluation errors (1xx)
  EXPRESSION_EVAL_FAILED = 101,
  EXPRESSION_SYNTAX_ERROR = 102,
  EXPRESSION_UNDEFINED_VAR = 103,
  EXPRESSION_NULL_ACCESS = 104,

  // Script errors (2xx)
  SCRIPT_EXTRACT_FAILED = 201,
  SCRIPT_EXECUTION_FAILED = 202,

  // Event handler errors (3xx)
  EVENT_HANDLER_FAILED = 301,

  // Directive errors (4xx)
  DIRECTIVE_ERROR = 401,
  LOOP_ERROR = 402,
  CONDITIONAL_ERROR = 403,

  // Component errors (5xx)
  COMPONENT_LOAD_FAILED = 501,
  COMPONENT_NOT_FOUND = 502,

  // Module errors (6xx)
  MODULE_LOAD_FAILED = 601,
  MODULE_EXECUTION_FAILED = 602,
}

/**
 * Get documentation URL for an error code
 */
export function getErrorDocsUrl(code: ErrorCode): string {
  return `${DOCS_BASE_URL}/${code}`;
}

/**
 * Log a styled warning message (dev mode only).
 * Includes component context if available.
 */
export function warn(message: string, context?: ComponentContext | null): void {
  if (!__DEV__) return;

  const fullMessage = formatMessage(message, context);

  if (supportsStyledConsole()) {
    console.warn(`%c${PREFIX}%c ${fullMessage}`, styles.prefix, styles.reset);
  } else {
    console.warn(`${PREFIX} ${fullMessage}`);
  }
}

/**
 * Log a styled error message.
 * Errors are always logged, even in production.
 */
export function error(
  message: string,
  context?: ComponentContext | null
): void {
  const fullMessage = formatMessage(message, context);

  if (supportsStyledConsole()) {
    console.error(`%c${PREFIX}%c ${fullMessage}`, styles.prefix, styles.reset);
  } else {
    console.error(`${PREFIX} ${fullMessage}`);
  }
}

/**
 * Log an expression evaluation error with detailed context.
 *
 * This is the main function for reporting binding/expression errors.
 * It shows:
 * - The expression that failed
 * - The component where it occurred
 * - The actual JavaScript error
 * - A code frame if template source is available
 */
export function expressionError(
  expression: string,
  originalError: Error,
  options: {
    context?: ComponentContext | null;
    template?: string;
    errorCode?: ErrorCode;
  } = {}
): void {
  const ctx = options.context || currentContext;
  const code = options.errorCode || inferErrorCode(originalError);

  // Determine error type for better messaging
  const errorType = getErrorType(originalError);

  if (!__DEV__) {
    // Production: minimal output with docs link
    console.error(`${PREFIX} Expression error. See: ${getErrorDocsUrl(code)}`);
    return;
  }

  // Build the error message
  const componentInfo = formatComponentInfo(ctx);

  if (supportsStyledConsole()) {
    // Styled browser output
    console.groupCollapsed(
      `%c${PREFIX}%c ${errorType}%c${componentInfo}`,
      styles.prefix,
      styles.error,
      styles.dim
    );

    console.log(`%cExpression:%c ${expression}`, styles.dim, styles.expression);

    if (ctx?.tagName) {
      console.log(
        `%cComponent:%c <${ctx.tagName}>`,
        styles.dim,
        styles.component
      );
    }

    if (ctx?.sourcePath) {
      console.log(`%cFile:%c ${ctx.sourcePath}`, styles.dim, styles.file);
    }

    // Show code frame if template is available
    if (options.template) {
      const position = findExpressionPosition(options.template, expression);
      if (position) {
        console.log(`%cLocation in template:%c`, styles.dim, styles.reset);
        console.log(
          generateCodeFrame(options.template, position.start, position.end)
        );
      }
    }

    console.log(
      `%cError:%c ${originalError.message}`,
      styles.dim,
      styles.reset
    );
    console.log(`%cDocs:%c ${getErrorDocsUrl(code)}`, styles.dim, styles.file);

    console.groupEnd();
  } else {
    // Plain text output (Node.js or unstyled console)
    const lines = [
      `${PREFIX} ${errorType}${componentInfo}`,
      `  Expression: ${expression}`,
    ];

    if (ctx?.tagName) {
      lines.push(`  Component: <${ctx.tagName}>`);
    }

    if (ctx?.sourcePath) {
      lines.push(`  File: ${ctx.sourcePath}`);
    }

    if (options.template) {
      const position = findExpressionPosition(options.template, expression);
      if (position) {
        lines.push(`  Location:`);
        lines.push(
          generateCodeFrame(options.template, position.start, position.end)
            .split("\n")
            .map((l) => `    ${l}`)
            .join("\n")
        );
      }
    }

    lines.push(`  Error: ${originalError.message}`);
    lines.push(`  Docs: ${getErrorDocsUrl(code)}`);

    console.error(lines.join("\n"));
  }
}

/**
 * Log a script extraction error with context.
 */
export function scriptError(
  message: string,
  originalError: Error,
  context?: ComponentContext | null
): void {
  const ctx = context || currentContext;

  if (!__DEV__) {
    console.error(
      `${PREFIX} Script error. See: ${getErrorDocsUrl(
        ErrorCode.SCRIPT_EXTRACT_FAILED
      )}`
    );
    return;
  }

  const componentInfo = formatComponentInfo(ctx);

  if (supportsStyledConsole()) {
    console.group(
      `%c${PREFIX}%c Script Error%c${componentInfo}`,
      styles.prefix,
      styles.error,
      styles.dim
    );

    console.log(`%cMessage:%c ${message}`, styles.dim, styles.reset);

    if (ctx?.tagName) {
      console.log(
        `%cComponent:%c <${ctx.tagName}>`,
        styles.dim,
        styles.component
      );
    }

    if (ctx?.sourcePath) {
      console.log(`%cFile:%c ${ctx.sourcePath}`, styles.dim, styles.file);
    }

    console.log(`%cError:%c`, styles.dim, styles.reset, originalError);

    console.groupEnd();
  } else {
    const lines = [
      `${PREFIX} Script Error${componentInfo}`,
      `  Message: ${message}`,
    ];

    if (ctx?.tagName) {
      lines.push(`  Component: <${ctx.tagName}>`);
    }

    if (ctx?.sourcePath) {
      lines.push(`  File: ${ctx.sourcePath}`);
    }

    lines.push(`  Error: ${originalError.message}`);

    console.error(lines.join("\n"));
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Infer error code from the error type
 */
function inferErrorCode(err: Error): ErrorCode {
  if (err instanceof SyntaxError) {
    return ErrorCode.EXPRESSION_SYNTAX_ERROR;
  }

  if (err instanceof ReferenceError) {
    return ErrorCode.EXPRESSION_UNDEFINED_VAR;
  }

  if (err instanceof TypeError) {
    // Check if it's a null/undefined property access
    if (
      err.message.includes("Cannot read properties of null") ||
      err.message.includes("Cannot read properties of undefined")
    ) {
      return ErrorCode.EXPRESSION_NULL_ACCESS;
    }
  }

  return ErrorCode.EXPRESSION_EVAL_FAILED;
}

/**
 * Get a human-readable error type description
 */
function getErrorType(err: Error): string {
  if (err instanceof SyntaxError) {
    return "Invalid expression syntax";
  }

  if (err instanceof ReferenceError) {
    // Extract the undefined variable name if possible
    const match = err.message.match(/(\w+) is not defined/);
    if (match) {
      return `Undefined variable: "${match[1]}"`;
    }
    return "Undefined variable";
  }

  if (err instanceof TypeError) {
    if (err.message.includes("Cannot read properties of null")) {
      return "Cannot access property of null";
    }
    if (err.message.includes("Cannot read properties of undefined")) {
      return "Cannot access property of undefined";
    }
    return "Type error";
  }

  return "Expression evaluation failed";
}

/**
 * Create a formatted error for throwing with component context.
 */
export function createError(
  message: string,
  code: ErrorCode,
  context?: ComponentContext | null
): Error {
  const ctx = context || currentContext;
  const fullMessage = formatMessage(message, ctx);

  const error = new Error(fullMessage);
  error.name = "LadrillosError";

  // Attach metadata for error handling
  (error as any).code = code;
  (error as any).docsUrl = getErrorDocsUrl(code);
  (error as any).componentContext = ctx;

  return error;
}

// ============================================================================
// Deprecation Warnings
// ============================================================================

const deprecationWarnings = new Set<string>();

/**
 * Log a deprecation warning (only once per feature).
 */
export function deprecate(
  feature: string,
  replacement?: string,
  version?: string
): void {
  if (!__DEV__) return;

  // Only warn once per feature
  if (deprecationWarnings.has(feature)) return;
  deprecationWarnings.add(feature);

  let message = `"${feature}" is deprecated`;

  if (version) {
    message += ` and will be removed in version ${version}`;
  }

  if (replacement) {
    message += `. Use "${replacement}" instead`;
  }

  message += ".";

  if (supportsStyledConsole()) {
    console.warn(
      `%c${PREFIX}%c ⚠️ Deprecation: ${message}`,
      styles.prefix,
      "color: #ff9800"
    );
  } else {
    console.warn(`${PREFIX} ⚠️ Deprecation: ${message}`);
  }
}
