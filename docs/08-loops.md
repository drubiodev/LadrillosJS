# List Rendering

Render lists using the `<for>` built-in element.

## Basic Loop

```html
<ul>
  <for each="fruit in fruits">
    <li>{fruit}</li>
  </for>
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

The `<for>` tag itself is replaced by a comment placeholder; only the
per-iteration template is cloned into the DOM. Layout is unaffected.

---

## Loop with Index

```html
<ul>
  <for each="(item, index) in items">
    <li>#{index + 1}: {item}</li>
  </for>
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

```html
<div class="user-list">
  <for each="user in users">
    <div class="user-card">
      <img src="{user.avatar}" alt="{user.name}" />
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  </for>
</div>

<script>
  let users = [
    { id: 1, name: "Alice", email: "alice@example.com", avatar: "/avatars/alice.jpg" },
    { id: 2, name: "Bob",   email: "bob@example.com",   avatar: "/avatars/bob.jpg" },
    { id: 3, name: "Carol", email: "carol@example.com", avatar: "/avatars/carol.jpg" },
  ];
</script>
```

---

## Multiple Top-Level Children

`<for>` may contain any number of top-level children. They are rendered
together per iteration without an extra wrapper box (the framework wraps them
in a `display: contents` span):

```html
<table>
  <tbody>
    <for each="row in rows" key="row.id">
      <td>{row.name}</td>
      <td>{row.email}</td>
      <td>{row.role}</td>
    </for>
  </tbody>
</table>
```

> Tip: when you have a single element child, the framework uses it directly
> with **zero** wrapping overhead. Multi-child bodies pay one wrapper span
> per iteration.

---

## The `key` Attribute

Use `key` for efficient updates when items can be reordered, added, or
removed:

```html
<for each="user in users" key="user.id">
  <div class="user-card">
    <h3>{user.name}</h3>
  </div>
</for>

<script>
  let users = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
    { id: 3, name: "Carol" },
  ];
</script>
```

You may also use `track-by="user.id"` as a synonym (familiar from other
frameworks).

### Why use keys?

Without keys, LadrillosJS updates elements by position. With keys, it tracks
each element by identity, so reorders, inserts, and removes preserve element
state (form inputs, focus, scroll position):

```html
<!-- Without key: input state may bleed between rows on reorder -->
<for each="item in items">
  <input value="{item.text}" />
</for>

<!-- With key: input state stays attached to the right item -->
<for each="item in items" key="item.id">
  <input value="{item.text}" />
</for>
```

**Best practices:**

- Use unique, stable identifiers (IDs, not array indices).
- Always use `key` when items can be reordered.
- Always use `key` when items contain form inputs or component state.

---

## Dynamic Lists

### Adding items

```html
<div>
  <input $bind="newItem" placeholder="Enter item…" />
  <button onclick="addItem()">Add</button>
</div>

<ul>
  <for each="(item, i) in items">
    <li>
      {item}
      <button onclick="removeItem(i)">×</button>
    </li>
  </for>
</ul>

<script>
  let items = ["Item 1", "Item 2"];
  let newItem = "";

  function addItem() {
    if (newItem.trim()) {
      items = [...items, newItem];
      newItem = "";
    }
  }

  function removeItem(index) {
    items = items.filter((_, i) => i !== index);
  }
</script>
```

### Reordering

```html
<ul>
  <for each="(item, i) in items" key="item.id">
    <li>
      {item.name}
      <if condition="i > 0">
        <button onclick="moveUp(i)">↑</button>
      </if>
      <if condition="i < items.length - 1">
        <button onclick="moveDown(i)">↓</button>
      </if>
    </li>
  </for>
</ul>

<script>
  let items = [
    { id: 1, name: "First" },
    { id: 2, name: "Second" },
    { id: 3, name: "Third" },
  ];

  function moveUp(index) {
    if (index > 0) {
      const next = [...items];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      items = next;
    }
  }

  function moveDown(index) {
    if (index < items.length - 1) {
      const next = [...items];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      items = next;
    }
  }
</script>
```

