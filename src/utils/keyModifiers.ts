/**
 * LadrillosJS Key Modifiers
 *
 * Provides Vue/Alpine-style key modifiers for event handling.
 * Supports keyboard keys, mouse modifiers, and event behavior modifiers.
 *
 * Syntax: $on:event.modifier1.modifier2="handler()"
 *
 * Examples:
 *   $on:keyup.enter="submit()"
 *   $on:keydown.escape="closeModal()"
 *   $on:click.ctrl="selectMultiple()"
 *   $on:keydown.ctrl.s="save()"
 *   $on:submit.prevent="handleSubmit()"
 *   $on:click.stop="handleClick()"
 */

// ============================================================================
// Key Aliases
// ============================================================================

/**
 * Common key aliases for better DX.
 * Maps short names to KeyboardEvent.key values.
 */
export const KEY_ALIASES: Record<string, string> = {
  // Navigation
  enter: "Enter",
  tab: "Tab",
  esc: "Escape",
  escape: "Escape",
  space: " ",

  // Arrow keys
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",

  // Editing
  delete: "Delete",
  backspace: "Backspace",
  insert: "Insert",

  // Function keys
  f1: "F1",
  f2: "F2",
  f3: "F3",
  f4: "F4",
  f5: "F5",
  f6: "F6",
  f7: "F7",
  f8: "F8",
  f9: "F9",
  f10: "F10",
  f11: "F11",
  f12: "F12",

  // Other common keys
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
};

// ============================================================================
// System Modifier Keys
// ============================================================================

/**
 * System modifier keys that check event properties.
 */
export const SYSTEM_MODIFIERS = ["ctrl", "alt", "shift", "meta"] as const;

export type SystemModifier = (typeof SYSTEM_MODIFIERS)[number];

/**
 * Maps modifier names to event property names.
 */
export const MODIFIER_PROPERTIES: Record<
  SystemModifier,
  keyof KeyboardEvent | keyof MouseEvent
> = {
  ctrl: "ctrlKey",
  alt: "altKey",
  shift: "shiftKey",
  meta: "metaKey",
};

// ============================================================================
// Event Modifiers
// ============================================================================

/**
 * Event behavior modifiers.
 */
export const EVENT_MODIFIERS = [
  "prevent", // event.preventDefault()
  "stop", // event.stopPropagation()
  "self", // Only trigger if event.target === event.currentTarget
  "once", // Remove listener after first invocation
  "passive", // Passive event listener
  "capture", // Use capture phase
] as const;

export type EventModifier = (typeof EVENT_MODIFIERS)[number];

// ============================================================================
// Mouse Button Modifiers
// ============================================================================

/**
 * Mouse button modifiers for click events.
 */
export const MOUSE_MODIFIERS = {
  left: 0,
  middle: 1,
  right: 2,
} as const;

export type MouseModifier = keyof typeof MOUSE_MODIFIERS;

// ============================================================================
// Types
// ============================================================================

