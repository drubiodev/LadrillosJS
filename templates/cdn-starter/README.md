# cdn-starter

A LadrillosJS app with no build step, no `package.json`, and no install.

```
index.html          page shell, meta tags, CSP
app.js              registers components, sets up error reporting
app.css             page-level styles
favicon.svg
components/
  app-header.html   loop + attribute binding
  hello-card.html   state, two-way binding, event handler, conditional
```

## Run it

Any static file server will do — components are fetched over HTTP, so opening
`index.html` from the filesystem will not work.

```bash
npx serve .
```

## Deploy it

Upload the folder. There is no build output because there is no build.

Works as-is on Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3, or any
web server.

## Upgrading

The framework version is pinned in one place, at the top of `app.js`:

```js
from "https://cdn.jsdelivr.net/npm/ladrillosjs@2.1.0/dist/index.js"
```

Pin an exact version rather than `@2` so a new release cannot change your site
without you doing anything.

## Adding a component

1. Create `components/my-thing.html`.
2. Add it to the map in `app.js`.
3. Use `<my-thing></my-thing>` in `index.html`.

Attributes become state. Given `let name = ""` in the component's `<script>`,
writing `<hello-card name="world">` sets it.

## About the CSP

The `<meta http-equiv="Content-Security-Policy">` tag in `index.html` is a
reasonable production default. Move it to a response header when your host
allows it — headers cover responses the meta tag cannot.

Two things to know:

- **`'unsafe-eval'` is required here.** With no build step, component
  expressions and handlers are compiled in the browser. To remove it, use the
  [vite-starter](../vite-starter) plus `@ladrillosjs/vite-plugin` — see
  [samples/csp-vite](../../samples/csp-vite).
- **`style-src` needs no `'unsafe-inline'`.** Component styles are applied as
  adopted stylesheets. You will see one `style-src-elem` report per component
  type from the parser; the styles still apply. Details in
  [docs/22-csp-and-security.md](../../docs/22-csp-and-security.md).

If you load the framework from a different origin, or fetch components from
one, add it to `script-src` and `connect-src` respectively.

## Docs

[Quick start](../../docs/01-quick-start.md) ·
[Components](../../docs/03-components.md) ·
[Template bindings](../../docs/05-template-bindings.md)
