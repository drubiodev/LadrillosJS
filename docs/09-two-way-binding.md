# Two-Way Binding

The `$bind` directive creates two-way data binding between form elements and your state.

## Basic Usage

```html
<input type="text" $bind="username" />
<p>Hello, {username}!</p>

<script>
  let username = "";
</script>
```

When you type in the input, `username` updates automatically. When `username` changes in script, the input updates too.

---

## Supported Elements

### Text Input

```html
<input type="text" $bind="name" />
<input type="email" $bind="email" />
<input type="password" $bind="password" />
<input type="url" $bind="website" />
<input type="tel" $bind="phone" />
<input type="search" $bind="searchQuery" />
```

### Number Input

```html
<input type="number" $bind="age" />
<input type="range" $bind="volume" min="0" max="100" />

<script>
  let age = 25;
  let volume = 50;
</script>
```

### Textarea

```html
<textarea $bind="message" rows="4"></textarea>

<script>
  let message = "";
</script>
```

### Checkbox

```html
<label>
  <input type="checkbox" $bind="isSubscribed" />
  Subscribe to newsletter
</label>

<script>
  let isSubscribed = false;
</script>
```

### Radio Buttons

```html
<div>
  <label>
    <input type="radio" name="size" value="small" $bind="selectedSize" />
    Small
  </label>
  <label>
    <input type="radio" name="size" value="medium" $bind="selectedSize" />
    Medium
  </label>
  <label>
    <input type="radio" name="size" value="large" $bind="selectedSize" />
    Large
  </label>
</div>
<p>Selected: {selectedSize}</p>

<script>
  let selectedSize = "medium";
</script>
```

### Select Dropdown

```html
<select $bind="selectedCountry">
  <option value="">Select a country...</option>
  <option value="us">United States</option>
  <option value="uk">United Kingdom</option>
  <option value="ca">Canada</option>
</select>

<script>
  let selectedCountry = "";
</script>
```

### Content Editable

```html
<div contenteditable $bind="richContent" class="editor">Click to edit...</div>

<script>
  let richContent = "Click to edit...";
</script>
```

---

## Object Properties

Bind to nested properties:

```html
<input type="text" $bind="user.name" />
<input type="email" $bind="user.email" />
<input type="text" $bind="user.address.city" />

<script>
  let user = {
    name: "",
    email: "",
    address: {
      city: "",
      country: "",
    },
  };
</script>
```

---

## Inside a Loop

`$bind` works on elements rendered by `<for>`. Bind a **property of the row's
item** — that property lives on the object in the array, so the edit lands on
your data:

```html
<for each="todo in todos" key="todo.id">
  <li>
    <input type="checkbox" $bind="todo.done" />
    <input type="text" $bind="todo.text" />
  </li>
</for>

<p>{todos.filter((t) => t.done).length} of {todos.length} done</p>

<script>
  let todos = [
    { id: 1, text: "Write docs", done: false },
    { id: 2, text: "Ship it", done: false },
  ];
</script>
```

Component state variables also work inside a row, but they are shared by every
row — all of them read and write the same value.

### You cannot bind the row variable itself

```html
<for each="name in names">
  <!-- ✗ rejected: reports an error and does nothing -->
  <input type="text" $bind="name" />
</for>
```

The row variable is a per-iteration binding, so there is nowhere to write an
edit back to. Bind a property of it instead, or restructure the array into
objects:

```html
<for each="entry in names">
  <input type="text" $bind="entry.value" />
</for>

<script>
  let names = [{ value: "Ada" }, { value: "Grace" }];
</script>
```

> Other frameworks land in the same place. Svelte allowed binding the each-block
> variable in its legacy mode, found it "buggy and unpredictable", and made it a
> compile error in runes mode — recommending `bind:value={array[i]}` instead.

### Use a key when rows contain inputs

Without `key`, `<for>` reuses row elements by position: after a reorder, each
input is re-pointed at whichever item now sits at its index, so focus and
caret stay with the position rather than following the item the user was
editing. `key="todo.id"` ties a row to its item, so reordering moves the whole
row — input state included.

