# CDN sample — no build step, strict CSP

The counterpart to [csp-vite](../csp-vite). Same three components, no build
step: LadrillosJS is loaded from a `<script>` tag and compiles the components in
the browser.

The point of this sample is to show how far you can lock a page down *without*
adopting a build step, and to be honest about the one thing you cannot remove.

```
default-src 'self';
script-src 'self' 'unsafe-eval';
style-src 'self';
connect-src 'self';
img-src 'self' data:;
object-src 'none';
base-uri 'none'
```

## Run it

```bash
npm run dev:cdn-csp     # from the repo root
```

Then open <http://127.0.0.1:8081>. That builds the CDN bundle and serves this
folder with the repo root as a fallback, so `/dist-cdn/ladrillos.iife.js`
resolves same-origin.

## What is measured

Verified in Chrome on this page:

| Claim | Result |
| --- | --- |
| Components render and handlers fire | Counter increments, `$bind` updates the greeting |
| `style-src` needs no `'unsafe-inline'` | `shadowRoot.querySelectorAll("style").length === 0`, `adoptedStyleSheets.length === 1`, card background applied |
| Reports that remain | Exactly 3 `style-src-elem` — one per component *type* |

The violation count on the page comes from the browser's own
`securitypolicyviolation` event, not from this file.

### About those three reports

Registering a component parses its source with `DOMParser`. A `<style>` element
in that throwaway document trips `style-src-elem` even though the document is
never rendered and the element is discarded once its text has been read. It is
reported, not blocking: the styles still apply, via a constructed stylesheet
adopted into the shadow root.

It fires once per component type, not once per instance, because parsed sources
are cached. If your reporting endpoint must be clean, use
[csp-vite](../csp-vite) — parsing happens on the build machine there, so
`DOMParser` never runs and the reports do not exist.

## Why `'unsafe-eval'` is here

With no build step there is nowhere but the browser to turn `{count * 2}` and
`onclick="count++"` into functions, so the framework does it with `Function()`.

That is a real trade, so the sample lets you see both sides of it. Two
experiments, both measured:

**Remove `'unsafe-eval'` from the policy.** The page renders `Count: {count}`
literally, the buttons do nothing, and a `script-src` violation is reported.

**Add `require-trusted-types-for 'script'`.** Same outcome, reported as
`require-trusted-types-for`. Trusted Types work on the precompiled build only —
the default build's `Function()` call needs a *default* policy, which a library
must not install on your behalf, since a default policy applies to every sink on
the page including your own code.

Both are fixed by moving compilation to build time. That is
[csp-vite](../csp-vite), which runs with `script-src 'self'`, Trusted Types
enforced, and zero violations.

## Writing your own page under this policy

Two constraints, both from the policy rather than from LadrillosJS:

- **No inline `<script>`.** `script-src 'self'` blocks it, so registration lives
  in `app.js`. Note it is `<script type="module" src="...">`, not an inline
  module.
- **No inline `<style>`.** `style-src 'self'` blocks it, so page styles live in
  `app.css`. Component `<style>` blocks are unaffected — those are adopted, not
  injected.

Loading the framework from a real CDN rather than same-origin means adding that
origin to `script-src`, and adding any origin you fetch components from to
`connect-src`:

```
script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net;
connect-src 'self' https://cdn.jsdelivr.net;
```

In production, send the policy as a response header. The `<meta>` tag in
`index.html` is used only so the sample works with any static file server.

## Related

- [csp-vite](../csp-vite) — the same components with `'unsafe-eval'` removed
- [docs/22-csp-and-security.md](../../docs/22-csp-and-security.md)
