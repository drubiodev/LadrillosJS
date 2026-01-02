# Lazy Loading

Lazy loading defers component loading until needed, improving initial page load performance.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Page Load                                │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Critical components load immediately                        │
│  ⏳ Non-critical components are registered but NOT fetched      │
│                                                                 │
│  Later, when triggered:                                         │
│  📥 Lazy components fetch their HTML and initialize             │
└─────────────────────────────────────────────────────────────────┘
```

## Basic Lazy Loading

Set `lazy: true` to use the default strategy (load when visible):

```javascript
import { registerComponent, registerComponents } from "ladrillosjs";

// Single component
registerComponent("heavy-chart", "./components/chart.html", true, true);
//                                                         ↑shadow  ↑lazy

// Multiple components
await registerComponents([
  { name: "app-header", path: "./header.html" }, // Eager (default)
  { name: "app-footer", path: "./footer.html", lazy: true }, // Lazy
  { name: "analytics", path: "./analytics.html", lazy: true },
]);

// Object syntax
await registerComponents({
  "app-header": "./header.html",
  "app-footer": { path: "./footer.html", lazy: true },
  analytics: { path: "./analytics.html", lazy: true },
});
```

---

## Lazy Loading Strategies

LadrillosJS provides 5 built-in strategies:

### 1. `lazyOnVisible` (Default)

Loads when the element enters the viewport:

```javascript
import { registerComponent, lazyOnVisible } from "ladrillosjs";

// Default: 100px root margin (loads slightly before visible)
registerComponent("my-component", "./component.html", true, true);

// Custom options (IntersectionObserver options)
registerComponent(
  "my-component",
  "./component.html",
  true,
  lazyOnVisible({ rootMargin: "200px", threshold: 0.1 })
);
```

Best for: Below-the-fold content, images, cards

### 2. `lazyOnIdle`

Loads when the browser is idle:

```javascript
import { registerComponent, lazyOnIdle } from "ladrillosjs";

// Default: 10 second timeout
registerComponent("analytics", "./analytics.html", true, lazyOnIdle());

// Custom timeout (ms)
registerComponent("analytics", "./analytics.html", true, lazyOnIdle(5000));
```

Best for: Analytics, telemetry, non-visual components

### 3. `lazyOnDelay`

Loads after a specified time delay:

```javascript
import { registerComponent, lazyOnDelay } from "ladrillosjs";

// Load after 3 seconds
registerComponent("chat-widget", "./chat.html", true, lazyOnDelay(3000));

// Load immediately after registration (next tick)
registerComponent("soon", "./soon.html", true, lazyOnDelay(0));
```

Best for: Non-critical features, chat widgets, support buttons

### 4. `lazyOnInteraction`

Loads when user interacts with the element:

```javascript
import { registerComponent, lazyOnInteraction } from "ladrillosjs";

// Default: click and focusin
registerComponent("modal", "./modal.html", true, lazyOnInteraction());

// Custom events
registerComponent("search", "./search.html", true, lazyOnInteraction("focus"));
registerComponent(
  "dropdown",
  "./dropdown.html",
  true,
  lazyOnInteraction(["mouseenter", "focus"])
);
```

Best for: Modals, dropdowns, expandable sections, search boxes

### 5. `lazyOnMedia`

Loads when a media query matches:

```javascript
import { registerComponent, lazyOnMedia } from "ladrillosjs";

// Mobile-only component
registerComponent(
  "mobile-nav",
  "./mobile-nav.html",
  true,
  lazyOnMedia("(max-width: 768px)")
);

// Desktop-only component
registerComponent(
  "sidebar",
  "./sidebar.html",
  true,
  lazyOnMedia("(min-width: 1024px)")
);

// Print-only
registerComponent(
  "print-header",
  "./print-header.html",
  true,
  lazyOnMedia("print")
);
```

Best for: Responsive components, print styles, device-specific features

---

## Placeholder Content

While a lazy component loads, you can show placeholder content:

```html
<heavy-chart>
  <!-- This content shows while loading -->
  <div class="skeleton">
    <div class="skeleton-bar"></div>
    <div class="skeleton-bar"></div>
    <div class="skeleton-bar"></div>
  </div>
