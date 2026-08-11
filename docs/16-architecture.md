# Internal Architecture

This document provides a deep dive into LadrillosJS's internal structure. Useful for contributors or anyone wanting to understand how the framework works under the hood.

## Project Structure

```
src/
├── index.ts              # Main entry point, exports public API
├── core.ts               # Core exports
├── csp.ts                # Eval-free entry point (adds defineCompiled)
├── events.ts             # Event bus exports
├── lazy.ts               # Lazy loading exports
├── global.d.ts           # TypeScript declarations
├── compiler/
│   ├── index.ts          # `ladrillosjs/compiler` build-time API
│   └── emit.ts           # Emits precompiled artifacts as static JS
├── core/
│   ├── ladrillos.ts      # Main framework class
│   ├── configure.ts      # configure() and LadrillosConfig
│   ├── globals.ts        # Framework globals under globalThis.__ladrillos
│   ├── builtins/         # <for>, <if>, <show>, <lazy>
│   ├── cache/            # Caching utilities
│   ├── component/        # Component processing, incl. defineCompiled.ts
│   ├── css/              # CSS parsing and stylesheet adoption
│   ├── diff/             # List diffing algorithm
│   ├── directives/       # Directive processing
│   ├── events/           # Event bus
│   ├── helpers/          # Framework helpers (registerComponent, etc.)
│   ├── html/             # HTML/template parsing, incl. trustedTypes.ts
│   ├── js/               # JS processing, reactivity, codegen backends
│   ├── lazy/             # Lazy loading strategies
│   └── scheduler/        # Batch update scheduler
├── types/
│   └── index.ts          # TypeScript type definitions
└── utils/
    ├── devWarnings.ts    # Development warnings
    ├── directives.ts     # Directive constants
    ├── dynamicImport.ts  # Real dynamic import (replaces indirect eval)
    ├── globalScope.ts    # Scoped globals for component code
    ├── jsevents.ts       # JavaScript event names
    ├── keyModifiers.ts   # Key modifier parsing
    ├── regex.ts          # Regex patterns
    └── stateTransform.ts # Declaration-to-state rewriting
```

---

## Core Flow

### 1. Registration Flow

```
registerComponent(name, path)
        │
        ▼
┌───────────────────┐
│ ladrillos.ts      │  Check if registered, resolve path
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ loader.ts         │  Fetch HTML, handle folder-as-component
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ extract.ts        │  Parse HTML → template, scripts, styles
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ webcomponent.ts   │  Create custom element class
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ customElements    │  Browser registers the element
└───────────────────┘
```

### 2. Component Initialization Flow

```
<my-component> added to DOM
        │
        ▼
┌───────────────────┐
│ constructor()     │  Minimal setup
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ connectedCallback │  Main initialization
└───────┬───────────┘
        │
        ├──► Create Shadow Root
        ├──► loadTemplate (htmlparser.ts)
        ├──► loadStyles (cssParser.ts)
        ├──► scanRefsOnly (directiveProcessor.ts)
        ├──► loadExternalStyles/Scripts
        ├──► loadScripts (scriptParser.ts)
        │         └──► createReactiveState (reactivity.ts)
        │         └──► executeScriptWithReactiveState
        │         └──► transformInlineEventHandlers
        ├──► executeModuleScripts (moduleExecutor.ts)
        ├──► scanDirectives (directiveProcessor.ts)
        ├──► Initial render
        └──► Dispatch ladrillos:ready
```

---

## Key Modules

### ladrillos.ts - Main Framework Class

The singleton that manages component registration:

```typescript
class Ladrillos {
  components: Record<string, LadrillosComponent>;

  registerComponent(name, path, useShadowDOM, lazy);
  registerComponents(configs);
  loadLazyComponent(name);
}
```

### webcomponent.ts - Web Component Factory

Creates custom element classes:

```typescript
function createWebComponentClass(component, useShadowDOM) {
  return class extends HTMLElement {
    static get observedAttributes() { ... }
    connectedCallback() { ... }
    disconnectedCallback() { ... }
    attributeChangedCallback() { ... }
  }
}
```

### scriptParser.ts - Script Processing

