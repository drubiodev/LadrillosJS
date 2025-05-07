/**
 * Safely stringifies an object, escaping double quotes and special characters for HTML attributes.
 * @param {any} obj - The object to stringify.
 * @param {number|string} [space] - Indentation for pretty-printing.
 * @returns {string} - The safely stringified JSON string, escaped for HTML attributes.
 */
export function stringify(obj, space) {
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === "string") {
        return value
          .replace(/"/g, '\\"') // Escape double quotes for JSON
          .replace(/\n/g, "\\n") // Escape newlines
          .replace(/\r/g, "\\r"); // Escape carriage returns
      }
      return value;
    },
    space
  ).replace(/"/g, "&quot;"); // Escape double quotes for HTML attributes
}
