# Visibility Toggle (`<show>`)

The `<show>` built-in element toggles visibility using CSS `display`. Unlike
`<if>`, the children stay in the DOM — only their `display` flips between
`contents` (visible) and `none` (hidden).

## Basic Usage

```html
<button onclick="isVisible = !isVisible">Toggle</button>

<show condition="isVisible">
  <p>This content can be hidden!</p>
</show>

<script>
  let isVisible = true;
</script>
```

---

## How It Works

When `condition` is:

- **Truthy** — the `<show>` element gets `display: contents` (children render
  in place, no wrapper box).
- **Falsy** — the `<show>` element gets `display: none` (children stay in the
  DOM but are not rendered).

```html
<!-- When isVisible is false: -->
<show condition="isVisible" style="display: none;">
  <p>Hidden content</p>
</show>
```

Because the children stay attached, all DOM state (input values, focus,
scroll position, event listeners, child component state) is **preserved**
across toggles.

---

## `<show>` vs `<if>`

| Feature            | `<show>`                    | `<if>`                  |
| ------------------ | --------------------------- | ----------------------- |
| How it hides       | CSS `display: none`         | Removes children        |
| Children in DOM    | Always                      | Only when true          |
| State preservation | ✅ Preserved                | ❌ Lost when hidden     |
| Event listeners    | ✅ Preserved                | ❌ Recreated on remount |
| Performance        | Better for frequent toggles | Better for rare changes |

### Use `<show>` when:

- Toggling frequently (menus, tooltips, dropdowns)
- You need to preserve input values
- You need to preserve scroll position
- You want CSS transitions on hide/show

### Use `<if>` when:

- Content is rarely shown
- Subtree is large or expensive to mount
- Content has expensive initialization (fetching, charts)
- Content is security-sensitive and shouldn't be in DOM at all

---

## Multiple Top-Level Children

`<show>` may contain any number of top-level children — they all toggle
together:

```html
<show condition="isOpen">
  <h3>Account settings</h3>
  <p>Manage your preferences below.</p>
  <form>…</form>
</show>
```

---

## Common Patterns

### Dropdown Menu

```html
<div class="dropdown">
  <button onclick="isOpen = !isOpen">Menu {isOpen ? '▲' : '▼'}</button>

  <show condition="isOpen">
    <nav class="dropdown-menu">
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </nav>
  </show>
</div>

<script>
  let isOpen = false;
</script>
```

### Tab Content

```html
<div class="tabs">
  <button onclick="activeTab = 'one'"   class="{activeTab === 'one' ? 'active' : ''}">Tab 1</button>
  <button onclick="activeTab = 'two'"   class="{activeTab === 'two' ? 'active' : ''}">Tab 2</button>
  <button onclick="activeTab = 'three'" class="{activeTab === 'three' ? 'active' : ''}">Tab 3</button>
</div>

<show condition="activeTab === 'one'">
  <div class="tab-panel">Content for Tab 1</div>
</show>
<show condition="activeTab === 'two'">
  <div class="tab-panel">Content for Tab 2</div>
</show>
<show condition="activeTab === 'three'">
  <div class="tab-panel">Content for Tab 3</div>
</show>

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

  <show condition="showAdvanced">
    <div class="advanced-options">
      <label>
        Cache TTL:
        <input type="number" $bind="cacheTTL" />
      </label>
      <label>
        Max Connections:
        <input type="number" $bind="maxConnections" />
      </label>
    </div>
  </show>
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
  <div class="content">Main content here…</div>

  <show condition="isLoading">
    <div class="loading-overlay">
      <div class="spinner"></div>
      <p>Loading…</p>
    </div>
  </show>
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
    inset: 0;
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

`condition` accepts any JavaScript expression. Curly braces are optional:

```html
<show condition="isVisible">…</show>
<show condition="{isVisible}">…</show>

<show condition="count > 0">Has items</show>
<show condition="status === 'active'">Active</show>
<show condition="isLoggedIn && hasPermission">…</show>
<show condition="!isHidden">…</show>
<show condition="items.length">Has {items.length} items</show>
```

---

## Animations

`<show>` toggles between `display: contents` and `display: none`, which is
not animatable on its own. For enter/leave animations, switch a CSS class
instead:

```html
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
