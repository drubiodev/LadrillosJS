export type ScriptElement = {
  content: string;
  type: string | null;
  /** Build-time resolved bindings supplied by precompiled component artifacts. */
  resolvedImports?: Record<string, unknown>;
};

export type ExternalScriptElement = {
  src: string;
  type: string | null;
  external?: boolean;
};

export type ExternalStyleElement = {
  href: string;
  rel: string;
};

export type LadrillosComponent = {
  tagName: string;
  template: string;
  scripts: ScriptElement[];
  externalScripts: ExternalScriptElement[];
  externalStyles: ExternalStyleElement[];
  styles: string;
  sourcePath?: string;
  lazy?: boolean;
  /**
   * Variable names found in template bindings (e.g., {title} -> 'title').
   * Used to auto-observe attributes that map to template expressions.
   */
  templateBindings?: string[];
};

export type ComponentRegistration = {
  name: string;
  path: string;
  useShadowDOM?: boolean;
  lazy?: boolean;
};

export type RegexPatterns = {
  readonly bindings: RegExp;
  readonly comments: {
    readonly js: RegExp;
    readonly css: RegExp;
    readonly html: RegExp;
  };
};

export type BindingDescriptor = {
  node: Text;
  bindings: Array<{
    raw: string; // e.g. "person.name" or "MyName('Pedro')" or "i + 1"
    path: string[]; // ['person', 'name']
    isFunction?: boolean; // True if this is a function call
    isExpression?: boolean; // True if this contains operators or method calls
    functionArgs?: string[]; // Variables passed as arguments to functions
  }>;
  original: string; // The original template text (e.g., "Hello: {name}")
  isAttribute?: boolean; // True if this is an attribute binding
  attributeName?: string; // The attribute name if isAttribute is true
};

export type TwoWayBindingDescriptor = {
  element:
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement
  | HTMLElement;
  path: string[]; // ['person', 'name'] or ['inputText']
  raw: string; // "person.name" or "inputText"
  isContentEditable?: boolean; // True if element has contenteditable attribute
  initialValue?: string; // Store initial content when scanning
};

export type ConditionalDescriptor = {
  element: Element;
  condition: string; // The expression to evaluate (e.g., "isVisible" or "count > 5")
  type: "if" | "else-if" | "else";
  placeholder: Comment; // Comment node to mark position in DOM
  group: ConditionalDescriptor[]; // All elements in this conditional group
  originalParent: Element | ShadowRoot; // Reference to parent
  nextSibling: Node | null; // Reference to next sibling for reinsertion
};

export type LoopDescriptor = {
  template: Element; // The template element to clone for each item
  expression: string; // The loop expression (e.g., "item in items" or "(item, index) in items")
  itemName: string; // The loop variable name (e.g., "item")
  indexName?: string; // Optional index variable name (e.g., "index")
  arrayName: string; // The array to iterate over (e.g., "items")
  keyAttribute?: string; // Optional key for optimization (e.g., "item.id")
  placeholder: Comment; // Comment node to mark position in DOM
  renderedElements: Element[]; // Currently rendered elements
  originalParent: Element | ShadowRoot; // Reference to parent
  /** Previous items for keyed diffing (to detect changes) */
  previousItems?: unknown[];
  /** Cached key getter function for performance */
  keyGetter?: (item: unknown, index: number) => unknown;
  /**
   * Whether the template subtree contains any <if> chain. Detected once at
   * scan time so per-row rendering can skip the conditional-resolution walk
   * entirely for the common conditional-free template.
   */
  hasConditionals?: boolean;
  /**
   * Whether the template contains a nested <for>. Those are extracted and
   * rendered per row, because their array expression usually depends on the
   * enclosing row's item.
   */
  hasNestedLoops?: boolean;
  /**
   * Loop variable names contributed by enclosing loops, outermost first.
   * Empty for a top-level loop; `["group"]` for a <for> nested one deep.
   */
  scopeNames?: readonly string[];
};

/**
 * Component library types for TypeScript support
 */

/**
 * Describes the props interface for a component
 * Used for TypeScript type checking and documentation
 */
export type ComponentProps = Record<string, unknown>;

/**
 * Describes the events a component can emit
 * Maps event names to their detail payload types
 */
export type ComponentEvents = Record<string, any>;

/**
 * Interface definition for a LadrillosJS component
 * Allows TypeScript consumers to get proper type checking
 */
export type ComponentInterface<
  Props extends ComponentProps = ComponentProps,
  Events extends ComponentEvents = ComponentEvents
> = {
  /**
   * Component tag name (e.g., "my-button")
   */
  tagName: string;

  /**
   * TypeScript interface for component properties/attributes
   */
  props: Props;

  /**
   * TypeScript interface for component events
   */
  events: Events;

  /**
   * Component methods available in TypeScript
   */
  methods?: Record<string, (...args: any[]) => any>;

  /**
   * Documentation for the component
   */
  documentation?: {
    description?: string;
    examples?: string[];
  };
};

/**
 * Metadata about a component in a library
 * Used during component registration and discovery
 */
export type ComponentMetadata<
  Props extends ComponentProps = ComponentProps,
  Events extends ComponentEvents = ComponentEvents
> = {
  /**
   * Component registration details
   */
  registration: ComponentRegistration;

  /**
   * TypeScript interface for this component
   */
  interface: ComponentInterface<Props, Events>;

  /**
   * Version of the component
   */
  version?: string;

  /**
   * Component author/library name
   */
  library?: string;
};

/**
 * Library component with metadata and helper functions
 */
export type LibraryComponent<
  Props extends ComponentProps = ComponentProps,
  Events extends ComponentEvents = ComponentEvents
> = {
  /**
   * Component metadata
   */
  metadata: ComponentMetadata<Props, Events>;

  /**
   * HTML content of the component (as raw string)
   */
  html?: string;

  /**
   * Helper to create a typed reference to the component element
   */
  createElement?: (attributes?: Partial<Props>) => HTMLElement & Partial<Props>;

  /**
   * Helper to query and cast to the component type
   */
  query?: (selector: string) => (HTMLElement & Partial<Props>) | null;
};
