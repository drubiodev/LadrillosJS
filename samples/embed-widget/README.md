# embed-widget

A pricing widget that a **different team** drops onto a page they do not
control, with one script tag and no build step.

```html
<script type="module" src="./widget.js"></script>

<quote-builder plan="pro" seats="5"></quote-builder>
```

That is the whole install surface. The host page keeps its own markup, its own
CSS and its own tooling — which here is none at all.

## Why this sample exists

Embedding is the case where a framework's isolation story is either real or it
isn't. The host page in this sample (`index.html`) is deliberately hostile:

- table-based layout and a Georgia serif body font
- global styles on bare `div`, `button`, `input` and `label` selectors
- a **"Break this page's CSS"** toggle that, with no JavaScript at all, sets
  `!important` rules on every element — Comic Sans, dashed red borders, rotated
  yellow buttons, doubled green inputs

Tick the toggle. The host page falls apart. The widget does not move.

That is not a framework trick — it is Shadow DOM plus constructed stylesheets,
which LadrillosJS uses by default. Component CSS is adopted into the shadow
root, so it never leaks out, and page CSS never leaks in.

### The honest caveat

**Inherited** properties still cross the shadow boundary. `font-family`,
`color`, `line-height` and friends are inherited from the host unless the
component sets them. That is how Shadow DOM is specified, not a bug.

So `quote-builder.html` sets them explicitly on its root:

```css
.widget {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  letter-spacing: normal;
  text-transform: none;
  text-align: left;
}
```

Without those four lines the widget would render in the host's serif font when
the page is hostile. With them, every measured computed style on every widget
element is identical before and after the chaos toggle. If you write an
embeddable component, set your own type — do not inherit it.

## Two instances, independent state

The page mounts the same element twice with different attributes:

```html
<quote-builder plan="pro" seats="5"></quote-builder>
<quote-builder plan="scale" seats="25"></quote-builder>
```

Attributes seed the component's state, so the two widgets start on different
plans and seat counts. Changing one leaves the other alone — state is
per-instance, not global.

## Running it

```sh
npm run serve:widget
```

Then open <http://127.0.0.1:8145/>.

## Pointing at a real CDN

`widget.js` loads the framework from the local build so the sample runs
straight from this repo:

```js
import { configure, registerComponents } from "/dist/index.js";
```

In production, pin a version instead:

```js
import {
  configure,
  registerComponents,
} from "https://cdn.jsdelivr.net/npm/ladrillosjs@2.1.0/dist/index.js";
```

Component `.html` files are fetched at runtime, so they need to sit somewhere
the browser can reach — next to `widget.js` is fine. Ship them with your widget.

## A note on CSP

This sample's host page sets no policy. A host that does will need to allow the
default build, which compiles template expressions at runtime:

```
script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net;
```

If the host cannot allow `'unsafe-eval'` — and plenty cannot — build the widget
with the Vite plugin instead and import `ladrillosjs/csp`. Expressions are
compiled ahead of time, no code generation happens in the browser, and the
policy drops to `script-src 'self'`. See
[docs/22-csp-and-security.md](../../docs/22-csp-and-security.md) and the
[csp-vite](../csp-vite) sample.
