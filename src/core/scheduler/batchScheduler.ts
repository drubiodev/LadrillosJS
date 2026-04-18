/**
 * Batch Update Scheduler
 *
 * Batches multiple state updates into a single DOM update cycle.
 *
 * This prevents:
 * - Multiple re-renders when setting multiple properties
 * - Layout thrashing from interleaved reads/writes
 * - Unnecessary work when the same property is updated multiple times
 *
 * @example
 * // Without batching: 3 re-renders
 * state.count = 1;
 * state.name = "hello";
 * state.items.push(newItem);
 *
 * // With batching: 1 re-render
 * batch(() => {
 *   state.count = 1;
 *   state.name = "hello";
 *   state.items.push(newItem);
 * });
 */

import { error } from "../../utils/devWarnings";

// ============================================================================
// Types
// ============================================================================

type FlushCallback = () => void;
type SchedulerJob = FlushCallback & {
  id?: number;
  pre?: boolean;
  active?: boolean;
};

// ============================================================================
// State
// ============================================================================

/**
 * Queue of pending update jobs
 */
const queue: SchedulerJob[] = [];

/**
 * Set of queued job ids for deduplication
 */
const queuedIds = new Set<number>();

/**
 * Pending promise for the current flush cycle
 */
let currentFlushPromise: Promise<void> | null = null;

/**
 * Whether we're currently flushing the queue
 */
let isFlushing = false;

/**
 * Whether a flush is pending (scheduled but not started)
 */
let isFlushPending = false;

/**
 * Job ID counter for deduplication
 */
let jobIdCounter = 0;

/**
 * Resolved promise for microtask scheduling
 */
const resolvedPromise = Promise.resolve();

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Schedules a job to run in the next microtask.
 * Jobs are deduplicated by id - if the same job is queued multiple times,
 * it only runs once.
 *
 * @param job - The update function to schedule
 * @returns The job id for tracking
 */
export function queueJob(job: SchedulerJob): number {
  // Assign an id if not present
  if (job.id === undefined) {
    job.id = ++jobIdCounter;
  }

  // Deduplicate - don't queue the same job twice
  if (!queuedIds.has(job.id)) {
    queuedIds.add(job.id);
    queue.push(job);
    queueFlush();
  }

  return job.id;
}

/**
 * Creates a scheduler job with a stable id for deduplication.
 * Use this to ensure the same logical update only runs once per flush.
 *
 * @param fn - The update function
 * @param id - Optional stable id (uses auto-increment if not provided)
 * @returns A scheduler job with an id
 */
export function createSchedulerJob(
  fn: FlushCallback,
  id?: number,
): SchedulerJob {
  const job = fn as SchedulerJob;
  job.id = id ?? ++jobIdCounter;
  job.active = true;
  return job;
}

/**
 * Schedules the queue to be flushed in the next microtask.
 */
function queueFlush(): void {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true;
    currentFlushPromise = resolvedPromise.then(flushJobs);
  }
}

/**
 * Flushes all queued jobs.
 */
function flushJobs(): void {
  isFlushPending = false;
  isFlushing = true;

  // Sort by id to ensure parent updates run before children
  // (lower ids are typically registered earlier)
  queue.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  try {
    for (const job of queue) {
      if (job.active !== false) {
        try {
          job();
        } catch (e) {
          error("Error in scheduled update", null, e);
        }
      }
    }
  } finally {
    // Clear the queue
    queue.length = 0;
    queuedIds.clear();
    isFlushing = false;
    currentFlushPromise = null;
  }
}

/**
 * Wait for the current flush to complete.
 *
 * @returns Promise that resolves after the current flush
 *
 * @example
 * state.count = 1;
 * await nextTick();
 * // DOM is now updated
 * console.log(element.textContent);
 */
export function nextTick(): Promise<void> {
  return currentFlushPromise ?? resolvedPromise;
}

/**
 * Execute multiple state updates in a single batch.
 * All updates within the callback are deferred and
 * applied together in one DOM update cycle.
 *
 * @param fn - Function containing multiple state updates
 *
 * @example
 * batch(() => {
 *   state.firstName = "John";
 *   state.lastName = "Doe";
 *   state.age = 30;
 * });
 * // Only one DOM update occurs
 */
export function batch(fn: () => void): void {
  // If we're already flushing or there's a pending flush,
  // the updates will be batched naturally
  fn();
}

/**
 * Force an immediate synchronous flush of all pending updates.
 * Use sparingly - async batching is usually preferred.
 */
export function flushSync(): void {
  if (currentFlushPromise) {
    flushJobs();
  }
}

// ============================================================================
// Component Update Scheduler
// ============================================================================

/**
 * Per-component update job registry.
 * Maps component IDs to their update jobs for deduplication.
 */
const componentJobs = new Map<string, SchedulerJob>();

/**
 * Schedules a component update with automatic deduplication.
 * Multiple calls for the same component in the same tick
 * result in only one update.
 *
 * @param componentId - Unique component identifier
 * @param updateFn - The component's update function
 */
export function scheduleComponentUpdate(
  componentId: string,
  updateFn: () => void,
): void {
  let job = componentJobs.get(componentId);

  if (!job) {
    job = createSchedulerJob(() => {
      updateFn();
    });
    componentJobs.set(componentId, job);
  }

  queueJob(job);
}

/**
 * Removes a component from the scheduler registry.
 * Call this in disconnectedCallback to prevent memory leaks.
 *
 * @param componentId - The component ID to unregister
 */
export function unregisterComponent(componentId: string): void {
  const job = componentJobs.get(componentId);
  if (job) {
    job.active = false;
    componentJobs.delete(componentId);
  }
}
