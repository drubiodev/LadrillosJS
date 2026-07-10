# Event Modifiers (`$on:`)

The `$on:` directive attaches an event listener with declarative **modifiers**
— tiny dot-separated flags that filter when the handler fires or change how
the event behaves. Instead of writing boilerplate like this:

```html
<input onkeyup="if (event.key === 'Enter') submit()" />
```

you write this:

```html
<input $on:keyup.enter="submit()" />
```

## Anatomy

```
$on:<event>[.<modifier>][.<modifier>]...="<handler>"
 │      │        │                          │
 │      │        │                          └─ Any expression or function call,
 │      │        │                             same as onclick="..."
 │      │        └──────────────────────────── Zero or more dot-separated modifiers
 │      └───────────────────────────────────── Any DOM event name (click, submit,
 │                                             keyup, input, scroll, custom events…)
 └──────────────────────────────────────────── The directive prefix
```

Examples, from simplest to most combined:

```html
<button $on:click="save()">Save</button>
<form $on:submit.prevent="handleSubmit()">…</form>
<input $on:keyup.enter="search()" />
<textarea $on:keydown.ctrl.s.prevent="save()"></textarea>
<div $on:click.self.stop="closeDropdown()">…</div>
```

`$on:` works everywhere — on plain elements, on form controls alongside
`$bind`, and inside `<for>` loop bodies (where the loop's `item`/`index`
variables are in scope in the handler).

---

## Modifier Reference

Modifiers fall into four categories. You can freely mix them; the framework
sorts them into their categories no matter what order you write them in.

### 1. Event behavior modifiers

Change what happens to the event itself.

