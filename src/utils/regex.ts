import { RegexPatterns } from "../types/LadrilloTypes";

export const REGEX_PATTERNS: RegexPatterns = {
  bindings: /{([^}]+)}/g,
  comments: {
    js: /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    css: /\/\*[\s\S]*?\*\//g,
    html: /<!--[\s\S]*?-->/g,
  },
};

/**
 * Strips single-line and multi-line comments from JavaScript code
 * while preserving string literals and template literals.
 * Also removes export statements since they can't be used in new Function().
 *
 * Handles:
 * - Single-quoted strings ('...')
 * - Double-quoted strings ("...")
 * - Template literals with backticks (backticks)
 * - Single-line comments (double slashes)
 * - Multi-line comments (slash-star pairs)
 * - Export statements (export const/let/function/class/default/...)
 * - Escaped characters within strings
 *
 * @param code - JavaScript code to strip comments from
 * @returns Code with comments and export statements removed, strings preserved
 */
export const stripComments = (code: string): string => {
  let result = "";
  let i = 0;

  while (i < code.length) {
    // Check for string literals
    const char = code[i];

    if (char === '"' || char === "'" || char === "`") {
      // Handle string literal - preserve it entirely
      const quote = char;
      result += char;
      i++;

      while (i < code.length) {
        const c = code[i];

        if (c === "\\") {
          // Escaped character - preserve both the backslash and next char
          result += c + code[i + 1];
          i += 2;
        } else if (c === quote) {
          // End of string
          result += c;
          i++;
          break;
        } else {
          result += c;
          i++;
        }
      }
    } else if (char === "/" && i + 1 < code.length) {
      // Check for comments
      const nextChar = code[i + 1];

      if (nextChar === "/") {
        // Single-line comment - skip until end of line or end of code
        while (i < code.length && code[i] !== "\n") {
          i++;
        }
        // Preserve the newline if present (maintains line structure)
        if (i < code.length && code[i] === "\n") {
          result += "\n";
          i++;
        }
      } else if (nextChar === "*") {
        // Multi-line comment - skip until */ is found
        i += 2; // Skip the /*
        while (i + 1 < code.length) {
          if (code[i] === "*" && code[i + 1] === "/") {
            i += 2;
            break;
          }
          // Preserve structure by keeping newlines
          if (code[i] === "\n") {
            result += "\n";
          }
          i++;
        }
      } else {
        // Regular slash, not a comment
        result += char;
        i++;
      }
    } else if (/\s/.test(char)) {
      // Check for export keyword at the start of a line
      // Look ahead to see if this is the start of an export statement
      const beforeWord = result.trimEnd();
      const isLineStart =
        beforeWord === "" ||
        beforeWord.endsWith("\n") ||
        beforeWord.endsWith(";") ||
        beforeWord.endsWith("}");

      if (isLineStart && code.substring(i).match(/^\s*export\s+/)) {
        // Skip the whitespace and 'export' keyword
        i = i + code.substring(i).match(/^\s*export\s+/)![0].length;
        continue;
      }

      result += char;
      i++;
    } else {
      result += char;
      i++;
    }
  }

  return result;
};
