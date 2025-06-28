export type ScriptElement = {
  content: string;
  type: string | null;
};

export type ExternalScriptElement = {
  src: string;
  type: string | null;
  bind: boolean;
};

export type LadrillosComponent = {
  tagName: string;
  template: string;
  scripts: ScriptElement[];
  externalScripts: ExternalScriptElement[];
  style: string;
};

export type RegexPatterns = {
  readonly binding: RegExp;
  readonly eventHandler: RegExp;
  readonly functionCall: RegExp;
  readonly arrowFunction: RegExp;
  readonly inlineFunction: RegExp;
  readonly htmlTags: RegExp;
  readonly comments: {
    readonly js: RegExp;
    readonly css: RegExp;
    readonly html: RegExp;
  };
  readonly declarations: {
    readonly function: RegExp;
    readonly variable: RegExp;
  };
};

export type StringifyFunction = {
  (obj: unknown, space?: string | number): string;
};

export interface ComponentElement extends HTMLElement {
  root: ShadowRoot | HTMLElement;
  _bindings: unknown[];
  _eventBindings?: unknown[];
  _conditionals?: unknown[];
}
