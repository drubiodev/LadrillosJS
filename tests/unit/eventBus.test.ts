import { describe, it, expect, beforeEach } from "vitest";
import {
  $emit,
  $listen,
  cleanupComponentListeners,
  clearAllListeners,
  getListenerCount,
  hasListeners,
  createEventBusHelpers,
} from "../../src/core/events/eventBus";

describe("eventBus", () => {
  beforeEach(() => clearAllListeners());

  describe("$listen and $emit", () => {
    it("delivers emitted events to listeners", () => {
      let received: unknown = null;
      $listen<{ v: number }>("test:event", (data) => {
        received = data;
      });

      $emit("test:event", { v: 42 });
      expect(received).toEqual({ v: 42 });
    });

    it("supports multiple listeners for the same event", () => {
      const calls: number[] = [];
      $listen("ping", () => calls.push(1));
      $listen("ping", () => calls.push(2));
      $emit("ping");
      expect(calls).toEqual([1, 2]);
    });

    it("does not invoke unrelated listeners", () => {
      let calls = 0;
      $listen("a", () => calls++);
      $emit("b");
      expect(calls).toBe(0);
    });

    it("returns an unsubscribe function", () => {
      let calls = 0;
      const unsub = $listen("x", () => calls++);
      $emit("x");
      expect(calls).toBe(1);

      unsub();
      $emit("x");
      expect(calls).toBe(1);
    });

    it("getListenerCount reports the correct count", () => {
      $listen("foo", () => {});
      $listen("foo", () => {});
      expect(getListenerCount("foo")).toBe(2);
      expect(hasListeners("foo")).toBe(true);
      expect(hasListeners("bar")).toBe(false);
    });

    it("isolates listener errors from other listeners", () => {
      const calls: number[] = [];
      $listen("e", () => {
        throw new Error("boom");
      });
      $listen("e", () => calls.push(1));
      // Should not throw
      expect(() => $emit("e")).not.toThrow();
      expect(calls).toEqual([1]);
    });
  });

  describe("component-scoped listeners", () => {
    it("cleanupComponentListeners removes only that component's listeners", () => {
      const helpersA = createEventBusHelpers("component-a");
      const helpersB = createEventBusHelpers("component-b");

      const calls: string[] = [];
      helpersA.$listen("shared", () => calls.push("A"));
      helpersB.$listen("shared", () => calls.push("B"));

      $emit("shared");
      expect(calls.sort()).toEqual(["A", "B"]);
      calls.length = 0;

      cleanupComponentListeners("component-a");
      $emit("shared");
      expect(calls).toEqual(["B"]);
    });

    it("cleanup does not throw when component has no listeners", () => {
      expect(() => cleanupComponentListeners("ghost")).not.toThrow();
    });
  });
});
