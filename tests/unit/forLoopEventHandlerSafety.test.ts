import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadScripts } from "../../src/core/js/scriptParser";
import {
    scanDirectives,
    renderLoops,
} from "../../src/core/directives/directiveProcessor";

/**
 * Security regression test for loop event handlers.
 *
 * Loop handlers used to have their `{expr}` bindings STRING-INTERPOLATED into
 * the handler source before compilation, so an untrusted list-item value could
 * break out of the expression and execute as code (an injection sink). The fix
 * turns `{expr}` inside a handler into a scoped sub-expression that is EVALUATED
 * against the loop/state variables instead, so item data is passed as a value
 * and never spliced into source.
 *
 * These tests pin that behavior:
 *   1. A malicious item value is passed as a plain argument, not executed.
 *   2. The `{item.field}` brace form still works (same result as bare form).
 */
describe("<for> event-handler injection safety", () => {
    let host: HTMLDivElement;
    const PWNED_FLAG = "__ladrillosInjectionTestPwned";

    beforeEach(() => {
        host = document.createElement("div");
        document.body.appendChild(host);
        delete (globalThis as any)[PWNED_FLAG];
    });

    afterEach(() => {
        host.remove();
        delete (globalThis as any)[PWNED_FLAG];
    });

    const evalFn = (expr: string, c: Record<string, unknown>) => {
        try {
            return new Function(...Object.keys(c), `return (${expr});`)(
                ...Object.values(c),
            );
        } catch {
            return undefined;
        }
    };

    it("passes a malicious item value as data instead of executing it", async () => {
        // Crafted so that IF it were spliced into `pick(<value>)` as source, the
        // result — `pick(0); globalThis.FLAG = true; void(0)` — is valid JS that
        // executes and sets the flag. Passed as a value, it stays an inert string.
        const payload = `0); globalThis.${PWNED_FLAG} = true; void(0`;

        host.innerHTML = `
            <ul>
                <for each="item in items">
                    <li><button class="pick" onclick="pick({item})">go</button></li>
                </for>
            </ul>
        `;

        const scriptContent = `
            let items = [${JSON.stringify(payload)}];
            let received = null;
            function pick(v) { received = v; }
        `;

        const state = await loadScripts(
            host,
            [{ content: scriptContent, type: "text/javascript", external: false } as any],
            [],
        );

        const ctx = scanDirectives(host);
        renderLoops(ctx.loops, state, evalFn);

        (host.querySelector("button.pick") as HTMLButtonElement).click();

        // The payload was NOT executed as code...
        expect((globalThis as any)[PWNED_FLAG]).toBeUndefined();
        // ...and the raw string was handed to the handler as an argument.
        expect((state as any).received).toBe(payload);
    });

    it("supports the {item.field} brace form (evaluated as a scoped expression)", async () => {
        host.innerHTML = `
            <ul>
                <for each="todo in todos" key="todo.id">
                    <li><button class="del" onclick="removeTodo({todo.id})">x</button></li>
                </for>
            </ul>
        `;

        const scriptContent = `
            let todos = [{ id: 1 }, { id: 2 }, { id: 3 }];
            function removeTodo(id) {
                todos = todos.filter((t) => t.id !== id);
            }
        `;

        const state = await loadScripts(
            host,
            [{ content: scriptContent, type: "text/javascript", external: false } as any],
            [],
        );

        const ctx = scanDirectives(host);
        renderLoops(ctx.loops, state, evalFn);

        const buttons = host.querySelectorAll("button.del");
        expect(buttons.length).toBe(3);

        // Clicking the second row removes todo id 2 — proving `{todo.id}` resolved
        // to the actual value 2 for that iteration.
        (buttons[1] as HTMLButtonElement).click();
        expect((state as any).todos.map((t: any) => t.id)).toEqual([1, 3]);
    });
});
