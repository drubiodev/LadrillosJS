/**
 * LadrillosJS Directive Processor
 *
 * Handles all template directives:
 * - $for: Loop rendering
 * - $if/$else-if/$else: Conditional rendering
 * - $show: CSS visibility toggle
 * - $bind: Two-way data binding
 * - $ref: Element references
 */

import
{
  ConditionalDescriptor,
  LoopDescriptor,
  TwoWayBindingDescriptor,
} from "../../types";
import
{
  BIND_DIRECTIVE,
  REF_DIRECTIVE,
  DIRECTIVE_PATTERNS,
  escapeCssSelector,
  syncBindBeforeHandler,
} from "../../utils/directives";
import { scanLazyElements, getPendingLazyContent } from "../builtins/lazyElement";
import { isLoopDelegationEnabled } from "../configure";

// ============================================================================
// Built-in element tag names (uppercase = DOM tagName form)
// ============================================================================

const FOR_TAG = "FOR";
const IF_TAG = "IF";
const ELSE_IF_TAG = "ELSE-IF";
const ELSE_TAG = "ELSE";
const SHOW_TAG = "SHOW";
import { EVENT_ATTRIBUTE_SET } from "../../utils/jsevents";
import
{
  isEventDirective,
  parseEventDirective,
  createModifiedHandler,
  getListenerOptions,
} from "../../utils/keyModifiers";
import
{
  extractFunctionDefinitions,
  extractVariableNames,
} from "../js/scriptParser";
import { createEventBusHelpers } from "../events/eventBus";
import { compileHandler } from "../js/compiler";
import
{
  createKeyGetter,
  getStableIndices,
} from "../diff/listDiff";
import type { BoundEvaluator, DirectiveEvaluator } from "../js/scriptParser";
import { warn, error } from "../../utils/devWarnings";

// ============================================================================
// Types
// ============================================================================

export type RefMap = Map<string, HTMLElement>;

export type DirectiveContext = {
  loops: LoopDescriptor[];
  conditionals: ConditionalDescriptor[][];
  twoWayBindings: TwoWayBindingDescriptor[];
  refs: RefMap;
  showElements: ShowDescriptor[];
};

/**
 * Registry for two-way bindings.
 * Maps state keys to the elements bound to them.
 */
export type TwoWayBindingRegistry = Map<
  string,
  Array<{
    element: HTMLElement;
    path: string[];
    isContentEditable?: boolean;
  }>
>;

