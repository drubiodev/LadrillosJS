# Reactivity System

LadrillosJS uses JavaScript Proxies to make state reactive. When you change a variable, the DOM updates automatically.

## How It Works

### The Magic of Proxies

When you write this in your component:

```html
<script>
  let count = 0;
</script>
```

LadrillosJS transforms it internally to:

```javascript
// Pseudocode - this is what happens behind the scenes
const state = new Proxy(
  { count: 0 },
  {
    set(target, key, value) {
      target[key] = value;
      updateDOM(); // Automatically update bindings!
      return true;
    },
  }
);
```

This means **any assignment triggers a DOM update**:

```javascript
count = 5; // DOM updates!
count++; // DOM updates!
count += 10; // DOM updates!
```

---

## Basic Reactivity

### Simple Variables

```html
<div>
  <p>Count: {count}</p>
  <button onclick="count++">Increment</button>
</div>

<script>
  let count = 0; // Reactive!
</script>
```

### Objects

Object properties are also reactive:

```html
<div>
  <p>Name: {user.name}</p>
  <p>Email: {user.email}</p>
  <button onclick="user.name = 'New Name'">Change Name</button>
</div>

<script>
  let user = {
    name: "Alice",
    email: "alice@example.com",
  };
</script>
```

### Nested Objects

Deep nesting works too:

```html
<div>
  <p>City: {user.address.city}</p>
  <button onclick="user.address.city = 'New York'">Move</button>
</div>

<script>
  let user = {
    name: "Alice",
    address: {
      city: "London",
      country: "UK",
    },
  };
</script>
```

---

## Reactive Arrays

Arrays are wrapped with special handling for mutation methods:

```html
<div>
  <ul>
    <for each="item in items"><li>{item}</li></for>
  </ul>
  <button onclick="items.push('New Item')">Add</button>
  <button onclick="items.pop()">Remove Last</button>
</div>

<script>
  let items = ["Apple", "Banana", "Cherry"];
</script>
```

### Reactive Array Methods

These methods automatically trigger updates:

- `push()` - Add to end
- `pop()` - Remove from end
- `shift()` - Remove from start
- `unshift()` - Add to start
- `splice()` - Add/remove at index
- `sort()` - Sort in place
- `reverse()` - Reverse in place
- `fill()` - Fill with value
- `copyWithin()` - Copy within array

```html
<script>
  let items = ["a", "b", "c"];

  // All of these trigger DOM updates:
  items.push("d"); // ['a', 'b', 'c', 'd']
  items.splice(1, 1); // ['a', 'c', 'd']
  items[0] = "x"; // ['x', 'c', 'd'] - Index assignment
  items.length = 2; // ['x', 'c'] - Length change
</script>
```

### Replacing Arrays

You can also replace the entire array:

```html
<script>
  let items = ["a", "b", "c"];

  // Replace with new array
  items = ["x", "y", "z"];

  // Filter creates new array
  items = items.filter((i) => i !== "y");

  // Map creates new array
  items = items.map((i) => i.toUpperCase());
</script>
```

---

## Computed Values

Use expressions in bindings for computed values:

```html
<div>
  <p>Count: {count}</p>
  <p>Double: {count * 2}</p>
  <p>Squared: {count * count}</p>
  <p>Is Even: {count % 2 === 0 ? 'Yes' : 'No'}</p>
</div>

<script>
  let count = 5;
</script>
```

### Complex Computations

For complex logic, use functions:

```html
<div>
  <p>Items: {items.length}</p>
  <p>Total: ${calculateTotal()}</p>
  <p>Summary: {getSummary()}</p>
</div>

<script>
  let items = [
    { name: "Apple", price: 1.5, qty: 3 },
    { name: "Banana", price: 0.75, qty: 5 },
  ];

  function calculateTotal() {
    return items
      .reduce((sum, item) => sum + item.price * item.qty, 0)
      .toFixed(2);
  }

  function getSummary() {
    return `${items.length} items, $${calculateTotal()} total`;
  }
</script>
```

---

