# LadrillosJS Benchmarks

A [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark)–style
suite comparing LadrillosJS against React 18 and a hand-optimized vanilla JS
baseline, all rendering the same keyed row list with identical markup and CSS.

## Run it

```bash
cd benchmarks
npm install
npm run bench
```

The `prebench` step rebuilds the package so the browser always measures the
current production bundle rather than stale `dist/` output.

Results are printed to the terminal and written to `results.json` (raw
samples) and `results.md` (README-ready table). The runner serves the repo
root over HTTP and drives each page in headless Chromium via
`playwright-core`, reusing the Playwright browser already in
`~/Library/Caches/ms-playwright` (no download).

## What is measured

Each implementation exposes the same `window.benchApi` (create, append,
partial update, select, swap, remove, clear). For every operation the
harness ([shared/harness.js](shared/harness.js)):

1. Runs an untimed setup (e.g. render 1,000 fresh rows).
2. Starts the clock, invokes the operation.
3. Polls the **live DOM** (not framework state) until it reflects the
   change — first on microtasks, then on MessageChannel macrotasks, so
   there is no `requestAnimationFrame` frame-boundary floor and no
   `setTimeout` nesting clamp.
4. Stops the clock. 3 warmup runs are discarded; the median of 10
   measured samples is reported (5 samples for the 10,000-row test).

Timings cover the full framework update path — JS work, scheduling, and
DOM mutation — but not GPU paint (the official krausest suite uses CDP
tracing to include paint; this suite deliberately stays simpler so anyone
can run it in one command).

Also reported:

- **JS payload (min+gzip)** — gzip size of every framework `.js` file the
  page actually loads (measured from real network requests, excluding the
  benchmark harness itself).
- **JS heap after 1,000 rows** — `performance.memory.usedJSHeapSize` after
  a forced GC.

## Fairness notes

- The React implementation mirrors the official krausest `react-hooks`
  entry: `createRoot`, keyed rows, memoized `Row` component,
  `useCallback` handlers, immutable state updates.
- React 18.3 UMD production builds are vendored in `react/vendor/` so the
  suite runs offline and results aren't skewed by CDN latency. (React 19
  dropped UMD builds; 18.3 is the latest self-contained browser build.)
- The LadrillosJS implementation uses the published `dist/` build, light
  DOM (`useShadowDOM: false`) so all three pages render the same document
  structure, and immutable array updates with `key`ed `<for>` — the same
  idiom the docs recommend.
- The vanilla implementation is a deliberately hand-optimized baseline
  (template cloning, a Map of id → element); treat it as the speed of
  light, not a realistic app architecture.
- No CPU throttling is applied. Absolute numbers depend on the machine;
  compare columns, not machines.
