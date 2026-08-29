import { describe, it, expect, afterEach } from "vitest";
import
  {
    compileEvaluator,
    compileHandler,
    compileSetup,
    setCodegenBackend,
    getCodegenBackend,
    type CodegenBackend,
  } from "../../src/core/js/compiler";
import { runtimeBackend } from "../../src/core/js/runtimeBackend";

afterEach(() =>
{
  setCodegenBackend(runtimeBackend);
});

describe("runtimeBackend", () =>
{
  it("compiles an expression against positional params", () =>
  {
    const fn = runtimeBackend.compileEvaluator(["count"], "count * 2");
    expect(fn(21)).toBe(42);
  });

  it("shadows a param by passing undefined", () =>
  {
    const fn = runtimeBackend.compileEvaluator(["fetch"], "typeof fetch");
    expect(fn(undefined)).toBe("undefined");
  });

  it("compiles a sync handler that mutates state", () =>
  {
    const fn = runtimeBackend.compileHandler(
      ["state"],
      "state.count++;",
      false,
      "count++",
    );
    const state = { count: 0 };
    fn(state);
    expect(state.count).toBe(1);
  });

  it("compiles an async handler that can await", async () =>
  {
    const fn = runtimeBackend.compileHandler(
      ["value"],
      "return await Promise.resolve(value + 1);",
      true,
      "await inc",
    );
    await expect(fn(1)).resolves.toBe(2);
  });

  it("compiles a setup body and returns its members", () =>
  {
    const fn = runtimeBackend.compileSetup(
      [],
      `"use strict"; let a = 1; function b() { return 2; } return { a, b };`,
      "members:let a = 1;",
    );
    const result = fn() as { a: number; b: () => number; };
    expect(result.a).toBe(1);
    expect(result.b()).toBe(2);
  });

  it("propagates syntax errors so callers can report them", () =>
  {
    expect(() => runtimeBackend.compileEvaluator([], "1 +")).toThrow();
  });
});

describe("backend swapping", () =>
{
  it("defaults to the runtime backend", () =>
  {
    expect(getCodegenBackend().name).toBe("runtime");
  });

  it("routes every compile through the active backend", () =>
  {
    const calls: string[] = [];
    const stub: CodegenBackend = {
      name: "stub",
      compileEvaluator(_params, expression)
      {
        calls.push(`evaluator:${expression}`);
        return () => "stubbed";
      },
      compileHandler(_params, body)
      {
        calls.push(`handler:${body}`);
        return () => undefined;
      },
      compileSetup(_params, body)
      {
        calls.push(`setup:${body}`);
        return () => ({});
      },
    };

    setCodegenBackend(stub);

    expect(compileEvaluator(["count"], "count * 2")()).toBe("stubbed");
    compileHandler(["event"], "noop()");
    compileSetup([], "noop()");

    expect(calls).toEqual([
      "evaluator:count * 2",
      "handler:noop()",
      "setup:noop()",
    ]);
  });

  it("a backend that never calls Function can satisfy the interface", () =>
  {
    // The Phase 3 CSP build depends on this: precompiled closures are handed
    // back directly, so no Function constructor is reachable.
    const precompiled: CodegenBackend = {
      name: "precompiled-fixture",
      compileEvaluator: () => (state: { count: number; }) => state.count * 2,
      compileHandler: () => (state: { count: number; }) =>
      {
        state.count++;
      },
      compileSetup: () => () => ({ count: 0 }),
    };

    setCodegenBackend(precompiled);

    const state = { count: 21 };
    expect(compileEvaluator(["state"], "count * 2")(state)).toBe(42);
    compileHandler(["state"], "count++")(state);
    expect(state.count).toBe(22);
  });
});
