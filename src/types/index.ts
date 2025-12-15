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
  lazy?: boolean;
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
