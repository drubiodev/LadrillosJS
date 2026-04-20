import { defineConfig } from "vite";
import { resolve } from "path";

// ============================================================================
// Development Build Configuration for CDN
// ============================================================================
//
// This config builds a development IIFE bundle with:
// - All dev warnings and logging enabled
// - No minification for debugging
// - Source maps included
//
// Use for local development: npm run build:cdn:dev
// ============================================================================

export default defineConfig({
  // Development mode - keep all dev code
  define: {
    __DEV__: JSON.stringify(true),
  },

  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ladrillosjs",
      fileName: "ladrillos",
      formats: ["iife"],
    },
    outDir: "dist-cdn",
    minify: false, // No minification for debugging
    sourcemap: true, // Include source maps
    rollupOptions: {
      output: {
        exports: "named",
        entryFileNames: "ladrillos.dev.iife.js",
      },
    },
    emptyOutDir: true,
  },
});
