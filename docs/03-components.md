# Components

Components are the building blocks of LadrillosJS applications. Each component is a self-contained `.html` file with template, script, and styles.

## Component Structure

A component file has three sections:

```html
<!-- Template: The HTML structure -->
<div class="my-component">
  <h1>{title}</h1>
  <p>{description}</p>
  <button onclick="handleClick()">Click me</button>
</div>

<!-- Script: Reactive state and logic -->
<script>
  let title = "Hello World";
  let description = "This is my component";

  function handleClick() {
    title = "Clicked!";
  }
</script>

<!-- Styles: Scoped CSS -->
<style>
  .my-component {
    padding: 20px;
    background: #f5f5f5;
  }

  h1 {
    color: #333;
  }
  button {
    cursor: pointer;
  }
</style>
```

---

## Registering Components

### Single Component

```javascript
import { registerComponent } from "ladrillosjs";

// Basic registration
registerComponent("my-component", "./components/my-component.html");

// With options
registerComponent("my-modal", "./components/modal.html", false); // No Shadow DOM
registerComponent("my-footer", "./components/footer.html", true, true); // Lazy load
```

**Parameters:**

- `name` - The custom element tag name (must contain a hyphen)
- `path` - Path to the component HTML file
- `useShadowDOM` - Whether to use Shadow DOM (default: `true`)
- `lazy` - Whether to lazy load (default: `false`)

### Multiple Components

```javascript
import { registerComponents } from "ladrillosjs";

// Object syntax (simple)
await registerComponents({
  "app-header": "./components/header.html",
  "app-footer": "./components/footer.html",
  "user-card": "./components/user-card.html",
});

// Array syntax (full control)
await registerComponents([
  { name: "app-header", path: "./components/header.html" },
  { name: "app-modal", path: "./components/modal.html", useShadowDOM: false },
  { name: "app-sidebar", path: "./components/sidebar.html", lazy: true },
]);
```

**Batch registration benefits:**

- Parallel network requests (faster loading)
- Shared fetch cache
- Detailed error reporting

---

## Using Components

Once registered, use components like regular HTML elements:

```html
<!-- Basic usage -->
<my-counter></my-counter>

<!-- With attributes (props) -->
<user-card name="Alice" role="Developer"></user-card>

<!-- Nested components -->
<app-header>
  <nav-item label="Home" href="/"></nav-item>
  <nav-item label="About" href="/about"></nav-item>
</app-header>
```

---

## Passing Props via Attributes

Attributes on your component become available as variables in the script:

```html
<!-- Usage -->
<greeting-card name="Alice" age="25" active="true"></greeting-card>
```

```html
<!-- greeting-card.html -->
<div class="card">
  <h2>Hello, {name}!</h2>
  <p>Age: {age}</p>
  <p $if="{active}">This user is active</p>
</div>

<script>
  // Default values - attributes override these
  let name = "Guest";
  let age = 0;
  let active = false;
</script>
```

**Important:** Attributes take precedence over script defaults. If you pass `name="Alice"`, the script's `let name = "Guest"` becomes `"Alice"`.

---

## Template Bindings

Use `{expression}` to bind data to the template:

```html
<div>
  <!-- Simple variable -->
  <span>{username}</span>

  <!-- Object property -->
  <span>{user.name}</span>

  <!-- Expression -->
  <span>{count * 2}</span>

  <!-- Ternary -->
  <span>{isLoggedIn ? 'Welcome!' : 'Please login'}</span>

  <!-- Function call -->
  <span>{formatDate(createdAt)}</span>
</div>

<script>
  let username = "Alice";
  let user = { name: "Bob", email: "bob@example.com" };
  let count = 5;
  let isLoggedIn = true;
  let createdAt = new Date();

  function formatDate(date) {
    return date.toLocaleDateString();
  }
</script>
```

---

## Event Handlers

Use standard `onclick`, `oninput`, etc. They work with your reactive state:

```html
<div>
  <button onclick="count++">Increment</button>
  <button onclick="count--">Decrement</button>
  <button onclick="reset()">Reset</button>
  <button onclick="handleClick(event)">With Event</button>
</div>

<script>
  let count = 0;

  function reset() {
    count = 0;
  }

  function handleClick(e) {
    console.log("Clicked at", e.clientX, e.clientY);
  }
</script>
```

### Event Modifiers

Use `$on:event.modifier` for common patterns:

```html
<!-- Prevent default -->
<form $on:submit.prevent="handleSubmit()">
  <!-- Stop propagation -->
  <button $on:click.stop="handleClick()">
    <!-- Key modifiers -->
    <input $on:keyup.enter="submit()" />
    <input $on:keydown.escape="cancel()" />

    <!-- Combine modifiers -->
    <a href="#" $on:click.prevent.stop="handleLink()"></a>
  </button>
</form>
```

---

## Child Components

Register child components from within a parent:

```html
<!-- header.html -->
<header>
  <nav-logo></nav-logo>
  <nav-menu></nav-menu>
</header>

<script>
  // Register child components with paths relative to THIS component
  registerComponent("nav-logo", "./logo.html");
  registerComponent("nav-menu", "./menu.html");

  // Or use $use for automatic naming
  // $use('./logo.html')  → registers as 'logo'
  // $use('./NavMenu.html') → registers as 'nav-menu'
</script>
```

---

## Component Scopes

### Shadow DOM (Default)

- Styles are fully encapsulated
- Component CSS doesn't leak out
- Page CSS doesn't leak in
- Uses `attachShadow({ mode: 'open' })`

```javascript
registerComponent("my-button", "./button.html"); // Shadow DOM by default
registerComponent("my-button", "./button.html", true); // Explicit
```

### Light DOM

- Styles are NOT encapsulated
- Useful when you need global styles
- Useful for SEO-critical content

```javascript
registerComponent("my-content", "./content.html", false); // No Shadow DOM
```

---

## Module Scripts

Use `<script type="module">` for imports:

```html
<div>
  <pre><code $ref="codeBlock">{code}</code></pre>
</div>

<script type="module">
  import hljs from "https://esm.sh/highlight.js";

  let code = "const x = 1;";

  // Runs after component mounts
  hljs.highlightElement($refs.codeBlock);
</script>
```

---

## External Dependencies

### External Scripts

```html
<script src="https://unpkg.com/some-library.js" external></script>

<script>
  // some-library is now available
  someLibrary.doSomething();
</script>
```

### External Styles

```html
<link rel="stylesheet" href="https://unpkg.com/some-styles.css" />

<div class="uses-external-styles">...</div>
```

---

## Lifecycle

Components fire a `ladrillos:ready` event when fully initialized:

```html
<script>
  // Using $host (the component element itself)
  $host.addEventListener("ladrillos:ready", (e) => {
    console.log("Component ready!", e.detail.state, e.detail.refs);
  });
</script>
```

Or from outside:

```javascript
document
  .querySelector("my-component")
  .addEventListener("ladrillos:ready", (e) => {
    console.log("Component ready!", e.detail);
  });
```

---

← [Installation](./02-installation.md) | [Reactivity](./04-reactivity.md) →

[Back to Index](./README.md)
