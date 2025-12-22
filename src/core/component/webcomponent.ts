import { LadrillosComponent } from "../../types";
import { loadStyles } from "../css/cssParser/cssParser";
import { loadTemplate } from "../html/htmlparser";
import {
  loadScripts,
  extractVariableNames,
  createExpressionEvaluator,
  applyBindingsDeferred,
} from "../js/scriptParser";
import {
  executeModuleScriptsWithReactivity,
  cleanupModuleScripts,
  loadPlainExternalScripts,
  loadExternalStyles,
} from "../js/moduleExecutor";
import { cleanupComponentListeners } from "../events/eventBus";
import {
  scanDirectives,
  scanRefsOnly,
  scanDirectivesWithRefs,
  renderLoops,
  updateConditionals,
  updateShowElements,
  setupTwoWayBindings,
  DirectiveContext,
} from "../directives/directiveProcessor";
import { createRefsProxy } from "../helpers/frameworkHelpers";
import { setComponentContext, warn } from "../../utils/devWarnings";

/**
 * Creates a Web Component class from a Ladrillos component definition.
 *
 * This function creates the class but does NOT register it with customElements.
 * Use createWebComponent() if you want to both create and register.
 *
 * Follows the Web Components specification:
 * - Proper lifecycle callbacks (connectedCallback, disconnectedCallback, etc.)
 * - Observed attributes with attributeChangedCallback
 * - Shadow DOM encapsulation (optional)
 * - Reactive state that syncs with the DOM
 *
 * - Attributes from HTML OVERRIDE script variable defaults
 * - Script variables serve as DEFAULT values when no attribute is provided
 *
 * Example:
 *   <my-counter count="5"></my-counter>  <!-- count = 5, not the default -->
 *   <my-counter></my-counter>            <!-- count = 0 (script default) -->
 */
