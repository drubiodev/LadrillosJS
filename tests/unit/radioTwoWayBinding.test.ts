import { describe, it, expect, beforeEach } from "vitest";
import { loadScripts } from "../../src/core/js/scriptParser";
import
    {
        scanDirectives,
        setupTwoWayBindings,
    } from "../../src/core/directives/directiveProcessor";

/**
 * Regression tests for `$bind` on radio inputs — a documented feature
 * (docs/09-two-way-binding.md) that did not work in either direction.
 *
 * Bug: setElementValue had a branch for `checkbox` but none for `radio`, so
 * radios fell through to `element.value = String(value)`. That rewrote every
 * radio's OWN value to the bound state value, which both (a) failed to check
 * the member matching the state and (b) collapsed the group, so the next
 * change event read back the value the framework had just written and state
 * never moved.
 *
 * A radio group binds ONE value across SEVERAL inputs: the bound value
 * selects a member, it does not overwrite each member's value.
 */
describe("$bind on radio inputs", () =>
{
    let host: HTMLDivElement;

    beforeEach(() =>
    {
        host = document.createElement("div");
        document.body.appendChild(host);
    });

    const evalFn = (expr: string, c: Record<string, unknown>) =>
    {
        try
        {
            return new Function(...Object.keys(c), `return (${expr});`)(
                ...Object.values(c),
            );
        } catch
        {
            return undefined;
        }
    };

    const mount = async (initial: string) =>
    {
        host.innerHTML = `
            <label><input type="radio" name="size" value="small" $bind="size" /></label>
            <label><input type="radio" name="size" value="medium" $bind="size" /></label>
            <label><input type="radio" name="size" value="large" $bind="size" /></label>
        `;

        const state = await loadScripts(
            host,
            [
                {
                    content: `let size = "${initial}";`,
                    type: "text/javascript",
                    external: false,
                } as any,
            ],
            [],
        );

        const ctx = scanDirectives(host);
        setupTwoWayBindings(ctx.twoWayBindings, state, evalFn);

        return {
            state,
            radios: Array.from(
                host.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
            ),
        };
    };

    it("checks the radio matching the initial state value", async () =>
    {
        const { radios } = await mount("medium");
        expect(radios.map((r) => r.checked)).toEqual([false, true, false]);
    });

    it("never rewrites the individual radio values", async () =>
    {
        const { radios } = await mount("medium");
        expect(radios.map((r) => r.value)).toEqual(["small", "medium", "large"]);
    });

    it("writes the picked value back to state", async () =>
    {
        const { state, radios } = await mount("medium");

        radios[2].checked = true;
        radios[2].dispatchEvent(new Event("change", { bubbles: true }));

        expect(state.size).toBe("large");
        expect(radios.map((r) => r.value)).toEqual(["small", "medium", "large"]);
    });
});
