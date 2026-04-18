# Component Lifecycle

Understanding how LadrillosJS processes and initializes components helps you write better code and debug issues.

## Lifecycle Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REGISTRATION PHASE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. registerComponent('my-component', './component.html')                    │
│     └── Resolve path to absolute URL                                        │
│     └── Check if already registered (skip if so)                            │
│                                                                             │
│  2. Fetch component HTML (or defer if lazy)                                  │
│     └── Fetch from server                                                   │
│     └── Cache the source                                                    │
│                                                                             │
│  3. Parse component source                                                   │
│     └── Extract template HTML                                               │
│     └── Extract <script> tags                                               │
│     └── Extract <style> tags                                                │
│     └── Find external scripts/styles                                        │
│     └── Identify template bindings                                          │
│                                                                             │
│  4. Create & Register Custom Element Class                                   │
│     └── Define observedAttributes from script variables                     │
│     └── customElements.define('my-component', Class)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INSTANTIATION PHASE                                   │
│               (When <my-component> is added to DOM)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  5. constructor()                                                            │
│     └── Called by browser                                                   │
│     └── Minimal work (per spec)                                             │
│                                                                             │
│  6. connectedCallback()                                                      │
│     └── Create Shadow Root (or use light DOM)                               │
│     └── Inject template HTML                                                │
│     └── Load styles                                                         │
│     └── Parse template for bindings                                         │
│                                                                             │
│  7. Process $ref directives                                                  │
│     └── Scan for $ref attributes                                            │
│     └── Populate $refs Map                                                  │
│                                                                             │
│  8. Load external resources                                                  │
│     └── Fetch external stylesheets                                          │
│     └── Load external scripts                                               │
│                                                                             │
│  9. Execute scripts                                                          │
│     └── Transform variables to reactive state                               │
│     └── Apply attribute overrides (props)                                   │
│     └── Create reactive Proxy                                               │
│     └── Execute script code                                                 │
│                                                                             │
│  10. Process directives                                                      │
│      └── Scan for $for, $if, $show, $bind                                  │
│      └── Initial render of loops & conditionals                             │
│      └── Set up two-way bindings                                            │
│                                                                             │
│  11. Apply bindings                                                          │
│      └── Evaluate all {expression} bindings                                 │
│      └── Update text nodes and attributes                                   │
│                                                                             │
│  12. Transform event handlers                                                │
│      └── Find onclick, oninput, etc.                                        │
│      └── Create scoped event listeners                                      │
│                                                                             │
│  13. Dispatch 'ladrillos:ready' event                                        │
│      └── Component is fully initialized                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REACTIVE PHASE                                        │
│                    (During component lifetime)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  State Change Detected                                                       │
│     └── Proxy setter intercepts                                             │
│     └── Schedule update (microtask)                                         │
│     └── Batch multiple changes                                              │
│                                                                             │
│  Update Cycle                                                                │
│     └── Re-evaluate affected bindings                                       │
│     └── Update DOM nodes                                                    │
│     └── Re-render loops if array changed                                    │
│     └── Re-evaluate conditionals                                            │
│     └── Update $show visibility                                             │
│     └── Sync $bind inputs                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLEANUP PHASE                                         │
│             (When component is removed from DOM)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  disconnectedCallback()                                                      │
│     └── Clean up module script blob URLs                                    │
│     └── Clean up event bus listeners                                        │
│     └── Unregister from batch scheduler                                     │
│     └── Remove global state callbacks                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Phases

### 1. Registration

When you call `registerComponent()`:

```javascript
registerComponent("my-counter", "./components/counter.html");
```

The framework:

1. Resolves the path to an absolute URL
2. Checks if component is already registered
3. Fetches the HTML file
4. Parses it into template, scripts, styles
5. Creates a custom element class
6. Registers it with the browser

### 2. Instantiation

When `<my-counter>` is added to the DOM:

```html
<my-counter count="5"></my-counter>
```

The browser calls `connectedCallback()` which:

