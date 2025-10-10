# LadrillosJS

<img src="https://raw.githubusercontent.com/drubiodev/LadrillosJS/refs/heads/main/LadrillosJS.png" alt="LadrillosJS" width="400"/>

A lightweight, zero-dependency web component framework for building modular web applications.

**Version 2.0** - Now rewritten in TypeScript with enhanced performance, better developer experience, and powerful new features.

"I designed this framework to empower developers with the ability to componentize their code efficiently and effectively, without the need for a full-scale framework. By focusing on simplicity and leveraging core web fundamentals, my goal was to create a lightweight and accessible solution that enhances development while staying true to the basics."

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [What's New in v2.0](#whats-new-in-v20)
  - [Example Applications](#example-applications)
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
  - [Global Event Bus](#global-event-bus)
  - [Shadow DOM](#shadow-dom)
  - [Performance & Caching](#performance--caching)
- [API Reference](#api-reference)
- [Examples](#examples)
  - [Component Communication](#component-communication)
  - [Dynamic Component Creation](#dynamic-component-creation)
  - [Passing Complex Data](#passing-complex-data)
- [Migration Guide (v1.x to v2.0)](#migration-guide-v1x-to-v20)
- [Contributing](#contributing)
- [License](#license)

## Features

- 🚀 **Zero Dependencies** - Pure JavaScript, no build tools required
- 📦 **Single-File Components** - HTML, CSS, and JavaScript in one file
- ⚡ **Reactive State** - Automatic re-rendering on state changes with optimized proxies
- 🎯 **Event System** - Built-in event emission and global event bus for component communication
- 🔄 **Two-Way Data Binding** - Seamless binding for form inputs with `$bind`
- 🎨 **Scoped Styles** - Component styles with optional Shadow DOM
- 🏪 **Global Event Bus** - Cross-component communication without prop drilling
- 🔌 **Slots Support** - Content projection with named and default slots
- 📝 **TypeScript Support** - Full type definitions and TypeScript source code
- 🎭 **Conditional Rendering** - `data-if`, `data-else-if`, and `data-else` directives
- 🚄 **Smart Caching** - LRU cache for components and compiled functions
- 🔧 **Framework Utilities** - `$state`, `$setState`, `$emit`, `$listen`, `$querySelector` helpers
- ⚙️ **Automatic Reactivity** - Variable assignments automatically trigger re-renders
- 🧩 **External Scripts** - Load and bind external JavaScript with your components

## Getting Started

### Prerequisites

- **Node.js**: Version 20.19+ or 22.12+ is required for development
- **TypeScript**: v5.8+ (included in devDependencies)

### What's New in v2.0

- **🔄 Complete TypeScript Rewrite** - Full type safety and improved IDE support
- **⚡ Performance Enhancements** - LRU caching for components and compiled functions
- **🎯 Global Event Bus** - New `$emit` and `$listen` for cross-component communication
- **🔧 Framework Utilities** - New `$state`, `$setState`, `$querySelector` helpers
- **🚀 Automatic Reactivity** - Variable assignments like `count++` automatically trigger re-renders
- **📦 Better Build System** - Vite-powered builds with sourcemaps and multiple output formats (ESM, UMD, CJS)
- **🧪 Testing** - Vitest with coverage reporting
- **🎭 Enhanced Conditionals** - More robust `data-if`, `data-else-if`, `data-else` rendering
- **🔄 Two-Way Binding** - Simplified with `$bind` prefix for automatic state synchronization
- **🧹 Memory Management** - Automatic cleanup of event listeners on component disconnect

### Example Applications

The repository includes several example applications that demonstrate various features:

- **[Todo App](samples/apps/todo)** - Classic todo list with component composition
- **[Notes App](samples/apps/notes)** - Multi-component app with global event bus
- **[Markdown Editor](samples/apps/markdown)** - Real-time markdown preview
- **[API Example](samples/apps/api)** - Fetching and displaying external data
- **[Business Card](samples/apps/biz)** - Editable form with two-way data binding using `$bind`
- **[Button Game](samples/apps/button-game)** - Interactive game with component events
- **[Slideshow](samples/apps/slideshow)** - Multi-slide presentation system
- **[Document Chat](samples/apps/document-chat)** - Chat interface with component communication
- **[Docs](samples/apps/docs)** - Documentation viewer with syntax highlighting

To run the examples:

```bash
# Clone the repository
git clone https://github.com/drubiodev/LadrillosJS.git
cd LadrillosJS

# Install dependencies
npm install

# Start the development server (Vite)
npm run dev

# Build the library
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Installation

### NPM

```bash
npm install ladrillosjs
```

### CDN

```html
<!-- Latest version -->
<script type="module">
  import { registerComponent } from "https://cdn.jsdelivr.net/npm/ladrillosjs/dist/ladrillosjs.es.js";
  registerComponent("my-component", "./my-component.html");
</script>

<!-- UMD (for legacy browsers) -->
<script src="https://cdn.jsdelivr.net/npm/ladrillosjs/dist/ladrillosjs.umd.js"></script>
<script>
  // Access via global ladrillosjs object
  ladrillosjs.registerComponent("my-component", "./my-component.html");
</script>
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
    count++;
    name = prompt("What's your name?") || "World";
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
await registerComponent("my-component", "./my-component.html");

// Multiple components (v2.0 feature - currently in development)
import { registerComponents } from "ladrillosjs";
await registerComponents([
  { name: "app-header", path: "./components/header.html" },
  { name: "app-footer", path: "./components/footer.html" },
  { name: "user-card", path: "./components/user-card.html" },
]);

// Using CDN
ladrillosjs.registerComponent("my-component", "./my-component.html");
```

**Note:** The `registerComponents` function is planned for v2.0 to enable bulk registration with concurrency control.

### State Management

Components have reactive state that automatically triggers re-renders. In v2.0, variable assignments are automatically tracked and trigger reactivity:

```html
<div>
  <h2>User: {user.name}</h2>
  <p>Score: {score}</p>
  <button onclick="updateScore">Add Point</button>
  <button onclick="increment">Count: {count}</button>
</div>

<script>
  // Initial state - automatically tracked
  let score = 0;
  let count = 0;
  let user = {
    name: "Player 1",
  };

  const updateScore = () => {
    // Direct assignment triggers re-render automatically
    score++;
  };

  const increment = () => {
    // All these automatically trigger re-renders in v2.0
    count++; // Increment
    count += 5; // Compound assignment
    count = count * 2; // Direct assignment
  };

  // You can also use the explicit setState method
  const updateUser = () => {
    $setState({ user: { name: "Jane", age: 30 } });
  };
</script>
```

**New in v2.0:**

- **Automatic Reactivity**: `count++`, `count += 5`, and direct assignments automatically trigger re-renders
- **`$state`**: Direct access to component state within scripts
- **`$setState(updates)`**: Explicit state updates (merges with existing state)

### Event Handling

Multiple ways to handle events:

```html
<!-- Method reference -->
<button onclick="handleClick">Click me: {count}</button>

<!-- Function with arguments -->
<button onclick="addItem('Hello', 123)">Add Item</button>

<!-- Inline arrow function -->
<button onclick="(e) => console.log(e.target)">Log Target</button>

<!-- Component communication with event bus (v2.0) -->
<button onclick="notifyOthers">Emit Event</button>

<script>
  let count = 0;
  let items = [];

  const handleClick = (event) => {
    console.log("Clicked!", event);
    count++;
  };

  const addItem = (name, value) => {
    items = [...items, { name, value }];
  };

  // v2.0: Use $emit to send events to other components
  const notifyOthers = () => {
    $emit("item-added", { count, timestamp: Date.now() });
  };

  // v2.0: Listen for events from other components
  $listen("user-logged-in", (data) => {
    console.log("User logged in:", data);
    count = 0; // Reset count
  });
</script>
```

**New in v2.0:**

- **`$emit(eventName, data)`**: Send events to other components via global event bus
- **`$listen(eventName, callback)`**: Listen for events from any component
- **Automatic Cleanup**: Event listeners are automatically removed when component is disconnected

### Data Binding

LadrillosJS supports both one-way and two-way data binding:

#### One-Way Binding (Template Interpolation)

```html
<div>
  <h1>{title}</h1>
  <p>{user.name} - {user.email}</p>
  <span>Items: {items.length}</span>
</div>

<script>
  let title = "My App";
  let user = { name: "John", email: "john@example.com" };
  let items = [1, 2, 3];
</script>
```

#### Two-Way Binding (v2.0 Enhanced)

Use the `$bind` prefix to create automatic two-way bindings with form inputs:

```html
<div>
  <h2>Hello, {$name}!</h2>
  <input type="text" $bind="name" placeholder="Enter your name" />

  <p>Email: {$email}</p>
  <input type="email" $bind="email" />

  <p>Bio: {$bio}</p>
  <textarea $bind="bio"></textarea>

  <p>Country: {$country}</p>
  <select $bind="country">
    <option value="us">United States</option>
    <option value="uk">United Kingdom</option>
    <option value="ca">Canada</option>
  </select>
</div>

<script>
  // Variables with $bind are automatically synced with inputs
  let $name = "World";
  let $email = "";
  let $bio = "";
  let $country = "us";
</script>
```

**New in v2.0:**

- **`$bind` attribute**: Simplified two-way binding syntax
- **Automatic State Sync**: Input changes automatically update component state
- **All Input Types**: Works with text inputs, textareas, selects, checkboxes, and radio buttons
- **Nested Paths**: Supports nested object bindings like `$bind="user.email"`

### Conditional Rendering

Control element visibility with conditional directives:

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
  let items = ["apple", "banana"];
  let isLoggedIn = false;

  const login = () => {
    isLoggedIn = true;
  };

  const logout = () => {
    isLoggedIn = false;
  };
</script>
```

**Conditional Directives:**

- **`data-if="expression"`**: Show element if expression is truthy
- **`data-else-if="expression"`**: Chain multiple conditions
- **`data-else`**: Fallback when all previous conditions are false

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

Load external JavaScript with components and bind them to the component context:

```html
<!-- With 'bind' attribute for component context -->
<script src="./helpers.js" bind></script>

<!-- ES modules with bind -->
<script src="./component-logic.js" type="module" bind></script>

<!-- Regular external script (global scope) -->
<script src="https://cdn.example.com/library.js"></script>
```

For modules with `bind`, export a default function that receives the component context:

```javascript
// component-logic.js
export default function () {
  // 'this' refers to the component instance
  // Access component utilities
  const { $state, $setState, $emit, $listen } = this;

  this.formatDate = (date) => {
    return new Intl.DateTimeFormat("en-US").format(date);
  };

  this.loadData = async () => {
    const response = await fetch("/api/data");
    const data = await response.json();
    $setState({ data });
  };

  // Listen for events from other components
  $listen("refresh-data", () => {
    this.loadData();
  });

  // Called automatically if defined
  if (this.init) {
    this.init();
  }
}
```

**New in v2.0:**

- **Better Context Binding**: External scripts get full access to component utilities
- **`$emit` and `$listen`**: Available in external scripts for event communication
- **Automatic Initialization**: Functions are auto-attached to component context

### Global Event Bus

**New in v2.0:** The global event bus enables cross-component communication without prop drilling or shared state.

```javascript
// In any component script
// Emit an event
$emit("user-logged-in", { userId: 123, username: "john" });

// Listen for events
$listen("user-logged-in", (data) => {
  console.log(`User ${data.username} logged in`);
  // Update local state
  isLoggedIn = true;
  currentUser = data;
});
```

#### Example: Header & Login Components

```html
<!-- header.html -->
<header>
  <span data-if="isLoggedIn">Welcome, {username}!</span>
  <button data-else onclick="showLogin">Login</button>
</header>

<script>
  let isLoggedIn = false;
  let username = "";

  // Listen for login event from other components
  $listen("user-logged-in", (user) => {
    isLoggedIn = true;
    username = user.username;
  });

  const showLogin = () => {
    $emit("show-login-modal");
  };
</script>
```

```html
<!-- login-form.html -->
<form onsubmit="handleLogin">
  <input type="text" $bind="username" placeholder="Username" />
  <input type="password" $bind="password" placeholder="Password" />
  <button type="submit">Login</button>
</form>

<script>
  let $username = "";
  let $password = "";

  const handleLogin = (e) => {
    e.preventDefault();

    // Emit login success event
    $emit("user-logged-in", {
      userId: 123,
      username: $username,
    });

    // Clear form
    $username = "";
    $password = "";
  };
</script>
```

**Event Bus Benefits:**

- **No Prop Drilling**: Components can communicate directly
- **Decoupled Architecture**: Components don't need to know about each other
- **Automatic Cleanup**: Listeners are removed when components disconnect
- **Promise Support**: `$emit` returns a promise when listeners are async

### Removed: Global State Stores

**Breaking Change in v2.0:** The `createStore` API has been removed in favor of the more powerful global event bus pattern. Instead of shared stores, use the event bus for cross-component communication:

**Before (v1.x with stores):**

```javascript
import { createStore } from "ladrillosjs";

export const userStore = createStore({
  user: null,
  isAuthenticated: false,
});

userStore.subscribe((state) => {
  this.setState(state);
});
```

**After (v2.0 with event bus):**

```javascript
// Emit events to notify components of changes
$emit("user-updated", { user: userData, isAuthenticated: true });

// Listen for changes in components that need them
$listen("user-updated", ({ user, isAuthenticated }) => {
  // Update local component state
  currentUser = user;
  loggedIn = isAuthenticated;
});
```

### Shadow DOM

Components use Shadow DOM by default for style encapsulation. To disable:

```javascript
// Disable Shadow DOM for a component
await registerComponent("my-component", "./my-component.html", false);

// With Shadow DOM enabled (default)
await registerComponent("isolated-widget", "./widget.html", true);
```

**Shadow DOM Benefits:**

- **Style Isolation**: Component styles don't leak to global scope
- **Encapsulation**: Internal DOM structure is hidden from parent
- **Cleaner DOM**: Styles and scripts are scoped to component

**When to Disable:**

- Need global CSS styles to apply
- Using third-party CSS frameworks
- Debugging with browser dev tools (easier without shadow DOM)

### Performance & Caching

**New in v2.0:** LRU (Least Recently Used) caching for improved performance:

#### Component Caching

- **25 Components**: Automatically caches up to 25 component HTML files
- **LRU Eviction**: Least recently used components are removed when cache is full
- **Faster Re-renders**: Cached components load instantly on re-use

#### Function Caching

- **100 Functions**: Caches up to 100 compiled template expressions
- **Prevents Memory Leaks**: Reuses Function objects for identical expressions
- **Example**: `{formatName("John")}` compiles once and is reused on every render

**Performance Improvements:**

- Reduced HTTP requests for components
- Faster template rendering with cached functions
- Optimized state updates with change detection
- Efficient re-rendering with minimal DOM updates

## API Reference

### Component Methods

| Method              | Description                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| `setState(partial)` | Update component state and trigger re-render (merges with existing state) |

### Framework Utilities (v2.0)

Available within component `<script>` tags:

| Utility                        | Description                                                          |
| ------------------------------ | -------------------------------------------------------------------- |
| `$state`                       | Direct access to component state object                              |
| `$setState(updates)`           | Update state explicitly (alternative to direct assignments)          |
| `$emit(eventName, data?)`      | Emit event to other components via global event bus                  |
| `$listen(eventName, callback)` | Listen for events from other components (auto-cleanup on disconnect) |
| `$querySelector(selector)`     | Query element within component's DOM (respects Shadow DOM)           |
| `$querySelectorAll(selector)`  | Query all matching elements within component                         |

### Component Attributes

| Attribute                   | Description                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `$bind="variableName"`      | Create two-way data binding with form inputs                                        |
| `data-if="expression"`      | Conditionally render element if expression is truthy                                |
| `data-else-if="expression"` | Chain multiple conditional expressions                                              |
| `data-else`                 | Render when all previous conditions are false                                       |
| `onclick="handler"` (etc.)  | Attach event handlers (supports method names, inline functions, or arrow functions) |

### Registration Functions

| Function                                       | Description                                            |
| ---------------------------------------------- | ------------------------------------------------------ |
| `registerComponent(name, path, useShadowDOM?)` | Register a single component (returns Promise)          |
| `registerComponents(components)`               | **Coming soon** - Register multiple components at once |

## Examples

### Component Communication

**v2.0 uses the global event bus instead of custom events:**

```html
<!-- parent.html -->
<div>
  <h2>Parent Component</h2>
  <p>Messages received: {messageCount}</p>
  <child-component></child-component>
</div>

<script>
  let messageCount = 0;

  // Listen for events from child
  $listen("child-message", (data) => {
    console.log("Received from child:", data);
    messageCount++;
  });
</script>
```

```html
<!-- child.html -->
<div>
  <h3>Child Component</h3>
  <button onclick="sendMessage">Send Message to Parent</button>
</div>

<script>
  let count = 0;

  const sendMessage = () => {
    count++;
    // Emit event that parent (or any component) can listen to
    $emit("child-message", {
      message: `Hello from child! (${count})`,
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
  card.setAttribute("email", userData.email);
  document.querySelector("#user-list").appendChild(card);
};

// Fetch and create multiple components
fetch("/api/users")
  .then((res) => res.json())
  .then((users) => users.forEach(createCard));
```

### Passing Complex Data

Use JSON.stringify for passing objects/arrays as attributes:

```html
<!-- In parent component -->
<script>
  const user = { id: 1, name: "John", roles: ["admin", "user"] };
  const items = [1, 2, 3, 4, 5];

  // Create HTML with stringified data
  const cardHtml = `
    <user-card data-user='${JSON.stringify(user)}'></user-card>
    <list-component data-items='${JSON.stringify(items)}'></list-component>
  `;

  // Or use the built-in stringify helper in v2.0
  const cardHtml2 = `
    <user-card data-user="${this.stringify(user)}"></user-card>
  `;
</script>
```

```html
<!-- In child component (user-card.html) -->
<div>
  <h3>{user.name}</h3>
  <p>ID: {user.id}</p>
  <p>Roles: {user.roles.join(", ")}</p>
</div>

<script>
  // data-user is automatically parsed from JSON
  let user = this.state["data-user"];
</script>
```

## Migration Guide (v1.x to v2.0)

### Breaking Changes

1. **Global State Stores Removed**

   - **Before:** `createStore()` API
   - **After:** Use global event bus with `$emit` and `$listen`

2. **Component Registration**

   - **Before:** `registerComponent()` was synchronous
   - **After:** Returns a Promise, use `await` or `.then()`

3. **Framework Utilities**

   - **Before:** `this.emit()`, `this.listen()`, `this.setState()`
   - **After:** Use `$emit()`, `$listen()`, `$setState()` in scripts (legacy methods still available for compatibility)

4. **Two-Way Binding**
   - **Before:** No built-in support (manual implementation)
   - **After:** Use `$bind` attribute for automatic two-way binding

### New Features to Adopt

- ✅ Use `$bind` for two-way data binding instead of manual input handling
- ✅ Replace store subscriptions with `$emit`/`$listen` event patterns
- ✅ Direct variable assignments now trigger reactivity (`count++`)
- ✅ Use `$state` for direct state access in scripts
- ✅ Leverage conditional directives: `data-if`, `data-else-if`, `data-else`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development

```bash
# Install dependencies
npm install

# Run development server with hot reload
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build the library
npm run build

# Build TypeScript types
npm run build:types
```

### Project Structure

```
src/
├── index.ts              # Main entry point
├── core/
│   ├── main.ts          # Core Ladrillos class
│   ├── webcomponent.ts  # Web component definition
│   ├── componentParser.ts  # Component file parser
│   ├── componentSource.ts  # Component fetching with cache
│   ├── eventBus.ts      # Global event bus
│   ├── css/
│   │   └── cssParser.ts
│   ├── html/
│   │   ├── htmlparser.ts
│   │   └── htmlRenderer.ts
│   └── js/
│       └── scriptParser.ts
├── cache/
│   ├── index.ts         # LRU cache for components
│   └── functionCache.ts # LRU cache for compiled functions
├── types/
│   └── LadrilloTypes.ts # TypeScript type definitions
└── utils/
    ├── logger.ts        # Logging utilities
    └── regex.ts         # Regex patterns
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**LadrillosJS v2.0** - Built with ❤️ by [Daniel Rubio](https://github.com/drubiodev)

Rewritten in TypeScript for better performance, developer experience, and maintainability.
