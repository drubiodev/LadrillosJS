import { BindingDescriptor, ScriptElement } from "../../types";
import { EVENT_ATTRIBUTES } from "../../utils/jsevents";
import { syncBindBeforeHandler } from "../../utils/directives";
import
{
  ALLOWED_GLOBALS,
  BLOCKED_GLOBALS,
  RESERVED_WORDS,
} from "../../utils/sandbox";
import
{
  isEventDirective,
  parseEventDirective,
  createModifiedHandler,
  getListenerOptions,
} from "../../utils/keyModifiers";
import
{
  expressionError,
  scriptError,
  warn,
  getComponentContext,
  ErrorCode,
} from "../../utils/devWarnings";
import { createReactiveState } from "./reactivity";
import
{
  frameworkHelperNames,
  createFrameworkHelpers,
} from "../helpers/frameworkHelpers";
import { eventBusHelperNames, createEventBusHelpers } from "../events/eventBus";
import { getPendingLazyContent } from "../builtins/lazyElement";

/**
 * Gets the actual HTMLElement from either a direct element or a ShadowRoot.
 */
const getHostElement = (host: HTMLElement | ShadowRoot): HTMLElement =>
  host instanceof ShadowRoot ? (host.host as HTMLElement) : host;

/**
 * Main entry point for processing component scripts.
 *
 * 1. Extracts all variables and functions from <script> tags
 * 2. Applies attribute overrides (attributes take precedence over defaults)
 * 3. Creates attribute-only state entries (for attributes without script vars)
 * 4. Creates a reactive state that auto-updates DOM on changes
 * 5. Binds inline event handlers (onclick, etc.) to work with reactive state
 * 6. Evaluates and applies template bindings like {name} or {greet()}
 *
 * @param host - The component's root element or shadow root
 * @param scripts - Script elements from the component
 * @param bindings - Template bindings to connect to state
 * @param attributeOverrides - Attributes from HTML that override script defaults
 * @param onStateChange - Optional callback when state changes (for directive updates)
 * @param deferBindings - If true, don't apply bindings immediately (for module script support)
 * @param componentUrl - The absolute URL of the component (for resolving relative paths in registerComponent)
 * @param componentId - Optional unique ID for this component instance (for event bus cleanup)
 * @param refs - Optional refs Map (for $refs access in scripts)
 * @param templateBindings - Variable names from template bindings (for auto-prop access in scripts)
 * @returns The reactive state object - changes trigger automatic DOM updates
 */
export async function loadScripts(
  host: HTMLElement | ShadowRoot,
  scripts: ScriptElement[],
  bindings: BindingDescriptor[],
  attributeOverrides: Record<string, unknown> = {},
  onStateChange?: () => void,
  deferBindings: boolean = false,
  componentUrl?: string,
  componentId?: string,
  refs?: Map<string, HTMLElement>,
  templateBindings: string[] = [],
): Promise<Record<string, unknown>>
{
  const componentHost = getHostElement(host);
  const initialState: Record<string, unknown> = {};

  // Collect all script content for re-execution in event handlers
  const allScriptContent = scripts.map((s) => s.content).join("\n");

  // Apply attribute overrides FIRST - these are the prop values from usage
  // This allows: <my-component title="Data"> to make title="Data" available
  // before any script code runs
  for (const [key, value] of Object.entries(attributeOverrides))
  {
    initialState[key] = value;
  }

  // Add internal properties for loop event handlers BEFORE creating reactive state
  // These are prefixed with __ so they're skipped during destructuring
  (initialState as any).__scriptContent = allScriptContent;
  (initialState as any).__componentUrl = componentUrl;
  (initialState as any).__componentId = componentId;

  // Create reactive state - changes automatically update the DOM!
  // Start with attribute overrides so script code can reference them
  const reactiveState = createReactiveState(
    initialState,
    bindings,
    (binding, state) => updateSingleBinding(binding, state),
    onStateChange,
  );

  // Execute scripts with __state__ transformation
  // Scripts run with attribute values already in state
  // `let title = "Default"` becomes `__state__.title ??= "Default"`
  // Since title is already "Data" from attributes, ??= won't overwrite it
  // Derived values like `const test = ${title}...` will use the attribute value
  //
  // Suspend per-key reactive binding updates while the scripts run. Scripts
  // assign __state__.x one declaration at a time, but a single binding can
  // reference several variables (e.g. class="btn--{variant} btn--{size}").
  // Updating that binding the moment the first variable is assigned would try
  // to evaluate a variable declared later in the same script, throwing a
  // spurious ReferenceError. We apply every binding together once execution
  // finishes (see applyBindings below / applyBindingsDeferred for modules).
  (reactiveState as any).__suspendReactivity = true;
  try
  {
    for (const script of scripts)
    {
      executeScriptWithReactiveState(
        script.content,
        reactiveState,
        componentUrl,
        componentId,
        componentHost, // Pass host element for $host access
        refs, // Pass refs for $refs access
        templateBindings, // Pass template bindings so auto-props are accessible
      );
    }
  } finally
  {
    (reactiveState as any).__suspendReactivity = false;
  }

  // Store reactive state on host element (for debugging and event handlers)
  (componentHost as any).__state = reactiveState;
  // Store script content for event handlers that need to be set up later
  (componentHost as any).__scriptContent = allScriptContent;
  // Store component URL for correct path resolution in framework helpers
  (componentHost as any).__componentUrl = componentUrl;
  // Store component ID for event bus cleanup
  (componentHost as any).__componentId = componentId;

  // Make onclick="handleClick()" work by binding to reactive state
  // Pass script content so functions can be re-created with current state
  // NOTE: We defer this until after module scripts are loaded
  if (!deferBindings)
  {
    transformInlineEventHandlers(
      host,
      reactiveState,
      allScriptContent,
      componentHost,
    );

    // Apply initial bindings with current state values
    applyBindings(bindings, reactiveState);
  }

  return reactiveState;
}

/**
 * Apply bindings after all state is ready (including module scripts).
 * This should be called after module scripts have been executed.
 */
export function applyBindingsDeferred(
  host: HTMLElement | ShadowRoot,
  bindings: BindingDescriptor[],
  state: Record<string, unknown>,
): void
{
  const componentHost = getHostElement(host);
  const allScriptContent = (componentHost as any).__scriptContent || "";

  // Set up event handlers now that all state is available
  transformInlineEventHandlers(host, state, allScriptContent, componentHost);

  // Apply bindings with complete state
  applyBindings(bindings, state);
}

// ============================================================================
// Event Handler Processing
// ============================================================================

/**
 * Finds all inline event handlers (onclick, oninput, etc.) and replaces them
 * with proper event listeners that have access to the component's scope.
 *
 * This is what makes vanilla HTML syntax work:
 *   <button onclick="handleClick()">  →  just works!
 *
 * Also handles $on: directives with key/event modifiers:
 *   <input $on:keyup.enter="submit()">  →  calls submit() only on Enter key
 *   <button $on:click.prevent="handleClick()">  →  prevents default and calls handler
 *
 * NOTE: Skips elements inside $for loops - those are handled by the loop renderer.
 */
