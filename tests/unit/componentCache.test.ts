import { describe, it, expect, beforeEach } from "vitest";
import {
  setCachedComponentSource,
  getCachedComponentSource,
  setCacheSize,
} from "../../src/core/component/cache";

describe("component source cache", () => {
  beforeEach(() => {
    setCacheSize(3); // fresh small cache per test
  });

  it("stores and retrieves cached sources", () => {
    setCachedComponentSource("/a.html", "<div>A</div>");
    expect(getCachedComponentSource("/a.html")).toBe("<div>A</div>");
  });

  it("returns undefined for unknown paths", () => {
    expect(getCachedComponentSource("/missing.html")).toBeUndefined();
  });

  it("evicts the least recently used entry when cache is full", () => {
    setCachedComponentSource("/a.html", "A");
    setCachedComponentSource("/b.html", "B");
    setCachedComponentSource("/c.html", "C");
    // Access /a.html to mark it as recently used
    getCachedComponentSource("/a.html");
    // Add /d.html — should evict /b.html (least recently used)
    setCachedComponentSource("/d.html", "D");

    expect(getCachedComponentSource("/b.html")).toBeUndefined();
    expect(getCachedComponentSource("/a.html")).toBe("A");
    expect(getCachedComponentSource("/c.html")).toBe("C");
    expect(getCachedComponentSource("/d.html")).toBe("D");
  });

  it("setCacheSize evicts immediately when new size is smaller", () => {
    setCachedComponentSource("/a.html", "A");
    setCachedComponentSource("/b.html", "B");
    setCachedComponentSource("/c.html", "C");
    setCacheSize(1);
    // Only the most recently inserted (c) should survive
    expect(getCachedComponentSource("/a.html")).toBeUndefined();
    expect(getCachedComponentSource("/b.html")).toBeUndefined();
    expect(getCachedComponentSource("/c.html")).toBe("C");
  });

  it("setCacheSize throws on invalid input", () => {
    expect(() => setCacheSize(0)).toThrow();
    expect(() => setCacheSize(-1)).toThrow();
    expect(() => setCacheSize(NaN)).toThrow();
  });
});
