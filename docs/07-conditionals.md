# Conditional Rendering

Control what content is displayed using `$if`, `$else-if`, and `$else` directives.

## Basic `$if`

Show or hide content based on a condition:

```html
<div $if="{isLoggedIn}">Welcome back, {username}!</div>

<script>
  let isLoggedIn = true;
  let username = "Alice";
</script>
```

### How It Works

When the condition is:

- **Truthy**: Element is in the DOM
- **Falsy**: Element is **removed** from the DOM (not just hidden)

---

## `$if` with `$else`

Provide a fallback when condition is false:

```html
<div $if="{isLoggedIn}">Welcome back, {username}!</div>
<div $else>Please log in to continue.</div>

<script>
  let isLoggedIn = false;
  let username = "";
</script>
```

**Important:** `$else` must be an immediate sibling of `$if`.

---

## Full Chain: `$if`, `$else-if`, `$else`

Handle multiple conditions:

```html
<div $if="{status === 'loading'}">
  <span>⏳ Loading...</span>
</div>
<div $else-if="{status === 'success'}">
  <span>✅ Data loaded successfully!</span>
</div>
<div $else-if="{status === 'error'}">
  <span>❌ An error occurred!</span>
</div>
<div $else>
  <span>📭 No data available</span>
</div>

<script>
  let status = "loading";

  // Simulate status changes
  setTimeout(() => (status = "success"), 2000);
</script>
```

---

## Expression Syntax

Conditions use curly braces with any JavaScript expression:

```html
<!-- Boolean variable -->
<div $if="{isVisible}">...</div>

<!-- Comparison -->
<div $if="{count > 0}">Has items</div>
<div $if="{age >= 18}">Adult content</div>

<!-- Equality -->
<div $if="{status === 'active'}">Active</div>
<div $if="{type !== 'hidden'}">Visible</div>

<!-- Logical AND -->
<div $if="{isLoggedIn && isAdmin}">Admin Panel</div>

<!-- Logical OR -->
<div $if="{hasPermission || isOwner}">Can Edit</div>

<!-- Negation -->
<div $if="{!isLoading}">Content ready</div>

<!-- Truthy check -->
<div $if="{user}">User exists</div>
<div $if="{items.length}">Has items</div>

<!-- Complex expression -->
<div $if="{user && user.role === 'admin' && !isMaintenance}">
  Admin controls
</div>
```

---

## Common Patterns

### Loading States

```html
<div $if="{isLoading}">
  <div class="spinner">Loading...</div>
</div>
<div $else-if="{error}">
  <div class="error">Error: {error.message}</div>
</div>
<div $else>
  <div class="content">{data}</div>
</div>

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

### User Roles

```html
<nav>
  <a href="/">Home</a>
  <a href="/profile">Profile</a>
  <a $if="{user.role === 'admin'}" href="/admin">Admin</a>
  <a $if="{user.role === 'moderator' || user.role === 'admin'}" href="/mod"
    >Moderation</a
  >
</nav>
```

### Empty States

```html
<div $if="{items.length === 0}">
  <p>No items yet.</p>
  <button onclick="addItem()">Add your first item</button>
</div>
<ul $else>
  <li $for="item in items">{item.name}</li>
</ul>
```

### Toggle Visibility

```html
<button onclick="showDetails = !showDetails">
  {showDetails ? 'Hide' : 'Show'} Details
</button>

<div $if="{showDetails}">
  <p>Here are the details...</p>
</div>

<script>
  let showDetails = false;
</script>
```

---

## `$if` vs `$show`

Both control visibility, but work differently:

| Feature        | `$if`                   | `$show`                     |
| -------------- | ----------------------- | --------------------------- |
| DOM            | Removes/adds element    | Always in DOM               |
| CSS            | N/A                     | `display: none`             |
| Performance    | Better for rare changes | Better for frequent toggles |
| Event handlers | Destroyed/recreated     | Preserved                   |
| State          | Lost on hide            | Preserved                   |

### When to Use `$if`

- Content is rarely toggled
- Large content blocks
- Content has initialization cost
- You want to avoid unnecessary rendering

```html
<!-- Good for $if: Rarely shown modal -->
<div $if="{showModal}" class="modal">
  <heavy-content></heavy-content>
</div>
```

### When to Use `$show`

- Frequent toggling
- Preserving form state
- Simple visibility animations
- Small content

```html
<!-- Good for $show: Frequently toggled menu -->
<nav $show="{isMenuOpen}" class="menu">
  <a href="/">Home</a>
  <a href="/about">About</a>
</nav>
```

---

## Nesting Conditionals

You can nest `$if` directives:

```html
<div $if="{user}">
  <h2>Welcome, {user.name}</h2>

  <div $if="{user.isVerified}">
    <span class="badge">✓ Verified</span>

    <div $if="{user.isPremium}">
      <span class="badge gold">★ Premium</span>
    </div>
  </div>
  <div $else>
    <p>Please verify your email.</p>
  </div>
</div>
<div $else>
  <p>Please log in.</p>
</div>
```

---

## Technical Details

### Element Replacement

When conditions change, LadrillosJS:

1. Stores a `<!-- placeholder -->` comment where the element was
2. Removes the element from DOM when false
3. Reinserts the element before the placeholder when true

This preserves position even when elements are removed.

### Sibling Rules

`$else-if` and `$else` must be immediate siblings:

```html
<!-- ✅ Correct -->
<div $if="{a}">A</div>
<div $else-if="{b}">B</div>
<div $else>C</div>

<!-- ❌ Wrong: Other element breaks the chain -->
<div $if="{a}">A</div>
<p>Some text</p>
<!-- This breaks the chain! -->
<div $else>C</div>
<!-- Won't work as expected -->
```

---

← [Directives Overview](./06-directives.md) | [List Rendering](./08-loops.md) →

[Back to Index](./README.md)
