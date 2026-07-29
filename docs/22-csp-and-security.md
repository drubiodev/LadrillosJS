# Content Security Policy (CSP)

> **Short version:** by default LadrillosJS compiles your templates and
> component scripts in the browser, so a page using it needs `'unsafe-eval'` in
> `script-src`. Add [`@ladrillosjs/vite-plugin`](#eval-free-builds) and it does
> not — with no change to your components or your code.

There are two supported ways to run the same component, and they need different
policies:

| | Default (`ladrillosjs`) | Precompiled (`ladrillosjs/csp`) |
| --- | --- | --- |
| Build step | None | Vite plugin |
| Component code compiled | In the browser, at mount | At build time |
| `script-src 'unsafe-eval'` | **Required** | Not required |
| `.html` fetched at runtime | Yes | No |
| `style-src 'unsafe-inline'` | Not required | Not required |
| `require-trusted-types-for 'script'` | Not supported | Supported |

Pick your path: [the default policy](#the-policy-you-need), or
[eval-free builds](#eval-free-builds).

Every policy on this page was tested against a real browser running a real
component, not inferred from reading the source. The
[Verification](#verification) section shows what was measured.

---

## Why `'unsafe-eval'` is required *by default*

LadrillosJS has no build step. A component is just an `.html` file the browser
fetches at runtime. But something still has to turn this:

```html
<p>Count: {count} Double: {count * 2}</p>
<button onclick="count++">+</button>
<script>
  let count = 0;
</script>
```

…into running JavaScript. Frameworks with a compiler (Svelte, Vue SFCs, Angular
AOT) do that work on your machine ahead of time and ship plain JS. LadrillosJS
does it in the browser at mount time, using the
[`Function()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/Function).

CSP treats `Function()` exactly like `eval()`. If you set `script-src` (or
`default-src`) without `'unsafe-eval'`, it is blocked.

Three things get compiled this way, each cached per unique source string so the
cost is paid once, not per render:

| What | Example |
| --- | --- |
| Template expressions | `{count * 2}` |
| Inline event handlers | `onclick="count++"` |
| Component `<script>` bodies | `let count = 0;` |

**This is a deliberate trade-off, not an oversight:** no build step in exchange
for runtime compilation. You cannot have both — but you can choose, per
project, which one you want. See [eval-free builds](#eval-free-builds).

---

## The policy you need

For a page using same-origin components, on the **default** build:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-eval';
  style-src 'self';
  connect-src 'self';
```

Why each piece is needed:

| Directive | Reason | If you omit it |
| --- | --- | --- |
| `script-src 'unsafe-eval'` | Expressions, handlers, and scripts are compiled with `Function()` | Component renders raw `{count}`, handlers dead |
| `connect-src 'self'` | Component `.html` files are fetched with `fetch()` | Component never loads at all (error `LJS505`) |

Add every origin you load components from to `connect-src`, and the CDN origin
to `script-src` if you load the framework from a CDN:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net;
  style-src 'self';
  connect-src 'self' https://cdn.jsdelivr.net;
```

### Why styles need no `'unsafe-inline'`

A component's `<style>` block is applied as a [constructed
stylesheet](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet)
adopted into the shadow root (or the document, for light-DOM components), not
as an injected `<style>` element. `style-src` governs `<style>`, `<link>`,
`@import`, and `style` attributes — constructed stylesheets are none of those,
so they are not subject to it.

The one exception is CSS containing `@import`, which constructed stylesheets
drop. Those components fall back to a real `<style>` element and do still need
`'unsafe-inline'`. Prefer a `<link>` in the component, which is fetched
normally and only needs its origin in `style-src`.

### One harmless violation report remains

Under `style-src 'self'` you will still see exactly one report per component
*type*:

```
style-src-elem :: inline   (from DOMParser)
```

Registering a component parses its source with `DOMParser.parseFromString`, and
a `<style>` element in that parsed document trips `style-src-elem` even though
the document is never rendered and the element is discarded immediately after
its text is read.

Nothing breaks — measured in Chrome, the component renders, the styles apply,
and reactivity works. It is report noise, not a block. It fires once per
component type, not once per instance, because parsed sources are cached. If
your CSP reporting endpoint needs to be clean, this is currently unavoidable
without `'unsafe-inline'`.

### Components using `<script external>`

A script tagged `external` is a third-party library loaded as a real
`<script src>` tag, deliberately untouched by the framework:

```html
<script src="https://cdn.example.com/highlight.min.js" external></script>
```

Allow that origin in `script-src`. It is a normal script load — no special
keyword needed.

### Hardening with a nonce

Worth knowing: `'unsafe-inline'` is **ignored** when a policy contains a nonce
or hash, but `'unsafe-eval'` is **not**. So you can run a strict nonce-based
policy for your own `<script>` tags and still permit the framework's runtime
compilation:

```http
Content-Security-Policy:
  script-src 'nonce-{RANDOM}' 'unsafe-eval';
  object-src 'none';
  base-uri 'none';
```

This is meaningfully stronger than `script-src 'self' 'unsafe-eval'` — an
injected `<script>` tag still cannot run without the nonce. It does not mitigate
`'unsafe-eval'` itself.

---

## What LadrillosJS does *not* need

Stated explicitly, because these are commonly assumed:

- **`'unsafe-inline'` for scripts is NOT required.** Component scripts never
  become page `<script>` tags — they are compiled into functions. And inline
  handler attributes are **removed from the element** and reattached with
  `addEventListener()`, which is precisely the refactor
  [MDN recommends](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP).
  After mount, `button.getAttribute("onclick")` is `null` — verified below.
- **`blob:` is NOT required.** Component code is compiled with `Function()`,
  not loaded through blob URLs. No `URL.createObjectURL` call occurs on any
  component path — verified below, including module scripts with `import`
  statements.
- **`eval()` is never called**, and no string-argument `setTimeout` exists in
  the runtime. `Function()` is the only dynamic-code API used.
- **`javascript:` URLs are never generated.**

---

## Trusted Types

LadrillosJS works under `require-trusted-types-for 'script'` **on the CSP
build**. Its two HTML sinks — `DOMParser.parseFromString` and the `innerHTML`
of the detached parse template — go through a Trusted Types policy.

By default the framework creates its own policy, so you must allow its name:

```http
Content-Security-Policy:
  require-trusted-types-for 'script';
  trusted-types ladrillosjs;
  default-src 'self';
  script-src 'self';
  style-src 'self';
```

Trusted Types only exists in secure contexts (HTTPS or localhost). In browsers
without it, nothing changes: the sinks take plain strings, as they always have.

### The default policy does not sanitize

Be clear-eyed about what this buys you. The built-in policy is a **pass-through**
— `createHTML: (s) => s`. Its input is the component file you authored, and
sanitizing it would strip the markup the framework exists to render. What it
gives you is compatibility: the framework stops *blocking* an app that enforces
Trusted Types, and every other sink in your app stays guarded.

If your templates are assembled from untrusted input, supply a policy that
actually sanitizes:

```js
import { configure } from "ladrillosjs";

configure({
  trustedTypesPolicy: trustedTypes.createPolicy("app", {
    createHTML: (s) => DOMPurify.sanitize(s),
  }),
});
```

That also lets you reuse a policy name your CSP already allows, in which case
`ladrillosjs` does not need to be in the `trusted-types` list. Call `configure`
before the first component mounts.

### Why only the CSP build

`require-trusted-types-for 'script'` guards `new Function` too, and that sink
consults the **default** policy — the one named `default`, which applies to
every uncontrolled sink on the page. A library must not install one on your
behalf; doing so would silently weaken enforcement for your whole application.

So the default build, which compiles component scripts with `new Function`, is
still blocked. Use `ladrillosjs/csp` plus the build plugin (below), which emits
no code at runtime and therefore hits no script sinks at all.

---

## Testing your policy

Deploy report-only first. It enforces nothing and reports what *would* break:

```http
Content-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self' 'unsafe-eval';
  report-to csp-endpoint
```

Note that report-only cannot be delivered via a `<meta>` tag — it requires a
real HTTP header.

To catch violations in your own test suite:

```js
window.addEventListener("securitypolicyviolation", (e) => {
  console.log(e.effectiveDirective, e.blockedURI, e.sample);
});
```

Useful tools: [CSP Evaluator](https://csp-evaluator.withgoogle.com/) grades a
policy and flags weak spots; browser DevTools logs every violation with the
directive that caused it.

---

## Verification

The table above is not guesswork. Each policy was loaded in a real browser
against a component with a template expression, an inline handler, a `<style>`
block, and module scripts. Results:

| Policy under test | Observed |
| --- | --- |
| `script-src 'self' 'unsafe-eval'` | No violations; `Count: 0 Double: 0`, click increments correctly |
| `script-src 'self'` (no eval) | 4 × `script-src :: eval`; renders literal `{count} Double: {count * 2}` |
| `style-src 'self'` (no inline) | Styles apply (`rgb(255, 0, 0)`), 0 `<style>` elements, 1 adopted stylesheet, reactivity fine. 1 × `style-src-elem :: inline` report from `DOMParser` — see below |
| `connect-src 'none'` | `connect-src` violation on the component URL; nothing renders |
| `require-trusted-types-for 'script'` | Default build: `require-trusted-types-for :: trusted-types-sink :: eval`. CSP build with `trusted-types ladrillosjs`: no violations |
| Inline `<script>`, inline `<script type="module">`, and module with `import` | `URL.createObjectURL` called **0 times** in all three — `blob:` unnecessary |
| After mount | `getAttribute("onclick")` → `null`, `el.onclick` → falsy; handler is an `addEventListener` listener |

---

## Eval-free builds

If you use Vite, you can drop `'unsafe-eval'` entirely. Two pieces do it:

- **`ladrillosjs/csp`** — an entry point that reads component code from
  artifacts generated at build time. It never imports the runtime compiler, so
  `Function()` is not in the bundle at all.
- **`@ladrillosjs/vite-plugin`** — generates those artifacts and rewrites your
  registration calls to use them.

### Setup

```bash
npm install -D @ladrillosjs/vite-plugin
```

```js
// vite.config.js
import ladrillos from "@ladrillosjs/vite-plugin";

export default { plugins: [ladrillos()] };
```

That is the whole change. **Your components do not change and your application
code does not change.** The plugin rewrites

```js
registerComponent("my-counter", "./components/counter.html");
```

into an import of the compiled component plus a call that registers it — so
there is no fetch, no HTML parse, and no code generation left on the page.

To also drop the now-unused compiler from your bundle, import from the
eval-free entry:

```js
import { registerComponent } from "ladrillosjs/csp";
```

Do not mix `ladrillosjs` and `ladrillosjs/csp` in one bundle. Both install a
code-generation backend when their module body runs, so whichever evaluates
last wins — and pulling in a non-CSP entry puts `Function()` back in the output
regardless.

Then tighten the policy:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self';
```

`connect-src` no longer needs an entry for components — they are in the bundle.
No `'unsafe-eval'`, and no `'unsafe-inline'` for styles either.

### What the plugin will not precompile

The plugin reads registrations statically. Anything it cannot resolve with
certainty it **leaves alone and reports**, rather than guessing:

```js
registerComponent(name, path);                    // not string literals
registerComponent("x", `./${dir}/x.html`);        // interpolated path
registerComponents([...list]);                    // spread
registerComponents([{ tag: "x", path: "./x.html", lazy: true }]);  // lazy
```

A left-alone call still works — it falls back to runtime compilation, which
means that page needs `'unsafe-eval'` again. You will see:

```
Left a component registration for the runtime to handle: path is not a string
literal. (src/main.js, offset 412) The page will need script-src 'unsafe-eval'
unless this is precompiled.
```

Turn those warnings into build failures:

```js
ladrillos({ strict: true })
```

Use `strict` in CI once you are on a strict CSP. It is the difference between
intending to be eval-free and being eval-free.

`lazy: true` is skipped on purpose: a lazy component is one you asked *not* to
define up front, and precompiling it would pull it into the initial bundle and
undo that.

If something does slip into a `ladrillosjs/csp` bundle unprecompiled, it fails
loudly rather than degrading — there is no compiler to fall back to, so you get
a `MissingArtifactError` naming the expression it could not find.

### Verifying it rather than trusting it

"This bundle cannot generate code" is worth checking, because one stray import
can undo it silently.

In your own project, grep the **minified** production bundle:

```bash
grep -c "new Function\|(0,eval)" dist/assets/*.js
```

Minified matters: unminified bundles keep comments, and the word `Function`
appears in plenty of them.

In this repo, `npm run build:all` runs
[scripts/verify-no-eval.js](../scripts/verify-no-eval.js) against the built
output. It matches `new Function`, `Function("…")`, direct and indirect `eval`,
and the minified `AsyncFunction` construction — not just the literal text,
which survives minification only by accident. It also asserts the *opposite*
for the default entry: if `dist/index.js` ever stops containing code
generation, the runtime build is broken and the CSP check would be passing for
the wrong reason.

### What is still missing

- **`'unsafe-inline'` is still needed for CSS containing `@import`.** Constructed
  stylesheets drop `@import`, so that CSS falls back to a `<style>` element.
  Use a `<link>` instead and the exception goes away.
- **One spurious `style-src-elem` report per component type**, from the
  `DOMParser` pass that reads the component source. Harmless but noisy — see
  [above](#one-harmless-violation-report-remains).
- **Trusted Types work on the CSP build only.** The default build's
  `new Function` needs a default policy, which a library must not install for
  you — see above.
- **The precompiled build is not yet smaller.** It removes code generation, not
  bytes; the two are within about 1 KB gzipped of each other.

The no-build-step path is not going away. It stays the default. Precompilation
is opt-in, for people who need `script-src` without `'unsafe-eval'`.

---

## Related

- [Security & Trust Model](../README.md#-security--trust-model) — why component
  HTML is treated as trusted code
- [Internal Architecture](./16-architecture.md) — how components are parsed and
  mounted
- [Error Handling](./21-error-handling.md) — `LJS505` and other diagnostics
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