export type ShowDescriptor = {
  element: HTMLElement;
  expression: string;
  originalDisplay: string;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Strips curly braces from a binding expression.
 * e.g., "{!isLoggedIn}" -> "!isLoggedIn"
 *       "isLoggedIn" -> "isLoggedIn" (no change if no braces)
 */
function stripBindingBraces(expression: string): string
{
  const trimmed = expression.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}"))
  {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

// ============================================================================
// Main Directive Scanner
// ============================================================================

/**
 * Scans the template for all directives and returns descriptors for each.
 * This should be called after the template HTML is injected into the DOM.
 */
export function scanDirectives(
  host: HTMLElement | ShadowRoot,
): DirectiveContext
{
  const context: DirectiveContext = {
    loops: [],
    conditionals: [],
    twoWayBindings: [],
    refs: new Map(),
    showElements: [],
  };

  // <lazy> is preprocessed in `loadTemplate` so its children sit in a detached
  // DocumentFragment (no premature connectedCallback for inner custom
  // elements). Each pending fragment is reachable via the sentinel left
  // behind in `host`. We run every directive scanner on `host` AND on each
  // pending lazy fragment so refs, $for, $if, $show, $bind, etc. work
  // exactly the same inside `<lazy>` as outside. Wiring is preserved when
  // reveal moves the fragment's nodes into the host tree.
  //
  // Order matters per root:
  //   1. refs   – needed first so scripts can read $refs
  //   2. for    – extracts loop templates so other scanners ignore them
  //   3. show   – CSS visibility toggles
  //   4. bind   – two-way bindings on form elements
  //   5. if/else-if/else – reactive conditionals (LAST: detaches subtrees,
  //                       so other scanners must run while bodies are live)
  const roots: Array<HTMLElement | ShadowRoot | DocumentFragment> = [
    host,
    ...getPendingLazyContent(host),
  ];
  for (const root of roots)
  {
    scanRefs(root, context);
    scanLoops(root, context);
    scanShow(root, context);
    scanTwoWayBindings(root, context);
    scanConditionals(root, context);
  }
  // Process any remaining <lazy> elements (e.g. nested ones revealed during
  // scanning). In practice this is a no-op for the common case because
  // loadTemplate already preprocessed top-level <lazy>.
  scanLazyElements(host);

  return context;
}

/**
 * Scans the template for all directives and returns descriptors for each.
 * This version accepts an existing refs Map to populate (used when refs
 * need to be available before scripts run).
 */
export function scanDirectivesWithRefs(
  host: HTMLElement | ShadowRoot,
  existingRefs: RefMap,
): DirectiveContext
{
  const context: DirectiveContext = {
    loops: [],
    conditionals: [],
    twoWayBindings: [],
    refs: existingRefs,
    showElements: [],
  };

  const roots: Array<HTMLElement | ShadowRoot | DocumentFragment> = [
    host,
    ...getPendingLazyContent(host),
  ];
  for (const root of roots)
  {
    scanRefs(root, context);
    scanLoops(root, context);
    scanShow(root, context);
    scanTwoWayBindings(root, context);
    scanConditionals(root, context);
  }
  scanLazyElements(host);

  return context;
}

/**
 * Scans for $ref directives only and populates the refs Map.
 * This can be called early (before scripts run) to make refs available.
 */
export function scanRefsOnly(
  host: HTMLElement | ShadowRoot | DocumentFragment,
  refs: RefMap,
): void
{
  const elements = Array.from(
    host.querySelectorAll(`[${escapeCssSelector(REF_DIRECTIVE)}]`),
  );

  for (const element of elements)
  {
    const refName = element.getAttribute(REF_DIRECTIVE);
    if (refName)
    {
      refs.set(refName, element as HTMLElement);
      // Note: Don't remove the attribute here - let scanDirectives do it later
      // so that we don't break the directive scanning flow
    }
  }
}

// ============================================================================
// $ref Directive
// ============================================================================

/**
 * Scans for $ref directives and creates element references.
 *
 * Usage: <input $ref="inputElement">
 * Access: $refs.inputElement (preferred) or $refs.get('inputElement')
 */
function scanRefs(
  host: HTMLElement | ShadowRoot | DocumentFragment,
  context: DirectiveContext,
): void
{
  const elements = Array.from(
    host.querySelectorAll(`[${escapeCssSelector(REF_DIRECTIVE)}]`),
  );

  for (const element of elements)
  {
    const refName = element.getAttribute(REF_DIRECTIVE);
    if (refName)
    {
      context.refs.set(refName, element as HTMLElement);
      // Remove the directive attribute from DOM
      element.removeAttribute(REF_DIRECTIVE);
    }
  }
}

// ============================================================================
// <for> Built-in Element
// ============================================================================

/**
 * Scans for <for> elements and creates loop descriptors.
 *
 * Syntax:
 *   <for each="item in items">…</for>
 *   <for each="(item, index) in items" key="item.id">…</for>
 *   <for each="(value, key, index) in object" track-by="value.id">…</for>
 *
 * The element body is the per-iteration template. Multiple top-level
 * children are supported; they are wrapped in a single <span style=
 * "display:contents"> so the loop machinery can treat them as one root.
 */
function scanLoops(
  host: HTMLElement | ShadowRoot | DocumentFragment,
  context: DirectiveContext,
): void
{
  // Outermost-first: snapshot live, but skip nested <for> inside another <for>
  // (those are extracted per row when the outer loop renders an iteration).
  const elements = Array.from(host.querySelectorAll("for"));

  for (const element of elements)
  {
    // Extracting an outer <for> pulls its whole subtree — nested loops
    // included — out of the host and into a template, so anything no longer
    // under `host` belongs to some other loop's template, not here.
    // Checking `parentNode` alone is not enough: a nested <for> keeps a
    // parent inside that detached template.
    if (!host.contains(element)) continue;

    const descriptor = createLoopDescriptor(element, host);
    if (descriptor) context.loops.push(descriptor);
  }
}

/**
 * Turns one live `<for>` element into a descriptor, replacing it in the tree
 * with a placeholder comment. Returns null (having warned) if the element is
 * not usable as a loop.
 */
function createLoopDescriptor(
  element: Element,
  host: HTMLElement | ShadowRoot | DocumentFragment | Element,
): LoopDescriptor | null
{
  const expression =
    element.getAttribute("each") || element.getAttribute("of") || "";
  if (!expression)
  {
    warn(`<for> requires an "each" attribute, e.g. <for each="item in items">.`);
    return null;
  }

  const parsed = parseForExpression(expression);
  if (!parsed)
  {
    warn(`Invalid <for each="…"> expression: "${expression}"`);
    return null;
  }

  // key="…" or track-by="…" override anything in the each expression.
  const keyAttr =
    element.getAttribute("key") ||
    element.getAttribute("track-by") ||
    parsed.key;

  // Build the per-iteration template root.
  const template = buildLoopTemplate(element);
  if (!template)
  {
    warn(`<for each="${expression}"> has no content to render.`);
    return null;
  }

  const placeholder = document.createComment(` <for> ${expression} `);
  const parent = element.parentElement || host;
  parent.insertBefore(placeholder, element);
  element.remove();

  return {
    template,
    expression,
    itemName: parsed.item,
    indexName: parsed.index,
    arrayName: parsed.array,
    keyAttribute: keyAttr,
    placeholder,
    renderedElements: [],
    originalParent: parent as Element | ShadowRoot,
    // Detected once here so renderLoop can skip the per-row conditional
    // walk (a querySelectorAll on every clone) for conditional-free
    // templates. resolveLoopConditionals never matches a root-level <if>
    // (querySelectorAll excludes the root), so querySelector parity holds.
    hasConditionals: template.querySelector(IF_TAG) !== null,
    // buildLoopTemplate guarantees the root is never a <for>, so
    // querySelectorAll's exclusion of the root cannot hide one.
    hasNestedLoops: template.querySelector(FOR_TAG) !== null,
  };
}

/**
 * Build the per-iteration template element from a <for>'s contents.
 *   - Single element child  → that child (fastest, zero overhead).
 *   - Otherwise              → wrap children in <span style="display:contents">.
 */
function buildLoopTemplate(forEl: Element): Element | null
{
  // Collect non-whitespace nodes.
  const significant: Node[] = [];
  for (const n of Array.from(forEl.childNodes))
  {
    if (n.nodeType === Node.TEXT_NODE && !n.textContent?.trim()) continue;
    significant.push(n);
  }
  if (significant.length === 0) return null;

  if (
    significant.length === 1 &&
    significant[0].nodeType === Node.ELEMENT_NODE &&
    // A lone nested <for> must still be wrapped: a row has to be exactly one
    // element, and the nested loop replaces itself with a placeholder comment,
    // so it needs a parent that survives.
    (significant[0] as Element).tagName !== FOR_TAG
  )
  {
    return significant[0] as Element;
  }

  // Multi-child or text+element: wrap in a transparent span.
  const wrap = document.createElement("span");
  wrap.style.display = "contents";
  for (const n of Array.from(forEl.childNodes))
  {
    wrap.appendChild(n);
  }
  return wrap;
}

/** Walk up the tree checking for an ancestor <for>. */
function hasForAncestor(el: Element): boolean
{
  let p: Element | null = el.parentElement;
  while (p)
  {
    if (p.tagName === FOR_TAG) return true;
    p = p.parentElement;
  }
  return false;
}

/**
 * Parses a $for expression into its components.
 *
 * Examples:
 *   "item in items" → { item: "item", array: "items" }
 *   "(item, index) in items" → { item: "item", index: "index", array: "items" }
 *   "{ id, name } in users" → { item: "{ id, name }", array: "users" }
 */
function parseForExpression(expression: string):
  {
    item: string;
    index?: string;
    key?: string;
    array: string;
  } | null
{
  const match = expression.match(DIRECTIVE_PATTERNS.forAlias);
  if (!match) return null;

  let [, lhs, rhs] = match;
  lhs = lhs.trim();
  rhs = rhs.trim();

  // Extract key if present: "item in items track by item.id"
  let key: string | undefined;
  const trackMatch = rhs.match(/\s+track\s+by\s+(.+)$/i);
  if (trackMatch)
  {
    key = trackMatch[1].trim();
    rhs = rhs.slice(0, trackMatch.index).trim();
  }

  // Strip parentheses: "(item, index)" → "item, index"
  const stripped = lhs.replace(DIRECTIVE_PATTERNS.stripParens, "").trim();

  // Check for index: "item, index"
  const iteratorMatch = stripped.match(DIRECTIVE_PATTERNS.forIterator);

  let item: string;
  let index: string | undefined;
  let thirdParam: string | undefined;

  if (iteratorMatch)
  {
    // Has comma-separated values
    item = stripped.replace(DIRECTIVE_PATTERNS.forIterator, "").trim();
    index = iteratorMatch[1]?.trim();
    thirdParam = iteratorMatch[2]?.trim();
  } else
  {
    item = stripped;
  }

  return {
    item,
    index: index || thirdParam, // Support both (item, index) and (value, key, index)
    key,
    array: rhs,
  };
}

// ============================================================================
// <if> / <else-if> / <else> Built-in Elements
// ============================================================================

/**
 * Scans for <if>/<else-if>/<else> chains.
 *
 * A chain is:
 *   <if condition="…">…</if>
 *   <else-if condition="…">…</else-if>   (zero or more, immediate siblings)
 *   <else>…</else>                       (optional, must be last)
 *
 * The elements themselves are used as the conditional descriptor's `element`,
 * with `display: contents` so they don't introduce a visual wrapper.
 */
function scanConditionals(
  host: HTMLElement | ShadowRoot | DocumentFragment,
  context: DirectiveContext,
): void
{
  const ifElements = Array.from(host.querySelectorAll("if"));

  for (const ifElement of ifElements)
  {
    // NOTE: Do NOT skip on `!isConnected`. When an outer <if> is processed
    // first in this same loop, it gets detached from the host tree along
    // with its nested <if>/<else-if>/<else> children. Those nested elements
    // are still valid (their parentElement is the detached outer <if>) and
    // must be processed so their conditions are wired up. Skipping them
    // here leaves them as raw <if> custom elements that always render their
    // children regardless of the condition.
    if (hasForAncestor(ifElement)) continue;

    const group: ConditionalDescriptor[] = [];
    const rawCondition = ifElement.getAttribute("condition") || "";
    const condition = stripBindingBraces(rawCondition);

    const placeholder = document.createComment(` <if> ${condition} `);
    const parent = ifElement.parentElement || host;
    const nextSibling = ifElement.nextSibling;

    parent.insertBefore(placeholder, ifElement);

    group.push(
      createConditionalDescriptor(
        ifElement as Element,
        condition,
        "if",
        placeholder,
        parent as Element | ShadowRoot,
        nextSibling,
      ),
    );

    // Walk forward through immediate siblings collecting <else-if>/<else>.
    let current = ifElement.nextElementSibling;
    while (current)
    {
      const tag = current.tagName;
      if (tag === ELSE_IF_TAG)
      {
        const rawElseIf = current.getAttribute("condition") || "";
        const elseIfCondition = stripBindingBraces(rawElseIf);
        const next = current.nextElementSibling;
        group.push(
          createConditionalDescriptor(
            current,
            elseIfCondition,
            "else-if",
            placeholder,
            parent as Element | ShadowRoot,
            current.nextSibling,
          ),
        );
        current.remove();
        current = next;
      } else if (tag === ELSE_TAG)
      {
        group.push(
          createConditionalDescriptor(
            current,
            "",
            "else",
            placeholder,
            parent as Element | ShadowRoot,
            current.nextSibling,
          ),
        );
        current.remove();
        break;
      } else
      {
        break;
      }
    }

    ifElement.remove();

    for (const desc of group)
    {
      desc.group = group;
    }

    context.conditionals.push(group);
  }
}

function createConditionalDescriptor(
  element: Element,
  condition: string,
  type: "if" | "else-if" | "else",
  placeholder: Comment,
  parent: Element | ShadowRoot,
  nextSibling: Node | null,
): ConditionalDescriptor
{
  // Remove the condition attribute (no longer needed once captured) and apply
  // display:contents so the element renders transparently without a wrapper box.
  element.removeAttribute("condition");
  (element as HTMLElement).style.display = "contents";

  return {
    element,
    condition,
    type,
    placeholder,
    group: [], // filled in by caller
    originalParent: parent,
    nextSibling,
  };
}

// ============================================================================
// <show> Built-in Element
// ============================================================================

/**
 * Scans for <show condition="…">…</show> elements.
 * Unlike <if>, <show> keeps the element in the DOM and toggles CSS display.
 * The element renders with `display: contents` when shown (no visual wrapper)
 * and `display: none` when hidden.
 */
function scanShow(
  host: HTMLElement | ShadowRoot | DocumentFragment,
  context: DirectiveContext,
): void
{
  const elements = Array.from(host.querySelectorAll("show"));

  for (const element of elements)
  {
    if (!element.parentNode) continue;
    if (hasForAncestor(element)) continue;

    const rawExpression = element.getAttribute("condition") || "";
    const expression = stripBindingBraces(rawExpression);

    const htmlElement = element as HTMLElement;
    htmlElement.style.display = "contents";

    context.showElements.push({
      element: htmlElement,
      expression,
      // "contents" is the visible-state display; updateShowElements will
      // restore this when condition becomes truthy.
      originalDisplay: "contents",
    });

    element.removeAttribute("condition");
  }
}

// ============================================================================
// $bind Directive (Two-way Binding)
// ============================================================================

/**
 * Scans for $bind directives on form elements.
 * Creates two-way bindings between input values and reactive state.
 */
function scanTwoWayBindings(
  host: HTMLElement | ShadowRoot | DocumentFragment,
  context: DirectiveContext,
): void
{
  const elements = Array.from(
    host.querySelectorAll(`[${escapeCssSelector(BIND_DIRECTIVE)}]`),
  );

  for (const element of elements)
  {
    const expression = element.getAttribute(BIND_DIRECTIVE);
    if (!expression) continue;

    // Skip if inside a loop template
    if (isInsideUnprocessedLoop(element, context)) continue;

    const path = expression.split(".");
    const isContentEditable = element.hasAttribute("contenteditable");

    const descriptor: TwoWayBindingDescriptor = {
      element: element as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement,
      path,
      raw: expression,
      isContentEditable,
    };

    context.twoWayBindings.push(descriptor);

    // Remove directive attribute
    element.removeAttribute(BIND_DIRECTIVE);
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Checks if an element is inside an unprocessed <for> template.
 * Used to skip $bind etc. that live inside loop bodies.
 */
function isInsideUnprocessedLoop(
  element: Element,
  _context: DirectiveContext,
): boolean
{
  return hasForAncestor(element);
}

// ============================================================================
// Directive Executors
// ============================================================================

/**
 * Renders all loops with the current state.
 */
export function renderLoops(
  loops: LoopDescriptor[],
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>,
  ) => unknown,
): void
{
  for (const loop of loops)
  {
    renderLoop(loop, state, evaluateExpression);
  }
}

/**
 * Renders a single loop with keyed diffing for optimal DOM updates.
 * Uses LIS-based algorithm to minimize DOM operations.
 *
 * `scope` carries the loop variables of any enclosing loops. It is empty for
 * a top-level loop; for `<for each="item in group.items">` nested inside
 * `<for each="group in groups">` it holds the current `group`, which is what
 * makes `group.items` resolvable at all.
 */
function renderLoop(
  loop: LoopDescriptor,
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>,
  ) => unknown,
  scope?: Record<string, unknown>,
): void
{
  ((globalThis as any).__P__ ??= []).push({
    arr: loop.arrayName, scope: scope ? Object.keys(scope) : null,
    scopeNames: loop.scopeNames, nested: loop.hasNestedLoops,
  });
  // Get the array to iterate over
  const arrayValue = evaluateExpression(
    loop.arrayName,
    scope ? { ...state, ...scope } : state,
  );

  if (!arrayValue || !isIterable(arrayValue))
  {
    // Clear all if array is empty/invalid
    for (const el of loop.renderedElements)
    {
      el.remove();
    }
    loop.renderedElements = [];
    loop.previousItems = [];
    return;
  }

  const newItems = Array.from(arrayValue as Iterable<unknown>);
  const oldItems = loop.previousItems || [];
  const oldElements = loop.renderedElements;

  // Initialize key getter if not already done (cached for performance)
  if (!loop.keyGetter)
  {
    loop.keyGetter = createKeyGetter(loop.keyAttribute, loop.itemName);
  }

  // One reusable context for ALL evaluation this pass — creates and updates
  // alike. Handlers never capture it (they close over a small per-row
  // context, below), so mutating item/index per element is safe and avoids
  // copying the whole component state once per item.
  const updateContext = createBaseLoopContext(state);
  if (scope) Object.assign(updateContext, scope);

  // Prime the item/index keys so the pass-scoped fast evaluator captures the
  // complete key set (its contract: keys must not change once created —
  // values may, and do, change per row below).
  updateContext[loop.itemName] = null;
  if (loop.indexName) updateContext[loop.indexName] = 0;

  // Static-mode fast evaluator: state slots are filled once, and only the
  // item/index slots are refreshed per row (setRow → refresh()). State
  // values cannot change mid-pass — no user code runs during a flush.
  // Enclosing loop variables are static too: this whole call renders one
  // row of the outer loop.
  const volatileKeys = loop.indexName
    ? [loop.itemName, loop.indexName]
    : [loop.itemName];
  const evalOne: BoundEvaluator =
    typeof (evaluateExpression as Partial<DirectiveEvaluator>).forContext ===
      "function"
      ? (evaluateExpression as DirectiveEvaluator).forContext(
        updateContext,
        volatileKeys,
      )
      : (expr) => evaluateExpression(expr, updateContext);

  // Point the shared context (and the evaluator's volatile slots) at a row.
  const setRow = (item: unknown, index: number): void =>
  {
    updateContext[loop.itemName] = item;
    if (loop.indexName) updateContext[loop.indexName] = index;
    evalOne.refresh?.();
  };

  // Everything handler creation needs that is identical across rows — name
  // lists, the generated destructuring prelude, event-bus helpers — built at
  // most once per pass, and only if a handler attribute is actually seen.
  // Enclosing loop variables are declared alongside this loop's own, so a
  // handler in a nested row can read the outer row's item.
  const rowVarNames = loop.indexName
    ? [loop.itemName, loop.indexName]
    : [loop.itemName];
  const scopedVarNames = loop.scopeNames?.length
    ? [...loop.scopeNames, ...rowVarNames]
    : rowVarNames;
  let handlerSetup: LoopHandlerSetup | null = null;
  const getSetup = (): LoopHandlerSetup =>
    (handlerSetup ??= createLoopHandlerSetup(state, scopedVarNames));

  /** The loop variables visible to anything rendered inside one row. */
  const scopeForRow = (item: unknown, index: number): Record<string, unknown> =>
  {
    const inner: Record<string, unknown> = scope ? { ...scope } : {};
    inner[loop.itemName] = item;
    if (loop.indexName) inner[loop.indexName] = index;
    return inner;
  };

  /**
   * Renders the `<for>` elements extracted from one row. Their descriptors
   * live on the row element, so a reused row re-renders its own children
   * against the item it now holds rather than rebuilding them.
   */
  const renderNested = (el: Element, item: unknown, index: number): void =>
  {
    const nested = (el as any)[LOOP_ROW_NESTED] as LoopDescriptor[] | undefined;
    if (!nested) return;
    const inner = scopeForRow(item, index);
    for (const child of nested)
    {
      renderLoop(child, state, evaluateExpression, inner);
    }
  };

  // Refresh the small per-row context captured by an element's handlers so a
  // reused row's handlers read the CURRENT item/index at event time, not the
  // values from when the element was first created.
  const refreshRowCtx = (el: Element, item: unknown, index: number): void =>
  {
    const rowCtx = (el as any)[LOOP_ROW_CTX] as
      | Record<string, unknown>
      | undefined;
    if (rowCtx)
    {
      rowCtx[loop.itemName] = item;
      if (loop.indexName) rowCtx[loop.indexName] = index;
    }
  };

  // Precompiled row-instantiation plan for this template (null when the
  // template needs the generic walk — nested <if>/<for>).
  const plan = getCreationPlan(loop);

  // Helper to create a new element for an item
  const createElement = (item: unknown, index: number): Element =>
  {
    const clone = loop.template.cloneNode(true) as Element;
    setRow(item, index);
    // Small per-row context for event handlers: item/index own-properties
    // over a pass-shared prototype carrying state functions and markers.
    const rowCtx: Record<string, unknown> = Object.create(getSetup().proto);
    if (scope) Object.assign(rowCtx, scope);
    rowCtx[loop.itemName] = item;
    if (loop.indexName) rowCtx[loop.indexName] = index;
    (clone as any)[LOOP_ROW_CTX] = rowCtx;
    // Extract nested <for> elements before anything walks the clone, so the
    // generic binding pass never sees their templates and cannot bind them
    // against a context that lacks the inner loop variable.
    if (loop.hasNestedLoops)
    {
      (clone as any)[LOOP_ROW_NESTED] = extractNestedLoops(
        clone,
        scopedVarNames,
      );
    }
    if (plan)
    {
      applyCreationPlan(clone, plan, evalOne, rowCtx, getSetup, loop);
      renderNested(clone, item, index);
      return clone;
    }
    // Resolve any <if>/<else-if>/<else> chains nested inside the loop
    // template before processing bindings so dead branches are pruned.
    // Skipped entirely when scan time proved the template has none.
    if (loop.hasConditionals)
    {
      resolveLoopConditionals(
        clone,
        updateContext,
        evaluateExpression,
        evalOne,
      );
    }
    processElementBindings(
      clone,
      updateContext,
      evaluateExpression,
      evalOne,
      rowCtx,
      getSetup,
    );
    renderNested(clone, item, index);
    return clone;
  };

  // Build the reconciled element list. `source[i]` is the previous index of
  // the element now at position i, or -1 for a freshly created one — this
  // drives the shared LIS-based move minimization below.
  const newElements: Element[] = new Array(newItems.length);
  const source: number[] = new Array(newItems.length);

  // Fast path: pairwise-identical items mean no structural change — some
  // OTHER state the loop's bindings reference changed (e.g. a selection
  // flag). Refresh bindings in place and skip key maps, diffing, and
  // placement entirely.
  if (
    newItems.length === oldItems.length &&
    oldElements.length === newItems.length
  )
  {
    let identical = true;
    for (let i = 0; i < newItems.length; i++)
    {
      if (newItems[i] !== oldItems[i])
      {
        identical = false;
        break;
      }
    }
    if (identical)
    {
      for (let i = 0; i < newItems.length; i++)
      {
        setRow(newItems[i], i);
        refreshRowCtx(oldElements[i], newItems[i], i);
        updateElementBindings(
          oldElements[i],
          updateContext,
          evaluateExpression,
          evalOne,
          getSetup,
        );
        renderNested(oldElements[i], newItems[i], i);
      }
      loop.previousItems = newItems;
      return;
    }
  }

  if (loop.keyAttribute)
  {
    // Keyed reconciliation - match elements by key for optimal reuse.
    const keyToElement = new Map<unknown, Element>();
    const keyToOldIndex = new Map<unknown, number>();
    for (let i = 0; i < oldItems.length; i++)
    {
      const key = loop.keyGetter(oldItems[i], i);
      keyToOldIndex.set(key, i);
      if (oldElements[i]) keyToElement.set(key, oldElements[i]);
    }

    // Remove elements whose key disappeared. A key-set difference is all
    // that's needed here — the LIS-based placement below handles moves, so
    // running the full diff (which computes move operations nobody reads)
    // would be O(n²) wasted work per flush.
    const newKeys = new Set<unknown>();
    for (let i = 0; i < newItems.length; i++)
    {
      newKeys.add(loop.keyGetter(newItems[i], i));
    }
    for (const [key, el] of keyToElement)
    {
      if (!newKeys.has(key))
      {
        el.remove();
        keyToElement.delete(key);
      }
    }

    for (let i = 0; i < newItems.length; i++)
    {
      const item = newItems[i];
      const key = loop.keyGetter(item, i);
      const existingEl = keyToElement.get(key);
      if (existingEl)
      {
        // Reuse existing element - update bindings against the shared context.
        setRow(item, i);
        refreshRowCtx(existingEl, item, i);
        updateElementBindings(
          existingEl,
          updateContext,
          evaluateExpression,
          evalOne,
          getSetup,
        );
        renderNested(existingEl, item, i);
        newElements[i] = existingEl;
        source[i] = keyToOldIndex.get(key) ?? -1;
      } else
      {
        newElements[i] = createElement(item, i);
        source[i] = -1;
      }
    }
  } else
  {
    // Non-keyed reconciliation - reuse elements by position (index identity).
    const reuseCount = Math.min(oldItems.length, newItems.length);
    for (let i = 0; i < newItems.length; i++)
    {
      if (i < reuseCount)
      {
        setRow(newItems[i], i);
        refreshRowCtx(oldElements[i], newItems[i], i);
        updateElementBindings(
          oldElements[i],
          updateContext,
          evaluateExpression,
          evalOne,
          getSetup,
        );
        renderNested(oldElements[i], newItems[i], i);
        newElements[i] = oldElements[i];
        source[i] = i;
      } else
      {
        newElements[i] = createElement(newItems[i], i);
        source[i] = -1;
      }
    }
    // Remove trailing elements that no longer have a matching item.
    for (let i = reuseCount; i < oldElements.length; i++)
    {
      oldElements[i]?.remove();
    }
  }

  // Place elements in target order, moving only those that are not part of the
  // longest stable (increasing) run of reused elements. Elements already in
  // correct relative order stay put, so an in-order content update or a plain
  // append performs the minimum number of DOM moves.
  const stable = getStableIndices(source);
  const parent = loop.placeholder.parentNode;
  if (parent)
  {
    let prev: Node = loop.placeholder;
    for (let i = 0; i < newElements.length; i++)
    {
      const el = newElements[i];
      if (stable.has(i))
      {
        // Reused element already in correct relative position — leave it.
        prev = el;
      } else
      {
        // New or out-of-order element: move it directly after its predecessor.
        if (prev.nextSibling !== el)
        {
          parent.insertBefore(el, prev.nextSibling);
        }
        prev = el;
      }
    }
  }

  loop.renderedElements = newElements;

  // Store current items for next diff
  loop.previousItems = [...newItems];
}

/**
 * Builds the shared per-pass evaluation context (everything except the
 * item/index entries). Spreading the component state is the expensive part,
 * so renderLoop builds this ONCE per pass and mutates the item/index keys
 * per element — for creates and updates alike — instead of recreating the
 * whole object each time. Event handlers never capture this object; they
 * get a small per-row context (see createLoopHandlerSetup).
 */
function createBaseLoopContext(
  state: Record<string, unknown>,
): Record<string, unknown>
{
  const scriptContentFromState = (state as any).__scriptContent;
  return {
    ...state,
    __reactiveState__: state,
    __scriptContent__: scriptContentFromState || "",
    __componentUrl__: (state as any).__componentUrl || "",
  };
}

/**
 * A binding template pre-parsed into alternating static text and
 * expression segments: the rendered value is
 * `statics[0] + eval(exprs[0]) + statics[1] + … + statics[exprs.length]`.
 * Parsing once at collection time replaces a regex `.replace` (plus a
 * closure allocation) per binding per update with a plain concat loop.
 */
type ParsedBinding = {
  statics: string[];
  exprs: string[];
  /**
   * Compiled evaluator Functions aligned with `exprs`, valid only for the
   * key-set signature in `fnsSig` (null = compile error, falls back to the
   * reporting slow path). Resolved once per template per context shape so
   * hot loops skip the per-eval cache lookup — see compiledFnsFor.
   */
  fns?: (Function | null)[];
  fnsSig?: string;
};

/**
 * Parsed templates are shared globally: every row of a 1,000-row loop has
 * the same handful of template strings, so parsing is done once per
 * distinct template rather than once per node.
 */
const parsedTemplateCache = new Map<string, ParsedBinding>();

/**
 * Returns compiled Functions for every expression in `parsed`, resolving
 * them through the bound evaluator once per (template, context shape) and
 * reusing them afterwards. A null entry means the expression failed to
 * compile; callers fall back to the plain evaluator for it so the original
 * per-update error reporting is preserved.
 */
function compiledFnsFor(
  parsed: ParsedBinding,
  evalOne: BoundEvaluator,
): (Function | null)[]
{
  if (parsed.fnsSig !== evalOne.sig)
  {
    const fns: (Function | null)[] = new Array(parsed.exprs.length);
    for (let i = 0; i < parsed.exprs.length; i++)
    {
      fns[i] = evalOne.compile!(parsed.exprs[i]);
    }
    parsed.fns = fns;
    parsed.fnsSig = evalOne.sig;
  }
  return parsed.fns!;
}

function parseBindingTemplate(template: string): ParsedBinding
{
  let parsed = parsedTemplateCache.get(template);
  if (parsed) return parsed;

  const statics: string[] = [];
  const exprs: string[] = [];
  const re = /\{([^}]+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)))
  {
    statics.push(template.slice(last, m.index));
    exprs.push(m[1].trim());
    last = m.index + m[0].length;
  }
  statics.push(template.slice(last));

  parsed = { statics, exprs };
  parsedTemplateCache.set(template, parsed);
  return parsed;
}

