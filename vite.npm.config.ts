import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      rollupTypes: false, // Disabled due to __DEV__ export compatibility
      insertTypesEntry: true,
      copyDtsFiles: false, // Don't copy individual .d.ts files
      include: ["src/index.ts"], // Only generate types for entry
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"], // ESM for modern bundlers
      fileName: "index",
    },
    outDir: "dist",
    minify: "terser", // Better minification than esbuild
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log statements
        drop_debugger: true, // Remove debugger statements
        pure_funcs: ["console.log", "console.warn", "console.info"], // Treat as side-effect free
        passes: 2, // Multiple compression passes
      },
      mangle: {
        properties: false, // Don't mangle property names (safer)
      },
      format: {
        comments: false, // Remove all comments
      },
    },
    sourcemap: false, // No source maps in npm package
    rollupOptions: {
      output: {
        preserveModules: false, // Bundle into single file
      },
      treeshake: {
        moduleSideEffects: false, // Aggressive tree-shaking
        propertyReadSideEffects: false,
      },
    },
    emptyOutDir: true,
  },
});
