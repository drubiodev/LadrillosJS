# LadrillosJS Demo Components Roadmap

A prioritized list of demo components to showcase LadrillosJS capabilities, inspired by Vue.js, Svelte, Solid.js, and other popular frameworks.

---

## ✅ Already Implemented

- [x] **Hello World** - Basic template bindings with `{expression}`
- [x] **Counter** - Reactive state with inline event handlers
- [x] **Two-Way Binding** - `$bind` with input, textarea, select
- [x] **Conditional Rendering** - `$if`, `$else-if`, `$else` chains
- [x] **Show/Hide** - `$show` directive vs `$if` comparison
- [x] **List Rendering** - `$for` with arrays, objects, indexes, `$key`
- [x] **Element Refs** - `$ref` for direct DOM access
- [x] **Todo List** - Full CRUD combining all directives
- [x] **Event Bus** - `$emit` and `$listen` for cross-component communication

---

## 📋 Phase 2: Intermediate Demos

### Timer/Stopwatch

- [ ] **Description**: A countdown timer or stopwatch with start, stop, and reset functionality
- **Concepts**: Lifecycle hooks, `setInterval`/`setTimeout`, cleanup on unmount
- **Why Important**: Shows proper interval management and component lifecycle
- **New Features Needed**: `$onMount` / `$onDestroy` lifecycle hooks
- **Reference**: [Solid.js Clock Example](https://www.solidjs.com/examples/clock)

### Temperature Converter

- [ ] **Description**: Convert between Celsius and Fahrenheit with bidirectional input
- **Concepts**: Computed/derived values, two-way data flow between related fields
- **Why Important**: Classic 7GUIs benchmark, shows computed reactivity
- **New Features Needed**: Computed properties or watchers
- **Reference**: [Vue 7GUIs Temperature](https://eugenkiss.github.io/7guis/tasks#temp)

### Form Validation

- [ ] **Description**: Registration form with real-time validation (email, password strength, confirm password)
- **Concepts**: Form handling, validation patterns, async validation (username availability)
- **Why Important**: Critical for real-world applications
- **New Features Needed**: Possibly validation helpers
- **Reference**: [Solid.js Form Validation](https://www.solidjs.com/examples/forms)

---

## 🚀 Phase 3: Impressive Showcases

### Markdown Editor

- [ ] **Description**: Split-pane editor with live preview - type markdown on left, see rendered HTML on right
- **Concepts**: Third-party library integration (marked.js), raw HTML rendering, debouncing
- **Why Important**: High visual impact, demonstrates real-world use case
- **New Features Needed**: `$html` directive for rendering raw/unsafe HTML
- **Reference**: [Vue Markdown Editor](https://vuejs.org/examples/#markdown), [Petite-vue markdown.html](https://github.com/vuejs/petite-vue/blob/main/examples/markdown.html)

### Sortable/Filterable Data Grid

- [ ] **Description**: Table with clickable column headers to sort, search input to filter rows
- **Concepts**: Complex state management, computed/derived data, performance with large lists
- **Why Important**: Most impressive data-handling demo, common in dashboards
- **New Features Needed**: None (uses existing features efficiently)
- **Reference**: [Vue Grid Example](https://vuejs.org/examples/#grid), [Petite-vue grid.html](https://github.com/vuejs/petite-vue/blob/main/examples/grid.html)

### GitHub Commits Fetcher

- [ ] **Description**: Fetch and display recent commits from a GitHub repo with branch selector
- **Concepts**: Async/await, fetch API, loading states, error handling
- **Why Important**: Shows real API integration, async patterns
- **New Features Needed**: None (native fetch works)
- **Reference**: [Petite-vue commits.html](https://github.com/vuejs/petite-vue/blob/main/examples/commits.html)

### Tree View

- [ ] **Description**: Expandable/collapsible tree structure (like a file explorer)
- **Concepts**: Recursive components, nested data structures
- **Why Important**: Shows recursive component capability
- **New Features Needed**: Recursive component support
- **Reference**: [Vue Tree View](https://vuejs.org/examples/#tree), [Petite-vue tree.html](https://github.com/vuejs/petite-vue/blob/main/examples/tree.html)

### SVG Graph

- [ ] **Description**: Interactive SVG visualization (polygon editor, bar chart, or similar)
- **Concepts**: SVG attribute binding, math calculations, mouse interactions
- **Why Important**: Shows framework works with SVG, not just HTML
- **New Features Needed**: SVG support in templates
- **Reference**: [Vue SVG Graph](https://vuejs.org/examples/#svg)

---

## 🧩 Phase 4: Real-World UI Patterns

### Modal/Dialog

- [ ] **Description**: Popup dialog with backdrop, close on escape, focus trap
- **Concepts**: Portals/teleport, focus management, keyboard events, accessibility
- **Why Important**: Most common UI pattern in real apps
- **New Features Needed**: `$teleport` directive to render outside component
- **Reference**: [Vue Modal](https://vuejs.org/examples/#modal), [Alpine.js Modal](https://alpinejs.dev/component/modal)

### Dropdown Menu

- [ ] **Description**: Button that opens a menu, closes when clicking outside
- **Concepts**: Click-outside detection, positioning, keyboard navigation
- **Why Important**: Extremely common pattern
- **New Features Needed**: `$clickOutside` directive or event modifier
- **Reference**: [Alpine.js Dropdown](https://alpinejs.dev/component/dropdown)

### Tabs Component

- [ ] **Description**: Tab navigation showing different content panels
- **Concepts**: Dynamic content switching, active state management
- **Why Important**: Common navigation pattern
- **New Features Needed**: Possibly slots for content projection
- **Reference**: [Alpine.js Tabs](https://alpinejs.dev/component/tabs)

### Accordion

- [ ] **Description**: Expandable/collapsible content sections (only one open at a time)
- **Concepts**: Exclusive selection, smooth height animations
- **Why Important**: FAQ sections, settings panels
- **New Features Needed**: CSS transition support
- **Reference**: [Alpine.js Accordion](https://alpinejs.dev/component/accordion)

### Notification/Toast System

- [ ] **Description**: Stackable notification messages that auto-dismiss
- **Concepts**: Timed removal, animations, stacking logic
- **Why Important**: User feedback in apps
- **New Features Needed**: Transition animations
- **Reference**: [Alpine.js Notification](https://alpinejs.dev/component/notification)

### Tooltip

- [ ] **Description**: Hover to show contextual information
- **Concepts**: Positioning, delay, show/hide logic
- **Why Important**: Common UX pattern
- **New Features Needed**: Possibly positioning utilities
- **Reference**: [Alpine.js Tooltip](https://alpinejs.dev/component/tooltip)

---

## ⚡ Phase 5: Async & Data Patterns

### Search with Debounce

- [ ] **Description**: Search input that fetches results after user stops typing
- **Concepts**: Debouncing, AbortController for cancellation, loading states
- **Why Important**: Performance optimization pattern
- **New Features Needed**: Debounce utility or `$debounce` modifier
- **Reference**: Common pattern in all frameworks

### Infinite Scroll

- [ ] **Description**: Load more items as user scrolls to bottom
- **Concepts**: Intersection Observer, lazy loading, pagination
- **Why Important**: Social feeds, product listings
- **New Features Needed**: `$intersect` directive
- **Reference**: Modern feed patterns

### Optimistic Updates

- [ ] **Description**: Update UI immediately, rollback on error
- **Concepts**: Optimistic patterns, error recovery
- **Why Important**: Snappy user experience
- **New Features Needed**: None (pattern-based)

---

## ✨ Phase 6: Animations & Transitions

### List Transitions

- [ ] **Description**: Animate items entering and leaving a list
- **Concepts**: Enter/leave transitions, FLIP animations
- **Why Important**: Polish and UX quality
- **New Features Needed**: `$transition` directive or transition group
- **Reference**: [Vue List Transitions](https://vuejs.org/examples/#list-transition)

### Modal with Transitions

- [ ] **Description**: Fade backdrop, slide/scale modal content
- **Concepts**: CSS transitions tied to visibility
- **Why Important**: Professional feel
- **New Features Needed**: Transition hooks
- **Reference**: [Vue Modal Transitions](https://vuejs.org/examples/#modal)

### Collapse/Expand

- [ ] **Description**: Smooth height animation for accordions
- **Concepts**: Height: auto animation (tricky!), CSS transitions
- **Why Important**: Common interaction
- **New Features Needed**: Height transition utility

---

## 🎮 Phase 7: Games & Advanced (Impressive)

### Tic-Tac-Toe

- [ ] **Description**: Two-player game with move history and time travel
- **Concepts**: Complex state, undo/redo, game logic
- **Why Important**: React's famous tutorial example
- **Reference**: [React Tic-Tac-Toe](https://react.dev/learn/tutorial-tic-tac-toe)

### Spreadsheet/Cells

- [ ] **Description**: Mini Excel with formulas like `=A1+B1`
- **Concepts**: 2D arrays, expression parsing, cell references
- **Why Important**: Ultimate complexity showcase (7GUIs)
- **Reference**: [Vue Cells](https://vuejs.org/examples/#cells)

### Circle Drawer

- [ ] **Description**: Click to draw circles, resize them, undo/redo
- **Concepts**: Canvas-like interaction, history management
- **Why Important**: 7GUIs benchmark
- **Reference**: [7GUIs Circle Drawer](https://eugenkiss.github.io/7guis/tasks#circle)

---

## 🔌 Phase 8: Third-Party Integrations

### Chart.js Integration

- [ ] **Description**: Reactive charts that update with data changes
- **Concepts**: Library wrapping, canvas updates
- **Reference**: [Alpine + Chart.js](https://alpinejs.dev/component/chart)

### Date Picker

- [ ] **Description**: Flatpickr or similar date picker integration
- **Concepts**: Input enhancement, library integration
- **Reference**: [Alpine + Flatpickr](https://alpinejs.dev/component/datepicker)

### Rich Text Editor

- [ ] **Description**: Quill or Trix editor integration
- **Concepts**: Complex library wrapping
- **Reference**: [Alpine + Quill](https://alpinejs.dev/component/editor)

---

## 📊 Priority Summary

| Priority  | Demos                                             | Impact             |
| --------- | ------------------------------------------------- | ------------------ |
| 🔴 High   | Markdown Editor, Data Grid, GitHub Commits, Modal | "Wow factor" demos |
| 🟠 Medium | Timer, Form Validation, Tabs, Dropdown            | Practical patterns |
| 🟡 Lower  | Animations, Games, Integrations                   | Polish & advanced  |

---

## 🏗️ New Features That May Be Needed

Based on these demos, consider adding:

1. **Lifecycle Hooks**: `$onMount`, `$onDestroy` for setup/cleanup
2. **Raw HTML Rendering**: `$html` directive for markdown preview
3. **Teleport/Portal**: `$teleport` for modals outside component tree
4. **Click Outside**: `$clickOutside` directive
5. **Transitions**: `$transition` or CSS transition helpers
6. **Computed Properties**: Derived values that auto-update
7. **Slots**: Content projection for flexible components
8. **Debounce Modifier**: `$bind.debounce="search"` for inputs

---

## 🔗 Reference Links

- [Vue.js Examples](https://vuejs.org/examples/)
- [Svelte Examples](https://svelte.dev/examples)
- [Solid.js Examples](https://www.solidjs.com/examples)
- [Alpine.js Components](https://alpinejs.dev/components)
- [Lit Playground](https://lit.dev/playground/)
- [Petite-vue Examples](https://github.com/vuejs/petite-vue/tree/main/examples)
- [7GUIs Benchmark](https://eugenkiss.github.io/7guis/)
- [React Tutorial](https://react.dev/learn/tutorial-tic-tac-toe)
