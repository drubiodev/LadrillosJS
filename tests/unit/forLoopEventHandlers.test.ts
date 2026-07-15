import { describe, it, expect, beforeEach } from "vitest";
import { loadScripts } from "../../src/core/js/scriptParser";
import {
    scanDirectives,
    renderLoops,
} from "../../src/core/directives/directiveProcessor";

/**
 * Regression test: onclick handlers using loop variables (e.g. `removeTask(i)`)
 * inside a <for> built-in element must fire and have access to the loop scope.
 *
 * Bug: transformInlineEventHandlers' isInsideForLoop() only checked for the
 * legacy `$for` attribute, not the `<for>` element. As a result it stripped
 * onclick from buttons inside <for> before scanLoops extracted the template,
 * leaving cloned items without listeners.
 */
describe("<for> + onclick(loopVar) integration", () => {
    let host: HTMLDivElement;

    beforeEach(() => {
        host = document.createElement("div");
        document.body.appendChild(host);
    });

    it("fires onclick='removeTask(i)' inside <for each='(t,i) in tasks'>", async () => {
        host.innerHTML = `
            <ul>
                <for each="(task, i) in tasks">
                    <li>
                        <span class="text">{task}</span>
                        <button class="remove-btn" onclick="removeTask(i)">x</button>
                    </li>
                </for>
            </ul>
        `;

        const scriptContent = `
            let tasks = ["a", "b", "c"];
            function removeTask(i) {
                tasks = tasks.filter((_, idx) => idx !== i);
            }
        `;

        const state = await loadScripts(
            host,
            [{ content: scriptContent, type: "text/javascript", external: false } as any],
            [],
        );

        const ctx = scanDirectives(host);
        const evalFn = (expr: string, c: Record<string, unknown>) => {
            try {
                return new Function(...Object.keys(c), `return (${expr});`)(
                    ...Object.values(c),
                );
            } catch {
                return undefined;
            }
        };
        renderLoops(ctx.loops, state, evalFn);

        const buttons = host.querySelectorAll("button.remove-btn");
        expect(buttons.length).toBe(3);

        (buttons[1] as HTMLButtonElement).click();
        expect((state as any).tasks).toEqual(["a", "c"]);
    });
});
