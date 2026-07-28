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

## Phase 1 — The compiler seam ✅ COMPLETE

Branch `phase-1/compiler-seam`. Pure refactor, zero behavior change.

[src/core/js/compiler.ts](src/core/js/compiler.ts) is now the **only** place
`new Function` exists. All seven previous call sites delegate to it:

- [scriptParser.ts](src/core/js/scriptParser.ts#L480) · [L775](src/core/js/scriptParser.ts#L775) · [L845](src/core/js/scriptParser.ts#L845) · [L929](src/core/js/scriptParser.ts#L929) · [L1459](src/core/js/scriptParser.ts#L1459)
- [directiveProcessor.ts](src/core/directives/directiveProcessor.ts#L2479)
- [moduleExecutor.ts](src/core/js/moduleExecutor.ts#L1428)

```ts
export interface CodegenBackend {
  readonly name: string;
  compileEvaluator(params: readonly string[], expression: string): CompiledFn;
  compileHandler(params: readonly string[], body: string, isAsync: boolean): CompiledFn;
  compileSetup(params: readonly string[], body: string): CompiledFn;
}
```

Two implementations:

- `runtimeBackend` — today's `new Function` code, moved verbatim. Keeps the
  positional-args fast path internally so no perf work is lost.
- `precompiledBackend` — Phase 2.

Default stays `runtimeBackend`.

**Tasks**

- [x] Define `CodegenBackend`
- [x] Extract `runtimeBackend` from the seven call sites, verbatim
- [x] Add backend selection (default `runtimeBackend`)
- [x] Confirm caches still key identically — `evaluatorCache` and
      `loopHandlerFnCache` are untouched and still memoize by source text
- [x] Tests proving the backend is swappable and that a backend which never
      calls `Function` satisfies the interface

**Acceptance results**

| Gate | Result |
|---|---|
| Tests | 190 pass (181 existing unchanged + 9 new) |
| Typecheck | clean |
| Benchmarks | within noise — see below |
| CDN bundle | 29.01 → 29.12 KB gzip (+0.11 KB) |

Benchmark deltas were at or below the movement seen in React and Vanilla, whose
code did not change and therefore establish the noise floor for the run
(e.g. Ladrillos `create 1,000` 3.2 → 3.4 ms while unchanged Vanilla
`partial update` moved 0.1 → 0.2 ms and React `replace 1,000` moved
6.3 → 7.0 ms). Ladrillos `create 10,000` was slightly *faster* at 28.6 ms vs
29.1 ms baseline.

The committed [benchmarks/results.md](benchmarks/results.md) snapshot was
deliberately left unmodified — re-recording it every run adds churn without
signal.

---

## Phase 2 — `@ladrillosjs/compiler` *(in progress)*

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

### What's built (commit `121dc96`)

The artifact format and calling convention were built and validated *before*
the emitter, so the design meets the runtime's real constraints rather than an
assumed one. Two constraints reshaped the sketch above:

**1. Artifacts cannot hardcode parameter positions.** The sketch assumes
`s => s.count`. The runtime actually calls evaluators positionally with
`[...shadowedGlobals, ...Object.keys(state)]`, and state keys vary per mount
because attributes add keys — which is why the runtime caches per key-signature
and caps at `MAX_EVALUATOR_SIGNATURES = 100`. So an artifact declares its
dependencies **by name**:

```js
"count * 2": { deps: ["count"], fn: count => count * 2 }
```

`bind()` in [precompiled.ts](src/core/js/precompiled.ts) resolves names to
positions **once, at compile time**, then returns an arity-specialised closure.
Per call: a fixed number of indexed reads, no rest-parameter array, no scope
object — so the hot path stays comparable to the runtime backend.

**2. Handlers and setups cannot be keyed by the seam's `body` string.** That
string is a wrapper the runtime builds at call time (`destructureVars`,
`funcDefs`, sync-back, `//# sourceURL`), which a build-time compiler cannot
reproduce. They are keyed by **authored source** instead, which required
threading a `key` parameter through the seam. Because the same script content
reaches three different setup call sites with different wrappers, keys are
namespaced per site (`members:`, `values:`, `state:`, `module:`) or they
collide.

The default runtime backend is unchanged — `key` defaults to `body`.
`precompiled.ts` is imported by nothing, so it **tree-shakes out of every
shipped bundle** (verified: zero occurrences in `dist/` and `dist-cdn/`).
Existing users pay nothing for it.

**Tasks**

- [x] Artifact format (`deps` by name) + `precompiledBackend`
- [x] Authored-source keys threaded through the seam at all 7 call sites
- [x] Backend-interchangeability tests (8 tests: dep mapping, missing deps,
      high arity, missing-artifact error, runtime-vs-precompiled parity)
- [x] Cache invalidation on backend swap (`onBackendChange`)
- [x] **Conformance suite:** 5 fixtures mounted through both backends asserting
      identical DOM, mutation-tested to confirm it fails when mapping breaks
- [ ] Emit evaluators, handlers, setup, template bindings
- [ ] Loop evaluator `(state, rowCtx)` signature
- [ ] `defineCompiled` runtime helper
- [ ] Grow the fixture set toward full directive coverage (`$bind`, `$ref`,
      `$on:` modifiers, nested loops, `<show>`)

### Open decision: packaging

Shipping the compiler as a subpath export (`ladrillosjs/compiler`) rather than a
separate `@ladrillosjs/compiler` package would mean less release infrastructure
and a single version number to keep in sync; browsers never import it, so it
costs runtime users nothing either way. **Not yet decided.**

### Conformance suite runs in vitest (no browser needed)

[tests/unit/conformance.test.ts](tests/unit/conformance.test.ts) mounts each
fixture twice — once on the real runtime, once on artifacts only — and asserts
identical rendered DOM.

Ground truth comes from the runtime rather than a hand-written fixture list: a
recording backend captures every `(kind, key, params)` the real pipeline asks
for, and those recordings become the artifact table for the second mount. The
emitter's job is then defined mechanically — produce exactly the keys the
recorder observes.

Two things this flushed out:

- **`tests/integration/component-mount.test.ts` is skipped on an outdated
  premise.** It claims happy-dom can't render reliably. It can: interpolation,
  event handlers, reactive re-render, keyed loops and conditionals all work.
  That test file should be revisited.
- **Swapping backends without invalidating caches was a latent bug.**
  `evaluatorCache` is module-level and keyed by state-key signature, so a second
  component with the same expressions reused the *previous backend's* compiled
  functions. `setCodegenBackend` now runs registered invalidators
  (`onBackendChange`). Found because a deliberately broken index mapping still
  let 3 of 5 fixtures pass — the suite was partly vacuous. It now fails all 5.

**Note on `deps`:** an artifact's `deps` describes *that function's own*
signature, not the runtime's parameter list. Emitted functions take only what
they use; the backend maps names to the runtime's positions.

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