export function createWebComponentClass(
  component: LadrillosComponent,
  useShadowDOM: boolean
): typeof HTMLElement {
  const {
    tagName,
    template,
    scripts,
    externalScripts,
    externalStyles,
    styles,
    sourcePath,
  } = component;

  // Pre-extract variable names from scripts for observedAttributes
  // This runs once when the component class is defined
  const allScriptContent = scripts.map((s) => s.content).join("\n");
  const declaredVariables = extractVariableNames(allScriptContent);

  class LadrillosWebComponent extends HTMLElement {
    // =========================================================================
    // Static Properties (Web Component Spec)
    // =========================================================================

    /**
     * Attributes to observe for changes.
     * Automatically derived from script variable declarations.
     * When these attributes change, attributeChangedCallback is called.
     */
    static get observedAttributes(): string[] {
      return declaredVariables;
    }

    // =========================================================================
    // Instance Properties
    // =========================================================================

    /** Reactive state - changes automatically update the DOM */
    state: Record<string, unknown> = {};

    /** Reference to the shadow root or light DOM root */
    private _root: HTMLElement | ShadowRoot | null = null;

    /** Flag to track if component has been initialized */
    private _initialized: boolean = false;

    /** Unique ID for this component instance (used for module cleanup) */
    private _componentId: string = `${tagName}-${Math.random()
      .toString(36)
      .slice(2)}`;

    /** Directive context for loops, conditionals, etc. */
    private _directives: DirectiveContext | null = null;

    /** Expression evaluator function */
    private _evaluator:
      | ((expr: string, ctx: Record<string, unknown>) => unknown)
      | null = null;

    /** Two-way binding updater function - syncs state changes to input elements */
    private _updateBoundInputs: ((changedKey?: string) => void) | null = null;

    // =========================================================================
    // Lifecycle Callbacks (Web Component Spec)
    // =========================================================================

    constructor() {
      super();
      // Don't do DOM work here - wait for connectedCallback
      // This follows the custom elements spec best practice
    }

    /**
     * Called when the element is added to the DOM.
     * This is where we do our main initialization.
     */
    async connectedCallback(): Promise<void> {
      // Prevent double initialization (can happen with some frameworks)
      if (this._initialized) return;
      this._initialized = true;

      // Set component context for better error messages
      // This allows error handlers to know which component is being processed
      setComponentContext({
        tagName,
        sourcePath,
        instanceId: this._componentId,
      });

      // Create shadow DOM or use light DOM
      this._root = useShadowDOM ? this.attachShadow({ mode: "open" }) : this;

      // Parse template and find bindings
      const { bindings, twoWayBindings, conditionals, loops } = loadTemplate(
        this._root,
        template
      );

      // Load scoped styles
      loadStyles(this._root, styles, useShadowDOM);

      // Collect attribute values to override script defaults
      // ATTRIBUTES WIN over script variable defaults
      const attributeOverrides = this._getAttributeOverrides();

      // Filter out module scripts - they are handled separately
      const regularScripts = scripts.filter((s) => s.type !== "module");
      const hasModuleScripts = scripts.some((s) => s.type === "module");

      // Create refs Map EARLY so scripts can access $refs
      // Wrap in Proxy for cleaner dot notation access: $refs.inputEl instead of $refs.get("inputEl")
      const earlyRefs = createRefsProxy(new Map<string, HTMLElement>());

      // Scan for $ref attributes and populate refs BEFORE running scripts
      // This allows scripts to immediately use $refs.elementName
      scanRefsOnly(this._root, earlyRefs);

      // Load external stylesheets (<link rel="stylesheet">) FIRST
      // These are third-party CSS files (like highlight.js themes) that need
      // to be available for proper styling.
      // For Shadow DOM: injects CSS directly into shadow root (styles don't cross shadow boundary)
      // For light DOM: adds <link> to document head
      if (externalStyles && externalStyles.length > 0) {
        await loadExternalStyles(externalStyles, this._root, useShadowDOM);
      }

      // Load external scripts marked with 'external' attribute NEXT
      // These are third-party libraries (like highlight.js) that the inline
      // scripts may depend on. They need to load before inline scripts run.
      if (externalScripts.length > 0) {
        await loadPlainExternalScripts(externalScripts);
      }

      // Initialize reactive state and event handlers (for regular scripts)
      // Pass attribute overrides so they take precedence over defaults
      // Pass a callback that will update directives when state changes
      // DEFER bindings if we have module scripts (they need to load first)
      // Pass sourcePath so $registerComponent resolves paths relative to this component
      // Pass componentId so event bus listeners can be cleaned up on disconnect
      // Pass earlyRefs so scripts can access $refs immediately
      this.state = await loadScripts(
        this._root,
        regularScripts,
        bindings,
        attributeOverrides,
        () => this._updateDirectives(),
        hasModuleScripts, // deferBindings = true if we have module scripts
        sourcePath, // componentUrl for correct path resolution
        this._componentId, // componentId for event bus cleanup
        earlyRefs // refs for $refs access in scripts
      );

      // Register the onStateChange callback globally so external module scripts
      // can trigger UI updates when imported arrays are mutated.
      // This is used by the __wrapReactiveArray helper injected into external scripts.
      if (typeof globalThis !== "undefined") {
        if (!(globalThis as any).__ladrillosStateCallbacks) {
          (globalThis as any).__ladrillosStateCallbacks = new Map();
        }
        (globalThis as any).__ladrillosStateCallbacks.set(
          this._componentId,
          () => this._updateDirectives()
        );
      }

      // Execute module scripts with runtime import rewriting
      // This handles <script type="module"> with imports like:
      //   import { foo } from "./bar.js"
      // Module scripts now contribute to reactive state!
      //
      // IMPORTANT: We pass this.state so module script functions write
      // directly to the reactive state. This makes `let x = 0; x++` work.
      // We also pass the onStateChange callback so imported arrays become reactive.
      if (sourcePath) {
        const moduleState = await executeModuleScriptsWithReactivity(
          scripts,
          externalScripts,
          sourcePath,
          this._componentId,
          earlyRefs, // Pass refs so functions can capture the reference
          this.state, // Pass reactive state so functions write directly to it
          () => this._updateDirectives() // Pass callback for imported array reactivity
        );

        // Mark state as having module scripts ONLY if there are actual module scripts
        // This affects how event handlers treat functions:
        // - Module scripts have reactive functions that should NOT be recreated
        // - Regular scripts need fresh function bindings each time
        if (hasModuleScripts || externalScripts.length > 0) {
          (this.state as any).__hasModuleScripts = true;
        }

        // Merge module script functions into reactive state
        // Variables are already in this.state (written directly by transformed code)
        // We just need to add the functions
        for (const [key, value] of Object.entries(moduleState)) {
          if (typeof value === "function") {
            this.state[key] = value;
          }
        }
      }

      // Now that ALL state is ready (regular + module scripts),
      // apply bindings and set up event handlers
      if (hasModuleScripts) {
        applyBindingsDeferred(this._root, bindings, this.state);
      }

      // Create expression evaluator for directives
      this._evaluator = createExpressionEvaluator();

      // Scan and process all directives ($for, $if, $show, $bind)
      // Use scanDirectivesWithRefs to reuse the earlyRefs Map we already populated
      // Note: scanRefsOnly was already called earlier, so refs are already in earlyRefs
      this._directives = scanDirectivesWithRefs(this._root, earlyRefs);

      // Also populate the global refs registry for external module scripts
      // This allows external .js files to access refs via the global registry
      if (typeof globalThis !== "undefined") {
        if (!(globalThis as any).__ladrillosRefs) {
          (globalThis as any).__ladrillosRefs = new Map();
        }
        // Get or create the refs Map for this component in the global registry
        let globalRefs = (globalThis as any).__ladrillosRefs.get(
          this._componentId
        );
        if (!globalRefs) {
          globalRefs = new Map();
          (globalThis as any).__ladrillosRefs.set(
            this._componentId,
            globalRefs
          );
        }
        // Copy all refs into the global registry
        for (const [key, value] of this._directives.refs) {
          globalRefs.set(key, value);
        }
      }

      // Expose refs on the component for external access
      (this as any).refs = this._directives.refs;
      // Also store on host element so event handlers can access them
      (this as any).__refs = this._directives.refs;

      // Initial directive rendering
      this._updateDirectives();

      // Set up two-way bindings ($bind)
      // Returns an updater function for state→input sync
      if (this._directives.twoWayBindings.length > 0) {
        this._updateBoundInputs = setupTwoWayBindings(
          this._directives.twoWayBindings,
          this.state,
          this._evaluator
        );
      }

      // Dispatch custom event when component is ready
      this.dispatchEvent(
        new CustomEvent("ladrillos:ready", {
          bubbles: true,
          composed: true, // Crosses shadow DOM boundary
          detail: { state: this.state, refs: this._directives.refs },
        })
      );
    }

    /**
     * Called when the element is removed from the DOM.
     * Clean up event listeners, observers, etc.
     */
    disconnectedCallback(): void {
      // Clean up module script blob URLs to prevent memory leaks
      cleanupModuleScripts(this._componentId);

      // Clean up event bus listeners to prevent memory leaks
      cleanupComponentListeners(this._componentId);

      // Clean up global state change callback
      if (typeof globalThis !== "undefined") {
        (globalThis as any).__ladrillosStateCallbacks?.delete(
          this._componentId
        );
      }

      this._initialized = false;
    }

    /**
     * Called when an observed attribute changes.
     * Syncs HTML attributes with component reactive state.
     *
     * This enables:
     *   element.setAttribute('count', '10')  -->  state.count = 10
     */
    attributeChangedCallback(
      name: string,
      oldValue: string | null,
      newValue: string | null
    ): void {
      // Only process if value actually changed and component is initialized
      if (oldValue === newValue) return;

      // If not yet initialized, attributes will be read in connectedCallback
      if (!this._initialized) return;

      // Sync attribute to reactive state
      // This triggers DOM updates automatically via the Proxy
      const parsed = this._parseAttributeValue(newValue);
      this.state[name] = parsed;
    }

    /**
     * Called when the element is moved to a new document.
     * Rare, but required for full spec compliance.
     */
    adoptedCallback(): void {
      // Re-initialize if needed when moved to a new document
    }

    // =========================================================================
    // Helper Methods
    // =========================================================================

    /**
     * Updates all directives when state changes.
     * Called by the reactive system on every state mutation.
     */
    private _updateDirectives(): void {
      if (!this._directives || !this._evaluator) return;

      // Update loops
      if (this._directives.loops.length > 0) {
        renderLoops(this._directives.loops, this.state, this._evaluator);
      }

      // Update conditionals
      if (this._directives.conditionals.length > 0) {
        updateConditionals(
          this._directives.conditionals,
          this.state,
          this._evaluator
        );
      }

      // Update $show elements
      if (this._directives.showElements.length > 0) {
        updateShowElements(
          this._directives.showElements,
          this.state,
          this._evaluator
        );
      }

      // Update two-way bound inputs (state→input sync)
      if (this._updateBoundInputs) {
        this._updateBoundInputs();
      }
    }

    /**
     * Collects all attribute values that can be used as state.
     * Collects ALL attributes (not just those matching declared variables).
     * This allows: <my-component count="5"> without needing `let count` in script.
     */
    private _getAttributeOverrides(): Record<string, unknown> {
      const overrides: Record<string, unknown> = {};
      const skippedReserved: string[] = [];

      // Collect all attributes on the element
      for (const attr of Array.from(this.attributes)) {
        // Skip standard HTML attributes and framework internals
        if (this._isReservedAttribute(attr.name)) {
          // Track reserved attributes that look like they might be intended as state
          // (have a non-empty value that's not a standard HTML usage)
          if (attr.value && attr.value.trim() !== "") {
            skippedReserved.push(attr.name);
          }
          continue;
        }

        overrides[attr.name] = this._parseAttributeValue(attr.value);
      }

      // Warn developers about reserved attributes that were skipped
      if (skippedReserved.length > 0) {
        const suggestions = skippedReserved.map((name) => {
          const alternatives: Record<string, string> = {
            title: "heading",
            class: "className",
            style: "customStyle",
            id: "componentId",
            hidden: "isHidden",
          };
          const alt =
            alternatives[name] ||
            `my${name.charAt(0).toUpperCase()}${name.slice(1)}`;
          return `"${name}" → try "${alt}"`;
        });

        warn(
          `Reserved HTML attribute(s) used on <${tagName}>: ${skippedReserved
            .map((n) => `"${n}"`)
            .join(", ")}.\n` +
            `  These won't be available as component state because they're standard HTML attributes.\n` +
            `  Suggestions: ${suggestions.join(", ")}`,
          { tagName, sourcePath }
        );
      }

      return overrides;
    }

    /**
     * Checks if an attribute is a reserved HTML attribute that shouldn't
     * become component state.
     */
    private _isReservedAttribute(name: string): boolean {
      const reserved = [
        "id",
        "class",
        "style",
        "slot",
        "part",
        "is",
        "tabindex",
        "title",
        "lang",
        "dir",
        "hidden",
        "draggable",
        "contenteditable",
      ];
      return reserved.includes(name.toLowerCase()) || name.startsWith("data-");
    }

    /**
     * Parses an attribute string value to the appropriate JS type.
     * Attributes are always strings, but we try to convert them.
     *
     * Conversions:
     *   "true" / "false" -> boolean
     *   "42" / "3.14" -> number
     *   "" (empty) -> true (boolean attribute)
     *   '[1,2,3]' / '{"a":1}' -> parsed JSON
     *   anything else -> string
     *
     * Note: HTML entities are automatically decoded by the browser when
     * reading attribute values, so '&quot;' becomes '"' before we see it.
     */
    private _parseAttributeValue(value: string | null): unknown {
      if (value === null) return null;
      if (value === "") return true; // Boolean attribute: <my-el disabled>
      if (value === "true") return true;
      if (value === "false") return false;

      // Try number conversion
      const num = Number(value);
      if (!isNaN(num) && value.trim() !== "") return num;

      // Try JSON parse for objects/arrays
      // The browser already decodes HTML entities (&quot; -> ") when we read the attribute
      try {
        const trimmed = value.trim();
        // Only try JSON parse if it looks like JSON (starts with [ or {)
        if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
          return JSON.parse(trimmed);
        }
      } catch {
        // Not valid JSON, return as string
      }

      return value;
    }

    /**
     * Gets the component's root (shadow root or element itself).
     */
    get root(): HTMLElement | ShadowRoot | null {
      return this._root;
    }
  }

  return LadrillosWebComponent;
}

/**
 * Creates and registers a Web Component from a Ladrillos component.
 *
 * This is the main entry point that:
 * 1. Creates the component class
 * 2. Registers it with customElements.define
 */
export function createWebComponent(
  component: LadrillosComponent,
  useShadowDOM: boolean
): void {
  const { tagName } = component;

  // Only define if not already defined (prevents errors on hot reload)
  if (!customElements.get(tagName)) {
    const ComponentClass = createWebComponentClass(component, useShadowDOM);
    customElements.define(tagName, ComponentClass);
    console.log(`🧩 Web component "${tagName}" registered.`);
  }
}
