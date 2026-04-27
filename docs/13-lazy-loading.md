# Lazy Loading

Lazy loading defers content (or whole components) until they're needed,
improving initial page load performance.

LadrillosJS gives you **two ways** to lazy-load:

1. **Declaratively** with the `<lazy>` built-in element — best for inline
   content, skeletons, and per-instance triggers.
2. **At registration time** with the `lazy:` option on `registerComponent` /
   `registerComponents` — best for whole components used in many places.

Both ultimately use the same five strategies (`visible`, `idle`, `delay`,
`interaction`, `media`).

---

## The `<lazy>` Element

Wrap any markup in `<lazy>` and supply a strategy via attributes. The content
is detached at scan time and re-inserted when the strategy fires.

```html
<lazy margin="100px">
  <heavy-chart></heavy-chart>
  <p>Renders when 100px from the viewport.</p>
</lazy>
```

### Strategy attributes

A `<lazy>` element picks its strategy based on which attributes are present.
Resolution priority (highest first):

| Priority | Attribute(s)                   | Strategy             |
| -------- | ------------------------------ | -------------------- |
| 1        | `eager`                        | Load immediately     |
| 2        | `interaction="click,focus"`    | `lazyOnInteraction`  |
| 3        | `media="(max-width: 768px)"`   | `lazyOnMedia`        |
| 4        | `delay="3000"` (ms)            | `lazyOnDelay`        |
| 5        | `idle` / `idle-timeout="5000"` | `lazyOnIdle`         |
| 6        | `margin="100px"` / `threshold="0.5"` / nothing | `lazyOnVisible` (default) |

### Inline content examples

```html
<!-- Default: viewport-triggered -->
<lazy>
  <p>Loads when scrolled into view.</p>
</lazy>

<!-- Viewport with custom margin/threshold -->
<lazy margin="200px" threshold="0.25">
  <expensive-widget></expensive-widget>
</lazy>

<!-- Idle (with optional max-wait timeout) -->
<lazy idle idle-timeout="5000">
  <analytics-pixel></analytics-pixel>
</lazy>

<!-- Time delay -->
<lazy delay="3000">
  <chat-widget></chat-widget>
</lazy>

<!-- User interaction -->
<lazy interaction="click,focus">
  <support-chat></support-chat>
</lazy>

<!-- Media query -->
<lazy media="(max-width: 768px)">
  <mobile-nav></mobile-nav>
</lazy>

<!-- Force eager (skip lazy) -->
<lazy eager>
  <p>Renders immediately.</p>
</lazy>
```

### `margin` and `threshold` explained

These two attributes tune the default viewport-based strategy. They map
directly to [`IntersectionObserver`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver)'s
`rootMargin` and `threshold` options.

#### `margin` — how early to trigger

Expands (or shrinks) the viewport's "trigger box" so loading starts *before*
the element actually scrolls into view. Same syntax as CSS margins (px or %).

| Value           | Behavior                                                    |
| --------------- | ----------------------------------------------------------- |
| `"100px"`       | Default. Fires when within 100px of the viewport.           |
| `"500px"`       | Aggressive preload — fires roughly half a screen early.     |
| `"0px"`         | Fires only when the element actually intersects.            |
| `"-50px"`       | Waits until the element is 50px **inside** the viewport.    |
| `"200px 0px"`   | Different per side (top/bottom 200px, left/right 0px).      |

#### `threshold` — how much must be visible

A number from `0` to `1` representing the fraction of the element that must
be inside the (margin-expanded) viewport before triggering.

| Value     | Behavior                                       |
| --------- | ---------------------------------------------- |
| `"0"`     | Default. Fires as soon as any pixel intersects. |
| `"0.5"`   | Fires when 50% of the element is visible.      |
| `"1"`     | Fires only when the entire element is visible. |

#### Combined example

```html
<lazy margin="200px" threshold="0.25">
  <expensive-widget></expensive-widget>
</lazy>
```

> Start loading when the widget is within 200px of the viewport **and** at
> least 25% of it would be visible at that point.

#### Practical guidance

- **Below-the-fold images / charts:** `margin="200px"` so it loads slightly
  before the user scrolls in.
- **Analytics / impression tracking:** `threshold="0.5"` so it only counts
  as "seen" when at least half visible.
- **Heavy components on slow connections:** larger `margin` (e.g. `"500px"`)
  to mask load time.

---

### Placeholder content

Use a nested `<template slot="placeholder">` to show something while the real
content is waiting:

```html
<lazy idle idle-timeout="5000">
  <template slot="placeholder">
    <div class="skeleton">
      <div class="skeleton-bar"></div>
      <div class="skeleton-bar"></div>
    </div>
  </template>

  <expensive-chart></expensive-chart>
</lazy>

<style>
  .skeleton-bar {
    height: 20px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
</style>
```

The placeholder is removed in a single DOM operation when the real content
swaps in.

