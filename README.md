# LadrillosJS

<p align="center">
  <img src="https://raw.githubusercontent.com/drubiodev/LadrillosJS/refs/heads/main/LadrillosJS.jpg" alt="LadrillosJS" width="300"/>
</p>

<p align="center">
  <strong>A lightweight, zero-dependency web component framework.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ladrillosjs"><img src="https://img.shields.io/npm/v/ladrillosjs.svg" alt="npm version"></a>
  <a href="https://github.com/drubiodev/LadrillosJS/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/ladrillosjs.svg" alt="license"></a>
  <a href="https://bundlephobia.com/package/ladrillosjs"><img src="https://img.shields.io/bundlephobia/minzip/ladrillosjs" alt="bundle size"></a>
  <a href="https://github.com/drubiodev/LadrillosJS"><img src="https://img.shields.io/github/stars/drubiodev/LadrillosJS?style=social" alt="GitHub stars"></a>
</p>

<p align="center">
  Build modular web apps with simple HTML components. No virtual DOM, no complex tooling required.
</p>

---

## 📑 Table of Contents

- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Core Concepts](#-core-concepts)
- [Built-in Elements & Directives](#-built-in-elements--directives)
- [Event Bus](#-event-bus)
- [Element References](#-element-references)
- [Lazy Loading](#-lazy-loading)
- [API Reference](#-api-reference)
- [Using with Vite](#-using-with-vite)
- [Benchmarks](#-benchmarks)
- [Examples](#-examples)
- [Documentation](#-documentation)
- [Security & Trust Model](#-security--trust-model)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Quick Start

### 1. Create a Component

Save this as `counter.html`:

```html
<div class="counter">
  <div class="count-display">{count}</div>
  <div class="buttons">
    <button onclick="count--">−</button>
    <button onclick="count = 0">Reset</button>
    <button onclick="count++">+</button>
  </div>
  <p>Double: {count * 2} | Squared: {count * count}</p>
</div>

<script>
  let count = 0;
</script>

<style>
  .counter {
    text-align: center;
    padding: 2rem;
  }
  .count-display {
    font-size: 4rem;
    font-weight: bold;
  }
  button {
    padding: 0.5rem 1rem;
    margin: 0.25rem;
    cursor: pointer;
  }
</style>
```

### 2. Register and Use It

In your `index.html`, import LadrillosJS from the CDN, register the
component, and drop the tag anywhere on the page:

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="module">
      import { registerComponent } from "https://cdn.jsdelivr.net/npm/ladrillosjs@2/dist/index.js";
      registerComponent("my-counter", "./counter.html");
    </script>
  </head>
  <body>
    <my-counter></my-counter>
  </body>
</html>
```

### 3. Serve It

Components are fetched over HTTP, so serve the folder with any static server
(opening the file directly via `file://` won't work — browsers block `fetch`
from local files):

```bash
npx serve          # or: python -m http.server 8080
```

That's it! Your reactive component is ready. 🎉

> 📚 **Want more?** The [full documentation](docs/README.md) covers every
> feature step by step, from your first component to building a design system.

---

## 📦 Installation

### CDN (No Build Step)

LadrillosJS v2 is distributed as native ES modules. Import directly from a CDN:

```html
<!-- ES Module (recommended) -->
<script type="module">
  import {
    registerComponent,
    registerComponents,
  } from "https://cdn.jsdelivr.net/npm/ladrillosjs@2/dist/index.js";

  registerComponent("my-component", "./component.html");
</script>

<!-- Also available on unpkg -->
<script type="module">
  import { registerComponent } from "https://unpkg.com/ladrillosjs@2/dist/index.js";
</script>
```

> **Note:** LadrillosJS v2 is ESM-only. Legacy UMD/IIFE global builds are not published to npm.

### NPM (With Build Tools)

```bash
npm install ladrillosjs
```

```javascript
import { registerComponent, registerComponents } from "ladrillosjs";

// Single component
registerComponent("my-counter", "./components/counter.html");

// Multiple components
await registerComponents([
  { name: "app-header", path: "./components/header.html" },
  { name: "app-footer", path: "./components/footer.html" },
]);
```

### Granular Imports (Tree-Shaking)

```javascript
// Full API
import { registerComponent, $emit, $listen } from "ladrillosjs";

// Core only (no lazy loading, no event bus)
import { registerComponent } from "ladrillosjs/core";

// Lazy loading strategies only
import { lazyOnVisible, lazyOnIdle } from "ladrillosjs/lazy";

// Event bus only
import { $emit, $listen } from "ladrillosjs/events";
```

---

## 📖 Core Concepts

### Template Bindings

Use `{expression}` to display reactive data. Any JavaScript expression works:

```html
<h1>{title}</h1>
<p>Hello, {user.name}!</p>
<span>Total: {items.length} items</span>
<p>Is adult: {age >= 18 ? 'Yes' : 'No'}</p>
```

### Reactive State

Just declare variables with `let` — changes automatically update the DOM:

```html
<script>
  let count = 0;
  let user = { name: "Alice", role: "Developer" };
  let items = ["Apple", "Banana", "Cherry"];
</script>
```

### Event Handlers

Attach events directly in HTML with inline expressions or function calls:

```html
<button onclick="count++">Increment</button>
<button onclick="handleClick()">Click me</button>
<input onkeyup="search(event.target.value)" />
<form onsubmit="handleSubmit(event)">...</form>
```

Or use the `$on:` directive with **modifiers** — dot-separated flags for
common patterns like `preventDefault`, key filtering, and modifier keys:

```html
<form $on:submit.prevent="handleSubmit()">...</form>
<input $on:keyup.enter="search()" />
<textarea $on:keydown.ctrl.s.prevent="save()"></textarea>
<div $on:click.self="closeModal()">...</div>
<button $on:click.once="trackFirstClick()">Buy</button>
```

See the [Event Modifiers reference](docs/20-event-modifiers.md) for every
modifier and combination.

### Two-Way Binding

Use `$bind` to sync form inputs with state:

```html
<input type="text" $bind="username" placeholder="Enter name" />
<p>Hello, {username}!</p>

<textarea $bind="bio"></textarea>

<select $bind="country">
  <option value="us">United States</option>
  <option value="uk">United Kingdom</option>
</select>

<script>
  let username = "";
  let bio = "";
  let country = "us";
</script>
```

---

## 🧩 Built-in Elements & Directives

### Conditional Rendering

Use `<if>`, `<else-if>`, and `<else>` to conditionally render elements:

```html
<if condition="status === 'loading'">Loading...</if>
<else-if condition="status === 'error'">Something went wrong!</else-if>
<else>Content loaded successfully!</else>

<script>
  let status = "loading";
</script>
```

### Show/Hide (CSS Toggle)

Use `<show>` to toggle visibility without removing from DOM (uses `display: none`):

```html
<show condition="isVisible">I can be shown or hidden</show>

<button onclick="isVisible = !isVisible">Toggle</button>

<script>
  let isVisible = true;
</script>
```

> **`<show>` vs `<if>`:** `<show>` toggles CSS display (children stay in DOM), `<if>` adds/removes children entirely.

### List Rendering

Use `<for>` to render lists with optional index and key:

```html
<!-- Simple list -->
<ul>
  <for each="fruit in fruits">
    <li>🍎 {fruit}</li>
  </for>
</ul>

<!-- With index -->
<for each="(item, index) in items">
  <div>#{index + 1}: {item}</div>
</for>

<!-- Object array with key -->
<for each="user in users" key="user.id">
  <div>
    <span>{user.avatar}</span>
    <span>{user.name}</span>
    <span>{user.role}</span>
  </div>
</for>

<script>
  let fruits = ["Apple", "Banana", "Cherry"];
  let items = ["First", "Second", "Third"];
  let users = [
    { id: 1, name: "Alice", role: "Developer", avatar: "👩‍💻" },
    { id: 2, name: "Bob", role: "Designer", avatar: "👨‍🎨" },
  ];
</script>
```

### Lazy Loading

Use `<lazy>` to defer rendering until a trigger fires (viewport, idle, delay, interaction, media):

```html
<lazy margin="100px">
  <heavy-chart></heavy-chart>
</lazy>

<lazy interaction="click,focus">
  <support-chat></support-chat>
</lazy>
```

### Cheat Sheet

| Element / Directive | Purpose                  | Example                                                |
| ------------------- | ------------------------ | ------------------------------------------------------ |
| `<if>`              | Conditional render       | `<if condition="isLoggedIn">Welcome!</if>`             |
| `<else-if>`         | Chained condition        | `<else-if condition="isGuest">Hello Guest</else-if>`   |
| `<else>`            | Fallback                 | `<else>Please log in</else>`                           |
| `<show>`            | CSS visibility toggle    | `<show condition="isOpen">Menu</show>`                 |
| `<for>`             | Loop rendering           | `<for each="item in items"><li>{item}</li></for>`      |
| `<for>` (indexed)   | Loop with index          | `<for each="(item, i) in items">…</for>`               |
| `<for key="…">`     | List optimization        | `<for each="u in users" key="u.id">…</for>`            |
| `<lazy>`            | Defer rendering          | `<lazy idle><analytics-pixel /></lazy>`                |
| `$bind`             | Two-way binding          | `<input $bind="email" />`                              |
| `$ref`              | Element reference        | `<input $ref="inputEl" />`                             |
| `$on:` + modifiers  | Events with modifiers    | `<form $on:submit.prevent="save()">`                   |
| `$no:bind`          | Escape `{}` binding      | `<code $no:bind>{literal}</code>`                      |

---

## 📡 Event Bus

Communicate between components using `$emit` and `$listen`:

### Sender Component

```html
<button onclick="sendMessage()">Send Message</button>

<script>
  let message = "Hello from sender!";

  function sendMessage() {
    $emit("my-event", { text: message, time: new Date().toLocaleTimeString() });
  }
</script>
```

### Receiver Component

```html
<div>
  <p>Received: {receivedMessage}</p>
</div>

<script>
  let receivedMessage = "Waiting...";

  $listen("my-event", (data) => {
    receivedMessage = data.text;
  });
</script>
```

---

## 🏷️ Element References

Use `$ref` to get direct DOM access for advanced manipulation:

```html
<input type="text" $ref="inputEl" placeholder="Click button to focus" />
<button onclick="focusInput()">Focus Input</button>

<canvas $ref="canvas" width="200" height="100"></canvas>
<button onclick="draw()">Draw on Canvas</button>

<script>
  function focusInput() {
    $refs.inputEl.focus();
    $refs.inputEl.select();
  }

  function draw() {
    const ctx = $refs.canvas.getContext("2d");
    ctx.fillStyle = "blue";
    ctx.fillRect(10, 10, 100, 50);
  }
</script>
```

---

## ⏳ Lazy Loading

Load components only when needed to improve initial page load:

### Lazy Loading Strategies

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
  // Load when visible in viewport
  {
    name: "lazy-footer",
    path: "./footer.html",
    lazy: lazyOnVisible({ rootMargin: "100px" }),
  },

  // Load when browser is idle
  {
    name: "analytics-widget",
    path: "./analytics.html",
    lazy: lazyOnIdle(5000), // timeout: 5s max wait
  },

  // Load on user interaction
  {
    name: "modal-dialog",
    path: "./modal.html",
    lazy: lazyOnInteraction(["click", "focusin"]),
  },

  // Load based on media query
  {
    name: "mobile-nav",
    path: "./mobile-nav.html",
    lazy: lazyOnMedia("(max-width: 768px)"),
  },

  // Load after delay
  {
    name: "chat-widget",
    path: "./chat.html",
    lazy: lazyOnDelay(3000), // 3 second delay
  },
]);
```

| Strategy            | Use Case                                     |
| ------------------- | -------------------------------------------- |
| `lazyOnVisible`     | Below-fold content, footers, image galleries |
| `lazyOnIdle`        | Non-critical features, analytics             |
| `lazyOnInteraction` | Modals, dropdowns, tooltips                  |
| `lazyOnMedia`       | Mobile/desktop specific components           |
| `lazyOnDelay`       | Chat widgets, notifications                  |

### Eager Override

Force a lazy component to load immediately by adding the `eager` attribute:

```html
<lazy-footer eager></lazy-footer>
```

---

## 📋 API Reference

### `registerComponent`

```javascript
registerComponent(name, path, useShadowDOM?, lazy?)
```

| Parameter      | Type                    | Default  | Description                     |
| -------------- | ----------------------- | -------- | ------------------------------- |
| `name`         | string                  | required | Tag name (must include hyphen)  |
| `path`         | string                  | required | Path to `.html` component file  |
| `useShadowDOM` | boolean                 | `true`   | Enable Shadow DOM encapsulation |
| `lazy`         | boolean \| LazyStrategy | `false`  | Lazy loading configuration      |

```javascript
// Basic usage
registerComponent("my-button", "./button.html");

// Without Shadow DOM (for global CSS)
registerComponent("my-nav", "./nav.html", false);

// With lazy loading
registerComponent("my-footer", "./footer.html", true, lazyOnVisible());
```

### `registerComponents`

Register multiple components with parallel fetching:

```javascript
const result = await registerComponents([
  { name: "app-header", path: "./header.html" },
  { name: "app-footer", path: "./footer.html", lazy: lazyOnVisible() },
  { name: "user-card", path: "./user-card.html", useShadowDOM: false },
]);

// Returns: { success: [...], failed: [...], skipped: [...] }
```

### `$use`

Infer the component tag name from the file path:

```javascript
await $use("./components/user-card.html"); // Registers as <user-card>
```

### `loadLazyComponent`

Force a lazy component to load immediately from JavaScript:

```javascript
import { loadLazyComponent } from "ladrillosjs";

await loadLazyComponent("my-lazy-footer");
```

### `configure`

Configure framework-level options (optional):

```javascript
import { configure } from "ladrillosjs";

configure({
  cacheSize: 50, // Component LRU cache size (default: 25)
  onError: (err, context) => telemetry.capture(err, { context }),
  delegateLoopEvents: true, // Opt-in loop event delegation (default: false)
});
```

Development builds include actionable `LJSxxx` diagnostics with component and
file context, a suggested fix, and a link to the
[error reference](docs/21-error-handling.md). Vite and other bundlers that
honor the `development` package condition select this build automatically. To
select it explicitly, import from `ladrillosjs/dev` (or
`ladrillosjs/core/dev`). Production builds retain coded errors but remove
development-only warnings.

The `onError` callback is also suitable for telemetry. Coded framework errors
are instances of `LadrillosError` and expose `code`, `docsUrl`, `hint`,
`componentContext`, and the original `cause`.

#### `delegateLoopEvents`

By default every handler inside a `<for>` row gets its own listener. With
`delegateLoopEvents: true`, eligible handlers share **one listener per event
type** on the loop's container — thousands of rows, a handful of listeners.
Templates and handler code don't change at all, and render performance is
the same either way; enable it when listener count itself matters (very
large lists, memory-constrained devices, many handlers per row).

Fine print:

- Non-bubbling events (`focus`, `blur`, `mouseenter`, …) and handlers using
  the `.self`, `.capture`, `.once`, or `.passive` modifiers automatically
  keep per-element listeners. `.stop`, `.prevent`, and key/system modifiers
  work identically in both modes.
- `event.currentTarget` inside a delegated handler is the list container,
  not the row element (`event.target` is unaffected).
- If you manually attach your own listener on an element inside a row and
  call `stopPropagation()`, delegated handlers above it won't fire.
- Call `configure()` before your components render; already-rendered loops
  keep the mode they were created with.

### Event Bus

| Function                   | Description                         |
| -------------------------- | ----------------------------------- |
| `$emit(event, data)`       | Broadcast an event to all listeners |
| `$listen(event, callback)` | Subscribe to an event               |

---

## 🛠️ Using with Vite

LadrillosJS works seamlessly with Vite for production builds:

```bash
npm install ladrillosjs vite
```

```javascript
// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
  // LadrillosJS components work out of the box!
});
```

```javascript
// main.js
import { registerComponent } from "ladrillosjs";

registerComponent("my-counter", "./components/counter.html", false);
```

See the [samples/](samples/) directory for complete examples:

- `samples/vite-sample/` — Basic Vite setup
- `samples/vite-basic-site/` — Multi-component site
- `samples/ladrillos-demo/` — Full feature showcase

---

## 📊 Benchmarks

A [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark)–style
suite lives in [benchmarks/](benchmarks/). It renders the same keyed
1,000-row list in LadrillosJS, React 18 (keyed, memoized rows — the
idiomatic fast path), and hand-optimized vanilla JS, and measures each
operation from invocation until the live DOM reflects the change.
Medians of 10 runs, headless Chromium on an Apple M5 Pro,
`ladrillosjs@2.0.0-beta.11`:

| Operation | LadrillosJS | React 18.3 (keyed, memoized rows) | Vanilla JS (hand-optimized) |
|---|---:|---:|---:|
| create 1,000 rows | **3.7 ms** | 4.1 ms | 1.8 ms |
| replace all 1,000 rows | **4.1 ms** | 7 ms | 2 ms |
| partial update (every 10th of 1,000) | 1.1 ms | 1.2 ms | 0.2 ms |
| select row | 0.7 ms | 0.4 ms | 0 ms |
| swap 2 rows | **1.1 ms** | 3.3 ms | 0.1 ms |
| remove row | 1 ms | 1 ms | 0 ms |
| append 1,000 to 1,000 rows | **3.8 ms** | 4.3 ms | 1.3 ms |
| clear 1,000 rows | **1.3 ms** | 5.1 ms | 0.8 ms |
| create 10,000 rows | **28.9 ms** | 218.3 ms | 13 ms |
| **JS payload (min+gzip)** | **25.9 KB** | **47 KB** | ~1 KB |
| JS heap after 1,000 rows | 2.4 MB | 6.2 MB | 1.3 MB |

**How to read this honestly:**

- Every operation lands well within a single 60 fps frame (16.7 ms):
  updates on a 1,000-row list take about a millisecond, and bulk creation
  of 1,000 rows is under 5 ms.
- LadrillosJS beats React on bulk creation (and by 7× on 10,000 rows),
  full replaces, row swaps, and clearing, while shipping **half the JS**
  and using **~60% less memory** for the same UI.
- React 18 remains faster on single-row selection, and partial updates
  are a tie. We publish these numbers to track and improve them — not to
  claim LadrillosJS wins everything.
- Vanilla JS is the baseline.

Reproduce it yourself (no benchmark numbers should be trusted otherwise):

```bash
cd benchmarks && npm install && npm run bench
```

Methodology, fairness notes, and raw samples: [benchmarks/README.md](benchmarks/README.md)
and [benchmarks/results.json](benchmarks/results.json).

---

## 📚 Examples

### Todo List

A complete CRUD example combining all directives:

```html
<div class="todo-app">
  <form onsubmit="addTodo(event)">
    <input type="text" $bind="newTodo" placeholder="What needs to be done?" />
    <button type="submit">Add</button>
  </form>

  <ul>
    <for each="todo in todos" key="todo.id">
      <li>
        <input type="checkbox" onclick="toggleTodo(todo.id)" />
        <span class="{todo.completed ? 'done' : ''}">{todo.text}</span>
        <button onclick="removeTodo(todo.id)">🗑️</button>
      </li>
    </for>
  </ul>

  <if condition="todos.length === 0"><p>No todos yet!</p></if>
</div>

<script>
  let todos = [
    { id: 1, text: "Learn LadrillosJS", completed: false },
    { id: 2, text: "Build something awesome", completed: false },
  ];
  let newTodo = "";
  let nextId = 3;

  function addTodo(event) {
    event.preventDefault();
    if (newTodo.trim()) {
      todos = [...todos, { id: nextId++, text: newTodo, completed: false }];
      newTodo = "";
    }
  }

  function toggleTodo(id) {
    todos = todos.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t,
    );
  }

  function removeTodo(id) {
    todos = todos.filter((t) => t.id !== id);
  }
</script>
```

> 💡 Check the [samples/](samples/) folder for more examples including lazy loading, event bus communication, and real-world patterns.

---

## 📚 Documentation

Full guides live in the [docs/](docs/README.md) folder:

| Start here | Reference | Advanced |
| ---------- | --------- | -------- |
| [Quick Start](docs/01-quick-start.md) | [Built-in Elements & Directives](docs/06-directives.md) | [Event Bus](docs/12-event-bus.md) |
| [Installation](docs/02-installation.md) | [Event Modifiers (`$on:`)](docs/20-event-modifiers.md) | [Lazy Loading](docs/13-lazy-loading.md) |
| [Components](docs/03-components.md) | [Conditionals & Loops](docs/07-conditionals.md) | [Shadow DOM](docs/14-shadow-dom.md) |
| [Reactivity](docs/04-reactivity.md) | [Two-Way Binding](docs/09-two-way-binding.md) | [Design System Guide](docs/19-design-system.md) |

Upgrading from v1? See the [Migration Guide](docs/17-migration-v1-to-v2.md).
Using TypeScript? See the [TypeScript guide](docs/18-typescript.md).

---

## 🔒 Security & Trust Model

**Component HTML is trusted code. Treat a `.html` component the same way you'd
treat a `.js` file you `import`.**

LadrillosJS runs the `<script>` in each component, evaluates your `{expression}`
bindings, and compiles your inline event handlers as JavaScript with full access
to the page (`window`, `document`, `fetch`, `localStorage`, …). This is by design
— it's what lets components feel like plain HTML + JS with no build step, exactly
like the template in a Vue single-file component or a Svelte `.svelte` file. It
also means the framework is **not** a sandbox: you should only register and run
component files that you wrote or otherwise trust.

Practical guidance:

- ✅ **Do** author your own components and load them from your own origin.
- ❌ **Don't** fetch and register component HTML from untrusted third parties, or
  build component files by concatenating user input into a template — that's
  equivalent to running arbitrary code from that source.
- ✅ **Dynamic *data* is fine.** Rendering untrusted **data** — API responses,
  user comments, list items — through bindings and `<for>` loops is safe: values
  are set via `textContent`/`setAttribute` and passed to event handlers as
  arguments, never executed as code. (Interpolating into `innerHTML` yourself, or
  into a `<script>`/handler you assemble by hand, is not — same rule as above.)

In short: untrusted **data** through LadrillosJS's bindings is safe; untrusted
**templates/scripts** are not, because those *are* your application code.

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Development Setup

```bash
git clone https://github.com/drubiodev/LadrillosJS.git
cd LadrillosJS
npm install
npm run dev        # Watch mode for development
npm run build      # Build for production
npm test           # Unit tests (Vitest)
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built with ❤️ by <a href="https://github.com/drubiodev">Daniel Rubio</a></strong>
</p>

<p align="center">
  <a href="https://github.com/drubiodev/LadrillosJS">GitHub</a> •
  <a href="https://www.npmjs.com/package/ladrillosjs">NPM</a> •
  <a href="https://github.com/drubiodev/LadrillosJS/issues">Issues</a>
</p>
