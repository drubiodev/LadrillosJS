import { BindingDescriptor, ScriptElement } from "../../types";

export const loadScripts = async (
  host: HTMLElement | ShadowRoot,
  scripts: ScriptElement[],
  bindings: BindingDescriptor[]
): Promise<Map<string, string>> => {

  return new Map<string, string>();
};