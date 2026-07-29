# CSP sample — LadrillosJS with no `unsafe-eval`

A Vite project that builds LadrillosJS components ahead of time so the page can
run under a strict Content Security Policy:

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
object-src 'none';
base-uri 'none';
require-trusted-types-for 'script';
trusted-types ladrillosjs
```

No `'unsafe-eval'`, no `'unsafe-inline'`, and Trusted Types enforced.

## Run it

```bash
npm install
npm run build
npm run verify   # asserts the bundles contain no runtime code generation
npm run preview
```

The page reports its own CSP violations in the third card. If the setup is
working it says **None** — that number comes from the browser's
`securitypolicyviolation` event, not from a claim in this file.

## How it works

The default build compiles template expressions, inline handlers and component
scripts in the browser with the `Function` constructor, which is why it needs
`script-src 'unsafe-eval'`. This sample moves that work to build time.

Two pieces are involved:

**`@ladrillosjs/vite-plugin`** finds every `registerComponent()` call, reads the
component file, and replaces the call with a module containing the compiled
functions. It is configured with `strict: true` so the build *fails* rather than
silently leaving a component to be compiled in the browser — one missed
registration puts `'unsafe-eval'` back on the page.

**`ladrillosjs/csp`** is the runtime entry point that reads those precompiled
functions. It never imports the `Function` constructor at all, so it cannot
appear in the bundle even by accident.

```js
// src/main.js
import { registerComponent } from "ladrillosjs/csp";

registerComponent("csp-counter", "./components/counter.html");
```

The components themselves are ordinary LadrillosJS components. Nothing about
authoring changes — compare `components/counter.html` here with any other
sample.

## Constraints worth knowing

**Registrations must be statically analysable.** The plugin reads the tag name
and path out of the source, so both must be string literals:

```js
registerComponent("csp-counter", "./components/counter.html"); // ✅
registerComponent(name, `./components/${file}.html`);          // ❌ cannot precompile
```

Under `strict: true` the second form fails the build instead of quietly falling
back.

**No inline `<script>` or `<style>` in `index.html`.** `script-src 'self'` and
`style-src 'self'` block both. Page styles live in `src/app.css`. Component
`<style>` blocks are fine — the framework applies them as adopted stylesheets
rather than injecting `<style>` elements, which is why `style-src` needs no
`'unsafe-inline'`.

**The CSP is injected at build time only.** `vite serve` needs a websocket for
HMR, and the plugin does not precompile during dev unless you pass `dev: true`.
Use `npm run build && npm run preview` to see the sample under its policy. In
production, send the policy as a response header rather than a `<meta>` tag.

## Verifying it yourself

`npm run verify` greps the emitted bundles for `new Function`, `eval()` and
indirect eval, and checks the CSP actually landed in the HTML. To confirm the
checks are real, append `new Function("return 1")` to a file in `dist/assets/`
and run it again — it fails.

To see the policy doing its job, delete `trusted-types ladrillosjs` from
`POLICY` in `vite.config.js`, rebuild, and reload: the components stop
rendering and the violation is listed on the page.

## Note for this repository

`vite.config.js` aliases `ladrillosjs` to `../../src` so the sample tracks the
framework source. A real project deletes that `resolve` block and installs the
package normally.
