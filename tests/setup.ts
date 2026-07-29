/**
 * Global Vitest setup.
 *
 * happy-dom provides document, window, customElements, HTMLElement, etc.,
 * but a few browser APIs need polyfills for the LadrillosJS test suite:
 *   - IntersectionObserver (lazyOnVisible)
 *   - requestIdleCallback (lazyOnIdle)
 *   - matchMedia (lazyOnMedia)
 */
import { setCodegenBackend } from "../src/core/js/compiler";
import { runtimeBackend } from "../src/core/js/runtimeBackend";

// Tests import deep modules rather than an entry point, so nothing would have
// installed a backend. Entry points do this for real consumers.
setCodegenBackend(runtimeBackend);

// IntersectionObserver stub with manual trigger
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "0px";
  readonly thresholds: readonly number[] = [0];

  private callback: IntersectionObserverCallback;
  private targets = new Set<Element>();

  constructor(
    callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }
  unobserve(target: Element): void {
    this.targets.delete(target);
  }
  disconnect(): void {
    this.targets.clear();
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Test helper: trigger intersect for a specific element */
  trigger(target: Element, isIntersecting = true): void {
    if (!this.targets.has(target)) return;
    const entry = {
      target,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(),
      rootBounds: null,
      time: Date.now(),
    } as IntersectionObserverEntry;
    this.callback([entry], this);
  }

  static instances: MockIntersectionObserver[] = [];
  static reset(): void {
    this.instances = [];
  }
}

(globalThis as any).IntersectionObserver = MockIntersectionObserver;
(globalThis as any).MockIntersectionObserver = MockIntersectionObserver;

// requestIdleCallback polyfill
if (typeof (globalThis as any).requestIdleCallback === "undefined") {
  (globalThis as any).requestIdleCallback = (
    cb: (d: { didTimeout: boolean; timeRemaining: () => number }) => void,
    _opts?: { timeout?: number },
  ): number => {
    return setTimeout(
      () => cb({ didTimeout: false, timeRemaining: () => 50 }),
      0,
    ) as unknown as number;
  };
  (globalThis as any).cancelIdleCallback = (id: number) => clearTimeout(id);
}

// matchMedia polyfill (happy-dom provides one, but assert shape)
if (typeof window !== "undefined" && !window.matchMedia) {
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
