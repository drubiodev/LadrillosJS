# Security Considerations

LadrillosJS is a thin reactive runtime for native Web Components. This document
describes the security properties you should understand when shipping it to
production.

## Threat model

LadrillosJS runs **in the browser**, alongside your application code and any
third-party scripts you load. It is not a sandbox. It expects component sources
(HTML templates + `<script>` blocks) to come from a source you trust — typically
your own origin.

## 1. `Function` constructor / expression evaluation

Template bindings such as `{count + 1}`, `$if="isOpen"`, and
`$on:click="count++"` are compiled into short functions via the `Function`
constructor. This means:

- **Content Security Policy (CSP) must allow `unsafe-eval`** for the origin
  serving your LadrillosJS bundle. A strict `script-src 'self'` policy without
  `unsafe-eval` **will break LadrillosJS**.
- Because the expressions are constructed from your component HTML files, you
  **must not** let untrusted users author or inject component templates. Treat
  `.html` component files like source code, not like user-generated content.

If you need to render untrusted content, do it **inside** a component using
`textContent`-style bindings (`{userInput}`), never by concatenating it into
a template.

## 2. Template interpolation and HTML

Single-brace bindings (`{value}`) render as **text**, not HTML. This is safe
for arbitrary user data.

If you set `innerHTML` yourself or use any component-provided attribute that
evaluates HTML, you are responsible for sanitizing it.

## 3. Component source fetching

`registerComponent("my-cmp", "./my-cmp.html")` uses `fetch()` to load the
template. Paths are resolved relative to `window.location`. Always serve
components from a trusted origin; never register a component from a URL
constructed from user input.

## 4. Event listeners and modifiers

Event handler expressions (`$on:click="…"`) run in the same evaluation context
as bindings. The same CSP / trust rules apply.

## 5. Reporting a vulnerability

Please **do not** open a public issue. See
[`SECURITY.md`](../SECURITY.md) for the private disclosure process.

## 6. Recommendations

- Serve LadrillosJS and its components from the same trusted origin.
- Use Subresource Integrity (`integrity="sha384-…"`) when loading from a CDN.
- Apply a CSP that restricts `script-src` to your origin(s) + `unsafe-eval`.
- Keep component templates in your source repository — review them like code.
- Use `configure({ onError: (e, ctx) => report(e, ctx) })` to monitor
  framework-level failures in production.
