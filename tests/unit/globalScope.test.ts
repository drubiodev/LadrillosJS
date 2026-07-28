import { describe, it, expect } from "vitest";
import {
  INJECTED_GLOBALS,
  SHADOWED_GLOBALS,
  RESERVED_WORDS,
  FRAMEWORK_HELPERS,
} from "../../src/utils/globalScope";

describe("global scope constants", () => {
  it("INJECTED_GLOBALS is frozen", () => {
    expect(Object.isFrozen(INJECTED_GLOBALS)).toBe(true);
  });

  it("INJECTED_GLOBALS contains common runtime values", () => {
    const arr = INJECTED_GLOBALS as readonly string[];
    expect(arr).toContain("console");
    expect(arr).toContain("Math");
    expect(arr).toContain("JSON");
    expect(arr).toContain("Promise");
  });

  it("RESERVED_WORDS includes JavaScript keywords", () => {
    expect(RESERVED_WORDS.has("if")).toBe(true);
    expect(RESERVED_WORDS.has("for")).toBe(true);
    expect(RESERVED_WORDS.has("while")).toBe(true);
    expect(RESERVED_WORDS.has("function")).toBe(true);
    expect(RESERVED_WORDS.has("return")).toBe(true);
  });

  it("RESERVED_WORDS does not falsely include regular identifiers", () => {
    expect(RESERVED_WORDS.has("count")).toBe(false);
    expect(RESERVED_WORDS.has("user")).toBe(false);
  });

  it("SHADOWED_GLOBALS is frozen and currently empty", () => {
    expect(Object.isFrozen(SHADOWED_GLOBALS)).toBe(true);
    // Intentionally empty per source note
    expect(SHADOWED_GLOBALS.length).toBe(0);
  });

  it("FRAMEWORK_HELPERS exports the $-prefixed helper names", () => {
    const helpers = FRAMEWORK_HELPERS as readonly string[];
    expect(helpers).toContain("registerComponent");
    expect(helpers).toContain("$use");
  });
});
