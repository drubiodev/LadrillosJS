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

## Deploy it

Deploy `dist/` to any static host. If your app is served from a subpath, set
[`base`](https://vite.dev/config/shared-options#base) in `vite.config.js`.

## Adding a component

1. Create `public/components/my-thing.html`.
2. Add it to the map in `src/main.js`.
3. Use `<my-thing></my-thing>` in `index.html`.

Attributes become state. Given `let name = ""` in the component's `<script>`,
writing `<hello-card name="world">` sets it.

## Next steps

- **Strict CSP.** Add `@ladrillosjs/vite-plugin` to compile components at build
  time and drop `'unsafe-eval'`. See
  [samples/csp-vite](../../samples/csp-vite).
- **TypeScript.** Add `typescript`, rename `main.js` to `main.ts`, and point the
  script tag at it. See [docs/18-typescript.md](../../docs/18-typescript.md).

## Docs

[Quick start](../../docs/01-quick-start.md) ·
[Components](../../docs/03-components.md) ·
[Template bindings](../../docs/05-template-bindings.md)
