/**
 * LadrillosJS Directives
 *
 * Directives are special attributes that provide reactive behavior to elements.
 * Unlike interpolation which uses curly braces {value}, directives receive raw expressions.
 *
 * Syntax Pattern:
 *   - Directives: $directive="expression"
 *   - Interpolation: {expression}
 */

/**
 * $for - Loop Directive
 *
 * Repeats an element for each item in an iterable.
 *
 * Syntax:
 *   $for="item in items"
 *   $for="item of items"
 *   $for="(item, index) in items"
 *   $for="(value, key, index) in object"
 *
 * Examples:
 *   <li $for="item in items">{item.name}</li>
 *   <li $for="(item, index) in items">{index}: {item.name}</li>
 *   <option $for="(value, key) in options" value="{key}">{value}</option>
 *
 * Destructuring:
 *   <div $for="{ id, name } in users">{id}: {name}</div>
 *   <div $for="[first, second] in pairs">{first} - {second}</div>
 */
export const FOR_DIRECTIVE = "$for";

/**
 * $if - Conditional Directive
 *
 * Conditionally renders an element based on a truthy expression.
 *
 * Syntax:
 *   $if="condition"
 *
 * Examples:
 *   <div $if="isVisible">Visible content</div>
 *   <div $if="user.isAdmin">Admin panel</div>
 *   <div $if="items.length > 0">Has items</div>
 */
export const IF_DIRECTIVE = "$if";

/**
 * $else - Else Directive
 *
 * Renders when the preceding $if condition is falsy.
 * Must immediately follow an element with $if.
 *
 * Syntax:
 *   $else
 *
 * Examples:
 *   <div $if="isLoggedIn">Welcome back!</div>
 *   <div $else>Please log in</div>
 */
export const ELSE_DIRECTIVE = "$else";

/**
 * $else-if - Else If Directive
 *
 * Conditional fallback when preceding $if is falsy.
 * Must immediately follow an element with $if or $else-if.
 *
 * Syntax:
 *   $else-if="condition"
 *
 * Examples:
 *   <div $if="status === 'loading'">Loading...</div>
 *   <div $else-if="status === 'error'">Error occurred</div>
 *   <div $else>Content loaded</div>
 */
export const ELSE_IF_DIRECTIVE = "$else-if";

/**
 * $show - Show/Hide Directive
 *
 * Toggles element visibility using CSS display property.
 * Unlike $if, the element remains in the DOM.
 *
 * Syntax:
 *   $show="condition"
 *
 * Examples:
 *   <div $show="isExpanded">Expandable content</div>
 *   <span $show="hasNotifications">🔔</span>
 */
export const SHOW_DIRECTIVE = "$show";

/**
 * $bind - Two-way Binding Directive
 *
 * Creates a two-way binding between an input and a reactive value.
 *
 * Syntax:
 *   $bind="variableName"
 *
 * Examples:
 *   <input type="text" $bind="username">
 *   <textarea $bind="message"></textarea>
 *   <select $bind="selectedOption">...</select>
 */
export const BIND_DIRECTIVE = "$bind";

/**
 * Ensures a $bind element's value is synced to state before a user event
 * handler for the same event runs.
 *
 * Inline handlers (onchange, oninput, $on:) are registered before $bind's
 * own listener, so without this the handler would read the previous value
 * from state. setupTwoWayBinding stores the sync function on the element;
 * handler wrappers call this first so user code always sees fresh state.
 */
export function syncBindBeforeHandler(event: Event): void
{
  const bindSync = (event.currentTarget as any)?.__ladrillosBindSync;
  if (bindSync && bindSync.eventType === event.type)
  {
    bindSync.sync();
  }
}

/**
 * $ref - Reference Directive
 *
 * Creates a reference to the DOM element.
 *
 * Syntax:
 *   $ref="referenceName"
 *
 * Examples:
 *   <input $ref="inputElement">
 *   <canvas $ref="canvasRef"></canvas>
 */
export const REF_DIRECTIVE = "$ref";

// Directive parsing patterns
export const DIRECTIVE_PATTERNS = {
  /**
   * Matches for/of loop expressions:
   * - "item in items"
   * - "(item, index) in items"
   * - "{ id, name } of users"
   */
  forAlias: /([\s\S]*?)\s+(?:in|of)\s+([\s\S]+)$/,

  /**
   * Matches iterator with optional key/index:
   * - "item" -> [item]
   * - "item, index" -> [item, index]
   * - "value, key, index" -> [value, key, index]
   */
  forIterator: /,([^,\}\]]*)(?:,([^,\}\]]*))?$/,

  /**
   * Strips parentheses from iterator expression:
   * "(item, index)" -> "item, index"
   */
  stripParens: /^\(|\)$/g,
} as const;

// List of all supported directives
export const SUPPORTED_DIRECTIVES = [
  FOR_DIRECTIVE,
  IF_DIRECTIVE,
  ELSE_DIRECTIVE,
  ELSE_IF_DIRECTIVE,
  SHOW_DIRECTIVE,
  BIND_DIRECTIVE,
  REF_DIRECTIVE,
] as const;

export type DirectiveName = (typeof SUPPORTED_DIRECTIVES)[number];

/**
 * Escapes a directive name for use in CSS selectors.
 * The $ character is not valid in CSS selectors and must be escaped.
 *
 * Example: "$for" -> "\\$for"
 */
export function escapeCssSelector(directive: string): string {
  return directive.replace(/\$/g, "\\$");
}

/**
 * Check if an attribute name is a directive
 */
export function isDirective(attrName: string): boolean {
  return (
    attrName.startsWith("$") ||
    SUPPORTED_DIRECTIVES.includes(attrName as DirectiveName)
  );
}