export interface ParsedEventDirective {
  /** The base event name (e.g., "keyup", "click") */
  eventName: string;
  /** Key modifiers (e.g., ["enter", "shift"]) */
  keyModifiers: string[];
  /** System modifiers (e.g., ["ctrl", "alt"]) */
  systemModifiers: SystemModifier[];
  /** Event behavior modifiers (e.g., ["prevent", "stop"]) */
  eventModifiers: EventModifier[];
  /** Mouse button modifier (e.g., "left") */
  mouseModifier: MouseModifier | null;
  /** Whether to use exact modifier matching */
  exact: boolean;
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parses a $on: directive attribute into its components.
 *
 * Examples:
 *   "$on:keyup.enter" → { eventName: "keyup", keyModifiers: ["enter"], ... }
 *   "$on:click.ctrl.prevent" → { eventName: "click", systemModifiers: ["ctrl"], eventModifiers: ["prevent"], ... }
 */
export function parseEventDirective(
  attrName: string
): ParsedEventDirective | null {
  // Must start with $on:
  if (!attrName.startsWith("$on:")) {
    return null;
  }

  // Remove the $on: prefix and split by dots
  const rest = attrName.slice(4); // Remove "$on:"
  const parts = rest.split(".");

  if (parts.length === 0 || !parts[0]) {
    return null;
  }

  const eventName = parts[0];
  const modifiers = parts.slice(1);

  const result: ParsedEventDirective = {
    eventName,
    keyModifiers: [],
    systemModifiers: [],
    eventModifiers: [],
    mouseModifier: null,
    exact: false,
  };

  for (const mod of modifiers) {
    const lowerMod = mod.toLowerCase();

    // Check for exact modifier
    if (lowerMod === "exact") {
      result.exact = true;
      continue;
    }

    // Check for event modifiers (prevent, stop, etc.)
    if (EVENT_MODIFIERS.includes(lowerMod as EventModifier)) {
      result.eventModifiers.push(lowerMod as EventModifier);
      continue;
    }

    // Check for system modifiers (ctrl, alt, shift, meta)
    if (SYSTEM_MODIFIERS.includes(lowerMod as SystemModifier)) {
      result.systemModifiers.push(lowerMod as SystemModifier);
      continue;
    }

    // Check for mouse modifiers (left, middle, right)
    if (lowerMod in MOUSE_MODIFIERS) {
      result.mouseModifier = lowerMod as MouseModifier;
      continue;
    }

    // Otherwise, it's a key modifier
    result.keyModifiers.push(lowerMod);
  }

  return result;
}

/**
 * Checks if a KeyboardEvent matches the specified key modifier.
 *
 * @param event The keyboard event
 * @param keyModifier The key modifier to check (e.g., "enter", "a", "escape")
 * @returns True if the key matches
 */
export function matchesKey(event: KeyboardEvent, keyModifier: string): boolean {
  const lowerMod = keyModifier.toLowerCase();

  // Check aliases first
  const aliasedKey = KEY_ALIASES[lowerMod];
  if (aliasedKey) {
    return event.key === aliasedKey;
  }

  // For single characters (a-z, 0-9), compare case-insensitively
  if (lowerMod.length === 1) {
    return event.key.toLowerCase() === lowerMod;
  }

  // For other keys, try to match by converting kebab-case to the key name
  // e.g., "page-down" → "PageDown"
  const camelCaseKey = lowerMod
    .split("-")
    .map((part, i) =>
      i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("");

  // Try both the original key and the camelCase version
  return (
    event.key.toLowerCase() === lowerMod ||
    event.key.toLowerCase() === camelCaseKey.toLowerCase()
  );
}

/**
 * Checks if a keyboard/mouse event matches all system modifiers.
 *
 * @param event The event to check
 * @param modifiers The system modifiers required
 * @param exact If true, no other modifiers should be pressed
 * @returns True if all required modifiers are pressed (and only those if exact)
 */
export function matchesSystemModifiers(
  event: KeyboardEvent | MouseEvent,
  modifiers: SystemModifier[],
  exact: boolean
): boolean {
  const modifierState = {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };

  // Check that all required modifiers are pressed
  for (const mod of modifiers) {
    if (!modifierState[mod]) {
      return false;
    }
  }

  // If exact mode, ensure no extra modifiers are pressed
  if (exact) {
    for (const mod of SYSTEM_MODIFIERS) {
      if (!modifiers.includes(mod) && modifierState[mod]) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Checks if a MouseEvent matches the specified mouse button.
 *
 * @param event The mouse event
 * @param mouseModifier The mouse button modifier
 * @returns True if the button matches
 */
export function matchesMouseButton(
  event: MouseEvent,
  mouseModifier: MouseModifier
): boolean {
  return event.button === MOUSE_MODIFIERS[mouseModifier];
}

/**
 * Creates an event listener options object from event modifiers.
 */
export function getListenerOptions(
  modifiers: EventModifier[]
): AddEventListenerOptions {
  const options: AddEventListenerOptions = {};

  if (modifiers.includes("passive")) {
    options.passive = true;
  }
  if (modifiers.includes("capture")) {
    options.capture = true;
  }
  if (modifiers.includes("once")) {
    options.once = true;
  }

  return options;
}

/**
 * Creates a wrapped event handler that applies all modifiers.
 *
 * @param originalHandler The original event handler function
 * @param parsed The parsed event directive
 * @returns A wrapped handler that checks modifiers before calling the original
 */
export function createModifiedHandler(
  originalHandler: (event: Event) => void,
  parsed: ParsedEventDirective
): (event: Event) => void {
  return function modifiedHandler(event: Event) {
    // Check "self" modifier - event must originate from the element itself
    if (parsed.eventModifiers.includes("self")) {
      if (event.target !== event.currentTarget) {
        return;
      }
    }

    // Check mouse button modifier
    if (parsed.mouseModifier && event instanceof MouseEvent) {
      if (!matchesMouseButton(event, parsed.mouseModifier)) {
        return;
      }
    }

    // Check system modifiers (ctrl, alt, shift, meta)
    if (parsed.systemModifiers.length > 0 || parsed.exact) {
      if (event instanceof KeyboardEvent || event instanceof MouseEvent) {
        if (
          !matchesSystemModifiers(event, parsed.systemModifiers, parsed.exact)
        ) {
          return;
        }
      }
    }

    // Check key modifiers for keyboard events
    if (parsed.keyModifiers.length > 0 && event instanceof KeyboardEvent) {
      const matchesAnyKey = parsed.keyModifiers.some((key) =>
        matchesKey(event, key)
      );
      if (!matchesAnyKey) {
        return;
      }
    }

    // Apply "prevent" modifier
    if (parsed.eventModifiers.includes("prevent")) {
      event.preventDefault();
    }

    // Apply "stop" modifier
    if (parsed.eventModifiers.includes("stop")) {
      event.stopPropagation();
    }

    // Call the original handler
    originalHandler(event);
  };
}

/**
 * Checks if an attribute is a $on: event directive.
 */
export function isEventDirective(attrName: string): boolean {
  return attrName.startsWith("$on:");
}
