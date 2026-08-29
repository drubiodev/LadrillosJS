import { describe, it, expect } from "vitest";
import
    {
        replaceVarWithStateAccess,
        transformCodeToStateAccess,
    } from "../../src/utils/stateTransform";

/**
 * Regression tests for reactive variables used as a TERNARY CONSEQUENT.
 *
 * Bug: the state-access transform skipped any identifier followed by `:`,
 * a rule meant to protect object-literal keys (`{ name: 1 }`). A ternary's
 * true-branch has the identical shape:
 *
 *   let support = false;
 *   const supportPrice = 99;
 *   function total() { return 100 + (support ? supportPrice : 0); }
 *     → return 100 + (__state__.support ? supportPrice : 0);
 *
 * `supportPrice` stayed a bare identifier, so the function threw
 * `ReferenceError: supportPrice is not defined` the moment the branch was
 * actually taken. Because the failure only happens once the condition flips,
 * the component renders correctly at first and breaks on a later update —
 * and the failed binding renders its raw `{expr}` source into the page.
 */
describe("ternary consequents", () =>
{
    it("rewrites a state variable used as the true-branch", () =>
    {
        expect(replaceVarWithStateAccess("flag ? price : 0", "price")).toBe(
            "flag ? __state__.price : 0",
        );
    });

    it("rewrites both branches of a ternary", () =>
    {
        expect(
            transformCodeToStateAccess("x = flag ? a : b", ["a", "b"], {
                rewriteDeclarations: false,
            }),
        ).toBe("x = flag ? __state__.a : __state__.b");
    });

    it("rewrites a ternary consequent inside a function body", () =>
    {
        const code = "function total() { return 100 + (support ? price : 0); }";
        expect(
            transformCodeToStateAccess(code, ["support", "price"], {
                rewriteDeclarations: false,
            }),
        ).toBe(
            "function total() { return 100 + (__state__.support ? __state__.price : 0); }",
        );
    });

    it("rewrites a ternary consequent nested in an object value", () =>
    {
        expect(
            replaceVarWithStateAccess("x = { total: flag ? price : 0 }", "price"),
        ).toBe("x = { total: flag ? __state__.price : 0 }");
    });

    it("rewrites a ternary consequent among call arguments", () =>
    {
        expect(
            replaceVarWithStateAccess("money(a, flag ? price : 0)", "price"),
        ).toBe("money(a, flag ? __state__.price : 0)");
    });

    it("rewrites a switch case value", () =>
    {
        expect(
            replaceVarWithStateAccess("switch (x) { case price: break; }", "price"),
        ).toBe("switch (x) { case __state__.price: break; }");
    });

    // --- the behaviour the `:` skip was protecting must still hold ---

    it("leaves an explicit object key alone", () =>
    {
        expect(replaceVarWithStateAccess("x = { price: 1 }", "price")).toBe(
            "x = { price: 1 }",
        );
    });

    it("leaves a non-first explicit object key alone", () =>
    {
        expect(replaceVarWithStateAccess("x = { a: 1, price: 2 }", "price")).toBe(
            "x = { a: 1, price: 2 }",
        );
    });

    it("rewrites the VALUE but not the KEY when both are the variable", () =>
    {
        expect(replaceVarWithStateAccess("x = { price: price }", "price")).toBe(
            "x = { price: __state__.price }",
        );
    });

    it("still expands object-literal shorthand", () =>
    {
        expect(replaceVarWithStateAccess("x = { a, price }", "price")).toBe(
            "x = { a, price: __state__.price }",
        );
    });

    it("leaves a labeled statement alone", () =>
    {
        expect(
            replaceVarWithStateAccess("price: for (;;) { break; }", "price"),
        ).toBe("price: for (;;) { break; }");
    });
});
