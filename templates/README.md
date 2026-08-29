# LadrillosJS templates

Two starting points. Copy the folder, rename it, start building.

| Template | Build step | Use when |
| --- | --- | --- |
| [cdn-starter](./cdn-starter) | None | Static hosting, prototypes, adding components to an existing page |
| [vite-starter](./vite-starter) | Vite | You already have a toolchain, or want dependencies from npm |

Both render the same two components, so you can switch between them later
without rewriting anything: component files are identical in both.

```bash
# no build step
cp -r templates/cdn-starter my-app

# with Vite
cp -r templates/vite-starter my-app && cd my-app && npm install
```

## Which one

Start with **cdn-starter** if you are not sure. It has no `package.json`, no
install step, and no toolchain to keep up to date — open `index.html` on any
static host and it works.

Move to **vite-starter** when you want npm dependencies, or when you need to
remove `'unsafe-eval'` from your Content Security Policy. See
[samples/csp-vite](../samples/csp-vite) for that second step.

## Not included, on purpose

These are starting points, not a framework-in-a-box. Add as you need it:

- **Routing** — no router is bundled; components are independent of navigation.
- **State beyond components** — see [the event bus](../docs/12-event-bus.md).
- **TypeScript** — see [docs/18-typescript.md](../docs/18-typescript.md).
- **Tests** — pick your own runner; components are plain custom elements.
