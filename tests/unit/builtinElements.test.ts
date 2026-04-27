import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    scanDirectives,
    renderLoops,
    updateConditionals,
    updateShowElements,
} from "../../src/core/directives/directiveProcessor";
import { resolveLazyStrategy } from "../../src/core/builtins/lazyElement";

declare const MockIntersectionObserver: any;

/**
 * Lightweight expression evaluator for tests. Just looks up a state key.
 * Production uses the script-aware evaluator in `js/scriptParser`.
 */
function makeEval(): (
    expr: string,
    ctx: Record<string, unknown>,
) => unknown {
    return (expr, ctx) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-implied-eval
            return new Function(...Object.keys(ctx), `return (${expr});`)(
                ...Object.values(ctx),
            );
        } catch {
            return undefined;
        }
    };
}

describe("built-in elements: <if>/<else-if>/<else>", () => {
    let host: HTMLDivElement;

    beforeEach(() => {
        host = document.createElement("div");
        document.body.appendChild(host);
    });

    it("renders the matching branch in an if/else-if/else chain", () => {
        host.innerHTML = `
      <if condition="status === 'loading'"><p>load</p></if>
      <else-if condition="status === 'ok'"><p>ok</p></else-if>
      <else><p>fallback</p></else>
    `;
        const ctx = scanDirectives(host);
        expect(ctx.conditionals).toHaveLength(1);

        const evalFn = makeEval();
        updateConditionals(ctx.conditionals, { status: "ok" }, evalFn);
        expect(host.textContent?.trim()).toBe("ok");

        updateConditionals(ctx.conditionals, { status: "loading" }, evalFn);
        expect(host.textContent?.trim()).toBe("load");

        updateConditionals(ctx.conditionals, { status: "other" }, evalFn);
        expect(host.textContent?.trim()).toBe("fallback");
    });

    it("renders nothing when no branch matches and no <else>", () => {
        host.innerHTML = `<if condition="x"><span>yes</span></if>`;
        const ctx = scanDirectives(host);
        updateConditionals(ctx.conditionals, { x: false }, makeEval());
        expect(host.querySelector("span")).toBeNull();
    });

    it("strips curly braces from condition expressions", () => {
        host.innerHTML = `<if condition="{flag}"><b>v</b></if>`;
        const ctx = scanDirectives(host);
        updateConditionals(ctx.conditionals, { flag: true }, makeEval());
        expect(host.querySelector("b")?.textContent).toBe("v");
    });

    it("applies display:contents to the rendered <if> wrapper", () => {
        host.innerHTML = `<if condition="t"><span>x</span></if>`;
        const ctx = scanDirectives(host);
        updateConditionals(ctx.conditionals, { t: true }, makeEval());
        const ifEl = host.querySelector("if") as HTMLElement;
        expect(ifEl.style.display).toBe("contents");
    });
});

describe("built-in elements: <show>", () => {
    let host: HTMLDivElement;

    beforeEach(() => {
        host = document.createElement("div");
        document.body.appendChild(host);
    });

    it("toggles display between 'contents' and 'none'", () => {
        host.innerHTML = `<show condition="open"><p>menu</p></show>`;
        const ctx = scanDirectives(host);
        expect(ctx.showElements).toHaveLength(1);

        updateShowElements(ctx.showElements, { open: true }, makeEval());
        expect((host.querySelector("show") as HTMLElement).style.display).toBe(
            "contents",
        );

        updateShowElements(ctx.showElements, { open: false }, makeEval());
        expect((host.querySelector("show") as HTMLElement).style.display).toBe(
            "none",
        );
    });
});

