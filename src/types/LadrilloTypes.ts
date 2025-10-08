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
    raw: string; // e.g. "person.name" or "MyName('Pedro')"
    path: string[]; // ['person', 'name']
    isFunction?: boolean; // True if this is a function call
  }>;
  original: string; // The original template text (e.g., "Hello: {name}")
  isAttribute?: boolean; // True if this is an attribute binding
  attributeName?: string; // The attribute name if isAttribute is true
};
