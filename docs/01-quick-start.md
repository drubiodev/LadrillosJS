# Quick Start Guide

Get a LadrillosJS component working in under 5 minutes — **no build tools, no npm install, no configuration**. Just drop in a CDN link and you're ready to go.

## Why It's So Simple

LadrillosJS is delivered as a single file from a CDN, which means:

- **Zero installation** — just add a `<script>` tag
- **No build step** — write HTML, CSS, and JS directly
- **No dependencies** — nothing to configure
- **Works anywhere** — any browser, any static host

## Step 1: Create Your HTML Page

Create an `index.html` file. The only thing you need is a single import from the CDN:

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My LadrillosJS App</title>

    <!-- That's it! Import from the CDN and register your components -->
    <script type="module">
        import { registerComponent } from "https://cdn.jsdelivr.net/npm/ladrillosjs/dist/index.min.js";
        registerComponent("my-counter", "./components/counter.html");
    </script>
</head>

<body>
    <h1>My First LadrillosJS App</h1>

    <!-- Use your component like any HTML element! -->
    <my-counter></my-counter>
</body>

</html>
```

## Step 2: Create Your Component

Create a folder called `components` and add `counter.html`:

```html
<!-- components/counter.html -->
<div class="counter">
  <h2>Counter: {count}</h2>
  <div class="buttons">
    <button onclick="count--">➖ Decrease</button>
    <button onclick="count = 0">🔄 Reset</button>
    <button onclick="count++">➕ Increase</button>
  </div>
  <p>Double: {count * 2} | Squared: {count * count}</p>
</div>

<script>
  // This variable is reactive - changes update the DOM automatically!
  let count = 0;
</script>

<style>
  .counter {
    font-family: system-ui, sans-serif;
    padding: 20px;
    background: #f0f0f0;
    border-radius: 8px;
    text-align: center;
    max-width: 300px;
  }

  .buttons {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin: 15px 0;
  }

  button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background: #007bff;
    color: white;
    cursor: pointer;
    font-size: 14px;
  }

  button:hover {
    background: #0056b3;
  }
</style>
```

## Step 3: Serve Your Files

LadrillosJS needs to fetch component files, so you need a local server. Use any of these:

```bash
# Option 1: Python (built-in)
python -m http.server 8080

# Option 2: Node.js with npx
npx serve

# Option 3: VS Code Live Server extension
# Just right-click index.html → "Open with Live Server"
```

## Step 4: Open in Browser

Navigate to `http://localhost:8080` and see your reactive counter!

---

## What Just Happened?

1. **LadrillosJS loaded** from the CDN
2. **`registerComponent()`** fetched your `counter.html` file
3. The framework **parsed** the HTML, extracting:
   - Template (the HTML structure)
   - Script (your reactive state)
   - Styles (scoped CSS)
4. A **Custom Element** was created and registered as `<my-counter>`
5. When you added `<my-counter>` to the page, the component **rendered**
6. The `{count}` binding automatically **updates** when you click buttons

---

## Adding More Components

Register multiple components at once:

```javascript
// Object syntax - tag name as key, path as value
ladrillosjs.registerComponents({
  "my-header": "./components/header.html",
  "my-footer": "./components/footer.html",
  "user-card": "./components/user-card.html",
});
```

Or use the array syntax for more options:

```javascript
ladrillosjs.registerComponents([
  { name: "my-header", path: "./components/header.html" },
  { name: "my-modal", path: "./components/modal.html", useShadowDOM: false },
  { name: "my-footer", path: "./components/footer.html", lazy: true },
]);
```

---

## Passing Data to Components

Use attributes to pass data:

```html
<user-card name="Alice" role="Developer"></user-card>
```

In your component, just use the attribute names as variables:

```html
<!-- components/user-card.html -->
<div class="card">
  <h3>{name}</h3>
  <p>{role}</p>
</div>

<script>
  // Default values - attributes override these
  let name = "Guest";
  let role = "User";
</script>
```

---

## Next Steps

- [Installation Options](./02-installation.md) - CDN vs NPM
- [Component Structure](./03-components.md) - Deep dive into components
- [Reactivity](./04-reactivity.md) - How state updates work

← [Back to Index](./README.md)
