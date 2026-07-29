# vite-starter

A LadrillosJS app built with Vite.

```
index.html              page shell and meta tags
vite.config.js
src/
  main.js               registers components, sets up error reporting
  app.css               page-level styles
public/
  favicon.svg
  components/
    app-header.html     loop + attribute binding
    hello-card.html     state, two-way binding, event handler, conditional
```

## Run it

```bash
npm install
npm run dev      # dev server
npm run build    # production build into dist/
npm run preview  # serve dist/ locally
```

## Why components live in `public/`

Component `.html` files are fetched at runtime, not imported. Vite only copies
files it can see in the module graph, so a component under `src/` would work in
`npm run dev` and then 404 in production.

`public/` is copied verbatim into `dist/`, which is why registration paths are
absolute:

```js
"hello-card": "/components/hello-card.html"
```

Check `dist/components/` after a build if you are ever unsure.

This stops being true if you adopt a strict CSP — see below, where components get
compiled into the bundle and leave `public/` behind.

## Deploy it

Deploy `dist/` to any static host. If your app is served from a subpath, set
[`base`](https://vite.dev/config/shared-options#base) in `vite.config.js`.

## Adding a component

1. Create `public/components/my-thing.html`.
2. Add it to the map in `src/main.js`.
3. Use `<my-thing></my-thing>` in `index.html`.

Attributes become state. Given `let name = ""` in the component's `<script>`,
writing `<hello-card name="world">` sets it.

## Strict CSP

### Why you would want this

Out of the box the browser does the compiling. It fetches each component
`.html`, parses it, and turns `{count * 2}` into a function with `new Function`.
That is what makes the no-build-step version work, and it is the default for
good reason.

The cost is that your page needs `script-src 'unsafe-eval'`. That directive is
the one an attacker wants most — it turns any string they can reach into
running code, so it is what most security reviews, banks, healthcare vendors
and browser-extension stores refuse outright.

The plugin runs the exact same compile step, just on your machine instead of
your visitor's. You ship plain static JavaScript. Two things fall out of that
besides the policy: components stop being separate network round trips, and a
template that fails to compile breaks your build rather than someone's browser.

Keep the default if you are prototyping or have no CSP requirement. Reach for
this when a policy says you must.

### How to add it

**1. Install.**

```bash
npm i -D @ladrillosjs/vite-plugin
```

**2. Add it to `vite.config.js`.**

```js
import { defineConfig } from "vite";
import ladrillos from "@ladrillosjs/vite-plugin";

export default defineConfig({
  plugins: [ladrillos({ strict: true })],
});
```

`strict: true` fails the build if any registration could not be precompiled.
Without it those cases fall back to the runtime compiler, which quietly puts
`'unsafe-eval'` back on the page — one missed component undoes the whole
exercise. The plugin cannot precompile a path built at runtime
(`registerComponent(name, paths[i])`), a spread, or a `lazy: true` registration.

**3. Import from `ladrillosjs/csp` in `src/main.js`.**

```js
import { configure, registerComponents } from "ladrillosjs/csp";
```

Same API. This entry point is built without the `Function` constructor, so the
compiler cannot end up in your bundle even by accident.

**4. Move `public/components/` to `components/` at the project root.**

Leave the registration paths in `src/main.js` alone — they stay
`/components/hello-card.html`.

Components are inlined into the bundle now, so `public/` has no job to do here;
it exists only to make Vite copy files it cannot see. The plugin resolves a
root-absolute path against the project root rather than `public/`, so leaving
them there is what makes a build fail under `strict`. `npm run dev` keeps
working either way, because Vite's dev server serves files straight from the
project root.

**5. Serve the policy.** In production this belongs in a response header:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self';
  img-src 'self' data:;
  object-src 'none';
  base-uri 'none';
  require-trusted-types-for 'script';
  trusted-types ladrillosjs
```

No `'unsafe-eval'` and no `'unsafe-inline'`. The `trusted-types ladrillosjs`
line allows the one policy the framework creates for its own HTML sinks; drop it
and the page stops rendering.

`style-src` needs no nonce either, which is worth calling out because most
frameworks do need one. A component's `<style>` block is applied as a
constructed stylesheet adopted by the shadow root, so no `<style>` element is
ever inserted and `style-src` has nothing to check.

The exception is `@import`: constructed stylesheets drop `@import` rules, so a
component that uses one falls back to injecting a real `<style>` element, which
this policy then blocks. The component still renders, silently unstyled. Import
the CSS through your bundler instead, or add a hash for that one block.

### Check that it worked

```bash
npm run build
grep -rE "new Function|eval\(" dist/assets/*.js   # expect no matches
find dist -name "*.html"                          # expect only dist/index.html
```

The second one is the tell: no component `.html` in `dist/` means nothing is
left to fetch and parse at runtime.

[samples/csp-vite](../../samples/csp-vite) is a working version of all of this,
including a page that reports its own CSP violations. The
[plugin README](../../packages/vite-plugin/README.md) documents every option.

## Next steps

- **TypeScript.** Add `typescript`, rename `main.js` to `main.ts`, and point the
  script tag at it. See [docs/18-typescript.md](../../docs/18-typescript.md).

## Docs

[Quick start](../../docs/01-quick-start.md) ·
[Components](../../docs/03-components.md) ·
[Template bindings](../../docs/05-template-bindings.md)
