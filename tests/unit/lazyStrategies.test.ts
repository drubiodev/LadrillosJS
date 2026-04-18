import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  lazyOnIdle,
  lazyOnVisible,
  lazyOnDelay,
  lazyOnMedia,
  lazyOnInteraction,
} from "../../src/core/lazy/lazyStrategies";

declare const MockIntersectionObserver: any;

describe("lazyStrategies", () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    element = document.createElement("div");
    document.body.appendChild(element);
    MockIntersectionObserver.reset();
  });

  describe("lazyOnIdle", () => {
    it("invokes load when the browser is idle", async () => {
      vi.useFakeTimers();
      const load = vi.fn();
      lazyOnIdle(1000)(load, element);
      await vi.advanceTimersByTimeAsync(10);
      expect(load).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("returns a teardown function that cancels pending idle callback", () => {
      vi.useFakeTimers();
      const load = vi.fn();
      const teardown = lazyOnIdle(1000)(load, element);
      teardown?.();
      vi.advanceTimersByTime(5000);
      expect(load).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe("lazyOnVisible", () => {
    it("registers an IntersectionObserver and loads on intersect", () => {
      const load = vi.fn();
      lazyOnVisible()(load, element);

      expect(MockIntersectionObserver.instances).toHaveLength(1);
      const observer = MockIntersectionObserver.instances[0];
      observer.trigger(element, true);
      expect(load).toHaveBeenCalledTimes(1);
    });

    it("does not load when intersection is false", () => {
      const load = vi.fn();
      lazyOnVisible()(load, element);
      const observer = MockIntersectionObserver.instances[0];
      observer.trigger(element, false);
      expect(load).not.toHaveBeenCalled();
    });
  });

  describe("lazyOnDelay", () => {
    it("invokes load after the specified delay", async () => {
      vi.useFakeTimers();
      const load = vi.fn();
      lazyOnDelay(500)(load, element);
      expect(load).not.toHaveBeenCalled();
      vi.advanceTimersByTime(500);
      expect(load).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("teardown cancels a pending delay", () => {
      vi.useFakeTimers();
      const load = vi.fn();
      const teardown = lazyOnDelay(500)(load, element);
      teardown?.();
      vi.advanceTimersByTime(1000);
      expect(load).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe("lazyOnMedia", () => {
    it("loads immediately when query is empty", () => {
      const load = vi.fn();
      lazyOnMedia("")(load, element);
      expect(load).toHaveBeenCalledTimes(1);
    });

    it("loads immediately when media query matches", () => {
      const load = vi.fn();
      (window as any).matchMedia = () => ({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      });
      lazyOnMedia("(max-width: 768px)")(load, element);
      expect(load).toHaveBeenCalledTimes(1);
    });
  });

  describe("lazyOnInteraction", () => {
    it("loads on click event", () => {
      const load = vi.fn();
      lazyOnInteraction("click")(load, element);
      element.dispatchEvent(new Event("click"));
      expect(load).toHaveBeenCalledTimes(1);
    });

    it("loads only once even with multiple interactions", () => {
      const load = vi.fn();
      lazyOnInteraction(["click", "focusin"])(load, element);
      element.dispatchEvent(new Event("click"));
      element.dispatchEvent(new Event("click"));
      element.dispatchEvent(new Event("focusin"));
      expect(load).toHaveBeenCalledTimes(1);
    });
  });
});
