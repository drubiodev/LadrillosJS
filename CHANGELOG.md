# Changelog

All notable changes to **LadrillosJS** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2025

### Breaking Changes

- **Removed** the legacy 4-positional `registerComponent` / `registerComponents`
  signature and normalized the public registration API:
  - `registerComponent(name, path, useShadowDOM?, lazy?)` — same name, now the
    single canonical helper (no legacy variant).
  - `registerComponents(configs)` — same name, canonical helper.
  - `$use(path)` — new shorthand that auto-derives the tag name from the path.
    See the migration guide in `docs/18-migration-v1-to-v2.md`.
- **Dropped CommonJS output.** The package now ships **ESM only** with four entry
  points: `ladrillosjs`, `ladrillosjs/core`, `ladrillosjs/lazy`,
  `ladrillosjs/events`. Consumers on CommonJS must migrate to ESM or use a bundler.
- **`loadTemplate` contract simplified.** Returns only `{ bindings }`; the legacy
  `twoWayBindings`, `conditionals`, and `loops` fields were removed (they were
  already unused by the runtime).
- **Error handling unified.** Internal uses of `console.error` and
  `console.warn` have been routed through the framework's styled error/warn
  pipeline. Consumers can now intercept framework errors with
  `configure({ onError })`.

### Added

- **`configure(config)`** — runtime framework configuration:
  - `cacheSize` — tune the component source LRU cache.
  - `onError` — install a custom error handler (receives the `Error` and
    optional context such as `{ tagName, sourcePath }`).
- **`ErrorCode` enum** — typed error codes exposed for consumers to branch on.
- **`LadrillosComponent` type** — public-facing component descriptor type.
- **`$use(name?, path)`** — component registration with auto-derived tag name
  when `name` is omitted.
- **Granular imports.** Bundle only what you use:
  - `import { $registerComponent } from "ladrillosjs/core"`
  - `import { lazyOnVisible } from "ladrillosjs/lazy"`
  - `import { $emit, $listen } from "ladrillosjs/events"`
- **Tree-shaking verification** (`scripts/verify-treeshaking.js`) now runs in
  `prepublishOnly`.
- **Unit test suite** with Vitest + happy-dom covering the reactivity system,
  scheduler, list-diff algorithm, event bus, expression cache, component source
  cache, lazy strategies, key modifier parsing, and sandbox constants.
- **LICENSE** (MIT), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and
  issue / PR templates.
- **GitHub Actions CI** — build, typecheck, test, verify-treeshaking on every
  push.

### Changed

- **TypeScript `strict` + `noImplicitReturns` + `noFallthroughCasesInSwitch` +
  `isolatedModules`** enabled for src.
- `package.json`:
  - `"sideEffects": false` for optimal tree-shaking.
  - Publish metadata: `engines.node >= 18`, keywords, `publishConfig.provenance`.
  - Explicit `files` allowlist — only built JS, sourcemaps, d.ts, LICENSE, README
    and CHANGELOG are shipped.
  - New scripts: `clean`, `typecheck`, `test`, `test:watch`, `test:coverage`,
    `test:ci`, `prepublishOnly`.
- All README CDN examples now point at
  `https://cdn.jsdelivr.net/npm/ladrillosjs@2/dist/index.js` (ESM).
- `vite.npm.config.ts` now emits sourcemaps and ships a full `src/**/*.d.ts`
  tree (33 declaration files), preserving granular type imports.
- `.gitignore` expanded to cover `samples/*/node_modules`, `dist-cdn`,
  `coverage`, IDE folders, env files.

### Fixed

- Stale legacy dist artifacts (`ladrillosjs.{umd,cjs,es}.js`, `store.d.ts`,
  hashed chunks from pre-v2 Vite config) are purged on every build via the new
  `clean` script.
- `src/core/cache/expressionCache.ts`, `src/core/scheduler/batchScheduler.ts`,
  `src/core/directives/directiveProcessor.ts`, `src/core/js/scriptParser.ts`,
  and `src/core/ladrillos.ts` no longer call `console.error` / `console.warn`
  directly — all framework errors now flow through the user-configurable handler.

### Removed

- Legacy positional registration functions (see _Breaking Changes_).
- Unused fields from `TemplateLoadResult` (`twoWayBindings`, `conditionals`,
  `loops`).
- `.claude/` tooling artifacts committed to the repo.

---

## [1.x]

Prior releases were development-only and are not retained in this log.
