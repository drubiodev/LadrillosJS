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

## Phase 2 — `ladrillosjs/compiler` *(in progress)*

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
- [x] **Conformance suite:** 12 fixtures mounted through both backends asserting
      identical DOM, mutation-tested so none pass vacuously
- [x] Emitter ([src/compiler/emit.ts](src/compiler/emit.ts)) for evaluators,
      handlers and the reactive-state setup
- [x] Module scripts (`<script type="module">`), including imports
- [x] ~~`members:` / `values:` setup variants~~ — **unreachable, see below**
- [ ] Emit template/styles so the runtime can skip fetch + parse (bundling win,
      not needed for CSP)
- [ ] `defineCompiled` runtime helper

### Emitter status

[tests/unit/emitter.test.ts](tests/unit/emitter.test.ts) writes the generated
module to disk and loads it with a plain dynamic `import()` — if the output were
not valid standalone JavaScript the import itself would fail. For each fixture it
asserts three things: the rendered output matches a **pinned** expected string
(so "both paths agree" can never mean "both paths are broken"), emitted keys
cover **every** key the recorder observed, and the component renders identically
when driven only by those artifacts.

Generated output is minimal-arity static JS:

```js
export default {
  evaluators: {
    "item.id":   { deps: ["item"],  fn: (item) => (item.id) },
    "item.name": { deps: ["item"],  fn: (item) => (item.name) },
  },
  handlers: {
    "handler:count++": { deps: ["__state__","$refs","$host","event"],
                         fn: (__state__, $refs, $host, event) => { __state__.count++; } },
  },
  setups: {
    "state:let count = 0;": { deps: ["__state__"],
                             fn: (__state__) => { __state__.count ??= 0; } },
  },
};
```

The emitter reuses `extractVariableNames`, `extractFunctionDefinitions` and
`transformCodeToStateAccess`, so user code is rewritten by exactly the same
helpers the runtime uses. It is build-time only and is absent from every shipped
bundle (verified).

**Deps must exclude real globals.** An emitted `fn` declares its deps as
parameters, so declaring `Math` as a dep would shadow the real `Math` with
`undefined` whenever the runtime doesn't supply it. Deps are therefore
restricted to names the runtime is known to provide: declared script variables,
`templateBindings`, and in-scope loop variables.

This is only safe because `SHADOWED_GLOBALS` is empty — an undeclared name
resolves through the normal scope chain to the very same object the runtime
would have injected. **If the framework ever shadows a global again, those names
must be added to `MODULE_INJECTED` or emitted code will silently diverge from
the runtime.**

### Module scripts

`<script type="module">` is emitted as a `module:` setup: the async IIFE the
runtime builds, with `stripImports` / `extractDeclaredNames` / the state
transform applied by the *same* functions the runtime calls.

Import bindings become artifact **deps**, so the runtime still resolves
specifiers against the component URL and passes the values in as parameters:

```js
"module:import { TAX } from \"./rates.js\";\nlet price = 100 + TAX;":
  { deps: ["__state__", "TAX"],
    fn: async (__state__, TAX) => { __state__.price ??= 100 + TAX; return {}; } },
```

Relative-path semantics are therefore unchanged, and no `eval` is involved —
`importModule` has been a plain dynamic `import()` since Phase 0.

Two behaviours had to be mirrored exactly:

- **Handlers in module components must not re-declare functions.** The runtime
  emits `const { addItem } = __state__;` instead of rebuilding them, because
  module functions close over the module's imports. Rewriting references was not
  a substitute: `replaceVarWithStateAccess` deliberately skips identifiers
  followed by `(`, so `addItem()` is left alone and only resolves if bound.
- **Setups are per `<script>`, not per component.** The runtime calls
  `executeScriptWithReactiveState` once per script, so each tag is its own
  artifact keyed by its own source. The emitter previously joined them, which
  would have produced a key nothing ever requests.

### `members:` / `values:` are unreachable — *deleted*

`extractScriptMembers` and `extractScriptMembersValuesOnly` in
[scriptParser.ts](src/core/js/scriptParser.ts) were neither exported nor called
anywhere, so those two setup keys could never be requested and nothing needed to
emit them. Both have been removed (~130 lines). They were already tree-shaken
out of every shipped bundle, so this changes no output — it removes two codegen
call sites that the emitter could never satisfy.

