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
  style: string;
};

export type RegexPatterns = {
  readonly comments: {
    readonly js: RegExp;
    readonly css: RegExp;
    readonly html: RegExp;
  };
};