---

## Nested Loops

```html
<for each="category in categories">
  <div class="category">
    <h2>{category.name}</h2>
    <ul>
      <for each="item in category.items">
        <li>{item}</li>
      </for>
    </ul>
  </div>
</for>

<script>
  let categories = [
    { name: "Fruits",     items: ["Apple", "Banana", "Cherry"] },
    { name: "Vegetables", items: ["Carrot", "Broccoli", "Spinach"] },
    { name: "Dairy",      items: ["Milk", "Cheese", "Yogurt"] },
  ];
</script>
```

---

## Loop with Conditionals

Use `<if>` inside a loop body:

```html
<ul>
  <for each="task in tasks">
    <li>
      <if condition="task.completed">✅</if>
      <else>⬜</else>
      {task.title}
    </li>
  </for>
</ul>

<script>
  let tasks = [
    { title: "Buy groceries", completed: true },
    { title: "Clean room",    completed: false },
    { title: "Do laundry",    completed: false },
  ];
</script>
```

### Filter in script (preferred)

```html
<for each="task in activeTasks">
  <li>{task.title}</li>
</for>

<script>
  let tasks = [/* … */];
  let activeTasks = tasks.filter((t) => !t.completed);
</script>
```

---

## Event Handlers in Loops

Pass loop data to handlers:

```html
<ul>
  <for each="(item, index) in items">
    <li>
      {item.name}
      <button onclick="editItem(item)">Edit</button>
      <button onclick="deleteItem(index)">Delete</button>
      <button onclick="handleClick(item, index, event)">Details</button>
    </li>
  </for>
</ul>

<script>
  let items = [
    { id: 1, name: "Item 1" },
    { id: 2, name: "Item 2" },
  ];

  function editItem(item) { console.log("Edit:", item); }
  function deleteItem(index) { items = items.filter((_, i) => i !== index); }
  function handleClick(item, index, event) {
    console.log("Item:", item, "Index:", index, "Event:", event);
  }
</script>
```

---

## Number Ranges

```html
<div class="pagination">
  <for each="page in pages">
    <button onclick="goToPage(page)">{page}</button>
  </for>
</div>

<script>
  let totalPages = 5;
  let pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  // pages = [1, 2, 3, 4, 5]
</script>
```

---

## Common Patterns

### Table rows

```html
<table>
  <thead>
    <tr><th>Name</th><th>Email</th><th>Actions</th></tr>
  </thead>
  <tbody>
    <for each="user in users" key="user.id">
      <tr>
        <td>{user.name}</td>
        <td>{user.email}</td>
        <td>
          <button onclick="editUser(user)">Edit</button>
          <button onclick="deleteUser(user.id)">Delete</button>
        </td>
      </tr>
    </for>
  </tbody>
</table>
```

### Grid of cards

```html
<div class="grid">
  <for each="post in posts" key="post.id">
    <article class="card">
      <img src="{post.thumbnail}" alt="{post.title}" />
      <h3>{post.title}</h3>
      <p>{post.excerpt}</p>
      <a href="/posts/{post.id}">Read more</a>
    </article>
  </for>
</div>
```

### Select options

```html
<select $bind="selectedCountry">
  <option value="">Select a country…</option>
  <for each="country in countries">
    <option value="{country.code}">{country.name}</option>
  </for>
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

1. **Always use `key`** for lists that change order, get inserts, or get
   removes.
2. **Filter in script**, not in template — recompute the filtered array once
   instead of evaluating a `<if>` for every iteration.
3. **Prefer a single root child** in `<for>` bodies when possible — the
   framework skips the wrapper allocation in that case.
4. **Avoid deeply nested loops** when the inputs are large. Consider grouping
   data in script or using virtual scrolling for very long lists.

---

← [Conditional Rendering](./07-conditionals.md) | [Two-Way Binding](./09-two-way-binding.md) →

[Back to Index](./README.md)
