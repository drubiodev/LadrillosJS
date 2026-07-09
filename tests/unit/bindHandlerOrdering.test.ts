import { describe, it, expect, beforeEach } from "vitest";
import { loadScripts } from "../../src/core/js/scriptParser";
import {
    scanDirectives,
    setupTwoWayBindings,
} from "../../src/core/directives/directiveProcessor";

/**
 * Regression test: an inline handler on the same event as $bind (e.g.
 * onchange next to $bind on a <select>) must see the NEW value in state.
 *
 * Bug: transformInlineEventHandlers registers the user's change listener
 * before setupTwoWayBindings registers $bind's listener, so the user
 * handler read the previous value from state (off-by-one on every pick).
 * Fixed by syncing the bound element's value into state before the user
 * handler body runs (syncBindBeforeHandler).
 */
describe("$bind + inline handler on the same event", () => {
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

    it("onchange sees the freshly selected value, not the previous one", async () => {
        host.innerHTML = `
            <select $bind="selected" onchange="onPicked()">
                <option value="a">a</option>
                <option value="b">b</option>
                <option value="c">c</option>
            </select>
        `;

        const scriptContent = `
            let selected = "a";
            let picked = "";
            function onPicked() {
                picked = selected;
            }
        `;

        const state = await loadScripts(
            host,
            [{ content: scriptContent, type: "text/javascript", external: false } as any],
            [],
        );

        const ctx = scanDirectives(host);
        setupTwoWayBindings(ctx.twoWayBindings, state, evalFn);

        const select = host.querySelector("select")!;
        select.value = "b";
        select.dispatchEvent(new Event("change", { bubbles: true }));

        // Without the sync, the handler would have read the stale "a"
        expect(state.picked).toBe("b");
        expect(state.selected).toBe("b");

        select.value = "c";
        select.dispatchEvent(new Event("change", { bubbles: true }));

        expect(state.picked).toBe("c");
        expect(state.selected).toBe("c");
    });
});
