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
} from "../js/moduleExecutor";
import {
  scanDirectives,
  renderLoops,
  updateConditionals,
  updateShowElements,
  setupTwoWayBindings,
  DirectiveContext,
} from "../directives/directiveProcessor";

/**
 * Creates a semantically correct Web Component from a Ladrillos component.
 *
 * Follows the Web Components specification:
 * - Proper lifecycle callbacks (connectedCallback, disconnectedCallback, etc.)
 * - Observed attributes with attributeChangedCallback
 * - Shadow DOM encapsulation (optional)
 * - Reactive state that syncs with the DOM
 *
 * Attribute Precedence (follows Vue/Svelte/Lit convention):
 * - Attributes from HTML OVERRIDE script variable defaults
 * - Script variables serve as DEFAULT values when no attribute is provided
 *
 * Example:
 *   <my-counter count="5"></my-counter>  <!-- count = 5, not the default -->
 *   <my-counter></my-counter>            <!-- count = 0 (script default) -->
 *
 * Inspired by: Lit, Vue's defineCustomElement, Stencil
 */
export function createWebComponent(
  component: LadrillosComponent,
  useShadowDOM: boolean
): void {
  const { tagName, template, scripts, externalScripts, styles, sourcePath } =
    component;

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

      // Initialize reactive state and event handlers (for regular scripts)
      // Pass attribute overrides so they take precedence over defaults
      // Pass a callback that will update directives when state changes
      // DEFER bindings if we have module scripts (they need to load first)
      this.state = await loadScripts(
        this._root,
        regularScripts,
        bindings,
        attributeOverrides,
        () => this._updateDirectives(),
        hasModuleScripts // deferBindings = true if we have module scripts
      );

      // Create refs Map early so module script functions can capture the reference.
      // The map will be populated later by scanDirectives, but functions
      // defined in module scripts need access to the same Map instance.
      const earlyRefs = new Map<string, HTMLElement>();

      // Execute module scripts with runtime import rewriting
      // This handles <script type="module"> with imports like:
      //   import { foo } from "./bar.js"
      // Module scripts now contribute to reactive state!
      if (sourcePath) {
        const moduleState = await executeModuleScriptsWithReactivity(
          scripts,
          externalScripts,
          sourcePath,
          this._componentId,
          earlyRefs // Pass refs so functions can capture the reference
        );

        // Merge module script state into reactive state
        // Module variables become reactive just like regular script variables
        for (const [key, value] of Object.entries(moduleState)) {
          this.state[key] = value;
        }
      }

      // Now that ALL state is ready (regular + module scripts),
      // apply bindings and set up event handlers
      if (hasModuleScripts) {
        applyBindingsDeferred(this._root, bindings, this.state);
      }

      // Create expression evaluator for directives
      this._evaluator = createExpressionEvaluator();

      // Scan and process all directives ($for, $if, $show, $bind, $ref)
      this._directives = scanDirectives(this._root);

      // Copy refs from scanDirectives into the earlyRefs Map that module
      // script functions captured. This ensures drawOnCanvas() etc. can
      // access refs.get("myCanvas") correctly.
      for (const [key, value] of this._directives.refs) {
        earlyRefs.set(key, value);
      }
      // Replace the directives refs with earlyRefs so everything uses the same Map
      this._directives.refs = earlyRefs;

      // Expose refs on the component for external access
      (this as any).refs = this._directives.refs;
      // Also store on host element so event handlers can access them
      (this as any).__refs = this._directives.refs;

      // Initial directive rendering
      this._updateDirectives();

      // Set up two-way bindings ($bind)
      if (this._directives.twoWayBindings.length > 0) {
        setupTwoWayBindings(
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
    }

    /**
     * Collects all attribute values that can be used as state.
     * Collects ALL attributes (not just those matching declared variables).
     * This allows: <my-component count="5"> without needing `let count` in script.
     */
    private _getAttributeOverrides(): Record<string, unknown> {
      const overrides: Record<string, unknown> = {};

      // Collect all attributes on the element
      for (const attr of Array.from(this.attributes)) {
        // Skip standard HTML attributes and framework internals
        if (this._isReservedAttribute(attr.name)) continue;

        overrides[attr.name] = this._parseAttributeValue(attr.value);
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
      try {
        return JSON.parse(value);
      } catch {
        return value; // Return as string
      }
    }

    /**
     * Gets the component's root (shadow root or element itself).
     */
    get root(): HTMLElement | ShadowRoot | null {
      return this._root;
    }
  }

  // Only define if not already defined (prevents errors on hot reload)
  if (!customElements.get(tagName)) {
    customElements.define(tagName, LadrillosWebComponent);
    console.log(`Web component "${tagName}" registered.`);
  }
}