### Packaging: subpath, decided

The compiler ships as `ladrillosjs/compiler`, not as a separate
`@ladrillosjs/compiler` package.

The deciding factor was not release infrastructure but *version coupling*. The
emitter is only ~13 KB of unique source; the ~127 KB it depends on
(`scriptParser`, `moduleExecutor`, `stateTransform`, `jsevents`) is already
shipped as runtime code. That reuse is deliberate — it is what stops the
build-time and runtime code-transform paths from drifting apart. A separate
package would have to either duplicate those modules or take a version-locked
dependency back on `ladrillosjs`, and a mismatched pair would emit artifacts
whose keys the runtime silently cannot find. A subpath makes that state
unrepresentable.

**Measured cost to applications:** +0.2–0.3 KB raw (~+0.1 KB gz) per runtime
entry, purely from Rollup splitting shared chunks differently once a sixth entry
exists. No compiler code enters any runtime bundle — asserted by check 3 in
[verify-no-eval.js](scripts/verify-no-eval.js), which walks the built import
graph of all five runtime entries, and mirrored at source level in
[entrypoints.test.ts](tests/unit/entrypoints.test.ts) so the mistake is caught in
review rather than at build time.

| Entry | Without compiler entry | With |
| --- | --- | --- |
| `dist/index.js` | 81.4 KB | 81.6 KB |
| `dist/core.js` | 81.0 KB | 81.3 KB |
| `dist/csp.js` | 82.4 KB | 82.7 KB |

The compiler entry itself is 89.6 KB raw / 29.3 KB gz and pulls in `DOMParser`,
since `parseComponent` is re-exported for build tools. It runs in Node, so that
number is not a page-weight cost.

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

- **`tests/integration/component-mount.test.ts` was skipped on an outdated
  premise** — it claimed happy-dom can't render reliably. It can: interpolation,
  event handlers, reactive re-render, keyed loops and conditionals all work. The
  file held four empty test bodies, and the conformance suite already covers all
  four cases against real mounted elements, so it has been deleted rather than
  left as a standing lie about the runner.
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

## Phase 3 — Vite plugin + the CSP build *(done)*

`ladrillosjs/csp` is a new entry point in
[vite.npm.config.ts](vite.npm.config.ts#L36) that **never imports
`runtimeBackend`**. Rollup isolates the `Function` constructor into a chunk that
only `index` and `core` load — so CSP compliance is structurally verifiable, not
a promise.

`@ladrillosjs/vite-plugin` rewrites
`registerComponent('my-counter', './counter.html')` into an import of the
compiled artifact. **Zero source changes for existing users** — that's what
makes this satisfy "doesn't break how it currently works." The dev server is
left alone by default, so editing a component stays a plain reload.

The plugin *is* a separate package — it is a build tool with its own dependency
on Vite, and pulling that into `ladrillosjs` would burden every consumer. It
takes a peer dependency on `ladrillosjs` and imports `ladrillosjs/compiler`,
which is why the packaging question above had to be settled first.

### How the rewrite works

Registrations are read as ESTree via Vite's own `parseAst` — free, since the
bundler already ships a parser, and build-time only, so it says nothing about
the runtime's no-AST design. Anything not statically analysable (a computed
path, a spread, `lazy: true`) is **reported and left alone** rather than
guessed at; an untouched call still works, it just needs `unsafe-eval`. The
`strict` option turns those reports into build failures.

Three things had to be settled to make it work, each verified by a mutation:

- **Plugin ordering.** ESTree cannot represent TypeScript, so the plugin runs
  with `enforce: "post"`, after Vite's esbuild transform. With `enforce: "pre"`
  a `.ts` entry fails to parse — confirmed by flipping it.
- **Path resolution.** At runtime a component path resolves against the *page*
  URL; on disk the natural reading is relative to the module registering it.
  Those only coincide when the entry sits at the web root, so the plugin tries
  both and requires exactly one to exist. Ambiguity is reported, not guessed.
- **Two module-scope DOM reads.** `new DOMParser()` in
  [extract.ts](src/core/component/extract.ts) and
  `createFrameworkHelpers(window.location.href)` in
  [frameworkHelpers.ts](src/core/helpers/frameworkHelpers.ts) ran at *import*
  time, so `import("ladrillosjs/compiler")` threw in Node before any DOM shim
  could be installed. Both are now built on first use.