| Modifier   | Effect                                                            |
| ---------- | ----------------------------------------------------------------- |
| `.prevent` | Calls `event.preventDefault()`                                    |
| `.stop`    | Calls `event.stopPropagation()`                                   |
| `.self`    | Only fires if `event.target` is the element itself (not a child)  |
| `.once`    | Listener is removed after the first time it fires                 |
| `.passive` | Registers a [passive listener](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#passive) (better scroll performance) |
| `.capture` | Listens during the capture phase instead of bubbling              |

```html
<!-- Stop a form from reloading the page -->
<form $on:submit.prevent="handleSubmit()">…</form>

<!-- Handle a link click yourself -->
<a href="/fallback" $on:click.prevent="navigate()">Go</a>

<!-- Keep a click from bubbling to parents -->
<button $on:click.stop="select()">Select</button>

<!-- Close a modal only when the backdrop itself is clicked -->
<div class="backdrop" $on:click.self="closeModal()">
  <div class="modal">Clicking here does NOT close</div>
</div>

<!-- Fire exactly once (e.g. first-interaction analytics) -->
<button $on:click.once="trackFirstClick()">Buy</button>

<!-- Smooth scrolling: promise the browser you won't preventDefault -->
<div $on:scroll.passive="onScroll()">…</div>

<!-- Intercept during capture, before children see the event -->
<div $on:click.capture="logClick(event)">…</div>
```

> ⚠️ **Don't combine `.passive` with `.prevent`.** A passive listener tells
> the browser you will *not* call `preventDefault()` — if you do anyway, the
> browser ignores it and logs a console warning.

### 2. System (modifier-key) modifiers

Require a modifier key to be held down. Work on both keyboard and mouse
events.

| Modifier | Requires        |
| -------- | --------------- |
| `.ctrl`  | `Ctrl` held     |
| `.alt`   | `Alt`/`Option`  |
| `.shift` | `Shift` held    |
| `.meta`  | `Cmd` (macOS) / `Win` key |
| `.exact` | *Only* the listed system modifiers — no extras |

```html
<!-- Ctrl+click for multi-select -->
<li $on:click.ctrl="toggleSelect(item)">…</li>

<!-- Ctrl+S to save (and stop the browser's save dialog) -->
<textarea $on:keydown.ctrl.s.prevent="save()"></textarea>

<!-- Ctrl+Shift+Enter -->
<input $on:keydown.ctrl.shift.enter="submitAndClose()" />
```

**About `.exact`:** by default, extra held keys don't block the handler —
`$on:click.ctrl` still fires on Ctrl+Shift+click. Add `.exact` to require an
exact match:

```html
<!-- Fires on Ctrl+click, even with Shift also held -->
<button $on:click.ctrl="run()">A</button>

<!-- Fires ONLY on Ctrl+click — Ctrl+Shift+click is ignored -->
<button $on:click.ctrl.exact="run()">B</button>

<!-- Fires only on a bare click with NO modifier keys held -->
<button $on:click.exact="run()">C</button>
```

### 3. Mouse button modifiers

Filter `click` / `mousedown` / `mouseup` by which button was used.

| Modifier  | Button                    |
| --------- | ------------------------- |
| `.left`   | Left button (`button 0`)  |
| `.middle` | Middle button / wheel     |
| `.right`  | Right button              |

```html
<!-- Custom context menu -->
<div $on:contextmenu.prevent="showMenu(event)">Right-click me</div>

<!-- Middle-click to open in background tab -->
<a $on:mousedown.middle="openInBackground(item)">…</a>

<!-- Right mouse button down -->
<div $on:mousedown.right="startSelecting(event)">…</div>
```

> ⚠️ **`.left` and `.right` always mean mouse buttons**, even on keyboard
> events. For the arrow keys, use `.arrowleft` / `.arrowright` (see below).

### 4. Key modifiers

Filter `keydown` / `keyup` by which key was pressed. Any modifier that isn't
recognized as one of the categories above is treated as a key filter.

**Named aliases:**

| Category   | Modifiers                                          |
| ---------- | -------------------------------------------------- |
| Navigation | `.enter`, `.tab`, `.esc` / `.escape`, `.space`     |
| Arrows     | `.up`, `.down`, `.arrowleft`, `.arrowright`        |
| Editing    | `.delete`, `.backspace`, `.insert`                 |
| Position   | `.home`, `.end`, `.pageup`, `.pagedown`            |
| Function   | `.f1` through `.f12`                               |

**Any other key** also works:

- Single characters match case-insensitively: `.a`, `.z`, `.5`
- Multi-character names match against
  [`KeyboardEvent.key`](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values),
  case-insensitively, with kebab-case supported: `.arrowleft` or
  `.arrow-left` both match `ArrowLeft`; `.capslock` matches `CapsLock`.

```html
<input $on:keyup.enter="search()" />
<input $on:keydown.escape="cancel()" />
<div $on:keydown.w="moveUp()" tabindex="0">WASD movement</div>
```

**Multiple key modifiers are OR-ed** — the handler fires if *any* of them
match. Great for game controls or list navigation:

```html
<!-- Fires on ANY arrow key -->
<div tabindex="0" $on:keydown.up.down.arrowleft.arrowright.prevent="move(event)">
  Use arrow keys
</div>

<!-- Enter or Space both activate -->
<div role="button" tabindex="0" $on:keydown.enter.space.prevent="activate()">
  Custom button
</div>
```

---

## Combination Gallery

Modifiers compose freely. Write them in any order — `$on:click.stop.prevent`
and `$on:click.prevent.stop` are identical. A tour of useful combinations:

| Directive                              | What it does                                                       |
| -------------------------------------- | ------------------------------------------------------------------ |
| `$on:click.prevent`                    | Handle the click, suppress the default action (links, buttons in forms) |
| `$on:click.stop`                       | Handle the click, don't let parents see it                        |
| `$on:click.prevent.stop`               | Fully take over the click                                          |
| `$on:click.self`                       | Only direct clicks on this element (modal backdrops)               |
| `$on:click.self.stop`                  | Direct clicks only, and contain them                               |
| `$on:click.once`                       | One-shot handler (first-interaction tracking, lazy init)           |
| `$on:click.ctrl`                       | Ctrl+click (multi-select)                                          |
| `$on:click.shift`                      | Shift+click (range select)                                         |
| `$on:click.ctrl.exact`                 | Ctrl+click with *no other* modifier keys held                      |
| `$on:click.exact`                      | Plain click — ignores any modified clicks                          |
| `$on:mousedown.middle`                 | Middle-button press                                                |
| `$on:contextmenu.prevent`              | Replace the native right-click menu                                |
| `$on:dblclick.prevent`                 | Double-click without text selection side effects                   |
| `$on:submit.prevent`                   | The classic SPA form submit                                        |
| `$on:keyup.enter`                      | Enter released (submit-on-enter for single inputs)                 |
| `$on:keydown.escape`                   | Escape pressed (close dialogs)                                     |
| `$on:keydown.enter.space.prevent`      | Enter **or** Space, default suppressed (accessible custom buttons) |
| `$on:keydown.ctrl.s.prevent`           | Ctrl+S save shortcut, browser dialog suppressed                    |
| `$on:keydown.ctrl.shift.z.prevent`     | Ctrl+Shift+Z (redo)                                                |
| `$on:keydown.meta.k.prevent`           | Cmd+K command palette (macOS)                                      |
| `$on:keydown.tab.prevent`              | Custom tab handling (editors, focus traps)                         |
| `$on:keydown.up.down.prevent`          | Arrow navigation without page scroll                               |
| `$on:scroll.passive`                   | High-frequency scroll handler that never blocks rendering          |
| `$on:touchstart.passive`               | Smooth touch handling on mobile                                    |
| `$on:click.capture`                    | See the click before any child handler                             |
| `$on:focus.once`                       | First-focus setup work                                             |

### Worked example: keyboard-driven todo input

```html
<input
  $bind="newTodo"
  $on:keyup.enter="addTodo()"
  $on:keydown.escape="newTodo = ''"
  placeholder="Add a todo (Enter to add, Esc to clear)"
/>

<ul>
  <for each="(todo, i) in todos" key="todo.id">
    <li>
      <span>{todo.text}</span>
      <!-- Ctrl+click deletes instantly, plain click edits -->
      <button $on:click.ctrl.exact="removeTodo(todo.id)" $on:click.exact="edit(todo)">
        {todo.text}
      </button>
    </li>
  </for>
</ul>

<script>
  let newTodo = "";
  let todos = [];
  let nextId = 1;

  function addTodo() {
    if (newTodo.trim()) {
      todos = [...todos, { id: nextId++, text: newTodo }];
      newTodo = "";
    }
  }

  function removeTodo(id) {
    todos = todos.filter((t) => t.id !== id);
  }

  function edit(todo) {
    newTodo = todo.text;
  }
</script>
```

---

## How Modifiers Are Applied

Understanding the order of operations helps when combining filters with
`.prevent` / `.stop`:

1. **`.self`** — bail out if the event came from a child element.
2. **Mouse button** — bail out if the wrong button.
3. **System modifiers** (and `.exact`) — bail out if required keys aren't held.
4. **Key modifiers** — bail out if none of the listed keys match.
5. **`.prevent`** — `preventDefault()` runs *only if all filters passed*.
6. **`.stop`** — `stopPropagation()` runs *only if all filters passed*.
7. **Your handler** runs.

So `$on:keydown.enter.prevent` only prevents the default for **Enter** —
every other key behaves normally. This is exactly what you want for things
like "Enter submits, but typing is unaffected."

`.once`, `.passive`, and `.capture` are different: they're passed as
[`addEventListener` options](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#options)
when the listener is registered, so they apply to the listener itself, not
per-event.

> **Note on `.once` + key filters:** because `.once` removes the listener
> after its first *invocation* (any matching event), a filtered handler like
> `$on:keydown.enter.once` is consumed by the first `keydown` of any key —
> the filters run inside the handler, after the browser has already counted
> the invocation. If you need "once, but only for Enter," track it in state
> instead.

---

## `$on:` + `$bind` on the Same Element

They compose. When both are present, LadrillosJS syncs the bound value into
state *before* your handler runs, so the handler always reads fresh values:

```html
<input $bind="query" $on:input="search()" />

<script>
  let query = "";

  function search() {
    // `query` is already updated with the latest keystroke here
    console.log("Searching:", query);
  }
</script>
```

---

## `onclick` vs `$on:click`

Both work, and both compile to real event listeners with access to component
state. Use whichever reads better — reach for `$on:` when you need modifiers:

| You need…                                | Use                              |
| ---------------------------------------- | -------------------------------- |
| A plain handler                          | `onclick="save()"` (or `$on:click`) |
| `preventDefault` / `stopPropagation`     | `$on:click.prevent` / `.stop`    |
| Key filtering                            | `$on:keyup.enter`                |
| Modifier keys, mouse buttons             | `$on:click.ctrl`, `$on:mousedown.middle` |
| `once` / `passive` / `capture` semantics | `$on:click.once`, etc.           |

---

← [Built-in Elements & Directives](./06-directives.md) | [Two-Way Binding](./09-two-way-binding.md) →

[Back to Index](./README.md)
