import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadScripts } from "../../src/core/js/scriptParser";
import {
    scanDirectives,
    renderLoops,
} from "../../src/core/directives/directiveProcessor";

/**
 * Regression tests for `$bind` inside a `<for>` row.
 *
 * Bug: nothing wired `$bind` on loop-rendered elements. scanTwoWayBindings
 * skips anything under a `<for>`, and neither the creation plan nor the
 * generic binding walk looked at the directive — so a bound input in a row
 * never received its initial value and never wrote back, silently, with no
 * error. The user typed and the data stayed put.
 *
 * The binding target must be an lvalue that outlives the row: a property of
 * the row's item, or a component state variable. The row alias itself has
 * nowhere to write back to and is rejected instead of corrupting the item.
 */
describe("$bind inside <for>", () => {
    let host: HTMLDivElement;

    beforeEach(() => {
        host = document.createElement("div");
        document.body.appendChild(host);
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

    const mount = async (markup: string, script: string) => {
        host.innerHTML = markup;
        const changes: number[] = [];
        const state = await loadScripts(
            host,
            [{ content: script, type: "text/javascript", external: false } as any],
            [],
            {},
            () => changes.push(1),
        );
        const ctx = scanDirectives(host);
        const render = () => renderLoops(ctx.loops, state, evalFn);
        render();
        return { state, render, changes };
    };

    const TODOS = `
        let todos = [
            { id: 1, text: "alpha", done: false },
            { id: 2, text: "beta", done: true },
        ];
    `;

    const ROWS = `
        <for each="todo in todos" key="todo.id">
            <label>
                <input type="checkbox" $bind="todo.done" />
                <input type="text" $bind="todo.text" />
            </label>
        </for>
    `;

    const boxes = () =>
        Array.from(
            host.querySelectorAll<HTMLInputElement>("input[type=checkbox]"),
        );
    const texts = () =>
        Array.from(host.querySelectorAll<HTMLInputElement>("input[type=text]"));

    it("gives each row's inputs their initial value from the item", async () => {
        await mount(ROWS, TODOS);

        expect(boxes().map((b) => b.checked)).toEqual([false, true]);
        expect(texts().map((t) => t.value)).toEqual(["alpha", "beta"]);
    });

    it("writes a checkbox change back to that row's item", async () => {
        const { state } = await mount(ROWS, TODOS);

        boxes()[0].click();

        expect((state as any).todos[0].done).toBe(true);
        expect((state as any).todos[1].done).toBe(true);
    });

    it("writes a text edit back to that row's item", async () => {
        const { state } = await mount(ROWS, TODOS);

        const input = texts()[1];
        input.value = "BETA!";
        input.dispatchEvent(new Event("input", { bubbles: true }));

        expect((state as any).todos[1].text).toBe("BETA!");
        expect((state as any).todos[0].text).toBe("alpha");
    });

    it("announces the owning state key so dependents re-render", async () => {
        const { state, changes } = await mount(ROWS, TODOS);
        const before = changes.length;

        boxes()[0].click();

        expect((state as any).todos[0].done).toBe(true);
        expect(changes.length).toBeGreaterThan(before);
    });

    it("pushes a programmatic item change into the input on re-render", async () => {
        const { state, render } = await mount(ROWS, TODOS);

        (state as any).todos[0].done = true;
        (state as any).todos[1].text = "BETA";
        render();

        expect(boxes().map((b) => b.checked)).toEqual([true, true]);
        expect(texts().map((t) => t.value)).toEqual(["alpha", "BETA"]);
    });

    it("binds rows rendered through the generic walk (row has an <if>)", async () => {
        const { state } = await mount(
            `
            <for each="todo in todos" key="todo.id">
                <label>
                    <if condition="todo.id > 0">
                        <input type="checkbox" $bind="todo.done" />
                    </if>
                </label>
            </for>
        `,
            TODOS,
        );

        expect(boxes().map((b) => b.checked)).toEqual([false, true]);

        boxes()[0].click();
        expect((state as any).todos[0].done).toBe(true);
        expect((state as any).todos[1].done).toBe(true);
    });

    it("writes to the item a reused row currently holds, not the original", async () => {
        const { state, render } = await mount(ROWS, TODOS);
        const firstRowBox = boxes()[0];

        // Keyed reuse: row for id 2 moves into position 0 and keeps its DOM.
        (state as any).todos = [
            (state as any).todos[1],
            (state as any).todos[0],
        ];
        render();

        // The element now at position 0 belongs to id 2 after the reorder.
        expect(boxes()[1]).toBe(firstRowBox);
        expect(boxes()[0].checked).toBe(true);

        boxes()[0].click();

        expect((state as any).todos[0].id).toBe(2);
        expect((state as any).todos[0].done).toBe(false);
        expect((state as any).todos[1].done).toBe(false);
    });

    it("rejects binding the row alias instead of corrupting the item", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            const { state } = await mount(
                `
                <for each="todo in todos" key="todo.id">
                    <input type="text" $bind="todo" />
                </for>
            `,
                TODOS,
            );

            const input = texts()[0];
            input.value = "hopper";
            input.dispatchEvent(new Event("input", { bubbles: true }));

            expect(Object.keys((state as any).todos[0])).toEqual([
                "id",
                "text",
                "done",
            ]);
            expect((state as any).todos[0].text).toBe("alpha");
            expect(spy).toHaveBeenCalled();
            expect(String(spy.mock.calls[0].join(" "))).toContain("$bind");
        } finally {
            spy.mockRestore();
        }
    });

    it("rejects a row alias over primitives too", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            const { state } = await mount(
                `
                <for each="name in names">
                    <input type="text" $bind="name" />
                </for>
            `,
                `let names = ["ada", "grace"];`,
            );

            const input = texts()[0];
            input.value = "hopper";
            input.dispatchEvent(new Event("input", { bubbles: true }));

            expect((state as any).names).toEqual(["ada", "grace"]);
            expect(spy).toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });

    it("still binds a component state variable used inside a row", async () => {
        const { state } = await mount(
            `
            <for each="todo in todos" key="todo.id">
                <input type="text" $bind="draft" />
            </for>
        `,
            `${TODOS}\nlet draft = "hi";`,
        );

        expect(texts().map((t) => t.value)).toEqual(["hi", "hi"]);

        const input = texts()[1];
        input.value = "typed";
        input.dispatchEvent(new Event("input", { bubbles: true }));

        expect((state as any).draft).toBe("typed");
    });
});
