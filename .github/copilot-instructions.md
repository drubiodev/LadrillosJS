# LadrillosJS - Copilot Instructions

> **Mission:** Lightweight web component framework enabling single-file `.html` components with reactive state, no dependencies, and maximum simplicity.

## Architecture Overview

### Core Layers

```
┌─────────────────────────────────────────────────┐
│ Application Layer (samples/, test/)              │
│ - Live examples & test suites                    │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│ Public API (src/index.ts)                       │
│ - registerComponent(), registerComponents()      │
│ - Event bus: $emit, $listen                     │
│ - State helpers: $setState, $getState           │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│ Core System (src/core/)                         │
├──────────────────────────────────────────────────┤
│ 1. componentSource.ts                           │
│    └─ Fetches & caches component HTML           │
│                                                  │
│ 2. componentParser.ts                           │
│    └─ Extracts: template, scripts, styles       │
│    └─ Handles: external scripts, module scripts │
│                                                  │
│ 3. webcomponent.ts (⭐ CORE)                   │
│    └─ defineWebComponent()                      │
│    └─ Deep reactive proxy for state             │
│    └─ Binding/conditional/loop rendering        │
│                                                  │
│ 4. main.ts                                      │
│    └─ Ladrillos class orchestrator              │
│    └─ Concurrency throttling (default: 5)       │
│    └─ Cache management                          │
│                                                  │
│ 5. eventBus.ts                                  │
│    └─ Global pub/sub for component comms        │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│ Parsing/Rendering (src/core/{html/,js/,css/}) │
├──────────────────────────────────────────────────┤
│ - htmlparser.ts: Extract bindings & directives   │
│ - htmlRenderer.ts: Render {}, $if, $for, $bind  │
│ - scriptParser.ts: Load scripts, extract code   │
│ - cssParser.ts: Load styles into Shadow DOM      │
└──────────────────────────────────────────────────┘
```

## Component Lifecycle

```javascript
// 1. User calls registerComponent("my-button", "./button.html")
// 2. componentSource.ts: Fetches & caches HTML
// 3. componentParser.ts: Extracts template, scripts, styles
// 4. webcomponent.ts: defineWebComponent() creates class
// 5. customElements.define() registers with browser
// 6. <my-button></my-button> in HTML
// 7. Browser creates instance → connectedCallback()
// 8. webcomponent.ts: Creates reactive proxy, renders bindings
// 9. Scripts run with this = component element
// 10. Component is live and interactive
```

## Key Technical Patterns

### 1. Reactive State via Deep Proxy

**File:** `src/core/webcomponent.ts`

State mutations automatically trigger re-renders:

```typescript
// User writes: let count = 0
// Framework creates deep reactive proxy
this.state = new Proxy({ count: 0 }, handler);

// When: count++
// Handler detects mutation → calls requestAnimationFrame(render)
// Result: {count} binding updates in 1 frame
```

**Critical:** The proxy catches:

- Direct assignments: `count++`, `count = 5`
- Nested mutations: `user.name = "John"`
- Array methods: `.push()`, `.splice()`, `.reverse()`

### 2. Script Execution Context

**File:** `src/core/js/scriptParser.ts`

Two types of scripts in components:

```html
<!-- Type 1: Regular scripts (run in component context) -->
<script>
  let count = 0;  // Auto-initialized to state
  export const increment = () => count++;  // Auto-attached to component
</script>

<!-- Type 2: ES Module scripts (external files) -->
<script type="module" src="./logic.js"></script>
  <!-- Can import from npm, relative paths auto-resolved -->
</script>
```

**Variable binding:** Variables mentioned in template `{count}` are auto-initialized in state. This happens via regex detection + Function constructor.

### 3. Template Directives

**File:** `src/core/html/htmlRenderer.ts`

Supported directives (processed in order):

```html
<!-- One-way binding -->
<p>{message}</p>

<!-- Two-way binding (form inputs) -->
<input $bind="name" type="text" />

<!-- Conditionals -->
<div $if="{isVisible}">Shown</div>
<div $else-if="{isLoading}">Loading</div>
<div $else>Hidden</div>

<!-- Loops -->
<li $for="item in items">{item.name}</li>

<!-- Dynamic classes -->
<button class:active="{isActive}">Toggle</button>
```

**Evaluation:** Expressions like `{isActive ? 'on' : 'off'}` are wrapped in `new Function('return (expr)')` within component context (`this`).

### 4. Component Registration Concurrency

**File:** `src/core/main.ts`

Default limit: 5 parallel fetches. Prevents network bottleneck:

```typescript
registerComponents(components, (concurrency = 5));
// Throttles: if 5 fetches in-flight, waits for 1 to complete
// Uses: Promise.race() + Array splice pattern
```

## Development Workflow

### Build System

```bash
# Development
npm run dev
  └─ Starts Vite on samples/ folder
  └─ Hot reload enabled
  └─ Alias: "ladrillosjs" → "src/index.ts"

# Production
npm run build
  └─ Vite builds: src/index.ts → dist/ (es/umd/cjs)
  └─ TypeScript: src/ → dist/*.d.ts
  └─ Vite plugin build: scripts/build-vite-plugin.js

# Testing
npm run test
  └─ Vitest with jsdom
  └─ Mocks fetch for component loading
  └─ Test files: test/*.test.js
```