The heart of reactivity setup:

```typescript
// Main entry point
loadScripts(host, scripts, bindings, overrides, onStateChange, ...)

// Variable extraction
extractVariableNames(scriptContent)
extractFunctionDefinitions(scriptContent)

// Expression evaluation
createExpressionEvaluator()

// Event handler transformation
transformInlineEventHandlers(host, state, scriptContent)
```

### reactivity.ts - Reactive State

Creates the reactive Proxy:

```typescript
function createReactiveState(initial, bindings, updateFn, onStateChange) {
  return new Proxy(initial, {
    set(target, key, value) {
      // Update value
      target[key] = value;
      // Trigger DOM updates
      updateBindings(key);
      onStateChange?.();
      return true;
    },
  });
}

function createReactiveArray(arr, onMutate) {
  // Wrap array methods: push, pop, splice, etc.
}
```

### directiveProcessor.ts - Directive Handling

Processes all `$` directives:

```typescript
function scanDirectives(host): DirectiveContext {
  return {
    loops: scanLoops(host),
    conditionals: scanConditionals(host),
    twoWayBindings: scanTwoWayBindings(host),
    refs: scanRefs(host),
    showElements: scanShow(host),
  };
}

function renderLoops(loops, state, evaluator);
function updateConditionals(conditionals, state, evaluator);
function updateShowElements(showElements, state, evaluator);
function setupTwoWayBindings(bindings, state, evaluator);
```

### eventBus.ts - Cross-Component Events

Global event system:

```typescript
// Global storage
globalThis.__ladrillosEventBus = {
  listeners: Map<string, Set<ListenerRegistration>>,
  componentListeners: Map<string, Set<...>>
};

function $emit(eventName, data) {
  // Broadcast to all listeners
}

function $listen(eventName, callback) {
  // Register listener, return unsubscribe
}

function cleanupComponentListeners(componentId) {
  // Remove all listeners for a component
}
```

### batchScheduler.ts - Update Batching

Coalesces multiple updates:

```typescript
const pendingUpdates = new Map<string, () => void>();
let scheduled = false;

function scheduleComponentUpdate(componentId, updateFn) {
  pendingUpdates.set(componentId, updateFn);

  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flushUpdates);
  }
}

function flushUpdates() {
  for (const [id, update] of pendingUpdates) {
    update();
  }
  pendingUpdates.clear();
  scheduled = false;
}
```

---

## Data Structures

### LadrillosComponent

```typescript
interface LadrillosComponent {
  tagName: string;
  template: string;
  scripts: ScriptElement[];
  externalScripts: ExternalScriptElement[];
  externalStyles: ExternalStyleElement[];
  styles: string;
  sourcePath?: string;
  templateBindings?: string[];
}
```

### BindingDescriptor

```typescript
interface BindingDescriptor {
  node: Text; // The text node with binding
  bindings: Array<{
    raw: string; // "count * 2"
    path: string[]; // ["count"]
    isFunction?: boolean;
    isExpression?: boolean;
    functionArgs?: string[];
  }>;
  original: string; // "Count: {count}"
  isAttribute?: boolean;
  attributeName?: string;
}
```

### LoopDescriptor

```typescript
interface LoopDescriptor {
  template: Element; // Template to clone
  expression: string; // "item in items"
  itemName: string; // "item"
  indexName?: string; // "i"
  arrayName: string; // "items"
  keyAttribute?: string; // "item.id"
  placeholder: Comment; // Position marker
  renderedElements: Element[]; // Current DOM elements
}
```

### DirectiveContext

```typescript
interface DirectiveContext {
  loops: LoopDescriptor[];
  conditionals: ConditionalDescriptor[][];
  twoWayBindings: TwoWayBindingDescriptor[];
  refs: Map<string, HTMLElement>;
  showElements: ShowDescriptor[];
}
```

---

## Script Transformation

When you write:

```javascript
let count = 0;
count++;
```

It's transformed to use `__state__`:

```javascript
__state__.count ??= 0; // Default value (nullish coalescing)
__state__.count++; // All access goes through proxy
```

This happens in `executeScriptWithReactiveState()`:

