# Conditional Rendering

Control what content renders using the `<if>`, `<else-if>`, and `<else>`
built-in elements.

## Basic `<if>`

```html
<if condition="isLoggedIn">
  <p>Welcome back, {username}!</p>
</if>

<script>
  let isLoggedIn = true;
  let username = "Alice";
</script>
```

### How It Works

When the condition is:

- **Truthy** — the element's children are inserted into the DOM.
- **Falsy** — the children are **removed** from the DOM (not just hidden).

The `<if>` element itself renders as `display: contents`, so it does not add
any wrapper box to the layout.

---

## `<if>` with `<else>`

Provide a fallback when the condition is false:

```html
<if condition="isLoggedIn">
  <p>Welcome back, {username}!</p>
</if>
<else>
  <p>Please log in to continue.</p>
</else>

<script>
  let isLoggedIn = false;
</script>
```

**Important:** `<else>` must be an **immediate sibling** of `<if>`.

---

## Full Chain: `<if>` / `<else-if>` / `<else>`

```html
<if condition="status === 'loading'">
  <span>⏳ Loading…</span>
</if>
<else-if condition="status === 'success'">
  <span>✅ Data loaded successfully!</span>
</else-if>
<else-if condition="status === 'error'">
  <span>❌ An error occurred!</span>
</else-if>
<else>
  <span>📭 No data available</span>
</else>

<script>
  let status = "loading";
  setTimeout(() => (status = "success"), 2000);
</script>
```

Only the first matching branch renders.

---

## Multiple Top-Level Children

`<if>`, `<else-if>`, and `<else>` may contain any number of top-level children
— they all render together when the branch is active:

```html
<if condition="user">
  <h2>Hi, {user.name}</h2>
  <p>Role: {user.role}</p>
  <button onclick="logout()">Log out</button>
</if>
<else>
  <h2>Welcome, guest</h2>
  <button onclick="login()">Log in</button>
</else>
```

---

## Expression Syntax

The `condition` attribute accepts any JavaScript expression. Curly braces are
optional:

```html
<!-- Boolean -->
<if condition="isVisible">…</if>
<if condition="{isVisible}">…</if>

<!-- Comparison -->
<if condition="count > 0">Has items</if>
<if condition="age >= 18">Adult content</if>

<!-- Equality -->
<if condition="status === 'active'">Active</if>
<if condition="type !== 'hidden'">Visible</if>

<!-- Logical -->
<if condition="isLoggedIn && isAdmin">Admin Panel</if>
<if condition="hasPermission || isOwner">Can Edit</if>
<if condition="!isLoading">Content ready</if>

<!-- Truthy check -->
<if condition="user">User exists</if>
<if condition="items.length">Has items</if>

<!-- Complex -->
<if condition="user && user.role === 'admin' && !isMaintenance">
  <admin-panel></admin-panel>
</if>
```

---

## Common Patterns

### Loading / Error / Content States

```html
<if condition="isLoading">
  <div class="spinner">Loading…</div>
</if>
<else-if condition="error">
  <div class="error">Error: {error.message}</div>
</else-if>
<else>
  <div class="content">{data}</div>
</else>

<script>
  let isLoading = true;
  let error = null;
  let data = null;

  async function fetchData() {
    isLoading = true;
    try {
      const response = await fetch("/api/data");
      data = await response.json();
    } catch (e) {
      error = e;
    } finally {
      isLoading = false;
    }
  }
</script>
```

### Role-based Navigation

```html
<nav>
  <a href="/">Home</a>
  <a href="/profile">Profile</a>
  <if condition="user.role === 'admin'">
    <a href="/admin">Admin</a>
  </if>
  <if condition="user.role === 'moderator' || user.role === 'admin'">
    <a href="/mod">Moderation</a>
  </if>
</nav>
```

### Empty State

```html
<if condition="items.length === 0">
  <p>No items yet.</p>
  <button onclick="addItem()">Add your first item</button>
</if>
<else>
  <ul>
    <for each="item in items">
      <li>{item.name}</li>
    </for>
  </ul>
</else>
```

### Toggle Visibility

```html
<button onclick="showDetails = !showDetails">
  {showDetails ? 'Hide' : 'Show'} Details
</button>

<if condition="showDetails">
  <p>Here are the details…</p>
</if>

<script>
  let showDetails = false;
</script>
```

---

## `<if>` vs `<show>`

Both control visibility but differently:

| Feature        | `<if>`                  | `<show>`                    |
| -------------- | ----------------------- | --------------------------- |
| DOM            | Inserts/removes content | Always in DOM               |
| CSS            | N/A                     | `display: none` toggled     |
| Performance    | Better for rare changes | Better for frequent toggles |
| Event handlers | Destroyed/recreated     | Preserved                   |
| State          | Lost on hide            | Preserved                   |

### When to use `<if>`

- Content is rarely toggled
- Large content blocks
- Content has initialization cost
- You want to avoid unnecessary rendering

```html
<if condition="showModal">
  <heavy-content></heavy-content>
</if>
```

### When to use `<show>`

- Frequent toggling
- Preserving form state
- Simple visibility animations
- Small content

```html
<show condition="isMenuOpen">
  <nav class="menu">
    <a href="/">Home</a>
    <a href="/about">About</a>
  </nav>
</show>
```

---

## Nesting Conditionals

You can nest `<if>` chains freely:

```html
<if condition="user">
  <h2>Welcome, {user.name}</h2>

  <if condition="user.isVerified">
    <span class="badge">✓ Verified</span>

    <if condition="user.isPremium">
      <span class="badge gold">★ Premium</span>
    </if>
  </if>
  <else>
    <p>Please verify your email.</p>
  </else>
</if>
<else>
  <p>Please log in.</p>
</else>
```

---

## Technical Details

### How rendering works

When a `<if>` chain is processed:

1. A `<!-- <if> condition -->` comment placeholder is inserted in its place.
2. The active branch's element is mounted before the placeholder.
3. On state change, the active branch is removed and the new one mounted.
4. Each branch element renders with `display: contents`, so the chain adds
   no wrapper box to layout.

### Sibling rules

`<else-if>` and `<else>` must be **immediate** siblings of `<if>` (or another
`<else-if>`). Any other element between them breaks the chain:

```html
<!-- ✅ Correct -->
<if condition="a"><p>A</p></if>
<else-if condition="b"><p>B</p></else-if>
<else><p>C</p></else>

<!-- ❌ Wrong: paragraph breaks the chain -->
<if condition="a"><p>A</p></if>
<p>Some text</p>
<else><p>C</p></else>
```

---

← [Built-in Elements & Directives](./06-directives.md) | [List Rendering](./08-loops.md) →

[Back to Index](./README.md)
