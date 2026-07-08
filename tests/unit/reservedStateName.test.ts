import { describe, it, expect } from "vitest";
import { parseComponent } from "../../src/core/component/extract";
import { createWebComponentClass } from "../../src/core/component/webcomponent";

/**
 * Regression tests for the reserved instance-member name `state`.
 *
 * A component may legitimately declare a reactive state variable named `state`
 * (e.g. `let state = "idle"`). The prop-accessor machinery must NOT generate a
 * `state` getter/setter on the component prototype for it: the component itself
 * owns a `state` instance field, and a generated getter that reads
 * `this.state[name]` would call itself and blow the stack
 * (RangeError: Maximum call stack size exceeded).
 *
 * The variable must still work as ordinary reactive state (stored as
 * `this.state.state`).
 */
describe("reserved `state` variable name", () =>
{
    it("does not define a prototype `state` accessor that shadows the field", async () =>
    {
        const source = `<p>{state}</p><script>let state = "idle";</script>`;
        const component = await parseComponent(source, "state-comp");

        const Klass = createWebComponentClass(component, true);

        // No own accessor named `state` may be installed on the prototype —
        // that would shadow the component's `state` field and recurse.
        const descriptor = Object.getOwnPropertyDescriptor(
            Klass.prototype,
            "state",
        );
        expect(descriptor?.get).toBeUndefined();
        expect(descriptor?.set).toBeUndefined();
    });

    it("still registers accessors for ordinary props", async () =>
    {
        const source = `<p>{items}</p><script>let items = [];</script>`;
        const component = await parseComponent(source, "items-comp");

        const Klass = createWebComponentClass(component, true);

        // A normal prop like `items` DOES get a prototype accessor so parents
        // can pass typed values via the DOM-property channel.
        const descriptor = Object.getOwnPropertyDescriptor(
            Klass.prototype,
            "items",
        );
        expect(typeof descriptor?.get).toBe("function");
        expect(typeof descriptor?.set).toBe("function");
    });
});