/**
 * Per-element cache of everything the update path needs to touch: text
 * nodes and attributes carrying a `__originalTemplate` (with the template
 * pre-parsed into segments), and the comment placeholders of nested <if>
 * chains. Collected with TreeWalkers once, then reused on every
 * subsequent update — the subtree structure of a reused loop element only
 * changes when a conditional branch swaps, and that invalidates the cache
 * below.
 */
type LoopBindingCache = {
  texts: { node: Text; parsed: ParsedBinding }[];
  attrs: { attr: Attr; parsed: ParsedBinding }[];
  conds: Comment[];
};

const BINDING_CACHE = "__ladrillosBindingCache" as const;

/**
 * Per-element key holding the small context its event handlers close over
 * ({item, index} own-props over a pass-shared prototype). renderLoop
 * refreshes the item/index values whenever the element is reused for a
 * different row, so handlers read current data at event time.
 */
const LOOP_ROW_CTX = "__ladrillosLoopCtx" as const;

/**
 * Per-row key holding the loop descriptors extracted from that row's clone.
 * Kept on the element so a reused row re-renders its own nested loops
 * against the item it now holds, instead of being rebuilt from scratch.
 */
const LOOP_ROW_NESTED = "__ladrillosLoopNested" as const;

/**
 * Pulls every top-level `<for>` out of one row clone, turning each into a
 * descriptor rooted in that clone.
 *
 * Only the outermost ones: a `<for>` inside another `<for>` belongs to that
 * loop's template and is extracted when it renders its own rows.
 */
