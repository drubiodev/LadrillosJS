import { describe, it, expect, vi } from "vitest";
import { createReactiveState } from "../../src/core/js/reactivity";
import type { BindingDescriptor } from "../../src/types";

const makeDescriptor = (raw: string): BindingDescriptor => {
    const node = document.createTextNode(`{${raw}}`);
    return {
        node,
        bindings: [{ raw, path: raw.split(".") }],
        original: `{${raw}}`,
        isAttribute: false,
    } as unknown as BindingDescriptor;
};

describe("array mutations update dependent bindings", () => {
    it("reassignment triggers updateBinding for {items.length}", () => {
        const updateBinding = vi.fn();
        const onStateChange = vi.fn();
        const descriptor = makeDescriptor("items.length");
        const state = createReactiveState(
            { items: [1, 2] },
            [descriptor],
            updateBinding,
            onStateChange,
        );
        state.items = [1, 2, 3];
        expect(updateBinding).toHaveBeenCalledWith(descriptor, expect.anything());
        expect(onStateChange).toHaveBeenCalled();
    });

    it("push on a top-level array updates bindings like a reassignment", () => {
        const updateBinding = vi.fn();
        const onStateChange = vi.fn();
        const descriptor = makeDescriptor("items.length");
        const state = createReactiveState(
            { items: [1, 2] },
            [descriptor],
            updateBinding,
            onStateChange,
        );
        (state.items as number[]).push(3);
        expect(onStateChange).toHaveBeenCalled();
        expect(updateBinding).toHaveBeenCalledWith(descriptor, expect.anything());
        expect((state.items as number[]).length).toBe(3);
    });

    it("splice and index assignment on a reassigned array update bindings", () => {
        const updateBinding = vi.fn();
        const descriptor = makeDescriptor("items");
        const state = createReactiveState(
            { items: [] as number[] },
            [descriptor],
            updateBinding,
            vi.fn(),
        );
        state.items = [1, 2, 3];
        updateBinding.mockClear();

        (state.items as number[]).splice(0, 1);
        expect(updateBinding).toHaveBeenCalledTimes(1);

        (state.items as number[])[0] = 99;
        expect(updateBinding).toHaveBeenCalledTimes(2);
    });

    it("push on an array nested in initial state updates the root key's bindings", () => {
        const updateBinding = vi.fn();
        const descriptor = makeDescriptor("user.tags.length");
        const state = createReactiveState(
            { user: { tags: ["a"] } },
            [descriptor],
            updateBinding,
            vi.fn(),
        );
        ((state.user as any).tags as string[]).push("b");
        expect(updateBinding).toHaveBeenCalledWith(descriptor, expect.anything());
    });

    it("push on an array assigned into a nested object updates the root key's bindings", () => {
        const updateBinding = vi.fn();
        const descriptor = makeDescriptor("user.tags.length");
        const state = createReactiveState(
            { user: { name: "x" } },
            [descriptor],
            updateBinding,
            vi.fn(),
        );
        (state.user as any).tags = ["a"];
        updateBinding.mockClear();
        (state.user as any).tags.push("b");
        expect(updateBinding).toHaveBeenCalledWith(descriptor, expect.anything());
    });

    it("suspended reactivity: push skips binding updates but still notifies directives", () => {
        const updateBinding = vi.fn();
        const onStateChange = vi.fn();
        const descriptor = makeDescriptor("items.length");
        const state = createReactiveState(
            { items: [1] },
            [descriptor],
            updateBinding,
            onStateChange,
        );
        (state as any).__suspendReactivity = true;
        (state.items as number[]).push(2);
        expect(updateBinding).not.toHaveBeenCalled();
        expect(onStateChange).toHaveBeenCalled();

        (state as any).__suspendReactivity = false;
        (state.items as number[]).push(3);
        expect(updateBinding).toHaveBeenCalledWith(descriptor, expect.anything());
    });
});
