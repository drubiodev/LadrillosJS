import { logger } from "../utils/logger.js";

/**
 * Creates a reactive object that triggers DOM updates when properties change
 * @param {Object} target - The object to make reactive
 * @param {Function} callback - Function to call when a property changes
 * @returns {Proxy} - A reactive proxy to the original object
 */
export function reactive(target, callback) {
  return new Proxy(target, {
    get(target, property) {
      return target[property];
    },

    set(target, property, value) {
      const oldValue = target[property];
      target[property] = value;

      // Only trigger callback if value actually changed
      if (oldValue !== value && callback) {
        callback(property.toString(), value, oldValue);
      }

      return true;
    },
  });
}

/**
 * Binds a reactive data model to a component
 * @param {HTMLElement} component - The web component instance
 * @param {Object} initialData - Initial data object
 * @returns {Object} - The reactive data model
 */
export function createComponentModel(component, initialData = {}) {
  const updateBinding = (prop, value) => {
    logger.log(`Updating binding for ${prop}:`, value);

    // Update attribute if it exists in observed attributes
    if (component.constructor.observedAttributes?.includes(prop)) {
      // Prevent infinite loops by checking if value is different
      if (component.getAttribute(prop) !== value?.toString()) {
        component.setAttribute(prop, value);
      }
    }

    // Call the special update method if component has one
    if (typeof component._updateBindings === "function") {
      component._updateBindings(prop, value);
    }
  };

  // Create reactive data model
  const model = reactive(initialData, updateBinding);

  // Process initial values
  for (const [key, value] of Object.entries(initialData)) {
    updateBinding(key, value);
  }

  return model;
}
