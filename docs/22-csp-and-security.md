# Content Security Policy (CSP)

> **Short version:** LadrillosJS compiles your templates and component scripts
> in the browser, so a page using it needs `'unsafe-eval'` in `script-src`.
> This page tells you exactly which directives you need and why.

If your project cannot allow `'unsafe-eval'`, LadrillosJS is not a good fit
**today**. We would rather say that here than have you find out from a console
full of red. An opt-in, eval-free build is on the roadmap — see
[Roadmap](#roadmap-eval-free-builds).

Every policy on this page was tested against a real browser running a real
component, not inferred from reading the source. The
[Verification](#verification) section shows what was measured.

---

## Why `'unsafe-eval'` is required

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
for runtime compilation. You cannot have both.

---

## The policy you need

For a page using same-origin components:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  connect-src 'self';
```

Why each piece is needed:

| Directive | Reason | If you omit it |
| --- | --- | --- |
| `script-src 'unsafe-eval'` | Expressions, handlers, and scripts are compiled with `Function()` | Component renders raw `{count}`, handlers dead |
| `style-src 'unsafe-inline'` | A component's `<style>` block is injected as a `<style>` element | Markup and JS work, all component styles dropped |
| `connect-src 'self'` | Component `.html` files are fetched with `fetch()` | Component never loads at all (error `LJS505`) |

Add every origin you load components from to `connect-src`, and the CDN origin
to `script-src` if you load the framework from a CDN:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://cdn.jsdelivr.net;
```

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

LadrillosJS does **not** work under `require-trusted-types-for 'script'`.

The blocked sink is `DOMParser.parseFromString`, which the framework uses to
turn component markup into DOM:

```
TypeError: Failed to execute 'parseFromString' on 'DOMParser':
This document requires 'TrustedHTML' assignment.
```

The component fails to register (`LJS505`). Shipping an opt-in Trusted Types
policy is on the roadmap.

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
| `style-src 'self'` (no inline) | 2 × `style-src-elem :: inline`; JS fine, color falls back to black |
| `connect-src 'none'` | `connect-src` violation on the component URL; nothing renders |
| `require-trusted-types-for 'script'` | `require-trusted-types-for :: trusted-types-sink :: DOMParser parseFromString` |
| Inline `<script>`, inline `<script type="module">`, and module with `import` | `URL.createObjectURL` called **0 times** in all three — `blob:` unnecessary |
| After mount | `getAttribute("onclick")` → `null`, `el.onclick` → falsy; handler is an `addEventListener` listener |

---

## Roadmap: eval-free builds

An optional ahead-of-time compiler is planned:

1. **Route all code generation through one internal seam**, so `Function()`
   lives in exactly one module.
2. **Ship a precompiler** that turns a `.html` component into a `.js` module
   with every expression, handler, and script body emitted as a real closure.
3. **Ship a Vite plugin and an eval-free entry point.** The plugin rewrites
   `registerComponent()` calls to import precompiled artifacts, so **your
   component source does not change**. The eval-free entry never imports the
   runtime compiler, so `Function()` is absent from the bundle — verifiable in
   the output, not merely promised.

The no-build-step path is not going away. It stays the default. The compiler is
opt-in, for people who need `script-src` without `'unsafe-eval'`.

---

## Related

- [Security & Trust Model](../README.md#-security--trust-model) — why component
  HTML is treated as trusted code
- [Internal Architecture](./16-architecture.md) — how components are parsed and
  mounted
- [Error Handling](./21-error-handling.md) — `LJS505` and other diagnostics
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