</heavy-chart>

<style>
  .skeleton-bar {
    height: 20px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    margin: 10px 0;
    border-radius: 4px;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
```

The placeholder is replaced once the component loads.

---

## Force Loading

Manually trigger a lazy component to load:

```javascript
import { loadLazyComponent } from "ladrillosjs";

// Preload before user gets there
loadLazyComponent("heavy-chart");
```

Use case: Preload on hover before click

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

Create your own loading strategy:

```javascript
import { registerComponent } from "ladrillosjs";

// Strategy signature: (load: () => void, element: Element) => (() => void) | void
const lazyOnScroll = (scrollAmount) => (load, element) => {
  const handler = () => {
    if (window.scrollY > scrollAmount) {
      window.removeEventListener("scroll", handler);
      load();
    }
  };

  window.addEventListener("scroll", handler, { passive: true });

  // Return cleanup function
  return () => window.removeEventListener("scroll", handler);
};

// Use it
registerComponent("scroll-reveal", "./reveal.html", true, lazyOnScroll(500));
```

---

## Performance Comparison

| Strategy            | Network        | Best For                     |
| ------------------- | -------------- | ---------------------------- |
| Eager (default)     | Immediate      | Critical, above-fold content |
| `lazyOnVisible`     | On scroll      | Below-fold content           |
| `lazyOnIdle`        | When idle      | Background/analytics         |
| `lazyOnDelay`       | After timeout  | Progressive enhancement      |
| `lazyOnInteraction` | On user action | Modals, menus                |
| `lazyOnMedia`       | On breakpoint  | Responsive components        |

---

## Complete Example

```javascript
import {
  registerComponents,
  lazyOnVisible,
  lazyOnIdle,
  lazyOnInteraction,
  lazyOnMedia,
  lazyOnDelay,
} from "ladrillosjs";

await registerComponents([
  // Critical - loads immediately
  { name: "app-header", path: "./header.html" },
  { name: "hero-section", path: "./hero.html" },

  // Below fold - load when scrolled to
  { name: "feature-grid", path: "./features.html", lazy: lazyOnVisible() },
  {
    name: "testimonials",
    path: "./testimonials.html",
    lazy: lazyOnVisible({ rootMargin: "200px" }),
  },

  // Not visible - load when idle
  { name: "analytics", path: "./analytics.html", lazy: lazyOnIdle(5000) },

  // On demand
  {
    name: "settings-modal",
    path: "./settings.html",
    lazy: lazyOnInteraction(),
  },
  {
    name: "search-overlay",
    path: "./search.html",
    lazy: lazyOnInteraction("focus"),
  },

  // Responsive
  {
    name: "mobile-menu",
    path: "./mobile-menu.html",
    lazy: lazyOnMedia("(max-width: 768px)"),
  },
  {
    name: "sidebar",
    path: "./sidebar.html",
    lazy: lazyOnMedia("(min-width: 1024px)"),
  },

  // Delayed
  { name: "chat-widget", path: "./chat.html", lazy: lazyOnDelay(3000) },

  // Footer - almost never seen immediately
  { name: "app-footer", path: "./footer.html", lazy: true }, // Uses default (lazyOnVisible)
]);
```

---

## Lazy Loading Flow

```
1. Register component with lazy strategy
   └── Creates placeholder custom element
   └── Sets up strategy observer/listener

2. Strategy triggers (visibility, idle, click, etc.)
   └── Fetches component HTML
   └── Parses template, scripts, styles
   └── Replaces placeholder content

3. Component initializes
   └── Runs scripts
   └── Sets up reactivity
   └── Fires ladrillos:ready event
```

---

← [Event Bus](./12-event-bus.md) | [Shadow DOM](./14-shadow-dom.md) →

[Back to Index](./README.md)
