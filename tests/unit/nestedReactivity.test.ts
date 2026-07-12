import { describe, it, expect, beforeEach, vi } from "vitest";
import { createReactiveState } from "../../src/core/js/reactivity";
import { loadScripts } from "../../src/core/js/scriptParser";
import {
    scanDirectives,
    setupTwoWayBindings,
} from "../../src/core/directives/directiveProcessor";
import type { BindingDescriptor } from "../../src/types";

/**
 * Regression test: writes to NESTED state paths must trigger reactivity.
 *
 * Bug: the reactive Proxy only trapped `set` on top-level keys. A write
 * like `user.profile.name = "Ada"` — from a component script or from
 * $bind's setNestedValue — mutated the raw nested object directly, so no
 * bindings updated and the DOM went stale. Fixed by lazily wrapping nested
 * plain objects in deep proxies (get trap) that trigger updates for the
 * root state key.
 */
describe("nested state reactivity", () => {
    describe("createReactiveState deep writes", () => {
        it("triggers bindings for the root key on a nested write", () => {
            const node = document.createTextNode("");
            const descriptor: BindingDescriptor = {
                node,
                bindings: [
                    { raw: "user.profile.name", path: ["user", "profile", "name"] },
                ],
                original: "Hello, {user.profile.name}!",
            };

            const updateBinding = vi.fn();
            const onStateChange = vi.fn();

            const state = createReactiveState(
                { user: { profile: { name: "Daniel" } } },
                [descriptor],
                updateBinding,
                onStateChange,
            );

            (state.user as any).profile.name = "Ada";

            expect((state.user as any).profile.name).toBe("Ada");
            expect(updateBinding).toHaveBeenCalledWith(
                descriptor,
                expect.anything(),
            );
            expect(onStateChange).toHaveBeenCalled();
        });

        it("does not trigger when the nested value is unchanged", () => {
            const onStateChange = vi.fn();
            const state = createReactiveState(
                { user: { profile: { name: "Daniel" } } },
                [],
                vi.fn(),
                onStateChange,
            );

            (state.user as any).profile.name = "Daniel";
            expect(onStateChange).not.toHaveBeenCalled();
        });

        it("triggers on adding a new nested key and on delete", () => {
            const onStateChange = vi.fn();
            const state = createReactiveState(
                { user: { profile: {} } },
                [],
                vi.fn(),
                onStateChange,
            );

            (state.user as any).profile.age = 30;
            expect(onStateChange).toHaveBeenCalledTimes(1);

            delete (state.user as any).profile.age;
            expect(onStateChange).toHaveBeenCalledTimes(2);
        });

        it("keeps deep proxy identity stable across reads", () => {
            const state = createReactiveState(
                { user: { profile: { name: "Daniel" } } },
                [],
                vi.fn(),
            );
            expect(state.user).toBe(state.user);
            expect((state.user as any).profile).toBe((state.user as any).profile);
        });

        it("makes arrays assigned into nested objects reactive", () => {
            const onStateChange = vi.fn();
            const state = createReactiveState(
                { user: { profile: {} } },
                [],
                vi.fn(),
                onStateChange,
            );

            (state.user as any).profile.tags = ["a"];
            onStateChange.mockClear();

            (state.user as any).profile.tags.push("b");
            expect(onStateChange).toHaveBeenCalled();
            expect((state.user as any).profile.tags.length).toBe(2);
        });
    });

    describe("$bind on a nested path", () => {
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

        it("typing into the input updates state and dependent text bindings", async () => {
            host.innerHTML = `
                <input $bind="user.profile.name" />
                <p></p>
            `;
            const p = host.querySelector("p")!;
            const textNode = document.createTextNode("Hello, {user.profile.name}!");
            p.appendChild(textNode);

            const descriptor: BindingDescriptor = {
                node: textNode,
                bindings: [
                    { raw: "user.profile.name", path: ["user", "profile", "name"] },
                ],
                original: "Hello, {user.profile.name}!",
            };

            const scriptContent = `
                let user = { profile: { name: "Daniel" } };
            `;

            const state = await loadScripts(
                host,
                [{ content: scriptContent, type: "text/javascript", external: false } as any],
                [descriptor],
            );

            const ctx = scanDirectives(host);
            setupTwoWayBindings(ctx.twoWayBindings, state, evalFn);

            const input = host.querySelector("input")!;

            // Initial state→input sync picked up the nested value
            expect(input.value).toBe("Daniel");
            expect(textNode.textContent).toBe("Hello, Daniel!");

            // Simulate the user typing
            input.value = "Ada";
            input.dispatchEvent(new Event("input", { bubbles: true }));

            expect((state.user as any).profile.name).toBe("Ada");
            expect(textNode.textContent).toBe("Hello, Ada!");
        });
    });
});
