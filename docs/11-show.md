# Visibility Toggle ($show)

The `$show` directive toggles element visibility using CSS `display: none`.

## Basic Usage

```html
<button onclick="isVisible = !isVisible">Toggle</button>

<div $show="{isVisible}">This content can be hidden!</div>

<script>
  let isVisible = true;
</script>
```

---

## How It Works

When the expression is:

- **Truthy**: Element is visible (normal display)
- **Falsy**: Element has `display: none` applied

Unlike `$if`, the element **stays in the DOM**. Only its CSS changes.

```html
<!-- When isVisible is false, this becomes: -->
<div $show="{isVisible}" style="display: none;">Hidden content</div>
```

---

## `$show` vs `$if`

| Feature            | `$show`                     | `$if`                   |
| ------------------ | --------------------------- | ----------------------- |
| How it hides       | CSS `display: none`         | Removes from DOM        |
| Element in DOM     | Always                      | Only when true          |
| State preservation | ✅ Preserved                | ❌ Lost when hidden     |
| Event listeners    | ✅ Preserved                | ❌ Recreated            |
| Performance        | Better for frequent toggles | Better for rare changes |

### Use `$show` When:

- Toggling frequently (menus, tooltips)
- Need to preserve input values
- Need to preserve scroll position
- Animation/transition on hide/show

### Use `$if` When:

- Content is rarely shown
- Large DOM subtrees
- Content has expensive initialization
- Security-sensitive content that shouldn't be in DOM

---

## Common Patterns

### Dropdown Menu

```html
<div class="dropdown">
  <button onclick="isOpen = !isOpen">Menu {isOpen ? '▲' : '▼'}</button>

  <nav $show="{isOpen}" class="dropdown-menu">
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/contact">Contact</a>
  </nav>
</div>

<script>
  let isOpen = false;
</script>
```

### Tab Content

```html
<div class="tabs">
  <button
    onclick="activeTab = 'one'"
    class="{activeTab === 'one' ? 'active' : ''}"
  >
    Tab 1
  </button>
  <button
    onclick="activeTab = 'two'"
    class="{activeTab === 'two' ? 'active' : ''}"
  >
    Tab 2
  </button>
  <button
    onclick="activeTab = 'three'"
    class="{activeTab === 'three' ? 'active' : ''}"
  >
    Tab 3
  </button>
</div>

<div $show="{activeTab === 'one'}" class="tab-panel">Content for Tab 1</div>
<div $show="{activeTab === 'two'}" class="tab-panel">Content for Tab 2</div>
<div $show="{activeTab === 'three'}" class="tab-panel">Content for Tab 3</div>

<script>
  let activeTab = "one";
</script>
```

### Form Sections

```html
<form>
  <label>
    <input type="checkbox" $bind="showAdvanced" />
    Show advanced options
  </label>

  <div $show="{showAdvanced}" class="advanced-options">
    <label>
      Cache TTL:
      <input type="number" $bind="cacheTTL" />
    </label>
    <label>
      Max Connections:
      <input type="number" $bind="maxConnections" />
    </label>
  </div>
</form>

<script>
  let showAdvanced = false;
  let cacheTTL = 3600;
  let maxConnections = 10;
</script>
```

### Loading Overlay

```html
<div class="container">
  <div class="content">Main content here...</div>

  <div $show="{isLoading}" class="loading-overlay">
    <div class="spinner"></div>
    <p>Loading...</p>
  </div>
</div>

<script>
  let isLoading = false;

  async function fetchData() {
    isLoading = true;
    try {
      await fetch("/api/data");
    } finally {
      isLoading = false;
    }
  }
</script>

<style>
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
</style>
```

---

## Expressions

Use any JavaScript expression:

```html
<!-- Boolean -->
<div $show="{isVisible}">...</div>

<!-- Comparison -->
<div $show="{count > 0}">Has items</div>

<!-- Equality -->
<div $show="{status === 'active'}">Active</div>

<!-- Logical -->
<div $show="{isLoggedIn && hasPermission}">...</div>

<!-- Negation -->
<div $show="{!isHidden}">...</div>

<!-- Truthy check -->
<div $show="{items.length}">Has {items.length} items</div>
```

---

## Preserving Original Display

`$show` remembers the original `display` value:

```html
<span $show="{isVisible}" style="display: inline-block;">
  Inline block element
</span>

<script>
  let isVisible = true;

  // When hidden: display: none
  // When shown: display: inline-block (restored)
</script>
```

---

## Animations with $show

Since `$show` uses CSS, you can add transitions:

```html
<div $show="{isVisible}" class="fade-box">Animated content</div>

<style>
  .fade-box {
    transition: opacity 0.3s ease;
    opacity: 1;
  }

  /* Note: This doesn't work directly because display:none
     happens immediately. For animations, consider CSS classes
     or the $if approach with animation libraries */
</style>
```

For true enter/leave animations, you may need to:

1. Use CSS classes with `$if` and animation delay
2. Use a JavaScript animation library
3. Control visibility manually with CSS classes

```html
<!-- Manual animation approach -->
<div class="modal {isOpen ? 'visible' : 'hidden'}">Modal content</div>

<style>
  .modal {
    transition: opacity 0.3s, transform 0.3s;
  }
  .modal.hidden {
    opacity: 0;
    transform: translateY(-10px);
    pointer-events: none;
  }
  .modal.visible {
    opacity: 1;
    transform: translateY(0);
  }
</style>
```

---

← [Element References](./10-refs.md) | [Event Bus](./12-event-bus.md) →

[Back to Index](./README.md)
