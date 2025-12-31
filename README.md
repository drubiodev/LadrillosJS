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
- [Directives](#-directives)
- [Event Bus](#-event-bus)
- [Element References](#-element-references)
- [Lazy Loading](#-lazy-loading)
- [API Reference](#-api-reference)
- [Using with Vite](#-using-with-vite)
- [Browser Support](#-browser-support)
- [Examples](#-examples)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Quick Start

### 1. Add the Script

```html
<script src="https://cdn.jsdelivr.net/npm/ladrillosjs/dist/ladrillosjs.umd.js"></script>
```

### 2. Create a Component

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

### 3. Use It

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="https://cdn.jsdelivr.net/npm/ladrillosjs/dist/ladrillosjs.umd.js"></script>
    <script type="module">
      ladrillosjs.registerComponent("my-counter", "./counter.html");
    </script>
  </head>
  <body>
    <my-counter></my-counter>
  </body>
</html>
```

That's it! Your reactive component is ready. 🎉

---

## 📦 Installation

### CDN (No Build Step)

```html
<!-- Global (UMD) -->
<script src="https://cdn.jsdelivr.net/npm/ladrillosjs/dist/ladrillosjs.umd.js"></script>
<script type="module">
  ladrillosjs.registerComponent("my-component", "./component.html");
</script>

<!-- ES Module -->
<script type="module">
  import { registerComponent } from "https://cdn.jsdelivr.net/npm/ladrillosjs/dist/ladrillosjs.es.js";
  registerComponent("my-component", "./component.html");
</script>
```

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

## 🧩 Directives

### Conditional Rendering

Use `$if`, `$else-if`, and `$else` to conditionally render elements:

```html
<div $if="{status === 'loading'}">Loading...</div>
<div $else-if="{status === 'error'}">Something went wrong!</div>
<div $else>Content loaded successfully!</div>

<script>
  let status = "loading";
</script>
```

### Show/Hide (CSS Toggle)

Use `$show` to toggle visibility without removing from DOM (uses `display: none`):

```html
<div $show="{isVisible}">I can be shown or hidden</div>

<button onclick="isVisible = !isVisible">Toggle</button>

<script>
  let isVisible = true;
</script>
```

> **`$show` vs `$if`:** `$show` toggles CSS display (element stays in DOM), `$if` adds/removes from DOM entirely.

### List Rendering

Use `$for` to render lists with optional index and key:

```html
<!-- Simple list -->
<ul>
  <li $for="fruit in fruits">🍎 {fruit}</li>
</ul>

<!-- With index -->
<div $for="(item, index) in items">#{index + 1}: {item}</div>

<!-- Object array with key -->
<div $for="user in users" $key="user.id">
  <span>{user.avatar}</span>
  <span>{user.name}</span>
  <span>{user.role}</span>
</div>

<script>
  let fruits = ["Apple", "Banana", "Cherry"];
  let items = ["First", "Second", "Third"];
  let users = [
    { id: 1, name: "Alice", role: "Developer", avatar: "👩‍💻" },
    { id: 2, name: "Bob", role: "Designer", avatar: "👨‍🎨" },
  ];
</script>
```

### Directives Cheat Sheet

| Directive        | Purpose               | Example                                          |
| ---------------- | --------------------- | ------------------------------------------------ |
| `$if`            | Conditional render    | `<div $if="{isLoggedIn}">Welcome!</div>`         |
| `$else-if`       | Chained condition     | `<div $else-if="{isGuest}">Hello Guest</div>`    |
| `$else`          | Fallback              | `<div $else>Please log in</div>`                 |
| `$show`          | CSS visibility toggle | `<div $show="{isOpen}">Menu</div>`               |
| `$for`           | Loop rendering        | `<li $for="item in items">{item}</li>`           |
| `$for` (indexed) | Loop with index       | `<li $for="(item, i) in items">{i}: {item}</li>` |
| `$bind`          | Two-way binding       | `<input $bind="email" />`                        |
| `$key`           | List optimization     | `<div $for="user in users" $key="user.id">`      |
| `$ref`           | Element reference     | `<input $ref="inputEl" />`                       |

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

### registerComponent

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

### registerComponents

Register multiple components with parallel fetching:

```javascript
const result = await registerComponents([
  { name: "app-header", path: "./header.html" },
  { name: "app-footer", path: "./footer.html", lazy: lazyOnVisible() },
  { name: "user-card", path: "./user-card.html", useShadowDOM: false },
]);

// Returns: { success: [...], failed: [...], skipped: [...] }
```

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
    <li $for="todo in todos" $key="todo.id">
      <input type="checkbox" onclick="toggleTodo({todo.id})" />
      <span class="{todo.completed ? 'done' : ''}">{todo.text}</span>
      <button onclick="removeTodo({todo.id})">🗑️</button>
    </li>
  </ul>

  <p $if="{todos.length === 0}">No todos yet!</p>
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
      t.id === id ? { ...t, completed: !t.completed } : t
    );
  }

  function removeTodo(id) {
    todos = todos.filter((t) => t.id !== id);
  }
</script>
```

> 💡 Check the [samples/](samples/) folder for more examples including lazy loading, event bus communication, and real-world patterns.

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
