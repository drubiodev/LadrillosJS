import type { LadrillosComponent } from "../../types";
import { createWebComponent } from "./webcomponent";
import { warn, ErrorCode } from "../../utils/devWarnings";

export interface DefineCompiledOptions {
  /** Matches `registerComponent`, which also defaults to shadow DOM. */
  useShadowDOM?: boolean;
}

/**
 * Registers a component that was already parsed at build time.
 *
 * `registerComponent` fetches an .html file and runs it through `DOMParser` to
 * split out template, scripts and styles. That work is identical on every page
 * load, so the compiler does it once and emits the result. This entry point
 * takes that emitted descriptor directly.
 *
 * It deliberately lives outside `ladrillos.ts`: that module instantiates the
 * framework singleton at import time, which pins `parseComponent` — and with it
 * the HTML parser — into any bundle that touches it. Keeping this separate is
 * what lets a build that only uses precompiled components drop the parser.
 */
export function defineCompiled(
  component: LadrillosComponent,
  options: DefineCompiledOptions = {}
): void {
  const { tagName } = component;

  if (!tagName?.trim() || !tagName.includes("-")) {
    warn(
      `Invalid component name "${tagName || "(empty)"}". Custom element names must contain a hyphen.`,
      { tagName, sourcePath: component.sourcePath },
      {
        code: ErrorCode.INVALID_COMPONENT_NAME,
        hint: "Regenerate the artifact — the emitted tagName looks wrong.",
      }
    );
    return;
  }

  createWebComponent(component, options.useShadowDOM ?? true);
}