function extractNestedLoops(
  clone: Element,
  scopeNames: readonly string[],
): LoopDescriptor[]
{
  const nested: LoopDescriptor[] = [];
  for (const el of Array.from(clone.querySelectorAll(FOR_TAG)))
  {
    if (!el.parentNode) continue; // already pulled out with an outer one
    if (hasForAncestorWithin(el, clone)) continue;
    const descriptor = createLoopDescriptor(el, clone);
    if (descriptor)
    {
      descriptor.scopeNames = scopeNames;
      nested.push(descriptor);
    }
  }
  return nested;
}

/** Like hasForAncestor, but stops at `root` rather than at the document. */
function hasForAncestorWithin(el: Element, root: Element): boolean
{
  let p: Element | null = el.parentElement;
  while (p && p !== root)
  {
    if (p.tagName === FOR_TAG) return true;
    p = p.parentElement;
  }
  return false;
}

function collectBindingCache(element: Element): LoopBindingCache
{
  const texts: LoopBindingCache["texts"] = [];
  const attrs: LoopBindingCache["attrs"] = [];
  const conds: Comment[] = [];

  const collectAttrs = (el: Element): void =>
  {
    const list = el.attributes;
    for (let i = 0; i < list.length; i++)
    {
      const template = (list[i] as any).__originalTemplate;
      if (template)
      {
        attrs.push({ attr: list[i], parsed: parseBindingTemplate(template) });
      }
    }
  };

  // A TreeWalker's nextNode does not include the root, so the root's
  // attributes are collected explicitly first.
  collectAttrs(element);
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
  );
  let node: Node | null;
  while ((node = walker.nextNode()))
  {
    if (node.nodeType === Node.TEXT_NODE)
    {
      const template = (node as any).__originalTemplate;
      if (template)
      {
        texts.push({
          node: node as Text,
          parsed: parseBindingTemplate(template),
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE)
    {
      collectAttrs(node as Element);
    } else if ((node as any)[LOOP_COND_META])
    {
      conds.push(node as Comment);
    }
  }

  return { texts, attrs, conds };
}

// ============================================================================
// Loop creation plan — per-template precompiled row instantiation
// ============================================================================
//
// For loop templates without <if> chains or nested <for> elements, every
// row's subtree structure is identical to the template's, so the location of
// each bound text node, bound attribute, and handler attribute can be
// recorded ONCE as a child-index path from the root. Creating a row then
// costs cloneNode plus direct navigation to exactly the nodes that need
// work — no TreeWalker over the whole subtree, no per-node attribute
// scanning, and all templates/handler code pre-parsed. This is computed
// lazily at first render (no build step) and is invisible to callers: the
// applied result — evaluated bindings, listeners, seeded binding cache — is
// identical to what the generic processElementBindings walk produces.

type PlanTextEntry = { path: number[]; parsed: ParsedBinding };
type PlanAttrEntry = { path: number[]; name: string; parsed: ParsedBinding };
type PlanHandlerEntry = {
  path: number[];
  /** Attribute to strip from the clone. */
  attrName: string;
  /** DOM event name to listen for. */
  eventName: string;
  /** Handler source with {expr} bindings already rewritten. */
  code: string;
  /** Modifier info for $on: directives (null for plain onXXX handlers). */
  directive: NonNullable<ReturnType<typeof parseEventDirective>> | null;
  options?: ReturnType<typeof getListenerOptions>;
};

/**
 * A group of delegated handler entries sharing one element (path). `stamp`
 * is the immutable marker object written onto every row's element at that
 * path — shared across rows, so stamping costs one property write.
 */
type PlanDelegatedGroup = {
  path: number[];
  entries: PlanHandlerEntry[];
  stamp: { owner: LoopDescriptor; entries: PlanHandlerEntry[] };
};

type LoopCreationPlan = {
  texts: PlanTextEntry[];
  attrs: PlanAttrEntry[];
  /** Handlers attached per element (delegation off or ineligible). */
  handlers: PlanHandlerEntry[];
  /** Handlers served by one container listener per event type (or null). */
  delegated: PlanDelegatedGroup[] | null;
  /** Distinct event types needing a container listener. */
  delegatedEvents: string[];
};

// ============================================================================
// Opt-in event delegation (configure({ delegateLoopEvents: true }))
// ============================================================================
//
// Instead of one listener per handler per row (2,000 addEventListener calls
// and closures for a 1,000-row list with two handlers), eligible handlers
// share ONE listener per event type on the loop's container. Rows carry two
// expando stamps: the handler element points at its plan entries, the row
// root already carries the per-row context. On an event, the dispatcher
// walks target → container collecting this loop's matched entries
// (inner-to-outer, mimicking bubble order), resolves the row context at the
// row root, and invokes — honoring stopPropagation between handlers via
// event.cancelBubble.
//
// Eligibility: the event must bubble and the handler must not use the
// `.self` (reads currentTarget), `.capture`, `.once`, or `.passive`
// modifiers; ineligible handlers keep per-element listeners transparently.

/** Events that bubble (and are worth delegating). */
const DELEGATABLE_EVENTS = new Set([
  "click",
  "dblclick",
  "auxclick",
  "contextmenu",
  "mousedown",
  "mouseup",
  "mousemove",
  "mouseover",
  "mouseout",
  "pointerdown",
  "pointerup",
  "pointermove",
  "pointerover",
  "pointerout",
  "pointercancel",
  "touchstart",
  "touchend",
  "touchmove",
  "touchcancel",
  "keydown",
  "keyup",
  "keypress",
  "input",
  "beforeinput",
  "change",
  "submit",
  "reset",
  "focusin",
  "focusout",
  "wheel",
  "dragstart",
  "drag",
  "dragend",
  "dragenter",
  "dragover",
  "dragleave",
  "drop",
  "cut",
  "copy",
  "paste",
]);

/** Stamp on a handler element inside a delegated row (shared per plan group). */
const DELEGATED_KEY = "__ladrillosDelegated" as const;

/** Stamp on a delegated row's root marking which loop owns it. */
const LOOP_ROW_OWNER = "__ladrillosLoopOwner" as const;

function isDelegatableHandler(
  eventName: string,
  directive: PlanHandlerEntry["directive"],
): boolean
{
  if (!DELEGATABLE_EVENTS.has(eventName)) return false;
  if (directive)
  {
    const mods = directive.eventModifiers;
    if (
      mods.includes("self") ||
      mods.includes("capture") ||
      mods.includes("once") ||
      mods.includes("passive")
    )
    {
      return false;
    }
  }
  return true;
}

type DelegationState = {
  container: Node;
  /** Latest handler setup — refreshed each render pass. */
  setup: LoopHandlerSetup;
  /** Event types that already have a container listener. */
  events: Set<string>;
};

const delegationStates = new WeakMap<LoopDescriptor, DelegationState>();

/**
 * Attaches (once per loop per event type) the shared container listeners
 * and keeps the dispatch setup current.
 */
function ensureDelegation(
  loop: LoopDescriptor,
  setup: LoopHandlerSetup,
  events: readonly string[],
): void
{
  let state = delegationStates.get(loop);
  if (!state)
  {
    const container = (loop.placeholder.parentNode ??
      loop.originalParent) as Node;
    state = { container, setup, events: new Set() };
    delegationStates.set(loop, state);
  }
  state.setup = setup;
  for (const type of events)
  {
    if (!state.events.has(type))
    {
      state.events.add(type);
      const captured = state;
      state.container.addEventListener(type, (event: Event) =>
        dispatchDelegated(event, loop, captured),
      );
    }
  }
}

/**
 * Shared container listener body: walk target → container collecting this
 * loop's stamped handler elements (inner-to-outer), resolve the row context
 * at the row root, then invoke in bubble order. `event.cancelBubble` (set
 * by stopPropagation, including the `.stop` modifier) stops the remaining
 * handlers exactly as it would stop real bubbling between per-element
 * listeners.
 */
function dispatchDelegated(
  event: Event,
  loop: LoopDescriptor,
  state: DelegationState,
): void
{
  const container = state.container;
  const matched: PlanHandlerEntry[][] = [];
  let rowCtx: Record<string, unknown> | null = null;

  let node: Node | null = event.target as Node | null;
  while (node && node !== container)
  {
    const stamp = (node as any)[DELEGATED_KEY] as
      | { owner: LoopDescriptor; entries: PlanHandlerEntry[] }
      | undefined;
    if (stamp && stamp.owner === loop)
    {
      matched.push(stamp.entries);
    }
    if ((node as any)[LOOP_ROW_OWNER] === loop)
    {
      rowCtx =
        ((node as any)[LOOP_ROW_CTX] as Record<string, unknown>) ?? null;
      break; // row roots are direct children of the container
    }
    node = node.parentNode;
  }
  if (rowCtx === null || matched.length === 0) return;

  for (const entries of matched)
  {
    for (const h of entries)
    {
      if (h.eventName !== event.type) continue;
      runDelegatedHandler(h, event, rowCtx, state.setup);
      if (event.cancelBubble) return;
    }
  }
}

function runDelegatedHandler(
  h: PlanHandlerEntry,
  event: Event,
  rowCtx: Record<string, unknown>,
  setup: LoopHandlerSetup,
): void
{
  const fn = getLoopHandlerFn(h.code, setup);
  if (!fn) return;

  const run = (ev: Event): void =>
  {
    try
    {
      // If the element also has $bind for this event, sync its value into
      // state first so the handler reads the current value, not the previous
      syncBindBeforeHandler(ev);

      fn(ev, rowCtx, setup.reactiveState, setup.emit, setup.listen);
    } catch (e)
    {
      error(`Error in loop event handler: ${h.code}`, null, e);
    }
  };

  if (h.directive)
  {
    createModifiedHandler(run, h.directive)(event);
  } else
  {
    run(event);
  }
}

/** Plan per loop descriptor; null marks a template the plan can't cover. */
const creationPlans = new WeakMap<LoopDescriptor, LoopCreationPlan | null>();

function getCreationPlan(loop: LoopDescriptor): LoopCreationPlan | null
{
  let plan = creationPlans.get(loop);
  if (plan === undefined)
  {
    plan = buildCreationPlan(loop);
    creationPlans.set(loop, plan);
  }
  return plan;
}

function buildCreationPlan(loop: LoopDescriptor): LoopCreationPlan | null
{
  // Conditionals change the subtree per row, and nested <for> subtrees rely
  // on the generic walk's semantics — fall back for both.
  if (loop.hasConditionals) return null;
  if (loop.template.querySelector(FOR_TAG) !== null) return null;

  const texts: PlanTextEntry[] = [];
  const attrs: PlanAttrEntry[] = [];
  const handlers: PlanHandlerEntry[] = [];
  const path: number[] = [];

  const visit = (node: Node): void =>
  {
    if (node.nodeType === Node.ELEMENT_NODE)
    {
      const list = (node as Element).attributes;
      for (let i = 0; i < list.length; i++)
      {
        const attr = list[i];
        if (EVENT_ATTRIBUTE_SET.has(attr.name))
        {
          handlers.push({
            path: path.slice(),
            attrName: attr.name,
            eventName: attr.name.slice(2),
            code: bindHandlerExpressions(attr.value),
            directive: null,
          });
        } else if (isEventDirective(attr.name))
        {
          const parsedDirective = parseEventDirective(attr.name);
          if (parsedDirective)
          {
            handlers.push({
              path: path.slice(),
              attrName: attr.name,
              eventName: parsedDirective.eventName,
              code: bindHandlerExpressions(attr.value),
              directive: parsedDirective,
              options: getListenerOptions(parsedDirective.eventModifiers),
            });
          }
        } else if (attr.value.includes("{"))
        {
          attrs.push({
            path: path.slice(),
            name: attr.name,
            parsed: parseBindingTemplate(attr.value),
          });
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE)
    {
      const text = node.textContent;
      if (text && text.includes("{"))
      {
        texts.push({ path: path.slice(), parsed: parseBindingTemplate(text) });
      }
    }
    const children = node.childNodes;
    for (let i = 0; i < children.length; i++)
    {
      path.push(i);
      visit(children[i]);
      path.pop();
    }
  };
  visit(loop.template);

  // Partition handlers between delegation and per-element attachment. The
  // flag is read once here (the plan is cached per loop), so set
  // delegateLoopEvents before components render.
  let direct = handlers;
  let delegated: PlanDelegatedGroup[] | null = null;
  const delegatedEvents: string[] = [];
  if (isLoopDelegationEnabled() && handlers.length > 0)
  {
    direct = [];
    const byPath = new Map<string, PlanDelegatedGroup>();
    for (const h of handlers)
    {
      if (isDelegatableHandler(h.eventName, h.directive))
      {
        const key = h.path.join(",");
        let group = byPath.get(key);
        if (!group)
        {
          const entries: PlanHandlerEntry[] = [];
          group = { path: h.path, entries, stamp: { owner: loop, entries } };
          byPath.set(key, group);
        }
        group.entries.push(h);
        if (!delegatedEvents.includes(h.eventName))
        {
          delegatedEvents.push(h.eventName);
        }
      } else
      {
        direct.push(h);
      }
    }
    if (byPath.size > 0) delegated = [...byPath.values()];
  }

  return { texts, attrs, handlers: direct, delegated, delegatedEvents };
}

/**
 * Instantiates one row from a fresh clone using the precomputed plan:
 * evaluates each bound text/attribute in place, attaches handlers, and
 * seeds the element's binding cache exactly as the generic walk would.
 */
function applyCreationPlan(
  clone: Element,
  plan: LoopCreationPlan,
  evalOne: BoundEvaluator,
  rowCtx: Record<string, unknown>,
  getSetup: () => LoopHandlerSetup,
  loop: LoopDescriptor,
): void
{
  const canInvoke = evalOne.invoke !== undefined && evalOne.sig !== undefined;

  const resolve = (path: number[]): Node =>
  {
    let node: Node = clone;
    for (let i = 0; i < path.length; i++)
    {
      node = node.childNodes[path[i]];
    }
    return node;
  };

  const cacheTexts: LoopBindingCache["texts"] = new Array(plan.texts.length);
  for (let t = 0; t < plan.texts.length; t++)
  {
    const { path, parsed } = plan.texts[t];
    const node = resolve(path) as Text;
    (node as any).__originalTemplate = node.textContent;
    const { statics, exprs } = parsed;
    const fns = canInvoke ? compiledFnsFor(parsed, evalOne) : null;
    let next = statics[0];
    for (let j = 0; j < exprs.length; j++)
    {
      const fn = fns !== null ? fns[j] : null;
      const result =
        fn !== null ? evalOne.invoke!(fn, exprs[j]) : evalOne(exprs[j]);
      next += String(result ?? "") + statics[j + 1];
    }
    node.textContent = next;
    cacheTexts[t] = { node, parsed };
  }

  const cacheAttrs: LoopBindingCache["attrs"] = new Array(plan.attrs.length);
  for (let a = 0; a < plan.attrs.length; a++)
  {
    const { path, name, parsed } = plan.attrs[a];
    const el = resolve(path) as Element;
    const attr = el.getAttributeNode(name)!;
    (attr as any).__originalTemplate = attr.value;
    const { statics, exprs } = parsed;
    const fns = canInvoke ? compiledFnsFor(parsed, evalOne) : null;
    let next = statics[0];
    for (let j = 0; j < exprs.length; j++)
    {
      const fn = fns !== null ? fns[j] : null;
      const result =
        fn !== null ? evalOne.invoke!(fn, exprs[j]) : evalOne(exprs[j]);
      next +=
        (result !== null && typeof result === "object"
          ? JSON.stringify(result)
          : String(result ?? "")) + statics[j + 1];
    }
    attr.value = next;
    cacheAttrs[a] = { attr, parsed };
  }

  if (plan.handlers.length > 0 || plan.delegated !== null)
  {
    const setup = getSetup();
    for (const h of plan.handlers)
    {
      const el = resolve(h.path) as Element;
      el.removeAttribute(h.attrName);
      const base = createLoopEventHandler(h.code, rowCtx, setup);
      if (!base) continue;
      if (h.directive)
      {
        el.addEventListener(
          h.eventName,
          createModifiedHandler(base, h.directive),
          h.options,
        );
      } else
      {
        el.addEventListener(h.eventName, base);
      }
    }
    if (plan.delegated !== null)
    {
      // No listeners on the row at all: stamp the handler elements with
      // their (shared) plan entries and mark the row root as this loop's.
      // The container listener resolves everything at dispatch time.
      (clone as any)[LOOP_ROW_OWNER] = loop;
      for (const group of plan.delegated)
      {
        const el = resolve(group.path) as Element;
        for (const h of group.entries)
        {
          el.removeAttribute(h.attrName);
        }
        (el as any)[DELEGATED_KEY] = group.stamp;
      }
      ensureDelegation(loop, setup, plan.delegatedEvents);
    }
  }

  (clone as any)[BINDING_CACHE] = {
    texts: cacheTexts,
    attrs: cacheAttrs,
    conds: [],
  };
}

/**
 * Updates bindings on an existing element (for keyed diffing reuse).
 *
 * Uses the per-element binding cache instead of re-walking the subtree on
 * every update; the cache is (re)built on first use and whenever a nested
 * conditional swaps branches (the only structural change possible on a
 * reused element). DOM writes are skipped when the computed value matches
 * what's already there, so an unchanged row costs only expression evals.
 *
 * `evalOne` is the pass-scoped fast evaluator bound to `context`; both
 * refer to the same state, `evalOne` just skips per-call context setup.
 */
function updateElementBindings(
  element: Element,
  context: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>,
  ) => unknown,
  evalOne: BoundEvaluator = (expr) => evaluateExpression(expr, context),
  getSetup?: () => LoopHandlerSetup,
): void
{
  let cache = (element as any)[BINDING_CACHE] as LoopBindingCache | undefined;
  if (!cache)
  {
    cache = collectBindingCache(element);
    (element as any)[BINDING_CACHE] = cache;
  }

  // Re-evaluate any <if>/<else-if>/<else> chains nested inside the element
  // (loop iteration) so the rendered branch matches the current per-item
  // context. A swapped branch changes the subtree, so the cache is rebuilt
  // (the freshly rendered branch was already processed with the current
  // context, so re-updating its bindings below is an idempotent no-op).
  if (
    cache.conds.length > 0 &&
    updateLoopConditionals(
      cache.conds,
      context,
      evaluateExpression,
      evalOne,
      ((element as any)[LOOP_ROW_CTX] as Record<string, unknown>) ?? context,
      getSetup,
    )
  )
  {
    cache = collectBindingCache(element);
    (element as any)[BINDING_CACHE] = cache;
  }

  // With a full BoundEvaluator, resolve each template's compiled Functions
  // once and invoke them directly — no per-eval cache lookup or arg refill.
  const canInvoke = evalOne.invoke !== undefined && evalOne.sig !== undefined;

  const texts = cache.texts;
  for (let i = 0; i < texts.length; i++)
  {
    const { node, parsed } = texts[i];
    const { statics, exprs } = parsed;
    const fns = canInvoke ? compiledFnsFor(parsed, evalOne) : null;
    let next = statics[0];
    for (let j = 0; j < exprs.length; j++)
    {
      const fn = fns !== null ? fns[j] : null;
      const result =
        fn !== null ? evalOne.invoke!(fn, exprs[j]) : evalOne(exprs[j]);
      next += String(result ?? "") + statics[j + 1];
    }
    if (node.textContent !== next) node.textContent = next;
  }

  const attrs = cache.attrs;
  for (let i = 0; i < attrs.length; i++)
  {
    const { attr, parsed } = attrs[i];
    const { statics, exprs } = parsed;
    const fns = canInvoke ? compiledFnsFor(parsed, evalOne) : null;
    let next = statics[0];
    for (let j = 0; j < exprs.length; j++)
    {
      const fn = fns !== null ? fns[j] : null;
      const result =
        fn !== null ? evalOne.invoke!(fn, exprs[j]) : evalOne(exprs[j]);
      next +=
        (result !== null && typeof result === "object"
          ? JSON.stringify(result)
          : String(result ?? "")) + statics[j + 1];
    }
    if (attr.value !== next) attr.value = next;
  }
}

// ============================================================================
// <if>/<else-if>/<else> support inside <for> loop iterations
// ============================================================================
//
// The top-level `scanConditionals` pass cannot wire up conditionals inside a
// `<for>` template because `scanLoops` extracts loop bodies from the live host
// tree before `scanConditionals` runs. To support conditionals nested in
// loops, we resolve them per-iteration on the cloned template:
//
//   - On create: prune dead branches and render the chosen branch.
//   - On update (keyed/non-keyed reuse): re-evaluate the chain against the
//     current item context and swap the rendered branch if it changed.
//
// The branch chain (deep clones of the original `<if>`/`<else-if>`/`<else>`
// elements) is stashed on a comment placeholder so subsequent updates can
// re-render any branch.

const LOOP_COND_META = "__ladrillosLoopCond" as const;

type LoopConditionalBranch = {
  type: "if" | "else-if" | "else";
  condition: string; // empty string for else
  /**
   * A `<template>` whose `.content` holds a deep-clone of the branch's
   * original children. We use a `<template>` (rather than the original
   * `<if>`/`<else>` element) so the branch tag never re-appears in the
   * live DOM — otherwise `resolveLoopConditionals`' tag-based scan would
   * re-discover the rendered branch on its next iteration.
   */
  template: HTMLTemplateElement;
};

type LoopConditionalMeta = {
  branches: LoopConditionalBranch[];
  currentIndex: number; // -1 when no branch is rendered
  currentEl: Element | null;
};

function chooseLoopConditionalBranch(
  branches: LoopConditionalBranch[],
  evalOne: (expr: string) => unknown,
): number
{
  for (let i = 0; i < branches.length; i++)
  {
    const b = branches[i];
    if (b.type === "else") return i;
    try
    {
      if (evalOne(b.condition)) return i;
    } catch
    {
      // Treat evaluation errors as false so subsequent branches can match.
    }
  }
  return -1;
}

function renderLoopConditionalBranch(
  branch: LoopConditionalBranch,
): Element
{
  // Wrap in a transparent `<span style="display:contents">` so the rendered
  // branch contributes no layout box and doesn't visually nest its content.
  const wrap = document.createElement("span");
  wrap.style.display = "contents";
  wrap.appendChild(branch.template.content.cloneNode(true));
  return wrap;
}

/**
 * Build a LoopConditionalBranch from an `<if>`/`<else-if>`/`<else>` element.
 * The element's children are moved into a `<template>` so the branch
 * tag itself never participates in further scans/renders.
 */
function buildLoopConditionalBranch(
  el: Element,
  type: "if" | "else-if" | "else",
): LoopConditionalBranch
{
  const tpl = document.createElement("template");
  // Use cloneNode on each child so the original element remains intact
  // until the caller removes it. This avoids any ambiguity with live
  // collections during the surrounding scan loop.
  for (const child of Array.from(el.childNodes))
  {
    tpl.content.appendChild(child.cloneNode(true));
  }
  const condition =
    type === "else"
      ? ""
      : stripBindingBraces(el.getAttribute("condition") || "");
  return { type, condition, template: tpl };
}

/**
 * Walk the cloned loop iteration root, finding `<if>` chains (skipping any
 * `<if>` that lives inside a nested `<for>`) and replacing each chain with
 * a comment placeholder + the chosen branch (or nothing). Stores the chain
 * on the placeholder so future updates can swap branches.
 */
function resolveLoopConditionals(
  root: Element,
  context: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>,
  ) => unknown,
  evalOne?: BoundEvaluator,
): void
{
  const chooser: (expr: string) => unknown =
    evalOne ?? ((expr) => evaluateExpression(expr, context));
  // Loop because resolving an outer chain inserts a new branch subtree that
  // may itself contain further `<if>` chains we still need to process.
  // querySelectorAll returns a static snapshot; re-querying each iteration
  // picks up any newly-attached `<if>` nodes.
  // Guard against pathological infinite loops just in case.
  let safety = 10000;
  while (safety-- > 0)
  {
    let target: Element | null = null;
    const candidates = root.querySelectorAll(IF_TAG);
    for (let i = 0; i < candidates.length; i++)
    {
      const candidate = candidates[i];
      if (!candidate.parentNode) continue;
      if (hasForAncestor(candidate)) continue;
      target = candidate;
      break;
    }
    if (!target) return;

    const branches: LoopConditionalBranch[] = [];
    branches.push(buildLoopConditionalBranch(target, "if"));

    const toRemove: Element[] = [];
    let cur = target.nextElementSibling;
    while (cur)
    {
      if (cur.tagName === ELSE_IF_TAG)
      {
        branches.push(buildLoopConditionalBranch(cur, "else-if"));
        toRemove.push(cur);
        cur = cur.nextElementSibling;
      } else if (cur.tagName === ELSE_TAG)
      {
        branches.push(buildLoopConditionalBranch(cur, "else"));
        toRemove.push(cur);
        break;
      } else
      {
        break;
      }
    }

    const placeholder = document.createComment(" <if> (loop) ");
    const meta: LoopConditionalMeta = {
      branches,
      currentIndex: -1,
      currentEl: null,
    };
    (placeholder as any)[LOOP_COND_META] = meta;

    target.parentNode!.insertBefore(placeholder, target);
    target.remove();
    for (const r of toRemove) r.remove();

    const chosenIdx = chooseLoopConditionalBranch(branches, chooser);
    if (chosenIdx >= 0)
    {
      const rendered = renderLoopConditionalBranch(branches[chosenIdx]);
      placeholder.parentNode!.insertBefore(rendered, placeholder.nextSibling);
      meta.currentIndex = chosenIdx;
      meta.currentEl = rendered;
    }
    // Continue the while loop; the chosen branch may contain inner <if>
    // chains that will now be discovered on the next iteration. Their
    // bindings will be processed by the caller's processElementBindings
    // pass after resolveLoopConditionals returns.
  }
}

/**
 * On reuse, find any loop-conditional placeholders in the subtree and
 * re-evaluate them. If the chosen branch is unchanged, do nothing — the
 * normal updateElementBindings recursion will refresh bindings inside the
 * rendered branch. If it changed, swap in a fresh branch and process it.
 *
 * `rowCtx` is the per-row handler context of the element being reused, so
 * handlers created inside a freshly swapped branch capture THIS row's
 * item/index — not the shared pass context that later rows will mutate.
 */
function updateLoopConditionals(
  placeholders: readonly Comment[],
  context: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>,
  ) => unknown,
  evalOne: BoundEvaluator,
  rowCtx: Record<string, unknown>,
  getSetup?: () => LoopHandlerSetup,
): boolean
{
  let structureChanged = false;
  for (const placeholder of placeholders)
  {
    const meta = (placeholder as any)[LOOP_COND_META] as LoopConditionalMeta;
    const newIdx = chooseLoopConditionalBranch(meta.branches, evalOne);
    if (newIdx === meta.currentIndex) continue;
    structureChanged = true;

    if (meta.currentEl && meta.currentEl.parentNode)
    {
      meta.currentEl.remove();
    }
    meta.currentEl = null;
    meta.currentIndex = -1;

    if (newIdx >= 0)
    {
      const el = renderLoopConditionalBranch(meta.branches[newIdx]);
      placeholder.parentNode!.insertBefore(el, placeholder.nextSibling);
      meta.currentIndex = newIdx;
      meta.currentEl = el;
      // Resolve any nested <if> chains and process bindings on the freshly
      // rendered subtree using the current per-item context.
      resolveLoopConditionals(el, context, evaluateExpression, evalOne);
      processElementBindings(
        el,
        context,
        evaluateExpression,
        evalOne,
        rowCtx,
        getSetup,
      );
    }
  }
  return structureChanged;
}

/**
 * Processes {bindings} within an element and its children.
 * Also transforms inline event handlers (onclick, etc.) to work with component scope.
 * Stores original templates for efficient updates during keyed diffing.
 *
 * Walks the whole subtree in one flat pass (the previous per-child
 * recursion re-walked every text node once per ancestor level) and seeds
 * the element's binding cache with what it finds, so the first
 * updateElementBindings call doesn't need its own collection walk.
 */
function processElementBindings(
  element: Element,
  context: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>,
  ) => unknown,
  evalOnePass?: BoundEvaluator,
  handlerCtx?: Record<string, unknown>,
  getSetupIn?: () => LoopHandlerSetup,
): void
{
  const texts: LoopBindingCache["texts"] = [];
  const boundAttrs: LoopBindingCache["attrs"] = [];
  const conds: Comment[] = [];

  // Pass-scoped fast evaluator: reuse the caller's when provided (renderLoop
  // shares one across ALL rows of a pass); otherwise build one bound to this
  // context in legacy per-call-refill mode.
  const evalOne: BoundEvaluator =
    evalOnePass ??
    (typeof (evaluateExpression as Partial<DirectiveEvaluator>).forContext ===
      "function"
      ? (evaluateExpression as DirectiveEvaluator).forContext(context)
      : (expr) => evaluateExpression(expr, context));

  // Context captured by event handlers. renderLoop passes the small per-row
  // object; standalone callers fall back to the evaluation context.
  const hCtx = handlerCtx ?? context;
  let fallbackSetup: LoopHandlerSetup | null = null;
  const getSetup =
    getSetupIn ??
    ((): LoopHandlerSetup =>
      (fallbackSetup ??= createLoopHandlerSetupFromContext(context)));

  // With a full BoundEvaluator, resolve compiled Functions per template once
  // (shared across every row of the loop) and invoke them directly.
  const canInvoke = evalOne.invoke !== undefined && evalOne.sig !== undefined;

  const evalSegment = (
    fns: (Function | null)[] | null,
    exprs: string[],
    j: number,
  ): unknown =>
  {
    const fn = fns !== null ? fns[j] : null;
    return fn !== null ? evalOne.invoke!(fn, exprs[j]) : evalOne(exprs[j]);
  };

  const processOne = (el: Element): void =>
  {
    // Process attributes - first replace bindings, then transform event handlers
    for (const attr of Array.from(el.attributes))
    {
      // Event-handler attributes (onclick, $on:…) are compiled as JavaScript by
      // transformLoopEventHandlers. We must NOT string-interpolate per-item data
      // into their source here: splicing an untrusted item value straight into
      // handler code is a code-injection vector. Their {expr} bindings are turned
      // into live, scoped sub-expressions by the handler compiler instead.
      if (EVENT_ATTRIBUTE_SET.has(attr.name) || isEventDirective(attr.name))
      {
        continue;
      }

      if (attr.value.includes("{"))
      {
        // Store original template for keyed diffing reuse
        const parsed = parseBindingTemplate(attr.value);
        (attr as any).__originalTemplate = attr.value;
        const fns = canInvoke ? compiledFnsFor(parsed, evalOne) : null;
        let next = parsed.statics[0];
        for (let j = 0; j < parsed.exprs.length; j++)
        {
          const result = evalSegment(fns, parsed.exprs, j);
          // Serialize objects/arrays to JSON so child components can parse
          // them. This allows email="{item}" to pass the actual object, not
          // "[object Object]".
          next +=
            (result !== null && typeof result === "object"
              ? JSON.stringify(result)
              : String(result ?? "")) + parsed.statics[j + 1];
        }
        attr.value = next;
        boundAttrs.push({ attr, parsed });
      }
    }

    // Transform inline event handlers (onclick, etc.) into proper event listeners.
    transformLoopEventHandlers(el, hCtx, getSetup);
  };

  processOne(element);
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
  );
  let node: Node | null;
  while ((node = walker.nextNode()))
  {
    if (node.nodeType === Node.TEXT_NODE)
    {
      const textContent = node.textContent;
      if (textContent && textContent.includes("{"))
      {
        // Store original template for keyed diffing reuse
        const parsed = parseBindingTemplate(textContent);
        (node as any).__originalTemplate = textContent;
        const fns = canInvoke ? compiledFnsFor(parsed, evalOne) : null;
        let next = parsed.statics[0];
        for (let j = 0; j < parsed.exprs.length; j++)
        {
          next +=
            String(evalSegment(fns, parsed.exprs, j) ?? "") +
            parsed.statics[j + 1];
        }
        node.textContent = next;
        texts.push({ node: node as Text, parsed });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE)
    {
      processOne(node as Element);
    } else if ((node as any)[LOOP_COND_META])
    {
      conds.push(node as Comment);
    }
  }

  (element as any)[BINDING_CACHE] = { texts, attrs: boundAttrs, conds };
}

