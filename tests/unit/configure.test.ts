import { describe, it, expect, beforeEach, vi } from "vitest";
import { configure } from "../../src/core/configure";
import { error, type LadrillosErrorHandler } from "../../src/utils/devWarnings";
import {
  getCachedComponentSource,
  setCachedComponentSource,
  setCacheSize,
} from "../../src/core/component/cache";

describe("configure()", () => {
  beforeEach(() => {
    // Reset via configure() itself
    configure({ onError: null });
  });

  it("configures the cache size", () => {
    configure({ cacheSize: 2 });
    setCachedComponentSource("/a.html", "A");
    setCachedComponentSource("/b.html", "B");
    setCachedComponentSource("/c.html", "C");
    // Size=2 means /a should have been evicted
    expect(getCachedComponentSource("/a.html")).toBeUndefined();
    expect(getCachedComponentSource("/b.html")).toBe("B");
    expect(getCachedComponentSource("/c.html")).toBe("C");
    // Restore
    setCacheSize(25);
  });

  it("invokes the custom error handler with framework errors", () => {
    const captured: Array<{ err: Error; ctx: unknown }> = [];
    const handler: LadrillosErrorHandler = (err, ctx) => {
      captured.push({ err, ctx });
    };
    configure({ onError: handler });

    // Suppress console output for this test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      error("Something went wrong", { tagName: "my-cmp" });
    } finally {
      spy.mockRestore();
    }

    expect(captured).toHaveLength(1);
    expect(captured[0].err.message).toContain("Something went wrong");
    expect(captured[0].ctx).toEqual({ tagName: "my-cmp" });
  });

  it("swallows exceptions thrown by the custom error handler", () => {
    configure({
      onError: () => {
        throw new Error("handler failed");
      },
    });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => error("hello")).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });

  it("setting onError to null removes the handler", () => {
    let calls = 0;
    configure({ onError: () => calls++ });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      error("first");
      expect(calls).toBe(1);

      configure({ onError: null });
      error("second");
      expect(calls).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("passes the original error through the cause chain", () => {
    const captured: Error[] = [];
    configure({ onError: (err) => captured.push(err) });

    const original = new TypeError("boom");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      error("Outer message", null, original);
    } finally {
      spy.mockRestore();
    }

    expect(captured).toHaveLength(1);
    // Original error is forwarded directly when passed as cause
    expect(captured[0]).toBe(original);
  });
});
