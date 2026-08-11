# @ladrillosjs/vite-plugin

Precompiles LadrillosJS components at build time, so the shipped page needs
neither `script-src 'unsafe-eval'` nor a runtime HTML parser.

Without it, LadrillosJS fetches each `.html` component in the browser, parses it,
and compiles its expressions with `new Function`. That is the no-build-step
design, and it stays the default. This plugin is the opt-in other half: run the
same work at build time and ship the result as plain static JavaScript.

## Install

```sh
npm i -D @ladrillosjs/vite-plugin
```

## Use

```js
// vite.config.js
import { defineConfig } from "vite";
import ladrillos from "@ladrillosjs/vite-plugin";

export default defineConfig({
  plugins: [ladrillos()],
});
```

No source changes. Registrations you already wrote keep working:

```js
import { registerComponent } from "ladrillosjs";

await registerComponent("my-button", "./components/button.html");
```

At build time that call is replaced with an import of a generated module and a
`defineCompiled` call. Nothing fetches or parses the `.html` in the browser.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `runtimeImport` | `"ladrillosjs/csp"` | Which entry the generated artifacts import. `ladrillosjs/csp` is the one with no `Function` constructor in it. |
| `dev` | `false` | Precompile during `vite serve` too. Off by default so editing a component is a plain reload; turn it on to develop under the CSP you will ship. |
| `strict` | `false` | Turn "could not precompile this registration" from a warning into a build error. Recommended once you are relying on the CSP. |

## What it will not precompile

A registration is only rewritten when its arguments are static. These are left
for the runtime and reported:

- a path that is not a string literal — `registerComponent(name, paths[i])`
- a spread — `registerComponents([...list])`
- `lazy: true` — precompiling would define the element up front, which is the
  opposite of what was asked for
- a path that resolves to no file, or to two different files

The failure mode is safe: an untouched call still works. It just needs
`unsafe-eval`. Turn on `strict` to make that a build failure instead.

## Path resolution

At runtime a component path resolves against the *page* URL. On disk, the
natural reading is relative to the module doing the registering. The two only
coincide when the entry module sits at the web root, so the plugin tries both
and requires exactly one to exist. An ambiguous path is reported rather than
guessed at.

## Requirements

- The plugin runs the framework's own parser, so it needs a DOM in Node. It
  installs `happy-dom` for that.
- Registrations are read as ESTree, which cannot represent TypeScript, so the
  plugin runs with `enforce: "post"` — after Vite's esbuild transform.
