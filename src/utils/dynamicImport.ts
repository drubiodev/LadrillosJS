/**
 * Runtime module loading.
 *
 * Component modules are imported from specifiers that only exist at runtime:
 * a `blob:` URL for inline `<script type="module">` bodies, or an absolute URL
 * for external ones. Bundlers must not try to resolve those at build time,
 * hence the ignore hints below.
 *
 * HISTORY: this used to be written as indirect eval —
 * `await (0, eval)(\`import("${url}")\`)` — purely to hide the specifier from
 * bundler static analysis. That form made the page require the `'unsafe-eval'`
 * CSP directive for what is really a plain dynamic import. The comment hints
 * achieve the same "don't touch this" result without eval, so pages no longer
 * pay `'unsafe-eval'` on account of module loading.
 *
 * NOTE: `blob:` URLs still require `script-src blob:` in a page's CSP. See
 * docs/22-csp-and-security.md.
 */
export function importModule(url: string): Promise<Record<string, unknown>> {
  return import(/* @vite-ignore */ /* webpackIgnore: true */ url) as Promise<
    Record<string, unknown>
  >;
}
