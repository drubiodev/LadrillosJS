# LadrillosJS

<img src="https://raw.githubusercontent.com/drubiodev/LadrillosJS/refs/heads/main/LadrillosJS.jpg" alt="LadrillosJS" width="300"/>

**A lightweight, zero-dependency web component framework.**

[![npm version](https://img.shields.io/npm/v/ladrillosjs.svg)](https://www.npmjs.com/package/ladrillosjs)
[![license](https://img.shields.io/npm/l/ladrillosjs.svg)](https://github.com/drubiodev/LadrillosJS/blob/main/LICENSE)

Build modular web apps with simple HTML components. No virtual DOM, no complex tooling required.

---

## ✨ Why LadrillosJS?

- 🚀 **Zero Dependencies** — Pure JavaScript, works without build tools
- 📦 **Single-File Components** — HTML, CSS, and JS in one `.html` file
- ⚡ **Reactive State** — Variables update the DOM automatically
- 🎯 **Familiar Syntax** — Vue-inspired directives (`$if`, `$for`, `$bind`)
- 🔌 **Native Web Components** — Built on Custom Elements standard
- 🎨 **Scoped Styles** — Optional Shadow DOM for style isolation

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
  <h2>Count: {count}</h2>
  <button onclick="count++">+1</button>
  <button onclick="count--">-1</button>
</div>

<script>
  let count = 0;
</script>

<style>
  .counter {
    text-align: center;
    padding: 2rem;
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
    <script>
      ladrillosjs.registerComponent("my-counter", "./counter.html");
    </script>
  </head>
  <body>
    <my-counter></my-counter>
  </body>
</html>
```

That's it! Your component is ready. 🎉

---

## 📦 Installation

### CDN (Quickest)

```html
<!-- UMD (global) -->
<script src="https://cdn.jsdelivr.net/npm/ladrillosjs/dist/ladrillosjs.umd.js"></script>

<!-- ES Module -->
<script type="module">
  import { registerComponent } from "https://cdn.jsdelivr.net/npm/ladrillosjs/dist/ladrillosjs.es.js";
</script>
```

### NPM

```bash
npm install ladrillosjs
```

```javascript
import { registerComponent } from "ladrillosjs";

registerComponent("my-counter", "./components/counter.html");
```

---

## 📖 Core Concepts

### Template Bindings

Use `{expression}` to display reactive data:

```html
<h1>{title}</h1>
<p>Hello, {user.name}!</p>
<span>Total: {items.length} items</span>
```

### Event Handlers

Attach events directly in HTML:

```html
<button onclick="handleClick()">Click me</button>
<button onclick="count++">Increment</button>
<input onkeyup="validate(event)" />
```

### Two-Way Binding

Use `$bind` for form inputs:

```html
<input type="text" $bind="username" />
<textarea $bind="bio"></textarea>
<select $bind="country">
  <option value="us">United States</option>
  <option value="uk">United Kingdom</option>
</select>
```

---

## 🧩 Directives Cheat Sheet

| Directive           | Purpose               | Example                                          |
| ------------------- | --------------------- | ------------------------------------------------ |
| `$if`               | Conditional rendering | `<div $if="{isLoggedIn}">Welcome!</div>`         |
| `$else-if`          | Chained condition     | `<div $else-if="{isGuest}">Hello Guest</div>`    |
| `$else`             | Fallback              | `<div $else>Please log in</div>`                 |
| `$for`              | Loop rendering        | `<li $for="item in items">{item.name}</li>`      |
| `$for` (with index) | Loop with index       | `<li $for="(item, i) in items">{i}: {item}</li>` |
| `$bind`             | Two-way binding       | `<input $bind="email" />`                        |
| `$key`              | Optimize list updates | `<div $for="user in users" $key="user.id">`      |

---

## 📋 API Reference

### registerComponent

```javascript
registerComponent(name, path, useShadowDOM?, lazy?)
```

| Parameter      | Type    | Default  | Description                     |
| -------------- | ------- | -------- | ------------------------------- |
| `name`         | string  | required | Tag name (must include hyphen)  |
| `path`         | string  | required | Path to `.html` component file  |
| `useShadowDOM` | boolean | `true`   | Enable Shadow DOM encapsulation |
| `lazy`         | boolean | `false`  | Load when scrolled into view    |

**Examples:**

```javascript
// Basic
registerComponent("my-button", "./button.html");

// Without Shadow DOM (for global CSS frameworks)
registerComponent("my-nav", "./nav.html", false);

// Lazy loading (for below-fold content)
registerComponent("my-footer", "./footer.html", true, true);
```

### registerComponents

Register multiple components at once:

```javascript
await registerComponents([
  { name: "app-header", path: "./header.html" },
  { name: "app-footer", path: "./footer.html", lazy: true },
  { name: "user-card", path: "./user-card.html", useShadowDOM: false },
]);
```

---

## 🛠️ Using with Vite

LadrillosJS includes a Vite plugin for production builds:

```bash
npm install --save-dev vite
npm install ladrillosjs
```

```javascript
// vite.config.js
import { defineConfig } from "vite";
import { copyComponentsPlugin } from "ladrillosjs/vite";

export default defineConfig({
  plugins: [copyComponentsPlugin()],
});
```

See the [samples/](samples/) directory for complete Vite examples.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

**Built with ❤️ by [Daniel Rubio](https://github.com/drubiodev)**

[GitHub](https://github.com/drubiodev/LadrillosJS) • [NPM](https://www.npmjs.com/package/ladrillosjs)
