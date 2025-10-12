# LadrillosJS

<img src="https://raw.githubusercontent.com/drubiodev/LadrillosJS/refs/heads/main/LadrillosJS.jpg" alt="LadrillosJS" width="400"/>

A lightweight, zero-dependency web component framework for building modular web applications.

**Version 2.0** - Rewritten in TypeScript with enhanced performance, improved developer experience, and powerful new features.

> "Empower developers to componentize code efficiently without the complexity of a full-scale framework. Focus on simplicity while leveraging core web fundamentals."

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Component Registration](#component-registration)
  - [State Management](#state-management)
  - [Event Handling](#event-handling)
  - [Data Binding](#data-binding)
  - [Conditional Rendering](#conditional-rendering)
  - [List Rendering](#list-rendering)
  - [Slots](#slots)
- [Advanced Features](#advanced-features)
  - [Global Event Bus](#global-event-bus)
  - [External Scripts](#external-scripts)
  - [Shadow DOM](#shadow-dom)
  - [Performance & Caching](#performance--caching)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Development](#development)
- [License](#license)

## Features

- 🚀 **Zero Dependencies** - Pure JavaScript, no build tools required
- 📦 **Single-File Components** - HTML, CSS, and JavaScript in one file
- ⚡ **Reactive State** - Automatic re-rendering on state changes
- 🎯 **Event System** - Global event bus for component communication
- 🔄 **Two-Way Data Binding** - Seamless form input binding with `$bind`
- 🎨 **Scoped Styles** - Component styles with optional Shadow DOM
- 🔌 **Slots** - Content projection with named and default slots
- 📝 **TypeScript** - Full type definitions and TypeScript source code
- 🎭 **Conditional Rendering** - `$if`, `$else-if`, and `$else` directives
- � **List Rendering** - `$for` directive for rendering arrays
- �🚄 **Smart Caching** - LRU cache for components and compiled functions
- 🔧 **Framework Utilities** - Helper functions for common tasks
- 🧩 **External Scripts** - Load and bind external JavaScript modules

## Installation

### NPM

```bash
npm install ladrillosjs
```

### CDN

```html
<!-- ES Module (Recommended) -->
<script type="module">
  import { registerComponent } from "https://cdn.jsdelivr.net/npm/ladrillosjs/dist/ladrillosjs.es.js";
  registerComponent("my-component", "./my-component.html");
</script>

<!-- UMD (Browser Global) -->
<script src="https://cdn.jsdelivr.net/npm/ladrillosjs/dist/ladrillosjs.umd.js"></script>
<script>
  ladrillosjs.registerComponent("my-component", "./my-component.html");
</script>
```

## Quick Start

### 1. Create Your First Component

Create a file called `hello-world.html`:

```html
<!-- hello-world.html -->
<div class="greeting">
  <h1>{title}</h1>
  <p>Hello, {name}!</p>
  <button onclick="greet()">Greet ({count})</button>
</div>

<script>
  // Component state - automatically reactive
  let title = "Welcome to LadrillosJS";
  let name = "World";
  let count = 0;

  // Event handler
  const greet = () => {
    count++; // Automatically triggers re-render
    name = prompt("What's your name?") || "World";
  };
</script>

<style>
  .greeting {
    text-align: center;
    padding: 2rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 8px;
  }

  button {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    background: white;
    color: #667eea;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: transform 0.2s;
  }

  button:hover {
    transform: scale(1.05);
  }
</style>
```

### 2. Register and Use the Component

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My LadrillosJS App</title>
  </head>
  <body>
    <!-- Use your component -->
    <hello-world></hello-world>

    <!-- Register the component -->
    <script type="module">
      import { registerComponent } from "ladrillosjs";
      registerComponent("hello-world", "./hello-world.html");
    </script>
  </body>
</html>
```

### 3. Explore Example Apps

Check out the `samples/apps/` directory for complete examples:

- **[Todo App](samples/apps/todo)** - Classic todo list with component composition
- **[Notes App](samples/apps/notes)** - Multi-component app with event bus
- **[Simple Button](samples/apps/simple-button)** - Basic interactive component
- **[Business Card](samples/apps/biz)** - Form with two-way data binding
- **[Slideshow](samples/apps/slideshow)** - Multi-slide presentation
- **[Markdown Editor](samples/apps/markdown)** - Real-time markdown preview
- **[List Rendering](samples/apps/list-test)** - Dynamic lists with `$for` directive

Run the development server to view examples:

```bash
npm install
npm run dev
```

## Core Concepts

### Component Registration

Register components to make them available as custom HTML elements:

```javascript
import { registerComponent, registerComponents } from "ladrillosjs";

// Register a single component
await registerComponent("my-button", "./components/my-button.html");

// Register multiple components
await registerComponents([
  { name: "app-header", path: "./components/header.html" },
  { name: "app-footer", path: "./components/footer.html" },
  { name: "user-card", path: "./components/user-card.html" },
]);

// Disable Shadow DOM for a component
await registerComponent("global-styles", "./components/global.html", false);
```

### State Management

Components have reactive state that automatically triggers re-renders when changed:

```html
<div>
  <h2>Counter: {count}</h2>
  <p>User: {user.name}</p>
  <button onclick="increment()">Add</button>
  <button onclick="updateUser()">Change User</button>
  <button onclick="reset()">Reset</button>
</div>

<script>
  // State variables - automatically reactive
  let count = 0;
  let user = { name: "John", age: 25 };

  const increment = () => {
    count++; // Automatically triggers re-render
  };

  const updateUser = () => {
    user.name = "Jane"; // Direct mutation triggers re-render
  };

  // You can also use $setState for explicit updates
  const reset = () => {
    $setState({ count: 0, user: { name: "Anonymous", age: 0 } });
  };
</script>
```

**Available State Utilities:**

- Direct assignment: `count++`, `name = "New"`
- `$setState(updates)`: Merge updates into state
- `$getState()`: Access state in external modules

### Event Handling

Attach event handlers directly to elements:

```html
<!-- Method reference -->
<button onclick="handleClick(event)">Click me</button>

<!-- Function with arguments -->
<button onclick="addItem('apple', 5)">Add Item</button>

<!-- Inline arrow function -->
<button onclick="console.log(event.target)">Log Event</button>

<!-- Multiple events -->
<label $if="isValid">Valid</label>
<input
  type="text"
  placeholder="Enter text (min 3 characters)"
  onkeyup="validateInput(event)"
  onfocus="highlightField(event)"
  onblur="saveField(event)"
/>

<script>
  let items = [];
  let isValid = false;

  const handleClick = (event) => {
    console.log("Button clicked!", event);
  };

  const addItem = (name, quantity) => {
    items = [...items, { name, quantity }];
    console.log("Items:", items);
  };

  const validateInput = (e) => {
    const value = e.target.value;
    isValid = value.length >= 3;
  };

  const highlightField = (e) => {
    e.target.style.backgroundColor = "lightyellow";
  };

  const saveField = (e) => {
    e.target.style.backgroundColor = "";
    console.log("Field saved:", e.target.value);
  };
</script>
```

### Data Binding

#### One-Way Binding (Display Data)

Use curly braces `{}` to display state in your template:

```html
<div>
  <h1>{title}</h1>
  <p>{user.name} - {user.email}</p>
  <span>Total: {items.length} items</span>
  <p>Formatted: {formatPrice(price)}</p>
</div>

<script>
  let title = "My App";
  let user = { name: "John", email: "john@example.com" };
  let items = ["apple", "banana", "orange"];
  let price = 29.99;

  const formatPrice = (value) => `$${value.toFixed(2)}`;
</script>
```

#### Two-Way Binding (Form Inputs)

Use the `$bind` attribute for automatic synchronization between inputs and state:

```html
<div>
  <h2>Hello, {name}!</h2>
  <input type="text" $bind="name" placeholder="Your name" />

  <p>Email: {email}</p>
  <input type="email" $bind="email" />

  <p>Bio: {bio}</p>
  <textarea $bind="bio"></textarea>

  <p>Country: {country}</p>
  <select $bind="country">
    <option value="us">United States</option>
    <option value="uk">United Kingdom</option>
    <option value="ca">Canada</option>
  </select>

  <label>
    <input type="checkbox" $bind="subscribe" />
    Subscribe to newsletter: {subscribe}
  </label>
</div>

<script>
  // Variables are automatically synced with inputs
  let name = "World";
  let email = "";
  let bio = "";
  let country = "us";
  let subscribe = false;
</script>
```

### Conditional Rendering

Show or hide elements based on conditions:

```html
<div>
  <h1>Shopping Cart</h1>

  <!-- Simple condition -->
  <p $if="{items.length === 0}">Your cart is empty</p>

  <!-- Multiple conditions -->
  <div $if="{items.length > 0 && items.length < 5}">
    <p>You have {items.length} items</p>
  </div>

  <div $else-if="{items.length >= 5}">
    <p>Your cart is full! ({items.length} items)</p>
  </div>

  <!-- Login/Logout example -->
  <button $if="{!isLoggedIn}" onclick="login()">Login</button>
  <button $else onclick="logout()">Logout</button>

  <!-- Complex conditions -->
  <div $if="{user && user.role.toLowerCase() === 'admin'}">
    <p>{user.role} Panel</p>
    Hello {user.name}
    <button onclick="addToCart()">🛒 Add To Cart</button>
  </div>
</div>

<script>
  let items = [];
  let isLoggedIn = false;
  let user = null;

  const login = () => {
    isLoggedIn = true;
    user = { name: "John", role: "Admin" };
  };

  const logout = () => {
    isLoggedIn = false;
    user = null;
  };

  const addToCart = () => {
    if (items.length < 5) {
      items.push(`Item ${items.length + 1}`);
    } else {
      alert("Cart is full!");
    }
  };
</script>
```

**Conditional Directives:**

- `$if="{expression}"`: Show if expression is truthy
- `$else-if="{expression}"`: Chain multiple conditions
- `$else`: Fallback when previous conditions are false

### List Rendering

Render lists of items using the `$for` directive:

```html
<div>
  <h2>My Fruits</h2>
  <ul>
    <li $for="fruit in fruits">{fruit}</li>
  </ul>
  <button onclick="addFruit()">Add Fruit</button>
</div>

<script>
  let fruits = ["Apple", "Banana", "Orange"];

  const addFruit = () => {
    const newFruit = prompt("Enter a fruit name:");
    if (newFruit) {
      fruits = [...fruits, newFruit]; // Triggers re-render
    }
  };
</script>
```

**List Rendering with Objects:**

```html
<div>
  <h2>User List</h2>
  <div class="user-card" $for="user in users">
    <h3>{user.name}</h3>
    <p>Email: {user.email}</p>
  </div>
</div>

<script>
  let users = [
    { name: "John Doe", email: "john@example.com" },
    { name: "Jane Smith", email: "jane@example.com" },
  ];
</script>
```

**With Index:**

```html
<ul>
  <li $for="(item, index) in items">{index + 1}. {item}</li>
</ul>

<script>
  let items = ["First", "Second", "Third"];
</script>
```

### Slots

Project content from parent to child components:

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

<style>
  .card {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1rem;
  }
  .card-header {
    font-weight: bold;
    margin-bottom: 1rem;
  }
  .card-footer {
    margin-top: 1rem;
    border-top: 1px solid #eee;
    padding-top: 1rem;
  }
</style>
```

**Usage:**

```html
<my-card>
  <h2 slot="header">User Profile</h2>
  <p>Name: John Doe</p>
  <p>Email: john@example.com</p>
  <button slot="footer">Save Changes</button>
</my-card>
```

## Advanced Features

### Global Event Bus

The global event bus enables communication between components without prop drilling:

```javascript
// Emit events to other components
$emit("user-logged-in", { userId: 123, username: "john" });

// Listen for events from any component
$listen("user-logged-in", (data) => {
  console.log(`User ${data.username} logged in`);
  isLoggedIn = true;
  currentUser = data;
});
```

**Example: Cross-Component Communication**

```html
<!-- header.html -->
<header>
  <span $if="{isLoggedIn}">Welcome, {username}!</span>
  <button $else onclick="requestLogin()">Login</button>
</header>

<script>
  let isLoggedIn = false;
  let username = "";

  $listen("user-logged-in", (user) => {
    console.log("User logged in:", user);
    isLoggedIn = true;
    username = user.username;
  });

  const requestLogin = () => {
    $emit("show-login-dialog");
  };
</script>
```

```html
<!-- login-form.html -->
<form onsubmit="handleLogin(event)" $if="{showLoginDialog}">
  <input type="text" $bind="username" placeholder="Username" />
  <input type="password" $bind="password" placeholder="Password" />
  <button type="submit">Login</button>
</form>

<script>
  let showLoginDialog = false;

  $listen("show-login-dialog", () => {
    showLoginDialog = true;
  });

  const handleLogin = (e) => {
    e.preventDefault();
    $emit("user-logged-in", { userId: 123, username });
    username = "";
    password = "";
    showLoginDialog = false;
  };
</script>
```

### External Scripts

LadrillosJS supports three ways to include external JavaScript:

#### 1. Component-Scoped Scripts (Default)

Regular script tags execute within the component's context and have access to component state and utilities:

```html
<!-- alert-button.html -->
<button onclick="increaseCount()">{title}: {count}</button>

<!-- This script runs in the component context -->
<script src="./alert.js"></script>
```

**alert.js:**

```javascript
// Variables and functions are available to the component
let count = 0;
const title = "Button Count";

const increaseCount = () => {
  count++; // Updates component state
};
```

#### 2. ES Modules

Use `type="module"` for standard ES module imports:

```html
<!-- side-nav.html -->
<nav>
  <h1>&lt;Note App/&gt;</h1>
  <button onclick="createNote()">Create Note</button>
  <ul></ul>
</nav>

<!-- Load as ES module -->
<script type="module" src="../js/side.js"></script>
```

**side.js:**

```javascript
import { registerComponent, $listen, $querySelector } from "ladrillosjs";

const notes = [];
registerComponent("note-item", "./components/note-item.html");

$listen("note_saved", (data) => {
  notes.push({ ...data });
  const ul = $querySelector("ul");
  if (ul) {
    ul.innerHTML = notes
      .map((n) => `<note-item data-note='${JSON.stringify(n)}'></note-item>`)
      .join("");
  }
});
```

#### 3. External Libraries

Use the `external` attribute for third-party libraries that shouldn't be bound to component context:

```html
<!-- codeblock.html -->
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css"
/>
<script
  src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"
  external
></script>

<div class="code-container">
  <pre><code id="code" class="language-html"></code></pre>
</div>

<script>
  // Access the external library (hljs is global)
  const codeElement = $querySelector("pre code");
  codeElement.textContent = "console.log('Hello')";
  hljs.highlightElement(codeElement); // Use external library
</script>
```

**When to use `external`:**

- Third-party CDN libraries (highlight.js, Chart.js, etc.)
- Libraries that need to be loaded globally
- Scripts that don't need component context or utilities

### Shadow DOM

Components use Shadow DOM by default for style encapsulation:

```javascript
// Shadow DOM enabled (default)
await registerComponent("isolated-widget", "./widget.html");
await registerComponent("isolated-widget", "./widget.html", true);

// Shadow DOM disabled
await registerComponent("global-styles", "./global.html", false);
```

**Shadow DOM Benefits:**

- **Style Isolation**: Component styles don't leak to global scope
- **Encapsulation**: Internal DOM is hidden from parent
- **Clean Separation**: Each component has its own styling context

**When to Disable:**

- Need to apply global CSS frameworks (Bootstrap, Tailwind)
- Using third-party libraries that expect normal DOM
- Easier debugging without shadow boundaries

### Performance & Caching

LadrillosJS includes built-in performance optimizations:

#### Component Caching

- **LRU Cache**: Stores up to 25 most recently used components
- **Instant Loading**: Cached components load immediately
- **Reduced Network**: No repeated HTTP requests for components

#### Function Caching

- **Template Compilation**: Caches up to 100 compiled expressions
- **Memory Efficient**: Reuses Function objects for identical expressions
- **Faster Renders**: Expressions like `{formatName(user)}` compile once

**Performance Tips:**

- Component files are cached after first load
- State updates trigger minimal DOM changes
- Event listeners are automatically cleaned up
- Conditional rendering skips hidden elements

## API Reference

### Registration Functions

```typescript
registerComponent(name: string, path: string, useShadowDOM?: boolean): Promise<void>
registerComponents(components: Array<{name, path, useShadowDOM?}>): Promise<void>
```

### Component Utilities

Available within component `<script>` tags:

```typescript
// State management
$getState(): object                    // Access component state
$setState(updates: object): void       // Update state and re-render

// Event bus
$emit(eventName: string, data?: any): void
$listen(eventName: string, callback: (data?) => void): () => void

// DOM queries (respects Shadow DOM boundaries)
$querySelector(selector: string): Element | null
$querySelectorAll(selector: string): NodeListOf<Element>

// Reactive variables (for external modules)
$reactive(name: string, initialValue: any): (value: any) => void
```

### Component Attributes

```html
<!-- Two-way data binding -->
<input $bind="variableName" />

<!-- Conditional rendering -->
<div $if="{condition}">...</div>
<div $else-if="{anotherCondition}">...</div>
<div $else>...</div>

<!-- List rendering -->
<li $for="item in items">{item}</li>
<li $for="(item, index) in items">{index}: {item}</li>
<div $for="user in users" $key="user.id">{user.name}</div>

<!-- Event handlers -->
<button onclick="methodName()">Click</button>
<button onclick="method(arg1, arg2)">Call with args</button>
<button onclick="console.log(event)">Inline function</button>

<!-- Slots -->
<slot></slot>
<!-- Default slot -->
<slot name="header"></slot>
<!-- Named slot -->
```

### Template Syntax

```html
<!-- Variable interpolation -->
{variableName} {object.property} {array[0]}

<!-- Function calls -->
{functionName(arg1, arg2)} {object.method()}

<!-- Expressions -->
{count + 1} {isActive ? 'Yes' : 'No'} {items.length > 0 ? 'Has items' : 'Empty'}
```

## Development

### Prerequisites

- **Node.js**: v20.19+ or v22.12+
- **npm**: v9+ (comes with Node.js)

### Setup

```bash
# Clone the repository
git clone https://github.com/drubiodev/LadrillosJS.git
cd LadrillosJS

# Install dependencies
npm install

# Start development server
npm run dev

# Build the library
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Project Structure

```
LadrillosJS/
├── src/
│   ├── index.ts              # Main entry point
│   ├── core/
│   │   ├── main.ts          # Core Ladrillos class
│   │   ├── webcomponent.ts  # Web component wrapper
│   │   ├── componentParser.ts  # Parse component files
│   │   ├── componentSource.ts  # Fetch with caching
│   │   ├── eventBus.ts      # Global event bus
│   │   ├── css/
│   │   │   └── cssParser.ts
│   │   ├── html/
│   │   │   ├── htmlparser.ts
│   │   │   └── htmlRenderer.ts
│   │   └── js/
│   │       └── scriptParser.ts
│   ├── cache/
│   │   ├── index.ts         # LRU component cache
│   │   └── functionCache.ts # LRU function cache
│   ├── types/
│   │   └── LadrilloTypes.ts
│   └── utils/
│       ├── logger.ts
│       └── regex.ts
├── samples/                  # Example applications
│   └── apps/
│       ├── todo/
│       ├── notes/
│       ├── simple-button/
│       └── ...
├── test/                     # Test files
├── dist/                     # Built files
├── package.json
├── tsconfig.json
├── vite.config.js
└── vitest.config.js
```

### NPM Scripts

```bash
npm run dev              # Start Vite dev server
npm run build            # Build library (ESM, UMD, CJS)
npm run build:types      # Generate TypeScript declarations
npm test                 # Run tests with Vitest
npm run test:coverage    # Run tests with coverage report
npm run preview          # Preview production build
```

## Attribution

If you use LadrillosJS in your project, I'd appreciate a mention or link back to this repository, though it's not required. It helps others discover the framework and motivates continued development!

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**LadrillosJS v2.0** - Built with ❤️ by [Daniel Rubio](https://github.com/drubiodev)

🌟 [GitHub](https://github.com/drubiodev/LadrillosJS) • 📦 [NPM](https://www.npmjs.com/package/ladrillosjs) • 📖 [Documentation](https://github.com/drubiodev/LadrillosJS/blob/main/README.md)