### Lazy-load a component file declaratively

`<lazy>` can also lazy-register an external component file. Use the `src`
attribute (and optionally `component` to override the auto-derived tag name):

```html
<!-- Auto-derives tag name from filename: heavy-chart -->
<lazy src="./components/heavy-chart.html" idle></lazy>

<!-- Explicit tag name override -->
<lazy src="./components/Chart.html" component="my-chart" margin="100px"></lazy>

<!-- With placeholder -->
<lazy src="./components/heavy-chart.html" idle>
  <template slot="placeholder">
    <div class="skeleton">Loading chart…</div>
  </template>
</lazy>
```

Other attributes on `<lazy>` (besides the strategy props, `src`, and
`component`) are forwarded to the loaded element. So `<lazy src="…"
title="Hello">` becomes `<my-thing title="Hello">` after upgrade.

---

## Registration-Time Lazy Loading

If a component is reused in many places, register it once with a strategy and
let every instance be lazy:

```javascript
import {
  registerComponent,
  registerComponents,
  lazyOnVisible,
  lazyOnIdle,
  lazyOnInteraction,
  lazyOnMedia,
  lazyOnDelay,
} from "ladrillosjs";

// Single component, default strategy (lazyOnVisible with 100px margin)
registerComponent("heavy-chart", "./components/chart.html", true, true);

// Multiple components, mixed strategies
await registerComponents([
  { name: "app-header", path: "./header.html" },                                       // eager
  { name: "app-footer", path: "./footer.html",   lazy: lazyOnVisible({ rootMargin: "200px" }) },
  { name: "analytics",  path: "./analytics.html", lazy: lazyOnIdle(5000) },
  { name: "modal",      path: "./modal.html",     lazy: lazyOnInteraction() },
  { name: "mobile-nav", path: "./mobile-nav.html", lazy: lazyOnMedia("(max-width: 768px)") },
  { name: "chat",       path: "./chat.html",      lazy: lazyOnDelay(3000) },
]);
```

| Strategy            | Best For                                     |
| ------------------- | -------------------------------------------- |
| `lazyOnVisible`     | Below-the-fold content, footers, galleries   |
| `lazyOnIdle`        | Analytics, telemetry, non-visual components  |
| `lazyOnDelay`       | Chat widgets, support buttons                |
| `lazyOnInteraction` | Modals, dropdowns, search overlays           |
| `lazyOnMedia`       | Mobile/desktop/print-only components         |

### Eager override per instance

Force a lazily-registered component to load immediately by adding the `eager`
attribute on the element:

```html
<lazy-footer eager></lazy-footer>
```

### Force loading from JavaScript

```javascript
import { loadLazyComponent } from "ladrillosjs";

// Preload before user gets there
loadLazyComponent("heavy-chart");
```

Use case: preload on hover before click.

```html
<button onmouseenter="preloadModal()" onclick="openModal()">Open Modal</button>

<script type="module">
  import { loadLazyComponent } from "ladrillosjs";
  function preloadModal() {
    loadLazyComponent("settings-modal");
  }
</script>
```

---

## Custom Strategies

A strategy is just a function:

```ts
type LazyStrategy = (
  load: () => void,
  element: Element,
) => (() => void) | void;
```

Implement your own and pass it to `lazy:` (or use it inside a `<lazy>` via
the registration API):

```javascript
const lazyOnScroll = (scrollAmount) => (load, element) => {
  const handler = () => {
    if (window.scrollY > scrollAmount) {
      window.removeEventListener("scroll", handler);
      load();
    }
  };
  window.addEventListener("scroll", handler, { passive: true });
  return () => window.removeEventListener("scroll", handler);
};

registerComponent("scroll-reveal", "./reveal.html", true, lazyOnScroll(500));
```

---

## Performance Notes

- `<lazy>` detaches its children into a single `DocumentFragment` and
  re-inserts them in one DOM operation when the strategy fires.
- A zero-size sentinel (`<span style="display: contents">`) is used as the
  observer target for `IntersectionObserver` and event listeners — it has no
  layout cost.
- Strategy listeners are torn down automatically once the lazy content has
  been revealed.
- `<lazy src>` deduplicates concurrent loads of the same component file.

---

## Lazy Loading Flow

```
1. Scan template
   └── <lazy> element found, content moved to DocumentFragment
   └── Comment placeholder + (optional) <template slot="placeholder"> rendered
   └── Strategy listener attached to a display:contents sentinel

2. Strategy fires (visible, idle, click, etc.)
   └── Listener torn down, sentinel removed
   └── Placeholder content removed
   └── Real content (or upgraded <component>) inserted in one DOM op

3. (Optional) Component initializes
   └── Scripts run, reactivity wired
   └── ladrillos:ready event dispatched
```

---

← [Event Bus](./12-event-bus.md) | [Shadow DOM](./14-shadow-dom.md) →

[Back to Index](./README.md)
