import { describe, it, expect, beforeEach } from "vitest";
import {
  track,
  trigger,
  effect,
  pauseTracking,
  resumeTracking,
  untrack,
  getDepCount,
  resetTracking,
} from "../../src/core/reactivity/dependencyTracker";

describe("dependencyTracker", () => {
  beforeEach(() => resetTracking());

  describe("effect()", () => {
    it("runs the effect function immediately", () => {
      let ran = false;
      effect(() => {
        ran = true;
      });
      expect(ran).toBe(true);
    });

    it("re-runs when a tracked dependency changes", () => {
      const state = { count: 0 };
      let observed = -1;
      effect(() => {
        track(state, "count");
        observed = state.count;
      });

      expect(observed).toBe(0);
      state.count = 5;
      trigger(state, "count");
      expect(observed).toBe(5);
    });

    it("does not re-run for untracked keys", () => {
      const state = { a: 0, b: 0 };
      let runs = 0;
      effect(() => {
        track(state, "a");
        runs++;
      });
      expect(runs).toBe(1);

      trigger(state, "b");
      expect(runs).toBe(1);

      trigger(state, "a");
      expect(runs).toBe(2);
    });

    it("returned stop function disables the effect", () => {
      const state = { x: 0 };
      let runs = 0;
      const stop = effect(() => {
        track(state, "x");
        runs++;
      });
      expect(runs).toBe(1);

      stop();
      trigger(state, "x");
      expect(runs).toBe(1);
    });

    it("handles nested effects correctly", () => {
      const state = { a: 1, b: 2 };
      let outerRuns = 0;
      let innerRuns = 0;

      effect(() => {
        outerRuns++;
        track(state, "a");
        effect(() => {
          innerRuns++;
          track(state, "b");
        });
      });

      expect(outerRuns).toBe(1);
      expect(innerRuns).toBe(1);

      trigger(state, "b");
      expect(innerRuns).toBe(2);
      expect(outerRuns).toBe(1);
    });

    it("avoids self-triggering when effect writes its own dependency", () => {
      const state = { x: 0 };
      let runs = 0;
      effect(() => {
        track(state, "x");
        runs++;
        // Simulate effect writing to its own dep — trigger should be a no-op
        trigger(state, "x");
      });
      expect(runs).toBe(1);
    });
  });

  describe("pauseTracking / resumeTracking", () => {
    it("prevents tracking while paused", () => {
      const state = { x: 0 };
      effect(() => {
        pauseTracking();
        track(state, "x");
        resumeTracking();
      });
      expect(getDepCount(state, "x")).toBe(0);
    });
  });

  describe("untrack()", () => {
    it("runs a function without creating dependencies", () => {
      const state = { x: 1, y: 2 };
      let runs = 0;
      effect(() => {
        track(state, "x");
        untrack(() => {
          track(state, "y");
        });
        runs++;
      });

      expect(runs).toBe(1);
      trigger(state, "y");
      expect(runs).toBe(1);
      trigger(state, "x");
      expect(runs).toBe(2);
    });
  });
});
