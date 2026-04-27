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
