/**
 * Lazy Loading Strategies for LadrillosJS
 *
 * control over when lazy components are loaded.
 */

/**
 * A lazy loading strategy function.
 * @param load - Call this to trigger component loading
 * @param element - The placeholder element being observed
 * @returns Optional teardown function for cleanup
 */
export type LazyStrategy = (
  load: () => void,
  element: Element
) => (() => void) | void;

/**
 * Factory function that creates a LazyStrategy with options
 */
export type LazyStrategyFactory<T = undefined> = T extends undefined
  ? () => LazyStrategy
  : (options?: T) => LazyStrategy;

// Polyfills for Safari support
const requestIdleCallback: Window["requestIdleCallback"] =
  (globalThis as any).requestIdleCallback ||
  ((cb: IdleRequestCallback) => setTimeout(cb, 1));

const cancelIdleCallback: Window["cancelIdleCallback"] =
  (globalThis as any).cancelIdleCallback || ((id: number) => clearTimeout(id));

/**
 * Load when the browser is idle.
 * Uses requestIdleCallback with a timeout fallback.
 *
 * @param timeout - Max wait time in ms before forcing load (default: 10000)
 *
 * @example
 * { name: 'analytics', path: './analytics.html', lazy: lazyOnIdle(5000) }
 */
export const lazyOnIdle: LazyStrategyFactory<number> =
  (timeout = 10000) =>
  (load) => {
    const id = requestIdleCallback(load, { timeout });
    return () => cancelIdleCallback(id);
  };

/**
 * Load when element becomes visible in viewport.
 * Uses IntersectionObserver for efficient visibility detection.
 *
 * @param options - IntersectionObserver options (rootMargin, threshold, etc.)
 *
 * @example
 * // Load when 100px before entering viewport
 * { name: 'footer', path: './footer.html', lazy: lazyOnVisible({ rootMargin: '100px' }) }
 */
export const lazyOnVisible: LazyStrategyFactory<IntersectionObserverInit> =
  (options) => (load, element) => {
    // Check if already visible (handles edge case of element in viewport on mount)
    if (elementIsVisibleInViewport(element)) {
      load();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observer.disconnect();
          load();
          break;
        }
      }
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  };

/**
 * Load when specified media query matches.
 * Useful for mobile-only or desktop-only components.
 *
 * @param query - CSS media query string
 *
 * @example
 * { name: 'mobile-nav', path: './mobile-nav.html', lazy: lazyOnMedia('(max-width: 768px)') }
 */
export const lazyOnMedia: LazyStrategyFactory<string> = (query) => (load) => {
  if (!query) {
    load();
    return;
  }

  const mql = matchMedia(query);
  if (mql.matches) {
    load();
  } else {
    const handler = () => load();
    mql.addEventListener("change", handler, { once: true });
    return () => mql.removeEventListener("change", handler);
  }
};

/**
 * Load when user interacts with the element.
 * Replays the triggering event after component loads for seamless UX.
 *
 * @param events - Event type(s) to listen for (default: ['click', 'focusin'])
 *
 * @example
 * { name: 'modal', path: './modal.html', lazy: lazyOnInteraction('click') }
 * { name: 'form', path: './form.html', lazy: lazyOnInteraction(['focus', 'click']) }
 */
export const lazyOnInteraction: LazyStrategyFactory<string | string[]> = (
  events = ["click", "focusin"]
) => {
  const eventList = typeof events === "string" ? [events] : events;

  return (load: () => void, element: Element) => {
    let hasLoaded = false;

    const handler = (e: Event) => {
      if (hasLoaded) return;
      hasLoaded = true;
      teardown();
      load();

      // Replay the event after a microtask (allows component to mount)
      queueMicrotask(() => {
        if (e.target && e.target instanceof Element) {
          e.target.dispatchEvent(new (e.constructor as any)(e.type, e));
        }
      });
    };

    const teardown = () => {
      for (const evt of eventList) {
        element.removeEventListener(evt, handler);
      }
    };

    for (const evt of eventList) {
      element.addEventListener(evt, handler, { once: true, passive: true });
    }

    return teardown;
  };
};

/**
 * Load after a specified delay.
 * Simple time-based loading for non-critical components.
 *
 * @param ms - Delay in milliseconds
 *
 * @example
 * { name: 'chat-widget', path: './chat.html', lazy: lazyOnDelay(3000) }
 */
export const lazyOnDelay: LazyStrategyFactory<number> =
  (ms = 0) =>
  (load) => {
    const id = setTimeout(load, ms);
    return () => clearTimeout(id);
  };

// Helper to check if element is in viewport
function elementIsVisibleInViewport(el: Element): boolean {
  const { top, left, bottom, right } = el.getBoundingClientRect();
  const { innerHeight, innerWidth } = window;
  return (
    ((top > 0 && top < innerHeight) || (bottom > 0 && bottom < innerHeight)) &&
    ((left > 0 && left < innerWidth) || (right > 0 && right < innerWidth))
  );
}

/**
 * Default lazy strategy - loads when visible with 100px root margin
 * for smooth loading before element enters viewport
 */
export const defaultLazyStrategy = lazyOnVisible({ rootMargin: "100px" });
