import { describe, it, expect, vi } from "vitest";
import { createWebComponentClass } from "../../src/core/component/webcomponent";
import { parseComponent } from "../../src/core/component/extract";

let tag = 0;

async function define(source: string, shadow = true): Promise<string>
{
    const tagName = `sty-${++tag}`;
    const component = await parseComponent(source, tagName);
    customElements.define(tagName, createWebComponentClass(component, shadow));
    return tagName;
}

async function mount(tagName: string): Promise<HTMLElement>
{
    const el = document.createElement(tagName);
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 30));
    return el;
}

const RED = `<p>hi</p><style>p { color: red; }</style>`;

describe("component styles", () =>
{
    it("adopts a stylesheet instead of injecting <style>", async () =>
    {
        const el = await mount(await define(RED));
        const root = el.shadowRoot!;

        expect(root.querySelector("style")).toBeNull();
        expect(root.adoptedStyleSheets.length).toBe(1);
        expect(getComputedStyle(root.querySelector("p")!).color).toBe("red");
    });

    it("shares one stylesheet across every instance", async () =>
    {
        const tagName = await define(RED);
        const a = await mount(tagName);
        const b = await mount(tagName);

        expect(a.shadowRoot!.adoptedStyleSheets[0]).toBeInstanceOf(CSSStyleSheet);
        expect(a.shadowRoot!.adoptedStyleSheets[0]).toBe(
            b.shadowRoot!.adoptedStyleSheets[0],
        );
    });

    it("shares across components whose CSS text is identical", async () =>
    {
        const a = await mount(await define(RED));
        const b = await mount(await define(`<p>bye</p><style>p { color: red; }</style>`));

        expect(a.shadowRoot!.adoptedStyleSheets[0]).toBeInstanceOf(CSSStyleSheet);
        expect(a.shadowRoot!.adoptedStyleSheets[0]).toBe(
            b.shadowRoot!.adoptedStyleSheets[0],
        );
    });

    it("keeps <style> for CSS using @import, which adoption would drop", async () =>
    {
        const source = `<p>hi</p><style>@import url("x.css"); p { color: red; }</style>`;
        const root = (await mount(await define(source))).shadowRoot!;

        expect(root.adoptedStyleSheets.length).toBe(0);
        expect(root.querySelector("style")).not.toBeNull();
    });

    it("warns that the @import fallback breaks under a strict CSP", async () =>
    {
        const spy = vi.spyOn(console, "warn").mockImplementation(() => { });

        try
        {
            const source =
                `<p>hi</p><style>@import url("warn.css"); p { color: fuchsia; }</style>`;
            await mount(await define(source));

            const text = spy.mock.calls.map((c) => c.join(" ")).join("\n");
            expect(text).toContain("@import");
            expect(text).toContain("unsafe-inline");
            expect(text).toContain("<link rel=\"stylesheet\">");
        } finally
        {
            spy.mockRestore();
        }
    });

    it("adopts into the document for light-DOM components", async () =>
    {
        const before = document.adoptedStyleSheets.length;
        const source = `<p>hi</p><style>p { color: rgb(0, 128, 0); }</style>`;

        await mount(await define(source, false));

        expect(document.adoptedStyleSheets.length).toBe(before + 1);
        expect(document.querySelector("head > style")).toBeNull();
    });
});

describe("external stylesheet hrefs", () =>
{
    const LINKED = `<link rel="stylesheet" href="/shared.css"><p>hi</p>`;

    it("keeps the authored href when compiled from a file: URL", async () =>
    {
        const component = await parseComponent(
            LINKED,
            "ext-1",
            "file:///Users/someone/proj/components/card.html",
        );

        // Resolving against the build machine's path would both break the fetch
        // and ship that path to every visitor.
        expect(component.externalStyles[0].href).toBe("/shared.css");
    });

    it("does not leak a build path for a relative href", async () =>
    {
        const component = await parseComponent(
            `<link rel="stylesheet" href="./shared.css"><p>hi</p>`,
            "ext-2",
            "file:///Users/someone/proj/components/card.html",
        );

        expect(component.externalStyles[0].href).not.toContain("file:");
        expect(component.externalStyles[0].href).not.toContain("/Users/someone");
    });

    it("still resolves against a real http base", async () =>
    {
        const component = await parseComponent(
            `<link rel="stylesheet" href="./shared.css"><p>hi</p>`,
            "ext-3",
            "https://site.example/components/card.html",
        );

        expect(component.externalStyles[0].href).toBe(
            "https://site.example/components/shared.css",
        );
    });
});
