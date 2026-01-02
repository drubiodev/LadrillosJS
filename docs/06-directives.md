# Directives Overview

Directives are special attributes that control how elements are rendered. They start with `$` and provide powerful declarative capabilities.

## Available Directives

| Directive                          | Purpose               | Example                                    |
| ---------------------------------- | --------------------- | ------------------------------------------ |
| [`$for`](./08-loops.md)            | Loop rendering        | `<li $for="item in items">`                |
| [`$if`](./07-conditionals.md)      | Conditional rendering | `<div $if="{isVisible}">`                  |
| [`$else-if`](./07-conditionals.md) | Chained condition     | `<div $else-if="{condition}">`             |
| [`$else`](./07-conditionals.md)    | Fallback              | `<div $else>`                              |
| [`$show`](./11-show.md)            | CSS visibility toggle | `<div $show="{isOpen}">`                   |
| [`$bind`](./09-two-way-binding.md) | Two-way data binding  | `<input $bind="name">`                     |
| [`$ref`](./10-refs.md)             | Element reference     | `<input $ref="inputEl">`                   |
| `$key`                             | Loop optimization     | `<li $for="item in items" $key="item.id">` |
| `$no:bind`                         | Escape binding syntax | `<code $no:bind>{literal}`                 |

---

## Quick Examples

### Conditional Rendering (`$if`, `$else-if`, `$else`)

```html
<div $if="{status === 'loading'}">Loading...</div>
<div $else-if="{status === 'error'}">Error occurred!</div>
<div $else>Content loaded!</div>
```

[Full documentation →](./07-conditionals.md)

### List Rendering (`$for`)

```html
<!-- Simple loop -->
<li $for="item in items">{item}</li>

<!-- With index -->
<li $for="(item, index) in items">#{index + 1}: {item}</li>

<!-- Object array -->
<div $for="user in users" $key="user.id">
  <span>{user.name}</span>
</div>
```

[Full documentation →](./08-loops.md)

### Two-Way Binding (`$bind`)

```html
<input type="text" $bind="username" />
<textarea $bind="message"></textarea>
<select $bind="selectedOption">
  <option value="a">Option A</option>
  <option value="b">Option B</option>
</select>
<input type="checkbox" $bind="isChecked" />
```

[Full documentation →](./09-two-way-binding.md)

### Element References (`$ref`)

```html
<input type="text" $ref="inputEl" />
<canvas $ref="canvas"></canvas>

<button onclick="$refs.inputEl.focus()">Focus Input</button>
```

[Full documentation →](./10-refs.md)

### Visibility Toggle (`$show`)

```html
<div $show="{isMenuOpen}">Menu contents...</div>
```

[Full documentation →](./11-show.md)

---

## Directive Syntax

### Expressions in Directives

Directives that evaluate expressions use curly braces:

```html
<!-- Condition must be in braces -->
<div $if="{user.isAdmin}">Admin Panel</div>
<div $show="{count > 0}">Has items</div>
```

### Loop Expressions

The `$for` directive has a special syntax without braces:

```html
<!-- item in arrayName -->
<li $for="item in items">{item}</li>

<!-- (item, index) in arrayName -->
<li $for="(item, index) in items">#{index}: {item}</li>
```

### Binding Paths

The `$bind` directive uses a variable path without braces:

```html
<!-- Simple variable -->
<input $bind="username" />

<!-- Object property -->
<input $bind="user.email" />

<!-- Nested property -->
<input $bind="config.settings.theme" />
```

---

## Processing Order

When a component renders, directives are processed in this order:

1. **`$ref`** - Element references collected first
2. **`$for`** - Loops expanded
3. **`$if`/`$else-if`/`$else`** - Conditionals evaluated
4. **`$show`** - Visibility applied
5. **`$bind`** - Two-way bindings connected

This order matters because:

- Refs are available in script before other directives run
- Loops expand elements before conditionals hide them
- Bindings connect after structure is finalized

---

## Combining Directives

You can use multiple directives on the same element:

```html
<!-- Loop with key -->
<div $for="user in users" $key="user.id">{user.name}</div>

<!-- Conditional inside loop (on different elements) -->
<div $for="item in items">
  <span $if="{item.isSpecial}">⭐</span>
  {item.name}
</div>
```

### ⚠️ Restrictions

Don't combine `$for` with `$if` on the same element:

```html
<!-- ❌ Don't do this -->
<li $for="item in items" $if="{item.active}">{item.name}</li>

<!-- ✅ Do this instead -->
<li $for="item in items">
  <span $if="{item.active}">{item.name}</span>
</li>

<!-- ✅ Or filter in script -->
<li $for="item in activeItems">{item.name}</li>

<script>
  let items = [...];
  let activeItems = items.filter(i => i.active);
</script>
```

---

## Directive vs Binding

| Feature  | Directive              | Binding                 |
| -------- | ---------------------- | ----------------------- |
| Syntax   | `$name="..."`          | `{expression}`          |
| Purpose  | Control structure      | Display values          |
| Examples | `$if`, `$for`, `$bind` | `{name}`, `{count * 2}` |

Directives control **what** renders. Bindings control **what values** are displayed.

```html
<!-- Directive controls structure -->
<div $if="{showDetails}">
  <!-- Binding displays values -->
  <p>Name: {user.name}</p>
  <p>Email: {user.email}</p>
</div>
```

---

← [Template Bindings](./05-template-bindings.md) | [Conditional Rendering](./07-conditionals.md) →

[Back to Index](./README.md)