function transformInlineEventHandlers(
  host: HTMLElement | ShadowRoot,
  state: Record<string, unknown>,
  scriptContent: string,
  componentHost: HTMLElement,
): void
{
  // Wire up handlers in `host` AND inside any pending <lazy> content
  // fragments. Lazy children are detached so a host-only walk would miss
  // them; addEventListener on detached nodes works fine and survives the
  // later DOM move when the lazy strategy fires.
  const roots: Array<HTMLElement | ShadowRoot | DocumentFragment> = [
    host,
    ...getPendingLazyContent(host),
  ];
  for (const root of roots)
  {
    const elements = Array.from(root.querySelectorAll("*"));

    for (const element of elements)
    {
      // Skip elements that are inside a $for template or have $for themselves
      // These will be processed by the loop renderer with proper loop context
      if (isInsideForLoop(element))
      {
        continue;
      }

      // Process standard inline event handlers (onclick, oninput, etc.)
      for (const attrName of EVENT_ATTRIBUTES)
      {
        const handlerCode = element.getAttribute(attrName);

        if (handlerCode)
        {
          // Remove attribute so the browser doesn't try to eval it globally
          element.removeAttribute(attrName);

          // onclick → click
          const eventName = attrName.slice(2);

          // Create a real event listener with component context
          const handler = createVanillaEventHandler(
            handlerCode,
            state,
            scriptContent,
            componentHost,
          );
          if (handler)
          {
            element.addEventListener(eventName, handler);
          }
        }
      }

      // Process $on: event directives with modifiers
      processEventDirectives(element, state, scriptContent, componentHost);
    }
  }
}

/**
 * Processes $on: event directives on an element.
 *
 * Syntax: $on:event.modifier1.modifier2="handler()"
 *
 * Examples:
 *   $on:keyup.enter="submit()"
 *   $on:click.ctrl.prevent="handleClick()"
 *   $on:keydown.escape="closeModal()"
 *   $on:keydown.w="moveUp()"
 */
function processEventDirectives(
  element: Element,
  state: Record<string, unknown>,
  scriptContent: string,
  componentHost: HTMLElement,
): void
{
  // Get all attributes that start with $on:
  const attrs = Array.from(element.attributes);
  const eventAttrs = attrs.filter((attr) => isEventDirective(attr.name));

  for (const attr of eventAttrs)
  {
    const parsed = parseEventDirective(attr.name);
    if (!parsed) continue;

    const handlerCode = attr.value;
    element.removeAttribute(attr.name);

    // Create the base event handler with component context
    const baseHandler = createVanillaEventHandler(
      handlerCode,
      state,
      scriptContent,
      componentHost,
    );

    if (!baseHandler) continue;

    // Wrap the handler with modifier checks
    const modifiedHandler = createModifiedHandler(baseHandler, parsed);

    // Get listener options (passive, capture, once)
    const options = getListenerOptions(parsed.eventModifiers);

    // Add the event listener
    element.addEventListener(parsed.eventName, modifiedHandler, options);
  }
}

/**
 * Checks if an element is inside a loop template.
 * Elements inside loops need special handling for their event handlers
 * (the loop renderer attaches them with the per-iteration scope).
 *
 * Recognizes both:
 *   - the legacy `$for` attribute directive
 *   - the `<for>` built-in element
 */
function isInsideForLoop(element: Element): boolean
{
  // Check the element itself
  if (element.hasAttribute("$for") || element.tagName === "FOR")
  {
    return true;
  }

  // Check ancestors
  let current: Element | null = element.parentElement;
  while (current)
  {
    if (current.hasAttribute("$for") || current.tagName === "FOR")
    {
      return true;
    }
    current = current.parentElement;
  }

  return false;
}

/**
 * Creates an event handler function that executes the original handler code
 * with access to component variables, functions, and safe globals like alert().
 *
 * The handler has access to the REACTIVE state, so assignments like:
 *   onclick="count++"
 * will automatically update the DOM.
 *
 * Functions are RE-CREATED each time with current state values, so:
 *   onclick="handleClick()" will see the latest `name` value, not the original.
 */
function createVanillaEventHandler(
  code: string,
  state: Record<string, unknown>,
  scriptContent: string,
  componentHost?: HTMLElement,
): ((event: Event) => void) | null
{
  try
  {
    // Get component URL from host for framework helpers path resolution
    const componentUrl = (componentHost as any)?.__componentUrl;
    const componentId = (componentHost as any)?.__componentId;

    // Include safe globals like alert, console, Math, JSON, etc.
    const allowed = getAllowedGlobalsWithValues(componentUrl, componentId);

    // Block dangerous globals like window, document, fetch, etc.
    const safeBlocked = getSafeBlockedGlobals();

    // Build the function parameters: event + blocked + allowed + "state" reference + "$refs" + "$host"
    // The reactive-state param is named `__state__` (not `state`) so a user
    // variable named `state` doesn't collide with it (which would produce
    // `let { state } = state;` — a "already declared" SyntaxError).
    // `$host` must be a parameter here (not just a script-scope closure)
    // because script functions are RE-CREATED from source in this handler
    // scope, losing their original closure over the script's $host.
    const allKeys = [
      "event",
      "__state__",
      "$refs",
      "$host",
      ...safeBlocked,
      ...allowed.keys,
    ];

    // Get ALL state keys (includes both script variables AND attribute values)
    const allStateKeys = Object.keys(state);

    // Separate functions from variables in state
    const funcNames = allStateKeys.filter(
      (key) => typeof state[key] === "function",
    );
    const varNames = allStateKeys.filter(
      (key) => typeof state[key] !== "function",
    );

    // Check if we have module script functions by looking for __moduleScript marker
    // Module scripts set this marker when they're reactive functions that manage state directly
    // Regular script functions need to be re-created each time to get fresh variable bindings
    const hasModuleScriptFunctions = (state as any).__hasModuleScripts === true;

    // Always use `let` for variables so inline handlers like onclick="count++"
    // can mutate them. Any mutations are synced back to reactive state below
    // when the inline code references the variable.
    const destructureVars =
      varNames.length > 0 ? `let { ${varNames.join(", ")} } = __state__;` : "";

    // For module scripts: destructure functions from state (they're reactive)
    // For regular scripts: DON'T destructure - we'll recreate them via funcDefs
    const destructureFuncs = hasModuleScriptFunctions
      ? funcNames.length > 0
        ? `const { ${funcNames.join(", ")} } = __state__;`
        : ""
      : "";

    // Extract function definitions from script content to re-create them
    // with current variable values (not original closure values).
    // For module scripts: skip all functions (they're reactive and manage state directly)
    // For regular scripts: recreate ALL functions to get fresh variable bindings
    const functionsToSkip = hasModuleScriptFunctions ? funcNames : [];
    const rawFuncDefs = extractFunctionDefinitions(
      scriptContent,
      functionsToSkip,
    );

    // Transform function definitions to use state.varName for variable access
    // This ensures async callbacks (like .then()) write directly to reactive state
    // instead of local destructured copies that won't be synced back
    const funcDefs = transformFunctionDefsToStateAccess(rawFuncDefs, varNames);

    // Sync back any variables the inline handler code references.
    // Inline code operates on local `let` copies (from the destructure above),
    // so we assign them back to reactive state after the handler runs.
    // Functions in regular scripts are re-created via funcDefs with fresh
    // bindings, and module-script functions write directly to state via
    // __state__ — neither needs this sync-back. Only raw inline code does.
    const codeReferencesVars = varNames.some((v) =>
      new RegExp(`\\b${v}\\b`).test(code),
    );
    const syncBack = !codeReferencesVars
      ? ""
      : varNames
        .filter((key) => new RegExp(`\\b${key}\\b`).test(code))
        .map((key) => `__state__.${key} = ${key};`)
        .join(" ");

    // Check if the code or any function definitions use async/await
    const isAsync =
      /\bawait\b/.test(code) ||
      /\bawait\b/.test(funcDefs) ||
      /\basync\b/.test(funcDefs);

    // Add sourceURL so DevTools shows the component name instead of VM123:5
    const sourceUrl = componentUrl || "ladrillos-event-handler";

    // For async handlers, wrap in try/finally to ensure sync-back happens after await
    // For sync handlers, sync-back runs at the end as before
    const fnBody = isAsync
      ? `"use strict"; ${destructureVars} ${destructureFuncs} ${funcDefs} try { await (async () => { ${code} })(); } finally { ${syncBack} }
//# sourceURL=${sourceUrl}`
      : `"use strict"; ${destructureVars} ${destructureFuncs} ${funcDefs} ${code}; ${syncBack}
//# sourceURL=${sourceUrl}`;

    // Use AsyncFunction constructor for async handlers
    const AsyncFunction = Object.getPrototypeOf(
      async function () { },
    ).constructor;
    const fn = isAsync
      ? new AsyncFunction(...allKeys, fnBody)
      : new Function(...allKeys, fnBody);

    return (event: Event) =>
    {
      try
      {
        // If the element also has $bind for this event, sync its value into
        // state first so the handler reads the current value, not the previous
        syncBindBeforeHandler(event);

        // Get $refs from component host dynamically (they're set after script load)
        // Already wrapped in Proxy by webcomponent.ts for dot notation access
        const $refs = componentHost
          ? (componentHost as any).__refs || new Map()
          : new Map();

        const allValues = [
          event,
          state, // Pass reactive state
          $refs, // Pass $refs Map
          componentHost, // Pass $host (the component element)
          ...safeBlocked.map(() => undefined), // Shadow dangerous globals
          ...allowed.values, // Inject safe globals
        ];

        // Handle both sync and async handlers
        const result = fn(...allValues);

        // If the handler returns a promise, catch any async errors
        if (result && typeof result.catch === "function")
        {
          result.catch((e: Error) =>
          {
            const ctx = {
              tagName: componentHost?.tagName?.toLowerCase(),
              sourcePath: (state as any).__componentUrl,
              instanceId: (state as any).__componentId,
            };
            expressionError(code, e, {
              context: ctx.tagName ? ctx : getComponentContext(),
              errorCode: ErrorCode.EVENT_HANDLER_FAILED,
            });
          });
        }
      } catch (e)
      {
        // Build context from state metadata (more reliable than global context
        // since multiple components can initialize in parallel)
        const ctx = {
          tagName: componentHost?.tagName?.toLowerCase(),
          sourcePath: (state as any).__componentUrl,
          instanceId: (state as any).__componentId,
        };
        expressionError(code, e as Error, {
          context: ctx.tagName ? ctx : getComponentContext(),
          errorCode: ErrorCode.EVENT_HANDLER_FAILED,
        });
      }
    };
  } catch (e)
  {
    // Build context from component host for accurate error attribution
    // Use component host's tagName directly (more reliable than global context
    // which can be overwritten by parallel component initialization)
    const ctx = componentHost?.tagName
      ? {
        tagName: componentHost.tagName.toLowerCase(),
        sourcePath: (state as any).__componentUrl,
        instanceId: (state as any).__componentId,
      }
      : null;
    // Pass ctx explicitly to override global context
    warn(
      `Failed to create event handler: ${code} — ${(e as Error).message}`,
      ctx,
    );
    return null;
  }
}