describe("built-in elements: <for>", () => {
    let host: HTMLDivElement;

    beforeEach(() => {
        host = document.createElement("div");
        document.body.appendChild(host);
    });

    it("renders one element per item with a single child template", () => {
        host.innerHTML = `<ul><for each="item in items"><li>{item}</li></for></ul>`;
        const ctx = scanDirectives(host);
        expect(ctx.loops).toHaveLength(1);

        renderLoops(ctx.loops, { items: ["a", "b", "c"] }, makeEval());
        const lis = host.querySelectorAll("li");
        expect(lis).toHaveLength(3);
    });

    it("supports multiple top-level children by wrapping in display:contents span", () => {
        host.innerHTML = `<for each="x in xs"><span>a</span><span>b</span></for>`;
        const ctx = scanDirectives(host);
        expect(ctx.loops).toHaveLength(1);

        renderLoops(ctx.loops, { xs: [1, 2] }, makeEval());
        const wrappers = host.querySelectorAll(
            'span[style*="display"], span[style*="contents"]',
        );
        // Two iterations × one wrapper each.
        expect(wrappers.length).toBeGreaterThanOrEqual(2);
        // Six leaf spans total are inside the wrappers.
        expect(host.querySelectorAll("span").length).toBeGreaterThanOrEqual(6);
    });

    it("uses key attribute for keyed diffing", () => {
        host.innerHTML = `<for each="u in users" key="u.id"><div>{u.name}</div></for>`;
        const ctx = scanDirectives(host);
        expect(ctx.loops[0].keyAttribute).toBe("u.id");
    });

    it("warns when each attribute is missing", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
        host.innerHTML = `<for><li>x</li></for>`;
        scanDirectives(host);
        // We do not assert exact text — just that we warned.
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});

describe("built-in elements: <lazy> strategy resolution", () => {
    function el(html: string): Element {
        const d = document.createElement("div");
        d.innerHTML = html;
        return d.firstElementChild!;
    }

    it("returns null for eager", () => {
        expect(resolveLazyStrategy(el(`<lazy eager></lazy>`))).toBeNull();
    });

    it("picks interaction over media", () => {
        const fn = resolveLazyStrategy(
            el(`<lazy interaction="click" media="(max-width: 1px)"></lazy>`),
        );
        expect(typeof fn).toBe("function");
    });

    it("picks delay when delay attribute is set", () => {
        const fn = resolveLazyStrategy(el(`<lazy delay="100"></lazy>`));
        expect(typeof fn).toBe("function");
    });

    it("picks idle when idle attribute is set", () => {
        expect(typeof resolveLazyStrategy(el(`<lazy idle></lazy>`))).toBe(
            "function",
        );
        expect(
            typeof resolveLazyStrategy(el(`<lazy idle-timeout="2000"></lazy>`)),
        ).toBe("function");
    });

    it("defaults to lazyOnVisible with margin/threshold options", () => {
        MockIntersectionObserver.reset();
        const fn = resolveLazyStrategy(
            el(`<lazy margin="50px" threshold="0.5"></lazy>`),
        )!;
        const target = document.createElement("div");
        fn(() => { }, target);
        expect(MockIntersectionObserver.instances.length).toBe(1);
    });
});

describe("built-in elements: <lazy> inline content", () => {
    let host: HTMLDivElement;

    beforeEach(() => {
        host = document.createElement("div");
        document.body.appendChild(host);
        MockIntersectionObserver.reset();
    });

    it("renders inline content immediately when eager", () => {
        host.innerHTML = `<lazy eager><p data-real>real</p></lazy>`;
        scanDirectives(host);
        expect(host.querySelector("[data-real]")).not.toBeNull();
    });

    it("delays inline content until the strategy fires (delay)", async () => {
        vi.useFakeTimers();
        host.innerHTML = `<lazy delay="50"><p data-real>real</p></lazy>`;
        scanDirectives(host);
        expect(host.querySelector("[data-real]")).toBeNull();

        vi.advanceTimersByTime(60);
        expect(host.querySelector("[data-real]")).not.toBeNull();
        vi.useRealTimers();
    });

    it("shows placeholder content while waiting", async () => {
        vi.useFakeTimers();
        host.innerHTML =
            `<lazy delay="100">` +
            `<template slot="placeholder"><span data-ph>loading</span></template>` +
            `<p data-real>real</p>` +
            `</lazy>`;
        scanDirectives(host);

        expect(host.querySelector("[data-ph]")).not.toBeNull();
        expect(host.querySelector("[data-real]")).toBeNull();

        vi.advanceTimersByTime(150);
        expect(host.querySelector("[data-ph]")).toBeNull();
        expect(host.querySelector("[data-real]")).not.toBeNull();
        vi.useRealTimers();
    });
});
