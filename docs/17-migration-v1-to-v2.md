# Migrating from v1 to v2

LadrillosJS v2 is a **breaking** release focused on cleaning up the public
surface and modernizing the distribution format. Most apps need only small
changes — mainly around the CDN URL, ESM-only output, and a few new helpers.

---

## 1. Package distribution

**v1:** shipped UMD + ESM + CJS (multiple entry formats).
**v2:** **ESM only.**

If you were importing via `require("ladrillosjs")` or relying on the UMD
global, switch to an ESM `import` inside a bundler (Vite / Rollup / esbuild /
webpack 5+) or use the official CDN build described below.

```js
// v2
import { registerComponent } from "ladrillosjs";
```

### CDN users

```html
<!-- v1 (do not use) -->
<script src="https://cdn.jsdelivr.net/npm/ladrillosjs/dist/ladrillosjs.umd.js"></script>

<!-- v2 -->
<script type="module">
  import ladrillosjs from "https://cdn.jsdelivr.net/npm/ladrillosjs@2/dist/index.js";
  ladrillosjs.registerComponent("my-header", "./my-header.html");
</script>
```

---

## 2. Registration API

The two registration helpers keep their familiar names in v2 (no `$` prefix):

- `registerComponent(name, path, useShadowDOM?, lazy?)`
- `registerComponents(configs)`

Both work the same inside component `<script>` blocks and in external modules.

```js
// v2 — module entry
import { registerComponent, registerComponents } from "ladrillosjs";

registerComponent("my-button", "./my-button.html", true);

await registerComponents([
  { name: "my-header", path: "./header.html" },
  { name: "my-footer", path: "./footer.html", useShadowDOM: false },
]);
```

Inside a component's `<script>`, the same names are injected automatically:

```html
<script>
  registerComponent("nav-logo", "./logo.html");
  registerComponent("nav-menu", "./menu.html");
</script>
```

### New: `$use`

`$use(path)` auto-derives the tag name from the file path — perfect for
conventional folder layouts. This helper keeps the `$` prefix to distinguish
it from the explicit-name registration call.

```js
import { $use } from "ladrillosjs";
await $use("./components/site-header.html"); // registered as <site-header>
```

---

## 3. Error handling

v1 wrote framework errors directly to `console.error`. v2 routes everything
through a user-configurable handler.

```js
import { configure } from "ladrillosjs";

configure({
  onError: (err, context) => {
    // context may contain { tagName, sourcePath } for component errors
    reportToSentry(err, context);
  },
});
```

Pass `onError: null` to restore the default (styled console output).

---

## 4. Cache size tuning

```js
import { configure } from "ladrillosjs";

configure({ cacheSize: 50 }); // default is 25
```

---

## 5. `loadTemplate` return shape

If you were calling the internal `loadTemplate` helper directly (rare — not
part of the documented public API), the return value is now:

```ts
// v2
interface TemplateLoadResult {
  bindings: BindingDescriptor[];
}
```

The legacy `twoWayBindings`, `conditionals`, and `loops` fields were unused by
the runtime and have been removed.

---

## 6. Granular imports (new)

v2 exposes three sub-path entry points for aggressive tree-shaking:

```js
import { registerComponent } from "ladrillosjs/core";
import { lazyOnVisible } from "ladrillosjs/lazy";
import { $emit, $listen } from "ladrillosjs/events";
```

If you need only the event bus in a microfrontend, this can shrink your client
bundle significantly.

---

## 7. Attribute directives → built-in elements

v2.x replaces the legacy attribute-based control directives (`$if`,
`$else-if`, `$else`, `$show`, `$for`) with first-class HTML elements. The
`$bind`, `$ref`, and `$no:bind` attributes are unchanged.

| v1 / early v2                                    | v2.x                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| `<div $if="x">…</div>`                           | `<if condition="x">…</if>`                                            |
| `<div $else-if="y">…</div>`                      | `<else-if condition="y">…</else-if>`                                  |
| `<div $else>…</div>`                             | `<else>…</else>`                                                      |
| `<div $show="x">…</div>`                         | `<show condition="x">…</show>`                                        |
| `<li $for="i in xs" $key="i.id">…</li>`          | `<for each="i in xs" key="i.id"><li>…</li></for>`                     |

### Why?

- **Discoverability.** Built-ins read like normal HTML — no string-typed
  attribute that "magically" hijacks the element.
- **Multi-child bodies.** A `<for>` can contain multiple top-level children;
  the previous `$for` was tied to the single element it was placed on.
- **Cleaner reactive updates.** The framework no longer rewrites the host
  element to install/remove children — control-flow elements render as
  `display: contents`, so layout is unaffected.
- **Foundation for `<lazy>`.** The same scanner now powers a declarative
  lazy-loading element with `eager`, `visible`, `idle`, `delay`, `interaction`,
  and `media` strategies.

### Migration notes

- `$key` becomes the `key` attribute on `<for>` (alias: `track-by`).
- The loop expression syntax is identical: `each="(item, index) in items"`.
- `<else-if>` and `<else>` must be **immediate siblings** of `<if>` — the
  same rule that applied to the attribute version.
- A `<for>` body can have multiple top-level children; LadrillosJS wraps
  them in a `display:contents` span only when needed (single-child bodies
  pay zero wrapping cost).

See the rewritten docs for full coverage:

- [Built-in Elements & Directives](./06-directives.md)
- [Conditional Rendering](./07-conditionals.md)
- [List Rendering](./08-loops.md)
- [Visibility Toggle](./11-show.md)
- [Lazy Loading](./13-lazy-loading.md)

---

## 8. Node / tooling

- **Node 18+** is required for the published package and its build scripts.
- If you contribute to LadrillosJS itself, run `npm install` and `npm run
build:all` — the build now cleans `dist/` and `dist-cdn/` before emitting.

---

## Checklist

- [ ] Update CDN `<script>` tags to the `@2` ESM URL (`type="module"`).
- [ ] Drop any `require()` / UMD usage — move to ESM.
- [ ] Migrate `$if` / `$else-if` / `$else` / `$show` / `$for` attribute
      directives to the new `<if>`, `<else-if>`, `<else>`, `<show>`, `<for>`
      built-in elements.
- [ ] Rename `$key` → `key` on `<for>` elements.
- [ ] If you were reading directly from `loadTemplate`, update destructuring.
- [ ] Consider installing a `configure({ onError })` handler for production
      error reporting.

If something isn't covered here, please
[open an issue](https://github.com/your-org/LadrillosJS/issues) — we'll add it.
