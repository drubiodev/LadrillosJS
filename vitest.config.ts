import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    // Tests run against source; default to dev mode for warnings/error paths.
    __DEV__: JSON.stringify(true),
  },
  test: {
    environment: "happy-dom",
    // Parsing a component containing <link rel="stylesheet"> otherwise makes
    // happy-dom fetch it for real, so the suite depends on the network.
    environmentOptions: {
      happyDOM: {
        settings: { disableCSSFileLoading: true },
      },
    },
    globals: true,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/global.d.ts",
        "src/index.ts",
        "src/core.ts",
        "src/events.ts",
        "src/lazy.ts",
      ],
      // Thresholds reflect unit-level coverage of pure modules only.
      // End-to-end component rendering coverage (directiveProcessor,
      // webcomponent, scriptParser, reactivity, moduleExecutor) requires
      // a real-browser runner (see docs roadmap: Playwright integration).
      thresholds: {
        lines: 15,
        functions: 60,
        branches: 45,
        statements: 15,
      },
    },
  },
});
