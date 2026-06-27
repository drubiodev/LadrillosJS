import { describe, it, expect } from "vitest";
import { getCachedVariableRegex } from "../../src/core/cache/expressionCache";

describe("expressionCache", () =>
{
  describe("getCachedVariableRegex", () =>
  {
    it("returns a regex that matches whole-word variable references", () =>
    {
      const re = getCachedVariableRegex("count");
      expect("count + 1".match(re)).toBeTruthy();
      expect("counter".match(re)).toBeNull();
    });

    it("caches regex instances", () =>
    {
      expect(getCachedVariableRegex("x")).toBe(getCachedVariableRegex("x"));
    });

    it("escapes special regex characters in the variable name", () =>
    {
      const re = getCachedVariableRegex("a.b");
      expect(re.test("a.b")).toBe(true);
      expect(re.test("axb")).toBe(false);
    });
  });
});

