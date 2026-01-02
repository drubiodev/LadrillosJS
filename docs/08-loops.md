# List Rendering

Render lists of items using the `$for` directive.

## Basic Loop

```html
<ul>
  <li $for="fruit in fruits">{fruit}</li>
</ul>

<script>
  let fruits = ["Apple", "Banana", "Cherry"];
</script>
```

**Output:**

```html
<ul>
  <li>Apple</li>
  <li>Banana</li>
  <li>Cherry</li>
</ul>
```

---

## Loop with Index

Access the current index using destructuring:

```html
<ul>
  <li $for="(item, index) in items">#{index + 1}: {item}</li>
</ul>

<script>
  let items = ["First", "Second", "Third"];
</script>
```

**Output:**

```html
<ul>
  <li>#1: First</li>
  <li>#2: Second</li>
  <li>#3: Third</li>
</ul>
```

---

## Object Arrays

Loop over arrays of objects:

```html
<div class="user-list">
  <div $for="user in users" class="user-card">
    <img src="{user.avatar}" alt="{user.name}" />
    <h3>{user.name}</h3>
    <p>{user.email}</p>
  </div>
</div>

<script>
  let users = [
    {
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      avatar: "/avatars/alice.jpg",
    },
    {
      id: 2,
      name: "Bob",
      email: "bob@example.com",
      avatar: "/avatars/bob.jpg",
    },
    {
      id: 3,
      name: "Carol",
      email: "carol@example.com",
      avatar: "/avatars/carol.jpg",
    },
  ];
</script>
```

---

## The `$key` Attribute

Use `$key` for efficient updates when items can be reordered, added, or removed:

```html
<div $for="user in users" $key="user.id" class="user-card">
  <h3>{user.name}</h3>
</div>

<script>
  let users = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
    { id: 3, name: "Carol" },
  ];
</script>
```

### Why Use Keys?

Without keys, LadrillosJS updates elements by index. With keys, it tracks elements by identity.

```html
<!-- Without $key: Reorder might cause issues with form state -->
<div $for="item in items">
  <input value="{item.text}" />
</div>

<!-- With $key: Input state preserved during reorder -->
<div $for="item in items" $key="item.id">
  <input value="{item.text}" />
</div>
```

**Best practices:**

- Use unique, stable identifiers (IDs, not indices)
- Always use `$key` when items can be reordered
- Always use `$key` when items contain form inputs or state

---

## Dynamic Lists

### Adding Items

```html
<div>
  <input $bind="newItem" placeholder="Enter item..." />
  <button onclick="addItem()">Add</button>
</div>

<ul>
  <li $for="(item, i) in items">
    {item}
    <button onclick="removeItem(i)">×</button>
  </li>
</ul>

<script>
  let items = ["Item 1", "Item 2"];
  let newItem = "";

  function addItem() {
    if (newItem.trim()) {
      items.push(newItem);
      newItem = "";
    }
  }

  function removeItem(index) {
    items.splice(index, 1);
  }
</script>
```

### Reordering

```html
<ul>
  <li $for="(item, i) in items" $key="item.id">
    {item.name}
    <button onclick="moveUp(i)" $if="{i > 0}">↑</button>
    <button onclick="moveDown(i)" $if="{i < items.length - 1}">↓</button>
  </li>
</ul>

<script>
  let items = [
    { id: 1, name: "First" },
    { id: 2, name: "Second" },
    { id: 3, name: "Third" },
  ];

  function moveUp(index) {
    if (index > 0) {
      [items[index - 1], items[index]] = [items[index], items[index - 1]];
      items = [...items]; // Trigger reactivity
    }
  }

  function moveDown(index) {
    if (index < items.length - 1) {
      [items[index], items[index + 1]] = [items[index + 1], items[index]];
      items = [...items];
    }
  }
</script>
```

---

## Nested Loops

Loop inside a loop:

```html
<div $for="category in categories" class="category">
  <h2>{category.name}</h2>
  <ul>
    <li $for="item in category.items">{item}</li>
  </ul>
</div>

<script>
  let categories = [
    { name: "Fruits", items: ["Apple", "Banana", "Cherry"] },
    { name: "Vegetables", items: ["Carrot", "Broccoli", "Spinach"] },
    { name: "Dairy", items: ["Milk", "Cheese", "Yogurt"] },
  ];
</script>
```

---

## Loop with Conditionals

Use `$if` inside loop elements (on child elements):

```html
<ul>
  <li $for="task in tasks">
    <span $if="{task.completed}">✅</span>
    <span $else>⬜</span>
    {task.title}
  </li>
</ul>

<script>
  let tasks = [
    { title: "Buy groceries", completed: true },
    { title: "Clean room", completed: false },
    { title: "Do laundry", completed: false },
  ];
</script>
```

### Filter in Template vs Script

```html
<!-- Option 1: Filter in script (recommended) -->
<li $for="task in activeTasks">{task.title}</li>

<script>
  let tasks = [...];

  // Compute filtered list
  $: activeTasks = tasks.filter(t => !t.completed);
</script>

<!-- Option 2: Conditional inside loop -->
<template $for="task in tasks">
  <li $if="{!task.completed}">{task.title}</li>
</template>
```

---

## Event Handlers in Loops

Pass loop data to event handlers:

```html
<ul>
  <li $for="(item, index) in items">
    {item.name}
    <button onclick="editItem(item)">Edit</button>
    <button onclick="deleteItem(index)">Delete</button>
    <button onclick="handleClick(item, index, event)">Details</button>
  </li>
</ul>

<script>
  let items = [
    { id: 1, name: "Item 1" },
    { id: 2, name: "Item 2" },
  ];

  function editItem(item) {
    console.log("Edit:", item);
  }

  function deleteItem(index) {
    items.splice(index, 1);
  }

  function handleClick(item, index, event) {
    console.log("Item:", item, "Index:", index, "Event:", event);
  }
</script>
```

---

## Number Ranges

Create a range of numbers for iteration:

```html
<div class="pagination">
  <button $for="page in pages" onclick="goToPage(page)">{page}</button>
</div>

<script>
  // Create array of page numbers
  let totalPages = 5;
  let pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  // pages = [1, 2, 3, 4, 5]
</script>
```

---

## Common Patterns

### Table Rows

```html
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Email</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr $for="user in users" $key="user.id">
      <td>{user.name}</td>
      <td>{user.email}</td>
      <td>
        <button onclick="editUser(user)">Edit</button>
        <button onclick="deleteUser(user.id)">Delete</button>
      </td>
    </tr>
  </tbody>
</table>
```

### Grid of Cards

```html
<div class="grid">
  <article $for="post in posts" $key="post.id" class="card">
    <img src="{post.thumbnail}" alt="{post.title}" />
    <h3>{post.title}</h3>
    <p>{post.excerpt}</p>
    <a href="/posts/{post.id}">Read more</a>
  </article>
</div>
```

### Select Options

```html
<select $bind="selectedCountry">
  <option value="">Select a country...</option>
  <option $for="country in countries" value="{country.code}">
    {country.name}
  </option>
</select>

<script>
  let countries = [
    { code: "US", name: "United States" },
    { code: "UK", name: "United Kingdom" },
    { code: "CA", name: "Canada" },
  ];
  let selectedCountry = "";
</script>
```

---

## Performance Tips

1. **Always use `$key`** for lists that change
2. **Filter in script**, not in template
3. **Avoid deeply nested loops** when possible
4. **Use virtual scrolling** for very long lists (not built-in)

---

← [Conditional Rendering](./07-conditionals.md) | [Two-Way Binding](./09-two-way-binding.md) →

[Back to Index](./README.md)
