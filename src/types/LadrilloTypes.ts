export type ScriptElement = {
  content: string;
  type: string | null;
};

export type ExternalScriptElement = {
  src: string;
  type: string | null;
  external?: boolean;
};

export type LadrillosComponent = {
  tagName: string;
  template: string;
  scripts: ScriptElement[];
  externalScripts: ExternalScriptElement[];
  styles: string;
  sourcePath?: string;
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
};