Verified by [tests/unit/vitePlugin.test.ts](tests/unit/vitePlugin.test.ts),
which runs a real `vite build` over a real project resolving `ladrillosjs`
through node_modules — so it exercises the published entry points, not the
source tree — and asserts the minified output contains no `Function(` at all.

**Bug found and fixed here:** the emitted descriptor carried `sourcePath` as an
absolute `file:` URL, which would have shipped the build machine's home
directory in every production bundle. The plugin now rewrites it to a
root-relative path after parsing, since parsing needs the real URL but the
runtime only uses `sourcePath` in dev warnings.

### Correction: the CSP build is not smaller *yet*

An earlier draft of this section claimed the CSP build "should be both smaller
and faster to boot." Measured, that was wrong — it was **larger**. The
precompiled backend replaced the *codegen* step but not the *pipeline*: the
entry still fetched the .html file, ran it through `DOMParser`, and scanned the
template for bindings on every load.

`defineCompiled` closes the first half of that gap. The compiler now emits the
parsed component — template, scripts, styles, bindings — as data, and
`defineCompiled(component)` registers it with no fetch and no parse.

Initial download, following **static** imports only (what a browser must have
before the entry runs):

| Entry | Before | After | Change |
| --- | --- | --- | --- |
| `ladrillosjs` | 28.3 KB gz | **27.3 KB gz** | −1.0 KB |
| `ladrillosjs/core` | 28.2 KB gz | **27.2 KB gz** | −1.0 KB |
| `ladrillosjs/csp` | 28.7 KB gz | **27.7 KB gz** | −1.0 KB |

The HTML parser moved into a 4.2 KB chunk loaded only when something actually
calls `registerComponent`. That required making `parseComponent` a dynamic
import in [ladrillos.ts](src/core/ladrillos.ts) and
[lazyLoader.ts](src/core/lazy/lazyLoader.ts) — safe because all three call sites
were already `async`, and the CDN IIFE build simply inlines it (+192 bytes).

It also required moving `createRefsProxy` into
[refsProxy.ts](src/core/helpers/refsProxy.ts). `webcomponent.ts` imported it from
`frameworkHelpers`, which instantiates the framework singleton at module scope —
so mounting any component pinned the whole registration path.

**`ladrillosjs/csp` is still ~0.4 KB gz larger than `ladrillosjs`**, because the
artifact table costs more than `runtimeBackend`'s 307 bytes. It gets smaller
than the default build only once binding descriptors are precompiled too, which
would let the template scanner drop out. That is not scheduled.

**Why the parser cannot simply be dropped from the CSP entry:** component
scripts may call `registerComponent`/`$use` to register children, so
`scriptParser` imports `frameworkHelpers` by design. The coupling is semantic,
not accidental — which is why the fix is on-demand loading rather than removal.

### How the guarantee is made structural

The seam in [src/core/js/compiler.ts](src/core/js/compiler.ts) no longer ships a
default backend. `runtimeBackend` moved to its own module
([src/core/js/runtimeBackend.ts](src/core/js/runtimeBackend.ts)) — the only file
in the project that names the `Function` constructor — and each entry point
installs one at module scope:

| Entry | Installs |
| --- | --- |
| `ladrillosjs` | `runtimeBackend` |
| `ladrillosjs/core` | `runtimeBackend` |
| `ladrillosjs/csp` | `precompiledBackend` |
| `ladrillosjs/lazy` | *nothing* — it only adds loading strategies and cannot mount a component on its own |

Compiling with no backend installed throws rather than falling back to
`Function`; a silent fallback would put `eval` back into a CSP build without
anyone noticing.

**Measured, not assumed:** Rollup emits `runtimeBackend` as a standalone 307-byte
chunk. `dist/index.js` and `dist/core.js` import it; `dist/csp.js` and its whole
transitive graph do not.

**Two ordering hazards worth knowing:**

- Importing both `ladrillosjs` and `ladrillosjs/csp` into one bundle installs
  both backends — last module evaluated wins.
- Detection cannot grep for `new Function` alone: minified, the async variant
  reads `new n(...)`, where `n` came from
  `Object.getPrototypeOf(async function(){}).constructor`.
  `scripts/verify-no-eval.js` matches that construction too.

