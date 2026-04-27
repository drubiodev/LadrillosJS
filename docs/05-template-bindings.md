# Template Bindings

Template bindings connect your JavaScript state to the DOM. Use `{expression}` syntax to display dynamic data.

## Basic Syntax

Wrap any JavaScript expression in curly braces:

```html
<div>
  <!-- Simple variable -->
  <p>{message}</p>

  <!-- Number -->
  <p>Count: {count}</p>

  <!-- Boolean (displays "true" or "false") -->
  <p>Active: {isActive}</p>
</div>

<script>
  let message = "Hello, World!";
  let count = 42;
  let isActive = true;
</script>
```

---

## Expression Types

### Variables

```html
<p>{username}</p>
<p>{email}</p>
```

### Object Properties

```html
<p>{user.name}</p>
<p>{user.address.city}</p>
<p>{config.settings.theme}</p>
```

### Array Access

```html
<p>First item: {items[0]}</p>
<p>Last item: {items[items.length - 1]}</p>
```

### Arithmetic

```html
<p>Double: {count * 2}</p>
<p>Plus ten: {count + 10}</p>
<p>Percentage: {(score / total) * 100}%</p>
```

### String Concatenation

```html
<p>{"Hello, " + name + "!"}</p>
<p>{firstName + " " + lastName}</p>
```

### Template Literals

```html
<p>{`Welcome, ${name}!`}</p>
<p>{`Total: $${price.toFixed(2)}`}</p>
```

### Ternary Operator

```html
<p>{isLoggedIn ? "Welcome back!" : "Please log in"}</p>
<p>{count > 0 ? count : "No items"}</p>
<p>{status === 'active' ? '🟢' : '🔴'}</p>
```

### Logical Operators

```html
<p>{name || "Anonymous"}</p>
<p>{user && user.name}</p>
<p>{isAdmin && "Admin Panel"}</p>
```

### Function Calls

```html
<p>{formatDate(createdAt)}</p>
<p>{calculateTotal(items)}</p>
<p>{greet(user.name)}</p>

<script>
  function formatDate(date) {
    return new Date(date).toLocaleDateString();
  }

  function calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price, 0);
  }

  function greet(name) {
    return `Hello, ${name}!`;
  }
</script>
```

### Method Calls

```html
<p>{message.toUpperCase()}</p>
<p>{items.length}</p>
<p>{price.toFixed(2)}</p>
<p>{items.join(", ")}</p>
```

---

## Attribute Bindings

Bindings work in attributes too:

```html
<!-- Class binding -->
<div class="card {isActive ? 'active' : ''}">
  <!-- Style binding -->
  <div style="color: {textColor}; background: {bgColor}">
    <!-- Src binding -->
    <img src="{user.avatarUrl}" alt="{user.name}" />

    <!-- Href binding -->
    <a href="/users/{user.id}">View Profile</a>

    <!-- Data attributes -->
    <div data-id="{item.id}" data-status="{item.status}"></div>
  </div>
</div>
```

### Dynamic Styles

```html
<div
  style="
  background: {backgroundColor};
  color: {textColor};
  padding: {padding}px;
  opacity: {isVisible ? 1 : 0.5}
"
></div>
```

### Dynamic Classes

```html
<!-- String concatenation -->
<div class="btn {variant} {size}">
  <!-- Ternary for conditional class -->
  <div
    class="item {isSelected ? 'selected' : ''} {isDisabled ? 'disabled' : ''}"
  ></div>
</div>
```

---

## Escaping Bindings

To display literal `{text}` without binding, use the `$no:bind` attribute:

```html
<!-- This will render as literal text: {name} -->
<code $no:bind>{name}</code>

<!-- Useful for documentation -->
<pre $no:bind>
  Use {variable} for data binding.
  Example: {user.name}
</pre>
```

---

## Binding Performance

### Fast Updates

LadrillosJS tracks which bindings depend on which state keys. When state changes, only affected bindings re-evaluate:

```html
<div>
  <p>Name: {name}</p>
  <!-- Only updates when name changes -->
  <p>Count: {count}</p>
  <!-- Only updates when count changes -->
  <p>Both: {name} - {count}</p>
  <!-- Updates when either changes -->
</div>
```

### Avoid Heavy Computations

For expensive operations, compute once in the script:

```html
<!-- ❌ Avoid: Computed on every render -->
<p>{items.filter(i => i.active).map(i => i.name).join(', ')}</p>

<!-- ✅ Better: Compute once, bind result -->
<p>{activeNames}</p>

<script>
  let items = [...];

  // Update this when items change
  let activeNames = items.filter(i => i.active).map(i => i.name).join(', ');
</script>
```

---

## Common Patterns

### Conditional Display Text

```html
<span>{items.length === 0 ? 'No items' : `${items.length} items`}</span>
<span>{user ? user.name : 'Guest'}</span>
<span>{loading ? 'Loading...' : 'Ready'}</span>
```

### Formatting

```html
<span>{new Date(timestamp).toLocaleDateString()}</span>
<span
  >{price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span
>
<span>{percentage.toFixed(1)}%</span>
```

### Pluralization

```html
<span>{count} item{count !== 1 ? 's' : ''}</span>
<span
  >{count === 0 ? 'No messages' : count === 1 ? '1 message' : `${count}
  messages`}</span
>
```

### Safe Property Access

```html
<!-- Using && for safe access -->
<span>{user && user.profile && user.profile.bio}</span>

<!-- Using optional chaining -->
<span>{user?.profile?.bio || 'No bio'}</span>
```

---

## What You CAN'T Do in Bindings

Bindings are expressions, not statements:

```html
<!-- ❌ No variable declarations -->
<p>{let x = 5}</p>

<!-- ❌ No assignments -->
<p>{count = 5}</p>

<!-- ❌ No if statements -->
<p>{if (condition) { return 'yes' }}</p>

<!-- ❌ No loops -->
<p>{for (let i = 0; i < 5; i++) {}}</p>

<!-- ✅ Use ternary instead of if -->
<p>{condition ? 'yes' : 'no'}</p>

<!-- ✅ Use the <for> built-in for loops -->
<for each="i in items"><p>{i}</p></for>
```

---

## Bindings vs Directives

| Feature | Binding `{expression}` | Directive `$directive` |
| ------- | ---------------------- | ---------------------- |
| Purpose | Display values         | Control rendering      |
| Example | `{user.name}`          | `<if condition="isVisible">` |
| Output  | Text/attribute value   | DOM manipulation       |

Use bindings for displaying data, directives for controlling structure.

---

← [Reactivity](./04-reactivity.md) | [Directives](./06-directives.md) →

[Back to Index](./README.md)