/**
 * Rewrites `{expr}` occurrences inside a loop event-handler into live JS
 * sub-expressions evaluated in the handler's scope:
 *
 *   onclick="removeTodo({todo.id})"  ->  removeTodo((todo.id))
 *
 * The loop variables (item/index) and component state are already in scope when
 * the handler runs, so `todo.id` is READ as a value rather than having the
 * item's data string-spliced into the handler source. That closes the
 * code-injection path that string interpolation opened when list data was
 * untrusted. Handlers written with plain expressions — `removeTodo(todo.id)`,
 * the form used throughout the docs — need no braces and are unaffected.
 */
function bindHandlerExpressions(code: string): string
{
  return code.replace(/\{([^}]+)\}/g, (_, expr) => `(${expr.trim()})`);
}

/**
 * Transforms inline event handlers (onclick, oninput, etc.) on an element
 * into proper event listeners with access to component scope.
 *
 * Also handles $on: event directives with key/event modifiers:
 *   $on:keyup.enter="submit()"
 *   $on:click.prevent="handleClick()"
 *
 * Handler bodies are plain JavaScript with the loop's item/index variables and
 * component state in scope: onclick="removeTodo(todo.id)". Any `{expr}` inside a
 * handler is turned into a scoped sub-expression (see bindHandlerExpressions),
 * never string-interpolated into the source.
 *
 * `rowCtx` is the small per-row context the handler closes over; `getSetup`
 * resolves the pass-shared handler setup lazily so rows without handlers
 * never pay for it.
 */