```typescript
function executeScriptWithReactiveState(script, state, ...) {
  // Transform variable declarations
  const transformed = script
    .replace(/\blet\s+(\w+)\s*=\s*([^;]+)/g,
             '__state__.$1 ??= $2')
    .replace(/\bconst\s+(\w+)\s*=\s*([^;]+)/g,
             'const $1 = $2');  // consts stay as-is

  // Execute with __state__ bound
  const fn = new Function('__state__', '$refs', '$emit', ..., transformed);
  fn(state, refs, $emit, ...);
}
```

Code generation is reached through a single seam (`src/core/js/compiler.ts`), so
the `new Function` call above is one of two interchangeable backends.
`ladrillosjs` installs `runtimeBackend.ts`, which compiles in the browser and
therefore needs `script-src 'unsafe-eval'`. `ladrillosjs/csp` installs
`precompiled.ts` instead, which looks the function up in an artifact table
emitted at build time — that build contains no `new Function` at all, and
`scripts/verify-treeshaking.js` fails the build if one reappears.

---

## Binding Updates

When state changes:

```
state.count = 5
      │
      ▼
┌────────────────────────────────────────┐
│ Proxy.set() intercepts                 │
│   └── target.count = 5                 │
│   └── Find bindings that use "count"  │
│   └── Schedule update                  │
└────────────────────────────────────────┘
      │
      ▼
┌────────────────────────────────────────┐
│ updateSingleBinding()                  │
│   └── Evaluate expression: "count * 2"│
│   └── Result: 10                       │
│   └── Update text node: "10"           │
└────────────────────────────────────────┘
```

The binding registry maps keys to bindings:

```typescript
const bindingRegistry: Map<string, Set<BindingDescriptor>> = new Map();

// "count" → [{node, expression: "count"}, {node, expression: "count * 2"}]
```

---

## List Diffing

For `<for>` loops, the diff algorithm (`listDiff.ts`) optimizes updates:

```typescript
// Keyed diffing (when $key is provided)
function diffKeyed(oldItems, newItems, keyFn) {
  // Reuses existing elements when possible
  // Moves instead of recreate
}

// Unkeyed diffing (no $key)
function diffUnkeyed(oldItems, newItems) {
  // Simple length-based approach
  // May recreate more elements
}
```

---

## Lazy Loading

```
┌─────────────────────────────────────────────────────────────────┐
│ registerLazyComponent(name, path, useShadowDOM, strategy)       │
│   └── Create placeholder class                                  │
│   └── Store loading metadata                                    │
│   └── Register with customElements                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ <lazy-component> added to DOM                                   │
│   └── connectedCallback()                                       │
│   └── strategy(load, element)                                   │
│        └── Sets up observer/listener                            │
└─────────────────────────────────────────────────────────────────┘
                              │
              (strategy triggers)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ load()                                                          │
│   └── Fetch component HTML                                      │
│   └── Parse and create real component                           │
│   └── Replace placeholder content                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Build Outputs

LadrillosJS v2 ships **ESM-only** with four entry points (see
[`package.json` `exports`](../package.json)):

```
dist/
├── index.js     # Full API      → import from "ladrillosjs"
├── core.js      # Registration  → import from "ladrillosjs/core"
├── lazy.js      # Lazy strategies → import from "ladrillosjs/lazy"
├── events.js    # Event bus     → import from "ladrillosjs/events"
├── *.d.ts       # TypeScript declarations
└── *.js.map     # Source maps
```

A development-only IIFE build (`dist-cdn/ladrillos.iife.js`) is produced by
`npm run build:cdn` for the local samples/REPL; it is not published to npm.

---

## Contributing

To work on LadrillosJS:

```bash
# Install dependencies
npm install

# Development with watch
npm run dev

# Build all formats
npm run build:all

# Run samples
npm run dev:demo
```

Key areas for contributions:

- `src/core/directives/` - Add new directives
- `src/core/lazy/` - New lazy loading strategies
- `src/core/js/` - Reactivity improvements
- `src/utils/` - Utility functions

---

← [Component Lifecycle](./15-lifecycle.md) | [Back to Index](./README.md)
