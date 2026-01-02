/**
 * LadrillosJS Lazy Loading Module
 *
 * Provides lazy loading strategies for components.
 * Import this module only if you need lazy loading.
 *
 * @example
 * ```ts
 * import { lazyOnVisible, lazyOnIdle } from 'ladrillosjs/lazy';
 *
 * $registerComponent('heavy-widget', '/components/heavy.html', {
 *   lazy: lazyOnVisible({ rootMargin: '100px' })
 * });
 * ```
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
} from "./core/lazy";

export { forceLoadLazyComponent, isLazyComponent } from "./core/lazy";