function transformLoopEventHandlers(
  element: Element,
  rowCtx: Record<string, unknown>,
  getSetup: () => LoopHandlerSetup,
): void
{
  // Scan the element's OWN attributes (usually 0–3) for handler names
  // rather than probing getAttribute for every known event attribute —
  // per-row that turned into tens of thousands of misses on large lists.
  const attrs = element.attributes;
  let handlerAttrs: { name: string; value: string }[] | null = null;
  for (let i = 0; i < attrs.length; i++)
  {
    const name = attrs[i].name;
    if (EVENT_ATTRIBUTE_SET.has(name) || isEventDirective(name))
    {
      (handlerAttrs ??= []).push({ name, value: attrs[i].value });
    }
  }
  if (!handlerAttrs) return;

  const setup = getSetup();
  for (const { name, value } of handlerAttrs)
  {
    // Process standard inline event handlers (onclick, oninput, etc.)
    if (EVENT_ATTRIBUTE_SET.has(name))
    {
      // Remove the attribute so browser doesn't try to eval it globally
      element.removeAttribute(name);

      // onclick → click
      const eventName = name.slice(2);

      // Create event listener with component context
      const handler = createLoopEventHandler(
        bindHandlerExpressions(value),
        rowCtx,
        setup,
      );
      if (handler)
      {
        element.addEventListener(eventName, handler);
      }
    } else
    {
      // $on: event directive with modifiers
      processLoopEventDirective(element, name, value, rowCtx, setup);
    }
  }
}

