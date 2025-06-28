import { StringifyFunction } from "../types/LadrilloTypes";

/**
 * Converts an object to a JSON string safe for HTML attributes
 * Handles newlines, carriage returns, and escapes quotes for HTML
 * @param obj - The object to stringify
 * @param space - Spacing for pretty printing (optional)
 * @returns HTML-safe JSON string
 */
export const stringify: StringifyFunction = (
  obj: unknown,
  space?: string | number
): string => {
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === "string") {
        return value
          .replace(/\n/g, "\\n") // Escape newlines
          .replace(/\r/g, "\\r") // Escape carriage returns
          .replace(/\t/g, "\\t"); // Escape tabs for completeness
      }
      return value;
    },
    space
  ).replace(/"/g, "&quot;"); // Escape quotes for HTML attributes
};
