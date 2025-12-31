// Batch Update Scheduler
export {
  queueJob,
  createSchedulerJob,
  nextTick,
  batch,
  flushSync,
  scheduleComponentUpdate,
  unregisterComponent,
} from "../scheduler/batchScheduler";

// Expression & Regex Caching
export {
  getCachedEvaluator,
  getCachedVariableRegex,
  expressionDependsOnCached,
  getCachedPath,
  getByPath,
  setByPath,
  clearExpressionCache,
} from "../cache/expressionCache";

// Fine-Grained Dependency Tracking
export {
  track,
  trigger,
  effect,
  pauseTracking,
  resumeTracking,
  untrack,
  getDeps,
  getDepCount,
  resetTracking,
  type ReactiveEffect,
  type Dep,
} from "../reactivity/dependencyTracker";

// Keyed List Diffing
export {
  diffKeyed,
  diffUnkeyed,
  createKeyGetter,
  applyDiffOperations,
  type DiffOperation,
} from "../diff/listDiff";
