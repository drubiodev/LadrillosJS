# Built-in Elements & Directives

LadrillosJS provides two kinds of declarative authoring helpers:

1. **Built-in elements** — real HTML tags exposed by the framework that
   control structure (`<if>`, `<else-if>`, `<else>`, `<show>`, `<for>`,
   `<lazy>`).
2. **Directives** — special attributes (prefixed with `$`) that attach
   behavior to existing elements (`$bind`, `$ref`, `$key`, `$no:bind`,
   `$on:event.modifier`).

> **Heads up:** v2 replaces the old attribute-style structural directives
> (`$if`, `$else`, `$else-if`, `$for`, `$show`) with first-class elements.
> See [Migration v1 → v2](./17-migration-v1-to-v2.md) for the diff.

---

## Built-in Elements

| Element                                            | Purpose                              |
| -------------------------------------------------- | ------------------------------------ |
| [`<if>`](./07-conditionals.md)                     | Conditional rendering                |
| [`<else-if>`](./07-conditionals.md)                | Chained condition                    |
| [`<else>`](./07-conditionals.md)                   | Fallback branch                      |
| [`<show>`](./11-show.md)                           | CSS visibility toggle                |
| [`<for>`](./08-loops.md)                           | List rendering                       |
| [`<lazy>`](./13-lazy-loading.md)                   | Defer content / component until trigger |

All built-in elements render as `display: contents` (no visual wrapper) and
support **multiple top-level children** in their body.

### Quick examples

```html
<if condition="status === 'loading'">
  <p>⏳ Loading…</p>
</if>
<else-if condition="status === 'error'">
  <p>❌ {error}</p>
</else-if>
<else>
  <p>✅ Ready</p>
</else>

<show condition="menuOpen">
  <nav>…</nav>
</show>

<for each="(item, i) in items" key="item.id">
  <li>#{i + 1}: {item.name}</li>
</for>

<lazy margin="100px">
  <heavy-chart></heavy-chart>
</lazy>
```

---

## Attribute Directives

| Directive                          | Purpose               | Example                                 |
| ---------------------------------- | --------------------- | --------------------------------------- |
| [`$bind`](./09-two-way-binding.md)       | Two-way data binding  | `<input $bind="name">`                  |
| [`$ref`](./10-refs.md)                   | Element reference     | `<input $ref="inputEl">`                |
| `$key`                                   | Loop optimization     | `<for each="x in xs" key="x.id">`       |
| `$no:bind`                               | Escape binding syntax | `<code $no:bind>{literal}</code>`       |
| [`$on:event.modifier`](./20-event-modifiers.md) | Event with modifiers | `<input $on:keyup.enter="submit()">` |

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
<input $ref="inputEl" />
<canvas $ref="canvas"></canvas>

<button onclick="$refs.inputEl.focus()">Focus</button>
```

[Full documentation →](./10-refs.md)

### Events with Modifiers (`$on:`)

Attach event listeners with declarative modifiers — key filters, modifier
keys, mouse buttons, `prevent`/`stop`, and more. Modifiers combine freely:

```html
<form $on:submit.prevent="handleSubmit()">…</form>
<input $on:keyup.enter="search()" />
<textarea $on:keydown.ctrl.s.prevent="save()"></textarea>
<div $on:click.self.stop="closeDropdown()">…</div>
<button $on:click.once="trackFirstClick()">Buy</button>
```

[Full documentation →](./20-event-modifiers.md)

---

## Expression Syntax

Conditions and `<show>` accept any JavaScript expression. Curly braces are
optional — both forms work:

```html
<if condition="user.isAdmin">…</if>
<if condition="{user.isAdmin}">…</if>
```

`<for>` uses the familiar `each="item in items"` syntax (no braces):

```html
<for each="item in items">…</for>
<for each="(item, index) in items">…</for>
<for each="(value, key, index) in object">…</for>
```

`$bind` uses a variable path without braces:

```html
<input $bind="username" />
<input $bind="user.email" />
<input $bind="config.settings.theme" />
```

---

## Processing Order

When a component mounts, the framework processes the template in this order:

1. **`$ref`** — element references collected so scripts can access them.
2. **`<lazy>`** — deferred content is removed from the active scan tree.
3. **`<for>`** — loop templates extracted (their inner bindings are handled
   per-iteration).
4. **`<if>`/`<else-if>`/`<else>`** — conditional groups built.
5. **`<show>`** — visibility descriptors collected.
6. **`$bind`** — two-way bindings wired to form elements.

This ordering ensures refs are available before scripts run, loop bodies are
not double-processed, and conditionals don't fight each other for placement.

---

## Combining Built-ins

Built-ins compose freely:

```html
<for each="user in users" key="user.id">
  <li>
    <span>{user.name}</span>
    <if condition="user.isAdmin">
      <span class="badge">admin</span>
    </if>
    <show condition="user.isOnline">
      <span class="dot dot-online"></span>
    </show>
  </li>
</for>
```

### Multiple top-level children

`<for>`, `<if>`, `<else-if>`, `<else>`, `<show>`, and `<lazy>` may all contain
multiple top-level children. The framework wraps them transparently with
`display: contents` so layout is unaffected:

```html
<for each="row in rows">
  <td>{row.name}</td>
  <td>{row.email}</td>
  <td>{row.role}</td>
</for>
```

### Restrictions

Don't put a sibling `<if>` after a `<for>` and expect it to be part of a
chain — `<else-if>`/`<else>` only chain off an immediately preceding
`<if>`/`<else-if>`. Use a nested structure instead.

---

## Built-in Elements vs Bindings

| Feature  | Built-in Element       | Binding                |
| -------- | ---------------------- | ---------------------- |
| Syntax   | `<tag attr="…">…</tag>`| `{expression}`         |
| Purpose  | Control structure      | Display values         |
| Examples | `<if>`, `<for>`        | `{name}`, `{count*2}`  |

Built-in elements decide **what** renders. Bindings decide **what values**
appear inside.

```html
<if condition="showDetails">
  <p>Name: {user.name}</p>
  <p>Email: {user.email}</p>
</if>
```

---

← [Template Bindings](./05-template-bindings.md) | [Conditional Rendering](./07-conditionals.md) →

[Back to Index](./README.md)
