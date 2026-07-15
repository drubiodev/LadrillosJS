import { describe, it, expect } from "vitest";
import {
  parseEventDirective,
  matchesKey,
  matchesSystemModifiers,
  isEventDirective,
} from "../../src/utils/keyModifiers";

describe("keyModifiers", () => {
  describe("parseEventDirective", () => {
    it("returns null for non-$on: attributes", () => {
      expect(parseEventDirective("onclick")).toBeNull();
      expect(parseEventDirective("$bind")).toBeNull();
    });

    it("parses a plain event name", () => {
      const parsed = parseEventDirective("$on:click");
      expect(parsed?.eventName).toBe("click");
      expect(parsed?.keyModifiers).toEqual([]);
    });

    it("extracts key modifiers", () => {
      const parsed = parseEventDirective("$on:keyup.enter");
      expect(parsed?.eventName).toBe("keyup");
      expect(parsed?.keyModifiers).toEqual(["enter"]);
    });

    it("extracts system modifiers", () => {
      const parsed = parseEventDirective("$on:click.ctrl.shift");
      expect(parsed?.systemModifiers.sort()).toEqual(["ctrl", "shift"]);
    });

    it("extracts event modifiers", () => {
      const parsed = parseEventDirective("$on:submit.prevent.stop");
      expect(parsed?.eventModifiers.sort()).toEqual(["prevent", "stop"]);
    });

    it("extracts mouse modifiers", () => {
      const parsed = parseEventDirective("$on:click.right");
      expect(parsed?.mouseModifier).toBe("right");
    });

    it("sets exact flag", () => {
      const parsed = parseEventDirective("$on:click.ctrl.exact");
      expect(parsed?.exact).toBe(true);
    });
  });

  describe("matchesKey", () => {
    it("matches aliased keys", () => {
      const ev = new KeyboardEvent("keyup", { key: "Enter" });
      expect(matchesKey(ev, "enter")).toBe(true);
    });

    it("matches single character keys case-insensitively", () => {
      const ev = new KeyboardEvent("keyup", { key: "A" });
      expect(matchesKey(ev, "a")).toBe(true);
    });

    it("returns false on mismatch", () => {
      const ev = new KeyboardEvent("keyup", { key: "Escape" });
      expect(matchesKey(ev, "enter")).toBe(false);
    });
  });

  describe("matchesSystemModifiers", () => {
    it("returns true when all required modifiers pressed", () => {
      const ev = new KeyboardEvent("keydown", {
        key: "a",
        ctrlKey: true,
        shiftKey: true,
      });
      expect(matchesSystemModifiers(ev, ["ctrl", "shift"], false)).toBe(true);
    });

    it("returns false when a required modifier is missing", () => {
      const ev = new KeyboardEvent("keydown", { key: "a", ctrlKey: true });
      expect(matchesSystemModifiers(ev, ["ctrl", "shift"], false)).toBe(false);
    });

    it("exact=true rejects additional modifiers", () => {
      const ev = new KeyboardEvent("keydown", {
        key: "a",
        ctrlKey: true,
        shiftKey: true,
      });
      expect(matchesSystemModifiers(ev, ["ctrl"], true)).toBe(false);
    });
  });

  describe("isEventDirective", () => {
    it("detects $on: attributes", () => {
      expect(isEventDirective("$on:click")).toBe(true);
      expect(isEventDirective("$on:keyup.enter")).toBe(true);
    });

    it("rejects non-event directives", () => {
      expect(isEventDirective("$bind")).toBe(false);
      expect(isEventDirective("onclick")).toBe(false);
    });
  });
});