## Batched Updates

LadrillosJS batches multiple state changes into a single DOM update:

```html
<script>
  function updateAll() {
    // These three changes result in ONE DOM update
    firstName = "John";
    lastName = "Doe";
    age = 30;
  }
</script>
```

This happens automatically using a microtask scheduler.

---

## Understanding Binding Updates

When state changes, only affected bindings update:

```html
<div>
  <p>Name: {name}</p>
  <!-- Updates when `name` changes -->
  <p>Age: {age}</p>
  <!-- Updates when `age` changes -->
  <p>Full: {name} ({age})</p>
  <!-- Updates when either changes -->
</div>

<script>
  let name = "Alice";
  let age = 25;

  // Only updates the "Name" and "Full" paragraphs
  name = "Bob";

  // Only updates the "Age" and "Full" paragraphs
  age = 30;
</script>
```

### Dependency Tracking

The framework analyzes your binding expressions to determine dependencies:

| Binding                     | Dependencies         |
| --------------------------- | -------------------- |
| `{name}`                    | `name`               |
| `{user.email}`              | `user`, `user.email` |
| `{count * 2}`               | `count`              |
| `{items.length}`            | `items`              |
| `{isActive ? 'Yes' : 'No'}` | `isActive`           |

---

## Reactivity Gotchas

### ✅ This Works

```javascript
// Direct assignment
count = 5;
user.name = "Bob";
items[0] = "new value";

// Array methods
items.push("new item");
items.splice(1, 1);

// Object property assignment
user.address.city = "Paris";
```

### ⚠️ Be Careful

```javascript
// Adding new properties to objects AFTER initial render
// may not be reactive depending on how the object was defined
user.newProperty = "value"; // May not trigger update

// Solution: Define all properties upfront
let user = {
  name: "",
  email: "",
  newProperty: "", // Define even if empty
};
```

---

## What Becomes Reactive (Script Transform Limits)

Reactivity is wired up by scanning your component `<script>` for **top-level
variable declarations** and rewriting reads/writes to go through the reactive
state. This runs at load time (no build step), so it recognizes the common
declaration forms but not every possible one. Knowing the boundary avoids
surprises:

**✅ Recognized as reactive state**

```javascript
let count = 0; // ✅ simple top-level let/const/var
const items = []; // ✅
let user = { name: "Ada" }; // ✅ (whole object is reactive)
function greet() {} // ✅ functions are available to templates/handlers
```

**⚠️ Not automatically reactive**

```javascript
// Destructured declarations — the individual names are NOT tracked
const { a, b } = props; // ⚠️ a and b won't drive updates
const [first] = list; // ⚠️

// Declarations created inside functions/blocks are local (by design)
function load() {
  let temp = 1; // local variable, not component state — intended
}

// Computed member writes to a NEW key
state["dynamic" + id] = 1; // ⚠️ prefer a declared object/array
```

**How to make them reactive:** declare the variable at the top level with a
plain name, then assign to it.

```javascript
// Instead of: const { a, b } = props;
let a = props.a; // ✅
let b = props.b; // ✅
```

> This is a documented limitation of the runtime (no-build) transform, not a
> bug. If you find a declaration form that should be tracked but isn't, prefer
> the plain top-level form above, or open an issue.

---

## The Reactive Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     State Change                            │
│                    count = 5                                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Proxy Intercepts                          │
│              set(target, 'count', 5)                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Scheduler Queues Update                    │
│            scheduleComponentUpdate(componentId)             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Microtask: Batch Process                       │
│                                                             │
│  1. Find bindings that depend on 'count'                   │
│  2. Re-evaluate each binding expression                     │
│  3. Update DOM nodes with new values                        │
│  4. Update built-ins (<for>, <if>, <show>) and $bind        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    DOM Updated                              │
│           <p>Count: 5</p>  ← Was "Count: 0"                │
└─────────────────────────────────────────────────────────────┘
```

---

← [Components](./03-components.md) | [Template Bindings](./05-template-bindings.md) →

[Back to Index](./README.md)
