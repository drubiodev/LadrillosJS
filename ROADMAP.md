# LadrillosJS Roadmap — CSP & Codegen

Working plan for making LadrillosJS viable under a strict Content Security
Policy without giving up the no-build-step identity.

**Organizing principle:** every criticism is neutralized by one architectural
move — routing all code generation through a single seam — and everything else
is documentation or renaming.

## Non-negotiables

These constrain every phase below:

- The build step **never** becomes mandatory. CDN + `.html` + zero tooling stays
  the documented default.
- No change to component authoring syntax.
- No runtime dependencies added.
- No public API breakage.

## The key insight

The runtime already caches compiled functions **keyed by expression source
string**:

- [src/core/js/scriptParser.ts](src/core/js/scriptParser.ts#L1349) — `evaluatorCache` (keysSig → expr → fn)
- [src/core/directives/directiveProcessor.ts](src/core/directives/directiveProcessor.ts#L2470) — `loopHandlerFnCache` (fnBody → fn)

A precompiler therefore doesn't need to change how the runtime works. It just
**pre-populates those caches** with real closures emitted at build time. Same
lookup key, same call site. That's why this is tractable without a rewrite.

---

## Phase 0 — Quick wins ✅ COMPLETE

Branch `phase-0/csp-groundwork`. No architecture change.

| # | Change | Status | Commit |
|---|---|---|---|
| 0.1 | Replace `(0, eval)('import(url)')` with real `import()` | ✅ | `b4a25f8` |
| 0.3 | Rename `sandbox.ts` → `globalScope.ts`, `ALLOWED_GLOBALS` → `INJECTED_GLOBALS`, `BLOCKED_GLOBALS` → `SHADOWED_GLOBALS` | ✅ | `51dcfe9` |
| 0.4 | Consolidate four `__ladrillos*` globals into one `globalThis.__ladrillos`, keeping aliases | ✅ | `9e96631` |
| 0.2 | Add [docs/22-csp-and-security.md](docs/22-csp-and-security.md) + README section | ✅ | `ecf74c2` |

**Outcome:** 181 tests pass, typecheck clean, both builds green, zero `eval(` in
any bundle.

### What Phase 0 verification changed

The CSP requirements were measured in a real browser under each policy rather
than inferred from source. Two assumptions in the original plan were **wrong**:

- **`blob:` is not required.** `URL.createObjectURL` is called zero times on
  every component path tested — including inline `<script type="module">` and
  modules with real `import` statements. The blob branch in
  [executeExternalScript](src/core/js/moduleExecutor.ts#L714) is only reachable
  for `type="module"` *without* the `external` attribute, but
  [extract.ts](src/core/component/extract.ts#L372) already routes those to the
  inlined path. The branch is effectively dead.
- **The Trusted Types sink is `DOMParser.parseFromString`,** not
  `innerHTML` as assumed. This changes what Phase 4 has to fix.

Verified requirements: `script-src 'unsafe-eval'`, `style-src 'unsafe-inline'`,
`connect-src <origin>`. Verified *not* needed: `script-src 'unsafe-inline'`
(inline `onclick` attributes are removed and reattached via `addEventListener`).

---

## Phase 1 — The compiler seam

Pure refactor, zero behavior change.

New module `src/core/js/compiler.ts` becomes the **only** place `new Function`
exists. Every current site delegates to it:

- [scriptParser.ts](src/core/js/scriptParser.ts#L480) · [L775](src/core/js/scriptParser.ts#L775) · [L845](src/core/js/scriptParser.ts#L845) · [L929](src/core/js/scriptParser.ts#L929) · [L1459](src/core/js/scriptParser.ts#L1459)
- [directiveProcessor.ts](src/core/directives/directiveProcessor.ts#L2479)
- [moduleExecutor.ts](src/core/js/moduleExecutor.ts#L1428)

```ts
export interface CodegenBackend {
  resolveEvaluator(expr: string, shape: ContextShape): Evaluator | null;
  resolveHandler(code: string, shape: ContextShape): Handler | null;
  resolveSetup(source: string, shape: ContextShape): SetupFn | null;
}
```

Two implementations:

- `runtimeBackend` — today's `new Function` code, moved verbatim. Keeps the
  positional-args fast path internally so no perf work is lost.
- `precompiledBackend` — Phase 2.

Default stays `runtimeBackend`.

**Tasks**

- [ ] Define `CodegenBackend` and `ContextShape`
- [ ] Extract `runtimeBackend` from the seven call sites, verbatim
- [ ] Add backend selection (default `runtimeBackend`)
- [ ] Confirm caches still key identically

**Acceptance gate:** all tests pass unchanged; benchmarks within noise of
[benchmarks/results.md](benchmarks/results.md).

---

## Phase 2 — `@ladrillosjs/compiler`

Build-time package that turns `counter.html` into a `.js` module:

```js
import { defineCompiled } from "ladrillosjs/csp";
export default defineCompiled({
  tagName: "my-counter",
  template: "…", styles: "…", templateBindings: ["count"],
  evaluators: { "count": s => s.count, "count * 2": s => s.count * 2 },
  handlers:   { "count++": s => { s.count++; }, "count = 0": s => { s.count = 0; } },
  setup: (__state__, $host, $refs, $emit, $listen) => { __state__.count = 0; },
});
```

**Non-negotiable design rule:** the compiler imports the *same* pure functions
the runtime uses — `parseComponent`
([extract.ts](src/core/component/extract.ts#L255)),
`transformCodeToStateAccess`, `maskFunctionBodies` — so semantics can't drift
between the two paths. `parseComponent` needs `DOMParser`; happy-dom is already
a devDependency, so the Node story is proven.

Loop evaluators get a `(state, rowCtx)` signature — the compiler knows the loop
variable names because it parses the `<for>` expression at build time.

**Tasks**

- [ ] Package scaffold + `defineCompiled` runtime helper
- [ ] Emit evaluators, handlers, setup, template bindings
- [ ] Loop evaluator `(state, rowCtx)` signature
- [ ] **Conformance suite:** run every fixture through both backends and assert
      byte-identical DOM

The conformance suite is the mechanical guarantee that nothing breaks.

---

## Phase 3 — Vite plugin + the CSP build

`ladrillosjs/csp` is a new entry point in
[vite.npm.config.ts](vite.npm.config.ts#L36) that **never imports
`runtimeBackend`**. Terser drops every `new Function` site from the bundle — so
CSP compliance is structurally verifiable, not a promise.

`@ladrillosjs/vite-plugin` in prod mode rewrites
`registerComponent('my-counter', './counter.html')` into an import of the
compiled artifact. **Zero source changes for existing users** — that's what
makes this satisfy "doesn't break how it currently works." Dev mode keeps
runtime compilation for fast HMR.

Bonus: precompiling the binding descriptors also eliminates the template scan on
every mount, so the CSP build should be both *smaller and faster to boot* than
the CDN build.

**Tasks**

- [ ] `ladrillosjs/csp` entry point
- [ ] `scripts/verify-no-eval.js`, wired into `prepublishOnly`
- [ ] Vite plugin: prod rewrite, dev passthrough
- [ ] Document the eval-free policy in [docs/22-csp-and-security.md](docs/22-csp-and-security.md)

---

## Phase 4 — Trusted Types (optional)

Add an optional policy behind `configure({ trustedTypesPolicy })`.

Note the corrected target: the blocking sink is **`DOMParser.parseFromString`**,
used when registering a component. Under
`require-trusted-types-for 'script'` the component fails to register with
`LJS505`. [htmlparser.ts](src/core/html/htmlparser.ts#L47) also assigns
`innerHTML` and needs the same treatment.

**Tasks**

- [ ] `configure({ trustedTypesPolicy })`
- [ ] Route `parseFromString` and `innerHTML` through the policy
- [ ] Verify under `require-trusted-types-for 'script'`

---

## Known limitations to document

1. `$use()` / `registerComponent()` with a runtime-variable path can't be
   precompiled — document as a CSP-build limitation.
2. Components fetched at runtime from an origin unknown at build time likewise
   can't be precompiled.

> The original plan listed "inline `<script type="module">` uses blob URLs" as a
> limitation. Phase 0 testing disproved it — no blob URLs are used. Removed.

---

## Unrelated bugs found along the way

- [ ] **External module `src` breaks.** A component with
      `<script type="module" src="./x.js">` (no `external` attribute) has its
      fetched content run through the reactive state transform, producing
      `export __state__.label ??= …` → `SyntaxError: Unexpected token 'export'`.
      The inlining path in [extract.ts](src/core/component/extract.ts#L372)
      needs to strip `export` keywords the way the inline module path does.

---

## What this buys in the argument

After Phase 3: *"Default build is runtime-evaluated and needs `unsafe-eval`,
documented. Add the Vite plugin and you get an eval-free build with a CI check
proving it — no source changes."*

That converts the strongest criticism into a feature comparison rather than a
disqualifier.