### Key Build Outputs

- `dist/ladrillosjs.es.js` - ES module (tree-shakeable)
- `dist/ladrillosjs.umd.js` - UMD browser global
- `dist/ladrillosjs.cjs.js` - CommonJS
- `dist/index.d.ts` - TypeScript declarations

## Common Patterns & Anti-patterns

### ✅ DO

```javascript
// 1. Use state for reactive data
let count = 0; // Auto-tracked, re-renders on change
export const increment = () => count++;

// 2. Export functions for event handlers
export const handleClick = () => {
  /* ... */
};

// 3. Use $emit for cross-component communication
$emit("user-saved", { userId: 123 });

// 4. Use lifecycle hooks for setup/cleanup
$onMount(() => {
  /* fetch data */
});
$onUnmount(() => {
  /* cleanup */
});

// 5. Use $bind for form inputs
// <input $bind="email"> syncs with state automatically
```

### ❌ DON'T

```javascript
// 1. Modify this.state directly (use proxy)
this.state.count = 5; // ❌ Bypasses reactivity
count = 5; // ✅ Triggers proxy

// 2. Use console.log for debugging
logger.debug("msg"); // Use logger from utils

// 3. Create circular component dependencies
// A imports B, B imports A → breaks registration

// 4. Assume Shadow DOM doesn't exist
// Styles are scoped unless useShadowDOM: false

// 5. Block the main thread in scripts
// Use async/await, not sync loops
```

## Testing Strategy

**Location:** `test/` folder

**Pattern:** Mock fetch, stub customElements, assert state/DOM

```javascript
// See: test/registerComponent.test.js
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  text: () => Promise.resolve("<p>Hello</p><script>let x=0;</script>"),
});
vi.stubGlobal("fetch", mockFetch);

const tag = `test-comp-${Date.now()}`;
await registerComponent(tag, "/test.html");
expect(customElements.get(tag)).toBeDefined();
```

## Important Files

| File                            | Purpose                       | Notes                                      |
| ------------------------------- | ----------------------------- | ------------------------------------------ |
| `src/index.ts`                  | Public API exports            | Entry point for all users                  |
| `src/core/webcomponent.ts`      | Component class definition    | ⭐ Contains reactive proxy logic           |
| `src/core/main.ts`              | Ladrillos orchestrator        | Handles registration, caching, concurrency |
| `src/core/html/htmlRenderer.ts` | Binding/directive rendering   | Processes {}, $if, $for, $bind             |
| `src/core/js/scriptParser.ts`   | Script extraction & execution | Handles module vs regular scripts          |
| `src/types/LadrilloTypes.ts`    | TypeScript types              | Reference for component structure          |
| `vite.config.js`                | Build config                  | Outputs es/umd/cjs                         |
| `docs/`                         | Publishing & API guides       | 8 comprehensive markdown files             |

## Debugging Tips

### Issue: Component not registering

```javascript
// Check:
// 1. Is fetch working? Mock console.log in componentSource
// 2. Is HTML valid? Use parseComponentHTML separately
// 3. Is customElements.define working? Check browser console
```

### Issue: State not updating

```javascript
// Check:
// 1. Is variable in template? {count} is required for tracking
// 2. Is it using proxy correctly? count++, not this.state.count++
// 3. Is render queued? Check requestAnimationFrame calls
```

### Issue: Styles not showing

```javascript
// Check:
// 1. Is Shadow DOM enabled? (default: true)
// 2. Are styles in <style> tag? (not <link>)
// 3. Are they affecting :host? Use :host for component styles
```

## Extension Points

### Adding a New Directive

1. Add regex pattern to `src/utils/regex.ts`
2. Add parser to extract variables in `src/core/html/htmlparser.ts`
3. Add renderer function in `src/core/html/htmlRenderer.ts`
4. Update `src/core/webcomponent.ts` to call renderer in connectedCallback

### Adding a Vite Plugin Feature

1. Edit `src/vite/copyComponentsPlugin.ts`
2. Handle file operations in processScripts/processStyles
3. Update types in `src/vite/index.ts`
4. Build with `npm run build`

## Performance Considerations

- **Caching:** Components cached after first fetch (see componentSource.ts)
- **Batching:** Renders batched via requestAnimationFrame
- **Concurrency:** Default 5 parallel registrations
- **Deep proxy:** Trades slight overhead for automatic reactivity tracking
- **Shadow DOM:** Adds layout cost but provides style isolation

## Command Reference

```bash
npm run dev               # Start dev server (samples/)
npm run build            # Build dist/ (es/umd/cjs + types)
npm run test             # Run Vitest
npm run test:coverage    # Coverage report
npm run preview          # Preview production build
```

---

**Last Updated:** Nov 2025 | **Version:** 2.0.0-beta | **TypeScript:** 5.8+
