# Shadow DOM

LadrillosJS uses Shadow DOM by default for style encapsulation. Understanding how it works helps you make the right choice for each component.

## What is Shadow DOM?

Shadow DOM creates an isolated DOM tree inside your component. Styles and DOM queries don't leak in or out.

```
┌─────────────────────────────────────────────────────────────────┐
│  Document (Light DOM)                                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  <my-component>                                             ││
│  │    ┌─────────────────────────────────────────────────────┐  ││
│  │    │  Shadow Root (Shadow DOM)                           │  ││
│  │    │  ┌─────────────────────────────────────────────────┐│  ││
│  │    │  │  <style>                                        ││  ││
│  │    │  │    /* These styles ONLY affect this component */││  ││
│  │    │  │    button { background: red; }                  ││  ││
│  │    │  │  </style>                                       ││  ││
│  │    │  │  <div class="content">...</div>                 ││  ││
│  │    │  │  <button>Click me</button>                      ││  ││
│  │    │  └─────────────────────────────────────────────────┘│  ││
│  │    └─────────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Shadow DOM vs Light DOM

### Shadow DOM (Default)

```javascript
// Shadow DOM enabled (default)
registerComponent("my-button", "./button.html");
registerComponent("my-button", "./button.html", true); // Explicit
```

**Pros:**

- ✅ Complete style isolation
- ✅ No CSS class naming conflicts
- ✅ Encapsulated DOM queries
- ✅ Clean component boundaries

**Cons:**

- ❌ Global styles don't apply
- ❌ Can't easily style from outside
- ❌ Some older tools don't support it

### Light DOM

```javascript
// Shadow DOM disabled
registerComponent("my-content", "./content.html", false);
```

**Pros:**

- ✅ Global styles apply
- ✅ Better SEO (content in document)
- ✅ Easier to style from parent
- ✅ Works with legacy tools

**Cons:**

- ❌ Styles leak in and out
- ❌ Need careful class naming
- ❌ Less encapsulation

---

## When to Use Each

### Use Shadow DOM (default) for:

- **UI components** (buttons, cards, modals)
- **Reusable widgets** (date pickers, sliders)
- **Third-party components** (to avoid style conflicts)
- **Design system components** (consistent styling)

```javascript
registerComponents([
  { name: "ui-button", path: "./button.html" }, // Shadow DOM
  { name: "ui-modal", path: "./modal.html" }, // Shadow DOM
  { name: "data-table", path: "./table.html" }, // Shadow DOM
]);
```

### Use Light DOM for:

- **SEO-critical content** (articles, landing pages)
- **When you need global styles** (typography, themes)
- **Layout components** (headers, footers)
- **When integrating with CSS frameworks** (Bootstrap, Tailwind)

```javascript
registerComponents([
  { name: "page-header", path: "./header.html", useShadowDOM: false },
  { name: "article-content", path: "./article.html", useShadowDOM: false },
  { name: "page-footer", path: "./footer.html", useShadowDOM: false },
]);
```

---

## Styling Shadow DOM Components

### Internal Styles

Styles inside the component only affect that component:

```html
<!-- button.html -->
<button class="btn">{label}</button>

<script>
  let label = "Click me";
</script>

<style>
  /* Only affects THIS component's button */
  .btn {
    background: #007bff;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
  }

  .btn:hover {
    background: #0056b3;
  }
</style>
```

### Using :host

Style the component's host element:

```html
<style>
  /* The component element itself */
  :host {
    display: block;
    margin: 10px 0;
  }

  /* When component has a class */
  :host(.highlighted) {
    border: 2px solid gold;
  }

  /* When component has an attribute */
  :host([disabled]) {
    opacity: 0.5;
    pointer-events: none;
  }

  /* Based on context */
  :host-context(.dark-theme) {
    background: #333;
    color: white;
  }
</style>
```

Usage:

```html
<my-component class="highlighted"></my-component>
<my-component disabled></my-component>

<div class="dark-theme">
  <my-component></my-component>
