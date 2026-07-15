import { describe, it, expect, vi, afterEach } from "vitest";
import {
    createReactiveState,
    createReactiveArray,
} from "../../src/core/js/reactivity";
import {
    transformImportsForReactivity,
    generateHelperInjectionCode,
} from "../../src/core/js/moduleExecutor";
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

afterEach(() => {
    delete (globalThis as any).__ladrillosStateCallbacks;
});

describe("__notifyKeyChanged external mutation channel", () => {
    it("triggers per-key binding updates like a reassignment", () => {
        const updateBinding = vi.fn();
        const onStateChange = vi.fn();
        const descriptor = makeDescriptor("items.length");
        const state = createReactiveState(
            { items: [1] },
            [descriptor],
            updateBinding,
            onStateChange,
        );
        (state as any).__notifyKeyChanged("items");
        expect(updateBinding).toHaveBeenCalledWith(descriptor, expect.anything());
        expect(onStateChange).toHaveBeenCalled();
    });

    it("is safe for keys with no registered bindings", () => {
        const updateBinding = vi.fn();
        const onStateChange = vi.fn();
        const state = createReactiveState(
            { items: [1] },
            [],
            updateBinding,
            onStateChange,
        );
        expect(() => (state as any).__notifyKeyChanged("unknown")).not.toThrow();
        expect(updateBinding).not.toHaveBeenCalled();
        expect(onStateChange).toHaveBeenCalled();
    });

    it("skips binding updates while reactivity is suspended", () => {
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
        (state as any).__notifyKeyChanged("items");
        expect(updateBinding).not.toHaveBeenCalled();
        expect(onStateChange).toHaveBeenCalled();
    });

    it("does not appear in Object.keys(state)", () => {
        const state = createReactiveState({ items: [1] }, [], vi.fn());
        expect(Object.keys(state)).not.toContain("__notifyKeyChanged");
    });
});

describe("inline module scripts: imported arrays merged into state", () => {
    // executeModuleScriptWithReactivity wraps imported arrays with a
    // directives-only callback (resolveImports), then merges them into
    // reactive state via `reactiveState[key] = value`. That merge must
    // attach the per-key subscriber so pushes update text bindings too.
    it("push on a merged imported array updates the key's bindings and keeps the original subscriber", () => {
        const directivesOnly = vi.fn();
        const imported = createReactiveArray([1, 2], directivesOnly);

        const updateBinding = vi.fn();
        const descriptor = makeDescriptor("items.length");
        const state = createReactiveState(
            {},
            [descriptor],
            updateBinding,
            vi.fn(),
        );

        // Simulates the merge in executeModuleScriptWithReactivity
        state.items = imported;
        updateBinding.mockClear();
        directivesOnly.mockClear();

        (state.items as number[]).push(3);
        expect(updateBinding).toHaveBeenCalledWith(descriptor, expect.anything());
        expect(directivesOnly).toHaveBeenCalled();
        expect((state.items as number[]).length).toBe(3);
    });
});

describe("external module scripts: injected __wrapReactiveArray", () => {
    it("import transform passes the local binding name as the state key", () => {
        const code = `import { items, other as list } from "./data.js";\nitems.push(1);`;
        const transformed = transformImportsForReactivity(code);
        expect(transformed).toContain(
            `const items = __wrapReactiveArray(__raw_items, __ladrillos_componentId, "items");`,
        );
        expect(transformed).toContain(
            `const list = __wrapReactiveArray(__raw_list, __ladrillos_componentId, "list");`,
        );
    });

    /** Evaluates the injected helper code and returns __wrapReactiveArray. */
    const buildInjectedWrapper = (componentId: string) => {
        const helperCode = generateHelperInjectionCode(
            componentId,
            "http://localhost/component.html",
        );
        return new Function(
            `${helperCode}\nreturn __wrapReactiveArray;`,
        )() as (arr: unknown, componentId: string, stateKey?: string) => unknown;
    };

    it("mutations report the state key to the component callback", () => {
        const wrap = buildInjectedWrapper("comp-1");
        const callback = vi.fn();
        (globalThis as any).__ladrillosStateCallbacks = new Map([
            ["comp-1", callback],
        ]);

        const items = wrap([1, 2], "comp-1", "items") as number[];
        items.push(3);
        expect(callback).toHaveBeenCalledWith("items");

        callback.mockClear();
        items[0] = 99;
        expect(callback).toHaveBeenCalledWith("items");
    });

    it("module-internal push refreshes the key's bindings via the component callback", () => {
        // End-to-end wiring minus the blob import: the injected wrapper's
        // callback routes through state.__notifyKeyChanged, exactly as
        // webcomponent.ts registers it.
        const updateBinding = vi.fn();
        const descriptor = makeDescriptor("items.length");
        const state = createReactiveState(
            {},
            [descriptor],
            updateBinding,
            vi.fn(),
        );

        (globalThis as any).__ladrillosStateCallbacks = new Map([
            [
                "comp-2",
                (stateKey?: string) => {
                    if (stateKey) (state as any).__notifyKeyChanged(stateKey);
                },
            ],
        ]);

        const wrap = buildInjectedWrapper("comp-2");
        // The blob module holds this inner proxy; its exports get merged
        // into state, but module functions mutate the inner proxy directly.
        const inner = wrap(["a"], "comp-2", "items") as string[];
        state.items = inner;
        updateBinding.mockClear();

        inner.push("b");
        expect(updateBinding).toHaveBeenCalledWith(descriptor, expect.anything());
    });
});
