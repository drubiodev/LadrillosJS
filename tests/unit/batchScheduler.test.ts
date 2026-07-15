import { describe, it, expect } from "vitest";
import {
  createSchedulerJob,
  queueJob,
  nextTick,
  scheduleComponentUpdate,
  unregisterComponent,
} from "../../src/core/scheduler/batchScheduler";

describe("batchScheduler", () => {
  it("coalesces multiple queueJob calls in the same tick", async () => {
    let runs = 0;
    const job = createSchedulerJob(() => runs++, 100);
    queueJob(job);
    queueJob(job);
    queueJob(job);
    await nextTick();
    expect(runs).toBe(1);
  });

  it("runs distinct jobs independently", async () => {
    const calls: number[] = [];
    queueJob(createSchedulerJob(() => calls.push(1), 200));
    queueJob(createSchedulerJob(() => calls.push(2), 201));
    await nextTick();
    expect(calls.sort()).toEqual([1, 2]);
  });

  it("isolates job errors — failing job does not block siblings", async () => {
    const calls: number[] = [];
    queueJob(
      createSchedulerJob(() => {
        throw new Error("boom");
      }, 300),
    );
    queueJob(createSchedulerJob(() => calls.push(1), 301));
    await nextTick();
    expect(calls).toEqual([1]);
  });

  it("respects job id ordering when flushing", async () => {
    const order: number[] = [];
    queueJob(createSchedulerJob(() => order.push(2), 402));
    queueJob(createSchedulerJob(() => order.push(1), 401));
    await nextTick();
    expect(order).toEqual([1, 2]);
  });

  describe("scheduleComponentUpdate", () => {
    it("deduplicates updates per component", async () => {
      let runs = 0;
      scheduleComponentUpdate("cmp-1", () => runs++);
      scheduleComponentUpdate("cmp-1", () => runs++);
      scheduleComponentUpdate("cmp-1", () => runs++);
      await nextTick();
      expect(runs).toBe(1);
      unregisterComponent("cmp-1");
    });

    it("runs updates for different components independently", async () => {
      let a = 0;
      let b = 0;
      scheduleComponentUpdate("cmp-a", () => a++);
      scheduleComponentUpdate("cmp-b", () => b++);
      await nextTick();
      expect(a).toBe(1);
      expect(b).toBe(1);
      unregisterComponent("cmp-a");
      unregisterComponent("cmp-b");
    });
  });
});
