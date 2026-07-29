import { defineConfig } from "vite";
import { resolve } from "path";
import { rmSync } from "node:fs";
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
      copyDtsFiles: true,
      include: ["src/**/*.ts"],
      // global.d.ts declares __DEV__ but must not be emitted, so it is filtered
      // from the output below rather than excluded from the program — excluding
      // it leaves __DEV__ unresolved (TS2304) in core/js/compiler.ts.
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
      tsconfigPath: "./tsconfig.json",
      afterBuild: (emitted) =>
      {
        for (const file of emitted.keys())
        {
          if (file.endsWith("global.d.ts")) rmSync(file, { force: true });
        }
      },
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
        csp: resolve(__dirname, "src/csp.ts"),
        lazy: resolve(__dirname, "src/lazy.ts"),
        events: resolve(__dirname, "src/events.ts"),
        // Build-time only. verify-treeshaking.js asserts no runtime entry
        // reaches it, so it never lands in an application bundle.
        compiler: resolve(__dirname, "src/compiler/index.ts"),
      },
      formats: ["es"],
    },
    outDir: "dist",
    minify: "terser",
    terserOptions: {
      compress: {
        ecma: 2020,
        drop_console: false,
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
    sourcemap: true,
    rollupOptions: {
      // `../ladrillos` is imported dynamically in builtins/lazyElement.ts purely
      // to break a module-init cycle; it is also imported statically elsewhere,
      // so Rollup can't (and shouldn't) split it into its own chunk. Silence the
      // resulting INEFFECTIVE_DYNAMIC_IMPORT notice; forward all other warnings.
      onwarn(warning, defaultHandler)
      {
        if (warning.code === "INEFFECTIVE_DYNAMIC_IMPORT") return;
        defaultHandler(warning);
      },
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
      },
    },
    emptyOutDir: true,
  },
});