/**
 * Cache of extracted function-definition strings.
 *
 * `extractFunctionDefinitions` scans the ENTIRE component script with several
 * regex passes and brace-matching. In the loop path it is called once per
 * rendered row (via `createLoopEventHandler`), so a `<for>` over N items with
 * inline handlers re-parsed the full script N times on the initial render. The
 * result depends only on (content, skipFunctions), so we memoize it. The cache
 * is bounded with FIFO eviction so long-lived apps with many distinct
 * components don't grow it without limit.
 */
const funcDefsCache = new Map<string, string>();
const MAX_FUNC_DEFS_CACHE = 500;

/**
 * Extracts function definitions from script content.
 * These will be re-created in the event handler context with current state values.
 *
 * Memoized: the output is a pure function of (content, skipFunctions).
 *
 * @param content - The script content to extract functions from
 * @param skipFunctions - Function names to skip (already in state as reactive functions)
 */
export function extractFunctionDefinitions(
  content: string,
  skipFunctions: string[] = [],
): string
{
  const cacheKey = skipFunctions.join(",") + "\u0000" + content;
  const cached = funcDefsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const result = computeFunctionDefinitions(content, skipFunctions);

  if (funcDefsCache.size >= MAX_FUNC_DEFS_CACHE)
  {
    const oldest = funcDefsCache.keys().next().value;
    if (oldest !== undefined) funcDefsCache.delete(oldest);
  }
  funcDefsCache.set(cacheKey, result);
  return result;
}

