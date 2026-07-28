import { describe, it, expect, afterEach } from "vitest";
import
  {
    runtimeBackend,
    setCodegenBackend,
    compileEvaluator,
    compileHandler,
    compileSetup,
  } from "../../src/core/js/compiler";
import
  {
    precompiledBackend,
    registerArtifacts,
    clearArtifacts,
    hasArtifact,
  } from "../../src/core/js/precompiled";

afterEach(() =>
{
  setCodegenBackend(runtimeBackend);
  clearArtifacts();
});

describe("precompiled backend", () =>
{
  it("maps named deps onto the runtime's positional argument list", () =>
  {
    registerArtifacts({
      evaluators: {
        "count * 2": { deps: ["count"], fn: (count: number) => count * 2 },
      },
    });

    // The runtime passes [...shadowedGlobals, ...stateKeys]; `count` is last.
    const fn = precompiledBackend.compileEvaluator(
      ["window", "document", "count"],
      "count * 2",
    );

    expect(fn(undefined, undefined, 21)).toBe(42);
  });

  it("tolerates a dep the runtime does not supply", () =>
  {
    registerArtifacts({
      evaluators: {
        missing: { deps: ["nope"], fn: (v: unknown) => typeof v },
      },
    });

    const fn = precompiledBackend.compileEvaluator(["count"], "missing");
    expect(fn(1)).toBe("undefined");
  });

  it("handles arities above the specialised cases", () =>
  {
    registerArtifacts({
      evaluators: {
        sum: {
          deps: ["a", "b", "c", "d", "e"],
          fn: (...n: number[]) => n.reduce((x, y) => x + y, 0),
        },
      },
    });

    const fn = precompiledBackend.compileEvaluator(
      ["e", "d", "c", "b", "a"],
      "sum",
    );
    expect(fn(1, 2, 3, 4, 5)).toBe(15);
  });

  it("reports a missing artifact instead of silently falling back", () =>
  {
    expect(() =>
      precompiledBackend.compileEvaluator(["count"], "count + 1"),
    ).toThrow(/No precompiled evaluator/);
  });

  it("keys handlers and setups by authored source", () =>
  {
    registerArtifacts({
      handlers: {
        "handler:count++": {
          deps: ["__state__"],
          fn: (s: { count: number; }) => { s.count++; },
        },
      },
      setups: {
        "state:let count = 0;": {
          deps: ["__state__"],
          fn: (s: Record<string, unknown>) => { s.count = 0; },
        },
      },
    });

    expect(hasArtifact("handler", "handler:count++")).toBe(true);
    expect(hasArtifact("setup", "state:let count = 0;")).toBe(true);

    setCodegenBackend(precompiledBackend);

    const state: Record<string, unknown> = {};
    // Handler params are [event, __state__, $refs, $host, ...]
    compileSetup(["__state__"], "<wrapped>", "state:let count = 0;")(state);
    expect(state.count).toBe(0);

    compileHandler(
      ["event", "__state__", "$refs", "$host"],
      "<wrapped>",
      false,
      "handler:count++",
    )(null, state, null, null);
    expect(state.count).toBe(1);
  });
});

describe("backend conformance", () =>
{
  /**
   * The two backends must be interchangeable from the runtime's point of view:
   * same parameter list, same positional call, same result. This is the
   * contract the CSP build depends on.
   */
  const cases = [
    { expr: "count", deps: ["count"], fn: (c: number) => c },
    { expr: "count * 2", deps: ["count"], fn: (c: number) => c * 2 },
    {
      expr: "first + ' ' + last",
      deps: ["first", "last"],
      fn: (f: string, l: string) => f + " " + l,
    },
    {
      expr: "items.length > 0",
      deps: ["items"],
      fn: (i: unknown[]) => i.length > 0,
    },
    {
      expr: "user.name.toUpperCase()",
      deps: ["user"],
      fn: (u: { name: string; }) => u.name.toUpperCase(),
    },
  ];

  const params = ["window", "fetch", "count", "first", "last", "items", "user"];
  const args = [
    undefined,
    undefined,
    21,
    "Ada",
    "Lovelace",
    [1, 2, 3],
    { name: "ada" },
  ];

  it("produces identical results for every expression", () =>
  {
    registerArtifacts({
      evaluators: Object.fromEntries(
        cases.map((c) => [c.expr, { deps: c.deps, fn: c.fn as never }]),
      ),
    });

    for (const { expr } of cases)
    {
      const viaRuntime = runtimeBackend.compileEvaluator(params, expr);
      const viaPrecompiled = precompiledBackend.compileEvaluator(params, expr);

      expect(viaPrecompiled(...args)).toEqual(viaRuntime(...args));
    }
  });

  it("shadows globals identically", () =>
  {
    registerArtifacts({
      evaluators: {
        "typeof fetch": { deps: ["fetch"], fn: (f: unknown) => typeof f },
      },
    });

    const viaRuntime = runtimeBackend.compileEvaluator(params, "typeof fetch");
    const viaPrecompiled = precompiledBackend.compileEvaluator(
      params,
      "typeof fetch",
    );

    expect(viaPrecompiled(...args)).toBe("undefined");
    expect(viaPrecompiled(...args)).toBe(viaRuntime(...args));
  });

  it("goes through the seam without the caller knowing which backend is active", () =>
  {
    registerArtifacts({
      evaluators: {
        "count * 2": { deps: ["count"], fn: (c: number) => c * 2 },
      },
    });

    const fromRuntime = compileEvaluator(params, "count * 2")(...args);
    setCodegenBackend(precompiledBackend);
    const fromPrecompiled = compileEvaluator(params, "count * 2")(...args);

    expect(fromPrecompiled).toBe(fromRuntime);
    expect(fromPrecompiled).toBe(42);
  });
});