/**
 * Processes one $on: event directive on a loop-rendered element.
 *
 * Syntax: $on:event.modifier1.modifier2="handler()"
 *
 * Examples:
 *   $on:keyup.enter="submit()"
 *   $on:click.ctrl.prevent="handleClick()"
 */
function processLoopEventDirective(
  element: Element,
  attrName: string,
  attrValue: string,
  rowCtx: Record<string, unknown>,
  setup: LoopHandlerSetup,
): void
{
  const parsed = parseEventDirective(attrName);
  if (!parsed) return;

  const handlerCode = bindHandlerExpressions(attrValue);
  element.removeAttribute(attrName);

  // Create the base event handler with loop context
  const baseHandler = createLoopEventHandler(handlerCode, rowCtx, setup);
  if (!baseHandler) return;

  // Wrap the handler with modifier checks
  const modifiedHandler = createModifiedHandler(baseHandler, parsed);

  // Get listener options (passive, capture, once)
  const options = getListenerOptions(parsed.eventModifiers);

  // Add the event listener
  element.addEventListener(parsed.eventName, modifiedHandler, options);
}

/**
 * Extracted function definitions per script content. Every row of a loop
 * shares one component script, so parsing it once (not once per handler
 * per row) is a large win when creating many rows.
 */
const funcDefsCache = new Map<string, string>();

/**
 * Compiled handler functions keyed by their full source body. The body
 * embeds the handler code and every destructured name, so body equality
 * implies the compiled function is interchangeable — only the runtime
 * arguments (context, reactiveState) differ between rows. This collapses
 * one `new Function` compile per handler per row into one per distinct
 * handler shape.
 */
const loopHandlerFnCache = new Map<string, Function>();
const MAX_HANDLER_FN_CACHE = 1000;

/**
 * Everything loop event-handler creation needs that is identical across the
 * rows of one render pass: the generated destructuring prelude (name lists,
 * function definitions, sync-back), the event-bus helpers, the prototype
 * for per-row handler contexts, and a per-pass compiled-handler cache.
 *
 * The old path rebuilt all of this — including a multi-KB function body
 * string embedding the component's function definitions — once per handler
 * per row, which dominated large list creation.
 */
type LoopHandlerSetup = {
  reactiveState: Record<string, unknown>;
  /** Prototype for per-row handler contexts: state functions + markers. */
  proto: Record<string, unknown>;
  /** Function-body text before/after the handler code. */
  bodyPrefix: string;
  bodySuffix: string;
  emit: (eventName: string, data?: unknown) => void;
  listen: Function;
  /** Compiled handler per code string for this pass (null = failed). */
  fnCache: Map<string, Function | null>;
};

/**
 * Builds the pass-shared handler setup from the component state and the
 * loop's variable names. Mirrors the name derivation the per-row builder
 * used: state entries split into variables (destructured as `let` with
 * sync-back) and functions; loop variables destructured as `const` from the
 * per-row context, dropping any that a state variable would shadow (the
 * state destructure wins, as it did with the old spread-based context).
 */
function createLoopHandlerSetup(
  state: Record<string, unknown>,
  loopVarNamesIn: readonly string[],
): LoopHandlerSetup
{
  const scriptContent = ((state as any).__scriptContent as string) || "";
  const hasScriptContent = scriptContent.trim().length > 0;
  const hasModuleScripts = (state as any).__hasModuleScripts === true;

  const stateVarNames: string[] = [];
  const funcNames: string[] = [];
  for (const key of Object.keys(state))
  {
    if (key.startsWith("__")) continue;
    if (typeof state[key] === "function") funcNames.push(key);
    else stateVarNames.push(key);
  }

  const loopVarNames = loopVarNamesIn.filter(
    (name) => !stateVarNames.includes(name),
  );
  // A loop variable shadows a same-named state function in the row context,
  // so it must not also appear in the function destructure.
  const visibleFuncNames = funcNames.filter(
    (name) => !loopVarNamesIn.includes(name),
  );

  let funcDefs = "";
  let destructureFuncs = "";
  if (hasModuleScripts || !hasScriptContent)
  {
    // Module-script functions are reactive (or no source is available):
    // destructure them from the handler context.
    destructureFuncs =
      visibleFuncNames.length > 0
        ? `const { ${visibleFuncNames.join(", ")} } = context;`
        : "";
  } else
  {
    // Regular scripts: re-create functions from script content so they
    // work with the local variables that will be synced back to state.
    const cached = funcDefsCache.get(scriptContent);
    if (cached !== undefined)
    {
      funcDefs = cached;
    } else
    {
      funcDefs = extractFunctionDefinitions(scriptContent, []);
      funcDefsCache.set(scriptContent, funcDefs);
    }
  }

  const destructureLoopVars =
    loopVarNames.length > 0
      ? `const { ${loopVarNames.join(", ")} } = context;`
      : "";
  const destructureStateVars =
    stateVarNames.length > 0
      ? `let { ${stateVarNames.join(", ")} } = reactiveState;`
      : "";
  // Sync state variables back after execution (only for regular scripts)
  const syncBack =
    !hasModuleScripts && stateVarNames.length > 0
      ? stateVarNames.map((key) => `reactiveState.${key} = ${key};`).join(" ")
      : "";

  const componentId =
    ((state as any).__componentId as string) || "anonymous";
  const eventBusHelpers = createEventBusHelpers(componentId);

  const proto: Record<string, unknown> = {
    __reactiveState__: state,
    __scriptContent__: scriptContent,
    __componentUrl__: (state as any).__componentUrl || "",
  };
  for (const name of funcNames)
  {
    proto[name] = state[name];
  }

  return {
    reactiveState: state,
    proto,
    bodyPrefix: `"use strict";
      ${destructureLoopVars}
      ${destructureStateVars}
      ${destructureFuncs}
      ${funcDefs}
      `,
    bodySuffix: `;
      ${syncBack}`,
    emit: eventBusHelpers.$emit,
    listen: eventBusHelpers.$listen,
    fnCache: new Map(),
  };
}

/**
 * Fallback setup builder for processElementBindings calls that don't come
 * from renderLoop (none in the current codebase): derives the loop-variable
 * names the way the old per-row builder did — context keys that aren't
 * internal markers, functions, or state entries.
 */
