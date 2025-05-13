# LadrillosJS

<img src="https://raw.githubusercontent.com/drubiodev/LadrillosJS/refs/heads/main/LadrillosJS.png" alt="LadrillosJS" width="400"/>

A lightweight, zero-dependency web component framework for building modular web applications.

"I designed this framework to empower developers with the ability to componentize their code efficiently and effectively, without the need for a full-scale framework. By focusing on simplicity and leveraging core web fundamentals, my goal was to create a lightweight and accessible solution that enhances development while staying true to the basics."

## Getting Starting with samples

The repository includes several example applications that demonstrate various features:

- **Notes App**: Example of using stores for state management
- **Markdown Editor**: Simple markdown-to-HTML converter
- **API Example**: Fetching and displaying data from an external API
- **Button Game**: Interactive game demonstrating component events
- **Simple Button**: Basic component with state and event handling

To run the examples:

1. Clone the repository
2. Run `npm install`
3. Run `npm run dev`

## Usage

### Install & import

```bash
npm install ladrillosjs
```

### cdn

```js
<script defer src="https://cdn.jsdelivr.net/npm/ladrillosjs"></script>
```

## First Component

A component in LadrillosJS is a reusable custom HTML element that bundles its own template, logic (bindings) and styles into a single file.

To create your first component, follow these steps:

1. Create an HTML file that defines your component’s template, script bindings and CSS. For example:

   ```html
   <!-- hello.html -->

   <p>Hello, LadrillosJS!</p>
   <button onclick="increment">Clicked {count} times</button>

   <script>
     // declare a bound variable
     let count = 0;

     // declare a handler for the button click
     const increment = () => {
       count++;
       // update component state and re-render
       this.setState({ count });
     };
   </script>

   <style>
     /* component‐scoped CSS */
     p {
       font-size: 1.25rem;
       color: #1a73e8;
     }
     button {
       margin-top: 0.5rem;
       padding: 0.5rem 1rem;
     }
   </style>
   ```

2. Import and register your component in the page where you want to use it:

   ```html
   <!-- import -->
   <script type="module">
     import { registerComponent } from "ladrillosjs";

     registerComponent("hello-world", "hello-world.html");
   </script>

   <!-- import multiple components -->
   <script type="module">
     import { registerComponents } from "ladrillosjs";

     await registerComponents(
       [
         { name: "my-widget", path: "/components/widget.html" },
         { name: "my-card", path: "/components/card.html" },
         // …
       ],
       10 // sets 10 parallel fetches - defaults to 5
     );
   </script>

   <!-- CDN -->
   <script type="module">
     ladrillosjs.registerComponent("hello-world", "hello-world.html");
   </script>

   <!-- CDN multiple components -->
   <script type="module">
     await ladrillosjs.registerComponents(
       [
         { name: "my-widget", path: "/components/widget.html" },
         { name: "my-card", path: "/components/card.html" },
         // …
       ],
       10 // sets 10 parallel fetches - defaults to 5
     );
   </script>
   ```

   ```html
   <!-- then use it in markup -->
   <hello-world></hello-world>
   ```

Under the hood, LadrillosJS will fetch, parse and cache hello.html, then define a `<hello-world>`.

- Template placeholders `{…}` automatically bind to this.state.
- Top‐level `let/const/function` in your `<script>` block are hoisted and initialized into `this.state` if they appear in a template or event.
- Event attributes like `onclick="increment"` register listeners under the hood.

## How LadrillosJS Simplifies Web Component Creation

LadrillosJS aims to reduce the boilerplate and complexity often associated with standard Web Components. Here's a comparison using a simple counter button example:

### Standard Web Component Approach

Creating a button that increments a counter on click using standard Web Component APIs involves defining a class, managing the shadow DOM, and manually updating the DOM.

```javascript
class ButtonCount extends HTMLElement {
  constructor() {
    super();
    this.count = 0;
    this.attachShadow({ mode: "open" });

    this.button = document.createElement("button");
    this.button.textContent = `Clicked: ${this.count}`;
    this.button.addEventListener("click", this.increment.bind(this));

    this.shadowRoot.appendChild(this.button);
  }

  increment() {
    this.count++;
    this.button.textContent = `Clicked: ${this.count}`;
  }
}

customElements.define("button-count", ButtonCount);
```

### LadrillosJS Approach

With LadrillosJS, the same component can be defined much more concisely and declaratively within a single file (e.g., `my-counter-button.html`). LadrillosJS handles the underlying custom element registration, shadow DOM, and reactive updates.

```html
<!-- my-counter-button.html -->
<button onclick="increment">Clicked: {count}</button>

<script>
  // Initialize state
  this.setState({ count: 0 });

  // Event handler
  const increment = () => {
    this.state.count++;
  };
</script>
```

Key simplifications with LadrillosJS include:

- **Declarative Syntax**: HTML-centric templating with simple data binding (`{count}`).
- **Reduced Boilerplate**: No need for manual class definition, `constructor`, `super()`, `attachShadow`, or `customElements.define` (LadrillosJS handles this).
- **Reactive State**: State is easily declared (e.g., `let count = 0;`) and updated via `this.setState()`.
- **Simplified Events**: Event handling is direct (`onclick="increment"`).
- **Scoped Logic**: The script within the component file is naturally scoped to the component instance.

This approach allows developers to focus more on the component's structure and logic rather than the underlying Web Component machinery.

## Binding Variables & Events

