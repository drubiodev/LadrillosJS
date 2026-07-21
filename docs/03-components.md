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
  <if condition="active"><p>This user is active</p></if>
</div>

<script>
  // Default values - attributes override these
  let name = "Guest";
  let age = 0;
  let active = false;
</script>
```

**Important:** Attributes take precedence over script defaults. If you pass `name="Alice"`, the script's `let name = "Guest"` becomes `"Alice"`.

### Naming multi-word props

HTML lowercases every attribute name, so an attribute can never arrive as
`isDisabled`. An attribute matches a script variable when the names are
**identical** (after that lowercasing) — with one extra alias: a kebab-case
attribute is also tried as its camelCase conversion, so `is-disabled` resolves
a script's `isDisabled` (mirroring Vue's convention).

There is **no** lowercase→camelCase fallback. Each attribute spelling matches
exactly one script naming:

| Script declares               | `isdisabled` in markup | `is-disabled` in markup |
| ----------------------------- | ---------------------- | ----------------------- |
| `let isDisabled` (camelCase)  | ✗ ignored              | ✓ works                 |
| `let isdisabled` (lowercase)  | ✓ works                | ✗ ignored               |

Pick one convention per component and document it for your consumers:

```html
<!-- camelCase script prop → kebab-case attribute -->
<my-button is-disabled></my-button>
<script>
  let isDisabled = false;
</script>

<!-- lowercase script prop → lowercase attribute -->
<my-button isdisabled></my-button>
<script>
  let isdisabled = false;
</script>
```

A mismatched spelling isn't an error — the attribute is simply never applied
and the script default silently stays in effect. If a boolean prop "doesn't
work" (e.g. a button that won't disable), check this table first.

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

Modifiers extend a `$on:` directive with extra behavior (prevent default, key filters, mouse buttons, etc.).

**Syntax:**

```
$on:<event>[.<modifier>][.<modifier>]...="<handler>"
```

- `<event>` — any DOM event name (`click`, `submit`, `keyup`, `keydown`, `input`, ...)
- `<modifier>` — zero or more dot-separated modifiers, applied in order
- `<handler>` — an expression or function call, same as `onclick="..."`

**Example:**

```html
<form $on:submit.prevent="handleSubmit()">
  <input $on:keyup.enter="submit()" />
  <input $on:keydown.escape="cancel()" />
  <button type="submit">Submit</button>
</form>
```

**Event behavior modifiers:**

- `.prevent` — calls `event.preventDefault()`
- `.stop` — calls `event.stopPropagation()`
- `.self` — only trigger if `event.target === event.currentTarget`
- `.once` — remove the listener after the first invocation
- `.passive` — register as a passive listener
- `.capture` — listen in the capture phase

**System (modifier key) modifiers:**

- `.ctrl`, `.alt`, `.shift`, `.meta`
- `.exact` — only fire when *exactly* the specified system modifiers are pressed

**Mouse button modifiers (for `click` / mouse events):**

- `.left`, `.middle`, `.right`

**Key modifiers (for `keyup` / `keydown`):**

- Navigation: `.enter`, `.tab`, `.esc` (or `.escape`), `.space`
- Arrows: `.up`, `.down`, `.arrowleft`, `.arrowright`
  (`.left`/`.right` always mean mouse buttons)
- Editing: `.delete`, `.backspace`, `.insert`
- Position: `.home`, `.end`, `.pageup`, `.pagedown`
- Function keys: `.f1` – `.f12`
- Any other `KeyboardEvent.key` value (lowercased), e.g. `.a`, `.z`, `.slash`

Modifiers can be combined, e.g. `$on:click.prevent.stop="handleLink()"` or `$on:keydown.ctrl.s.prevent="save()"`.

> 📖 See [Event Modifiers](./20-event-modifiers.md) for the complete
> reference, combination gallery, and gotchas.

**Example — save on `Ctrl+S`:**

```html
<textarea $on:keydown.ctrl.s.prevent="save()"></textarea>

<script>
  function save() {
    console.log("Saved!");
  }
</script>
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

Use the `external` attribute on a `<script src="...">` tag to load a third-party library **as-is**, without LadrillosJS parsing or wrapping it.

Mark a script as `external` when:

- It's a library or utility that doesn't touch component state or reactive variables (e.g. `lodash`, `dayjs`, `highlight.js`, analytics snippets, polyfills).
- It attaches itself to `window` / a global and you just want to call into it.
- It should be loaded once and shared across all components — the framework dedupes external scripts by URL so the same library isn't fetched twice.

Do **not** use `external` for code that needs to read or mutate the component's reactive state, refs, or `$emit`/`$listen`. That code belongs in a regular `<script>` or `<script type="module">` block inside the component.

```html
<!-- Third-party lib loaded once, globally available -->
<script src="https://unpkg.com/some-library.js" external></script>

<script>
  // someLibrary is now on window and can be used here.
  // It has no awareness of this component's reactive state.
  someLibrary.doSomething();
</script>
```

> **Tip:** If you need the library *inside* your reactive logic, prefer `<script type="module">` with an `import` from an ESM CDN (e.g. `https://esm.sh/...`) instead of `external`.

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
