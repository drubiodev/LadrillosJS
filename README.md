# LadrillosJS

<img src="https://raw.githubusercontent.com/drubiodev/LadrillosJS/refs/heads/main/LadrillosJS.png" alt="LadrillosJS" width="400"/>

A lightweight, zero-dependency web component framework for building modular web applications.

"I designed this framework to empower developers with the ability to componentize their code efficiently and effectively, without the need for a full-scale framework. By focusing on simplicity and leveraging core web fundamentals, my goal was to create a lightweight and accessible solution that enhances development while staying true to the basics."

## Getting Starting with samples

1. `npm install`
2. `npm run dev`

## Usage

### Install & import

```bash
npm install ladrillosjs
```

This will spin up Vite with the `samples` folder as the web root.

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

   <!-- CDN -->
   <script type="module">
     ladrillosjs.registerComponent("hello-world", "hello-world.html");
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
