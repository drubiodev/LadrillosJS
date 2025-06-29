export type ScriptElement = {
  content: string;
  type: string | null;
};

export type ExternalScriptElement = {
  src: string;
  type: string | null;
  external: boolean;
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
    readonly arrowFunction: RegExp;
    readonly variable: RegExp;
  };
};

export type StringifyFunction = {
  (obj: unknown, space?: string | number): string;
};

export type ComponentBinding = Map<
  string,
  { key: string; node?: Node; value?: any }
>;

export type EventBinding = Map<
  string,
  {
    key: string;
    params?: string[];
    body?: string | Function | undefined;
    element: Element;
    eventType: string;
  }
>;

export type ComponentState = Record<string, any>;

export interface ComponentElement extends HTMLElement {
  root: ShadowRoot | HTMLElement;
  state: ComponentState;
  _bindings?: ComponentBinding;
  _eventBindings?: EventBinding;
  _conditionals?: unknown[];
}

export interface TextBinding {
  node: Node;
  template: string;
  key: string;
}

export interface AttributeBinding {
  element: Element;
  attrName: string;
  template: string;
  key: string;
}
