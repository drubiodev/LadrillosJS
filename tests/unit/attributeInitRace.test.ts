import { describe, it, expect } from "vitest";
import { createWebComponentClass } from "../../src/core/component/webcomponent";
import type { LadrillosComponent } from "../../src/types";

/**
 * Regression test: an attribute set while a component's async
 * connectedCallback is still initializing must land in reactive state.
 *
 * Bug: `_initialized` is set at the TOP of the async connectedCallback,
 * but `this.state` only becomes the reactive proxy after
 * `await loadScripts(...)`. An attributeChangedCallback firing in that
 * window wrote into the placeholder `{}` object, which loadScripts then
 * replaced — the value was silently lost. This is exactly what happens
 * when a parent component's first binding pass evaluates a template
 * attribute binding (e.g. `<child name="{expr}">`) on a child that is
 * still initializing: the child rendered the raw `{expr}` literal even
 * though its DOM attribute held the evaluated value.
 *
 * Fixed by stashing such writes in the `_pendingProps` channel, which is
 * drained into reactive state right after it is created.
 */

let tagCounter = 0;

function defineTestComponent(): string {
  const tagName = `attr-race-el-${++tagCounter}`;
  const component: LadrillosComponent = {
    tagName,
    template: `<span>{name}</span>`,
    scripts: [
      { content: `let name = "default";`, type: "text/javascript" } as any,
    ],
    externalScripts: [],
    externalStyles: [],
    styles: "",
    templateBindings: ["name"],
  };

  const ComponentClass = createWebComponentClass(component, false);
  customElements.define(tagName, ComponentClass);
  return tagName;
}

function whenReady(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    el.addEventListener("ladrillos:ready", () => resolve(), { once: true });
  });
}

describe("attribute set during async component initialization", () => {
  it("applies a setAttribute that fires in the init window to state", async () => {
    const tagName = defineTestComponent();

    const el = document.createElement(tagName);
    // Simulate the parent template's raw (unevaluated) binding text
    el.setAttribute("name", "{expr}");
    document.body.appendChild(el);

    // connectedCallback has now run synchronously up to its first await:
    // _initialized is true but reactive state doesn't exist yet. This
    // setAttribute simulates the parent's binding pass evaluating the
    // attribute during that window.
    el.setAttribute("name", "Evaluated");

    await whenReady(el);

    expect((el as any).state.name).toBe("Evaluated");
    expect(el.getAttribute("name")).toBe("Evaluated");
  });

  it("still applies attribute changes made after initialization", async () => {
    const tagName = defineTestComponent();

    const el = document.createElement(tagName);
    document.body.appendChild(el);
    await whenReady(el);

    expect((el as any).state.name).toBe("default");

    el.setAttribute("name", "Later");
    expect((el as any).state.name).toBe("Later");
  });

  it("uses the script default when no attribute is ever set", async () => {
    const tagName = defineTestComponent();

    const el = document.createElement(tagName);
    document.body.appendChild(el);
    await whenReady(el);

    expect((el as any).state.name).toBe("default");
  });
});
