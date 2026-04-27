# Event Bus

The event bus enables cross-component communication without prop drilling. Components can communicate even if they're not directly related.

## Overview

```
┌──────────────────┐    $emit("event")    ┌──────────────────┐
│   Component A    │ ──────────────────▶  │    Event Bus     │
│  (sends events)  │                      │   (broadcasts)   │
└──────────────────┘                      └────────┬─────────┘
                                                   │
                                          $listen("event")
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    ▼                              ▼                              ▼
          ┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
          │   Component B    │          │   Component C    │          │   Component D    │
          │  (listens)       │          │  (listens)       │          │  (ignores)       │
          └──────────────────┘          └──────────────────┘          └──────────────────┘
```

---

## Emitting Events

Use `$emit` to broadcast an event:

```html
<!-- sender.html -->
<button onclick="sendNotification()">Send Notification</button>

<script>
  function sendNotification() {
    $emit("notification", {
      title: "Hello!",
      message: "This is a notification",
      timestamp: Date.now(),
    });
  }
</script>
```

### $emit Signature

```javascript
$emit(eventName: string, data?: any): void
```

- `eventName` - A string identifier for the event (use namespacing like `"user:login"`)
- `data` - Optional data to pass to listeners (any type)

---

## Listening to Events

Use `$listen` to receive events:

```html
<!-- receiver.html -->
<if condition="notification">
  <h3>{notification.title}</h3>
  <p>{notification.message}</p>
</if>

<script>
  let notification = null;

  $listen("notification", (data) => {
    notification = data;
  });
</script>
```

### $listen Signature

```javascript
$listen(eventName: string, callback: (data) => void): () => void
```

Returns an **unsubscribe function**:

```javascript
const unsubscribe = $listen("some-event", (data) => {
  console.log(data);
});

// Later: stop listening
unsubscribe();
```

---

## Complete Example

### Sender Component

```html
<!-- event-sender.html -->
<div class="sender">
  <h3>Sender</h3>

  <input type="text" $bind="message" placeholder="Enter message" />
  <button onclick="sendMessage()">📤 Send</button>

  <div class="colors">
    <for each="color in colors">
      <button
        onclick="sendTheme(color)"
        style="background: {color}"
      ></button>
    </for>
  </div>
</div>

<script>
  let message = "";
  let colors = ["#ef4444", "#22c55e", "#3b82f6", "#8b5cf6"];

  function sendMessage() {
    if (message.trim()) {
      $emit("chat:message", {
        text: message,
        time: new Date().toLocaleTimeString(),
      });
      message = ""; // Clear input
    }
  }

  function sendTheme(color) {
    $emit("theme:change", { color });
  }
</script>
```

### Receiver Component

```html
<!-- event-receiver.html -->
<div class="receiver" style="background: {themeColor}">
  <h3>Receiver</h3>

  <ul>
    <for each="msg in messages">
      <li>
        <span class="time">{msg.time}</span>
        <span class="text">{msg.text}</span>
      </li>
    </for>
  </ul>

  <if condition="messages.length === 0"><p>No messages yet</p></if>
</div>

<script>
  let messages = [];
  let themeColor = "#f5f5f5";

  // Listen for chat messages
  $listen("chat:message", (data) => {
    messages = [...messages, data];
  });

  // Listen for theme changes
  $listen("theme:change", (data) => {
    themeColor = data.color;
  });
</script>
```

---

## Event Naming Conventions

Use namespaced event names to avoid collisions:

```javascript
// ✅ Good - namespaced
$emit("user:login", userData);
$emit("cart:add-item", item);
$emit("modal:open", { id: "settings" });

// ❌ Avoid - too generic
$emit("click", data);
$emit("update", data);
```

Common patterns:

- `entity:action` - `user:login`, `cart:clear`
- `feature:event` - `auth:token-expired`, `ui:theme-change`
- `component:event` - `header:menu-toggle`

---

## Common Use Cases

### User Authentication

```html
<!-- login-form.html -->
<script>
  async function login(username, password) {
    const user = await authenticate(username, password);
    $emit("user:login", user);
  }
</script>

<!-- navbar.html -->
<script>
  let currentUser = null;

  $listen("user:login", (user) => {
    currentUser = user;
  });

  $listen("user:logout", () => {
    currentUser = null;
  });
</script>
```

### Shopping Cart

```html
<!-- product-card.html -->
<button onclick="addToCart()">Add to Cart</button>

<script>
  let product = { id: 1, name: "Widget", price: 9.99 };

  function addToCart() {
    $emit("cart:add", product);
  }
</script>

<!-- cart-badge.html -->
<span class="badge">{itemCount}</span>

<script>
  let itemCount = 0;

  $listen("cart:add", (product) => {
    itemCount++;
  });

  $listen("cart:remove", (product) => {
    itemCount--;
  });

  $listen("cart:clear", () => {
    itemCount = 0;
  });
</script>
```

### Notifications/Toasts

```html
<!-- Any component -->
<script>
  function showError(message) {
    $emit("toast:show", {
      type: "error",
      message,
      duration: 5000,
    });
  }
</script>

<!-- toast-container.html -->
<div class="toasts">
  <for each="toast in toasts">
    <div class="toast {toast.type}">
      {toast.message}
      <button onclick="dismiss(toast.id)">×</button>
    </div>
  </for>
</div>

<script>
  let toasts = [];
  let nextId = 1;

  $listen("toast:show", (data) => {
    const toast = { id: nextId++, ...data };
    toasts = [...toasts, toast];

    // Auto-dismiss
    setTimeout(() => dismiss(toast.id), data.duration || 3000);
  });

  function dismiss(id) {
    toasts = toasts.filter((t) => t.id !== id);
  }
</script>
```

### Modal Control

```html
<!-- trigger-button.html -->
<button onclick="openModal()">Open Settings</button>

<script>
  function openModal() {
    $emit("modal:open", { id: "settings" });
  }
</script>

<!-- modal.html -->
<show condition="isOpen">
  <div class="modal-backdrop">
    <div class="modal">
      <button onclick="close()" class="close-btn">×</button>
      <slot></slot>
    </div>
  </div>
</show>

<script>
  let isOpen = false;
  let modalId = "settings"; // This modal's ID

  $listen("modal:open", (data) => {
    if (data.id === modalId) {
      isOpen = true;
    }
  });

  $listen("modal:close", (data) => {
    if (data.id === modalId) {
      isOpen = false;
    }
  });

  function close() {
    isOpen = false;
    $emit("modal:closed", { id: modalId });
  }
</script>
```

---

## Cleanup

Event listeners are automatically cleaned up when a component is removed from the DOM. This prevents memory leaks.

However, if you need manual control:

```html
<script>
  // Store the unsubscribe function
  const unsub = $listen("some-event", handler);

  // Call it when you want to stop listening
  function stopListening() {
    unsub();
  }
</script>
```

---

## Using Outside Components

You can also use the event bus in regular JavaScript:

```javascript
import { $emit, $listen } from "ladrillosjs";

// Emit from anywhere
$emit("app:initialized", { timestamp: Date.now() });

// Listen from anywhere
const unsub = $listen("app:error", (error) => {
  console.error("App error:", error);
});
```

---

## Best Practices

1. **Use descriptive event names** with namespacing
2. **Keep event data serializable** when possible
3. **Don't emit too frequently** - batch updates if needed
4. **Document your events** so other developers know what's available
5. **Unsubscribe** if you need to stop listening before component unmounts

---

← [Visibility Toggle](./11-show.md) | [Lazy Loading](./13-lazy-loading.md) →

[Back to Index](./README.md)
