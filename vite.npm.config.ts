import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

// ============================================================================
// Build Configuration for NPM Package
// ============================================================================
//
// Bundle size optimization techniques:
// 1. __DEV__ flag - Compile-time constant for tree-shaking dev-only code
// 2. pure_getters - Tells minifier property access has no side effects
// 3. Aggressive tree-shaking - moduleSideEffects: false
// 4. Multiple compression passes for maximum minification
// 5. Multiple entry points for granular imports
// ============================================================================

export default defineConfig({
  plugins: [
    dts({
      rollupTypes: false,
      insertTypesEntry: true,
      copyDtsFiles: false,
      include: ["src/index.ts", "src/core.ts", "src/lazy.ts", "src/events.ts"],
      tsconfigPath: "./tsconfig.json",
    }),
  ],

  define: {
    __DEV__: JSON.stringify(false),
  },

  build: {
    lib: {
      // Multiple entry points for tree-shaking
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        core: resolve(__dirname, "src/core.ts"),
        lazy: resolve(__dirname, "src/lazy.ts"),
        events: resolve(__dirname, "src/events.ts"),
      },
      formats: ["es"],
    },
    outDir: "dist",
    minify: "terser",
    terserOptions: {
      compress: {
        ecma: 2020,
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.warn", "console.info"],
        pure_getters: true,
        passes: 3,
        inline: 2,
        unused: true,
        collapse_vars: true,
        reduce_vars: true,
        dead_code: true,
        conditionals: true,
        evaluate: true,
        booleans: true,
      },
      mangle: {
        properties: false,
      },
      format: {
        comments: false,
      },
    },
    sourcemap: false,
    rollupOptions: {
      output: {
        preserveModules: false,
        minifyInternalExports: true,
        // Ensure consistent chunk naming
        entryFileNames: "[name].js",
        chunkFileNames: "shared-[hash].js",
      },
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        preset: "smallest",
      },
    },
    emptyOutDir: true,
  },
});
