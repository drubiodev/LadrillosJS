import { describe, it, expect, beforeEach } from "vitest";
import {
    scanDirectives,
    renderLoops,
} from "../../src/core/directives/directiveProcessor";

function evaluator(expr: string, context: Record<string, unknown>): unknown {
    // Minimal evaluator sufficient for tests: uses Function constructor with
    // the context's keys bound as parameters.
    const keys = Object.keys(context);
    const values = keys.map((k) => (context as any)[k]);
    try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(...keys, `return (${expr});`);
        return fn(...values);
    } catch {
        return undefined;
    }
}

describe("<if>/<else> inside <for> templates", () => {
    let host: HTMLElement;

    beforeEach(() => {
        host = document.createElement("div");
        document.body.appendChild(host);
    });

    it("renders the if branch for matching items and the else branch otherwise", () => {
        host.innerHTML = `
      <for each="color in colors">
        <if condition="color === 'red'">
          <div class="red">This is red</div>
        </if>
        <else>
          <div class="other">is {color}</div>
        </else>
      </for>
    `;

        const ctx = scanDirectives(host);
        const state = { colors: ["red", "green", "blue", "red", "orange"] };
        renderLoops(ctx.loops, state, evaluator);

        const reds = host.querySelectorAll(".red");
        const others = host.querySelectorAll(".other");
        expect(reds.length).toBe(2);
        expect(others.length).toBe(3);

        const otherTexts = Array.from(others).map((e) => e.textContent?.trim());
        expect(otherTexts).toEqual(["is green", "is blue", "is orange"]);

        const redTexts = Array.from(reds).map((e) => e.textContent?.trim());
        expect(redTexts).toEqual(["This is red", "This is red"]);
    });

    it("re-evaluates branches when items change", () => {
        host.innerHTML = `
      <for each="color in colors">
        <if condition="color === 'red'">
          <div class="red">red!</div>
        </if>
        <else>
          <div class="other">{color}</div>
        </else>
      </for>
    `;

        const ctx = scanDirectives(host);
        const state: { colors: string[] } = { colors: ["red", "green"] };
        renderLoops(ctx.loops, state, evaluator);

        expect(host.querySelectorAll(".red").length).toBe(1);
        expect(host.querySelectorAll(".other").length).toBe(1);

        state.colors = ["green", "red"];
        renderLoops(ctx.loops, state, evaluator);

        expect(host.querySelectorAll(".red").length).toBe(1);
        expect(host.querySelectorAll(".other").length).toBe(1);
        // First rendered element should now be the "other" branch (green)
        const all = Array.from(host.querySelectorAll(".red, .other"));
        expect(all[0].className).toBe("other");
        expect(all[1].className).toBe("red");
    });
});