**Tasks**

- [x] `ladrillosjs/csp` entry point
- [x] `scripts/verify-no-eval.js`, wired into `build:all` and `prepublishOnly`
- [x] Test that each entry installs the backend it should
      ([tests/unit/entrypoints.test.ts](tests/unit/entrypoints.test.ts))
- [x] Emit the parsed component descriptor (template, scripts, styles)
- [x] `defineCompiled` — register without fetch or parse
      ([tests/unit/defineCompiled.test.ts](tests/unit/defineCompiled.test.ts))
- [x] Vite plugin: build rewrite, dev server untouched by default
      ([packages/vite-plugin](packages/vite-plugin/src/index.ts),
      [tests/unit/vitePlugin.test.ts](tests/unit/vitePlugin.test.ts))
- [ ] Document the eval-free policy in [docs/22-csp-and-security.md](docs/22-csp-and-security.md)

### Cost

The CDN bundle grew **+329 bytes** (86,740 → 87,069). That pushed it past the
85 KB budget in [scripts/verify-treeshaking.js](scripts/verify-treeshaking.js),
which was raised to 88 KB — the growth is understood and intentional, and that
budget exists to catch *unexpected* regressions. The verbose "no backend
installed" guidance is gated behind `__DEV__`, which recovered ~750 bytes of an
initial +1,076.

### Circular dependency found here (pre-existing) — *fixed*

Importing `src/lazy.ts` as the **first** module of a fresh graph threw
`TypeError: initLazyLoader is not a function`. The cycle is
`ladrillos → lazy → lazyLoader → webcomponent → scriptParser → frameworkHelpers
→ ladrillos`. Native ESM survives it, because `initLazyLoader` is a hoisted
function declaration; transforms that evaluate modules in dependency order and
read exports off a namespace object — Vite's SSR transform, and therefore
Vitest — do not, so the singleton's constructor saw `undefined`.

Fixed at the back edge, with the same technique used for the HTML parser:
[frameworkHelpers.ts](src/core/helpers/frameworkHelpers.ts) now loads the
`ladrillos` singleton via `import()` and keeps only a type-only static import.
All three call sites (`registerComponent`, `registerComponents`, `$use`) already
returned promises, so no signature changed.

[entrypoints.test.ts](tests/unit/entrypoints.test.ts) now imports `src/lazy.ts`
directly instead of reading its source as a workaround; restoring the static
import reproduces the original `TypeError`.

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

- [x] **Module scripts with `export` break — *fixed*.** A component whose module
      script uses `export` — either inline, or fetched from
      `<script type="module" src="./x.js">` without the `external` attribute —
      died with `SyntaxError: Unexpected token 'export'`.

      The diagnosis in the original note was wrong. `parseComponent` preserves
      `type: "module"` correctly and the state transform is not the culprit; the
      real cause is one layer down. A module script is inlined into a function
      body rather than evaluated as a module, and
      [executeModuleScriptWithReactivity](src/core/js/moduleExecutor.ts) stripped
      `import` but not `export` before handing the source to `compileSetup`.

      Fixed with a `stripExports` beside `stripImports`, applied on both sides of
      the seam — the runtime executor and
      [the emitter](src/compiler/emit.ts) — so the two paths cannot drift.
      Nothing is lost by dropping the keyword: every top-level declaration
      already becomes reactive state, which is what the export was signalling.

      Covered by the `module script with export statements` fixture in
      `emitter.test.ts`, which mounts through both paths and pins the output.
      Mutation-tested: restoring the old call fails the artifact-path assertion.

