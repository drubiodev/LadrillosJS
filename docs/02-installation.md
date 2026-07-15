# Installation

LadrillosJS can be used with or without a build step. Choose the method that fits your project.

## CDN (No Build Step)

Perfect for quick prototypes, learning, or projects without a build system.
LadrillosJS v2 is distributed as native ES modules:

```html
<script type="module">
  import { registerComponent } from "https://cdn.jsdelivr.net/npm/ladrillosjs@2/dist/index.js";

  registerComponent("my-component", "./component.html");
</script>
```

Also available on unpkg:

```html
<script type="module">
  import { registerComponent } from "https://unpkg.com/ladrillosjs@2/dist/index.js";
</script>
```

> **Note:** v2 is **ESM-only**. The v1 UMD global build
> (`dist/ladrillosjs.umd.js`) is no longer published — see the
> [migration guide](./17-migration-v1-to-v2.md) if you're upgrading.

---

## NPM (With Build Tools)

Best for production apps using Vite, Webpack, or other bundlers.

### Install

```bash
npm install ladrillosjs
# or
yarn add ladrillosjs
# or
pnpm add ladrillosjs
```

### Basic Usage

```javascript
import { registerComponent, registerComponents } from "ladrillosjs";

// Single component
registerComponent("my-counter", "./components/counter.html");

// Multiple components (parallel loading)
await registerComponents({
  "app-header": "./components/header.html",
  "app-footer": "./components/footer.html",
  "user-card": "./components/user-card.html",
});
```

### Using with Vite

Vite works great with LadrillosJS. Create a project:

```bash
npm create vite@latest my-app
cd my-app
npm install ladrillosjs
```

In your `main.ts`:

```typescript
import { registerComponents } from "ladrillosjs";

await registerComponents({
  "app-header": "./components/header.html",
  "app-content": "./components/content.html",
});
```

---

## Available Exports

```javascript
import {
  // Component Registration
  registerComponent, // Register a single component
  registerComponents, // Register multiple components
  $use, // Shorthand registration (tag name derived from path)
  loadLazyComponent, // Force load a lazy component

  // Configuration
  configure, // Framework options (cacheSize, onError)

  // Event Bus
  $emit, // Emit events
  $listen, // Listen for events

  // Lazy Loading Strategies
  lazyOnIdle, // Load when browser is idle
  lazyOnVisible, // Load when element is visible
  lazyOnMedia, // Load when media query matches
  lazyOnInteraction, // Load on user interaction
  lazyOnDelay, // Load after delay
} from "ladrillosjs";
```

### Granular Imports (Tree-Shaking)

Import only what you need from the sub-path entry points:

```javascript
// Core only (no lazy loading, no event bus)
import { registerComponent } from "ladrillosjs/core";

// Lazy loading strategies only
import { lazyOnVisible, lazyOnIdle } from "ladrillosjs/lazy";

// Event bus only
import { $emit, $listen } from "ladrillosjs/events";
```

---

## TypeScript Support

LadrillosJS includes TypeScript definitions. Types are exported:

```typescript
import type {
  ComponentConfig,
  RegisterComponentsResult,
  EventCallback,
  LazyStrategy,
} from "ladrillosjs";
```

---

## File Structure Recommendation

```
my-project/
├── index.html
├── components/
│   ├── header.html
│   ├── footer.html
│   ├── counter.html
│   └── user-card.html
└── styles/
    └── main.css
```

Or organize by feature:

```
my-project/
├── index.html
└── components/
    ├── header/
    │   ├── index.html      ← Main component
    │   └── nav-item.html   ← Child component
    ├── user/
    │   ├── index.html
    │   └── avatar.html
    └── shared/
        └── button.html
```

LadrillosJS supports folder-as-component:

```javascript
// These are equivalent:
registerComponent("my-header", "./components/header/index.html");
registerComponent("my-header", "./components/header"); // Auto-resolves to index.html
```

---

← [Quick Start](./01-quick-start.md) | [Components](./03-components.md) →

[Back to Index](./README.md)
