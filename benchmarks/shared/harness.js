/**
 * Shared in-page benchmark harness.
 *
 * Each framework page defines `window.benchApi` with the same shape:
 *   create(n)   - replace all rows with n freshly built rows
 *   append(n)   - append n freshly built rows
 *   update()    - append " !!!" to the label of every 10th row
 *   select(id)  - mark the row with this id as selected (adds .danger)
 *   swap()      - swap rows at index 1 and 998
 *   remove(id)  - remove the row with this id
 *   clear()     - remove all rows
 *
 * DOM state is verified by querying the live document (not framework
 * state), so a timing sample only ends once the real DOM reflects the
 * operation. Timings cover the framework's full update path — JS work,
 * scheduling, and DOM mutation — but not GPU paint. The clock is
 * checked on microtasks first (covers microtask-flushing schedulers),
 * then MessageChannel macrotasks (covers React's scheduler) so there is
 * no requestAnimationFrame frame-boundary floor and no setTimeout
 * nesting clamp distorting sub-frame operations.
 */
(() => {
  const ADJECTIVES = [
    "pretty", "large", "big", "small", "tall", "short", "long", "handsome",
    "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful",
    "mushy", "odd", "unsightly", "adorable", "important", "inexpensive",
    "cheap", "expensive", "fancy",
  ];
  const COLOURS = [
    "red", "yellow", "blue", "green", "pink", "brown", "purple", "brown",
    "white", "black", "orange",
  ];
  const NOUNS = [
    "table", "chair", "house", "bbq", "desk", "car", "pony", "cookie",
    "sandwich", "burger", "pizza", "mouse", "keyboard",
  ];

  let nextId = 1;

  function buildData(count) {
    const data = new Array(count);
    for (let i = 0; i < count; i++) {
      data[i] = {
        id: nextId++,
        label:
          ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] + " " +
          COLOURS[Math.floor(Math.random() * COLOURS.length)] + " " +
          NOUNS[Math.floor(Math.random() * NOUNS.length)],
      };
    }
    return data;
  }

  // --- DOM readers (framework-agnostic ground truth) -----------------
  const rowEls = () => document.querySelectorAll(".row");
  const rowCount = () => rowEls().length;
  const rowId = (i) => rowEls()[i]?.querySelector(".col-id")?.textContent ?? null;
  const rowLabel = (i) => rowEls()[i]?.querySelector(".col-label")?.textContent ?? null;
  const selectedCount = () => document.querySelectorAll(".row.danger").length;

  const settle = () =>
    new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const microtask = () => Promise.resolve();
  const macrotask = () =>
    new Promise((r) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => r();
      ch.port2.postMessage(0);
    });

  async function measureOnce(name, run, verify) {
    const t0 = performance.now();
    run();
    let spins = 0;
    while (!verify()) {
      // Microtasks first: catches schedulers that flush on Promise.then.
      // Fall back to MessageChannel macrotasks (no 4ms setTimeout clamp)
      // for schedulers that flush on a macrotask, like React's.
      await (spins < 50 ? microtask() : macrotask());
      if (++spins > 200000) throw new Error(`verify timeout in "${name}"`);
    }
    return performance.now() - t0;
  }

  // Each op: setup (untimed) returns a context object, run/verify get it.
  function makeOps(api) {
    return {
      "create 1,000 rows": {
        setup: () => api.clear(),
        run: () => api.create(1000),
        verify: () => rowCount() === 1000,
      },
      "replace all 1,000 rows": {
        setup: () => {
          api.create(1000);
          return { before: null };
        },
        preRun: (ctx) => (ctx.before = rowId(0)),
        run: () => api.create(1000),
        verify: (ctx) => rowCount() === 1000 && rowId(0) !== ctx.before,
      },
      "partial update (every 10th of 1,000)": {
        setup: () => {
          api.create(1000);
          return { before: null };
        },
        preRun: (ctx) => (ctx.before = rowLabel(0)),
        run: () => api.update(),
        verify: (ctx) => rowLabel(0) === ctx.before + " !!!",
      },
      "select row": {
        setup: () => {
          api.create(1000);
          return { id: null };
        },
        preRun: (ctx) => (ctx.id = Number(rowId(500))),
        run: (ctx) => api.select(ctx.id),
        verify: () => selectedCount() === 1,
      },
      "swap 2 rows": {
        setup: () => {
          api.create(1000);
          return { a: null, b: null };
        },
        preRun: (ctx) => {
          ctx.a = rowId(1);
          ctx.b = rowId(998);
        },
        run: () => api.swap(),
        verify: (ctx) => rowId(1) === ctx.b && rowId(998) === ctx.a,
      },
      "remove row": {
        setup: () => {
          api.create(1000);
          return { id: null };
        },
        preRun: (ctx) => (ctx.id = Number(rowId(500))),
        run: (ctx) => api.remove(ctx.id),
        verify: () => rowCount() === 999,
      },
      "append 1,000 to 1,000 rows": {
        setup: () => api.create(1000),
        run: () => api.append(1000),
        verify: () => rowCount() === 2000,
      },
      "clear 1,000 rows": {
        setup: () => api.create(1000),
        run: () => api.clear(),
        verify: () => rowCount() === 0,
      },
      "create 10,000 rows": {
        setup: () => api.clear(),
        run: () => api.create(10000),
        verify: () => rowCount() === 10000,
        samples: 5,
        warmup: 1,
      },
    };
  }

  async function runBench({ samples = 10, warmup = 3 } = {}) {
    const api = window.benchApi;
    if (!api) throw new Error("window.benchApi is not defined");
    const ops = makeOps(api);
    const results = {};

    for (const [name, op] of Object.entries(ops)) {
      const nSamples = op.samples ?? samples;
      const nWarmup = op.warmup ?? warmup;
      const timings = [];

      for (let i = 0; i < nWarmup + nSamples; i++) {
        const ctx = (op.setup && op.setup()) || {};
        await settle();
        await settle();
        if (op.preRun) op.preRun(ctx);
        const ms = await measureOnce(
          name,
          () => op.run(ctx),
          () => op.verify(ctx)
        );
        if (i >= nWarmup) timings.push(ms);
      }

      timings.sort((a, b) => a - b);
      const median =
        timings.length % 2
          ? timings[(timings.length - 1) / 2]
          : (timings[timings.length / 2 - 1] + timings[timings.length / 2]) / 2;
      results[name] = {
        median: +median.toFixed(1),
        min: +timings[0].toFixed(1),
        max: +timings[timings.length - 1].toFixed(1),
        samples: timings.map((t) => +t.toFixed(1)),
      };
      api.clear();
    }

    // Heap after rendering 1,000 rows (Chrome only; needs --enable-precise-memory-info)
    let heapMB = null;
    if (performance.memory) {
      api.create(1000);
      await settle();
      if (window.gc) window.gc();
      await settle();
      heapMB = +(performance.memory.usedJSHeapSize / 1048576).toFixed(1);
      api.clear();
    }

    return { results, heapMB };
  }

  window.__bench = { buildData, runBench, rowCount };
})();