</div>
```

### CSS Custom Properties (Theming)

CSS variables pierce the Shadow DOM:

```html
<!-- In your component -->
<style>
  .card {
    background: var(--card-bg, white);
    color: var(--card-text, black);
    border: 1px solid var(--card-border, #ddd);
    border-radius: var(--card-radius, 8px);
  }
</style>
```

```css
/* In your global CSS */
:root {
  --card-bg: #f5f5f5;
  --card-text: #333;
  --card-border: #ccc;
  --card-radius: 12px;
}

/* Dark theme */
.dark-theme {
  --card-bg: #222;
  --card-text: #eee;
  --card-border: #444;
}
```

### ::part() for External Styling

Expose parts of your component for external styling:

```html
<!-- button.html -->
<button part="button" class="btn">
  <span part="icon"><slot name="icon"></slot></span>
  <span part="label"><slot></slot></span>
</button>

<style>
  /* Default internal styles */
  .btn {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
```

```css
/* External CSS can target parts */
my-button::part(button) {
  background: purple;
}

my-button::part(icon) {
  font-size: 1.5em;
}

my-button::part(label) {
  text-transform: uppercase;
}
```

---

## Slots (Content Projection)

### Default Slot

```html
<!-- card.html -->
<div class="card">
  <slot></slot>
  <!-- Content goes here -->
</div>

<style>
  .card {
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
  }
</style>
```

```html
<!-- Usage -->
<my-card>
  <h2>Card Title</h2>
  <p>Card content goes here.</p>
</my-card>
```

### Named Slots

```html
<!-- card.html -->
<div class="card">
  <header class="card-header">
    <slot name="header">Default Header</slot>
  </header>
  <div class="card-body">
    <slot></slot>
    <!-- Default slot -->
  </div>
  <footer class="card-footer">
    <slot name="footer"></slot>
  </footer>
</div>
```

```html
<!-- Usage -->
<my-card>
  <h2 slot="header">Custom Header</h2>
  <p>This goes in the default slot (body).</p>
  <button slot="footer">Action</button>
</my-card>
```

### Styling Slotted Content

```html
<style>
  /* Style the slot container */
  .card-header {
    border-bottom: 1px solid #ddd;
    padding-bottom: 10px;
  }

  /* Style slotted elements */
  ::slotted(h2) {
    margin: 0;
    color: #333;
  }

  ::slotted(p) {
    color: #666;
  }

  /* Note: ::slotted only works for direct children */
  ::slotted(*) {
    margin-bottom: 10px;
  }
</style>
```

---

## Accessing Shadow DOM

### From Inside

```html
<script>
  // $host refers to the component element
  // The shadow root is at $host.shadowRoot

  // But typically you use $refs:
  $refs.myElement.style.color = "red";
</script>
```

### From Outside

```javascript
const component = document.querySelector("my-component");

// Access shadow root
const shadowRoot = component.shadowRoot;

// Query inside shadow DOM
const button = shadowRoot.querySelector("button");
```

---

## Light DOM Considerations

When using Light DOM (`useShadowDOM: false`):

### Styles Can Leak

```html
<!-- component.html (light DOM) -->
<button class="btn">Click</button>

<style>
  /* ⚠️ This affects ALL buttons on the page! */
  button {
    background: red;
  }

  /* ✅ Scope with specific classes */
  .my-component-btn {
    background: red;
  }
</style>
```

### Global Styles Apply

```css
/* global.css */
button {
  font-family: system-ui;
}

/* This WILL affect light DOM components */
```

### BEM or Scoped Classes

Use naming conventions to avoid conflicts:

```html
<!-- Use BEM naming -->
<div class="user-card">
  <img class="user-card__avatar" src="{avatar}" />
  <span class="user-card__name">{name}</span>
  <span class="user-card__role user-card__role--admin">{role}</span>
</div>

<style>
  .user-card {
    ...;
  }
  .user-card__avatar {
    ...;
  }
  .user-card__name {
    ...;
  }
  .user-card__role {
    ...;
  }
  .user-card__role--admin {
    ...;
  }
</style>
```

---

## Best Practices

1. **Default to Shadow DOM** for encapsulation
2. **Use Light DOM** when you need global styles or SEO
3. **Use CSS custom properties** for theming
4. **Expose `part` attributes** for customizable styling
5. **Use slots** for flexible content composition
6. **Prefix classes** when using Light DOM

---

← [Lazy Loading](./13-lazy-loading.md) | [Component Lifecycle](./15-lifecycle.md) →

[Back to Index](./README.md)
