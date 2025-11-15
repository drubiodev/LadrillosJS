# Creating Component Libraries with LadrillosJS

This guide walks you through creating reusable, published component libraries using LadrillosJS. Learn how to organize, build, and distribute your components so other developers can easily import and use them.

## Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Creating Components](#creating-components)
- [TypeScript Support](#typescript-support)
- [Building Your Library](#building-your-library)
- [Publishing to NPM](#publishing-to-npm)
- [Usage Examples](#usage-examples)

---

## Quick Start

### 1. Create a New Library Project

```bash
mkdir my-ui-library
cd my-ui-library
npm init -y
npm install -D ladrillosjs typescript vite
npm install --save-peer ladrillosjs
```

### 2. Create Component Structure

```
my-ui-library/
├── src/
│   ├── index.ts              # Main entry point
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   └── components/
│       ├── Button/
│       │   ├── button.html
│       │   ├── Button.ts
│       │   └── index.ts
│       └── Card/
│           ├── card.html
│           ├── Card.ts
│           └── index.ts
├── package.json
├── tsconfig.json
└── vite.config.js
```

### 3. Define Component Interfaces

**src/types/index.ts**

```typescript
// Props interface
export interface ButtonProps {
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

// Events interface
export interface ButtonEvents {
  "button:click": { timestamp: number };
}

// Typed component element interface
export interface MyButton extends HTMLElement {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  disabled?: boolean;

  addEventListener(
    type: "button:click",
    listener: (event: CustomEvent<ButtonEvents["button:click"]>) => void
  ): void;
}

// Helper functions
export function createButton(selector?: string): MyButton | null {
  if (selector) {
    return document.querySelector(selector);
  }
  return document.createElement("my-button") as MyButton;
}
```

### 4. Create a Component

**src/components/Button/button.html**

```html
<style>
  :host {
    display: inline-block;
  }
  button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  .variant-primary {
    background: #007bff;
    color: white;
  }
  .variant-secondary {
    background: #6c757d;
    color: white;
  }
</style>

<button class="variant-{variant}" onclick="handleClick()">
  <slot>{label}</slot>
</button>

<script>
  let variant = this.getAttribute("variant") || "primary";
  let label = this.getAttribute("label") || "Click";

  export const handleClick = () => {
    $emit("button:click", { timestamp: Date.now() });
  };

  $onMount(() => console.log("Button ready"));
</script>
```

**src/components/Button/Button.ts**

```typescript
import type { MyButton, ButtonProps } from "../../types";

export { type MyButton, type ButtonProps } from "../../types";
export { createButton } from "../../types";

export const buttonMetadata = {
  name: "my-button",
  version: "1.0.0",
  props: { variant: "primary | secondary", size: "sm | md | lg" },
};
```

**src/components/Button/index.ts**

```typescript
export * from "./Button";
```

### 5. Create Library Entry Point

**src/index.ts**

```typescript
import type { ComponentRegistration } from "ladrillosjs";

// Export all types
export * from "./types";
export * from "./components/Button";
export * from "./components/Card";

// Component registry
export const MY_COMPONENTS: ComponentRegistration[] = [
  {
    name: "my-button",
    path: new URL("./components/Button/button.html", import.meta.url).href,
    useShadowDOM: true,
  },
  {
    name: "my-card",
    path: new URL("./components/Card/card.html", import.meta.url).href,
    useShadowDOM: true,
  },
];

// Registration function
export const registerMyComponents = async () => {
  const { registerComponents } = await import("ladrillosjs");
  return registerComponents(MY_COMPONENTS);
};

// Individual registration
export const registerMyButton = async () => {
  const { registerComponent } = await import("ladrillosjs");
  return registerComponent("my-button", MY_COMPONENTS[0].path);
};
```

### 6. Configure package.json

```json
{
  "name": "@mycompany/ui-components",
  "version": "1.0.0",
  "description": "UI component library built with LadrillosJS",
  "main": "./dist/index.cjs.js",
  "module": "./dist/index.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.es.js",
      "require": "./dist/index.cjs.js",
      "types": "./dist/index.d.ts"
    },
    "./button": {
      "import": "./dist/components/Button/index.es.js",
      "require": "./dist/components/Button/index.cjs.js",
      "types": "./dist/components/Button/index.d.ts"
    }
  },
  "files": ["dist", "src/components"],
  "peerDependencies": {
    "ladrillosjs": "^2.0.0"
  },
  "devDependencies": {
    "ladrillosjs": "^2.0.0",
    "typescript": "^5.8.0",
    "vite": "^7.1.0"
  }
}
```

### 7. Build Configuration

**vite.config.js**

```javascript
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "MyUIComponents",
      formats: ["es", "cjs", "umd"],
      fileName: (format) =>
        `my-ui-components.${format === "es" ? "es" : format}.js`,
    },
  },
});
```

**tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true
  }
}
```

---

## Project Structure

### Best Practices

```
my-ui-library/
├── src/
│   ├── index.ts                   # Main export (smallest!)
│   ├── types/
│   │   ├── index.ts               # All interfaces & helpers
│   │   ├── button.types.ts        # (optional: per-component)
│   │   └── card.types.ts
│   ├── components/
│   │   ├── Button/
│   │   │   ├── button.html        # Component template
│   │   │   ├── Button.ts          # TypeScript helpers
│   │   │   ├── Button.stories.ts  # (optional: Storybook)
│   │   │   └── index.ts           # Export barrel
│   │   └── Card/
│   │       ├── card.html
│   │       ├── Card.ts
│   │       └── index.ts
│   └── utils/
│       ├── helpers.ts             # Shared utilities
│       └── constants.ts           # Library constants
├── .npmignore
├── README.md
├── CHANGELOG.md
├── LICENSE
├── package.json
├── tsconfig.json
├── vite.config.js
└── .github/
    └── workflows/
        └── publish.yml           # CI/CD publishing
```

### What to Include/Exclude

**Include in package.json files array:**

- ✅ `dist/` - Built outputs
- ✅ `src/components/` - Component HTML files
- ✅ `README.md`, `LICENSE`, `CHANGELOG.md`

**Exclude with .npmignore:**

```
# Build outputs
*.tsbuildinfo

# Development
samples/
test/
*.test.ts
*.stories.ts
.github/

# Dependencies
node_modules/

# Config
vite.config.js
tsconfig.json
```

---

## Creating Components

### Component Structure: HTML + TypeScript

Each component has 3 files:

#### 1. **Component Template (.html)**

Single-file component with template, styles, and scripts:

```html
<style>
  /* Scoped with Shadow DOM */
  :host {
    display: block;
  }
  .button {
    /* styles */
  }
</style>

<!-- Template with LadrillosJS directives -->
<button class="button-{size}" onclick="handleClick()">
  <slot>{label}</slot>
</button>

<script>
  // State - automatically tracked
  let size = this.getAttribute("size") || "md";
  let label = this.getAttribute("label") || "Click";
  let count = 0;

  // Exported functions - available to event handlers
  export const handleClick = () => {
    count++;
    $emit("button:click", { count });
  };

  // Lifecycle
  $onMount(() => console.log("Ready!"));
</script>
```

#### 2. **TypeScript Helpers (.ts)**

Type definitions and helper functions:

```typescript
import type { ButtonProps, MyButton } from "../../types";

export { type ButtonProps, type MyButton } from "../../types";

// Metadata for documentation
export const buttonMetadata = {
  name: "my-button",
  version: "1.0.0",
  props: {
    size: "sm | md | lg",
    variant: "primary | secondary",
  },
  events: ["button:click"],
};

// Optional: Component-specific utilities
export function formatButtonLabel(label: string): string {
  return label.trim().toLowerCase();
}
```

#### 3. **Export Barrel (index.ts)**

Re-export types and metadata:

```typescript
export * from "./Button";
export { buttonMetadata } from "./Button";
```

### Component Features

#### Props via Attributes

```html
<script>
  let variant = this.getAttribute("variant") || "primary";
  let disabled = this.hasAttribute("disabled");
  let count = parseInt(this.getAttribute("count") || "0");
</script>
```

#### Two-Way Binding with $bind

```html
<input type="text" $bind="username" placeholder="Username" />

<script>
  let username = this.getAttribute("username") || "";
</script>
```

#### Custom Events

```html
<script>
  export const save = () => {
    const data = { timestamp: Date.now() /* ... */ };

    // Consumers listen with: btn.addEventListener('save', handler)
    $emit("save", data);
  };
</script>
```

#### Public Methods

```html
<script>
  export const open = () => {
    /* ... */
  };
  export const close = () => {
    /* ... */
  };
  export const setLoading = (state) => {
    /* ... */
  };
</script>
```

#### Lifecycle Hooks

```html
<script>
  $onMount(() => {
    // Initialize, fetch data, setup listeners
    console.log("Component mounted");
  });

  $onUpdate(() => {
    // React to state changes
    console.log("State updated:", $getState());
  });

  $onUnmount(() => {
    // Cleanup: clear timers, unsubscribe
    clearInterval(timer);
  });
</script>
```

---

## TypeScript Support

### Type-Safe Component Creation

```typescript
// ❌ Without types
const btn = document.createElement("my-button");
btn.addEventListener("click", handler); // No type checking!

// ✅ With types
import { createButton, type MyButton } from "@mycompany/ui-components";

const btn = createButton("#my-btn") as MyButton;

// TypeScript knows about:
btn.setAttribute("size", "lg"); // ✓ Autocomplete
btn.addEventListener("button:click", handler); // ✓ Typed event

// Programmatic creation
const newBtn = createButton();
newBtn.setAttribute("variant", "primary");
document.body.appendChild(newBtn);
```

### Defining Custom Interfaces

```typescript
// src/types/custom-input.types.ts
export interface CustomInputProps {
  type?: "text" | "email" | "password";
  placeholder?: string;
  required?: boolean;
  pattern?: string;
  minLength?: number;
}

export interface CustomInputEvents {
  "input:change": { value: string };
  "input:validate": { isValid: boolean };
}

export interface MyCustomInput extends Omit<HTMLElement, "title"> {
  type?: CustomInputProps["type"];
  placeholder?: string;
  required?: boolean;
  value?: string;

  validate(): boolean;
  clear(): void;
  focus(): void;

  addEventListener(
    type: "input:change",
    listener: (e: CustomEvent<CustomInputEvents["input:change"]>) => void
  ): void;
  addEventListener(
    type: "input:validate",
    listener: (e: CustomEvent<CustomInputEvents["input:validate"]>) => void
  ): void;
}

export function createCustomInput(selector?: string): MyCustomInput | null {
  return selector
    ? (document.querySelector(selector) as MyCustomInput | null)
    : (document.createElement("my-custom-input") as MyCustomInput);
}
```

---

## Building Your Library

### Development

```bash
# Watch mode with hot reload
npm run dev
# or
vite

# Visit http://localhost:5173 with sample app
```

### Production Build

```bash
npm run build

# Outputs:
# dist/index.es.js      - ES module (recommended)
# dist/index.cjs.js     - CommonJS
# dist/index.umd.js     - UMD browser global
# dist/index.d.ts       - TypeScript declarations
```

### Testing

```bash
# Unit tests
npm run test

# Coverage
npm run test:coverage
```

---

## Publishing to NPM

### 1. Prepare for Publishing

```bash
# Ensure clean build
npm run build

# Check what will be published
npm pack

# Verify dist contains all needed files
ls -la dist/
```

### 2. Create NPM Account

```bash
npm adduser
# or if already have account:
npm login
```

### 3. Publish

```bash
# First time
npm publish --access public

# Updates (increment version first)
npm version patch  # 1.0.0 -> 1.0.1
npm publish
```

### 4. GitHub Actions CI/CD (Optional)

**.github/workflows/publish.yml**

```yaml
name: Publish to NPM

on:
  push:
    tags:
      - "v*"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
          registry-url: "https://registry.npmjs.org"

      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Usage Examples

### For Library Consumers

#### Installation

```bash
npm install @mycompany/ui-components
```

#### Use All Components

```html
<!DOCTYPE html>
<html>
  <body>
    <my-button label="Click Me" variant="primary"></my-button>
    <my-card title="Hello">Content here</my-card>

    <script type="module">
      import { registerMyComponents } from "@mycompany/ui-components";

      await registerMyComponents();
    </script>
  </body>
</html>
```

#### Use Individual Component

```typescript
import {
  registerMyButton,
  createButton,
  type MyButton,
} from "@mycompany/ui-components";

await registerMyButton();

const btn = createButton("#my-btn") as MyButton;
btn.addEventListener("button:click", (e) => {
  console.log("Clicked at:", e.detail.timestamp);
});
```

#### TypeScript Support

```typescript
import {
  registerMyComponents,
  createButton,
  type ButtonProps,
  type MyButton,
} from "@mycompany/ui-components";

await registerMyComponents();

// Programmatic element creation with types
const btn = createButton() as MyButton;
btn.setAttribute("size", "lg");
btn.setAttribute("variant", "primary");

// Type-safe event listener
btn.addEventListener("button:click", (event) => {
  // event.detail is typed!
  console.log("Clicked:", event.detail.timestamp);
});

// Apply props object
const props: ButtonProps = {
  variant: "secondary",
  size: "md",
  disabled: false,
};
```

#### React Integration (Example)

```tsx
import { useEffect, useRef } from "react";
import { registerMyButton, type MyButton } from "@mycompany/ui-components";

export function MyButtonComponent() {
  const ref = useRef<MyButton>(null);

  useEffect(() => {
    registerMyButton();
  }, []);

  useEffect(() => {
    const btn = ref.current;
    if (!btn) return;

    const handleClick = (e: CustomEvent) => {
      console.log("Button clicked");
    };

    btn.addEventListener("button:click", handleClick);
    return () => btn.removeEventListener("button:click", handleClick);
  }, []);

  return <my-button ref={ref} label="React Button" />;
}
```

---

## Best Practices

### ✅ DO

- **Document everything** - Add JSDoc comments to types and functions
- **Use TypeScript** - Provides great DX for consumers
- **Ship type definitions** - Always include `.d.ts` files
- **Test thoroughly** - Unit tests for each component
- **Version semver** - Follow semantic versioning
- **Write README** - Clear installation and usage instructions
- **Create examples** - Sample code for each component
- **Keep components focused** - One responsibility per component

### ❌ DON'T

- **Don't include dependencies** - Keep libraries lightweight (use peerDependencies)
- **Don't break Shadow DOM** - Users expect scoped styles
- **Don't export internal types** - Only export public APIs
- **Don't force specific build tools** - Support all bundlers
- **Don't hardcode colors/sizes** - Use CSS variables for customization
- **Don't ignore accessibility** - Include proper ARIA attributes

---

## Examples

See the full example library in `samples/component-library/` and demo app in `samples/apps/component-library-demo/`.

```bash
# Run the demo
npm run dev
# Visit: http://localhost:5173/samples/apps/component-library-demo/
```

---

## Resources

- [LadrillosJS Documentation](../README.md)
- [Web Components MDN](https://developer.mozilla.org/en-US/docs/Web/Web_Components)
- [NPM Package Best Practices](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages)
- [TypeScript Declaration Files](https://www.typescriptlang.org/docs/handbook/declaration-files/)
