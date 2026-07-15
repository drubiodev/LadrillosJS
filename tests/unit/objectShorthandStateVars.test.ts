import { describe, it, expect, afterEach } from "vitest";
import { replaceVarWithStateAccess } from "../../src/utils/stateTransform";
import { loadScripts } from "../../src/core/js/scriptParser";
import { executeModuleScriptWithReactivity } from "../../src/core/js/moduleExecutor";
import { createEventBusHelpers } from "../../src/core/events/eventBus";

/**
 * Regression tests for ES6 object-literal shorthand with reactive variables.
 *
 * Bug: the state-access transform rewrote every standalone reference to a
 * reactive variable as `__state__.varName`. Inside object-literal shorthand
 * that produced invalid syntax:
 *
 *   $emit("chat:message", { text, name });
 *     → $emit("chat:message", { text, __state__.name });   // SyntaxError!
 *
 * The SyntaxError killed the ENTIRE component script (state never
 * initialized) and the inline event handlers built from it. The fix expands
 * shorthand to an explicit key instead: `{ text, name: __state__.name }`.
 */
describe("replaceVarWithStateAccess", () => {
    it("expands object-literal shorthand to an explicit key", () => {
        expect(
            replaceVarWithStateAccess("$emit(EVT, { text, name })", "name"),
        ).toBe("$emit(EVT, { text, name: __state__.name })");
    });

    it("expands shorthand in first, middle and last slots", () => {
        expect(replaceVarWithStateAccess("x = { name, a }", "name")).toBe(
            "x = { name: __state__.name, a }",
        );
        expect(replaceVarWithStateAccess("x = { a, name, b }", "name")).toBe(
            "x = { a, name: __state__.name, b }",
        );
        expect(replaceVarWithStateAccess("x = { a, name }", "name")).toBe(
            "x = { a, name: __state__.name }",
        );
    });

    it("expands shorthand in a returned object literal", () => {
        expect(replaceVarWithStateAccess("return { name };", "name")).toBe(
            "return { name: __state__.name };",
        );
    });

    it("expands shorthand in nested object literals", () => {
        expect(
            replaceVarWithStateAccess("fn({ a: 1, b: { name } })", "name"),
        ).toBe("fn({ a: 1, b: { name: __state__.name } })");
    });

    it("expands shorthand in a destructuring ASSIGNMENT (writes to state)", () => {
        expect(replaceVarWithStateAccess("({ name } = obj)", "name")).toBe(
            "({ name: __state__.name } = obj)",
        );
    });

    it("still rewrites plain references and assignments", () => {
        expect(replaceVarWithStateAccess("name = other(name)", "name")).toBe(
            "__state__.name = other(__state__.name)",
        );
    });

    it("does not treat an assignment inside a block as shorthand", () => {
        expect(
            replaceVarWithStateAccess("if (x) { name = 1; }", "name"),
        ).toBe("if (x) { __state__.name = 1; }");
    });

    it("rewrites call arguments and array elements normally", () => {
        expect(replaceVarWithStateAccess("foo(a, name, b)", "name")).toBe(
            "foo(a, __state__.name, b)",
        );
        expect(replaceVarWithStateAccess("[a, name, b]", "name")).toBe(
            "[a, __state__.name, b]",
        );
    });

    it("rewrites spread references inside object literals", () => {
        expect(replaceVarWithStateAccess("x = { ...name }", "name")).toBe(
            "x = { ...__state__.name }",
        );
    });

    it("leaves object keys and property accesses untouched", () => {
        expect(replaceVarWithStateAccess("x = { name: 1 }", "name")).toBe(
            "x = { name: 1 }",
        );
        expect(replaceVarWithStateAccess("obj.name", "name")).toBe("obj.name");
    });

    it("leaves destructuring DECLARATIONS untouched (local shadow)", () => {
        expect(replaceVarWithStateAccess("const { name } = obj;", "name")).toBe(
            "const { name } = obj;",
        );
        expect(
            replaceVarWithStateAccess("let { a, name } = obj;", "name"),
        ).toBe("let { a, name } = obj;");
    });
});

describe("object shorthand in component scripts (end to end)", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    const scriptEl = (content: string) =>
        ({ content, type: "text/javascript", external: false }) as any;

    it("compiles the script and keeps handlers working (chat repro)", async () => {
        const host = document.createElement("div");
        host.innerHTML = `<button $on:click="send()">Send</button>`;
        document.body.appendChild(host);

        const script = `
            let draft = "hello";
            let name = "Dan";

            function send() {
                const text = draft.trim();
                if (!text) return;
                $emit("chat:message", { text, time: "now", name });
                draft = "";
            }
        `;

        const received: unknown[] = [];
        const listener = createEventBusHelpers("shorthand-test-listener");
        const unsub = listener.$listen("chat:message", (data: unknown) => {
            received.push(data);
        });

        try {
            const state = await loadScripts(host, [scriptEl(script)], []);

            // Before the fix the whole script died with a SyntaxError,
            // so these never made it into state.
            expect(state.draft).toBe("hello");
            expect(state.name).toBe("Dan");

            host.querySelector("button")!.dispatchEvent(new Event("click"));

            expect(received).toEqual([
                { text: "hello", time: "now", name: "Dan" },
            ]);
            // The write inside send() still reaches reactive state
            expect(state.draft).toBe("");
        } finally {
            unsub();
        }
    });

    it("supports shorthand in module scripts", async () => {
        const state: Record<string, unknown> = {};
        const result = await executeModuleScriptWithReactivity(
            {
                content: `
                    let name = "mod";
                    function wrap() { return { name }; }
                `,
                type: "module",
                external: false,
            } as any,
            "http://localhost/comp.html",
            "shorthand-module-test",
            new Map(),
            state,
        );

        expect(state.name).toBe("mod");
        const wrap = result.wrap as () => { name: string };
        expect(wrap()).toEqual({ name: "mod" });
    });
});
