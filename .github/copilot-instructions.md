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

// 6. Write tests for changes
// When modifying src/, update corresponding test/unit/*.test.js

// 7. Add tests for new features
// Every new directive, API, or feature needs comprehensive tests
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

// 6. ❌ DON'T modify src/ without updating tests
// All changes to src/ require corresponding test updates

// 7. ❌ DON'T add features without test coverage
// Features without tests won't be considered complete
```

## Testing Strategy

**Location:** `test/` folder

**Test Files:**

- `test/unit/registerComponent.test.ts` - Component registration & caching (50+ tests)
- `test/unit/eventBus.test.ts` - Event bus pub/sub (40+ tests)
- `test/unit/stateManagement.test.js` - State, reactivity, proxies (50+ tests)
- `test/unit/bindings.test.js` - Template bindings & expressions (45+ tests)
- `test/unit/directives.test.js` - $if, $for, $bind, conditionals (70+ tests)
- `test/unit/advanced.test.js` - Advanced features & edge cases (50+ tests)
- `test/unit/scriptExecution.test.js` - Script execution & modules (60+ tests)
- `test/integration/integration.test.js` - Complex real-world patterns (40+ tests)
- `test/test-helpers.js` - Shared utilities, fixtures, setup

**Pattern:** Mock fetch, stub customElements, assert state/DOM

```javascript
// See: test/registerComponent.test.ts
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  text: () => Promise.resolve("<p>Hello</p><script>let x=0;</script>"),
});
vi.stubGlobal("fetch", mockFetch);

const tag = `test-comp-${Date.now()}`;
await registerComponent(tag, "/test.html");
expect(customElements.get(tag)).toBeDefined();
```

### Workflow for Code Changes

**When modifying `src/` files:**

1. **Identify affected tests** - Which test file covers this module?

   - `src/core/webcomponent.ts` → `test/unit/stateManagement.test.js`, `test/unit/directives.test.js`
   - `src/core/main.ts` → `test/unit/registerComponent.test.ts`
   - `src/core/eventBus.ts` → `test/unit/eventBus.test.ts`
   - `src/core/html/htmlRenderer.ts` → `test/unit/directives.test.js`, `test/unit/bindings.test.js`
   - `src/core/js/scriptParser.ts` → `test/unit/scriptExecution.test.js`

2. **Update existing tests** - If the change modifies behavior:

   ```bash
   npm run test -- test/unit/[relevant-test].test.js  # Run specific test file
   ```

3. **Ensure all tests pass** before committing:

   ```bash
   npm run test  # Run full test suite (245+ tests)
   ```

4. **Check coverage** for the modified module:
   ```bash
   npm run test:coverage
   ```

### Workflow for New Features

**When adding a new feature (e.g., new directive, API, or capability):**

1. **Create/extend test file** - Add comprehensive tests covering:

   - ✅ Basic functionality
   - ✅ Edge cases & error conditions
   - ✅ Integration with existing features
   - ✅ Performance with large datasets

2. **Test structure example:**

   ```javascript
   describe("New Feature: $myDirective", () => {
     it("should apply directive correctly", async () => {
       // Arrange: Create fixture component with feature
       // Act: Trigger feature
       // Assert: Verify expected behavior
     });

     it("should handle edge case: empty value", () => {
       // Test edge case
     });

     it("should work with nested state", () => {
       // Test integration with state management
     });
   });
   ```

3. **Implementation then testing order:**

   - Write feature code in `src/`
   - Write tests in appropriate `test/unit/*.test.js` file
   - Run tests: `npm run test`
   - If tests fail, fix implementation
   - If implementation complete, commit with tests

4. **Minimum coverage requirements:**
   - Core functionality: 100% pass rate
   - Edge cases: At least 3 test scenarios per feature
   - Integration: At least 1 integration test combining feature with other features
   - No warnings in test output

### Test File Mapping

| Modified File                   | Test File                                       | Focus Areas                        |
| ------------------------------- | ----------------------------------------------- | ---------------------------------- |
| `src/index.ts`                  | Integration tests                               | API exports, public surface        |
| `src/core/webcomponent.ts`      | `stateManagement.test.js`, `directives.test.js` | Proxy behavior, reactivity         |
| `src/core/main.ts`              | `registerComponent.test.ts`                     | Registration, caching, concurrency |
| `src/core/eventBus.ts`          | `eventBus.test.ts`                              | $emit, $listen, pub/sub            |
| `src/core/html/htmlRenderer.ts` | `directives.test.js`, `bindings.test.js`        | $if, $for, $bind, {}, expressions  |
| `src/core/js/scriptParser.ts`   | `scriptExecution.test.js`                       | Script loading, variable binding   |
| `src/core/css/cssParser.ts`     | `advanced.test.js`                              | Style loading, Shadow DOM          |
| `src/cache/functionCache.ts`    | `registerComponent.test.ts`                     | Caching behavior                   |

### Running Tests During Development

```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- test/unit/stateManagement.test.js

# Run tests in watch mode (for TDD)
npm run test -- --watch

# Run with coverage report
npm run test:coverage

# Run specific test by name
npm run test -- -t "should update state reactively"
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
| `test/test-helpers.js`          | Test utilities & fixtures     | Used by all test files                     |
| `test/unit/*.test.js`           | Unit tests                    | 350+ tests covering all features           |
| `test/integration/*.test.js`    | Integration tests             | Real-world usage scenarios                 |

## Change Validation Checklist

**Before committing any changes to `src/`:**

- [ ] Code follows existing patterns in the codebase
- [ ] TypeScript types are correct (no implicit `any`)
- [ ] Existing tests still pass: `npm run test`
- [ ] New tests added for behavior changes
- [ ] New tests added for new features
- [ ] All tests pass: `npm run test` shows "245 passed (245)"
- [ ] No test warnings or errors in output
- [ ] Code builds successfully: `npm run build`
- [ ] Documentation updated if API changed

**Example validation flow:**

```bash
# 1. Make changes to src/core/webcomponent.ts
# 2. Run affected tests
npm run test -- test/unit/stateManagement.test.js

# 3. If tests fail, fix implementation
# 4. Run full test suite
npm run test

# 5. Check for TypeScript errors
npm run build

# 6. If all green, commit with test updates
git add src/ test/
git commit -m "feat: add reactive computed properties"
```

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