function computeFunctionDefinitions(
  content: string,
  skipFunctions: string[] = [],
): string
{
  const functions: string[] = [];

  // Match regular and async function declarations: function foo() {...}
  const funcRegex =
    /(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/g;
  let match;

  while ((match = funcRegex.exec(content)) !== null)
  {
    const funcName = match[1];

    // Skip functions that already exist in state (reactive module script functions)
    if (skipFunctions.includes(funcName))
    {
      continue;
    }

    // Find the matching closing brace
    const funcDef = extractBracedBlock(content, match.index);
    if (funcDef)
    {
      functions.push(funcDef);
    }
  }

  // Match arrow functions: const/let foo = (...) => {...} or const/let foo = async (...) => {...}
  const arrowRegex =
    /(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g;

  while ((match = arrowRegex.exec(content)) !== null)
  {
    const funcName = match[1];

    // Skip functions that already exist in state (reactive module script functions)
    if (skipFunctions.includes(funcName))
    {
      continue;
    }

    // Find the matching closing brace for the arrow function body
    const startIndex = match.index;
    const bodyStart = content.indexOf("{", startIndex + match[0].length - 1);
    const funcDef = extractBracedBlock(content, startIndex, bodyStart);
    if (funcDef)
    {
      functions.push(funcDef);
    }
  }

  // Join with semicolons to ensure proper statement separation
  // Arrow functions especially need this since they don't always have trailing semicolons
  return (
    functions.map((f) => f.trim()).join(";\n") +
    (functions.length > 0 ? ";" : "")
  );
}

/**
 * Extracts a complete braced block from content starting at startIndex.
 * Handles nested braces and strings correctly.
 */
function extractBracedBlock(
  content: string,
  startIndex: number,
  braceStart?: number,
): string | null
{
  let braceCount = 0;
  let endIndex = startIndex;
  let inString = false;
  let stringChar = "";
  let foundFirstBrace = false;

  const searchStart = braceStart ?? startIndex;

  for (let i = searchStart; i < content.length; i++)
  {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : "";

    // Handle string detection (skip braces inside strings)
    if ((char === '"' || char === "'" || char === "`") && prevChar !== "\\")
    {
      if (!inString)
      {
        inString = true;
        stringChar = char;
      } else if (char === stringChar)
      {
        inString = false;
      }
    }

    if (!inString)
    {
      if (char === "{")
      {
        braceCount++;
        foundFirstBrace = true;
      }
      if (char === "}") braceCount--;

      if (foundFirstBrace && braceCount === 0 && char === "}")
      {
        endIndex = i + 1;
        break;
      }
    }
  }

  if (braceCount !== 0) return null;
  return content.slice(startIndex, endIndex);
}

// ============================================================================
// Script Parsing & Variable Extraction
// ============================================================================

/**
 * Executes script content in a sandboxed environment and extracts
 * all declared variables and functions.
 *
 * Example script:
 *   let name = 'LadrillosJS';
 *   function greet() { return `Hello ${name}`; }
 *
 * Returns: Map { 'name' => 'LadrillosJS', 'greet' => [Function] }
 *
 * @param content - The script content to execute
 * @param componentUrl - The component's URL for resolving relative paths in helpers
 * @param componentId - The component's unique ID for event bus cleanup
 */
function extractScriptMembers(
  content: string,
  componentUrl?: string,
  componentId?: string,
): Map<string, unknown>
{
  const members = new Map<string, unknown>();

  try
  {
    const variableNames = extractVariableNames(content);
    const functionNames = extractFunctionNames(content);
    const allNames = [...variableNames, ...functionNames];

    // Always execute the script content (for side effects like console.log)
    // Only return members if there are any to extract
    // Add sourceURL so DevTools shows the component name instead of VM123:5
    const sourceUrl = componentUrl || "ladrillos-component";
    const wrappedScript = `
      "use strict";
      ${content}
      return { ${allNames.join(", ")} };
//# sourceURL=${sourceUrl}
    `;

    // Set up the sandboxed execution environment
    const allowed = getAllowedGlobalsWithValues(componentUrl, componentId);
    const safeBlocked = getSafeBlockedGlobals();

    const allKeys = [...safeBlocked, ...allowed.keys];
    const allValues = [
      ...safeBlocked.map(() => undefined), // Shadow dangerous globals
      ...allowed.values, // Inject safe globals
    ];

    const fn = new Function(...allKeys, wrappedScript);
    const result = fn(...allValues);

    for (const [key, value] of Object.entries(result))
    {
      members.set(key, value);
    }
  } catch (e)
  {
    scriptError("Error extracting script members", e as Error);
  }

  return members;
}

/**
 * Extracts ONLY variable values from script content, without running side effects.
 * This is used in Phase 1 to get default values before reactive state is created.
 *
 * Unlike extractScriptMembers, this function:
 * - Only extracts variable declarations and their values
 * - Stubs out $listen and $emit to prevent side effects
 * - Does NOT extract functions (they'll be handled in Phase 2)
 *
 * @param content - The script content to parse
 */
function extractScriptMembersValuesOnly(content: string): Map<string, unknown>
{
  const members = new Map<string, unknown>();

  try
  {
    const variableNames = extractVariableNames(content);
    const functionNames = extractFunctionNames(content);
    const allNames = [...variableNames, ...functionNames];

    if (allNames.length === 0)
    {
      return members;
    }

    const wrappedScript = `
      "use strict";
      ${content}
      return { ${allNames.join(", ")} };
    `;

    // Stub out $listen and $emit to prevent side effects during value extraction
    const stubListen = () => () => { }; // Returns unsubscribe function
    const stubEmit = () => { };

    // Minimal globals needed for value extraction
    const safeGlobals = [
      "console",
      "Math",
      "JSON",
      "Date",
      "Array",
      "Object",
      "String",
      "Number",
      "Boolean",
    ];
    const safeGlobalValues = safeGlobals.map(
      (name) => (globalThis as any)[name],
    );

    const allKeys = [...safeGlobals, "$listen", "$emit"];
    const allValues = [...safeGlobalValues, stubListen, stubEmit];

    const fn = new Function(...allKeys, wrappedScript);
    const result = fn(...allValues);

    for (const [key, value] of Object.entries(result))
    {
      members.set(key, value);
    }
  } catch (e)
  {
    // Silently handle errors - Phase 2 will re-execute with proper error handling
  }

  return members;
}

/**
 * Executes script content with __state__ transformation for reactivity.
 * This is Phase 2: runs after reactive state is created, so $listen callbacks
 * and other side effects can access the reactive state.
 *
 * The script is transformed so that:
 * - Variable declarations become __state__.varName = value
 * - Variable references become __state__.varName
 * - Callbacks capture __state__ reference (the reactive proxy)
 *
 * @param content - The script content to execute
 * @param reactiveState - The reactive state proxy
 * @param componentUrl - The component's URL for framework helpers
 * @param componentId - The component's ID for event bus cleanup
 * @param hostElement - The component's host element (for $host access)
 * @param refs - Optional refs Map (for $refs access)
 * @param templateBindings - Variable names from template bindings (auto-props)
 */
function executeScriptWithReactiveState(
  content: string,
  reactiveState: Record<string, unknown>,
  componentUrl?: string,
  componentId?: string,
  hostElement?: HTMLElement,
  refs?: Map<string, HTMLElement>,
  templateBindings: string[] = [],
): void
{
  try
  {
    const variableNames = extractVariableNames(content);

    // Combine script variables with template bindings for transformation
    // This allows scripts to reference auto-bound props like {title} -> title
    const allVariables = [...new Set([...variableNames, ...templateBindings])];

    // Transform the script to use __state__ for variable access
    const transformedContent = transformToStateAccess(content, allVariables);

    const sourceUrl = componentUrl || "ladrillos-component";
    const wrappedScript = `
      "use strict";
      ${transformedContent}
//# sourceURL=${sourceUrl}
    `;

    // Set up the sandboxed execution environment
    const allowed = getAllowedGlobalsWithValues(componentUrl, componentId);
    const safeBlocked = getSafeBlockedGlobals();

    // Add __state__, $host, and $refs as parameters
    const allKeys = [
      "__state__",
      "$host",
      "$refs",
      ...safeBlocked,
      ...allowed.keys,
    ];
    const allValues = [
      reactiveState, // __state__ points to reactive proxy
      hostElement, // $host points to the component's host element
      refs, // $refs points to the refs Map
      ...safeBlocked.map(() => undefined), // Shadow dangerous globals
      ...allowed.values, // Inject safe globals
    ];

    const fn = new Function(...allKeys, wrappedScript);
    fn(...allValues);
  } catch (e)
  {
    scriptError("Error executing script with reactive state", e as Error);
  }
}

/**
 * Masks all function/arrow-function bodies in the source code with whitespace
 * (preserving newlines so line numbers stay aligned). This allows regex-based
 * extraction passes to reliably target only top-level declarations and
 * references, ignoring variables declared inside callbacks like
 * `$listen(..., (e) => { const x = ... })`.
 *
 * Limitations:
 *   - Method shorthand on object literals (`obj = { foo() {} }`) is not
 *     detected as a function body. Such usage is uncommon at top level in
 *     component scripts, and any declarations inside will be (harmlessly)
 *     treated as top-level.
 */
function maskFunctionBodies(code: string): string
{
  const chars = code.split("");
  const len = code.length;
  let i = 0;
  let braceDepth = 0;
  let pendingFnBody = false;
  const fnStartDepths: number[] = [];
  const inFn = () => fnStartDepths.length > 0;

  const maskRange = (from: number, to: number) =>
  {
    for (let k = from; k < to; k++)
    {
      const ch = chars[k];
      if (ch !== "\n" && ch !== "\r") chars[k] = " ";
    }
  };

  const skipLineComment = (start: number): number =>
  {
    let j = start;
    while (j < len && code[j] !== "\n") j++;
    return j;
  };
  const skipBlockComment = (start: number): number =>
  {
    let j = start + 2;
    while (j < len - 1 && !(code[j] === "*" && code[j + 1] === "/")) j++;
    return Math.min(len, j + 2);
  };
  const skipString = (start: number, quote: string): number =>
  {
    let j = start + 1;
    while (j < len)
    {
      if (code[j] === "\\")
      {
        j += 2;
        continue;
      }
      if (code[j] === quote) return j + 1;
      if (code[j] === "\n") return j; // unterminated; bail
      j++;
    }
    return j;
  };
  const skipTemplate = (start: number): number =>
  {
    let j = start + 1;
    while (j < len)
    {
      if (code[j] === "\\")
      {
        j += 2;
        continue;
      }
      if (code[j] === "`") return j + 1;
      if (code[j] === "$" && code[j + 1] === "{")
      {
        j += 2;
        let depth = 1;
        while (j < len && depth > 0)
        {
          const c = code[j];
          if (c === "`")
          {
            j = skipTemplate(j);
            continue;
          }
          if (c === '"' || c === "'")
          {
            j = skipString(j, c);
            continue;
          }
          if (c === "/" && code[j + 1] === "/")
          {
            j = skipLineComment(j);
            continue;
          }
          if (c === "/" && code[j + 1] === "*")
          {
            j = skipBlockComment(j);
            continue;
          }
          if (c === "{") depth++;
          else if (c === "}") depth--;
          j++;
        }
        continue;
      }
      j++;
    }
    return j;
  };
  const isRegexContext = (idx: number): boolean =>
  {
    let j = idx - 1;
    while (j >= 0 && /\s/.test(code[j])) j--;
    if (j < 0) return true;
    const c = code[j];
    if ("([{,;:!&|?=+-*%^~<>".includes(c)) return true;
    return /\b(return|typeof|delete|void|in|of|new|instanceof|throw)$/.test(
      code.slice(0, j + 1),
    );
  };
  const skipRegex = (start: number): number =>
  {
    let j = start + 1;
    let inClass = false;
    while (j < len)
    {
      const c = code[j];
      if (c === "\\")
      {
        j += 2;
        continue;
      }
      if (c === "[") inClass = true;
      else if (c === "]") inClass = false;
      else if (c === "/" && !inClass)
      {
        j++;
        break;
      } else if (c === "\n") break;
      j++;
    }
    while (j < len && /[a-zA-Z]/.test(code[j])) j++;
    return j;
  };

  while (i < len)
  {
    const c = code[i];

    if (c === "/" && code[i + 1] === "/")
    {
      const end = skipLineComment(i);
      if (inFn()) maskRange(i, end);
      i = end;
      continue;
    }
    if (c === "/" && code[i + 1] === "*")
    {
      const end = skipBlockComment(i);
      if (inFn()) maskRange(i, end);
      i = end;
      continue;
    }
    if (c === '"' || c === "'")
    {
      const end = skipString(i, c);
      if (inFn()) maskRange(i, end);
      i = end;
      continue;
    }
    if (c === "`")
    {
      const end = skipTemplate(i);
      if (inFn()) maskRange(i, end);
      i = end;
      continue;
    }
    if (c === "/" && isRegexContext(i))
    {
      const end = skipRegex(i);
      if (inFn()) maskRange(i, end);
      i = end;
      continue;
    }

    if (c === "{")
    {
      braceDepth++;
      if (pendingFnBody)
      {
        fnStartDepths.push(braceDepth);
        pendingFnBody = false;
      } else if (inFn())
      {
        chars[i] = " ";
      }
      i++;
      continue;
    }
    if (c === "}")
    {
      const closingFnBody =
        inFn() && fnStartDepths[fnStartDepths.length - 1] === braceDepth;
      if (closingFnBody)
      {
        fnStartDepths.pop();
        // Keep `}` un-masked so brace counting outside still works
      } else if (inFn())
      {
        chars[i] = " ";
      }
      braceDepth--;
      i++;
      continue;
    }

    if (c === "=" && code[i + 1] === ">")
    {
      if (inFn())
      {
        chars[i] = " ";
        chars[i + 1] = " ";
      } else
      {
        // Look ahead skipping whitespace/comments for `{` (concise body has
        // no declarations to worry about, so we only track block bodies).
        let j = i + 2;
        while (j < len)
        {
          const cc = code[j];
          if (/\s/.test(cc))
          {
            j++;
            continue;
          }
          if (cc === "/" && code[j + 1] === "/")
          {
            j = skipLineComment(j);
            continue;
          }
          if (cc === "/" && code[j + 1] === "*")
          {
            j = skipBlockComment(j);
            continue;
          }
          break;
        }
        if (code[j] === "{") pendingFnBody = true;
      }
      i += 2;
      continue;
    }

    if (/[a-zA-Z_$]/.test(c))
    {
      const start = i;
      while (i < len && /[a-zA-Z0-9_$]/.test(code[i])) i++;
      const word = code.slice(start, i);
      if (inFn())
      {
        maskRange(start, i);
      } else if (word === "function")
      {
        pendingFnBody = true;
      }
      continue;
    }

    if (inFn() && c !== "\n" && c !== "\r")
    {
      chars[i] = " ";
    }
    i++;
  }

  return chars.join("");
}

/**
 * Finds variable declarations: let x = ..., const y = ..., var z = ...
 * Only returns TOP-LEVEL declarations — declarations inside callbacks,
 * arrow function bodies, and other nested scopes are intentionally skipped
 * so they remain real local variables after script transformation.
 *
 * Exported so webcomponent.ts can use it for observedAttributes.
 */
export function extractVariableNames(content: string): string[]
{
  const masked = maskFunctionBodies(content);
  const names: string[] = [];
  const regex = /(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;
  let match;

  while ((match = regex.exec(masked)) !== null)
  {
    names.push(match[1]);
  }

  return names;
}

/**
 * Finds function declarations: function foo() {}, async function bar() {}
 * Only returns top-level declarations (consistent with extractVariableNames).
 */
function extractFunctionNames(content: string): string[]
{
  const masked = maskFunctionBodies(content);
  const names: string[] = [];
  const regex = /(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  let match;

  while ((match = regex.exec(masked)) !== null)
  {
    names.push(match[1]);
  }

  return names;
}

// ============================================================================
// State Access Transformation
// ============================================================================

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string
{
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Transforms variable declarations and accesses to use a __state__ object.
 *
 * This transformation allows script functions and callbacks (like $listen) to
 * read/write from the reactive state instead of local closure variables.
 *
 * Transforms:
 *   let messages = [];
 *   $listen("event", (data) => { messages = [...messages, data]; });
 *
 * Into:
 *   __state__.messages = [];
 *   $listen("event", (data) => { __state__.messages = [...__state__.messages, data]; });
 *
 * This is similar to what Svelte's compiler does, but at runtime.
 */
function transformToStateAccess(code: string, variables: string[]): string
{
  if (variables.length === 0) return code;

  // Step 1: Protect regular string literals (single and double quotes) with placeholders
  // Template literals are handled separately to allow transforming expressions inside ${}
  const strings: string[] = [];
  let protected_code = code.replace(
    /(["'])(?:(?!\1)[^\\]|\\.)*\1/g,
    (match) =>
    {
      strings.push(match);
      return `__STRING_PLACEHOLDER_${strings.length - 1}__`;
    },
  );

  // Step 2: Handle template literals specially - transform expressions inside ${}
  // Match template literals and process their interpolations
  protected_code = protected_code.replace(
    /`(?:[^`\\$]|\\.|\$(?!\{)|\$\{[^}]*\})*`/g,
    (templateLiteral) =>
    {
      // Transform expressions inside ${...}
      return templateLiteral.replace(/\$\{([^}]+)\}/g, (match, expr) =>
      {
        // Transform variable references in the expression
        let transformedExpr = expr;
        for (const varName of variables)
        {
          const pattern = new RegExp(
            `(?<![^.]\\.)(?<!__state__\\.)\\b${escapeRegex(
              varName,
            )}\\b(?!\\s*[:(])`,
            "g",
          );
          transformedExpr = transformedExpr.replace(
            pattern,
            `__state__.${varName}`,
          );
        }
        return `\${${transformedExpr}}`;
      });
    },
  );

  // Step 3: Transform top-level variable declarations
  // `let x = value;` → `__state__.x ??= value;`
  // Use ??= to preserve attribute overrides (attributes win over script defaults)
  for (const varName of variables)
  {
    const declRegex = new RegExp(
      `\\b(let|const|var)\\s+(${escapeRegex(varName)})\\s*=`,
      "g",
    );
    protected_code = protected_code.replace(
      declRegex,
      `__state__.${varName} ??=`,
    );
  }

  // Step 4: Replace all standalone variable references with __state__.varName
  // Do this iteratively to handle all occurrences
  for (const varName of variables)
  {
    // This regex matches the variable name that is:
    // - NOT preceded by a single dot (property access like foo.bar)
    //   but IS allowed after spread operator (...)
    // - NOT preceded by __state__. (already transformed)
    // - IS a word boundary on both sides
    // - NOT followed by : (object key) or ( (function declaration)
    //
    // The lookbehind (?<![^.]\.) means: not preceded by a dot that itself
    // is not preceded by a dot. This allows ...varName but blocks .varName
    const pattern = new RegExp(
      `(?<![^.]\\.)(?<!__state__\\.)\\b${escapeRegex(varName)}\\b(?!\\s*[:(])`,
      "g",
    );

    protected_code = protected_code.replace(pattern, `__state__.${varName}`);
  }

  // Step 5: Restore regular string literals
  let transformed = protected_code;
  for (let i = 0; i < strings.length; i++)
  {
    transformed = transformed.replace(
      `__STRING_PLACEHOLDER_${i}__`,
      strings[i],
    );
  }

  return transformed;
}

/**
 * Transforms function definitions to use state.varName for variable access.
 * This ensures async callbacks (like .then()) write directly to reactive state
 * instead of local destructured copies.
 *
 * Example:
 *   const searchData = async () => { data = result; }
 * Becomes:
 *   const searchData = async () => { state.data = result; }
 *
 * This is different from transformToStateAccess (which uses __state__) because
 * event handlers pass the state as "state" parameter.
 */
function transformFunctionDefsToStateAccess(
  funcDefs: string,
  variables: string[],
): string
{
  if (!funcDefs || variables.length === 0) return funcDefs;

  // Step 1: Protect string literals from transformation
  const strings: string[] = [];
  let protected_code = funcDefs.replace(
    /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g,
    (match) =>
    {
      strings.push(match);
      return `__STRING_PLACEHOLDER_${strings.length - 1}__`;
    },
  );

  // Step 2: Handle template literals - transform expressions inside ${}
  protected_code = protected_code.replace(
    /`(?:[^`\\$]|\\.|\$(?!\{)|\$\{[^}]*\})*`/g,
    (templateLiteral) =>
    {
      return templateLiteral.replace(/\$\{([^}]+)\}/g, (match, expr) =>
      {
        let transformedExpr = expr;
        for (const varName of variables)
        {
          const pattern = new RegExp(
            `(?<![^.]\\.)(?<!__state__\\.)\\b${escapeRegex(
              varName,
            )}\\b(?!\\s*[:(])`,
            "g",
          );
          transformedExpr = transformedExpr.replace(
            pattern,
            `__state__.${varName}`,
          );
        }
        return `\${${transformedExpr}}`;
      });
    },
  );

  // Step 3: Replace variable references with state.varName
  // Skip function parameter names by not transforming inside parameter lists
  for (const varName of variables)
  {
    // Match variable that is:
    // - NOT preceded by a dot (property access)
    // - NOT preceded by __state__. (already transformed)
    // - IS a word boundary
    // - NOT followed by : (object key) or ( (function declaration)
    const pattern = new RegExp(
      `(?<![^.]\\.)(?<!__state__\\.)\\b${escapeRegex(varName)}\\b(?!\\s*[:(])`,
      "g",
    );
    protected_code = protected_code.replace(pattern, `__state__.${varName}`);
  }

  // Step 4: Restore string literals
  let transformed = protected_code;
  for (let i = 0; i < strings.length; i++)
  {
    transformed = transformed.replace(
      `__STRING_PLACEHOLDER_${i}__`,
      strings[i],
    );
  }

  return transformed;
}

// ============================================================================
// Security & Sandboxing Helpers
// ============================================================================

/**
 * Returns blocked globals, excluding JS reserved words that can't be
 * used as function parameter names (like 'with', 'class', etc.)
 */
function getSafeBlockedGlobals(): readonly string[]
{
  return BLOCKED_GLOBALS.filter((name) => !RESERVED_WORDS.has(name));
}

/**
 * Gets safe globals (alert, console, Math, JSON, etc.) with their actual values.
 * Also includes framework helpers like registerComponent, $use, $emit, $listen.
 * These are passed into the sandbox so component code feels like vanilla JS.
 *
 * @param componentUrl - The component's URL for resolving relative paths in helpers
 * @param componentId - The component's unique ID for event bus cleanup
 */
function getAllowedGlobalsWithValues(
  componentUrl?: string,
  componentId?: string,
):
  {
    keys: string[];
    values: unknown[];
  }
{
  const keys: string[] = [];
  const values: unknown[] = [];

  // Add standard allowed globals (console, Math, JSON, etc.)
  for (const name of ALLOWED_GLOBALS)
  {
    if (name in globalThis)
    {
      keys.push(name);
      values.push((globalThis as any)[name]);
    }
  }

  // Add framework helpers bound to component URL for correct path resolution
  const helpers = createFrameworkHelpers(componentUrl || window.location.href);
  keys.push(...frameworkHelperNames);
  values.push(
    helpers.registerComponent,
    helpers.registerComponents,
    helpers.$use,
  );

  // Add event bus helpers bound to component ID for automatic cleanup
  const eventBusHelpers = createEventBusHelpers(componentId || "anonymous");
  keys.push(...eventBusHelperNames);
  values.push(eventBusHelpers.$emit, eventBusHelpers.$listen);

  return { keys, values };
}

// ============================================================================
// Template Binding Evaluation
// ============================================================================

/**
 * Evaluates a binding expression like {name} or {name.toUpperCase()}
 * in the component's context.
 */
/**
 * Cache of compiled expression evaluators.
 *
 * Compiling an expression with `new Function()` is expensive (parse + JIT) and
 * was previously done on EVERY evaluation. In the directive update path this
 * meant recompiling the same expression once per item per render — e.g. an
 * `$for` over 1000 rows recompiled its bindings 1000+ times on each update.
 * Caching the compiled function turns repeat evaluations into a plain call.
 *
 * The cache key combines the positional parameter names (the current state
 * keys) with the expression source, since the compiled function's parameters
 * are positional. The blocked globals are constant for the page lifetime, so
 * they don't need to participate in the key.
 */
const evaluatorCache = new Map<string, Map<string, Function>>();
const MAX_EVALUATOR_SIGNATURES = 100;
const MAX_EVALUATOR_CACHE = 5000;

/** Matches strings usable as a JS function parameter name (no hyphens, etc.). */
const IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/;

// Blocked globals never change at runtime, so compute the param list and the
// matching `undefined` argument array once and reuse them.
let cachedBlockedGlobals: readonly string[] | null = null;
let cachedBlockedUndefined: undefined[] | null = null;

function evaluateExpression(
  expression: string,
  state: Record<string, unknown>,
): unknown
{
  try
  {
    // Only valid JS identifiers can be `new Function` parameter names. Some
    // state keys come from DOM attributes, which may be hyphenated (e.g.
    // "data-id", "is-open"); passing those as params would throw a SyntaxError
    // and break EVERY binding on the component. They can't be referenced in
    // expressions anyway, so drop them (and their values) here.
    const allKeys = Object.keys(state);
    const keys: string[] = [];
    const stateValues: unknown[] = [];
    for (let i = 0; i < allKeys.length; i++)
    {
      const k = allKeys[i];
      if (IDENTIFIER_RE.test(k))
      {
        keys.push(k);
        stateValues.push(state[k]);
      }
    }

    ensureBlockedGlobals();

    const exprMap = getEvaluatorMap(keys.join(","));
    const fn = getCompiledEvaluator(keys, exprMap, expression);
    return fn(...cachedBlockedUndefined!, ...stateValues);
  } catch (e)
  {
    expressionError(expression, e as Error, {
      context: getComponentContext(),
    });
    return `{${expression}}`; // Return original on error
  }
}

function ensureBlockedGlobals(): readonly string[]
{
  if (cachedBlockedGlobals === null)
  {
    cachedBlockedGlobals = getSafeBlockedGlobals();
    cachedBlockedUndefined = cachedBlockedGlobals.map(() => undefined);
  }
  return cachedBlockedGlobals;
}

/**
 * Returns the per-key-signature expression map for compiled evaluators.
 *
 * The cache is two-level (keysSig -> expression -> fn) so hot paths that
 * evaluate many expressions against one context shape can resolve the
 * signature once and then hit the inner map with the short expression
 * string - hashing the long joined key signature on every evaluation is
 * measurable when a loop update runs thousands of evals per flush.
 */
function getEvaluatorMap(keysSig: string): Map<string, Function>
{
  let exprMap = evaluatorCache.get(keysSig);
  if (!exprMap)
  {
    // Bound the number of distinct context shapes (FIFO eviction).
    if (evaluatorCache.size >= MAX_EVALUATOR_SIGNATURES)
    {
      const oldest = evaluatorCache.keys().next().value;
      if (oldest !== undefined) evaluatorCache.delete(oldest);
    }
    exprMap = new Map();
    evaluatorCache.set(keysSig, exprMap);
  }
  return exprMap;
}

/**
 * Returns the compiled evaluator for `expression` against the given state
 * keys, compiling and caching it on first use.
 *
 * Positional params are [blocked globals..., state keys...]. Only the state
 * keys + expression distinguish one compiled evaluator from another.
 */
function getCompiledEvaluator(
  keys: string[],
  exprMap: Map<string, Function>,
  expression: string,
): Function
{
  let fn = exprMap.get(expression);
  if (!fn)
  {
    // Bound the cache so long-lived apps with many distinct expressions
    // don't grow it without limit (FIFO eviction of the oldest entry).
    if (exprMap.size >= MAX_EVALUATOR_CACHE)
    {
      const oldest = exprMap.keys().next().value;
      if (oldest !== undefined) exprMap.delete(oldest);
    }
    fn = new Function(
      ...cachedBlockedGlobals!,
      ...keys,
      `"use strict"; return ${expression};`,
    );
    exprMap.set(expression, fn);
  }
  return fn;
}

/**
 * Builds a pass-scoped fast evaluator bound to one context object.
 *
 * The generic `evaluateExpression(expr, context)` pays per call for
 * `Object.keys`, identifier filtering, and the cache-key join — noticeable
 * when a loop update evaluates thousands of bindings against one shared
 * context per flush. This factory hoists all of that: keys are extracted
 * once and the argument array is preallocated.
 *
 * Two modes:
 *   - Legacy (no `volatileKeys`): every call refills ALL value slots from
 *     the context, so callers may mutate any context value between calls.
 *   - Static (`volatileKeys` given): all slots are filled once at creation;
 *     only the named volatile slots are refilled — and only when the caller
 *     invokes `refresh()` after mutating them. All other context VALUES
 *     must stay unchanged for the evaluator's lifetime. This is the loop
 *     renderer's mode: state values are constant within a flush, only the
 *     item/index slots change per row.
 *
 * CONTRACT (both modes): the context's KEY SET must not change for the
 * lifetime of the returned evaluator. Callers create one per render pass
 * after all keys (including loop item/index) are present.
 *
 * The returned evaluator also exposes `compile`/`invoke`/`sig` so hot loops
 * can resolve an expression's compiled Function once per template and skip
 * the per-eval cache lookup entirely.
 */
function createContextEvaluator(
  context: Record<string, unknown>,
  volatileKeys?: readonly string[],
): BoundEvaluator
{
  const blocked = ensureBlockedGlobals();

  const allKeys = Object.keys(context);
  const keys: string[] = [];
  for (let i = 0; i < allKeys.length; i++)
  {
    if (IDENTIFIER_RE.test(allKeys[i]))
    {
      keys.push(allKeys[i]);
    }
  }
  const sig = keys.join(",");
  const exprMap = getEvaluatorMap(sig);
  const nBlocked = blocked.length;
  const args: unknown[] = new Array(nBlocked + keys.length).fill(undefined);

  const fillAll = (): void =>
  {
    for (let i = 0; i < keys.length; i++)
    {
      args[nBlocked + i] = context[keys[i]];
    }
  };

  const isStatic = volatileKeys !== undefined;
  let volatileSlots: number[] | null = null;
  let volatileNames: string[] | null = null;
  if (isStatic)
  {
    fillAll();
    volatileSlots = [];
    volatileNames = [];
    for (const name of volatileKeys)
    {
      const idx = keys.indexOf(name);
      if (idx >= 0)
      {
        volatileSlots.push(nBlocked + idx);
        volatileNames.push(name);
      }
    }
  }

  const evaluator = ((expression: string): unknown =>
  {
    try
    {
      const fn = getCompiledEvaluator(keys, exprMap, expression);
      if (!isStatic) fillAll();
      return fn.apply(null, args);
    } catch (e)
    {
      expressionError(expression, e as Error, {
        context: getComponentContext(),
      });
      return `{${expression}}`; // Return original on error
    }
  }) as BoundEvaluator;

  evaluator.sig = sig;
  evaluator.refresh = isStatic
    ? (): void =>
    {
      for (let i = 0; i < volatileSlots!.length; i++)
      {
        args[volatileSlots![i]] = context[volatileNames![i]];
      }
    }
    : fillAll;
  evaluator.compile = (expression: string): Function | null =>
  {
    try
    {
      return getCompiledEvaluator(keys, exprMap, expression);
    } catch (e)
    {
      expressionError(expression, e as Error, {
        context: getComponentContext(),
      });
      return null;
    }
  };
  evaluator.invoke = (fn: Function, expression: string): unknown =>
  {
    try
    {
      if (!isStatic) fillAll();
      return fn.apply(null, args);
    } catch (e)
    {
      expressionError(expression, e as Error, {
        context: getComponentContext(),
      });
      return `{${expression}}`; // Return original on error
    }
  };
  return evaluator;
}

/**
 * Returns true for values that cannot survive a trip through a DOM attribute
 * (which can only hold strings): arrays, objects and functions.
 */
function isNonPrimitive(value: unknown): boolean
{
  return value !== null && (typeof value === "object" || typeof value === "function");
}

/**
 * Detects a "pure" attribute binding where the entire attribute value is a
 * single {expression} with no surrounding literal text (e.g. items={items},
 * but NOT alt="{name} logo"). These are the only bindings eligible to be
 * passed as a typed DOM property instead of a stringified attribute.
 */
function isPureAttributeBinding(descriptor: BindingDescriptor): boolean
{
  if (!descriptor.isAttribute || !descriptor.attributeName) return false;
  if (descriptor.bindings.length !== 1) return false;
  const trimmed = descriptor.original.trim();
  if (!/^\{[\s\S]*\}$/.test(trimmed)) return false;
  return trimmed.slice(1, -1).trim() === descriptor.bindings[0].raw.trim();
}

/**
 * HTML boolean attributes: their presence (not their value) is what matters.
 * `<button disabled>` and `<button disabled="false">` are BOTH disabled, so a
 * binding like disabled="{isDisabled}" must ADD or REMOVE the attribute rather
 * than stringify the boolean. Mirrors how Vue/Lit treat boolean attributes.
 */
const BOOLEAN_ATTRIBUTES = new Set([
  "disabled",
  "checked",
  "readonly",
  "required",
  "selected",
  "hidden",
  "multiple",
  "autofocus",
  "open",
  "novalidate",
  "formnovalidate",
  "inert",
  "reversed",
  "loop",
  "muted",
  "controls",
  "autoplay",
  "playsinline",
  "default",
  "ismap",
  "allowfullscreen",
]);

/**
 * Sets a primitive (string/number/boolean) value onto a single-binding
 * attribute, applying two web-standard conventions:
 *
 *   1. Boolean attributes (disabled, checked, …) toggle presence: truthy adds
 *      the attribute, falsy removes it.
 *   2. `null`/`undefined` removes the attribute entirely, so optional props
 *      (tooltip="{tooltip}", name="{name}") default to absent instead of "".
 *
 * Other primitives are stringified as before, preserving existing behavior.
 */
function setPrimitiveAttribute(
  element: Element,
  name: string,
  value: unknown,
): void
{
  if (BOOLEAN_ATTRIBUTES.has(name))
  {
    if (value) element.setAttribute(name, "");
    else element.removeAttribute(name);
    return;
  }

  if (value === null || value === undefined)
  {
    element.removeAttribute(name);
    return;
  }

  element.setAttribute(name, String(value));
}

/**
 * Updates a single binding with new state values.
 * Called by the reactive system when a dependency changes.
 */
function updateSingleBinding(
  descriptor: BindingDescriptor,
  state: Record<string, unknown>,
): void
{
  // Pure attribute bindings (the whole value is a single {expr}) can preserve
  // the evaluated value's data type. When the value is a non-primitive
  // (array/object/function), assign it as a DOM PROPERTY on the target element
  // instead of stringifying it into an attribute. This mirrors how Lit/Vue
  // pass complex props to custom elements and lets children receive a real
  // array/object instead of "item1,item2,item3".
  if (isPureAttributeBinding(descriptor))
  {
    const element =
      (descriptor as any).element ?? descriptor.node.parentElement;
    const evaluated = evaluateExpression(descriptor.bindings[0].raw, state);

    if (element)
    {
      if (isNonPrimitive(evaluated))
      {
        // Remove the stringy attribute first so a null attributeChangedCallback
        // can't clobber the typed value we set on the next line.
        if (element.hasAttribute?.(descriptor.attributeName!))
        {
          element.removeAttribute(descriptor.attributeName!);
        }
        (element as any)[descriptor.attributeName!] = evaluated;
      } else
      {
        setPrimitiveAttribute(
          element,
          descriptor.attributeName!,
          evaluated,
        );
      }
    }
    return;
  }

  let result = descriptor.original;

  // Evaluate and replace each {expression} in the text
  for (const binding of descriptor.bindings)
  {
    const evaluated = evaluateExpression(binding.raw, state);
    const stringValue = String(evaluated ?? "");
    result = result.replace(`{${binding.raw}}`, stringValue);
  }

  if (descriptor.isAttribute && descriptor.attributeName)
  {
    // Update element attribute
    const element =
      (descriptor as any).element ?? descriptor.node.parentElement;
    if (element)
    {
      element.setAttribute(descriptor.attributeName, result);
    }
  } else
  {
    // Update text node content
    descriptor.node.textContent = result;
  }
}

/**
 * Replaces all {expression} bindings in the template with their evaluated values.
 *
 * Handles both:
 *   - Text nodes: <h1>Hello {name}!</h1>
 *   - Attributes: <img src="{imageUrl}" alt="{name} logo">
 */
function applyBindings(
  bindings: BindingDescriptor[],
  state: Record<string, unknown>,
): void
{
  for (const descriptor of bindings)
  {
    updateSingleBinding(descriptor, state);
  }
}

// ============================================================================
// Expression Evaluator Export
// ============================================================================

/**
 * A pass-scoped evaluator bound to one context object, produced by
 * `DirectiveEvaluator.forContext`. Callable as `(expr) => unknown`; the
 * optional members let hot loops skip per-eval overhead (see
 * `createContextEvaluator` for the mode semantics).
 */
export interface BoundEvaluator
{
  (expr: string): unknown;
  /**
   * Refill argument slots from the context: the volatile slots in static
   * mode, all slots in legacy mode. Static-mode callers MUST call this
   * after mutating a volatile context value.
   */
  refresh?: () => void;
  /** Compiled Function for `expr` under this key set, or null on a syntax error. */
  compile?: (expr: string) => Function | null;
  /** Invoke a Function from `compile` against the current argument slots. */
  invoke?: (fn: Function, expr: string) => unknown;
  /** Key-set signature; compiled Functions are only valid for a matching sig. */
  sig?: string;
}

/**
 * Directive-facing expression evaluator. Callable as
 * `(expr, context) => unknown`; `forContext` additionally builds a
 * pass-scoped fast evaluator bound to one context object (see
 * `createContextEvaluator`) whose key set must not change for the
 * lifetime of the returned function.
 */
export interface DirectiveEvaluator
{
  (expr: string, context: Record<string, unknown>): unknown;
  forContext(
    context: Record<string, unknown>,
    volatileKeys?: readonly string[],
  ): BoundEvaluator;
}

/**
 * Creates and returns an expression evaluator function for use by directives.
 * This allows directives to evaluate expressions like "item.name" or "count > 5"
 * in the context of the component's state.
 */
export function createExpressionEvaluator(): DirectiveEvaluator
{
  const evaluator = evaluateExpression as DirectiveEvaluator;
  evaluator.forContext = createContextEvaluator;
  return evaluator;
}
