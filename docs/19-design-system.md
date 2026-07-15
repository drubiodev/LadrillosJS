# Creating a Design System

A **design system** is a small set of reusable, on-brand UI components built on
top of shared **design tokens** (colors, spacing, radius, typography). With
LadrillosJS you can build one in a few `.html` files — no build step, no
dependencies.

This guide walks you through it from start to finish:

1. [Define your design tokens](#step-1-define-your-design-tokens)
2. [Build a token-driven component](#step-2-build-a-token-driven-component)
3. [Register and use it](#step-3-register-and-use-it)
4. [Add variants and sizes](#step-4-add-variants-and-sizes)
5. [Add props and states](#step-5-add-props-and-states)
6. [Add flexible content with slots](#step-6-add-content-with-slots)
7. [Theme it (light/dark)](#step-7-theme-it-lightdark)

By the end you'll have a themeable `Button` you can copy as a template for every
other component.

> **The one big idea:** tokens are the single source of truth. Components never
> hard-code colors or spacing — they read tokens. Changing a token restyles the
> whole system at once.

---

## Step 1: Define your design tokens

Tokens are just **CSS custom properties** declared once on `:root`. Because
custom properties are *inherited*, they flow into every component — even through
Shadow DOM. That's what makes one file able to theme your entire system.

Create `tokens.css`:

```css
:root {
  /* Color */
  --ds-primary: #1877f2;
  --ds-primary-hover: #166fe0;
  --ds-surface: #e4e6eb;
  --ds-surface-hover: #d8dade;
  --ds-text: #1c1e21;
  --ds-text-on-primary: #ffffff;

  /* Shape, space, type */
  --ds-radius: 8px;
  --ds-pad-y: 0.5rem;
  --ds-pad-x: 0.875rem;
  --ds-font: 600 0.875rem/1 system-ui, -apple-system, sans-serif;
}
```

Load it once in your page `<head>`:

```html
<link rel="stylesheet" href="./tokens.css" />
```

That's your whole foundation. Every component below reads from these names.

---

## Step 2: Build a token-driven component

Create `button.html`. Notice it never hard-codes a color — every visual value
points at a token:

```html
<button class="btn" type="{type}">
  <span class="btn__label">{label}</span>
</button>

<script>
  const label = "Button";
  const type = "button";
</script>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font: var(--ds-font);
    padding: var(--ds-pad-y) var(--ds-pad-x);
    border: none;
    border-radius: var(--ds-radius);
    background: var(--ds-surface);
    color: var(--ds-text);
    cursor: pointer;
  }

  .btn:hover {
    background: var(--ds-surface-hover);
  }
</style>
```

---

## Step 3: Register and use it

Register the component, then use it like any HTML tag:

```html
<script type="module">
  import { registerComponent } from "ladrillosjs";

  registerComponent("ds-button", "./button.html");
</script>

<ds-button label="Save"></ds-button>
```

You now have a reusable, on-brand button. The rest of the guide makes it
flexible.

---

## Step 4: Add variants and sizes

A **variant** is just a class that re-points a couple of tokens. This is the
pattern that makes a design system scale: adding a new look is *one small CSS
block*, and nothing else changes.

Bind a `variant` and `size` into the class, then define one block per option:

```html
<button class="btn btn--{variant} btn--{size}" type="{type}">
  <span class="btn__label">{label}</span>
</button>

<script>
  const label = "Button";
  const type = "button";
  const variant = "primary"; // primary | secondary
  const size = "md"; // sm | md | lg
</script>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font: var(--ds-font);
    /* read from local tokens, with the global token as the fallback */
    font-size: var(--btn-font-size, 0.875rem);
    padding: var(--btn-pad-y, var(--ds-pad-y)) var(--btn-pad-x, var(--ds-pad-x));
    border: none;
    border-radius: var(--ds-radius);
    background: var(--btn-bg);
    color: var(--btn-fg);
    cursor: pointer;
  }

  /* Variants: each re-points just two tokens */
  .btn--primary {
    --btn-bg: var(--ds-primary);
    --btn-fg: var(--ds-text-on-primary);
  }
  .btn--primary:hover {
    --btn-bg: var(--ds-primary-hover);
  }
  .btn--secondary {
    --btn-bg: var(--ds-surface);
    --btn-fg: var(--ds-text);
  }
  .btn--secondary:hover {
    --btn-bg: var(--ds-surface-hover);
  }

  /* Sizes: re-point the size tokens */
  .btn--sm {
    --btn-pad-y: 0.375rem;
    --btn-pad-x: 0.625rem;
    --btn-font-size: 0.8125rem;
  }
  .btn--lg {
    --btn-pad-y: 0.6875rem;
    --btn-pad-x: 1.125rem;
    --btn-font-size: 1rem;
  }
</style>
```

Use them:

```html
<ds-button label="Primary" variant="primary"></ds-button>
<ds-button label="Secondary" variant="secondary"></ds-button>
<ds-button label="Large" variant="primary" size="lg"></ds-button>
```

> **Why the fallback pattern?** `var(--btn-pad-y, var(--ds-pad-y))` means
> "use the size override if present, otherwise the global default." A button
> with no `size` just uses your tokens.

---

## Step 5: Add props and states

Props come in as **attributes**. A couple of rules keep them predictable:

- **Multi-word / boolean props use kebab-case attributes.** HTML lowercases
  attribute names, so `isDisabled` can never match. Write `is-disabled` in
  markup and LadrillosJS maps it to the `isDisabled` prop automatically.
- **Boolean attributes toggle by presence.** Binding a boolean to a real HTML
  boolean attribute (`disabled`) adds it when truthy and removes it when falsy.

```html
<button
  class="btn btn--{variant} btn--{size}{isDisabled ? ' btn--disabled' : ''}"
  type="{type}"
  disabled="{isDisabled}"
  aria-label="{label}"
>
  <span class="btn__label">{label}</span>
</button>

<script>
  const label = "Button";
  const type = "button";
  const variant = "primary";
  const size = "md";
  const isDisabled = false; // toggled via the `is-disabled` attribute
</script>

<style>
  /* ...variant/size styles from Step 4... */
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
```

Use it:

```html
<ds-button label="Disabled" variant="primary" is-disabled></ds-button>
```

> **Good to know:** when an expression evaluates to `null`/`undefined`, the
> attribute is left off entirely. Default optional props to `null` (e.g.
> `const tooltip = null;`) so unused attributes don't render as empty strings.

---

## Step 6: Add content with slots

Use native `<slot>` elements for flexible content like icons. Add
`slot { display: contents; }` so an empty slot adds no layout — no stray gaps.

```html
<button class="btn btn--{variant}" type="{type}">
  <slot name="icon"></slot>
  <span class="btn__label">{label}</span>
</button>

<style>
  slot {
    display: contents;
  }
  /* ...rest of styles... */
</style>
```

Consumers project content by slot name:

```html
<ds-button label="Save" variant="primary">
  <span slot="icon">💾</span>
</ds-button>
```

---

## Step 7: Theme it (light/dark)

Because every component reads tokens, theming is just **re-declaring tokens**.
No component changes are needed. Add a dark theme by overriding the tokens under
a selector:

```css
/* tokens.css */
:root {
  --ds-primary: #1877f2;
  --ds-surface: #e4e6eb;
  --ds-text: #1c1e21;
  /* ...etc... */
}

[data-theme="dark"] {
  --ds-primary: #4599ff;
  --ds-surface: #3a3b3c;
  --ds-surface-hover: #4e4f50;
  --ds-text: #e4e6eb;
}
```

Flip the whole UI with one attribute on the page:

```html
<html data-theme="dark">
  <!-- every ds-* component re-themes instantly -->
</html>
```

You can flip it at runtime too:

```html
<ds-button label="Toggle theme" onclick="
  document.documentElement.dataset.theme =
    document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
"></ds-button>
```

---

## Putting it all together

A complete, themeable button in one file:

```html
<button
  class="btn btn--{variant} btn--{size}"
  type="{type}"
  disabled="{isDisabled}"
  aria-label="{label}"
>
  <slot name="icon"></slot>
  <span class="btn__label">{label}</span>
</button>

<script>
  const label = "Button";
  const variant = "primary"; // primary | secondary
  const size = "md"; // sm | md | lg
  const type = "button";
  const isDisabled = false;
</script>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font: var(--ds-font);
    font-size: var(--btn-font-size, 0.875rem);
    padding: var(--btn-pad-y, var(--ds-pad-y)) var(--btn-pad-x, var(--ds-pad-x));
    border: none;
    border-radius: var(--ds-radius);
    background: var(--btn-bg);
    color: var(--btn-fg);
    cursor: pointer;
  }
  slot {
    display: contents;
  }
  .btn:hover {
    background: var(--btn-bg-hover, var(--btn-bg));
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn--primary {
    --btn-bg: var(--ds-primary);
    --btn-bg-hover: var(--ds-primary-hover);
    --btn-fg: var(--ds-text-on-primary);
  }
  .btn--secondary {
    --btn-bg: var(--ds-surface);
    --btn-bg-hover: var(--ds-surface-hover);
    --btn-fg: var(--ds-text);
  }

  .btn--sm {
    --btn-pad-y: 0.375rem;
    --btn-pad-x: 0.625rem;
    --btn-font-size: 0.8125rem;
  }
  .btn--lg {
    --btn-pad-y: 0.6875rem;
    --btn-pad-x: 1.125rem;
    --btn-font-size: 1rem;
  }
</style>
```

---

## Best Practices

1. **Tokens first.** Define colors, spacing, radius, and type as `:root` custom
   properties. Components read tokens — never hard-coded values.
2. **Variants re-point tokens.** Each variant/size is one small CSS block that
   sets local `--btn-*` tokens. Adding a new one touches nothing else.
3. **Use the fallback pattern** `var(--local, var(--global))` so unsized,
   unstyled usage falls back to your global tokens.
4. **kebab-case attributes** for multi-word props (`is-disabled` → `isDisabled`).
5. **Default optional props to `null`** so unused attributes are omitted.
6. **Use `<slot>` with `slot { display: contents; }`** for flexible content.
7. **Theme by overriding tokens**, not by editing components.
8. **Copy the button as a template** for your next component (Card, Input,
   Badge). Same recipe every time.

---

## Next Steps

- Build a second component (Input or Card) using the same token recipe.
- Read [Shadow DOM](./14-shadow-dom.md) to learn about `::slotted` and `part`
  for deeper styling hooks.
- Read [Template Bindings](./05-template-bindings.md) for everything you can put
  inside `{ }`.
- Read [Components](./03-components.md) for props, registration, and structure.

---

← [TypeScript](./18-typescript.md)

[Back to Index](./README.md)