function createLoopHandlerSetupFromContext(
  context: Record<string, unknown>,
): LoopHandlerSetup
{
  const state =
    (context.__reactiveState__ as Record<string, unknown>) ?? context;
  const loopVarNames = Object.keys(context).filter(
    (key) =>
      !key.startsWith("__") &&
      typeof context[key] !== "function" &&
      !Object.prototype.hasOwnProperty.call(state, key),
  );
  return createLoopHandlerSetup(state, loopVarNames);
}

/**
 * Resolves the compiled handler Function for `code` under `setup`.
 * Two cache levels: the per-pass map (code → fn) makes repeat rows a single
 * Map hit; the global body-keyed map dedupes compiles across passes and
 * components (byte-identical bodies are interchangeable — only the runtime
 * arguments differ).
 */
function getLoopHandlerFn(
  code: string,
  setup: LoopHandlerSetup,
): Function | null
{
  let fn = setup.fnCache.get(code);
  if (fn !== undefined) return fn;

  const fnBody = setup.bodyPrefix + code + setup.bodySuffix;
  fn = loopHandlerFnCache.get(fnBody) ?? null;
  if (fn === null)
  {
    try
    {
      if (loopHandlerFnCache.size >= MAX_HANDLER_FN_CACHE)
      {
        const oldest = loopHandlerFnCache.keys().next().value;
        if (oldest !== undefined) loopHandlerFnCache.delete(oldest);
      }
      fn = compileHandler(
        ["event", "context", "reactiveState", "$emit", "$listen"],
        fnBody,
        false,
        `handler:${code}`,
      );
      loopHandlerFnCache.set(fnBody, fn);
    } catch (e)
    {
      warn(
        `Failed to create loop event handler: ${code} — ${(e as Error).message}`,
      );
      fn = null;
    }
  }
  setup.fnCache.set(code, fn);
  return fn;
}

/**
 * Creates an event handler function for a loop-rendered element. The handler
 * reads state variables live from the reactive state and the loop variables
 * from `rowCtx` — the small per-row context renderLoop keeps refreshed on
 * element reuse, so the handler always sees the row's CURRENT item/index.
 */
function createLoopEventHandler(
  code: string,
  rowCtx: Record<string, unknown>,
  setup: LoopHandlerSetup,
): ((event: Event) => void) | null
{
  const fn = getLoopHandlerFn(code, setup);
  if (!fn) return null;

  const { reactiveState, emit, listen } = setup;
  return (event: Event) =>
  {
    try
    {
      // If the element also has $bind for this event, sync its value into
      // state first so the handler reads the current value, not the previous
      syncBindBeforeHandler(event);

      fn(event, rowCtx, reactiveState, emit, listen);
    } catch (e)
    {
      error(`Error in loop event handler: ${code}`, null, e);
    }
  };
}

/**
 * Updates all conditionals with the current state.
 */
export function updateConditionals(
  conditionals: ConditionalDescriptor[][],
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>,
  ) => unknown,
): void
{
  for (const group of conditionals)
  {
    updateConditionalGroup(group, state, evaluateExpression);
  }
}

/**
 * Updates a single conditional group.
 */
function updateConditionalGroup(
  group: ConditionalDescriptor[],
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>,
  ) => unknown,
): void
{
  // Remove all currently visible elements
  for (const desc of group)
  {
    if (desc.element.parentNode)
    {
      desc.element.remove();
    }
  }

  // Find the first matching condition
  for (const desc of group)
  {
    let shouldShow = false;

    if (desc.type === "else")
    {
      shouldShow = true; // $else always shows if we reach it
    } else
    {
      const result = evaluateExpression(desc.condition, state);
      shouldShow = Boolean(result);
    }

    if (shouldShow)
    {
      // Insert this element after the placeholder
      desc.placeholder.parentNode?.insertBefore(
        desc.element,
        desc.placeholder.nextSibling,
      );
      break; // Only show the first matching condition
    }
  }
}

/**
 * Updates all $show elements with the current state.
 */
export function updateShowElements(
  showElements: ShowDescriptor[],
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>,
  ) => unknown,
): void
{
  for (const desc of showElements)
  {
    const result = evaluateExpression(desc.expression, state);
    const shouldShow = Boolean(result);

    desc.element.style.display = shouldShow ? desc.originalDisplay : "none";
  }
}

/**
 * Sets up two-way bindings and returns a registry for state→input sync.
 *
 * Returns a function that should be called when state changes to update
 * all bound input elements with the new state values.
 */
export function setupTwoWayBindings(
  bindings: TwoWayBindingDescriptor[],
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>,
  ) => unknown,
): (changedKey?: string) => void
{
  // Registry mapping state keys to bound elements
  const registry: TwoWayBindingRegistry = new Map();

  for (const binding of bindings)
  {
    setupTwoWayBinding(binding, state, evaluateExpression, registry);
  }

  // Return a function that updates all bound inputs when state changes
  return (changedKey?: string) =>
  {
    updateBoundInputs(registry, state, evaluateExpression, changedKey);
  };
}

/**
 * Sets up a single two-way binding and registers it for state→input sync.
 */
function setupTwoWayBinding(
  binding: TwoWayBindingDescriptor,
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>,
  ) => unknown,
  registry: TwoWayBindingRegistry,
): void
{
  const element = binding.element;
  const { raw, path, isContentEditable } = binding;

  // Get initial value from state and set on element
  const initialValue = evaluateExpression(raw, state);
  setElementValue(element, initialValue, isContentEditable);

  // Register this binding for state→input sync
  // The key is the first part of the path (top-level state key)
  const stateKey = path[0];
  if (!registry.has(stateKey))
  {
    registry.set(stateKey, []);
  }
  registry.get(stateKey)!.push({
    element: element as HTMLElement,
    path,
    isContentEditable,
  });

  // Also register for the full raw expression (handles nested paths)
  if (raw !== stateKey && !registry.has(raw))
  {
    registry.set(raw, []);
  }
  if (raw !== stateKey)
  {
    registry.get(raw)!.push({
      element: element as HTMLElement,
      path,
      isContentEditable,
    });
  }

  // Determine event type based on element
  const eventType = getInputEventType(element);

  // Track if we're currently updating from state to prevent feedback loops
  let isUpdatingFromState = false;

  // Store the flag on the element so updateBoundInputs can set it
  (element as any).__isUpdatingFromState = () => isUpdatingFromState;
  (element as any).__setUpdatingFromState = (val: boolean) =>
  {
    isUpdatingFromState = val;
  };

  // Sync input value → state. Also exposed on the element so inline event
  // handlers for the same event (e.g. onchange alongside $bind on a select)
  // can pull the value into state before user code reads it — inline
  // handlers are registered earlier, so without this they'd see the
  // previous value. See syncBindBeforeHandler in utils/directives.
  const syncToState = (): void =>
  {
    // Skip if this change was triggered by state→input sync
    if (isUpdatingFromState) return;

    const newValue = getElementValue(element, isContentEditable);
    setNestedValue(state, path, newValue);
  };
  (element as any).__ladrillosBindSync = { eventType, sync: syncToState };

  // Listen for changes and update state
  element.addEventListener(eventType, syncToState);
}

/**
 * Updates all bound input elements when state changes.
 * Called by the reactivity system when a state property is modified.
 *
 * @param registry - Map of state keys to bound elements
 * @param state - Current reactive state
 * @param evaluateExpression - Function to evaluate expressions against state
 * @param changedKey - The key that changed (optional, updates all if not provided)
 */
function updateBoundInputs(
  registry: TwoWayBindingRegistry,
  state: Record<string, unknown>,
  evaluateExpression: (
    expr: string,
    context: Record<string, unknown>,
  ) => unknown,
  changedKey?: string,
): void
{
  // If a specific key changed, only update elements bound to that key
  const keysToUpdate = changedKey ? [changedKey] : Array.from(registry.keys());

  for (const key of keysToUpdate)
  {
    const bindings = registry.get(key);
    if (!bindings) continue;

    for (const binding of bindings)
    {
      const { element, path, isContentEditable } = binding;

      // Get the current value from state
      const rawExpression = path.join(".");
      const currentValue = evaluateExpression(rawExpression, state);

      // Set flag to prevent feedback loop (input event → state update → input update)
      const setFlag = (element as any).__setUpdatingFromState;
      if (setFlag) setFlag(true);

      // Update the element with the new value
      setElementValue(element, currentValue, isContentEditable);

      // Clear the flag after a microtask to ensure the event handler sees it
      if (setFlag)
      {
        queueMicrotask(() => setFlag(false));
      }
    }
  }
}

/**
 * Gets the appropriate event type for an input element.
 */
function getInputEventType(element: HTMLElement): string
{
  if (element instanceof HTMLSelectElement)
  {
    return "change";
  }
  if (element instanceof HTMLInputElement)
  {
    const type = element.type.toLowerCase();
    if (type === "checkbox" || type === "radio")
    {
      return "change";
    }
  }
  return "input";
}

/**
 * Gets the value from an input element.
 */
function getElementValue(
  element: HTMLElement,
  isContentEditable?: boolean,
): unknown
{
  if (isContentEditable)
  {
    return element.textContent || "";
  }

  if (element instanceof HTMLInputElement)
  {
    const type = element.type.toLowerCase();
    if (type === "checkbox")
    {
      return element.checked;
    }
    if (type === "number" || type === "range")
    {
      return element.valueAsNumber;
    }
    return element.value;
  }

  if (element instanceof HTMLSelectElement)
  {
    if (element.multiple)
    {
      return Array.from(element.selectedOptions).map((o) => o.value);
    }
    return element.value;
  }

  if (element instanceof HTMLTextAreaElement)
  {
    return element.value;
  }

  return (element as any).value ?? "";
}

/**
 * Sets the value on an input element.
 */
function setElementValue(
  element: HTMLElement,
  value: unknown,
  isContentEditable?: boolean,
): void
{
  if (isContentEditable)
  {
    element.textContent = String(value ?? "");
    return;
  }

  if (element instanceof HTMLInputElement)
  {
    const type = element.type.toLowerCase();
    if (type === "checkbox")
    {
      element.checked = Boolean(value);
    } else if (type === "radio")
    {
      // A radio group binds ONE state value across several inputs. Writing
      // `element.value = state` would rewrite each radio's own value and
      // collapse the group; the bound value selects a member instead.
      element.checked = element.value === String(value ?? "");
    } else
    {
      element.value = String(value ?? "");
    }
    return;
  }

  if (element instanceof HTMLSelectElement)
  {
    element.value = String(value ?? "");
    return;
  }

  if (element instanceof HTMLTextAreaElement)
  {
    element.value = String(value ?? "");
    return;
  }

  (element as any).value = value;
}

/**
 * Sets a nested value in an object using a path array.
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown,
): void
{
  let current: any = obj;

  for (let i = 0; i < path.length - 1; i++)
  {
    const key = path[i];
    if (!(key in current) || typeof current[key] !== "object")
    {
      current[key] = {};
    }
    current = current[key];
  }

  current[path[path.length - 1]] = value;
}

/**
 * Checks if a value is iterable.
 */
function isIterable(value: unknown): boolean
{
  return (
    value !== null &&
    value !== undefined &&
    (Array.isArray(value) ||
      typeof (value as any)[Symbol.iterator] === "function" ||
      typeof value === "object")
  );
}