- To bind data into your markup, wrap state keys in `{}`

```html
<span>{user.name}</span>
```

- To bind an event, prefix an attribute with `on`:

```html
<button onclick="doSomething">Do it</button>
```

## Initializing from Attributes

Component attributes sync to `this.state` automatically and can be reference by using `this.state["some-prop"]` in your template or code.

## Internal vs. External Scripts

- Inline scripts (no src) are parsed, top‑level bindings registered, then executed in component context.
- External scripts with `bind` attribute are fetched, and processed exactly like inline scripts.

- For external module scripts with `bind` attribute, you must export a default function where methods are defined on the component instance:

```js
// component-logic.js
export default function () {
  this.handleClick = () => {
    console.log("Button clicked");
    this.setState({ clicked: true });
  };
}
```

```html
<!-- In your component HTML -->
<button onclick="handleClick">Click me</button>

<script src="component-logic.js" type="module" bind></script>
```

```js
<script src="path_to_file.js" bind></script>
```

- External scripts without bind are injected via a `<script>` tag (for non‑module, or third‑party scripts).
- `type="module"` scripts (inline or external) are added to the shadow/root as real modules.

## Managing State

To manage state in LadrillosJS, you can use the `this.setState()` method to update the component's state. The `this.state` object holds the component's state variables, and you can modify them as needed.

When you call `this.setState({ key: value, … })`, LadrillosJS will automatically re-render the component with the updated state.

## Emitting

To emit events from your component, you can use the `this.emit()` method. This allows you to trigger custom events that can be listened to by parent components or other parts of your application. If you don't pass a second argument, the event will be emitted with the component's state as the data.

```js
this.emit("event-name", { some: "data" });
```

To listen to emitted events, you can use the `this.listen()` method on the component instance:

```js
this.listen("event-name", (payload) => {
  console.log(payload); // Access the emitted data
});
```

## Two‑Way Binding

LadrillosJS provides built‑in two‑way data binding for form controls and contenteditable elements via the `data-bind` attribute.  
When a component is initialized, any element with `data-bind="key"` will:

- Push its initial value/content into `this.state.key`.
- Listen for user input (e.g. `input` or `change` events) and update `this.state.key` automatically.
- Re-render whenever you call `this.setState({ key: newValue })`, updating the element’s value or innerText.

Usage example:

```html
<!-- In your component HTML -->
<input type="text" placeholder="Username" data-bind="username" />
<div contenteditable="true" placeholder="About you…" data-bind="bio"></div>
<button onclick="submit">Submit</button>

<script>
  const submit = () => {
    console.log("Username:", this.state.username);
    console.log("Bio:", this.state.bio);
    // reset state
    this.setState({ username: "", bio: "" });
  };
</script>
```

## State Management with Stores

LadrillosJS provides a simple store implementation for managing shared state across components:

- `createStore(initialState)`: Creates a new store with the specified initial state
- `getState()`: Returns the current state of the store
- `setState(partial)`: Updates store state by merging partial object and notifies subscribers
- `subscribe(fn)`: Registers a callback function that executes immediately and on every state change

```js
import { createStore } from "ladrillosjs";

// Create a store with initial state
export const notesStore = createStore({ notes: [] });

// Update store state
export function addNote(note) {
  const { notes } = notesStore.getState();
  notesStore.setState({ notes: [...notes, note] });
}
```

### add to store

```js
import { addNote } from "../stores/notesStore.js";

export default function () {
  this.save = () => {
    const id = Math.floor(Math.random() * 1000);
    addNote({ id: 123, title: "my note", note: "my note content" });
  };
}
```

### subscribing to store changes

```js
import { notesStore } from "../stores/notesStore.js";
notesStore.subscribe(({ notes }) => {
  console.log("Notes updated:", notes);
});
```

## Conditional Rendering

LadrillosJS supports declarative conditional rendering in your component’s template using `data-if`, `data-else-if`, and `data-else` attributes. Only the first matching block in each group will be shown; `data-else` serves as a fallback.

Usage example:

```html
<p>Clicked {count} times</p>

<div data-if="count < 5">Keep going!</div>
<div data-else-if="count < 10">Almost there!</div>
<div data-else>Done clicking!</div>

<button onclick="increment">Click me</button>

<script>
  // initialize state
  const count = 0;

  // event handler
  const increment = () => {
    this.setState({ count: this.state.count + 1 });
  };
</script>
```

## Using Slots

LadrillosJS fully supports the native Web Components `<slot>` API for default and named slots, allowing you to project markup into your component.

### Default Slot

Define a `<slot>` in your component HTML:

```html
<!-- card.html -->
<div class="card">
  <header>{title}</header>
  <div class="body">
    <slot></slot>
  </div>
</div>
```

Use it by placing content between your custom-tag:

```html
<card-component title="Welcome">
  <p>This paragraph is rendered inside the card body.</p>
</card-component>
```

### Named Slots

You can target multiple insertion points by naming slots:

```html
<!-- panel.html -->
<div class="panel">
  <section class="header">
    <slot name="header"></slot>
  </section>
  <section class="content">
    <slot></slot>
    <!-- default slot -->
  </section>
  <section class="footer">
    <slot name="footer"></slot>
  </section>
</div>
```

And supply content for each slot:

```html
<panel-component>
  <h2 slot="header">Panel Title</h2>
  <!-- goes into default slot -->
  <p>This is the main content of the panel.</p>
  <button slot="footer">Close</button>
</panel-component>
```
