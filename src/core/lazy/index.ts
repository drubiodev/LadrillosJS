/**
 * Lazy Loading Module
 * Re-exports all lazy loading utilities
 */

export {
  type LazyStrategy,
  type LazyStrategyFactory,
  lazyOnIdle,
  lazyOnVisible,
  lazyOnMedia,
  lazyOnInteraction,
  lazyOnDelay,
  defaultLazyStrategy,
} from "./lazyStrategies";

export {
  initLazyLoader,
  registerLazyComponent,
  isLazyComponent,
  forceLoadLazyComponent,
  getLazyComponentTagName,
} from "./lazyLoader";
