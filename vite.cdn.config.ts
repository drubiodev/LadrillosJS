import { defineConfig } from "vite";
import { resolve } from "path";

// ============================================================================
// Build Configuration for CDN (IIFE) Bundle
// ============================================================================
//
// This config builds a production-ready IIFE bundle for CDN usage.
// Uses the same bundle optimization techniques as the NPM build.
// ============================================================================

export default defineConfig({
  // Define compile-time constants for dead code elimination
  define: {
    __DEV__: JSON.stringify(false), // Production - eliminates all dev code
  },

  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ladrillosjs", // Global variable name (window.ladrillosjs)
      fileName: "ladrillos",
      formats: ["iife"],
    },
    outDir: "dist-cdn",
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
    rollupOptions: {
      output: {
        exports: "named",
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