- [x] **`{fn(x)}` did not work when `fn` was a `function` declaration in a plain
      `<script>`.** It rendered as the literal text `{greet(name)}`, and the
      framework reported LJS103 `greet is not defined`.

      Interpolations are compiled with the component's *state keys* as
      parameters. A plain `<script>`'s `function` declarations were collected
      separately, as source text spliced into event-handler bodies, so they were
      reachable from `onclick` but invisible to an evaluator. Confirmed by
      probing the surrounding cases: `const greet = (n) => …` worked, the same
      `function greet` inside `<script type="module">` worked, and only the
      plain `<script>` + `function` combination failed. It is a documented
      feature — [docs/05-template-bindings.md](docs/05-template-bindings.md) has
      a "Function Calls" section whose example is literally
      `{greet(user.name)}`.

      Fixed by publishing plain-script function declarations onto the state, the
      way module scripts already did by returning their declarations. The setup
      body now ends with `__state__.greet ??= greet;` per declaration — `??=` so
      an attribute of the same name still wins, matching `let` semantics.

      The feared collision with the handler-splicing path does not happen:
      handlers destructure only the state keys whose values are *not* functions
      (`varNames` in [scriptParser.ts](src/core/js/scriptParser.ts)), so the
      spliced `function greet() {}` has nothing to clash with.

      This one also surfaced a **latent duplication**. The runtime and the
      build-time emitter each built the setup body themselves, so fixing the
      runtime left [emit.ts](src/compiler/emit.ts) behind and the artifact path
      failed with `greet is not a function` — caught immediately by the pinned
      emitter fixture. Rather than copy the fix, the construction moved into a
      shared `buildStateSetupBody`, which both paths now call.

      **Still broken, and pinned separately:** a binding whose only identifier
      is a function name (`{shout()}`) records no dependency on what the
      function reads, so a later `name = 'bo'` never invalidates it. The
      function does read state live — adding `{name}` to the same text node
      makes it update — so this is dependency tracking, not resolution, and it
      is independent of how the function is declared.

- [x] **Nested `<for>` does not expand the inner loop.** The inner `<for>`
      rendered its template exactly once, with its loop variable left as
      literal text: `{group.name}-{item}` yielded `a-{item}` instead of
      `a-1a-2`. [docs/08-loops.md](docs/08-loops.md) documents nested loops as
      supported, so this was a straight bug, not a missing feature.

      `scanLoops` skipped any `<for>` with a `<for>` ancestor, on the stated
      assumption that "those are processed when the outer loop renders an
      iteration" — but nothing ever did. `renderLoop` cloned the row template
      and ran the binding pass over it; the inner `<for>` just sat there as an
      unknown element, and its `{item}` text was bound against a context that
      had no `item`.

      Fixed in
      [directiveProcessor.ts](src/core/directives/directiveProcessor.ts) by
      actually rendering nested loops per row:

      - `createLoopDescriptor` was factored out of `scanLoops` so a `<for>`
        can be turned into a descriptor from inside a row clone, not just
        from the component host.
      - `renderLoop` takes an optional `scope` holding the enclosing loops'
        variables. It is merged into the pass context *before* the fast
        evaluator is built, so those names are part of its fixed key set, and
        into each row's handler context, so a handler can read the outer row's
        item. `state` stays the real reactive state, which keeps
        `__reactiveState__` and handler sync-back correct.
      - Each row's nested `<for>` elements are extracted at creation time and
        their descriptors stashed on the row element, so a *reused* row
        re-renders its own children against the item it now holds. All three
        reuse paths (identical-items, keyed, positional) do this.
      - `buildLoopTemplate` now wraps a lone nested `<for>`: a row must be
        exactly one element, and the nested loop replaces itself with a
        placeholder comment, so it needs a parent that survives.

      That last change exposed a second, subtler bug in the same scan.
      `scanLoops` skipped already-extracted elements with `!element.parentNode`,
      which is wrong: a nested `<for>` keeps a parent *inside the detached
      template*. It was therefore rescanned as a top-level loop, with no
      enclosing scope, and failed with `group is not defined`. The guard is now
      `!host.contains(element)`, which is what the code meant all along.

      **Both of the above were being reported as *conformant*.** The conformance
      suite only asserted that the two backends agree, and they agree perfectly
      on rendering these wrong. Every fixture in
      [conformance.test.ts](tests/unit/conformance.test.ts) and
      [emitter.test.ts](tests/unit/emitter.test.ts) now pins its expected
      output, so "both paths agree" can no longer mean "both paths are broken".
      That pin is what turned the nested-`<for>` fix into a verifiable change:
      the fixture failed the moment the behaviour changed. The remaining
      known-bad fixture keeps a `KNOWN BUG` comment so fixing it trips the test
      rather than passing quietly.

---

## What this buys in the argument

After Phase 3: *"Default build is runtime-evaluated and needs `unsafe-eval`,
documented. Add the Vite plugin and you get an eval-free build with a CI check
proving it — no source changes."*

That converts the strongest criticism into a feature comparison rather than a
disqualifier.
