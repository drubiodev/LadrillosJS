# design-system-vite — sharing a design system as an npm package

This sample shows how to **distribute a LadrillosJS design system** so other
teams can `npm install` it, and how a Vite app consumes it. It's the runnable
companion to [Sharing your design system](../../docs/19-design-system.md#sharing-your-design-system).

```
design-system-vite/
├── my-design-system/     ← the shareable package (what you'd `npm publish`)
│   ├── package.json      ← ladrillosjs is a *peer dependency*
│   ├── index.js          ← registers every component via import.meta.url
│   ├── tokens.css        ← design tokens (:root custom properties)
│   └── components/       ← plain LadrillosJS .html components
└── (the rest)            ← an ordinary Vite app that consumes it
```

## Run it

```bash
npm install
npm run dev       # dev server
npm run build && npm run preview   # verify the production build too
```

## The three ideas

1. **Don't bundle the framework.** `my-design-system/package.json` declares
   `ladrillosjs` as a `peerDependency`. The app installs both packages, so
   exactly one copy of LadrillosJS runs — no duplicate registries, no
   duplicate `customElements` definitions.

2. **Resolve component URLs against the package, not the page.**
   `index.js` builds each path with
   `new URL("./components/ds-button.html", import.meta.url)`. Vite statically
   detects this pattern and emits the `.html` files as hashed build assets,
   so the runtime `fetch` works in `dev`, `build`, and `preview` alike.

3. **Tokens are the public theming API.** The app imports
   `my-design-system/tokens.css` once; the "Toggle theme" button re-themes
   every component by flipping one `data-theme` attribute.

## One Vite-specific note

The app's `vite.config.js` sets `optimizeDeps.exclude: ["my-design-system"]`
so dependency pre-bundling doesn't separate the package's JS from its `.html`
component files. Consumers of your real published package need the same line.

(The `resolve.alias` / `server.fs` entries in the config are monorepo plumbing
so the sample uses the framework source from this repo — a real app that
installed `ladrillosjs` from npm doesn't need them.)

## Publishing for real

```bash
cd my-design-system
npm publish       # then consumers: npm install my-design-system ladrillosjs
```

The same published package also works with **zero build tooling** via a CDN +
import map — see [`../design-system-cdn/`](../design-system-cdn/).