---

## Complete Form Example

```html
<form $on:submit.prevent="handleSubmit()">
  <div class="form-group">
    <label>Username:</label>
    <input type="text" $bind="form.username" required />
  </div>

  <div class="form-group">
    <label>Email:</label>
    <input type="email" $bind="form.email" required />
  </div>

  <div class="form-group">
    <label>Password:</label>
    <input type="password" $bind="form.password" required />
  </div>

  <div class="form-group">
    <label>Bio:</label>
    <textarea $bind="form.bio"></textarea>
  </div>

  <div class="form-group">
    <label>Country:</label>
    <select $bind="form.country">
      <option value="">Select...</option>
      <option value="us">United States</option>
      <option value="uk">United Kingdom</option>
    </select>
  </div>

  <div class="form-group">
    <label>
      <input type="checkbox" $bind="form.agreeToTerms" />
      I agree to the terms
    </label>
  </div>

  <button type="submit" disabled="{!form.agreeToTerms}">Submit</button>
</form>

<script>
  let form = {
    username: "",
    email: "",
    password: "",
    bio: "",
    country: "",
    agreeToTerms: false,
  };

  function handleSubmit() {
    console.log("Form submitted:", form);
    // Send to API, etc.
  }
</script>
```

---

## Live Preview Pattern

```html
<div class="editor">
  <div class="input-side">
    <input type="text" $bind="title" placeholder="Title" />
    <textarea $bind="content" placeholder="Content"></textarea>
    <select $bind="theme">
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </div>

  <div class="preview-side" class="{theme}">
    <h1>{title || 'Untitled'}</h1>
    <p>{content || 'Start typing...'}</p>
  </div>
</div>

<script>
  let title = "";
  let content = "";
  let theme = "light";
</script>
```

---

## Validation Pattern

```html
<div class="form-group">
  <input
    type="email"
    $bind="email"
    $on:blur="validateEmail()"
    class="{emailError ? 'error' : ''}"
  />
  <if condition="emailError"><span class="error-message">{emailError}</span></if>
</div>

<script>
  let email = "";
  let emailError = "";

  function validateEmail() {
    if (!email) {
      emailError = "Email is required";
    } else if (!email.includes("@")) {
      emailError = "Invalid email format";
    } else {
      emailError = "";
    }
  }
</script>
```

---

## How It Works

Under the hood, `$bind` does two things:

1. **Listens for input events** to update state
2. **Watches state** to update the input value

It's equivalent to:

```html
<!-- $bind="username" is equivalent to: -->
<input type="text" value="{username}" oninput="username = this.value" />
```

But `$bind` is:

- More concise
- Handles different input types automatically
- Supports nested properties
- Works with contenteditable

---

## Event Timing

`$bind` uses different events based on element type:

| Element                   | Event    |
| ------------------------- | -------- |
| `<input type="text">`     | `input`  |
| `<input type="checkbox">` | `change` |
| `<input type="radio">`    | `change` |
| `<select>`                | `change` |
| `<textarea>`              | `input`  |
| `contenteditable`         | `input`  |

---

## Common Patterns

### Search with Debounce

```html
<input type="text" $bind="searchQuery" $on:input="debouncedSearch()" />

<script>
  let searchQuery = "";
  let debounceTimer;

  function debouncedSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
  }

  function performSearch(query) {
    console.log("Searching for:", query);
  }
</script>
```

### Character Counter

```html
<div class="textarea-wrapper">
  <textarea $bind="message" maxlength="280"></textarea>
  <span class="counter">{message.length}/280</span>
</div>

<script>
  let message = "";
</script>
```

### Confirm Password

```html
<input type="password" $bind="password" placeholder="Password" />
<input type="password" $bind="confirmPassword" placeholder="Confirm Password" />
<if condition="confirmPassword && password !== confirmPassword">
  <p class="error">Passwords don't match</p>
</if>

<script>
  let password = "";
  let confirmPassword = "";
</script>
```

---

← [List Rendering](./08-loops.md) | [Element References](./10-refs.md) →

[Back to Index](./README.md)
