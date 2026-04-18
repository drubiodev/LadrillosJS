import { describe, it, expect, beforeEach } from "vitest";
import {
  getCachedEvaluator,
  clearExpressionCache,
  getCachedVariableRegex,
  expressionDependsOnCached,
  getCachedPath,
  getByPath,
  setByPath,
} from "../../src/core/cache/expressionCache";

describe("expressionCache", () => {
  beforeEach(() => clearExpressionCache());

  describe("getCachedEvaluator", () => {
    it("evaluates a simple expression", () => {
      const evaluate = getCachedEvaluator("count + 1", ["count"]);
      expect(evaluate({ count: 5 })).toBe(6);
    });

    it("evaluates nested member access", () => {
      const evaluate = getCachedEvaluator("user.name", ["user"]);
      expect(evaluate({ user: { name: "Alice" } })).toBe("Alice");
    });

    it("returns the same evaluator instance for identical expression + keys", () => {
      const a = getCachedEvaluator("x * 2", ["x"]);
      const b = getCachedEvaluator("x * 2", ["x"]);
      expect(a).toBe(b);
    });

    it("treats different context-key sets as different cache entries", () => {
      const a = getCachedEvaluator("x", ["x"]);
      const b = getCachedEvaluator("x", ["x", "y"]);
      expect(a).not.toBe(b);
    });

    it("returns a noop evaluator for syntactically invalid expressions", () => {
      const evaluate = getCachedEvaluator("???", []);
      expect(evaluate({})).toBeUndefined();
    });

    it("supports ternary expressions", () => {
      const evaluate = getCachedEvaluator("age >= 18 ? 'adult' : 'minor'", [
        "age",
      ]);
      expect(evaluate({ age: 25 })).toBe("adult");
      expect(evaluate({ age: 10 })).toBe("minor");
    });
  });

  describe("getCachedVariableRegex", () => {
    it("returns a regex that matches whole-word variable references", () => {
      const re = getCachedVariableRegex("count");
      expect("count + 1".match(re)).toBeTruthy();
      expect("counter".match(re)).toBeNull();
    });

    it("caches regex instances", () => {
      expect(getCachedVariableRegex("x")).toBe(getCachedVariableRegex("x"));
    });
  });

  describe("expressionDependsOnCached", () => {
    it("returns true when expression references the variable", () => {
      expect(expressionDependsOnCached("count + 1", "count")).toBe(true);
    });

    it("returns false when expression does not reference the variable", () => {
      expect(expressionDependsOnCached("count + 1", "name")).toBe(false);
    });

    it("does not match substrings of other identifiers", () => {
      expect(expressionDependsOnCached("counter + 1", "count")).toBe(false);
    });
  });

  describe("path helpers", () => {
    it("splits and caches paths", () => {
      const a = getCachedPath("user.name");
      const b = getCachedPath("user.name");
      expect(a).toEqual(["user", "name"]);
      expect(a).toBe(b);
    });

    it("reads nested values with getByPath", () => {
      const obj = { a: { b: { c: 42 } } };
      expect(getByPath(obj, "a.b.c")).toBe(42);
    });

    it("returns undefined for missing paths", () => {
      expect(getByPath({ a: 1 }, "b.c")).toBeUndefined();
    });

    it("writes nested values with setByPath", () => {
      const obj: any = { a: { b: 1 } };
      setByPath(obj, "a.b", 99);
      expect(obj.a.b).toBe(99);
    });
  });
});
