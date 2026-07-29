import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setCodegenBackend } from "../../src/core/js/compiler";
import { runtimeBackend } from "../../src/core/js/runtimeBackend";
import
    {
        precompiledBackend,
        registerArtifacts,
        clearArtifacts,
        type ArtifactTable,
    } from "../../src/core/js/precompiled";
import { emitComponent } from "../../src/compiler/emit";
import { defineCompiled } from "../../src/core/component/defineCompiled";
import { parseComponent } from "../../src/core/component/extract";
import type { LadrillosComponent } from "../../src/types";

/**
 * `defineCompiled` is the half of the CSP story that removes work rather than
 * replacing it: `registerComponent` fetches an .html file and runs it through
 * `DOMParser` on every page load, and this path skips both.
 *
 * The descriptor is round-tripped through JSON on purpose. It has to survive
 * being written to a generated file by the compiler, so anything that does not
 * serialise would be a bug the emitter could not detect on its own.
 */

let outDir: string;
let tag = 0;

const COMPONENT_URL = "http://localhost/define-fixture.html";

beforeAll(() =>
{
    // Its own subdirectory: test files run in parallel, and the emitter suite
    // removes tests/.generated wholesale in its own afterAll.
    outDir = join(process.cwd(), "tests", ".generated", "define");
    mkdirSync(outDir, { recursive: true });
});

afterAll(() =>
{
    rmSync(outDir, { recursive: true, force: true });
});

afterEach(() =>
{
    setCodegenBackend(runtimeBackend);
    clearArtifacts();
});

function whenReady(el: HTMLElement): Promise<void>
{
    return new Promise((resolve) =>
    {
        el.addEventListener("ladrillos:ready", () => resolve(), { once: true });
    });
}

/** Rendered text only — `<style>` lives in the shadow root and would count. */
const text = (root: ShadowRoot) =>
{
    const parts: string[] = [];
    root.childNodes.forEach((node) =>
    {
        if ((node as Element).tagName?.toLowerCase() === "style") return;
        parts.push(node.textContent ?? "");
    });
    return parts.join(" ").replace(/\s+/g, " ").trim();
};

const SOURCE = `
  <template>
    <p>{greeting}, {name}</p>
    <button onclick="bump()">{count}</button>
  </template>
  <script>
    let greeting = "Hello";
    let name = "world";
    let count = 1;
    function bump() { count++; }
  </script>
  <style>p { color: red; }</style>
`;

/** Emits artifacts, then mounts purely from the emitted descriptor. */
async function mountFromDescriptor(
    component: LadrillosComponent,
    tagName: string
): Promise<ShadowRoot>
{
    const emitted = emitComponent(component);

    // Written to disk so a failure to serialise shows up the same way it would
    // in a real build, not as an in-memory object that happens to still work.
    writeFileSync(join(outDir, `${tagName}.json`), emitted.descriptor, "utf8");
    const descriptor = JSON.parse(emitted.descriptor) as LadrillosComponent;

    registerArtifacts(artifactsOf(component));
    setCodegenBackend(precompiledBackend);

    defineCompiled({ ...descriptor, tagName }, { useShadowDOM: true });

    const el = document.createElement(tagName);
    document.body.appendChild(el);
    await whenReady(el);
    return (el as unknown as { shadowRoot: ShadowRoot }).shadowRoot;
}

/** Builds the artifact table the emitted module would have registered. */
function artifactsOf(component: LadrillosComponent): ArtifactTable
{
    const emitted = emitComponent(component, { format: "table" });
    const load = new Function(
        `${emitted.code.replace("export default", "return")}`
    ) as () => ArtifactTable;
    return load();
}

describe("defineCompiled", () =>
{
    it("renders from an emitted descriptor, with no HTML parsing at mount", async () =>
    {
        const tagName = `define-basic-${++tag}`;
        const component = await parseComponent(SOURCE, tagName, COMPONENT_URL);

        const root = await mountFromDescriptor(component, tagName);

        expect(text(root)).toBe("Hello, world 1");
    });

    it("keeps handlers working through the precompiled backend", async () =>
    {
        const tagName = `define-handler-${++tag}`;
        const component = await parseComponent(SOURCE, tagName, COMPONENT_URL);

        const root = await mountFromDescriptor(component, tagName);
        root.querySelector("button")?.click();
        await new Promise((r) => setTimeout(r, 50));

        expect(text(root)).toBe("Hello, world 2");
    });

    it("carries styles through the descriptor", async () =>
    {
        const tagName = `define-styles-${++tag}`;
        const component = await parseComponent(SOURCE, tagName, COMPONENT_URL);

        const root = await mountFromDescriptor(component, tagName);

        // Asserted through the cascade, not the mechanism: styles arrive as an
        // adopted stylesheet, so there is no <style> element to inspect.
        expect(getComputedStyle(root.querySelector("p")!).color).toBe("red");
    });

    it("refuses a descriptor whose tag name is not a valid custom element", () =>
    {
        defineCompiled({
            tagName: "nohyphen",
            template: "",
            scripts: [],
            externalScripts: [],
            externalStyles: [],
            styles: "",
        });

        expect(customElements.get("nohyphen")).toBeUndefined();
    });
});
