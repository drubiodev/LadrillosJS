# LadrillosJS

<img src="https://raw.githubusercontent.com/drubiodev/LadrillosJS/refs/heads/main/LadrillosJS.png" alt="LadrillosJS" width="400"/>

A lightweight, zero-dependency web component framework for building modular web applications.

"I designed this framework to empower developers with the ability to componentize their code efficiently and effectively, without the need for a full-scale framework. By focusing on simplicity and leveraging core web fundamentals, my goal was to create a lightweight and accessible solution that enhances development while staying true to the basics."

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Installation](#installation)
- [Your First Component](#your-first-component)
- [Core Concepts](#core-concepts)
  - [Component Registration](#component-registration)
  - [State Management](#state-management)
  - [Event Handling](#event-handling)
  - [Data Binding](#data-binding)
  - [Conditional Rendering](#conditional-rendering)
  - [Slots](#slots)
- [Advanced Features](#advanced-features)
  - [External Scripts](#external-scripts)
  - [Global State Stores](#global-state-stores)
  - [Shadow DOM](#shadow-dom)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)

## Features

- 🚀 **Zero Dependencies** - Pure JavaScript, no build tools required
- 📦 **Single-File Components** - HTML, CSS, and JavaScript in one file
- ⚡ **Reactive State** - Automatic re-rendering on state changes
- 🎯 **Event System** - Built-in event emission and listening
- 🔄 **Two-Way Data Binding** - For form inputs and contenteditable elements
- 🎨 **Scoped Styles** - Component styles with optional Shadow DOM
- 🏪 **State Management** - Simple store implementation for shared state
- 🔌 **Slots Support** - Content projection with named and default slots
- 📝 **TypeScript Support** - Includes type definitions

## Getting Started

The repository includes several example applications that demonstrate various features:

- **[Todo App](samples/apps/todo)** - Classic todo list with component composition
- **[Notes App](samples/apps/notes)** - Multi-component app with global state management
- **[Markdown Editor](samples/apps/markdown)** - Real-time markdown preview
- **[API Example](samples/apps/api)** - Fetching and displaying external data
- **[Business Card](samples/apps/biz)** - Editable form with two-way data binding
- **[Button Game](samples/apps/button-game)** - Interactive game with component events
- **[Slideshow](samples/apps/slideshow)** - Multi-slide presentation system
- **[Docs](samples/apps/docs)** - Documentation viewer with syntax highlighting

To run the examples:

```bash
# Clone the repository
git clone https://github.com/drubiodev/LadrillosJS.git
cd LadrillosJS

# Install dependencies (for dev server only)
npm install

# Start the development server
npm run dev
```

## Installation

### NPM

```bash
npm install ladrillosjs
```

### CDN

```html
<script defer src="https://cdn.jsdelivr.net/npm/ladrillosjs"></script>
```

## Your First Component

A component in LadrillosJS is a reusable custom HTML element that bundles its own template, logic, and styles into a single file.

### 1. Create a Component File

Create `hello-world.html`:

```html
<!-- hello-world.html -->
<div class="greeting">
  <h1>{title}</h1>
  <p>Hello, {name}!</p>
  <button onclick="greet">Click me ({count})</button>
</div>

<script>
  // Component state
  let title = "Welcome to LadrillosJS";
  let name = "World";
  let count = 0;

  // Event handler
  const greet = () => {
    this.state.count++;
    this.state.name = prompt("What's your name?") || "World";
  };
</script>

<style>
  .greeting {
    text-align: center;
    padding: 2rem;
    background: #f0f0f0;
    border-radius: 8px;
  }

  button {
    padding: 0.5rem 1rem;
    font-size: 1rem;
    cursor: pointer;
  }
</style>
```

### 2. Register and Use the Component

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My App</title>
  </head>
  <body>
    <!-- Use your component -->
    <hello-world></hello-world>

    <!-- Register component -->
    <script type="module">
      import { registerComponent } from "ladrillosjs";
      registerComponent("hello-world", "./hello-world.html");
    </script>
  </body>
</html>
```

## Core Concepts

### Component Registration

Register single or multiple components:

```javascript
// Single component
import { registerComponent } from "ladrillosjs";
registerComponent("my-component", "./my-component.html");

// Multiple components with concurrency control
import { registerComponents } from "ladrillosjs";
await registerComponents(
  [
    { name: "app-header", path: "./components/header.html" },
    { name: "app-footer", path: "./components/footer.html" },
    { name: "user-card", path: "./components/user-card.html" },
  ],
  10
); // Max 10 parallel fetches (default: 5)

// Using CDN
ladrillosjs.registerComponent("my-component", "./my-component.html");
```

### State Management

Components have reactive state that automatically triggers re-renders:

```html
<div>
  <h2>User: {user.name}</h2>
  <p>Score: {score}</p>
  <button onclick="updateScore">Add Point</button>
</div>

<script>
  // Initial state
  let score = 0;
  let user = { name: "Player 1" };

  const updateScore = () => {
    // Update state and trigger re-render
    this.setState({
      score: this.state.score + 1,
      user: { ...this.state.user, lastPlayed: Date.now() },
    });
  };
</script>
```

### Event Handling

Multiple ways to handle events:

```html
<!-- Method reference -->
<button onclick="handleClick">Click me: {count}</button>

<!-- Function with arguments -->
<button onclick="addItem('Hello', 123)">Add Item</button>

<!-- Inline arrow function -->
<button onclick="(e) => console.log(e.target)">Log Target</button>

<script>
  const count = 0;
  this.setState({ items: [] });

  const handleClick = (event) => {
    console.log("Clicked!", event);
    this.state.count++;
  };

  const addItem = (name, value) => {
    this.setState({ items: [...this.state.items, { name, value }] });
    console.log(this.state.items);
  };
</script>
```

### Data Binding

#### Template Bindings

Use `{}` to bind state values in templates:

```html
<div>
  <h1>{title}</h1>
  <p>{user.bio}</p>
  <img src="{user.avatar}" alt="{user.name}" />
  <span class="status-{status}">{statusText}</span>
</div>
```

#### Two-Way Data Binding

Use `data-bind` for automatic two-way binding:

```html
<form>
  <input type="text" data-bind="user.name" placeholder="Name" />
  <input type="email" data-bind="user.email" placeholder="Email" />
  <textarea data-bind="user.bio" placeholder="Bio"></textarea>

  <!-- Works with contenteditable -->
  <div contenteditable="true" data-bind="content"></div>

  <button onclick="save">Save</button>
</form>

<script>
  const save = () => {
    console.log("Saving:", this.state.user);
    // State is automatically synced with form inputs
  };
</script>
```

### Conditional Rendering

Show/hide elements based on state:

```html
<div>
  <h1>Shopping Cart ({items.length} items)</h1>

  <div data-if="items.length === 0">
    <p>Your cart is empty</p>
  </div>

  <div data-else-if="items.length < 3">
    <p>You have a few items</p>
  </div>

  <div data-else>
    <p>You have many items!</p>
  </div>

  <button data-if="!isLoggedIn" onclick="login">Login</button>
  <button data-else onclick="logout">Logout</button>
</div>
<script>
  const items = ["apple", "banana", "orange"];
  const isLoggedIn = false;

  function login() {
    this.state.isLoggedIn = true;
  }

  function logout() {
    this.state.isLoggedIn = false;
  }
</script>
```

### Slots

Content projection using slots:

```html
<!-- card.html -->
<div class="card">
  <div class="card-header">
    <slot name="header">Default Header</slot>
  </div>
  <div class="card-body">
    <slot></slot>
    <!-- Default slot -->
  </div>
  <div class="card-footer">
    <slot name="footer"></slot>
  </div>
</div>

<!-- Usage -->
<my-card>
  <h2 slot="header">User Profile</h2>
  <p>This goes in the default slot</p>
  <button slot="footer">Save</button>
</my-card>
```

## Advanced Features

### External Scripts

Load external JavaScript with components:

```html
<!-- With 'bind' attribute for component context -->
<script src="./helpers.js" bind></script>

<!-- ES modules with bind -->
<script src="./component-logic.js" type="module" bind></script>

<!-- Regular external script -->
<script src="https://cdn.example.com/library.js"></script>
```

For modules with `bind`, export a default function:

```javascript
// component-logic.js
export default function () {
  // 'this' refers to the component instance
  this.formatDate = (date) => {
    return new Intl.DateTimeFormat("en-US").format(date);
  };

  this.init = () => {
    console.log("Component initialized");
  };

  // Called automatically if defined
  this.init();
}
```

### Global State Stores

Share state across components:

```javascript
// stores/userStore.js
import { createStore } from "ladrillosjs";

export const userStore = createStore({
  user: null,
  isAuthenticated: false,
});

export function login(userData) {
  userStore.setState({
    user: userData,
    isAuthenticated: true,
  });
}

export function logout() {
  userStore.setState({
    user: null,
    isAuthenticated: false,
  });
}
```

```html
<!-- header.html -->
<header>
  <span data-if="isAuthenticated">Welcome, {user.name}!</span>
  <button data-else onclick="showLogin">Login</button>
</header>

<script type="module" src="./header-logic.js" bind></script>
```

```javascript
// header-logic.js
import { userStore } from "../stores/userStore.js";

export default function () {
  // Subscribe to store changes
  userStore.subscribe((state) => {
    this.setState({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
    });
  });

  this.showLogin = () => {
    this.emit("show-login");
  };
}
```

### Shadow DOM

Components use Shadow DOM by default for style encapsulation. To disable:

```javascript
// Disable Shadow DOM for a component
registerComponent("my-component", "./my-component.html", false);

// Multiple components
registerComponents([
  { name: "global-styles", path: "./global.html", useShadowDOM: false },
  { name: "isolated-widget", path: "./widget.html", useShadowDOM: true },
]);
```

## API Reference

### Component Methods

| Method                            | Description                                  |
| --------------------------------- | -------------------------------------------- |
| `this.setState(partial)`          | Update component state and trigger re-render |
| `this.emit(eventName, data?)`     | Dispatch a custom event                      |
| `this.listen(eventName, handler)` | Listen for custom events                     |
| `this.querySelector(selector)`    | Query element within component               |
| `this.querySelectorAll(selector)` | Query all elements within component          |

### Store Methods

| Method                      | Description                |
| --------------------------- | -------------------------- |
| `createStore(initialState)` | Create a new store         |
| `store.getState()`          | Get current store state    |
| `store.setState(partial)`   | Update store state         |
| `store.subscribe(callback)` | Subscribe to state changes |
| `store.reset()`             | Reset to initial state     |

## Examples

### Component Communication

```html
<!-- parent.html -->
<div>
  <child-component data-message="Hello"></child-component>
</div>

<script>
  this.listen("child-event", (data) => {
    console.log("Received from child:", data);
  });
</script>

<!-- child.html -->
<button onclick="sendMessage">{data-message}</button>

<script>
  const sendMessage = () => {
    this.emit("child-event", {
      message: this.state["data-message"],
      timestamp: Date.now(),
    });
  };
</script>
```

### Dynamic Component Creation

```javascript
// Create components programmatically
const createCard = (userData) => {
  const card = document.createElement("user-card");
  card.setAttribute("user-id", userData.id);
  card.setAttribute("name", userData.name);
  document.querySelector("#user-list").appendChild(card);
};

// Fetch and create
fetch("/api/users")
  .then((res) => res.json())
  .then((users) => users.forEach(createCard));
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.
