# LadrillosJS Documentation

Welcome to the LadrillosJS documentation! This guide will help you understand how the framework works, from creating your first component to understanding the internal architecture.

## 📚 Documentation Index

### Getting Started

- [**Quick Start Guide**](./01-quick-start.md) - Get up and running in minutes
- [**Installation**](./02-installation.md) - CDN vs NPM installation options

### Core Concepts

- [**Components**](./03-components.md) - How to create and structure components
- [**Reactivity**](./04-reactivity.md) - How the reactive system works
- [**Template Bindings**](./05-template-bindings.md) - Data binding with `{expressions}`

### Directives

- [**Directives Overview**](./06-directives.md) - All built-in directives
- [**Conditional Rendering**](./07-conditionals.md) - `$if`, `$else-if`, `$else`
- [**List Rendering**](./08-loops.md) - `$for` loops
- [**Two-Way Binding**](./09-two-way-binding.md) - `$bind` for forms
- [**Element References**](./10-refs.md) - `$ref` for DOM access
- [**Visibility Toggle**](./11-show.md) - `$show` for CSS visibility

### Advanced Features

- [**Event Bus**](./12-event-bus.md) - Cross-component communication with `$emit` and `$listen`
- [**Lazy Loading**](./13-lazy-loading.md) - Load components on demand
- [**Shadow DOM**](./14-shadow-dom.md) - Encapsulation and styling

### Architecture

- [**Component Lifecycle**](./15-lifecycle.md) - How components are processed
- [**Internal Architecture**](./16-architecture.md) - Deep dive into the codebase

---

## What is LadrillosJS?

LadrillosJS is a lightweight, zero-dependency web component framework that lets you build modular web apps with simple HTML components. Unlike heavier frameworks, LadrillosJS:

- ✅ **No Virtual DOM** - Direct DOM manipulation for predictable performance
- ✅ **No Build Step Required** - Works directly in the browser via CDN
- ✅ **Single-File Components** - HTML, CSS, and JavaScript in one `.html` file
- ✅ **Native Web Components** - Uses the standard Custom Elements API
- ✅ **Automatic Reactivity** - State changes automatically update the DOM

## Quick Example

Here's a complete counter component:

```html
<!-- counter.html -->
<div class="counter">
  <div class="count">{count}</div>
  <button onclick="count--">-</button>
  <button onclick="count++">+</button>
</div>

<script>
  let count = 0;
</script>

<style>
  .counter {
    text-align: center;
    padding: 20px;
  }
  .count {
    font-size: 48px;
    font-weight: bold;
  }
  button {
    padding: 10px 20px;
    margin: 5px;
  }
</style>
```

Use it in your HTML:

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

That's it! The counter is fully reactive - clicking the buttons updates the display automatically.

---

## How It Works (High-Level)

```
┌──────────────────────────────────────────────────────────────────┐
│                        Your Component File                        │
│                         (counter.html)                            │
├──────────────────────────────────────────────────────────────────┤
│  <div>{count}</div>          ← Template with bindings            │
│  <button onclick="count++">  ← Event handlers                    │
│  <script>let count = 0;</script>  ← Reactive state              │
│  <style>.counter {...}</style>    ← Scoped styles               │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     LadrillosJS Framework                         │
├──────────────────────────────────────────────────────────────────┤
│  1. Fetch component HTML                                          │
│  2. Parse template, scripts, styles                               │
│  3. Create reactive state (Proxy)                                 │
│  4. Scan for directives ($for, $if, $bind, etc.)                 │
│  5. Register as Custom Element                                    │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Web Component                                │
│                    <my-counter></my-counter>                      │
├──────────────────────────────────────────────────────────────────┤
│  Shadow DOM (or Light DOM)                                        │
│  ├── Rendered HTML with live bindings                            │
│  ├── Scoped CSS                                                  │
│  └── Reactive state that auto-updates DOM                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. Start with the [Quick Start Guide](./01-quick-start.md)
2. Learn about [Components](./03-components.md)
3. Understand the [Reactivity System](./04-reactivity.md)
4. Explore [Directives](./06-directives.md)

Happy building! 🧱
