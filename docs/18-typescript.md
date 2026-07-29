# TypeScript

LadrillosJS v2 ships with full TypeScript declarations for every public entry
point. This page shows how to consume them.

## Installation

```sh
npm install ladrillosjs
```

No extra `@types/…` package is required. Declarations are bundled inside
`ladrillosjs` itself.

## Entry points

| Import path          | What it exports                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ladrillosjs`        | Full default export + named API (`registerComponent`, `$use`, `$emit`, `$listen`, `configure`, `lazyOn*`, `ErrorCode`). |
| `ladrillosjs/core`   | Registration + configuration only.                                                                                       |
| `ladrillosjs/lazy`   | Lazy loading strategies (`lazyOnIdle`, `lazyOnVisible`, etc).                                                            |
| `ladrillosjs/events` | Event bus (`$emit`, `$listen`).                                                                                          |

## Public types

```ts
import type {
  ComponentConfig,
  RegisterComponentsResult,
  EventCallback,
  LazyStrategy,
  LadrillosConfig,
  LadrillosErrorHandler,
  LadrillosComponent,
} from "ladrillosjs";

import { ErrorCode } from "ladrillosjs";
```

### `LadrillosConfig`

```ts
interface LadrillosConfig {
  /** Component-source LRU cache size (default 25). */
  cacheSize?: number;
  /** Called for every framework error. Pass `null` to restore default. */
  onError?: LadrillosErrorHandler | null;
  /** Route `<for>` row events through one delegated listener (default false). */
  delegateLoopEvents?: boolean;
  /** Trusted Types policy for the framework's HTML sinks. See [CSP](22-csp-and-security.md). */
  trustedTypesPolicy?: TrustedTypesPolicyLike | null;
}
```

### `LadrillosErrorHandler`

```ts
type LadrillosErrorHandler = (
  error: Error,
  context?: { tagName?: string; sourcePath?: string } | null,
) => void;
```

### `ErrorCode`

An enum of typed framework error codes — branch on these in a custom
`onError` handler to distinguish component loading failures from expression
errors, etc.

## Typed registration

```ts
import { registerComponents, type ComponentConfig } from "ladrillosjs";

const components: ComponentConfig[] = [
  { name: "my-header", path: "./header.html" },
  { name: "my-footer", path: "./footer.html", useShadowDOM: false },
];

await registerComponents(components);
```

## Strict-mode compatibility

All declarations are generated under `strict: true` +
`noImplicitReturns: true` + `isolatedModules: true`. They should compose
cleanly with consumer projects using the same or stricter settings.

## Module resolution

Use `"moduleResolution": "Bundler"` (TypeScript 5+) or `"node16"` / `"nodenext"`.
The package uses `exports` conditions to expose the four entry points above.

## Source maps

Sourcemaps are published alongside the JS. You can step into LadrillosJS
source in the browser devtools without installing anything extra.
