# Contributing to LadrillosJS

Thank you for your interest in contributing! LadrillosJS is a small, focused
project — we keep the bar high for API changes but we love bug reports,
documentation improvements, and tests.

## Getting started

```sh
git clone https://github.com/your-org/LadrillosJS.git
cd LadrillosJS
npm install
npm run build:all
npm test
```

Node **18+** is required.

## Development workflow

1. Create a branch: `git checkout -b fix/short-description`.
2. Make your change. Keep commits small and focused.
3. Run the full pipeline locally:
   ```sh
   npm run typecheck
   npm test
   npm run build:all
   npm run verify:build
   ```
4. Open a pull request against `main`. Reference any related issues.

## Project layout

| Path                            | What it is                                         |
| ------------------------------- | -------------------------------------------------- |
| `src/`                          | Framework source.                                  |
| `src/core/`                     | Core runtime (reactivity, scheduler, diff, etc).   |
| `src/utils/`                    | Shared helpers (sandbox, key modifiers, warnings). |
| `tests/unit/`                   | Vitest unit tests.                                 |
| `samples/`                      | Example apps (CDN, Vite, .NET host).               |
| `docs/`                         | User-facing documentation.                         |
| `scripts/verify-treeshaking.js` | Production-build regression guard.                 |

## Coding guidelines

- **TypeScript strict** — no `any` unless unavoidable (prefer narrowing).
- **Zero new dependencies.** LadrillosJS is deliberately dependency-free.
- **Tree-shakeable.** Never introduce top-level side effects. Use
  `/* @__PURE__ */` annotations when unsure.
- **`__DEV__` guards** — wrap all development-only console output in
  `if (__DEV__) { … }` so it is dead-code-eliminated in production.
- **No `console.*`** directly — use `warn()` / `error()` from
  `src/utils/devWarnings.ts` so consumer error handlers receive events.
- **Public API names use the `$` prefix** (`$registerComponent`, `$emit`,
  `$use`, …) for symmetry between inline script and module consumption.

## Tests

- Put new unit tests in `tests/unit/…`.
- Tests run under Vitest + happy-dom.
- `tests/setup.ts` provides polyfills for `IntersectionObserver`,
  `requestIdleCallback`, and `matchMedia`.
- Aim for meaningful assertions over high line counts. Snapshot tests are
  discouraged for framework internals.

## Building for a release

Maintainers:

```sh
npm version <major|minor|patch>
git push origin main --follow-tags
```

The GitHub Actions release workflow publishes the package with provenance.

## Reporting bugs

Use the issue templates in `.github/ISSUE_TEMPLATE/`. Minimal, reproducible
examples get priority attention.

## Reporting security issues

**Do not open a public issue.** See [`SECURITY.md`](SECURITY.md).

## Code of Conduct

By participating, you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).
