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
  raw: string; // e.g. "person.name"
  path: string[]; // ['person', 'name']
  original: string; // The original template text (e.g., "Hello: {name}")
  isAttribute?: boolean; // True if this is an attribute binding
  attributeName?: string; // The attribute name if isAttribute is true
  compute?: (ctx: unknown) => unknown;
};
