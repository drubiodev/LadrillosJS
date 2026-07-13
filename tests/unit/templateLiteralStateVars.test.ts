import { describe, it, expect, afterEach } from "vitest";
import { transformCodeToStateAccess } from "../../src/utils/stateTransform";
import { loadScripts } from "../../src/core/js/scriptParser";
import { executeModuleScriptWithReactivity } from "../../src/core/js/moduleExecutor";

/**
 * Regression tests for template-literal TEXT protection in the state-access
 * transform.
 *
 * Bug: scriptParser's transform protected "..." and '...' literals and
 * transformed `${...}` interpolations, but the plain TEXT between backticks
 * was left exposed to the reference rewrite. A reactive variable's name
 * appearing as a WORD in template text got corrupted:
 *
 *   let name = "x";
 *   let msg = `hello name world`;
 *     → `hello __state__.name world`   // literal text corrupted!
 *
 * The transform now lives in utils/stateTransform.ts (shared with
 * moduleExecutor, whose character scanner already handled this) and
 * protects template text while still transforming interpolations.
 */
describe("transformCodeToStateAccess (template literals)", () => {
    it("leaves variable names inside template TEXT untouched", () => {
        expect(
            transformCodeToStateAccess("let msg = `hello name world`;", [
                "name",
                "msg",
            ]),
        ).toBe("__state__.msg ??= `hello name world`;");
    });

    it("still transforms references inside ${...} interpolations", () => {
        expect(transformCodeToStateAccess("x = `hi ${name}!`;", ["name"])).toBe(
            "x = `hi ${__state__.name}!`;",
        );
    });

    it("handles text and interpolation mixed", () => {
        expect(
            transformCodeToStateAccess("x = `name is ${name}, ok name?`;", [
                "name",
            ]),
        ).toBe("x = `name is ${__state__.name}, ok name?`;");
    });

    it("transforms nested template literals inside interpolations", () => {
        expect(
            transformCodeToStateAccess("x = `a ${`b ${name}`} c`;", ["name"]),
        ).toBe("x = `a ${`b ${__state__.name}`} c`;");
    });

    it("protects string literals INSIDE interpolations", () => {
        expect(
            transformCodeToStateAccess('x = `${fn("name")}`;', ["name"]),
        ).toBe('x = `${fn("name")}`;');
    });

    it("expands object shorthand inside interpolations", () => {
        expect(
            transformCodeToStateAccess("x = `${JSON.stringify({ a, name })}`;", [
                "name",
            ]),
        ).toBe("x = `${JSON.stringify({ a, name: __state__.name })}`;");
    });

    it("treats an interpolation starting with an object literal as one", () => {
        expect(
            transformCodeToStateAccess("x = `${{ a, name }}`;", ["name"]),
        ).toBe("x = `${{ a, name: __state__.name }}`;");
    });

    it("restores strings containing replacement patterns literally", () => {
        expect(
            transformCodeToStateAccess('let s = "$& $\' $1"; name = s;', [
                "name",
            ]),
        ).toBe('let s = "$& $\' $1"; __state__.name = s;');
    });

    it("skips declaration rewriting when rewriteDeclarations is false", () => {
        expect(
            transformCodeToStateAccess(
                "function f() { name = name + 1; }",
                ["name"],
                { rewriteDeclarations: false },
            ),
        ).toBe("function f() { __state__.name = __state__.name + 1; }");
    });
});

describe("template literal text in component scripts (end to end)", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    const scriptEl = (content: string) =>
        ({ content, type: "text/javascript", external: false }) as any;

    it("does not corrupt template TEXT in regular scripts", async () => {
        const host = document.createElement("div");
        document.body.appendChild(host);

        const script = `
            let name = "Dan";
            let msg = \`hello name world\`;
            let greet = \`hi \${name}!\`;
        `;

        const state = await loadScripts(host, [scriptEl(script)], []);
        expect(state.msg).toBe("hello name world");
        expect(state.greet).toBe("hi Dan!");
    });

    it("does not corrupt template TEXT in event-handler funcDefs", async () => {
        const host = document.createElement("div");
        host.innerHTML = `<button $on:click="go()">Go</button>`;
        document.body.appendChild(host);

        const script = `
            let name = "Dan";
            let out = "";
            function go() {
                out = \`name says \${name}\`;
            }
        `;

        const state = await loadScripts(host, [scriptEl(script)], []);
        host.querySelector("button")!.dispatchEvent(new Event("click"));
        expect(state.out).toBe("name says Dan");
    });

    it("does not corrupt template TEXT in module scripts", async () => {
        const state: Record<string, unknown> = {};
        await executeModuleScriptWithReactivity(
            {
                content: `
                    let name = "mod";
                    let msg = \`hello name\`;
                    let greet = \`hi \${name}!\`;
                `,
                type: "module",
                external: false,
            } as any,
            "http://localhost/comp.html",
            "template-text-module-test",
            new Map(),
            state,
        );

        expect(state.msg).toBe("hello name");
        expect(state.greet).toBe("hi mod!");
    });
});
