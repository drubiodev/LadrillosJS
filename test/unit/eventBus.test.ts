import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { $listen, $emit } from "../../src/index";
import { cleanupDOM, waitForAsync } from "../test-helpers";

describe("Event Bus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe("$listen", () => {
    it("should subscribe to an event", () => {
      const callback = vi.fn();
      const unsubscribe = $listen("test-event", callback);

      expect(typeof unsubscribe).toBe("function");
    });

    it("should call callback when event is emitted", () => {
      const callback = vi.fn();
      $listen("test-event", callback);

      $emit("test-event");

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should pass data to callback", () => {
      const callback = vi.fn();
      $listen("test-event", callback);

      const testData = { id: 1, name: "test" };
      $emit("test-event", testData);

      expect(callback).toHaveBeenCalledWith(testData);
    });

    it("should support multiple listeners for same event", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      $listen("multi-event", callback1);
      $listen("multi-event", callback2);
      $listen("multi-event", callback3);

      $emit("multi-event", { test: true });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it("should unsubscribe from event", () => {
      const callback = vi.fn();
      const unsubscribe = $listen("test-event", callback);

      $emit("test-event");
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      $emit("test-event");

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should allow resubscription after unsubscribe", () => {
      const callback = vi.fn();
      const unsubscribe = $listen("test-event", callback);

      $emit("test-event");
      unsubscribe();
      $emit("test-event");

      const newSubscription = $listen("test-event", callback);
      $emit("test-event");

      expect(callback).toHaveBeenCalledTimes(2);

      newSubscription();
    });

    it("should handle multiple listeners for same event", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      $listen("multi-event", callback1);
      $listen("multi-event", callback2);

      $emit("multi-event", { test: true });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it("should handle multiple events independently", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      $listen("event-a", callback1);
      $listen("event-b", callback2);

      $emit("event-a");
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(0);

      $emit("event-b");
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should preserve listener order", () => {
      const callOrder: number[] = [];
      $listen("order-event", () => callOrder.push(1));
      $listen("order-event", () => callOrder.push(2));
      $listen("order-event", () => callOrder.push(3));

      $emit("order-event");

      expect(callOrder).toEqual([1, 2, 3]);
    });

    it("should handle listener with complex data structures", () => {
      const callback = vi.fn();
      $listen("complex-event", callback);

      const complexData = {
        users: [
          { id: 1, name: "Alice", tags: ["admin", "user"] },
          { id: 2, name: "Bob", tags: ["user"] },
        ],
        metadata: {
          timestamp: Date.now(),
          version: "1.0.0",
        },
      };

      $emit("complex-event", complexData);

      expect(callback).toHaveBeenCalledWith(complexData);
    });

    it("should support async listener", async () => {
      let asyncResult = false;
      $listen("async-event", async () => {
        await waitForAsync(10);
        asyncResult = true;
      });

      $emit("async-event");
      await waitForAsync(20);

      expect(asyncResult).toBe(true);
    });

    it("should handle listener with undefined data", () => {
      const callback = vi.fn();
      $listen("undefined-event", callback);

      $emit("undefined-event", undefined);

      expect(callback).toHaveBeenCalledWith(undefined);
    });

    it("should handle listener with null data", () => {
      const callback = vi.fn();
      $listen("null-event", callback);

      $emit("null-event", null);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it("should handle listener with empty string data", () => {
      const callback = vi.fn();
      $listen("empty-event", callback);

      $emit("empty-event", "");

      expect(callback).toHaveBeenCalledWith("");
    });

    it("should handle listener with number zero data", () => {
      const callback = vi.fn();
      $listen("zero-event", callback);

      $emit("zero-event", 0);

      expect(callback).toHaveBeenCalledWith(0);
    });

    it("should handle listener with false data", () => {
      const callback = vi.fn();
      $listen("false-event", callback);

      $emit("false-event", false);

      expect(callback).toHaveBeenCalledWith(false);
    });
  });

  describe("$emit", () => {
    it("should emit event without data", () => {
      const callback = vi.fn();
      $listen("no-data-event", callback);

      $emit("no-data-event");

      expect(callback).toHaveBeenCalled();
    });

    it("should emit event with data", () => {
      const callback = vi.fn();
      $listen("with-data-event", callback);

      $emit("with-data-event", { id: 1 });

      expect(callback).toHaveBeenCalledWith({ id: 1 });
    });

    it("should allow multiple emits to same event", () => {
      const callback = vi.fn();
      $listen("multi-emit-event", callback);

      $emit("multi-emit-event", 1);
      $emit("multi-emit-event", 2);
      $emit("multi-emit-event", 3);

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenNthCalledWith(1, 1);
      expect(callback).toHaveBeenNthCalledWith(2, 2);
      expect(callback).toHaveBeenNthCalledWith(3, 3);
    });

    it("should emit event with different data types", () => {
      const callback = vi.fn();
      $listen("type-event", callback);

      $emit("type-event", "string");
      expect(callback).toHaveBeenNthCalledWith(1, "string");

      $emit("type-event", 123);
      expect(callback).toHaveBeenNthCalledWith(2, 123);

      $emit("type-event", true);
      expect(callback).toHaveBeenNthCalledWith(3, true);

      $emit("type-event", ["array"]);
      expect(callback).toHaveBeenNthCalledWith(4, ["array"]);

      $emit("type-event", { obj: true });
      expect(callback).toHaveBeenNthCalledWith(5, { obj: true });
    });

    it("should emit with large data payload", () => {
      const callback = vi.fn();
      $listen("large-payload", callback);

      const largeData = {
        users: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `User${i}`,
          email: `user${i}@example.com`,
          tags: ["tag1", "tag2", "tag3"],
        })),
      };

      $emit("large-payload", largeData);

      expect(callback).toHaveBeenCalledWith(largeData);
    });

    it("should emit event multiple times independently", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      $listen("independent-1", callback1);
      $listen("independent-2", callback2);

      $emit("independent-1", "data1");
      $emit("independent-2", "data2");
      $emit("independent-1", "data3");

      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should handle rapid consecutive emits", () => {
      const callback = vi.fn();
      $listen("rapid-emit", callback);

      for (let i = 0; i < 100; i++) {
        $emit("rapid-emit", i);
      }

      expect(callback).toHaveBeenCalledTimes(100);
    });
  });

  describe("Cross-component communication", () => {
    it("should communicate between different components via event bus", () => {
      const senderCallback = vi.fn();
      const receiverCallback = vi.fn();

      $listen("component-communication", receiverCallback);

      // Simulate sender emitting
      $emit("component-communication", { from: "sender", message: "Hello" });

      expect(receiverCallback).toHaveBeenCalledWith({
        from: "sender",
        message: "Hello",
      });
    });

    it("should support bidirectional communication", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      $listen("bidirectional-1", callback1);
      $listen("bidirectional-2", callback2);

      $emit("bidirectional-1", { from: "comp1" });
      $emit("bidirectional-2", { from: "comp2" });

      expect(callback1).toHaveBeenCalledWith({ from: "comp1" });
      expect(callback2).toHaveBeenCalledWith({ from: "comp2" });
    });

    it("should handle complex component interaction patterns", () => {
      const observer = vi.fn();
      const logger = vi.fn();
      const processor = vi.fn();

      $listen("state-change", observer);
      $listen("state-change", logger);
      $listen("state-change", processor);

      $emit("state-change", { state: "new", timestamp: 123 });

      expect(observer).toHaveBeenCalled();
      expect(logger).toHaveBeenCalled();
      expect(processor).toHaveBeenCalled();
    });
  });

  describe("Event Bus Edge Cases", () => {
    it("should handle event name with special characters", () => {
      const callback = vi.fn();
      $listen("event-name_with.special$chars", callback);

      $emit("event-name_with.special$chars", "data");

      expect(callback).toHaveBeenCalledWith("data");
    });

    it("should differentiate between similar event names", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      $listen("event", callback1);
      $listen("event-", callback2);

      $emit("event");
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(0);
    });

    it("should handle case-sensitive event names", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      $listen("MyEvent", callback1);
      $listen("myevent", callback2);

      $emit("MyEvent");
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(0);
    });

    it("should support event name with numbers", () => {
      const callback = vi.fn();
      $listen("event123abc456", callback);

      $emit("event123abc456", "test");

      expect(callback).toHaveBeenCalledWith("test");
    });

    it("should handle listener that modifies its own state", () => {
      let counter = 0;
      $listen("counter-event", () => {
        counter++;
      });

      $emit("counter-event");
      $emit("counter-event");
      $emit("counter-event");

      expect(counter).toBe(3);
    });

    it("should handle listener that emits another event", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      $listen("event-a", () => {
        $emit("event-b", "forwarded");
      });
      $listen("event-b", callback2);

      $emit("event-a");

      expect(callback2).toHaveBeenCalledWith("forwarded");
    });
  });
});
