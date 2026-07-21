# design-system-cdn — consuming a shared design system with zero tooling

This sample shows the **CDN side** of sharing a LadrillosJS design system: the
exact same `my-design-system/` package as in
[`../design-system-vite/`](../design-system-vite/), consumed by a plain HTML
page with **no bundler and no install** — just an import map. It's the
runnable companion to
[Sharing your design system](../../docs/19-design-system.md#sharing-your-design-system).

## Run it

From the repo root (the framework build provides `dist/index.dev.js`):

```bash
npm run build
npm run serve:design-system
# open http://127.0.0.1:8080
```

## How it works

The page does three things, all in `<head>`:

1. **Link the tokens** — one plain CSS file of custom properties.
2. **Declare an import map** — it gives the bare specifiers `ladrillosjs` and
   `my-design-system` real URLs, so the package's own
   `import ... from "ladrillosjs"` resolves in the browser and the page and
   the package share **one** copy of the framework.
3. **Call `defineDesignSystem()`** — the package registers its components,
   resolving each `.html` file against its own URL via
   `new URL(..., import.meta.url)`.

## The real-world version

Publishing the package to npm gets you CDN hosting for free — jsDelivr serves
every npm package **with CORS headers** (required, since components are
fetched over HTTP). A consumer page then needs nothing but:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/my-design-system@1/tokens.css"
/>
<script type="importmap">
  {
    "imports": {
      "ladrillosjs": "https://cdn.jsdelivr.net/npm/ladrillosjs@2/dist/index.js",
      "my-design-system": "https://cdn.jsdelivr.net/npm/my-design-system@1/index.js"
    }
  }
</script>
<script type="module">
  import { defineDesignSystem } from "my-design-system";
  defineDesignSystem();
</script>

<ds-button label="Save" variant="primary"></ds-button>
```

This sample substitutes local paths for the two CDN URLs so it runs offline;
everything else is identical.