1. Creates Shadow DOM (or uses light DOM)
2. Injects the template
3. Parses for bindings (`{expression}`)
4. Scans for `$ref` attributes
5. Loads external resources
6. Executes script code
7. Creates reactive state
8. Sets up directives
9. Applies initial bindings
10. Transforms event handlers
11. Fires `ladrillos:ready`

### 3. Reactive Updates

When state changes:

```javascript
count++; // Triggers update
```

The framework:

1. Proxy intercepts the set operation
2. Schedules an update (batched in microtask)
3. Re-evaluates affected bindings
4. Updates only changed DOM nodes

### 4. Cleanup

When component is removed:

```javascript
element.remove(); // or parent.innerHTML = ''
```

The framework:

1. Cleans up blob URLs (memory)
2. Removes event bus listeners
3. Unregisters from scheduler
4. Cleans up global references

---

## Hooking into Lifecycle

### ladrillos:ready Event

The only lifecycle hook currently exposed:

```html
<script>
  $host.addEventListener("ladrillos:ready", (event) => {
    console.log("Component ready!");
    console.log("State:", event.detail.state);
    console.log("Refs:", event.detail.refs);

    // Safe to do DOM work here
    $refs.input.focus();
  });
</script>
```

### From Outside

```javascript
const counter = document.querySelector("my-counter");

counter.addEventListener("ladrillos:ready", (e) => {
  console.log("Counter is ready:", e.detail.state.count);
});
```

---

## Attribute Handling

Attributes sync with state:

```html
<!-- Usage -->
<my-component title="Hello" count="42"></my-component>
```

```html
<!-- Component -->
<script>
  let title = "Default"; // Overridden by attribute → "Hello"
  let count = 0; // Overridden by attribute → 42
</script>
```

### Order of Precedence

1. **Attribute value** (from HTML)
2. **Script default** (if no attribute)

### Dynamic Attributes

```javascript
const el = document.querySelector("my-component");

// This updates component state!
el.setAttribute("count", "100");
```

---

## Script Execution Context

Inside component scripts, you have access to:

| Variable              | Description                 |
| --------------------- | --------------------------- |
| `$refs`               | Map of elements with `$ref` |
| `$host`               | The component element       |
| `$emit`               | Event bus emit function     |
| `$listen`             | Event bus listen function   |
| `registerComponent`  | Register child components   |
| `registerComponents` | Register multiple children  |
| `$use`                | Shorthand registration      |

```html
<script>
  // All available immediately
  $refs.input.focus();
  $host.classList.add("ready");
  $emit("component:ready");
  $listen("theme:change", updateTheme);
  registerComponent("child", "./child.html");
</script>
```

---

## Timing Considerations

### Scripts Run Synchronously

```html
<script>
  console.log("1. Script runs");

  // Refs are already available
  console.log("2. Refs:", $refs);
</script>
```

### Module Scripts are Async

```html
<script type="module">
  // This runs AFTER regular scripts
  console.log("3. Module script runs");
</script>

<script>
  console.log("1. Regular script");
</script>
```

### Ready Event is Last

```html
<script>
  $host.addEventListener("ladrillos:ready", () => {
    console.log("4. Ready event");
  });
  console.log("1. Script runs");
</script>
```

Output order:

1. "Script runs"
2. (if module scripts) "Module script runs"
3. "Ready event"

---

## Batch Updates

Multiple state changes in the same task are batched:

```html
<script>
  function updateAll() {
    name = "Alice"; // Queues update
    age = 30; // Same update batch
    city = "NYC"; // Same update batch
    // DOM updates ONCE after this function
  }
</script>
```

The scheduler uses `queueMicrotask()` for efficient batching.

---

## Component Identity

Each component instance has a unique ID:

```javascript
// Internal: my-counter-abc123xyz
const componentId = `${tagName}-${Math.random().toString(36).slice(2)}`;
```

This ID is used for:

- Event bus listener cleanup
- Module script management
- Batch scheduler registration

---

← [Shadow DOM](./14-shadow-dom.md) | [Internal Architecture](./16-architecture.md) →

[Back to Index](./README.md)
